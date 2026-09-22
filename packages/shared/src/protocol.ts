/** Contract v1. Wire types require runtime validation on the server. */
export const PROTOCOL_VERSION = 1 as const;
export const ROOM_NAME = 'city' as const;
export const LIMITS = {
  roomPlayers: 8, simulationHz: 20, patchMs: 50, inputHz: 20,
  staleInputMs: 250, reconnectSeconds: 20, chatCharacters: 240,
  nameCharacters: 20, enterDistance: 3, enterMaxSpeed: 1,
  exitMaxSpeed: 1, walkingSpeed: 5, forwardSpeed: 18, reverseSpeed: 6,
} as const;

export interface JoinOptions {
  protocolVersion: typeof PROTOCOL_VERSION;
  displayName: string;
  inviteCode?: string;
}

export interface InputMessage {
  epoch: number;
  seq: number;
  /** Walking uses world X/Z axes. Normalize the vector server-side. */
  axisX: number;
  axisZ: number;
  /** Car controls: -1..1; ignored unless player owns the driver seat. */
  throttle: number;
  steer: number;
  brake: boolean;
}

export interface ClientMessages {
  input: InputMessage;
  'vehicle:enter': { requestId: string; vehicleId: string; seatIndex: 0 | 1 };
  'vehicle:exit': { requestId: string };
  'chat:send': { requestId: string; text: string };
  'race:start': { requestId: string };
  ping: { nonce: number };
}

export type PlayerMode = 'walking' | 'driver' | 'passenger';
export interface Transform { x: number; y: number; z: number; yaw: number }
export interface PlayerState extends Transform {
  id: string;
  displayName: string;
  connected: boolean;
  mode: PlayerMode;
  /** Empty string and -1 while walking. */
  vehicleId: string;
  seatIndex: -1 | 0 | 1;
  inputEpoch: number;
  lastInputSeq: number;
}
export interface VehicleState extends Transform {
  id: string;
  speed: number;
  /** Empty string means unoccupied. Indices 0=driver, 1=passenger. */
  seats: [string, string];
}
/** One optional room delivery, triggered only by server-observed occupancy/position. */
export interface DeliveryState {
  id: string;
  phase: 'available' | 'active' | 'complete';
  vehicleId: string;
  participantIds: string[];
  pickupId: string;
  destinationId: string;
  completedAtMs: number;
  restartAtMs: number;
}
export interface RaceParticipant {
  playerId: string;
  displayName: string;
  vehicleId: string;
  currentLap: number;
  bestLapMs: number;
  totalTimeMs: number;
  finished: boolean;
  rank: number;
}
export interface RaceState {
  status: 'idle' | 'countdown' | 'racing' | 'finished';
  countdownSeconds: number;
  totalLaps: number;
  startedAtMs: number;
  participants: Record<string, RaceParticipant>;
}
/** Plain DTO view. Colyseus schema maps/arrays are implemented by server owner. */
export interface CityState {
  protocolVersion: typeof PROTOCOL_VERSION;
  tick: number;
  serverTimeMs: number;
  mapVersion: string;
  players: Record<string, PlayerState>;
  vehicles: Record<string, VehicleState>;
  delivery: DeliveryState;
  race: RaceState;
}
export type ActionError =
  | 'INVALID_MESSAGE' | 'RATE_LIMITED' | 'NOT_FOUND' | 'NOT_WALKING'
  | 'TOO_FAR' | 'SEAT_TAKEN' | 'MOVING' | 'NO_SAFE_EXIT' | 'NOT_SEATED';
export interface ChatMessage {
  id: string;
  senderId: string;
  displayName: string;
  text: string;
  serverTimeMs: number;
}
export interface ServerMessages {
  welcome: {
    playerId: string;
    protocolVersion: typeof PROTOCOL_VERSION;
    inputEpoch: number;
    roomId: string;
  };
  'action:result': { requestId: string; ok: boolean; code?: ActionError };
  'chat:message': ChatMessage;
  pong: { nonce: number; serverTimeMs: number };
}
