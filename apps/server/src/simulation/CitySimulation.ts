import { LIMITS, type InputMessage } from '@synccity/shared/protocol';
import {
  CHECKPOINTS,
  CITY_BOUNDS,
  CITY_COLLIDERS,
  MYSTERY_BOX_SPOTS,
  RACE_CIRCUIT,
  SKY_RINGS,
  getSeatWorldTransform,
  isPlaneVehicle,
  resolveCircleCollision,
  stepVehicleKinematics,
} from '@synccity/shared/world';
import { RaceParticipantSchema, type CityRoomState } from '../schema/CityRoomState.js';

export interface PlayerInputRecord {
  input: InputMessage;
  receivedAtMs: number;
}

const POWERUP_POOL = ['nitro', 'rocket', 'emp'] as const;

export class CitySimulation {
  private state: CityRoomState;
  private playerInputs = new Map<string, PlayerInputRecord>();
  private raceProgress = new Map<string, { nextGateIndex: number; lapStartTimeMs: number }>();
  private boxCooldowns = new Map<string, number>();
  private skyRingCooldowns = new Map<string, number>();
  private countdownTimerMs: number = 0;
  private finishRankCounter: number = 1;

  constructor(state: CityRoomState) {
    this.state = state;
  }

  public setPlayerInput(playerId: string, input: InputMessage): void {
    this.playerInputs.set(playerId, {
      input,
      receivedAtMs: Date.now(),
    });
  }

  public clearPlayerInput(playerId: string): void {
    this.playerInputs.delete(playerId);
  }

  public update(dt: number): void {
    this.state.tick++;
    const now = Date.now();
    this.state.serverTimeMs = now;

    // 1. Simulate Vehicles & Planes & Seated Occupants
    this.state.vehicles.forEach((vehicle) => {
      const driverId = vehicle.seats[0];
      const passengerId = vehicle.seats[1];
      const isPlane = isPlaneVehicle(vehicle.id);

      let throttle = 0;
      let steer = 0;
      let brake = false;

      if (driverId && driverId !== '') {
        const driver = this.state.players.get(driverId);
        const inputRec = this.playerInputs.get(driverId);

        if (driver && driver.connected) {
          if (inputRec && now - inputRec.receivedAtMs <= LIMITS.staleInputMs) {
            // Apply fresh driver controls
            throttle = Math.max(-1, Math.min(1, inputRec.input.throttle || 0));
            steer = Math.max(-1, Math.min(1, inputRec.input.steer || 0));
            brake = !!inputRec.input.brake;
          } else {
            // Driver connected but stale input: apply friction
            throttle = 0;
            steer = 0;
            brake = false;
          }
        } else {
          // Driver disconnected: immediately brake
          brake = true;
        }
      }

      // Step vehicle / plane kinematics
      const nextSim = stepVehicleKinematics(
        { x: vehicle.x, y: vehicle.y, z: vehicle.z, yaw: vehicle.yaw, speed: vehicle.speed },
        throttle,
        steer,
        brake,
        dt,
        CITY_COLLIDERS,
        CITY_BOUNDS,
        isPlane
      );

      vehicle.x = nextSim.x;
      vehicle.y = nextSim.y;
      vehicle.z = nextSim.z;
      vehicle.yaw = nextSim.yaw;
      vehicle.speed = nextSim.speed;

      // Sky Ring Bonus Cash for Planes
      if (isPlane && vehicle.y > 6.0 && driverId) {
        const driver = this.state.players.get(driverId);
        if (driver && driver.connected) {
          for (let i = 0; i < SKY_RINGS.length; i++) {
            const ring = SKY_RINGS[i];
            const key = `${driverId}:${ring.id}`;
            const readyAt = this.skyRingCooldowns.get(key) || 0;
            if (now < readyAt) continue;

            const dx = vehicle.x - ring.x;
            const dy = vehicle.y - ring.y;
            const dz = vehicle.z - ring.z;
            if (dx * dx + dy * dy + dz * dz <= ring.radius * ring.radius) {
              this.skyRingCooldowns.set(key, now + 6000);
              driver.cash = (driver.cash || 0) + 500;
              if (passengerId) {
                const pass = this.state.players.get(passengerId);
                if (pass) pass.cash = (pass.cash || 0) + 500;
              }
            }
          }
        }
      }

      // Synchronize driver transform
      if (driverId && driverId !== '') {
        const driver = this.state.players.get(driverId);
        if (driver) {
          const t = getSeatWorldTransform(vehicle.x, vehicle.y, vehicle.z, vehicle.yaw, 0);
          driver.x = t.x;
          driver.y = t.y;
          driver.z = t.z;
          driver.yaw = t.yaw;
        }
      }

      // Synchronize passenger transform
      if (passengerId && passengerId !== '') {
        const passenger = this.state.players.get(passengerId);
        if (passenger) {
          const t = getSeatWorldTransform(vehicle.x, vehicle.y, vehicle.z, vehicle.yaw, 1);
          passenger.x = t.x;
          passenger.y = t.y;
          passenger.z = t.z;
          passenger.yaw = t.yaw;
        }
      }
    });

    // 1b. Vehicle-to-Vehicle Arcade Bump Physics (Cars on same altitude)
    const vehList = Array.from(this.state.vehicles.values());
    for (let i = 0; i < vehList.length; i++) {
      for (let j = i + 1; j < vehList.length; j++) {
        const a = vehList[i];
        const b = vehList[j];
        if (Math.abs(a.y - b.y) > 3.0) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const distSq = dx * dx + dz * dz;
        const minDist = 2.6;
        if (distSq > 0.0001 && distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const nz = dz / dist;
          a.x -= nx * overlap;
          a.z -= nz * overlap;
          b.x += nx * overlap;
          b.z += nz * overlap;
        }
      }
    }

    // 2. Simulate Walking Players & Mystery Item Box Pickups
    this.state.players.forEach((player) => {
      if (!player.connected) return;

      if (player.mode === 'walking') {
        const inputRec = this.playerInputs.get(player.id);
        if (inputRec && now - inputRec.receivedAtMs <= LIMITS.staleInputMs) {
          let ax = inputRec.input.axisX || 0;
          let az = inputRec.input.axisZ || 0;

          const lenSq = ax * ax + az * az;
          if (lenSq > 1) {
            const invLen = 1 / Math.sqrt(lenSq);
            ax *= invLen;
            az *= invLen;
          }

          if (lenSq > 0.001) {
            const speed = LIMITS.walkingSpeed;
            const targetX = player.x + ax * speed * dt;
            const targetZ = player.z + az * speed * dt;

            const resolved = resolveCircleCollision(
              player.x,
              player.z,
              targetX,
              targetZ,
              0.45,
              CITY_COLLIDERS,
              CITY_BOUNDS
            );

            player.x = resolved.x;
            player.y = 0;
            player.z = resolved.z;
            player.yaw = Math.atan2(ax, az);
          }
        }
      }

      // Check Mystery Weapon/Item Box Pickups (SmashKarts style)
      if (!player.heldItem || player.heldItem === '') {
        for (let i = 0; i < MYSTERY_BOX_SPOTS.length; i++) {
          const spot = MYSTERY_BOX_SPOTS[i];
          const readyAt = this.boxCooldowns.get(spot.id) || 0;
          if (now < readyAt) continue;

          const dx = player.x - spot.x;
          const dy = player.y - spot.y;
          const dz = player.z - spot.z;
          if (dx * dx + dy * dy + dz * dz <= 4.2 * 4.2) {
            this.boxCooldowns.set(spot.id, now + 4500);
            const randomItem = POWERUP_POOL[(this.state.tick + i) % POWERUP_POOL.length];
            player.heldItem = randomItem;
            player.cash = (player.cash || 0) + 50;
            break;
          }
        }
      }
    });

    // 3. Solo & Co-op Heist Delivery State Machine
    this.updateDelivery(now);

    // 4. Grand Prix Racing Circuit State Machine
    this.updateRace(now, dt);
  }

  public useItem(playerId: string): { ok: boolean; item?: string; hitCount?: number } {
    const player = this.state.players.get(playerId);
    if (!player || !player.connected || !player.heldItem) {
      return { ok: false };
    }

    const item = player.heldItem;
    player.heldItem = '';

    const myVeh = player.vehicleId ? this.state.vehicles.get(player.vehicleId) : undefined;
    let hitCount = 0;

    if (item === 'nitro') {
      if (myVeh) {
        const isPlane = isPlaneVehicle(myVeh.id);
        myVeh.speed = Math.max(myVeh.speed + 14, isPlane ? 36 : 27);
      }
      player.cash = (player.cash || 0) + 150;
      return { ok: true, item, hitCount: 1 };
    }

    if (item === 'emp') {
      this.state.vehicles.forEach((veh) => {
        if (myVeh && veh.id === myVeh.id) return;
        const dx = veh.x - player.x;
        const dz = veh.z - player.z;
        if (dx * dx + dz * dz <= 45 * 45) {
          veh.speed *= 0.2;
          hitCount++;
        }
      });
      player.cash = (player.cash || 0) + 200 + hitCount * 200;
      return { ok: true, item, hitCount };
    }

    if (item === 'rocket') {
      const refYaw = myVeh ? myVeh.yaw : player.yaw;
      const fx = Math.sin(refYaw);
      const fz = Math.cos(refYaw);

      let closestVeh: any = null;
      let closestDistSq = 85 * 85;

      this.state.vehicles.forEach((veh) => {
        if (myVeh && veh.id === myVeh.id) return;
        const dx = veh.x - player.x;
        const dz = veh.z - player.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < closestDistSq && dSq > 0.1) {
          const dist = Math.sqrt(dSq);
          const dot = (dx / dist) * fx + (dz / dist) * fz;
          // Forward 140-degree lock-on cone (or within 18m all-around)
          if (dot > -0.2 || dist < 18) {
            closestDistSq = dSq;
            closestVeh = veh;
          }
        }
      });

      if (closestVeh) {
        closestVeh.speed = Math.min(closestVeh.speed, 2.5);
        closestVeh.yaw += 1.25;
        hitCount = 1;
      }
      if (myVeh) {
        myVeh.speed = Math.max(myVeh.speed, 22);
      }
      player.cash = (player.cash || 0) + (hitCount > 0 ? 450 : 150);
      return { ok: true, item, hitCount };
    }

    return { ok: true, item, hitCount: 0 };
  }

  public quickSpawnVehicle(playerId: string, kind: 'car' | 'plane'): boolean {
    const player = this.state.players.get(playerId);
    if (!player || !player.connected) return false;

    // If player is already driving the requested kind, keep them there and give a small boost
    if (player.vehicleId) {
      const currentVeh = this.state.vehicles.get(player.vehicleId);
      if (currentVeh && isPlaneVehicle(currentVeh.id) === (kind === 'plane') && player.seatIndex === 0) {
        return true;
      }
    }

    // Find nearest unoccupied vehicle of the requested kind (or passenger seat if all driver seats taken)
    let targetVeh: any = null;
    let targetSeat: 0 | 1 = 0;
    let bestDistSq = Infinity;

    this.state.vehicles.forEach((veh) => {
      const isPlane = isPlaneVehicle(veh.id);
      if ((kind === 'plane') !== isPlane) return;

      if (veh.seats[0] === '') {
        const dx = veh.x - player.x;
        const dz = veh.z - player.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          targetVeh = veh;
          targetSeat = 0;
        }
      }
    });

    if (!targetVeh) {
      this.state.vehicles.forEach((veh) => {
        const isPlane = isPlaneVehicle(veh.id);
        if ((kind === 'plane') !== isPlane) return;
        if (veh.seats[1] === '') {
          targetVeh = veh;
          targetSeat = 1;
        }
      });
    }

    if (!targetVeh) return false;

    // Vacate previous vehicle seat if seated
    if (player.vehicleId) {
      const prevVeh = this.state.vehicles.get(player.vehicleId);
      if (prevVeh && (player.seatIndex === 0 || player.seatIndex === 1)) {
        if (prevVeh.seats[player.seatIndex] === player.id) {
          prevVeh.seats[player.seatIndex] = '';
        }
      }
    }

    targetVeh.seats[targetSeat] = player.id;
    player.vehicleId = targetVeh.id;
    player.seatIndex = targetSeat;
    player.mode = targetSeat === 0 ? 'driver' : 'passenger';
    player.inputEpoch++;
    player.lastInputSeq = 0;

    const seatTransform = getSeatWorldTransform(
      targetVeh.x,
      targetVeh.y,
      targetVeh.z,
      targetVeh.yaw,
      targetSeat
    );
    player.x = seatTransform.x;
    player.y = seatTransform.y;
    player.z = seatTransform.z;
    player.yaw = seatTransform.yaw;

    this.clearPlayerInput(player.id);
    return true;
  }

  public startRace(): boolean {
    const race = this.state.race;
    if (race.status === 'countdown' || race.status === 'racing') {
      return false;
    }

    race.participants.clear();
    this.raceProgress.clear();
    this.finishRankCounter = 1;

    // Auto-seat walking players into unoccupied cars if they clicked Start Race while on foot
    this.state.players.forEach((p) => {
      if (p.connected && p.mode === 'walking') {
        this.quickSpawnVehicle(p.id, 'car');
      }
    });

    let enrolled = 0;
    const gridOffsets = [
      { x: -4.5, z: 22 },
      { x: 4.5, z: 22 },
      { x: -4.5, z: 15 },
      { x: 4.5, z: 15 },
      { x: -4.5, z: 8 },
      { x: 4.5, z: 8 },
    ];

    this.state.vehicles.forEach((veh) => {
      const driverId = veh.seats[0];
      if (driverId) {
        const p = this.state.players.get(driverId);
        if (p && p.connected) {
          // If car is far from the start line (> 18m), line it up on the Starting Grid
          const dx = veh.x - RACE_CIRCUIT[0].x;
          const dz = veh.z - RACE_CIRCUIT[0].z;
          if (dx * dx + dz * dz > 18 * 18) {
            const slot = gridOffsets[enrolled % gridOffsets.length];
            veh.x = slot.x;
            veh.y = 0;
            veh.z = slot.z;
            veh.yaw = 0;
            veh.speed = 0;
          }

          const rp = new RaceParticipantSchema();
          rp.playerId = p.id;
          rp.displayName = p.displayName || 'Driver';
          rp.vehicleId = veh.id;
          rp.currentLap = 1;
          rp.bestLapMs = 0;
          rp.totalTimeMs = 0;
          rp.finished = false;
          rp.rank = 0;
          race.participants.set(p.id, rp);
          this.raceProgress.set(p.id, { nextGateIndex: 1, lapStartTimeMs: 0 });
          enrolled++;
        }
      }
    });

    if (enrolled === 0) {
      this.state.players.forEach((p) => {
        if (p.connected) {
          const rp = new RaceParticipantSchema();
          rp.playerId = p.id;
          rp.displayName = p.displayName || 'Racer';
          rp.vehicleId = p.vehicleId || '';
          rp.currentLap = 1;
          rp.bestLapMs = 0;
          rp.totalTimeMs = 0;
          rp.finished = false;
          rp.rank = 0;
          race.participants.set(p.id, rp);
          this.raceProgress.set(p.id, { nextGateIndex: 1, lapStartTimeMs: 0 });
          enrolled++;
        }
      });
    }

    race.status = 'countdown';
    race.countdownSeconds = 3;
    race.startedAtMs = 0;
    this.countdownTimerMs = 3000;
    return true;
  }

  private updateRace(now: number, dt: number): void {
    const race = this.state.race;

    if (race.status === 'idle') {
      const startGate = RACE_CIRCUIT[0];
      const startRadiusSq = startGate.radius * startGate.radius;
      this.state.vehicles.forEach((veh) => {
        if (race.status !== 'idle') return;
        const driverId = veh.seats[0];
        if (!driverId) return;
        const dx = veh.x - startGate.x;
        const dz = veh.z - startGate.z;
        if (dx * dx + dz * dz <= startRadiusSq && Math.abs(veh.speed) < 2) {
          this.startRace();
        }
      });
      return;
    }

    if (race.status === 'countdown') {
      this.countdownTimerMs -= dt * 1000;
      race.countdownSeconds = Math.max(0, Math.ceil(this.countdownTimerMs / 1000));
      if (this.countdownTimerMs <= 0) {
        race.status = 'racing';
        race.startedAtMs = now;
        race.countdownSeconds = 0;
        this.raceProgress.forEach((prog) => {
          prog.lapStartTimeMs = now;
          prog.nextGateIndex = 1;
        });
      }
      return;
    }

    if (race.status === 'racing') {
      let allFinished = true;

      race.participants.forEach((part, playerId) => {
        if (part.finished) return;
        allFinished = false;

        const player = this.state.players.get(playerId);
        if (!player || !player.connected) return;

        let posX = player.x;
        let posZ = player.z;
        if (player.vehicleId) {
          const veh = this.state.vehicles.get(player.vehicleId);
          if (veh) {
            posX = veh.x;
            posZ = veh.z;
          }
        }

        const prog = this.raceProgress.get(playerId);
        if (!prog) return;

        const targetGate = RACE_CIRCUIT[prog.nextGateIndex];
        const dx = posX - targetGate.x;
        const dz = posZ - targetGate.z;
        const distSq = dx * dx + dz * dz;

        if (distSq <= targetGate.radius * targetGate.radius) {
          // Award checkpoint bonus cash
          player.cash = (player.cash || 0) + 100;

          if (prog.nextGateIndex === 0) {
            const lapTime = Math.max(1, now - prog.lapStartTimeMs);
            if (part.bestLapMs === 0 || lapTime < part.bestLapMs) {
              part.bestLapMs = lapTime;
            }
            prog.lapStartTimeMs = now;

            if (part.currentLap >= race.totalLaps) {
              part.finished = true;
              part.totalTimeMs = now - race.startedAtMs;
              part.rank = this.finishRankCounter++;
              player.cash = (player.cash || 0) + (part.rank === 1 ? 2000 : 1000);
            } else {
              part.currentLap++;
              prog.nextGateIndex = 1;
              player.cash = (player.cash || 0) + 400;
            }
          } else {
            prog.nextGateIndex = (prog.nextGateIndex + 1) % RACE_CIRCUIT.length;
          }
        }
      });

      if (allFinished && race.participants.size > 0) {
        race.status = 'finished';
        this.countdownTimerMs = 15000;
      }
    } else if (race.status === 'finished') {
      this.countdownTimerMs -= dt * 1000;
      if (this.countdownTimerMs <= 0) {
        race.status = 'idle';
        race.participants.clear();
        this.raceProgress.clear();
      }
    }
  }

  private updateDelivery(now: number): void {
    const delivery = this.state.delivery;

    if (delivery.phase === 'available') {
      const pickup = CHECKPOINTS.pickup;
      const pickupRadiusSq = pickup.radius * pickup.radius;

      this.state.vehicles.forEach((vehicle) => {
        if (delivery.phase !== 'available') return;

        const dId = vehicle.seats[0];
        const pId = vehicle.seats[1];
        if (!dId) return;

        const driver = this.state.players.get(dId);
        if (!driver?.connected) return;

        const passenger = pId ? this.state.players.get(pId) : undefined;
        const hasCoopPassenger = !!(pId && passenger?.connected);

        // Allow solo or co-op vehicles to pick up cargo when entering pickup zone at controlled speed
        if (Math.abs(vehicle.speed) > 12.0 || vehicle.y > 8.0) return;

        const dx = vehicle.x - pickup.x;
        const dz = vehicle.z - pickup.z;
        if (dx * dx + dz * dz <= pickupRadiusSq) {
          delivery.phase = 'active';
          delivery.id = `deliv_${now}`;
          delivery.vehicleId = vehicle.id;
          delivery.participantIds.clear();
          if (hasCoopPassenger && pId) {
            delivery.participantIds.push(dId, pId);
          } else {
            delivery.participantIds.push(dId);
          }
          delivery.completedAtMs = 0;
          delivery.restartAtMs = 0;
        }
      });
    } else if (delivery.phase === 'active') {
      const vehicle = this.state.vehicles.get(delivery.vehicleId);
      if (!vehicle) {
        this.resetDelivery('available', now);
        return;
      }

      const requiredCount = delivery.participantIds.length;
      const p0 = delivery.participantIds[0];
      const p1 = delivery.participantIds[1];
      const dPlayer = p0 ? this.state.players.get(p0) : undefined;
      const passPlayer = p1 ? this.state.players.get(p1) : undefined;

      const stillSeated =
        requiredCount === 2
          ? vehicle.seats[0] === p0 &&
            vehicle.seats[1] === p1 &&
            dPlayer?.connected &&
            passPlayer?.connected
          : vehicle.seats[0] === p0 && dPlayer?.connected;

      if (!stillSeated) {
        this.resetDelivery('available', now);
        return;
      }

      // Check destination checkpoint
      const dest = CHECKPOINTS.destination;
      const destRadiusSq = dest.radius * dest.radius;
      const dx = vehicle.x - dest.x;
      const dz = vehicle.z - dest.z;

      if (dx * dx + dz * dz <= destRadiusSq && Math.abs(vehicle.speed) <= 12.0 && vehicle.y <= 8.0) {
        delivery.phase = 'complete';
        delivery.completedAtMs = now;
        delivery.restartAtMs = now + 6000;

        // Payout Cash Reward ($2,500 each for Co-op, $1,000 for Solo Heist)
        const payout = requiredCount >= 2 ? 2500 : 1000;
        if (dPlayer) dPlayer.cash = (dPlayer.cash || 0) + payout;
        if (passPlayer) passPlayer.cash = (passPlayer.cash || 0) + payout;
      }
    } else if (delivery.phase === 'complete') {
      if (now >= delivery.restartAtMs) {
        this.resetDelivery('available', now);
      }
    }
  }

  private resetDelivery(phase: 'available' | 'active' | 'complete', now: number): void {
    const d = this.state.delivery;
    d.phase = phase;
    d.id = `deliv_${now}`;
    d.vehicleId = '';
    d.participantIds.clear();
    d.completedAtMs = 0;
    d.restartAtMs = 0;
  }
}
