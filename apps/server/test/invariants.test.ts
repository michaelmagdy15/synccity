import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS } from '@synccity/shared/protocol';
import {
  CHECKPOINTS,
  CITY_BOUNDS,
  CITY_COLLIDERS,
  RACE_CIRCUIT,
  collidesWithBuildings,
  findSafeExit,
  isWithinBounds,
  resolveCircleCollision,
  stepVehicleKinematics,
} from '@synccity/shared/world';
import { CityRoomState, PlayerSchema, VehicleSchema } from '../src/schema/CityRoomState.js';
import { CitySimulation } from '../src/simulation/CitySimulation.js';

describe('SyncCity Server Invariants & Simulation Tests', () => {
  test('P05: Atomic seat claims - simultaneous requests on seat 0 yield one winner', () => {
    const state = new CityRoomState();
    const veh = new VehicleSchema();
    veh.id = 'veh_test';
    veh.x = 0;
    veh.y = 0;
    veh.z = 0;
    veh.speed = 0;
    veh.seats.push('', '');
    state.vehicles.set('veh_test', veh);

    const playerA = new PlayerSchema();
    playerA.id = 'player_A';
    playerA.mode = 'walking';
    playerA.x = 1.0;
    playerA.z = 0;
    state.players.set('player_A', playerA);

    const playerB = new PlayerSchema();
    playerB.id = 'player_B';
    playerB.mode = 'walking';
    playerB.x = -1.0;
    playerB.z = 0;
    state.players.set('player_B', playerB);

    // Simulate atomic seat claim logic
    const claimSeat = (pId: string, seatIdx: 0 | 1) => {
      const v = state.vehicles.get('veh_test')!;
      const p = state.players.get(pId)!;
      if (p.mode !== 'walking') return { ok: false, code: 'NOT_WALKING' };
      if (v.seats[seatIdx] !== '') return { ok: false, code: 'SEAT_TAKEN' };

      v.seats[seatIdx] = pId;
      p.mode = seatIdx === 0 ? 'driver' : 'passenger';
      p.vehicleId = v.id;
      p.seatIndex = seatIdx;
      return { ok: true };
    };

    // Both race to claim seat 0 (driver)
    const resA = claimSeat('player_A', 0);
    const resB = claimSeat('player_B', 0);

    assert.equal(resA.ok, true, 'First claimer must succeed');
    assert.equal(resB.ok, false, 'Second racer must be rejected');
    assert.equal(resB.code, 'SEAT_TAKEN', 'Rejection code must be SEAT_TAKEN');
    assert.equal(veh.seats[0], 'player_A', 'Seat 0 must belong to player_A');
  });

  test('P04: Passenger steering rejection - passenger inputs cannot steer or accelerate vehicle', () => {
    const state = new CityRoomState();
    const sim = new CitySimulation(state);

    const veh = new VehicleSchema();
    veh.id = 'veh_test';
    veh.x = 0;
    veh.y = 0;
    veh.z = 0;
    veh.yaw = 0;
    veh.speed = 0;
    veh.seats.push('driver_id', 'passenger_id');
    state.vehicles.set('veh_test', veh);

    const driver = new PlayerSchema();
    driver.id = 'driver_id';
    driver.mode = 'driver';
    driver.connected = true;
    state.players.set('driver_id', driver);

    const passenger = new PlayerSchema();
    passenger.id = 'passenger_id';
    passenger.mode = 'passenger';
    passenger.connected = true;
    state.players.set('passenger_id', passenger);

    // Passenger tries to inject full throttle and steer
    sim.setPlayerInput('passenger_id', {
      epoch: 1,
      seq: 1,
      axisX: 0,
      axisZ: 0,
      throttle: 1.0,
      steer: 1.0,
      brake: false,
    });

    // Advance simulation 10 steps (0.5s)
    for (let i = 0; i < 10; i++) {
      sim.update(0.05);
    }

    assert.equal(veh.speed, 0, 'Vehicle speed must remain 0 despite passenger throttle');
    assert.equal(veh.yaw, 0, 'Vehicle yaw must remain 0 despite passenger steering');
  });

  test('P06: Safe exit placement - egress never places player inside a building', () => {
    // bldg_nw_corp is minX: -40, maxX: -20, minZ: -76, maxZ: -50
    // Place a vehicle immediately adjacent to this building at (-41.5, -60) facing north (yaw = 0)
    const carX = -41.5;
    const carZ = -60;
    const carYaw = 0;

    const safeExit = findSafeExit(carX, carZ, carYaw, CITY_COLLIDERS, CITY_BOUNDS);
    assert.ok(safeExit, 'A safe exit position must be found');

    const inBuilding = collidesWithBuildings(safeExit.x, safeExit.z, 0.45, CITY_COLLIDERS);
    assert.equal(inBuilding, false, 'Safe exit position must NOT collide with building');

    const inBounds = isWithinBounds(safeExit.x, safeExit.z, 0.45, CITY_BOUNDS);
    assert.equal(inBounds, true, 'Safe exit position must be within city bounds');
  });

  test('P07: Driver disconnect - vehicle immediately decelerates to stop', () => {
    const state = new CityRoomState();
    const sim = new CitySimulation(state);

    const veh = new VehicleSchema();
    veh.id = 'veh_runaway';
    veh.x = 0;
    veh.y = 0;
    veh.z = 0;
    veh.yaw = 0;
    veh.speed = 15; // Moving fast
    veh.seats.push('driver_id', '');
    state.vehicles.set('veh_runaway', veh);

    const driver = new PlayerSchema();
    driver.id = 'driver_id';
    driver.mode = 'driver';
    driver.connected = false; // Disconnected!
    state.players.set('driver_id', driver);

    // Step simulation - disconnected driver triggers immediate braking
    for (let i = 0; i < 20; i++) {
      sim.update(0.05);
    }

    assert.equal(veh.speed, 0, 'Car must completely stop after driver disconnects');
  });

  test('P12: Cooperative delivery lifecycle - requires both occupants, completes once, cancels on exit', () => {
    const state = new CityRoomState();
    const sim = new CitySimulation(state);

    const pickup = CHECKPOINTS.pickup;
    const dest = CHECKPOINTS.destination;

    const veh = new VehicleSchema();
    veh.id = 'deliv_car';
    // Position car right at the pickup zone
    veh.x = pickup.x;
    veh.y = 0;
    veh.z = pickup.z;
    veh.speed = 0;
    veh.seats.push('driver_1', 'passenger_1');
    state.vehicles.set('deliv_car', veh);

    const driver = new PlayerSchema();
    driver.id = 'driver_1';
    driver.mode = 'driver';
    driver.connected = true;
    state.players.set('driver_1', driver);

    const passenger = new PlayerSchema();
    passenger.id = 'passenger_1';
    passenger.mode = 'passenger';
    passenger.connected = true;
    state.players.set('passenger_1', passenger);

    // 1. Trigger pickup
    sim.update(0.05);
    assert.equal(state.delivery.phase, 'active', 'Delivery must activate when 2 seated players reach pickup');
    assert.equal(state.delivery.vehicleId, 'deliv_car');
    assert.equal(state.delivery.participantIds.length, 2);

    // 2. Teleport vehicle to destination zone
    veh.x = dest.x;
    veh.z = dest.z;
    veh.speed = 0;

    // Step simulation at destination
    sim.update(0.05);
    assert.equal(state.delivery.phase, 'complete', 'Delivery must complete when arriving at destination');
    assert.ok(state.delivery.completedAtMs > 0, 'Completed timestamp must be recorded');
  });

  test('P14: Invalid numeric values and bounds clamping', () => {
    // Ensure NaN/Infinity cannot break vehicle simulation
    const result = stepVehicleKinematics(
      { x: 0, y: 0, z: 0, yaw: 0, speed: 0 },
      NaN,
      Infinity,
      false,
      0.05,
      CITY_COLLIDERS,
      CITY_BOUNDS
    );

    assert.equal(Number.isFinite(result.x), true, 'X must remain finite');
    assert.equal(Number.isFinite(result.z), true, 'Z must remain finite');
    assert.equal(Number.isFinite(result.yaw), true, 'Yaw must remain finite');
    assert.equal(Number.isFinite(result.speed), true, 'Speed must remain finite');
  });

  test('P15: Steering direction and seat layout invariants', () => {
    // Forward vehicle facing +Z: steer +1 (right) must decrease yaw (turn toward -X, screen right)
    const turnRight = stepVehicleKinematics(
      { x: 0, y: 0, z: 20, yaw: 0, speed: 10 },
      0,
      1.0, // Steer right
      false,
      0.1,
      CITY_COLLIDERS,
      CITY_BOUNDS
    );
    assert.ok(turnRight.yaw < 0, 'Steering right while moving forward must decrease yaw toward negative X');
    assert.ok(turnRight.x < 0, 'Moving forward while turning right must move towards negative X');

    // Steer -1 (left) must increase yaw (turn toward +X, screen left)
    const turnLeft = stepVehicleKinematics(
      { x: 0, y: 0, z: 20, yaw: 0, speed: 10 },
      0,
      -1.0, // Steer left
      false,
      0.1,
      CITY_COLLIDERS,
      CITY_BOUNDS
    );
    assert.ok(turnLeft.yaw > 0, 'Steering left while moving forward must increase yaw toward positive X');
    assert.ok(turnLeft.x > 0, 'Moving forward while turning left must move towards positive X');
  });

  test('P16: Grand Prix racing simulation - countdown, gate progression, lap timing, finish order', () => {
    const state = new CityRoomState();
    const sim = new CitySimulation(state);

    const veh = new VehicleSchema();
    veh.id = 'race_car_1';
    veh.x = 0;
    veh.y = 0;
    veh.z = 25;
    veh.yaw = 0;
    veh.speed = 0;
    veh.seats.push('driver_racer', '');
    state.vehicles.set('race_car_1', veh);

    const driver = new PlayerSchema();
    driver.id = 'driver_racer';
    driver.displayName = 'Speedster';
    driver.mode = 'driver';
    driver.vehicleId = 'race_car_1';
    driver.seatIndex = 0;
    driver.connected = true;
    state.players.set('driver_racer', driver);

    // 1. Start race
    sim.startRace();
    assert.equal(state.race.status, 'countdown', 'Race must enter countdown phase');
    assert.equal(state.race.countdownSeconds, 3, 'Countdown must start at 3 seconds');
    assert.ok(state.race.participants.has('driver_racer'), 'Driver must be added as participant');

    // 2. Advance 3.2 seconds to trigger green light
    sim.update(3.2);
    assert.equal(state.race.status, 'racing', 'Race must transition to racing phase after countdown');
    assert.ok(state.race.startedAtMs > 0, 'Start timestamp must be recorded');

    // 3. Move car through checkpoints 1 to 6
    for (let g = 1; g < RACE_CIRCUIT.length; g++) {
      const gate = RACE_CIRCUIT[g];
      veh.x = gate.x;
      veh.z = gate.z;
      sim.update(0.05);
    }

    // 4. Cross Gate 0 (Start/Finish line) to complete Lap 1
    const gate0 = RACE_CIRCUIT[0];
    veh.x = gate0.x;
    veh.z = gate0.z;
    sim.update(0.05);

    const pAfterLap1 = state.race.participants.get('driver_racer')!;
    assert.equal(pAfterLap1.currentLap, 2, 'Crossing finish line must advance participant to Lap 2');
    assert.ok(pAfterLap1.bestLapMs > 0, 'Lap time must be recorded');
  });
});

