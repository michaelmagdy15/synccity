import { Client, Room } from '@colyseus/sdk';
import {
  LIMITS,
  PROTOCOL_VERSION,
  ROOM_NAME,
  type ActionError,
  type ChatMessage,
  type CityState,
  type InputMessage,
  type JoinOptions,
  type PlayerState,
  type ServerMessages,
  type VehicleState,
} from '@synccity/shared/protocol';
import {
  CITY_BOUNDS,
  CITY_COLLIDERS,
  getSeatWorldTransform,
  resolveCircleCollision,
  stepVehicleKinematics,
} from '@synccity/shared/world';

export interface StateSnapshot {
  timeMs: number;
  players: Record<string, PlayerState>;
  vehicles: Record<string, VehicleState>;
  delivery: CityState['delivery'];
  race?: CityState['race'];
}

export type ChatCallback = (msg: ChatMessage) => void;
export type LatencyCallback = (pingMs: number) => void;
export type StatusCallback = (status: 'connected' | 'reconnecting' | 'disconnected', error?: string) => void;

export class NetworkClient {
  private client: Client;
  private room: Room<any, any> | null = null;

  public localPlayerId: string = '';
  public localEpoch: number = 1;
  public roomId: string = '';
  private inputSeq: number = 0;

  private snapshots: StateSnapshot[] = [];
  private maxSnapshots = 20;
  private playerVelocities = new Map<string, { vx: number; vz: number }>();

  private onChatCallbacks: ChatCallback[] = [];
  private onLatencyCallbacks: LatencyCallback[] = [];
  private onStatusCallbacks: StatusCallback[] = [];

  private pingIntervalId: any = null;
  private lastPingSentMs: number = 0;
  private actionResolvers = new Map<string, (res: { ok: boolean; code?: ActionError }) => void>();

  constructor(serverUrl?: string) {
    let url = serverUrl;
    if (!url) {
      const urlParams = new URLSearchParams(window.location.search);
      const queryServer = urlParams.get('server');
      const envServer = (import.meta as any).env?.VITE_SERVER_URL;

      if (queryServer) {
        url = queryServer;
      } else if (envServer) {
        url = envServer;
      } else {
        const isHttps = window.location.protocol === 'https:';
        const wsProto = isHttps ? 'wss:' : 'ws:';
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          url = `${wsProto}//${window.location.hostname}:2567`;
        } else if (window.location.port === '5173') {
          // Local LAN device (e.g. 192.168.x.x:5173)
          url = `${wsProto}//${window.location.hostname}:2567`;
        } else {
          // Public tunnel (e.g. https://*.loca.lt) proxied to port 5173
          url = `${wsProto}//${window.location.host}`;
        }
      }
    }

    this.client = new Client(url);
  }

  public async connect(
    displayName: string,
    roomIdToJoin?: string,
    isCreate: boolean = false
  ): Promise<string> {
    const joinOptions: JoinOptions = {
      protocolVersion: PROTOCOL_VERSION,
      displayName,
    };

    try {
      if (isCreate) {
        this.room = await this.client.create(ROOM_NAME, joinOptions);
      } else if (roomIdToJoin && roomIdToJoin.trim() !== '') {
        this.room = await this.client.joinById(roomIdToJoin.trim(), joinOptions);
      } else {
        this.room = await this.client.joinOrCreate(ROOM_NAME, joinOptions);
      }

      this.roomId = this.room.roomId;
      this.localPlayerId = this.room.sessionId;

      this.bindRoomEvents();
      this.startPingHeartbeat();
      this.emitStatus('connected');

      return this.roomId;
    } catch (err: any) {
      console.error('[NetworkClient] Connection failed:', err);
      this.emitStatus('disconnected', err?.message || 'Failed to connect to server');
      throw err;
    }
  }

  private bindRoomEvents(): void {
    if (!this.room) return;

    this.room.onMessage('welcome', (msg: ServerMessages['welcome']) => {
      this.localPlayerId = msg.playerId;
      this.localEpoch = msg.inputEpoch;
      this.roomId = msg.roomId;
    });

    this.room.onMessage('action:result', (msg: ServerMessages['action:result']) => {
      const resolver = this.actionResolvers.get(msg.requestId);
      if (resolver) {
        resolver({ ok: msg.ok, code: msg.code });
        this.actionResolvers.delete(msg.requestId);
      }
    });

    this.room.onMessage('chat:message', (msg: ChatMessage) => {
      this.onChatCallbacks.forEach((cb) => cb(msg));
    });

    this.room.onMessage('pong', (_msg: ServerMessages['pong']) => {
      const rtt = Date.now() - this.lastPingSentMs;
      this.onLatencyCallbacks.forEach((cb) => cb(rtt));
    });

    this.room.onStateChange((state: any) => {
      this.recordSnapshot(state);
    });

    this.room.onDrop(() => {
      this.emitStatus('reconnecting', 'Connection dropped, reconnecting...');
    });

    this.room.onReconnect(() => {
      this.emitStatus('connected');
    });

    this.room.onLeave((code) => {
      this.emitStatus('disconnected', `Disconnected (code ${code})`);
      this.stopPingHeartbeat();
    });

    this.room.onError((code, message) => {
      console.error('[NetworkClient] Room error:', code, message);
    });
  }

  private recordSnapshot(state: any): void {
    const nowPerf = performance.now();
    const prevSnap = this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
    const dtSnap = prevSnap ? Math.max(0.015, (nowPerf - prevSnap.timeMs) * 0.001) : 0.033;

    const players: Record<string, PlayerState> = {};
    if (state.players) {
      state.players.forEach((p: any, key: string) => {
        if (prevSnap && prevSnap.players[key] && dtSnap < 0.25) {
          const prevP = prevSnap.players[key];
          const vx = Math.max(-25, Math.min(25, (p.x - prevP.x) / dtSnap));
          const vz = Math.max(-25, Math.min(25, (p.z - prevP.z) / dtSnap));
          const oldVel = this.playerVelocities.get(key) || { vx: 0, vz: 0 };
          this.playerVelocities.set(key, {
            vx: oldVel.vx * 0.35 + vx * 0.65,
            vz: oldVel.vz * 0.35 + vz * 0.65,
          });
        }

        players[key] = {
          id: p.id,
          displayName: p.displayName,
          x: p.x,
          y: p.y,
          z: p.z,
          yaw: p.yaw,
          connected: p.connected,
          mode: p.mode,
          vehicleId: p.vehicleId,
          seatIndex: p.seatIndex,
          inputEpoch: p.inputEpoch,
          lastInputSeq: p.lastInputSeq,
        };

        if (p.id === this.localPlayerId) {
          this.localEpoch = p.inputEpoch;
        }
      });
    }

    const vehicles: Record<string, VehicleState> = {};
    if (state.vehicles) {
      state.vehicles.forEach((v: any, key: string) => {
        vehicles[key] = {
          id: v.id,
          x: v.x,
          y: v.y,
          z: v.z,
          yaw: v.yaw,
          speed: v.speed,
          seats: [v.seats?.[0] || '', v.seats?.[1] || ''],
        };
      });
    }

    const participantIds: string[] = [];
    if (state.delivery?.participantIds) {
      state.delivery.participantIds.forEach((id: string) => participantIds.push(id));
    }

    const delivery = {
      id: state.delivery?.id || '',
      phase: state.delivery?.phase || 'available',
      vehicleId: state.delivery?.vehicleId || '',
      participantIds,
      pickupId: state.delivery?.pickupId || '',
      destinationId: state.delivery?.destinationId || '',
      completedAtMs: state.delivery?.completedAtMs || 0,
      restartAtMs: state.delivery?.restartAtMs || 0,
    };

    const raceParticipants: Record<string, any> = {};
    if (state.race?.participants) {
      state.race.participants.forEach((rp: any, pid: string) => {
        raceParticipants[pid] = {
          playerId: rp.playerId,
          displayName: rp.displayName,
          vehicleId: rp.vehicleId,
          currentLap: rp.currentLap,
          bestLapMs: rp.bestLapMs,
          totalTimeMs: rp.totalTimeMs,
          finished: rp.finished,
          rank: rp.rank,
        };
      });
    }

    const race = state.race ? {
      status: state.race.status || 'idle',
      countdownSeconds: state.race.countdownSeconds || 0,
      totalLaps: state.race.totalLaps || 3,
      startedAtMs: state.race.startedAtMs || 0,
      participants: raceParticipants,
    } : undefined;

    this.snapshots.push({
      timeMs: nowPerf,
      players,
      vehicles,
      delivery,
      race,
    });

    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  private smoothedState: StateSnapshot | null = null;
  private lastSmoothTimeMs: number = performance.now();

  /**
   * Deterministic shared physics prediction + time-projected server reconciliation.
   * Eliminates 20Hz/30Hz sawtooth rubber-banding and keeps remote players silky smooth.
   */
  public getInterpolatedState(localInput?: {
    axisX: number;
    axisZ: number;
    throttle: number;
    steer: number;
    brake: boolean;
  }): StateSnapshot | null {
    if (this.snapshots.length === 0) return null;
    const latest = this.snapshots[this.snapshots.length - 1];

    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastSmoothTimeMs) * 0.001));
    this.lastSmoothTimeMs = now;

    // Exact time elapsed since the latest authoritative server packet arrived
    const pktAgeSec = Math.min(0.065, Math.max(0, (now - latest.timeMs) * 0.001));

    if (!this.smoothedState) {
      const initPlayers: Record<string, PlayerState> = {};
      for (const [k, p] of Object.entries(latest.players)) initPlayers[k] = { ...p };
      const initVehicles: Record<string, VehicleState> = {};
      for (const [k, v] of Object.entries(latest.vehicles)) {
        initVehicles[k] = { ...v, seats: [...v.seats] as [string, string] };
      }
      this.smoothedState = {
        timeMs: now,
        players: initPlayers,
        vehicles: initVehicles,
        delivery: latest.delivery,
        race: latest.race,
      };
      return this.smoothedState;
    }

    const remoteBlend = 1 - Math.exp(-20 * dt);
    const localDriftBlend = 1 - Math.exp(-5 * dt);
    const yawBlend = 1 - Math.exp(-18 * dt);

    const lerpAngle = (a: number, b: number, t: number) => {
      let diff = b - a;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      return a + diff * t;
    };

    // 1. Update Vehicles
    const sVehicles = this.smoothedState.vehicles;
    for (const id of Object.keys(sVehicles)) {
      if (!latest.vehicles[id]) delete sVehicles[id];
    }
    for (const [id, nv] of Object.entries(latest.vehicles)) {
      const sv = sVehicles[id];
      if (!sv) {
        sVehicles[id] = { ...nv, seats: [...nv.seats] as [string, string] };
        continue;
      }

      const isLocalDriver = nv.seats[0] === this.localPlayerId;

      if (isLocalDriver && localInput) {
        // Step local vehicle with the exact shared deterministic kinematics at render FPS
        const stepped = stepVehicleKinematics(
          sv,
          localInput.throttle,
          localInput.steer,
          localInput.brake,
          dt,
          CITY_COLLIDERS,
          CITY_BOUNDS
        );
        sv.x = stepped.x;
        sv.y = 0;
        sv.z = stepped.z;
        sv.yaw = stepped.yaw;
        sv.speed = stepped.speed;

        // Project server packet forward by pktAgeSec so we compare like-for-like timestamps
        const authProjected =
          pktAgeSec > 0.002
            ? stepVehicleKinematics(
                nv,
                localInput.throttle,
                localInput.steer,
                localInput.brake,
                pktAgeSec,
                CITY_COLLIDERS,
                CITY_BOUNDS
              )
            : nv;

        const errSq =
          (authProjected.x - sv.x) * (authProjected.x - sv.x) +
          (authProjected.z - sv.z) * (authProjected.z - sv.z);
        if (errSq > 36) {
          sv.x = authProjected.x;
          sv.z = authProjected.z;
          sv.yaw = authProjected.yaw;
          sv.speed = authProjected.speed;
        } else {
          sv.x += (authProjected.x - sv.x) * localDriftBlend;
          sv.z += (authProjected.z - sv.z) * localDriftBlend;
          sv.yaw = lerpAngle(sv.yaw, authProjected.yaw, localDriftBlend);
          sv.speed += (authProjected.speed - sv.speed) * localDriftBlend;
        }
      } else {
        // Remote or unoccupied vehicle: project forward along velocity over pktAgeSec
        const targetX = nv.x + Math.sin(nv.yaw) * nv.speed * pktAgeSec;
        const targetZ = nv.z + Math.cos(nv.yaw) * nv.speed * pktAgeSec;
        const errSq = (targetX - sv.x) * (targetX - sv.x) + (targetZ - sv.z) * (targetZ - sv.z);
        if (errSq > 36) {
          sv.x = targetX;
          sv.z = targetZ;
          sv.yaw = nv.yaw;
        } else {
          sv.x += (targetX - sv.x) * remoteBlend;
          sv.z += (targetZ - sv.z) * remoteBlend;
          sv.yaw = lerpAngle(sv.yaw, nv.yaw, yawBlend);
        }
        sv.y = 0;
        sv.speed += (nv.speed - sv.speed) * remoteBlend;
      }

      sv.seats[0] = nv.seats[0];
      sv.seats[1] = nv.seats[1];
    }

    // 2. Update Players
    const sPlayers = this.smoothedState.players;
    for (const id of Object.keys(sPlayers)) {
      if (!latest.players[id]) delete sPlayers[id];
    }
    for (const [id, np] of Object.entries(latest.players)) {
      const sp = sPlayers[id];
      if (!sp || sp.mode !== np.mode || sp.vehicleId !== np.vehicleId) {
        sPlayers[id] = { ...np };
        continue;
      }

      if (np.mode !== 'walking' && np.vehicleId && sVehicles[np.vehicleId]) {
        // Lock seated players to the exact shared seat transform on the smoothed vehicle
        const veh = sVehicles[np.vehicleId];
        const seatIdx: 0 | 1 = np.seatIndex === 1 ? 1 : 0;
        const t = getSeatWorldTransform(veh.x, veh.y, veh.z, veh.yaw, seatIdx);
        sp.x = t.x;
        sp.y = t.y;
        sp.z = t.z;
        sp.yaw = t.yaw;
      } else if (id === this.localPlayerId && localInput) {
        // Local walking player: run exact shared collision step at render FPS
        let ax = localInput.axisX || 0;
        let az = localInput.axisZ || 0;
        const lenSq = ax * ax + az * az;
        if (lenSq > 1) {
          const invLen = 1 / Math.sqrt(lenSq);
          ax *= invLen;
          az *= invLen;
        }
        if (lenSq > 0.001) {
          const stepRes = resolveCircleCollision(
            sp.x,
            sp.z,
            sp.x + ax * LIMITS.walkingSpeed * dt,
            sp.z + az * LIMITS.walkingSpeed * dt,
            0.45,
            CITY_COLLIDERS,
            CITY_BOUNDS
          );
          sp.x = stepRes.x;
          sp.z = stepRes.z;
          sp.yaw = lerpAngle(sp.yaw, Math.atan2(ax, az), yawBlend);
        }

        // Project server walking position by pktAgeSec so there is zero backward bungee pull
        const authWalk =
          lenSq > 0.001 && pktAgeSec > 0.002
            ? resolveCircleCollision(
                np.x,
                np.z,
                np.x + ax * LIMITS.walkingSpeed * pktAgeSec,
                np.z + az * LIMITS.walkingSpeed * pktAgeSec,
                0.45,
                CITY_COLLIDERS,
                CITY_BOUNDS
              )
            : { x: np.x, z: np.z };

        const errSq = (authWalk.x - sp.x) * (authWalk.x - sp.x) + (authWalk.z - sp.z) * (authWalk.z - sp.z);
        if (errSq > 25) {
          sp.x = authWalk.x;
          sp.z = authWalk.z;
        } else {
          sp.x += (authWalk.x - sp.x) * localDriftBlend;
          sp.z += (authWalk.z - sp.z) * localDriftBlend;
        }
        sp.y = 0;
      } else {
        // Remote walking player: project forward along estimated velocity over pktAgeSec
        const vel = this.playerVelocities.get(id) || { vx: 0, vz: 0 };
        const targetX = np.x + vel.vx * pktAgeSec;
        const targetZ = np.z + vel.vz * pktAgeSec;
        const errSq = (targetX - sp.x) * (targetX - sp.x) + (targetZ - sp.z) * (targetZ - sp.z);
        if (errSq > 25) {
          sp.x = targetX;
          sp.z = targetZ;
        } else {
          sp.x += (targetX - sp.x) * remoteBlend;
          sp.z += (targetZ - sp.z) * remoteBlend;
        }
        sp.y = 0;
        sp.yaw = lerpAngle(sp.yaw, np.yaw, yawBlend);
      }

      sp.displayName = np.displayName;
      sp.connected = np.connected;
      sp.mode = np.mode;
      sp.vehicleId = np.vehicleId;
      sp.seatIndex = np.seatIndex;
    }

    this.smoothedState.timeMs = now;
    this.smoothedState.delivery = latest.delivery;
    this.smoothedState.race = latest.race;

    return this.smoothedState;
  }

  public sendInput(input: {
    axisX: number;
    axisZ: number;
    throttle: number;
    steer: number;
    brake: boolean;
  }): void {
    if (!this.room) return;

    this.inputSeq++;
    const message: InputMessage = {
      epoch: this.localEpoch,
      seq: this.inputSeq,
      axisX: input.axisX,
      axisZ: input.axisZ,
      throttle: input.throttle,
      steer: input.steer,
      brake: input.brake,
    };

    this.room.send('input', message);
  }

  public async enterVehicle(vehicleId: string, seatIndex: 0 | 1): Promise<{ ok: boolean; code?: ActionError }> {
    if (!this.room) return { ok: false, code: 'NOT_FOUND' };

    const requestId = `req_enter_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return new Promise((resolve) => {
      this.actionResolvers.set(requestId, resolve);
      this.room!.send('vehicle:enter', { requestId, vehicleId, seatIndex });

      // Fallback timeout after 3s
      setTimeout(() => {
        if (this.actionResolvers.has(requestId)) {
          this.actionResolvers.delete(requestId);
          resolve({ ok: false, code: 'RATE_LIMITED' });
        }
      }, 3000);
    });
  }

  public async exitVehicle(): Promise<{ ok: boolean; code?: ActionError }> {
    if (!this.room) return { ok: false, code: 'NOT_FOUND' };

    const requestId = `req_exit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return new Promise((resolve) => {
      this.actionResolvers.set(requestId, resolve);
      this.room!.send('vehicle:exit', { requestId });

      setTimeout(() => {
        if (this.actionResolvers.has(requestId)) {
          this.actionResolvers.delete(requestId);
          resolve({ ok: false, code: 'RATE_LIMITED' });
        }
      }, 3000);
    });
  }

  public async sendChat(text: string): Promise<{ ok: boolean; code?: ActionError }> {
    if (!this.room) return { ok: false, code: 'NOT_FOUND' };

    const requestId = `req_chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return new Promise((resolve) => {
      this.actionResolvers.set(requestId, resolve);
      this.room!.send('chat:send', { requestId, text });

      setTimeout(() => {
        if (this.actionResolvers.has(requestId)) {
          this.actionResolvers.delete(requestId);
          resolve({ ok: false, code: 'RATE_LIMITED' });
        }
      }, 3000);
    });
  }

  public async startRace(): Promise<{ ok: boolean; code?: ActionError }> {
    if (!this.room) return { ok: false, code: 'NOT_FOUND' };

    const requestId = `req_race_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return new Promise((resolve) => {
      this.actionResolvers.set(requestId, resolve);
      this.room!.send('race:start', { requestId });

      setTimeout(() => {
        if (this.actionResolvers.has(requestId)) {
          this.actionResolvers.delete(requestId);
          resolve({ ok: false, code: 'RATE_LIMITED' });
        }
      }, 3000);
    });
  }

  private startPingHeartbeat(): void {
    this.stopPingHeartbeat();
    this.pingIntervalId = setInterval(() => {
      if (this.room) {
        this.lastPingSentMs = Date.now();
        this.room.send('ping', { nonce: this.lastPingSentMs });
      }
    }, 2500);
  }

  private stopPingHeartbeat(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  public onChat(cb: ChatCallback): void {
    this.onChatCallbacks.push(cb);
  }

  public onLatency(cb: LatencyCallback): void {
    this.onLatencyCallbacks.push(cb);
  }

  public onStatus(cb: StatusCallback): void {
    this.onStatusCallbacks.push(cb);
  }

  private emitStatus(status: 'connected' | 'reconnecting' | 'disconnected', error?: string): void {
    this.onStatusCallbacks.forEach((cb) => cb(status, error));
  }

  public disconnect(): void {
    this.stopPingHeartbeat();
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
  }
}
