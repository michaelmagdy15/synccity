import { LIMITS } from './protocol.js';

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface BoxCollider {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  color?: string;
  label?: string;
}

export interface CheckpointDef {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  color: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export const CITY_BOUNDS: Bounds = {
  minX: -200,
  maxX: 200,
  minZ: -200,
  maxZ: 200,
};

export const SEAT_OFFSETS = [
  { x: 0.65, y: 0.35, z: -0.1 },  // 0: Driver (left: +X)
  { x: -0.65, y: 0.35, z: -0.1 }, // 1: Passenger (right: -X)
] as const;

export const SPAWN_POINTS: SpawnPoint[] = [
  { x: 0, y: 0, z: 14, yaw: 0 },
  { x: -7, y: 0, z: 12, yaw: 0.2 },
  { x: 7, y: 0, z: 12, yaw: -0.2 },
  { x: -12, y: 0, z: 0, yaw: Math.PI / 2 },
  { x: 12, y: 0, z: 0, yaw: -Math.PI / 2 },
  { x: 0, y: 0, z: -14, yaw: Math.PI },
  { x: -7, y: 0, z: -12, yaw: Math.PI - 0.2 },
  { x: 7, y: 0, z: -12, yaw: Math.PI + 0.2 },
];

export const INITIAL_VEHICLES = [
  // Grid slots right near Start Line
  { id: 'veh_1', x: 12, y: 0, z: 24, yaw: 0, speed: 0 },
  { id: 'veh_2', x: -12, y: 0, z: 24, yaw: 0, speed: 0 },
  // North plaza curbs
  { id: 'veh_3', x: 12, y: 0, z: -24, yaw: Math.PI, speed: 0 },
  { id: 'veh_4', x: -12, y: 0, z: -24, yaw: Math.PI, speed: 0 },
  // District depots
  { id: 'veh_5', x: 80, y: 0, z: -100, yaw: -Math.PI / 2, speed: 0 },
  { id: 'veh_6', x: -80, y: 0, z: 100, yaw: Math.PI / 2, speed: 0 },
];

export const CHECKPOINTS = {
  pickup: {
    id: 'warehouse',
    label: 'Waterfront Warehouse Bay',
    x: 80,
    y: 0,
    z: -100,
    radius: 8.0,
    color: 0x73e6f5, // Cyan
  },
  destination: {
    id: 'cityhall',
    label: 'City Hall Drop-off',
    x: -80,
    y: 0,
    z: 100,
    radius: 8.0,
    color: 0xf26cda, // Magenta
  },
} as const satisfies Record<string, CheckpointDef>;

export interface RaceCheckpointDef {
  index: number;
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  yaw: number;
}

export const RACE_CIRCUIT: RaceCheckpointDef[] = [
  { index: 0, id: 'gate_start', name: 'Start / Finish Line', x: 0, z: 25, radius: 12, yaw: 0 },
  { index: 1, id: 'gate_south', name: 'South Avenue Turn', x: 0, z: 100, radius: 12, yaw: 0 },
  { index: 2, id: 'gate_civic', name: 'Civic Boulevard', x: -100, z: 100, radius: 12, yaw: -Math.PI / 2 },
  { index: 3, id: 'gate_arcade', name: 'Arcade Corner', x: -100, z: -100, radius: 12, yaw: Math.PI },
  { index: 4, id: 'gate_skyline', name: 'Skyline Overpass', x: 0, z: -100, radius: 12, yaw: Math.PI / 2 },
  { index: 5, id: 'gate_docks', name: 'Waterfront Chicane', x: 100, z: -100, radius: 12, yaw: Math.PI / 2 },
  { index: 6, id: 'gate_sprint', name: 'Harbor Sprint', x: 100, z: 25, radius: 12, yaw: 0 },
];

export interface RoadSegment {
  id: string;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  width: number;
  lanes: number;
}

export const CITY_ROADS: RoadSegment[] = [
  // Grand Boulevard (North-South Main Highway)
  { id: 'grand_blvd', startX: 0, startZ: -190, endX: 0, endZ: 190, width: 16, lanes: 4 },
  // Grand Avenue (East-West Center Highway)
  { id: 'grand_ave', startX: -190, startZ: 0, endX: 190, endZ: 0, width: 16, lanes: 4 },
  // North Boulevard
  { id: 'north_blvd', startX: -190, startZ: -100, endX: 190, endZ: -100, width: 14, lanes: 2 },
  // South Boulevard
  { id: 'south_blvd', startX: -190, startZ: 100, endX: 190, endZ: 100, width: 14, lanes: 2 },
  // West Avenue
  { id: 'west_ave', startX: -100, startZ: -190, endX: -100, endZ: 190, width: 14, lanes: 2 },
  // East Avenue
  { id: 'east_ave', startX: 100, startZ: -190, endX: 100, endZ: 190, width: 14, lanes: 2 },
  // Perimeter Ring Roads
  { id: 'ring_north', startX: -185, startZ: -180, endX: 185, endZ: -180, width: 12, lanes: 2 },
  { id: 'ring_south', startX: -185, startZ: 180, endX: 185, endZ: 180, width: 12, lanes: 2 },
  { id: 'ring_west', startX: -180, startZ: -185, endX: -180, endZ: 185, width: 12, lanes: 2 },
  { id: 'ring_east', startX: 180, startZ: -185, endX: 180, endZ: 185, width: 12, lanes: 2 },
];

export const CITY_COLLIDERS: BoxCollider[] = [
  // Central Plaza Roundabout Fountain
  { id: 'plaza_center', minX: -5, maxX: 5, minZ: -5, maxZ: 5, height: 3, label: 'Plaza Monument' },

  // Northwest District (Downtown Financial District)
  { id: 'bldg_nw_tower1', minX: -76, maxX: -46, minZ: -76, maxZ: -46, height: 48, label: 'Vertex Tower' },
  { id: 'bldg_nw_corp', minX: -40, maxX: -20, minZ: -76, maxZ: -50, height: 32, label: 'Omni Corp HQ' },
  { id: 'bldg_nw_bank', minX: -76, maxX: -46, minZ: -40, maxZ: -20, height: 28, label: 'Cyber Bank' },
  { id: 'bldg_nw_spire', minX: -40, maxX: -20, minZ: -40, maxZ: -20, height: 56, label: 'Prism Spire' },
  { id: 'bldg_nw_west1', minX: -165, maxX: -125, minZ: -76, maxZ: -24, height: 24, label: 'West Financial' },
  { id: 'bldg_nw_north1', minX: -76, maxX: -24, minZ: -165, maxZ: -125, height: 36, label: 'Matrix Center' },
  { id: 'bldg_nw_corner', minX: -165, maxX: -125, minZ: -165, maxZ: -125, height: 44, label: 'Apex Pinnacle' },

  // Northeast District (Waterfront Logistics & Docks)
  { id: 'bldg_ne_tech', minX: 22, maxX: 50, minZ: -76, maxZ: -46, height: 22, label: 'Data Hub' },
  { id: 'bldg_ne_cargo', minX: 56, maxX: 76, minZ: -76, maxZ: -24, height: 14, label: 'Cargo Terminal 1' },
  { id: 'bldg_ne_lab', minX: 22, maxX: 50, minZ: -40, maxZ: -20, height: 18, label: 'Quantum Labs' },
  { id: 'bldg_ne_wh2', minX: 124, maxX: 165, minZ: -76, maxZ: -24, height: 12, label: 'East Shipping Yard' },
  { id: 'bldg_ne_warehouse', minX: 24, maxX: 76, minZ: -165, maxZ: -125, height: 16, label: 'Waterfront Warehouse' },
  { id: 'bldg_ne_pier_complex', minX: 124, maxX: 166, minZ: -165, maxZ: -125, height: 15, label: 'Oceanic Freight Dock' },

  // Southwest District (Commercial & Cyber Arcade)
  { id: 'bldg_sw_arcade', minX: -76, maxX: -46, minZ: 22, maxZ: 50, height: 20, label: 'Neon Arcade' },
  { id: 'bldg_sw_mall', minX: -40, maxX: -20, minZ: 22, maxZ: 76, height: 16, label: 'Cyber Mall' },
  { id: 'bldg_sw_cinema', minX: -76, maxX: -46, minZ: 56, maxZ: 76, height: 18, label: 'Holo Cinema' },
  { id: 'bldg_sw_hotel', minX: -165, maxX: -124, minZ: 24, maxZ: 76, height: 30, label: 'Vapor Palace Hotel' },
  { id: 'bldg_sw_condos', minX: -76, maxX: -24, minZ: 124, maxZ: 165, height: 26, label: 'Sunset Terraces' },
  { id: 'bldg_sw_club', minX: -165, maxX: -124, minZ: 124, maxZ: 165, height: 22, label: 'Outrun Nightclub' },

  // Southeast District (Civic Center & City Hall)
  { id: 'bldg_se_cityhall', minX: 24, maxX: 74, minZ: 24, maxZ: 74, height: 34, label: 'City Hall Palace' },
  { id: 'bldg_se_courts', minX: 124, maxX: 165, minZ: 24, maxZ: 76, height: 25, label: 'Justice Complex' },
  { id: 'bldg_se_library', minX: 24, maxX: 76, minZ: 124, maxZ: 165, height: 20, label: 'Grand Metro Archive' },
  { id: 'bldg_se_expo', minX: 124, maxX: 165, minZ: 124, maxZ: 165, height: 28, label: 'Cosmo Expo Center' },
];

/** Check if circle at (cx, cz) with radius r intersects an AABB box */
export function circleIntersectsBox(cx: number, cz: number, r: number, b: BoxCollider): boolean {
  const closestX = Math.max(b.minX, Math.min(cx, b.maxX));
  const closestZ = Math.max(b.minZ, Math.min(cz, b.maxZ));
  const dx = cx - closestX;
  const dz = cz - closestZ;
  return dx * dx + dz * dz < r * r;
}

/** Check if point is inside world bounds with margin */
export function isWithinBounds(x: number, z: number, r: number, bounds: Bounds = CITY_BOUNDS): boolean {
  return x - r >= bounds.minX && x + r <= bounds.maxX && z - r >= bounds.minZ && z + r <= bounds.maxZ;
}

/** Check if circle at (x, z) collides with any building */
export function collidesWithBuildings(x: number, z: number, r: number, colliders: BoxCollider[] = CITY_COLLIDERS): boolean {
  for (let i = 0; i < colliders.length; i++) {
    if (circleIntersectsBox(x, z, r, colliders[i])) {
      return true;
    }
  }
  return false;
}

/** Slide circle collision against AABB boxes and world bounds */
export function resolveCircleCollision(
  currX: number,
  currZ: number,
  targetX: number,
  targetZ: number,
  radius: number,
  colliders: BoxCollider[] = CITY_COLLIDERS,
  bounds: Bounds = CITY_BOUNDS
): { x: number; z: number } {
  // Test X movement first
  let newX = targetX;
  newX = Math.max(bounds.minX + radius, Math.min(newX, bounds.maxX - radius));
  if (collidesWithBuildings(newX, currZ, radius, colliders)) {
    newX = currX; // Stop X movement if blocked
  }

  // Test Z movement
  let newZ = targetZ;
  newZ = Math.max(bounds.minZ + radius, Math.min(newZ, bounds.maxZ - radius));
  if (collidesWithBuildings(newX, newZ, radius, colliders)) {
    newZ = currZ; // Stop Z movement if blocked
  }

  return { x: newX, z: newZ };
}

/**
 * Searches predefined offsets around car for a safe, non-colliding exit position.
 * Offsets: Left, Right, Rear, Front.
 */
export function findSafeExit(
  carX: number,
  carZ: number,
  carYaw: number,
  colliders: BoxCollider[] = CITY_COLLIDERS,
  bounds: Bounds = CITY_BOUNDS
): { x: number; y: number; z: number; yaw: number } | null {
  const avatarRadius = 0.5;
  // Local offsets: [localX, localZ]
  const testOffsets = [
    [-1.8, 0],   // Driver side (left)
    [1.8, 0],    // Passenger side (right)
    [0, -2.4],   // Rear
    [0, 2.4],    // Front
  ];

  const sinY = Math.sin(carYaw);
  const cosY = Math.cos(carYaw);

  for (const [lx, lz] of testOffsets) {
    // Rotate offset by car yaw:
    // Yaw 0 faces +Z, yaw PI/2 faces +X
    // x' = lx * cosY + lz * sinY
    // z' = -lx * sinY + lz * cosY
    const worldX = carX + (lx * cosY + lz * sinY);
    const worldZ = carZ + (-lx * sinY + lz * cosY);

    if (isWithinBounds(worldX, worldZ, avatarRadius, bounds) && !collidesWithBuildings(worldX, worldZ, avatarRadius, colliders)) {
      return { x: worldX, y: 0, z: worldZ, yaw: carYaw };
    }
  }

  return null;
}

/**
 * Calculate passenger world transform from car transform and seat index
 */
export function getSeatWorldTransform(
  carX: number,
  carY: number,
  carZ: number,
  carYaw: number,
  seatIndex: 0 | 1
): { x: number; y: number; z: number; yaw: number } {
  const offset = SEAT_OFFSETS[seatIndex];
  const sinY = Math.sin(carYaw);
  const cosY = Math.cos(carYaw);

  const worldX = carX + (offset.x * cosY + offset.z * sinY);
  const worldY = carY + offset.y;
  const worldZ = carZ + (-offset.x * sinY + offset.z * cosY);

  return { x: worldX, y: worldY, z: worldZ, yaw: carYaw };
}

/**
 * Arcade kinematic vehicle simulation step.
 * Pure function: deterministic and shared between server and client prediction.
 */
export function stepVehicleKinematics(
  state: { x: number; y: number; z: number; yaw: number; speed: number },
  throttle: number,
  steer: number,
  brake: boolean,
  dt: number,
  colliders: BoxCollider[] = CITY_COLLIDERS,
  bounds: Bounds = CITY_BOUNDS
): { x: number; y: number; z: number; yaw: number; speed: number } {
  // Clamp delta time to avoid large jumps
  const clampedDt = Math.max(0.001, Math.min(dt, 0.1));
  const carRadius = 1.3;

  let speed = state.speed;
  let yaw = state.yaw;

  // 1. Acceleration / Braking
  const accelRate = 12.0;    // m/s^2 forward
  const reverseRate = 7.0;   // m/s^2 reverse
  const brakeRate = 22.0;    // m/s^2 brake
  const frictionRate = 4.0;  // m/s^2 rolling friction

  if (brake) {
    if (speed > 0) {
      speed = Math.max(0, speed - brakeRate * clampedDt);
    } else if (speed < 0) {
      speed = Math.min(0, speed + brakeRate * clampedDt);
    }
  } else if (throttle > 0.05) {
    if (speed < 0) {
      speed += (brakeRate + accelRate) * clampedDt * throttle;
    } else {
      speed = Math.min(LIMITS.forwardSpeed, speed + accelRate * clampedDt * throttle);
    }
  } else if (throttle < -0.05) {
    if (speed > 0) {
      speed -= (brakeRate + reverseRate) * clampedDt * Math.abs(throttle);
    } else {
      speed = Math.max(-LIMITS.reverseSpeed, speed - reverseRate * clampedDt * Math.abs(throttle));
    }
  } else {
    // Rolling friction
    if (speed > 0) {
      speed = Math.max(0, speed - frictionRate * clampedDt);
    } else if (speed < 0) {
      speed = Math.min(0, speed + frictionRate * clampedDt);
    }
  }

  // 2. Steering (yaw rate proportional to direction and speed)
  if (Math.abs(speed) > 0.1 && Math.abs(steer) > 0.02) {
    const speedFactor = Math.min(1.0, Math.abs(speed) / 6.0);
    const steerDir = speed >= 0 ? 1 : -1;
    const maxTurnRate = 2.0; // rad/s
    // Screen right is -X, screen left is +X when facing +Z
    yaw -= steer * maxTurnRate * speedFactor * steerDir * clampedDt;

    // Normalize yaw to [-PI, PI]
    while (yaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw < -Math.PI) yaw += Math.PI * 2;
  }

  // 3. Position displacement
  // Yaw 0 faces +Z, Yaw PI/2 faces +X
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  const vx = sinY * speed;
  const vz = cosY * speed;

  const targetX = state.x + vx * clampedDt;
  const targetZ = state.z + vz * clampedDt;

  const resolved = resolveCircleCollision(state.x, state.z, targetX, targetZ, carRadius, colliders, bounds);

  // If vehicle hit an obstacle and was blocked, kill speed
  if (Math.abs(resolved.x - targetX) > 0.01 || Math.abs(resolved.z - targetZ) > 0.01) {
    speed *= 0.4;
  }

  return {
    x: resolved.x,
    y: 0,
    z: resolved.z,
    yaw,
    speed,
  };
}
