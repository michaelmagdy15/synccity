import { LIMITS, type InputMessage } from '@synccity/shared/protocol';
import {
  CHECKPOINTS,
  CITY_BOUNDS,
  CITY_COLLIDERS,
  SEAT_OFFSETS,
  RACE_CIRCUIT,
  getSeatWorldTransform,
  resolveCircleCollision,
  stepVehicleKinematics,
} from '@synccity/shared/world';
import { RaceParticipantSchema, type CityRoomState } from '../schema/CityRoomState.js';

export interface PlayerInputRecord {
  input: InputMessage;
  receivedAtMs: number;
}

export class CitySimulation {
  private state: CityRoomState;
  private playerInputs = new Map<string, PlayerInputRecord>();
  private raceProgress = new Map<string, { nextGateIndex: number; lapStartTimeMs: number }>();
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

    // 1. Simulate Vehicles & Seated Occupants
    this.state.vehicles.forEach((vehicle) => {
      const driverId = vehicle.seats[0];
      const passengerId = vehicle.seats[1];

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

      // Step vehicle kinematics
      const nextSim = stepVehicleKinematics(
        { x: vehicle.x, y: vehicle.y, z: vehicle.z, yaw: vehicle.yaw, speed: vehicle.speed },
        throttle,
        steer,
        brake,
        dt,
        CITY_COLLIDERS,
        CITY_BOUNDS
      );

      vehicle.x = nextSim.x;
      vehicle.y = nextSim.y;
      vehicle.z = nextSim.z;
      vehicle.yaw = nextSim.yaw;
      vehicle.speed = nextSim.speed;

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

    // 2. Simulate Walking Players
    this.state.players.forEach((player) => {
      if (player.mode !== 'walking' || !player.connected) return;

      const inputRec = this.playerInputs.get(player.id);
      if (!inputRec || now - inputRec.receivedAtMs > LIMITS.staleInputMs) return;

      let ax = inputRec.input.axisX || 0;
      let az = inputRec.input.axisZ || 0;

      // Normalize if length > 1
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
        player.z = resolved.z;

        // Yaw points toward travel direction (0 faces +Z, PI/2 faces +X)
        player.yaw = Math.atan2(ax, az);
      }
    });

    // 3. Cooperative Delivery State Machine
    this.updateDelivery(now);

    // 4. Grand Prix Racing Circuit State Machine
    this.updateRace(now, dt);
  }

  public startRace(): boolean {
    const race = this.state.race;
    if (race.status === 'countdown' || race.status === 'racing') {
      return false;
    }

    race.participants.clear();
    this.raceProgress.clear();
    this.finishRankCounter = 1;

    let enrolled = 0;
    this.state.vehicles.forEach((veh) => {
      const driverId = veh.seats[0];
      if (driverId) {
        const p = this.state.players.get(driverId);
        if (p && p.connected) {
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
            } else {
              part.currentLap++;
              prog.nextGateIndex = 1;
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
      // Find a stopped vehicle with both seats filled by connected players within pickup zone
      const pickup = CHECKPOINTS.pickup;
      const pickupRadiusSq = pickup.radius * pickup.radius;

      this.state.vehicles.forEach((vehicle) => {
        if (delivery.phase !== 'available') return;

        const dId = vehicle.seats[0];
        const pId = vehicle.seats[1];
        if (!dId || !pId) return;

        const driver = this.state.players.get(dId);
        const passenger = this.state.players.get(pId);
        if (!driver?.connected || !passenger?.connected) return;

        if (Math.abs(vehicle.speed) > LIMITS.enterMaxSpeed) return;

        const dx = vehicle.x - pickup.x;
        const dz = vehicle.z - pickup.z;
        if (dx * dx + dz * dz <= pickupRadiusSq) {
          // Transition to active delivery!
          delivery.phase = 'active';
          delivery.id = `deliv_${now}`;
          delivery.vehicleId = vehicle.id;
          delivery.participantIds.clear();
          delivery.participantIds.push(dId, pId);
          delivery.completedAtMs = 0;
          delivery.restartAtMs = 0;
        }
      });
    } else if (delivery.phase === 'active') {
      // Check if vehicle still exists and participants are still in the car
      const vehicle = this.state.vehicles.get(delivery.vehicleId);
      if (!vehicle) {
        this.resetDelivery('available', now);
        return;
      }

      const p0 = delivery.participantIds[0];
      const p1 = delivery.participantIds[1];
      const dPlayer = p0 ? this.state.players.get(p0) : undefined;
      const passPlayer = p1 ? this.state.players.get(p1) : undefined;

      const stillSeated =
        vehicle.seats[0] === p0 &&
        vehicle.seats[1] === p1 &&
        dPlayer?.connected &&
        passPlayer?.connected;

      if (!stillSeated) {
        // Participant left or disconnected: cancel delivery
        this.resetDelivery('available', now);
        return;
      }

      // Check destination checkpoint
      const dest = CHECKPOINTS.destination;
      const destRadiusSq = dest.radius * dest.radius;
      const dx = vehicle.x - dest.x;
      const dz = vehicle.z - dest.z;

      if (dx * dx + dz * dz <= destRadiusSq && Math.abs(vehicle.speed) <= LIMITS.exitMaxSpeed) {
        // Delivery completed!
        delivery.phase = 'complete';
        delivery.completedAtMs = now;
        delivery.restartAtMs = now + 10000; // Visible for 10 seconds
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
