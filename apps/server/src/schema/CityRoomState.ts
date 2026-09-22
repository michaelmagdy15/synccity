import { schema, t, type SchemaType } from '@colyseus/schema';
import { PROTOCOL_VERSION } from '@synccity/shared/protocol';

export const PlayerSchema = schema({
  id: t.string().default(''),
  displayName: t.string().default(''),
  x: t.number().default(0),
  y: t.number().default(0),
  z: t.number().default(0),
  yaw: t.number().default(0),
  connected: t.boolean().default(true),
  mode: t.string().default('walking'),
  vehicleId: t.string().default(''),
  seatIndex: t.number().default(-1),
  inputEpoch: t.number().default(1),
  lastInputSeq: t.number().default(0),
});
export type PlayerSchema = SchemaType<typeof PlayerSchema>;

export const VehicleSchema = schema({
  id: t.string().default(''),
  x: t.number().default(0),
  y: t.number().default(0),
  z: t.number().default(0),
  yaw: t.number().default(0),
  speed: t.number().default(0),
  seats: t.array('string'),
});
export type VehicleSchema = SchemaType<typeof VehicleSchema>;

export const DeliverySchema = schema({
  id: t.string().default('deliv_init'),
  phase: t.string().default('available'),
  vehicleId: t.string().default(''),
  participantIds: t.array('string'),
  pickupId: t.string().default('warehouse'),
  destinationId: t.string().default('cityhall'),
  completedAtMs: t.number().default(0),
  restartAtMs: t.number().default(0),
});
export type DeliverySchema = SchemaType<typeof DeliverySchema>;

export const RaceParticipantSchema = schema({
  playerId: t.string().default(''),
  displayName: t.string().default(''),
  vehicleId: t.string().default(''),
  currentLap: t.number().default(0),
  bestLapMs: t.number().default(0),
  totalTimeMs: t.number().default(0),
  finished: t.boolean().default(false),
  rank: t.number().default(0),
});
export type RaceParticipantSchema = SchemaType<typeof RaceParticipantSchema>;

export const RaceSchema = schema({
  status: t.string().default('idle'), // 'idle' | 'countdown' | 'racing' | 'finished'
  countdownSeconds: t.number().default(0),
  totalLaps: t.number().default(3),
  startedAtMs: t.number().default(0),
  participants: t.map(RaceParticipantSchema),
});
export type RaceSchema = SchemaType<typeof RaceSchema>;

export const CityRoomState = schema({
  protocolVersion: t.number().default(PROTOCOL_VERSION),
  tick: t.number().default(0),
  serverTimeMs: t.number().default(0),
  mapVersion: t.string().default('v1.0'),
  players: t.map(PlayerSchema),
  vehicles: t.map(VehicleSchema),
  delivery: DeliverySchema,
  race: RaceSchema,
});
export type CityRoomState = SchemaType<typeof CityRoomState>;

