import { Room, type Client } from 'colyseus';
import {
  LIMITS,
  PROTOCOL_VERSION,
  type ActionError,
  type ChatMessage,
  type InputMessage,
  type JoinOptions,
} from '@synccity/shared/protocol';
import {
  INITIAL_VEHICLES,
  SPAWN_POINTS,
  findSafeExit,
  getSeatWorldTransform,
} from '@synccity/shared/world';
import { CityRoomState, PlayerSchema, VehicleSchema } from '../schema/CityRoomState.js';
import { CitySimulation } from '../simulation/CitySimulation.js';

interface RateLimiter {
  tokens: number;
  lastRefillMs: number;
}

export class CityRoom extends Room<{ state: CityRoomState }> {
  private simulation!: CitySimulation;
  private chatCounter = 0;
  private chatRateLimiters = new Map<string, RateLimiter>();
  private requestDedupe = new Map<string, { ok: boolean; code?: ActionError; time: number }>();
  private spawnIndex = 0;

  onCreate(_options: any): void {
    this.maxClients = LIMITS.roomPlayers;
    this.patchRate = LIMITS.patchMs;

    this.state = new CityRoomState();
    this.simulation = new CitySimulation(this.state);

    // Initialize 4 parked city vehicles
    INITIAL_VEHICLES.forEach((v) => {
      const veh = new VehicleSchema();
      veh.id = v.id;
      veh.x = v.x;
      veh.y = v.y;
      veh.z = v.z;
      veh.yaw = v.yaw;
      veh.speed = 0;
      veh.seats.push('', '');
      this.state.vehicles.set(v.id, veh);
    });

    // Run authoritative 20 Hz simulation loop (every 50 ms)
    const stepIntervalMs = 1000 / LIMITS.simulationHz;
    this.setTimestep((dt: number) => {
      this.simulation.update(dt / 1000);
      this.cleanDedupeCache();
    }, stepIntervalMs);

    this.setupMessageHandlers();
    console.log(`[CityRoom] Created room ${this.roomId}`);
  }

  private cleanDedupeCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.requestDedupe.entries()) {
      if (now - entry.time > 30000) {
        this.requestDedupe.delete(key);
      }
    }
  }

  private setupMessageHandlers(): void {
    // 1. Player movement / driving input
    this.onMessage('input', (client: Client, message: InputMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.connected) return;

      // Validate packet fields
      if (typeof message.epoch !== 'number' || typeof message.seq !== 'number') return;
      if (message.epoch !== player.inputEpoch) return; // Stale epoch dropped
      if (message.seq <= player.lastInputSeq && message.seq !== 0) return; // Stale sequence dropped

      // Reject NaN or Infinite values
      if (
        !Number.isFinite(message.axisX) ||
        !Number.isFinite(message.axisZ) ||
        !Number.isFinite(message.throttle) ||
        !Number.isFinite(message.steer)
      ) {
        return;
      }

      player.lastInputSeq = message.seq;

      // Passenger cannot inject vehicle steering/throttle
      if (player.mode === 'passenger') {
        message.throttle = 0;
        message.steer = 0;
        message.brake = false;
      }

      this.simulation.setPlayerInput(client.sessionId, message);
    });

    // 2. Vehicle enter request
    this.onMessage(
      'vehicle:enter',
      (client: Client, message: { requestId: string; vehicleId: string; seatIndex: 0 | 1 }) => {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.connected) return;

        const { requestId, vehicleId, seatIndex } = message;
        if (!requestId || typeof requestId !== 'string' || requestId.length > 64) {
          client.send('action:result', { requestId: requestId || '', ok: false, code: 'INVALID_MESSAGE' });
          return;
        }

        const dedupeKey = `${client.sessionId}:${requestId}`;
        if (this.requestDedupe.has(dedupeKey)) {
          const cached = this.requestDedupe.get(dedupeKey)!;
          client.send('action:result', { requestId, ok: cached.ok, code: cached.code });
          return;
        }

        const reply = (ok: boolean, code?: ActionError) => {
          this.requestDedupe.set(dedupeKey, { ok, code, time: Date.now() });
          client.send('action:result', { requestId, ok, code });
        };

        if (player.mode !== 'walking') {
          return reply(false, 'NOT_WALKING');
        }

        const vehicle = this.state.vehicles.get(vehicleId);
        if (!vehicle) {
          return reply(false, 'NOT_FOUND');
        }

        if (seatIndex !== 0 && seatIndex !== 1) {
          return reply(false, 'INVALID_MESSAGE');
        }

        if (Math.abs(vehicle.speed) > LIMITS.enterMaxSpeed) {
          return reply(false, 'MOVING');
        }

        const dx = player.x - vehicle.x;
        const dz = player.z - vehicle.z;
        if (dx * dx + dz * dz > LIMITS.enterDistance * LIMITS.enterDistance) {
          return reply(false, 'TOO_FAR');
        }

        // Atomic seat claim
        const currentOccupant = vehicle.seats[seatIndex];
        if (currentOccupant && currentOccupant !== '') {
          return reply(false, 'SEAT_TAKEN');
        }

        // Claim seat atomically
        vehicle.seats[seatIndex] = player.id;
        player.vehicleId = vehicle.id;
        player.seatIndex = seatIndex;
        player.mode = seatIndex === 0 ? 'driver' : 'passenger';
        player.inputEpoch++;
        player.lastInputSeq = 0;

        // Position player immediately in the seat
        const seatTransform = getSeatWorldTransform(vehicle.x, vehicle.y, vehicle.z, vehicle.yaw, seatIndex);
        player.x = seatTransform.x;
        player.y = seatTransform.y;
        player.z = seatTransform.z;
        player.yaw = seatTransform.yaw;

        this.simulation.clearPlayerInput(player.id);
        reply(true);
      }
    );

    // 3. Vehicle exit request
    this.onMessage('vehicle:exit', (client: Client, message: { requestId: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.connected) return;

      const { requestId } = message;
      if (!requestId || typeof requestId !== 'string' || requestId.length > 64) {
        client.send('action:result', { requestId: requestId || '', ok: false, code: 'INVALID_MESSAGE' });
        return;
      }

      const dedupeKey = `${client.sessionId}:${requestId}`;
      if (this.requestDedupe.has(dedupeKey)) {
        const cached = this.requestDedupe.get(dedupeKey)!;
        client.send('action:result', { requestId, ok: cached.ok, code: cached.code });
        return;
      }

      const reply = (ok: boolean, code?: ActionError) => {
        this.requestDedupe.set(dedupeKey, { ok, code, time: Date.now() });
        client.send('action:result', { requestId, ok, code });
      };

      if (player.mode === 'walking' || !player.vehicleId) {
        return reply(false, 'NOT_SEATED');
      }

      const vehicle = this.state.vehicles.get(player.vehicleId);
      if (!vehicle) {
        return reply(false, 'NOT_FOUND');
      }

      if (Math.abs(vehicle.speed) > LIMITS.exitMaxSpeed) {
        return reply(false, 'MOVING');
      }

      // Safe exit position check
      const safeExit = findSafeExit(vehicle.x, vehicle.z, vehicle.yaw);
      if (!safeExit) {
        return reply(false, 'NO_SAFE_EXIT');
      }

      // Vacate seat
      if (player.seatIndex === 0 || player.seatIndex === 1) {
        vehicle.seats[player.seatIndex] = '';
      }

      player.mode = 'walking';
      player.vehicleId = '';
      player.seatIndex = -1;
      player.x = safeExit.x;
      player.y = safeExit.y;
      player.z = safeExit.z;
      player.yaw = safeExit.yaw;
      player.inputEpoch++;
      player.lastInputSeq = 0;

      this.simulation.clearPlayerInput(player.id);
      reply(true);
    });

    // 4. Chat messages
    this.onMessage('chat:send', (client: Client, message: { requestId: string; text: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.connected) return;

      const { requestId, text } = message;
      if (!requestId || typeof requestId !== 'string' || typeof text !== 'string') {
        client.send('action:result', { requestId: requestId || '', ok: false, code: 'INVALID_MESSAGE' });
        return;
      }

      // Check token-bucket rate limiter: 1 token/sec, max 3 tokens
      const now = Date.now();
      let limiter = this.chatRateLimiters.get(client.sessionId);
      if (!limiter) {
        limiter = { tokens: 3, lastRefillMs: now };
        this.chatRateLimiters.set(client.sessionId, limiter);
      } else {
        const elapsedSec = (now - limiter.lastRefillMs) / 1000;
        limiter.tokens = Math.min(3, limiter.tokens + elapsedSec);
        limiter.lastRefillMs = now;
      }

      if (limiter.tokens < 1) {
        client.send('action:result', { requestId, ok: false, code: 'RATE_LIMITED' });
        return;
      }
      limiter.tokens -= 1;

      // Validate and sanitize text
      const trimmed = text.trim();
      if (trimmed.length < 1 || trimmed.length > LIMITS.chatCharacters) {
        client.send('action:result', { requestId, ok: false, code: 'INVALID_MESSAGE' });
        return;
      }

      // Sanitize forbidden control characters
      const sanitized = trimmed.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
      if (sanitized.length === 0) {
        client.send('action:result', { requestId, ok: false, code: 'INVALID_MESSAGE' });
        return;
      }

      const chatMsg: ChatMessage = {
        id: `chat_${++this.chatCounter}`,
        senderId: player.id,
        displayName: player.displayName,
        text: sanitized,
        serverTimeMs: now,
      };

      this.broadcast('chat:message', chatMsg);
      client.send('action:result', { requestId, ok: true });
    });

    // 5. Race start trigger
    this.onMessage('race:start', (client: Client, message: { requestId: string }) => {
      const { requestId } = message || {};
      const started = this.simulation.startRace();
      client.send('action:result', { requestId: requestId || '', ok: started });
    });

    // 6. Ping / Pong latency check
    this.onMessage('ping', (client: Client, message: { nonce: number }) => {
      client.send('pong', {
        nonce: message?.nonce ?? 0,
        serverTimeMs: Date.now(),
      });
    });
  }

  onAuth(_client: Client, options: JoinOptions): any {
    if (!options || options.protocolVersion !== PROTOCOL_VERSION) {
      throw new Error(`Protocol version mismatch: expected ${PROTOCOL_VERSION}`);
    }

    let displayName = (options.displayName || '').trim();
    displayName = displayName.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    if (displayName.length === 0) {
      displayName = 'Player';
    } else if (displayName.length > LIMITS.nameCharacters) {
      displayName = displayName.slice(0, LIMITS.nameCharacters);
    }

    return { displayName };
  }

  onJoin(client: Client, _options: JoinOptions, auth: any): void {
    const spawn = SPAWN_POINTS[this.spawnIndex % SPAWN_POINTS.length];
    this.spawnIndex++;

    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.displayName = auth?.displayName || `Player_${client.sessionId.slice(0, 4)}`;
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    player.yaw = spawn.yaw;
    player.connected = true;
    player.mode = 'walking';
    player.vehicleId = '';
    player.seatIndex = -1;
    player.inputEpoch = 1;
    player.lastInputSeq = 0;

    this.state.players.set(client.sessionId, player);

    client.send('welcome', {
      playerId: client.sessionId,
      protocolVersion: PROTOCOL_VERSION,
      inputEpoch: player.inputEpoch,
      roomId: this.roomId,
    });

    console.log(`[CityRoom] Player "${player.displayName}" (${client.sessionId}) joined room ${this.roomId}`);
  }

  async onDrop(client: Client, _code?: number): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    player.connected = false;
    this.simulation.clearPlayerInput(client.sessionId);

    console.log(`[CityRoom] Player ${client.sessionId} dropped. Reserving seat for ${LIMITS.reconnectSeconds}s...`);

    try {
      await this.allowReconnection(client, LIMITS.reconnectSeconds);
    } catch {
      console.log(`[CityRoom] Reconnection expired for ${client.sessionId}. Cleaning up...`);
      this.cleanupPlayer(client.sessionId);
    }
  }

  onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    player.connected = true;
    player.inputEpoch++;
    player.lastInputSeq = 0;

    client.send('welcome', {
      playerId: client.sessionId,
      protocolVersion: PROTOCOL_VERSION,
      inputEpoch: player.inputEpoch,
      roomId: this.roomId,
    });

    console.log(`[CityRoom] Player ${client.sessionId} successfully reconnected.`);
  }

  onLeave(client: Client, code?: number): void {
    console.log(`[CityRoom] Player ${client.sessionId} left (code: ${code}).`);
    this.cleanupPlayer(client.sessionId);
  }

  private cleanupPlayer(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    if (player) {
      if (player.vehicleId) {
        const vehicle = this.state.vehicles.get(player.vehicleId);
        if (vehicle) {
          if (vehicle.seats[0] === sessionId) vehicle.seats[0] = '';
          if (vehicle.seats[1] === sessionId) vehicle.seats[1] = '';
        }
      }
      this.state.players.delete(sessionId);
    }

    this.simulation.clearPlayerInput(sessionId);
    this.chatRateLimiters.delete(sessionId);
  }

  onDispose(): void {
    console.log(`[CityRoom] Disposed room ${this.roomId}`);
  }
}
