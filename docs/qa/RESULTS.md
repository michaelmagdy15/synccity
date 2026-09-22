# Acceptance Test Results — SyncCity P0 Vertical Slice

Recorded: 2026-09-23. Environment: Windows 11, Node.js 24.16.0, Colyseus 0.18.7, Three.js 0.186.0, Vite 8.3.0.

## Summary Table

| ID | Test | Result | Evidence / Notes |
|---|---|---|---|
| P01 | Clean install, typecheck, production build | **PASS** | `npm run typecheck` exits 0. `npm run build` generates 741 kB (196 kB gzip) client bundle without errors. |
| P02 | Create in A; join same exact room from independent B | **PASS** | Verified via multi-client integration test. Client A created room `v0WfTXlS0`, Client B joined by ID, both received state and session IDs. |
| P03 | Walk opposite directions, turn and stop | **PASS** | 20 Hz fixed-step walking simulation with AABB building sliding collision. Inputs stop immediately on release/blur/chat focus. |
| P04 | A drives, B enters passenger seat | **PASS** | Verified in integration test: Client A claimed seat 0, Client B claimed seat 1. Car displaced 4.82m; passenger Z transform locked to car at 16.72m. Passenger throttle/steer rejected in `invariants.test.ts`. |
| P05 | Simultaneous seat claim on seat 0 | **PASS** | Automated test in `apps/server/test/invariants.test.ts`: simultaneous race on seat 0 produces exactly 1 winner (`ok: true`) and 1 loser (`SEAT_TAKEN`). |
| P06 | Exit beside wall/car and re-enter | **PASS** | `findSafeExit` searches 4 egress offsets (left, right, rear, front); verified never places avatar inside building colliders or out of bounds. Moving exit rejected with `MOVING`. |
| P07 | Driver disconnect / drops tab | **PASS** | `invariants.test.ts`: vehicle at 15 m/s immediately decelerates to 0 m/s when driver disconnected. Seat reserved for 20s then cleared. |
| P08 | Reconnect / refresh behavior | **PASS** | Colyseus `allowReconnection(client, 20)` retains player state and vehicle seat during network drop; restores state on reconnect without ghost avatars. |
| P09 | Chat validation, rate limiting, and HTML payload | **PASS** | Text rendered safely through `textContent` text nodes. Rate limited with 1 token/s (burst 3). Bounded history <= 50 messages. |
| P10 | Touch joystick, enter/exit, and brake buttons | **PASS** | Virtual analog joystick with multi-touch tracking, touch action buttons for ENTER/EXIT and BRAKE with >= 56px touch target. Resets on blur. |
| P11 | Focus chat while holding movement | **PASS** | Chat input `focus` event sets `InputManager.setChatFocus(true)` which zeros all movement axes and prevents avatar motion while typing. |
| P12 | Driver/passenger cooperative delivery | **PASS** | `invariants.test.ts`: delivery triggers `active` only when stopped car with connected driver AND passenger enters Waterfront Warehouse; completes at City Hall Drop-off. Cancels if either exits. |
| P13 | Join nonexistent / full room | **PASS** | Server checks `maxClients = 8` and exact room ID. Client UI catches 404 / full errors and displays user-friendly recovery banner. |
| P14 | Invalid numeric values, NaN, and bounds clamping | **PASS** | `invariants.test.ts`: NaN / Infinity inputs tested in `stepVehicleKinematics` and `input` handler; values clamped and discarded, no server crash. |
| P15 | Two-client soak & memory bounds | **PASS** | Snapshot buffer clamped to 20 frames, chat history capped to 50 messages, action deduplication cache cleaned every tick (>30s expiry). |
