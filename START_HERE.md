# Start here — build SyncCity

**This is the entry point for the AI agent implementing the game.** The owner wants you to use this kit to build the actual game, not produce another plan. Read this file, follow the master prompt, and begin implementation.

## 1. Understand the product

**Owner-selected backend: Supabase Auth/Postgres/Storage, with the authoritative Colyseus game server hosted on Google Cloud Run.** Read [Supabase + Cloud Run](docs/SUPABASE_CLOUD_RUN.md) before implementation. This is a fixed platform decision; do not choose an alternative backend. Keep live simulation in Colyseus.

SyncCity is an original neon/synthwave, low-poly **3D multiplayer social world** for browsers and mobile. Players freely roam on foot, get into and out of vehicles, and ride together in the same car as driver and passenger. They can hang out, text chat, and take an optional cooperative delivery. The user's supplied artwork establishes the visual mood; `Grid Drive` is a proposed driving-mode subtitle, not a requirement to restrict the game to racing.

The first target is a **real, private, playable prototype in three hours**, starting when you begin implementation. A full worldwide App Store game with voice, accounts, Game Center, social services and purchases requires later verified releases. Do not promise that a three-hour build is a complete commercial game.

## 2. Know what exists now

The list below describes the preparation baseline. Another implementation agent may already be working: inspect actual files and `docs/STATUS.md` first, preserve its work, and continue the existing sprint rather than starting a second one.

- Detailed plans, rules, networking types, agent prompts, and iOS source templates.
- Pinned npm workspaces and a Vite/TypeScript readiness page.
- No gameplay renderer, working game server, multiplayer, mission, or text/voice chat yet.
- No generated Xcode project, signed iOS binary, live provider integration, or public deployment.

**Replace the readiness page with a working game.** Successfully opening it is only a toolchain check. Do not present it as gameplay.

## 3. Read in this order

1. [AGENTS.md](AGENTS.md): mandatory project rules and authority boundaries.
2. [MASTER_PROMPT.md](MASTER_PROMPT.md): your complete implementation assignment. Execute it.
3. [Three-hour build plan](docs/BUILD_PLAN_3_HOURS.md): checkpoints, priorities and cut rules.
4. [Agent coordination](docs/AGENT_COORDINATION.md): workers, file ownership and integration interfaces.
5. [Tech stack](docs/TECH_STACK.md) and [multiplayer protocol](docs/MULTIPLAYER_PROTOCOL.md): engineering choices and wire behavior.
6. [Shared types](packages/shared/src/protocol.ts): contract source of truth; server still needs runtime validators and Colyseus schemas.
7. [Art direction](docs/ART_DIRECTION.md): user's reference and game presentation.
8. [Acceptance tests](docs/ACCEPTANCE_TESTS.md) and [status](docs/STATUS.md): evidence required and current state.

Consult [product brainstorm](docs/PRODUCT_BRAINSTORM.md), [roadmap and monetization](docs/ROADMAP_MONETIZATION.md), [integration gates](docs/INTEGRATIONS.md), and [iOS setup](docs/IOS_SETUP.md) as needed. They explain the larger product; they must not expand the three-hour P0 scope.

## 4. Check the baseline, then start the clock

From the repository root, using Node 24.16.0:

```sh
npm ci
npm run typecheck
npm run build
npm run dev
```

On Windows use `npm.cmd` if PowerShell prevents `npm` execution. If the default npm cache is not writable, set `npm_config_cache` to a `.npm-cache` folder inside this repository. The shell opens at `http://localhost:5173`. It has no server connection yet. Read `.env.example`; do not assume its settings are already implemented.

If implementation has not started, record the actual start time and 180-minute deadline in `docs/STATUS.md`. If a sprint is already active, continue its existing clock and coordinate with its active workers; do not reset its deadline or duplicate their work. Inspect installed APIs and package declarations. Reuse the lockfile; do not upgrade the stack or replace it with a different engine just to start.

## 5. Start parallel work

If your agent runtime supports subagents, run one coordinator plus up to three workers:

| Worker | Prompt | Main responsibility |
|---|---|---|
| 1 | [World/client](prompts/01_WORLD_CLIENT.md) | Actual 3D scene, avatar/car visuals, camera and controls |
| 2 | [Multiplayer/server](prompts/02_MULTIPLAYER_SERVER.md) | Real authoritative room, movement, seats, chat and delivery |
| 3 | [Social/mobile/QA](prompts/03_SOCIAL_MOBILE_QA.md) | HUD, invitations, text UI and real-client verification |

You are the coordinator. Own root dependencies/scripts, `packages/shared/**`, the client network adapter and `apps/web/src/main.ts` composition. Freeze module interfaces and shared map data before worker implementations diverge. Integrate continuously; no two agents edit the same file or install dependencies simultaneously.

No subagent tools available? Implement in the same order yourself. Do not stop merely because parallel execution is unavailable.

## 6. Build this first

1. Real room creation/exact-room join and two clients seeing each other.
2. A small shared 3D district and free movement on foot.
3. Server-owned cars: approach, take driver/passenger seat, drive together, stop and exit safely.
4. Keyboard/touch controls and private room text chat.
5. An optional server-validated shared pickup/drop-off delivery, with free roaming still available.
6. Multiplayer failure cases, mobile checks, build and reproducible handoff.

If behind, cut decorations, extra modes, audio and voice first. Do not cut actual multiplayer, free walking, enter/exit, or passenger riding. Do not create a fake online player list or simulate a friend locally as evidence.

## 7. Handle integrations honestly

Voice requires credentials, authenticated token issuance and two-device testing. Social sharing starts with an invite link; full provider connections come later. iOS templates require Mac/Xcode generation and testing. Game Center local authentication templates are not backend account verification. Purchases are roadmap-only until actual StoreKit/server validation exists. Keep unavailable features disabled and keep building the core game.

Do not buy services, publish publicly, send social posts, or submit an app without owner authorization. Local implementation and private testing are the assignment.

## 8. Finish with evidence

At each checkpoint update `docs/STATUS.md`. At the deadline run the acceptance gates and create `docs/IMPLEMENTATION_HANDOFF.md` with exact startup commands, what works, tests and device evidence, unavailable integrations, known defects, and the next five tasks. An incomplete P0 must be reported as incomplete.

**Now execute [MASTER_PROMPT.md](MASTER_PROMPT.md) and start building the actual game.** Do not stop after acknowledging this file or returning another brainstorm.
