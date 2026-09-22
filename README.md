# SyncCity build kit

**Give your coding agent [START_HERE.md](START_HERE.md).** It explains how to use this entire repository and immediately begin the three-hour implementation sprint.

SyncCity is a proposed synthwave 3D multiplayer city: roam freely on foot, enter and exit vehicles, ride with friends, chat, and complete optional cooperative challenges. This repository currently contains the plan, agent prompts, shared protocol, a web readiness shell, and iOS templates. **The actual game is not implemented yet.**

## Main files

- [Supabase + Google Cloud Run](docs/SUPABASE_CLOUD_RUN.md) — owner-selected backend and hosting, including routing/authentication requirements.
- [START_HERE.md](START_HERE.md) — single agent entry point.
- [MASTER_PROMPT.md](MASTER_PROMPT.md) — complete implementation assignment.
- [AGENTS.md](AGENTS.md) — mandatory engineering and coordination rules.
- [Product brainstorm](docs/PRODUCT_BRAINSTORM.md) and [roadmap/monetization](docs/ROADMAP_MONETIZATION.md).
- [Three-hour plan](docs/BUILD_PLAN_3_HOURS.md) and [worker coordination](docs/AGENT_COORDINATION.md).
- [Tech stack](docs/TECH_STACK.md), [multiplayer contract](docs/MULTIPLAYER_PROTOCOL.md), and [acceptance tests](docs/ACCEPTANCE_TESTS.md).
- [Art direction](docs/ART_DIRECTION.md) — incorporates the user's SyncCity Grid Drive reference.
- [iOS setup](docs/IOS_SETUP.md) — Swift Game Center bridge templates, configuration fragments and Mac handoff.

## Run the preparation shell

Node 24.16.0 and npm are the verified preparation runtime. From this folder:

```sh
npm ci
npm run dev
npm run build
```

Use `npm.cmd` on Windows if necessary. A restricted environment can set `npm_config_cache` to the repository's `.npm-cache` directory. Open `http://localhost:5173`. This page is a readiness shell, not the game. There is no server startup command until worker 2 builds it and the coordinator wires scripts.

The chosen stack is TypeScript + Vite + Three.js, an authoritative Node/Colyseus server on Google Cloud Run, Supabase for the application backend, optional LiveKit voice, and Capacitor 8 for iOS. Core dependency versions are pinned and locked; the Supabase adapter is an implementation task. Prepared iOS files are source templates, not a generated or signed Xcode project. Another agent may be implementing gameplay now; consult current STATUS.md and preserve its work.

## Owner's instruction to the next agent

> Read START_HERE.md, then execute MASTER_PROMPT.md. Use the supplied rules, plans, shared protocol, and parallel worker prompts to build the actual SyncCity game. Start the three-hour implementation clock now. Prioritize real multiplayer, free roaming, entering/exiting vehicles, riding together, and touch controls. Report what genuinely works and what remains incomplete.

See [STATUS.md](docs/STATUS.md) for capability status and [PREPARATION_VERIFICATION.md](docs/PREPARATION_VERIFICATION.md) for checks performed on this kit.
