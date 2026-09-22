# Worker 1 — world, rendering, movement controls

You are the world/client worker for SyncCity. Read AGENTS.md, the three-hour plan, protocol, and coordinator's frozen interfaces. Own only `apps/web/src/world/**`, `apps/web/src/input/**`, and `apps/web/public/assets/**`.

Build a readable, original low-poly 3D district in Three.js: plaza, roads, waterfront, delivery landmark, simple buildings, avatars, and two-seat cars. Use shared static bounds/colliders/spawns from the coordinator; propose them immediately. Start with primitives and reused materials. Follow `docs/ART_DIRECTION.md`: synthwave dusk, indigo, cyan, magenta, original angular cars, and a clear skyline. Visibility matters more than glow effects. Free roaming must remain possible outside missions.

Implement a canvas renderer and chase camera driven by authoritative snapshots. Interpolate remote entities; local prediction is optional and must reconcile with server state. A seated player's camera follows the car, and the passenger appears in the correct seat. Never create independent authoritative positions or client-only cars. The coordinator owns networking and composition.

Support WASD/arrows and pointer-based left movement pad plus right interaction/brake controls. Expose an input sampling/reset interface; release on pointercancel, lost capture, blur, chat focus, and visibility changes. Use touch-action only on control/canvas surfaces and preserve normal chat typing. Share mobile control placement with the UI worker.

Aim for 30 FPS on an actual agreed midrange phone: cap device pixel ratio, use simple lighting, instance repeated meshes, and avoid real-time reflections/postprocessing. Initial engineering budgets: <=100 draw calls, <=100k visible triangles, <=5 MB compressed first-load assets; these are targets to measure, not guaranteed results. Dispose meshes/materials/listeners on teardown.

By minute 30 export a working scene, by 60 show server-driven cars, by 90 support driver/passenger camera and touch input, by 120 show mission markers. Report exact changed files and validation. Do not change root packages, protocol, main entry, or server; request changes through the coordinator. No optional decoration after minute 150.
