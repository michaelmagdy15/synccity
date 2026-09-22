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
    const players: Record<string, PlayerState> = {};
    if (state.players) {
      state.players.forEach((p: any, key: string) => {
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
      timeMs: Date.now(),
      players,
      vehicles,
      delivery,
      race,
    });

    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  /**
   * Interpolate world state ~100 ms behind server time
   */
  public getInterpolatedState(): StateSnapshot | null {
    if (this.snapshots.length === 0) return null;
    if (this.snapshots.length === 1) return this.snapshots[0];

    const interpolationDelayMs = 100;
    const targetTime = Date.now() - interpolationDelayMs;

    // Find two snapshots surrounding targetTime
    let older: StateSnapshot | null = null;
    let newer: StateSnapshot | null = null;

    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i].timeMs <= targetTime) {
        older = this.snapshots[i];
        newer = this.snapshots[i + 1] || older;
        break;
      }
    }

    if (!older || !newer || older === newer) {
      return this.snapshots[this.snapshots.length - 1];
    }

    const range = newer.timeMs - older.timeMs;
    const alpha = range <= 0 ? 1 : Math.max(0, Math.min(1, (targetTime - older.timeMs) / range));

    // Interpolate positions and slerp yaw
    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    const lerpYaw = (a: number, b: number) => {
      let diff = b - a;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      return a + diff * alpha;
    };

    const players: Record<string, PlayerState> = {};
    for (const [id, np] of Object.entries(newer.players)) {
      const op = older.players[id];
      if (op && op.mode === np.mode && op.vehicleId === np.vehicleId) {
        players[id] = {
          ...np,
          x: lerp(op.x, np.x),
          y: lerp(op.y, np.y),
          z: lerp(op.z, np.z),
          yaw: lerpYaw(op.yaw, np.yaw),
        };
      } else {
        players[id] = { ...np };
      }
    }

    const vehicles: Record<string, VehicleState> = {};
    for (const [id, nv] of Object.entries(newer.vehicles)) {
      const ov = older.vehicles[id];
      if (ov) {
        vehicles[id] = {
          ...nv,
          x: lerp(ov.x, nv.x),
          y: lerp(ov.y, nv.y),
          z: lerp(ov.z, nv.z),
          yaw: lerpYaw(ov.yaw, nv.yaw),
          speed: lerp(ov.speed, nv.speed),
        };
      } else {
        vehicles[id] = { ...nv };
      }
    }

    return {
      timeMs: targetTime,
      players,
      vehicles,
      delivery: newer.delivery,
      race: newer.race || older.race,
    };
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
