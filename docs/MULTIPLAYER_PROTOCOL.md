# SyncCity multiplayer contract v1

This is an implementation contract. `packages/shared/src/protocol.ts` supplies matching TypeScript DTOs; it is not a server or a runtime validator. The coordinator owns contract changes. Update both documents/types and notify client/server agents before changing field names or behavior.

## Room and authority

Room type: `city`. Initial cap: 8 players. One room owns one map instance, players, four two-seat cars and session-scoped mission progress. Joining requires `protocolVersion: 1` and a display name of at most 20 characters. Server sanitizes names and authenticates the guest session, generates identity, and chooses a safe spawn. Never trust a client-supplied user ID. Reject a protocol mismatch with a user-readable reload message.

For invitations, server creates/resolves an opaque invite code to a room. Invited clients join that exact room and receive a full/expired result; do not silently `joinOrCreate` a different room. The invite code is not identity. Private rooms additionally validate access. Initial local QA may use the same explicitly displayed room ID on both clients.

Coordinates use meters with Y up and ground X/Z. Yaw is radians, yaw 0 faces positive Z, and positive yaw turns toward positive X. The server alone writes positions, velocity/speed, seating, connected state, checkpoint progress and future rewards. [Colyseus state synchronization](https://docs.colyseus.io/state) provides the authoritative state distribution mechanism.

## Authoritative state

| Entity | Fields / invariant |
| --- | --- |
| City | `protocolVersion`, `tick`, `serverTimeMs`, `mapVersion`, player map, vehicle map, `delivery` |
| Player | Server ID, name, `x/y/z/yaw`, `connected`, `mode`, `vehicleId`, `seatIndex`, `inputEpoch`, `lastInputSeq` |
| Vehicle | Server ID, `x/y/z/yaw`, `speed`, two occupant IDs (`seats[0]` driver and `seats[1]` passenger) |

Use empty strings for unoccupied seats/no vehicle and `seatIndex=-1` for a walking player. Colyseus schema uses its own map/array containers while the shared DTO presents ordinary records/tuples. Both adapters must preserve the same fields. Seated player transforms are derived from the authoritative vehicle and local seat offsets; no independent movement. Seats are the source of truth; player mode/vehicle fields must update in the same synchronous mutation.

Keep secrets, guest bearer tokens, reconnection tokens, invite ACLs and moderation internals out of replicated state. Keep chat as bounded transient events rather than an ever-growing schema collection. No persistent economy is included in v1.

## Optional delivery and free roaming

Players are always free to walk and drive without a mission. One room delivery has `id`, `phase` (`available`, `active`, `complete`), `vehicleId`, `participantIds`, `pickupId`, `destinationId`, `completedAtMs`, and `restartAtMs`. Map data defines distinct pickup and destination checkpoint positions/radii. No client completion message exists.

When available, the first stopped vehicle with a connected driver and passenger in the pickup radius claims the delivery in the authoritative tick. Record the two server player IDs and vehicle ID. Show clear pickup signage so entering that zone is an understandable opt-in. Other cars and walking players can continue roaming.

When active, require the same vehicle and original two connected participants to arrive together, seated, at the destination below 1 m/s. Then transition once to complete and stamp server time. The complete state remains visible for ten seconds, then resets with a new delivery ID. No money or permanent inventory is awarded. If either participant leaves a seat or disconnects before completion, cancel back to available with a new ID; both UIs must explain cancellation. A later design may support mission resume, but v1 cancels consistently. Starting, cancelling and finishing are synchronous server transitions, so repeated ticks cannot double-complete one ID. Test these transitions on both clients.

## Client messages

Send using Colyseus named messages. Values in the table are payload fields; sender identity comes from the authenticated connection, never the payload.

| Name | Fields | Server behavior |
| --- | --- | --- |
| `input` | `epoch`, `seq`, `axisX`, `axisZ`, `throttle`, `steer`, `brake` | Validate and store latest controls; apply at the next fixed tick. |
| `vehicle:enter` | `requestId`, `vehicleId`, `seatIndex:0\|1` | Atomically validate and claim specified seat. |
| `vehicle:exit` | `requestId` | Validate own seat, speed and safe egress; release and place avatar. |
| `chat:send` | `requestId`, `text` | Validate length/rate, sanitize plain text, broadcast once. |
| `ping` | `nonce` | Echo nonce with server time for basic latency UI. |

Axes, throttle and steer are finite numbers in [-1,1]; brake is boolean. Walking axes are world-space and normalized if magnitude exceeds one. Client converts camera-relative joystick intent to world axes before sending. Only driver controls use throttle/steer/brake. Passenger controls never alter the car. `seq` is a nonnegative safe integer increasing within a server-issued input epoch; old or duplicate input is discarded. Epoch changes whenever control ownership changes or the connection resumes so delayed inputs cannot drive a newly acquired car.

Suggested hard limits: maximum encoded message size 2 KiB, input accepted up to 30 messages/second with a short burst allowance, at most 5 seat actions/second, and chat 1 message/second with a 3-message burst. Chat is 1-240 Unicode code points after trim, maximum 1 KiB UTF-8; normalize or reject forbidden control characters. Render with `textContent`, not HTML. Keep at most 50 messages client-side. Reject malformed inputs before mutating state and disconnect repeated abusive senders. These are tunable starting policies.

`requestId` is a bounded opaque string (1-64 characters). Keep a bounded per-player cache of the last 64 action results for 30 seconds. Repeating a seat or chat request returns the same result without repeating the mutation/broadcast. Reject a repeated ID with a different action payload. Do not queue new gameplay actions during connection loss. Upon resuming, drop queued movement/seat commands and start a new input epoch.

## Server events

| Name | Fields | Meaning |
| --- | --- | --- |
| `welcome` | `playerId`, `protocolVersion`, `inputEpoch`, `roomId` | Sent on join; authoritative state remains the final identity/epoch source. |
| `action:result` | `requestId`, `ok`, optional `code` | Ack or rejection for enter/exit/chat; does not replace authoritative state. |
| `chat:message` | `id`, `senderId`, `displayName`, `text`, `serverTimeMs` | Sanitized server-stamped text event. |
| `pong` | `nonce`, `serverTimeMs` | Debug latency measurement. |

Error codes: `INVALID_MESSAGE`, `RATE_LIMITED`, `NOT_FOUND`, `NOT_WALKING`, `TOO_FAR`, `SEAT_TAKEN`, `MOVING`, `NO_SAFE_EXIT`, `NOT_SEATED`. Clients translate codes to short helpful text. An ack can arrive before the next state patch; do not give the client seat authority while waiting. Colyseus sends full state on join and later patches; no duplicate custom snapshot protocol is required.

## Shared car transaction

On enter, validate connected player, walking state, car existence, explicit seat index, empty requested seat, server-measured distance at most 3 meters, and absolute car speed at most 1 m/s. Claim the seat and set player mode/vehicle/seat in one synchronous room handler without `await`. Clear stored inputs, increment player input epoch and reset last sequence. Two clients racing for the same seat yield exactly one success. Driver and passenger may join separate seats independently.

No automatic driver takeover. When the driver exits, brake the car and leave the passenger seated. A passenger can exit and then explicitly request seat zero when safe. This avoids unrequested ownership changes. Block entering/exiting above 1 m/s; a connected passenger may request braking through social chat but cannot inject driver controls.

On exit, search predefined side offsets around the car using authoritative collision checks and map bounds. If none is clear, reject `NO_SAFE_EXIT`; never place an avatar inside a building. On success, clear seat, set walking fields and safe position, clear input and increment epoch. Driver exits also clear throttle and brake the car. Car reset, despawn or mission teleport must safely eject all occupants as one operation. A stuck-car reset may be added only with cooldown and validated occupants; do not accept arbitrary coordinates.

## Fixed-step simulation

Target 20 Hz with 50 ms fixed steps. Use an accumulator with a bounded catch-up budget; record dropped simulation time rather than simulating giant elapsed-time jumps. Do not derive movement distance from client timestamps or input message count. Walk speed starts at 5 m/s, forward car speed cap 18 m/s and reverse cap 6 m/s. Shared constants are tuning values, never client authority.

Each tick: expire stale controls; simulate car acceleration, turning and braking; sweep/substep static collision; update walking avatars and world bounds; derive seated transforms; evaluate any server-owned checkpoint crossings; increment tick and server time. Stop applying throttle/axes after 250 ms without valid input. A disconnected driver triggers immediate braking. Vehicle acceleration/braking constants belong in shared simulation code, agreed before client prediction is added.

Client rendering is independent: retain timestamped transforms, interpolate remote entities approximately 100 ms behind server time, and clamp extrapolation to a short budget before freezing with connection status. Local prediction is optional and requires replay of unacknowledged inputs against shared simulation plus reconciliation using `lastInputSeq`. On ownership/epoch change, flush prediction and interpolation as appropriate. Never smooth an old walking transform through a seat transition.

## Drop, reconnect and cleanup

Use the pinned Colyseus family's lifecycle API. Current [reconnection docs](https://docs.colyseus.io/room/reconnection) provide `allowReconnection`, refreshed reconnection tokens and full-state recovery; older versions have different hooks. For the selected 0.18 family, use `onDrop` and `onReconnect` and finalize cleanup on permanent `onLeave`.

On drop: mark disconnected, clear input, brake any driven car immediately, and reserve the player's game state and occupied car seat for at most 20 seconds. The Colyseus connection reservation and the game's car seat are separate concepts; explicitly maintain both. Show reconnecting UI and disable actions. A passenger can exit a stopped car whose driver disconnected; no force takeover during the short reservation window.

On valid resume: retain identity and position/seat, mark connected, increment input epoch, reset sequence/input queues and reconcile against fresh authoritative state. Refresh the stored reconnection token; keep it out of URLs, logs and shared state. Session storage is sufficient for the browser playtest. A manual reconnect creates a new room object and must reattach listeners. When the timeout expires or leave is intentional, release seats, stop a driverless car, remove the player, clear rate-limit/idempotency state and clean up listeners/timers. A full server restart loses prototype rooms; offer fresh room creation clearly.

## Minimum evidence before calling multiplayer done

1. Two independent clients join the same room and see each other's walk position/name; measure this across two devices when available.
2. Client A drives, client B selects passenger, and both show the same car motion and seat identities for at least 60 seconds.
3. Two simultaneous claims on seat zero produce one owner; the loser receives `SEAT_TAKEN`.
4. Passenger sends car inputs, forged coordinates, invalid numbers and oversized messages; none can change vehicle authority or poison state.
5. Driver loses connection: car brakes, stale input cannot continue movement, successful reconnect restores identity, and expiry frees the seat.
6. Text arrives once, displays literal markup safely and respects rate/length limits. Duplicate request IDs do not duplicate chat.
7. Enter/exit while moving, too far away and without a safe exit are denied. Ownership transitions clear old inputs.
8. Slow network and a background/resume cycle leave UI recoverable. Room/server shutdown shows a useful rejoin path.

Run focused server tests for ownership races, egress and disconnect; then verify with actual clients. Bots and passing unit tests do not prove browser/iOS rendering, touch controls or microphone behavior. Record any untested platform as untested.
