# SyncCity implementation decisions

Research checked 2026-09-23. This is the recommended implementation for a three-hour playable prototype, not a claim that these integrations already work. Exact installed versions and test evidence belong in the build handoff.

## Decision

The owner selected **Supabase application backend and Google Cloud Run game-server hosting**. Read [SUPABASE_CLOUD_RUN.md](SUPABASE_CLOUD_RUN.md); it overrides generic persistence/hosting choices below. Live rooms remain in memory; durable records use Supabase Postgres, identity uses Supabase Auth, and approved assets use Storage. Cloud Run requires explicit routing work before multi-instance scale.

Use one TypeScript repository with npm workspaces: `apps/web`, `apps/server`, and `packages/shared`. Ship a compact browser game first, then package the same web build for iOS. Keep the first district and room small enough to finish and test.

| Area | Choice | Why / boundary |
| --- | --- | --- |
| Runtime | Node.js 24.16.0 for this prepared kit | Use the same runtime locally and on host; check dependency engine requirements during install. |
| Web tooling | Vite + TypeScript | Fast iteration, static production bundle, no SSR requirement. |
| 3D | Three.js WebGL renderer | Primitive low-poly city and vehicles; direct scene ownership; no editor or asset pipeline blocking the demo. |
| UI | HTML/CSS DOM overlays and TypeScript | Joystick, chat, garage prompt, reconnect overlay; no additional UI framework for the prototype. |
| Multiplayer | Colyseus 0.18 family, Node server | Room ownership and authoritative state. Use `colyseus`, `@colyseus/schema`, and `@colyseus/sdk` compatible releases. |
| Movement | Shared pure TypeScript kinematic simulation | Fixed-step walking and arcade cars with static collider checks; no rigid-body physics dependency in hour one. |
| Voice | Managed LiveKit, optional during sprint | `livekit-client` and backend `livekit-server-sdk`; audio-only rooms; requires provisioned credentials and device test. |
| iOS | Capacitor 8 family | Package built web assets; Swift bridges later for Game Center / StoreKit. Signing and device build require a Mac. |
| Verification | TypeScript build, focused simulation/protocol tests, two real clients | Use Vitest or existing test runner; exercise multiplayer behavior, not just DOM snapshots. |
| Persistence | In-memory rooms in prototype | No real purchases, accounts, durable inventories or global economy yet. |
| Hosting | Static HTTPS frontend + long-lived Node WebSocket service | One region and one process initially; HTTPS/WSS required for remote mobile and voice validation. |

Vite documents supported Node requirements in its [getting-started guide](https://vite.dev/guide/). Three.js provides [renderer, geometry, materials and instancing APIs](https://threejs.org/docs/). These choices optimize the prototype schedule; they are engineering decisions, not performance guarantees.

## Dependency freeze before agent fan-out

The coordinator installs a mutually compatible published set, verifies `npm ls`, runs a minimal room/client join, and commits one lockfile. Pin exact installed versions; never allow agents to independently upgrade packages or mix old Colyseus examples. If the registry lacks the documented family, select the latest mutually compatible published family, adapt hooks once, and record the deviation before work starts. Do not invent patch versions.

Registry versions verified by the coordinator on 2026-09-23: `colyseus@0.18.7`, `@colyseus/sdk@0.18.3`, `@colyseus/schema@5.0.33`, `three@0.186.0`, `vite@8.3.0`, and `typescript@7.0.2`. Use these exact pins in the prepared scaffold; lockfile/install and a room join still determine compatibility in practice. Server and client package patch versions need not be identical.

Current [Colyseus docs](https://docs.colyseus.io/) and [client SDK docs](https://docs.colyseus.io/sdk) use `@colyseus/sdk`; prediction APIs have a version boundary. Use ordinary input messages and authoritative state patches for this sprint. The server owns actual Colyseus schemas; shared types are plain DTO contracts and do not import server libraries into the browser. Prefer the current schema builder to decorator configuration if available in the pinned family.

## Project boundaries

- `apps/web/src/world` and `apps/web/src/input`: renderer, city geometry, entity presentation, camera and controls.
- `apps/web/src/network`: room adapter, state subscriptions, interpolation, reconnect UI.
- `apps/web/src/ui`: menus, chat, invite link and touch HUD.
- `apps/server/src`: room lifecycle, validation, authoritative simulation, guest session issuance, optional voice token endpoint.
- `packages/shared/src`: protocol, world collider layout, numeric tuning constants and pure simulation math.
- `ios-template`: native packaging instructions and truthful templates until a generated Xcode project is available.

Use a single shared map description containing boundaries, building boxes, safe spawn points, parked cars and mission checkpoints. Renderer embellishments must not change collision geometry. World units are meters; Y points up, X/Z are the ground plane, and yaw is radians. First district is approximately 160 by 160 meters with 8 players and 4 two-seat cars as initial limits.

## Networking and physics

Run server simulation at 20 Hz and send state patches every 50 ms. These are starting targets, to be measured. Client inputs arrive at up to 20 Hz independently of rendering. The server computes position, collision, seat ownership and mission progress. A client never chooses its authoritative position or reward. See [MULTIPLAYER_PROTOCOL.md](MULTIPLAYER_PROTOCOL.md).

Model cars as bounded arcade movement on a flat ground plane. Sweep movement or substep collision against static boxes so cars cannot tunnel through buildings. Use collision radii/capsules and a deterministic safe egress search. Defer vehicle-to-vehicle pushing, pedestrians, realistic suspension, destructible scenery, flying and streaming terrain. Non-colliding avatars avoid griefing and simplify the first social space.

Interpolate remote transforms with an approximately 100 ms snapshot buffer. First integration may also interpolate local movement; add prediction only after two clients see correct state. Prediction is presentation only, must reconcile against server acknowledgements, and must reset on teleport, entering/exiting a car and reconnect.

## Mobile and 3D budgets

Treat the following as prototype targets, not measured facts: stable 30 fps on the selected test iPhone, 60 fps on a development desktop, under 100 draw calls, under 100k visible triangles, and initial compressed assets under 5 MB. Cap device pixel ratio at 1.5 and offer a low-quality preset at 1.0. Record device, browser, thermal duration, frame time and network conditions with each measurement.

Use repeated geometry/instancing for blocks, streetlights and trees; flat colors; one hemisphere plus one directional light; blob shadows; fog and conservative far clipping. Disable real-time shadows/postprocessing initially. Avoid per-frame object allocation, unbounded chat history, downloading remote avatar images and dynamic text meshes. Provide pointer controls and touch controls; clear held inputs on blur, touch cancel and backgrounding. Keep joystick and brake controls away from safe-area edges and the chat keyboard. An unavailable WebGL context produces a readable retry/help screen.

## Voice and identity

Voice is a gated stretch feature. If LiveKit credentials and HTTPS are absent, show a clear unavailable state and ship working text chat. Do not label a microphone button as a working feature without a two-device microphone test. Use explicit opt-in, default muted, a speaking indicator and one-tap mute/leave. Do not record audio in the prototype.

Create guest identity on the backend and issue short-lived authenticated game sessions. A nickname or Colyseus session ID supplied in an HTTP body is not authentication. Validate the game bearer/session server-side and confirm active room membership before minting a LiveKit token. Bind identity and room using server records, permit microphone publication and subscription only, disable camera/data/admin grants, and never expose `LIVEKIT_API_SECRET` through `VITE_*` variables. Use opaque IDs, not email or real names. The [LiveKit grants reference](https://docs.livekit.io/frontends/reference/tokens-grants/) explains room-scoped permissions and token expiration. Token expiry does not eject an already connected user: kick/revoke via the server API when moderation or room membership demands it.

For first voice integration, use opt-in whole-room audio inside a private playtest. Later add party/car voice, permission-based subscription and push-to-talk. Merely lowering local volume for distant players does not enforce private proximity audio. Public voice and user chat require functional reporting/blocking, moderation operations and release review before rollout.

## Native boundary

Capacitor wraps the game in WKWebView and supports native bridges. Its [current iOS guide](https://capacitorjs.com/docs/ios) lists iOS 15+ and Xcode 26+ for this major; confirm the pinned version's requirements on the build Mac. Windows can prepare source/configuration but cannot establish an iOS signing or real-device result. Bundle compiled web assets for a release and configure secure backend endpoints. Test microphone permission, audio interruption, app backgrounding, safe areas and reconnect on actual iOS hardware.

Game Center is a platform service layer, not the world simulation backend. Implement native authentication/achievements later behind an adapter and verify identity on the backend before linking accounts. Social integration starts with shareable invitations and Web Share / clipboard fallback. Each provider-specific login, friends graph or publishing flow is a separate scoped integration. Real-money items require receipt/transaction verification, server entitlements and platform purchase compliance before activation.

## Scaling and deployment path

Begin with 8-player isolated rooms. One room is owned by one process; extra processes do not distribute a single room's physics automatically. Next add regional matchmaking, room allocation, shared presence/driver infrastructure appropriate to the pinned Colyseus release, metrics and rate limits. Validate routing so a reservation reaches the owning process. Persist accounts, moderation and entitlement records in a managed relational database only when those features land; do not write transforms to it every tick.

Static hosting alone cannot host this Node room server. Use a host that supports persistent WebSockets and controllable process lifetime. Configure exact web and native origins, TLS termination, connection limits and health/readiness endpoints. Avoid sleep-on-idle behavior for production matchmaking. Deployments drain rooms or warn and reconnect users; memory-only worlds disappear on restart. Load-test measured room CPU, bandwidth, event-loop delay and memory before increasing room capacity. Worldwide popularity, store approval and monetization are product outcomes to test, not architectural guarantees.
