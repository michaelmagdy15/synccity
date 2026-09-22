# SyncCity agent rules

Read `MASTER_PROMPT.md`, `docs/BUILD_PLAN_3_HOURS.md`, `docs/TECH_STACK.md`, and `docs/MULTIPLAYER_PROTOCOL.md` before implementation. This repository currently contains a planning kit and starter shell, not a finished game. The three-hour build clock starts when the implementation coordinator starts the sprint.

## Product and scope

- Build an original, welcoming, retro 3D social driving city. Inspiration is quick browser access and readable arcade graphics; never copy GTA or Smash Karts assets, logos, maps, audio, names, or code.
- P0 is two real clients in one authoritative room, walking, entering/exiting a shared car, driver/passenger movement, room text, touch controls, and one cooperative checkpoint delivery. Small private rooms first, initially eight players maximum; two-player correctness comes first.
- Treat voice, identities, Game Center, social integrations, persistence, purchases, planes, and public matchmaking as explicitly gated work. Disabled features must say unavailable, never show simulated success.
- Cut optional scope before sacrificing real multiplayer. Do not turn this into a static landing page, local-only demo, giant open world, or menu collection.

## Agent coordination

- The coordinator may spawn at most three workers concurrently, reserving one execution slot for integration. Follow `docs/AGENT_COORDINATION.md` and use the prompts in `prompts/`.
- One writer per owned file/directory. Root manifests, lockfile, shared contract, and merged status are coordinator-owned during implementation. Propose a contract change before editing it; update client, server, and checks together.
- Never start two package installs simultaneously. Do not overwrite another worker's changes, reset the checkout, or claim unobserved test results.
- Integrate early in the shared workspace. Workers report files changed, commands/results, contract assumptions, blockers, and remaining work. Coordinator checks file contents and actual behavior.

## Engineering invariants

- Owner-selected backend: Supabase Auth/Postgres/Storage and Google Cloud Run hosting. Read `docs/SUPABASE_CLOUD_RUN.md`. Colyseus owns simulation; no per-tick database transforms. Cloud Run multi-instance room routing must be proven before scaling.
- Use the pinned stack and lockfile. Verify actual installed APIs; do not mix pre-0.18 Colyseus examples with 0.18 APIs. Shared files contain pure data/types/math, never renderer, DOM, secrets, or server imports.
- Server owns positions, seats, speed, collision, mission progress, and rewards. Clients send bounded inputs/actions, never authoritative transforms or balances. Validate runtime messages; TypeScript types alone do not validate packets.
- Seat assignment must be atomic on the server. A passenger cannot steer. Disconnect, exit, and reconnect must never duplicate a player or seat. Clear held inputs on blur, suspend, stale input, and disconnect.
- Clamp delta times and numeric inputs, reject NaN/Infinity, impose message length/rate limits, escape chat as text, bound buffers, and dispose GPU/network/listener resources.
- Keep gameplay timing independent of render FPS. Use simple 2.5D kinematic collision in the 3D scene first; avoid full rigid-body car physics for this sprint.
- No secrets in `VITE_*`, client code, screenshots, logs, or Git. Server credentials stay server-side. A room code is an invite mechanism, not account identity or strong security.
- Private test chat may ship in the prototype. Public UGC requires functional reporting/blocking, moderation handling, published contact details, and abuse controls. A report button writing nowhere is not moderation.
- Voice is opt-in, starts muted, asks permission after a gesture, and disconnects when leaving. No background recording. Never issue client-chosen LiveKit room/identity grants.
- Device permission prompts, OAuth, purchases, Game Center, and native bridges must handle denial/cancel/unavailable. Never grant paid goods from a client flag or Game Center score submission.

## Verification and delivery

- Build and typecheck after integration. Test the high-risk server invariants and run `docs/ACCEPTANCE_TESTS.md`; record PASS/FAIL/NOT RUN honestly with evidence.
- Two browser tabs are the minimum multiplayer proof; also attempt two devices. Touch, Safari/WebGL, permission behavior, and native iOS need actual device verification, not desktop assumptions.
- Obtain authorization before spending money, registering paid services, publishing publicly, or submitting an app. Local reversible implementation and private tests are authorized by the build prompt.
- Three hours is a target, not permission to hide missing functionality. At the deadline, freeze and hand off working commands, evidence, failures, disabled flags, and exact next steps.
- Do not claim App Store approval, commercial success, worldwide scalability, or a tested native build without evidence.
