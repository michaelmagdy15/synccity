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
  // Grid slots right near Start Line (Open-Wheel Formula & Synthwave GT Cars)
  { id: 'veh_1', x: 12, y: 0, z: 24, yaw: 0, speed: 0 },
  { id: 'veh_2', x: -12, y: 0, z: 24, yaw: 0, speed: 0 },
  // North plaza curbs
  { id: 'veh_3', x: 12, y: 0, z: -24, yaw: Math.PI, speed: 0 },
  { id: 'veh_4', x: -12, y: 0, z: -24, yaw: Math.PI, speed: 0 },
  // District depots
  { id: 'veh_5', x: 80, y: 0, z: -100, yaw: -Math.PI / 2, speed: 0 },
  { id: 'veh_6', x: -80, y: 0, z: 100, yaw: Math.PI / 2, speed: 0 },
  // Flyable Twin-Seat Stunt Planes (Parked on East/West Grand Avenue Runway)
  { id: 'veh_plane_1', x: 22, y: 0, z: 0, yaw: Math.PI / 2, speed: 0 },
  { id: 'veh_plane_2', x: -22, y: 0, z: 0, yaw: -Math.PI / 2, speed: 0 },
];

export function isPlaneVehicle(vehicleId: string): boolean {
  return vehicleId.includes('plane');
}

export interface SkyRingDef {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  radius: number;
}

export const SKY_RINGS: SkyRingDef[] = [
  { id: 'sky_north', x: 0, y: 20, z: -85, yaw: 0, radius: 7.5 },
  { id: 'sky_east', x: 95, y: 24, z: 0, yaw: Math.PI / 2, radius: 7.5 },
  { id: 'sky_south', x: 0, y: 20, z: 85, yaw: 0, radius: 7.5 },
  { id: 'sky_west', x: -95, y: 24, z: 0, yaw: Math.PI / 2, radius: 7.5 },
  { id: 'sky_plaza_high', x: 0, y: 28, z: 0, yaw: Math.PI / 4, radius: 8.5 },
  { id: 'sky_docks_arch', x: 85, y: 18, z: -85, yaw: -Math.PI / 4, radius: 7.5 },
];

export interface MysteryBoxDef {
  id: string;
  x: number;
  y: number;
  z: number;
}

export const MYSTERY_BOX_SPOTS: MysteryBoxDef[] = [
  { id: 'box_start_L', x: -5, y: 1.2, z: 45 },
  { id: 'box_start_R', x: 5, y: 1.2, z: 45 },
  { id: 'box_south_1', x: -30, y: 1.2, z: 100 },
  { id: 'box_west_1', x: -100, y: 1.2, z: 0 },
  { id: 'box_north_1', x: 0, y: 1.2, z: -100 },
  { id: 'box_east_1', x: 100, y: 1.2, z: -60 },
  { id: 'box_plaza_N', x: 0, y: 1.2, z: -18 },
  { id: 'box_plaza_S', x: 0, y: 1.2, z: 18 },
  { id: 'box_sky_1', x: 0, y: 20, z: -45 },
  { id: 'box_sky_2', x: 0, y: 20, z: 45 },
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

export interface SpeedBoostPadDef {
  id: string;
  x: number;
  z: number;
  yaw: number;
  radius: number;
}

export const SPEED_BOOST_PADS: SpeedBoostPadDef[] = [
  { id: 'boost_start_straight', x: 0, z: 62, yaw: 0, radius: 4.5 },
  { id: 'boost_south_straight', x: -50, z: 100, yaw: -Math.PI / 2, radius: 4.5 },
  { id: 'boost_west_south', x: -100, z: 45, yaw: Math.PI, radius: 4.5 },
  { id: 'boost_west_north', x: -100, z: -45, yaw: Math.PI, radius: 4.5 },
  { id: 'boost_north_west', x: -50, z: -100, yaw: Math.PI / 2, radius: 4.5 },
  { id: 'boost_north_east', x: 50, z: -100, yaw: Math.PI / 2, radius: 4.5 },
  { id: 'boost_east_straight', x: 100, z: -38, yaw: 0, radius: 4.5 },
  { id: 'boost_harbor_cut', x: 50, z: 0, yaw: -Math.PI / 2, radius: 4.5 },
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
  bounds: Bounds = CITY_BOUNDS,
  isPlane: boolean = false
): { x: number; y: number; z: number; yaw: number; speed: number } {
  // Clamp delta time to avoid large jumps
  const clampedDt = Math.max(0.001, Math.min(Number.isFinite(dt) ? dt : 0.016, 0.1));
  const safeThrottle = Number.isFinite(throttle) ? Math.max(-1, Math.min(1, throttle)) : 0;
  const safeSteer = Number.isFinite(steer) ? Math.max(-1, Math.min(1, steer)) : 0;
  const carRadius = isPlane ? 1.5 : 1.3;

  let speed = Number.isFinite(state.speed) ? state.speed : 0;
  let yaw = Number.isFinite(state.yaw) ? state.yaw : 0;
  let nextY = Number.isFinite(state.y) ? Math.max(0, state.y) : 0;

  // 1. Acceleration / Braking (Planes have higher top airspeed: 28 m/s = 101 km/h)
  const maxForwardSpeed = isPlane ? 28.0 : LIMITS.forwardSpeed;
  const accelRate = isPlane ? 16.5 : 13.5;
  const reverseRate = 7.5;
  const brakeRate = isPlane && nextY > 0.5 ? 14.0 : 24.0;
  const frictionRate = isPlane && nextY > 0.5 ? 2.0 : 4.0;

  if (brake) {
    if (speed > 0) {
      speed = Math.max(isPlane && nextY > 1.5 ? 8.0 : 0, speed - brakeRate * clampedDt);
    } else if (speed < 0) {
      speed = Math.min(0, speed + brakeRate * clampedDt);
    }
  } else if (safeThrottle > 0.05) {
    if (speed < 0) {
      speed += (brakeRate + accelRate) * clampedDt * safeThrottle;
    } else if (speed > maxForwardSpeed) {
      // Smoothly decay turbo overspeed back toward normal max speed
      speed = Math.max(maxForwardSpeed, speed - 5.5 * clampedDt);
    } else {
      speed = Math.min(maxForwardSpeed, speed + accelRate * clampedDt * safeThrottle);
    }
  } else if (safeThrottle < -0.05) {
    if (isPlane && nextY > 0.5) {
      // In mid-air, reverse throttle slows airspeed gently & descends
      speed = Math.max(8.0, speed - 10.0 * clampedDt * Math.abs(safeThrottle));
    } else if (speed > 0) {
      speed -= (brakeRate + reverseRate) * clampedDt * Math.abs(safeThrottle);
    } else {
      speed = Math.max(-LIMITS.reverseSpeed, speed - reverseRate * clampedDt * Math.abs(safeThrottle));
    }
  } else {
    // Rolling / air drag friction
    if (speed > 0) {
      const minAirSpeed = isPlane && nextY > 1.5 ? 10.0 : 0;
      speed = Math.max(minAirSpeed, speed - frictionRate * clampedDt);
    } else if (speed < 0) {
      speed = Math.min(0, speed + frictionRate * clampedDt);
    }
  }

  // 1b. Plane 3D Altitude (Takeoff, Climb, Cruise, and Landing)
  if (isPlane) {
    if (!brake && safeThrottle > 0.1 && speed >= 7.5) {
      // Lift off and climb up to 30m cruising altitude
      const climbRate = 8.5 * safeThrottle * Math.min(1, (speed - 6.0) / 10.0);
      nextY = Math.min(30.0, nextY + climbRate * clampedDt);
    } else if (brake || safeThrottle < -0.1) {
      // Active descent / landing
      nextY = Math.max(0, nextY - 10.5 * clampedDt);
    } else if (nextY > 0) {
      // Gentle glide descent when coasting
      nextY = Math.max(0, nextY - 2.2 * clampedDt);
    }

    // Sky Ring Boosters for Planes
    if (nextY > 6.0) {
      for (let i = 0; i < SKY_RINGS.length; i++) {
        const ring = SKY_RINGS[i];
        const dx = state.x - ring.x;
        const dy = nextY - ring.y;
        const dz = state.z - ring.z;
        if (dx * dx + dy * dy + dz * dz <= ring.radius * ring.radius) {
          speed = Math.max(speed, maxForwardSpeed * 1.35);
          break;
        }
      }
    }
  } else {
    nextY = 0;
  }

  // DashCraft-style Track Booster Pads: driving over a pad surges speed to 1.38x max speed
  if (!brake && speed > 1.5 && safeThrottle >= 0 && nextY < 2.5) {
    for (let i = 0; i < SPEED_BOOST_PADS.length; i++) {
      const pad = SPEED_BOOST_PADS[i];
      const dx = state.x - pad.x;
      const dz = state.z - pad.z;
      if (dx * dx + dz * dz <= pad.radius * pad.radius) {
        speed = Math.max(speed, maxForwardSpeed * 1.38);
        break;
      }
    }
  }

  // 2. Steering (yaw rate proportional to direction and speed)
  if (Math.abs(speed) > 0.1 && Math.abs(safeSteer) > 0.02) {
    const speedFactor = Math.min(1.0, Math.abs(speed) / 6.0);
    const steerDir = speed >= 0 ? 1 : -1;
    const maxTurnRate = isPlane && nextY > 1.0 ? 1.85 : 2.15; // rad/s
    // Screen right is -X, screen left is +X when facing +Z
    yaw -= safeSteer * maxTurnRate * speedFactor * steerDir * clampedDt;

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

  // Planes flying above a building's roof height pass cleanly over it!
  const activeColliders =
    isPlane && nextY > 2.5
      ? colliders.filter((c) => nextY < c.height + 1.0)
      : colliders;

  const resolved = resolveCircleCollision(
    state.x,
    state.z,
    targetX,
    targetZ,
    carRadius,
    activeColliders,
    bounds
  );

  // If vehicle hit an obstacle and was blocked, kill speed
  if (Math.abs(resolved.x - targetX) > 0.01 || Math.abs(resolved.z - targetZ) > 0.01) {
    speed *= 0.4;
  }

  return {
    x: resolved.x,
    y: nextY,
    z: resolved.z,
    yaw,
    speed,
  };
}
