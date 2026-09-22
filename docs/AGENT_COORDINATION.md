# Parallel agent execution and ownership

Use one coordinator plus three workers. This matches four available concurrency slots. Additional workers do not help if everyone edits the client entry point or lockfile. File ownership below applies to the implementation sprint; the preparation agents have separate document ownership and finish before that sprint starts.

| Role | Owned paths | Required outputs | Cannot edit without coordinator |
|---|---|---|---|
| Coordinator | root configs/manifests/lockfile, `apps/web/src/main.ts`, `apps/web/src/network/**`, `packages/shared/**`, merged status/handoff | boot scripts, authoritative client adapter, composed game, reviewed build | Worker-owned modules |
| World/client | `apps/web/src/world/**`, `apps/web/src/input/**`, `apps/web/public/assets/**` | city renderer, camera, avatar/car presentation, keyboard and pointer controls | main entry, HUD, protocol, packages |
| Multiplayer | `apps/server/**` | room state, validation, simulation, seats, chat, delivery logic, invariant tests | shared contract, client, packages |
| Social/mobile/QA | `apps/web/src/ui/**`, `apps/web/src/social/**`, `tests/e2e/**`, `docs/qa/**` | HUD, text UI, invites, mobile checks, optional voice adapter | main entry, gameplay server, protocol, root packages |

Coordinator owns native template integration after P0 or delegates it to worker 3 only after explicitly transferring those files. No two agents install packages or generate iOS at the same time.

## Shared integration interfaces to freeze in minutes 0–15

The coordinator creates the small interfaces workers use. These are proposed shapes, not an already implemented API:

```ts
// world adapter: no room ownership and no DOM HUD ownership
createWorld(canvas): { update(snapshot, localPlayerId, deltaSeconds): void;
  resize(width, height, pixelRatio): void; dispose(): void }
// input adapter: coordinator samples at network input cadence
createInput(surface): { sample(): InputAxes; reset(): void; dispose(): void }
// HUD adapter: callbacks dispatch through coordinator's network layer
createHUD(root, actions): { update(viewModel): void; dispose(): void }
```

Use `protocol.ts` for message payloads, positions, and snapshots. World worker defines a shared static map proposal; coordinator places bounds/colliders/spawns in `packages/shared/src/world.ts` for renderer and server to consume. Rendering and physics must agree on units, heading convention, seat offsets, and bounding boxes. Do not independently invent two city layouts.

## Coordinator loop

1. Inspect baseline and lock packages once. Write initial status and deadline.
2. Freeze contract and module exports. Send each prompt with exact directories and milestone.
3. Integrate a real snapshot into the renderer by minute 30. Avoid separate demos that meet only at the end.
4. Every checkpoint collect worker evidence, inspect changes, run typecheck/build, then run the highest-risk behavior. Keep a short decision log.
5. For a contract change, announce version and reason, edit the shared file, notify both consumers, and verify together. Do not accept silently divergent packet names.
6. At minute 120 move available effort to QA. At minute 150 stop feature work.
7. Run final evidence gates and write one authoritative handoff.

Worker reporting template:

```text
Milestone / status:
Files changed:
Public exports and contract version:
Commands executed and actual result:
Behavior demonstrated:
Blockers / requested decision:
Remaining work and estimate:
```

## Contention and blockers

On overlapping edits, stop the conflicting change, inspect current contents, and have one owner reconcile. Never reset or overwrite the other worker. On dependency needs, request package plus purpose; coordinator installs once. On inaccessible providers, implement a disabled capability and continue P0. On unknown API behavior, inspect installed types and official docs before generating speculative code.

If parallel tools are absent, follow the same ownership modules sequentially. If worker tooling fails, coordinator inherits its work rather than waiting indefinitely. Workers should not spawn further workers during the four-slot sprint.
