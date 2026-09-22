# Server implementation slot

Dependencies are pinned, but no server exists yet. Worker 2 implements this folder using the shared protocol and multiplayer design. The coordinator adds actual start/dev/test scripts after an entry point exists. Do not claim `npm run dev` starts multiplayer: currently it starts only the web readiness shell.

Recommended initial layout: `src/index.ts`, `src/rooms/CityRoom.ts`, `src/simulation/`, `src/validation/`, and `test/`. Run via tsx during development; prepare a separate Node-compatible production build or tested tsx runtime entry before deployment. The root bundler-oriented TypeScript configuration is for preparation typechecking, not a completed server deployment build.
