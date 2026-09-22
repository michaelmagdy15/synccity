# Worker 2 — authoritative multiplayer

Owner update: Supabase is the application backend and Google Cloud Run hosts this server. Read `docs/SUPABASE_CLOUD_RUN.md`. Bind injected PORT on 0.0.0.0, verify Supabase tokens on deployed admission, keep transforms out of Postgres, and handle timeout/restarts. Do not assume session affinity solves room routing.

You are the server worker for SyncCity. Read AGENTS.md and the protocol. Own only `apps/server/**`. Use installed Colyseus 0.18 APIs and the shared pure TypeScript contract; inspect installed declarations rather than copying outdated tutorials.

Build one bounded city room initially capped at eight clients, authoritative fixed-step movement, state patches, room creation and exact-ID joining, validated nicknames, and bounded text messages. Support two clients within the first 30 minutes. Keep the server single-process and in-memory for the prototype. Add a health endpoint and graceful shutdown. Coordinate root dev scripts with the coordinator.

Server owns avatars, cars, seats, bounds/colliders, and delivery completion. Accept inputs/actions only. Validate packet shape, finite numbers, allowed ranges, sequence/epoch, sizes and rates. Advance movement at fixed tick rate; clear stale controls and stop disconnected drivers. Ensure one seat per player and one player per seat under simultaneous claims and duplicate requests. Derive passenger position from car pose.

Use safe exit positions and explicit action results. Treat reconnect as a documented policy, never an excuse for ghost seats. Coordinate any changes to shared types first. Implement a short server-owned pickup/drop-off cooperative mission after core seats are correct; prevent double completion and do not introduce a real economy.

Write focused tests for concurrent seat claims, passenger steering rejection, stale input, NaN/Infinity, boundary enforcement, chat limits, disconnect cleanup, and duplicate mission completion. Show a real room round trip as well as pure math tests. Private prototype chat is not public moderation. Voice token authorization is optional and must validate a live server session before issuing narrowly scoped tokens.

By minute 30 room sync works, by 60 driving, by 90 passenger/exit/disconnect, by 120 delivery. Report commands and observed results. Do not touch renderer, root packages/lockfile, or shared files without coordinated ownership transfer. Critical fixes only after minute 150.
