# Three-hour implementation sprint

This is a target for a private playable vertical slice with several capable agents and a working Node environment. It is not an estimate for a polished, moderated, worldwide App Store game. The preparation kit includes a compileable shell and native templates; implementation starts a new 180-minute clock.

## What the demo should feel like

Open an invite, choose a nickname, spawn in a colorful plaza. See your friend across the street. Walk to a compact car, become driver, let the friend board as passenger, and deliver a parcel together to the waterfront. Chat “again?” and switch seats. A city roughly 160 × 160 meters, one plaza, garage, and waterfront are enough. Enterable buildings and an economy are unnecessary. Free roaming on foot and by car is always available; the delivery is optional.

## Time budget and evidence gates

| Elapsed | Coordinator | World/client worker | Server worker | Social/mobile/QA worker | Exit evidence |
|---|---|---|---|---|---|
| 0–15 min | Verify scaffold; record deadline; freeze types; establish run scripts | Camera/canvas/render lifecycle | Boot room, health route, strict join | HUD interfaces, join/error flow | Existing shell builds; interfaces agreed |
| 15–30 | Wire two clients to actual room | Primitive city and avatar | Player schema, validated movement input | Connect/disconnect HUD | Two clients in one room, state updates visible |
| 30–60 | Integrate renderer with server state | Walk/camera, collision visuals, car mesh | Fixed tick, bounds, cars, atomic seat claim | Keyboard/touch/chat input | One driver visible on both clients |
| 60–90 | Resolve position/seat/camera defects | Passenger view, mobile render tuning | Passenger transform, exit, stale input cleanup | Text chat, invite copy, touch release | Two humans can ride together and exit |
| 90–120 | Add cooperative delivery contract and integrate | Checkpoint markers and progress feedback | Authoritative delivery triggers; duplicate completion protection | End-to-end testing; social controls | Complete one delivery in two clients |
| 120–150 | Package, fix integration; optional voice decision | Performance pass on chosen device | Invalid packet and reconnect tests | Mobile regression; verify iOS templates | Build passes, critical tests pass |
| 150–180 | Freeze features, final regression, handoff | Critical fixes only | Critical fixes only | Capture honest evidence and defects | Documented playable artifact and limitations |

## Stop-loss decisions

- At minute 30 without two clients connected: all optional UI pauses. Coordinator and server owner fix connectivity while world owner continues simple rendering. Do not spend another hour on scenery.
- At minute 60 without driving: use flat ground and kinematic steering, no slopes or rigid-body simulation. Keep server collision to boundaries and simple rectangles.
- At minute 90 without passenger synchronization: freeze art and delegate reproducible seat/camera debugging. Driver/passenger experience is the differentiator.
- At minute 120: voice stays disabled unless P0 works and provider credentials plus secure token endpoint are ready. Implement a provider adapter later; do not invent a fake connected voice state.
- At minute 150: no new dependencies, integrations, or modes. Document blocked features rather than make the last 30 minutes a rewrite.
- At minute 180: report accurately. If essential tests fail, call it an incomplete prototype and list exact failures. Continue only if the owner extends the sprint.

## Inputs and setup assumptions

Development needs Node 24 (available on preparation machine), npm, a modern browser, and two browser sessions. Remote play additionally needs an HTTPS frontend and reachable authoritative WSS server. Microphone testing on a phone needs a secure context; plain LAN HTTP is insufficient for a production voice test. Physical iOS builds need a Mac, Xcode, and signing configuration.

Optional credentials: LiveKit URL/key/secret, deploy provider, Apple developer team and App Store Connect app, OAuth provider applications, support contact, privacy policy URL. Missing credentials must not block local walking/driving/chat. Never paste secret values into status documents.

## Definition of an acceptable three-hour outcome

All P0 tests in `ACCEPTANCE_TESTS.md` pass or the remaining failure is explicitly called out. A reviewer can use documented commands to run the same build. No feature is called implemented solely because its button or interface exists. Native templates are called templates until generated, compiled, signed, and exercised on a device.
