# Owner-selected backend: Supabase + Google Cloud Run

Decision recorded 2026-09-23: use Supabase for the application backend and Google Cloud Run for the authoritative Colyseus server. This supersedes generic database/hosting suggestions elsewhere. No services have been provisioned by the preparation agent.

## Responsibilities

| Layer | Technology | Responsibility |
|---|---|---|
| Client | Three.js + Capacitor | Rendering, controls, local presentation |
| Live game | Colyseus Node on Cloud Run | Authoritative movement, seats, collision, mission progress |
| Identity | Supabase Auth | Verified guest/account sessions and later provider linking |
| Durable data | Supabase Postgres | Profiles, friendships, blocks, reports, entitlements |
| Assets | Supabase Storage | Approved assets with bucket policies when needed |
| Voice | Optional LiveKit | Audio transport authorized by the game server |

Do not write transforms to Supabase at 20 Hz or use client-authored Realtime messages as gameplay authority. Live rooms stay in server memory. Supabase Realtime may later serve friend presence and database-change notifications.

## Implementation order

First establish two local clients and correct driver/passenger behavior. If Supabase credentials are available, implement anonymous Auth sessions and server-side access-token verification. Otherwise an explicitly local guest mode can unblock testing; deployed configuration must fail closed rather than silently bypass authentication. Pin the verified Supabase SDK version through the coordinator and lockfile when the adapter is implemented.

Prepare a server container only after a real server entry/start command exists. Bind `0.0.0.0` using the injected `PORT`, add health/readiness routes, handle SIGTERM, and avoid persistent local disk assumptions. Choose a Cloud Run region near the Supabase project and initial testers. Frontend static hosting is separate; Capacitor bundles the web assets.

## Cloud Run playtest and scaling gate

Cloud Run supports WebSockets but applies request timeouts: five minutes by default and up to 60 minutes. Set the intended timeout and implement reconnect. Affinity is best effort, so matchmaking and subsequent sockets can reach different instances. Do not enable end-to-end HTTP/2 for this setup. [Google WebSocket guidance](https://cloud.google.com/run/docs/triggering/websockets) (checked 2026-09-23).

Proposed private-test settings: one minimum and one maximum instance, one Node process, 60-minute timeout, concurrency 32, and instance-based billing for reliable timer execution. These are starting assumptions to approve and measure, not capacity guarantees. Concurrency counts HTTP requests/WebSockets rather than room players; retain eight players per room and headroom for join/health calls. [Cloud Run billing settings](https://cloud.google.com/run/docs/configuring/billing-settings).

One instance does not guarantee permanence: restarts/deployments replace in-memory rooms and transitions may overlap. Avoid traffic splitting for the playtest. Explain lost-room recovery honestly. Before multi-instance launch, prove routing from reservations and reconnects to each room's owning process, plus shared matchmaking/presence. Redis alone does not provide Cloud Run instance addressing or distribute physics. Supabase persistence does not solve room routing. Block scaling until the routing design is tested.

## Auth, secrets and database access

Client configuration contains Supabase URL and publishable key only. Server verifies the real access token through supported Supabase Auth verification, checking expiry and project identity; derive user ID from verified claims, never a body field or merely decoded JWT. A connection ID alone cannot authorize the HTTP voice-token endpoint.

Anonymous sign-ins create authenticated users and consume resources. Configure abuse protection, guest cleanup and linking policies. Do not promise recovery if a guest loses their session. [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous).

Keep privileged Supabase secret/service-role keys and LiveKit secrets in backend secret storage, such as Secret Manager. Never expose them through VITE variables, native assets, logs or Git. Public publishable keys rely on policy enforcement, not secrecy.

Proposed migrations after core connectivity:

| Table | Key/purpose | Access rule |
|---|---|---|
| profiles | Auth user ID; name and avatar color | Own safe fields writable; explicitly selected public fields readable |
| friendships | Unique user pair and request status | Participants only; recipient accepts |
| blocks | Unique blocker/blocked pair | Blocker controls; enforce on invitations server-side |
| reports | Reporter, subject, scoped evidence | Scoped insert; investigation reads restricted to moderators |
| entitlements | User/product/verified transaction | Backend-only fulfillment; owner reads |
| mission_results | Unique authoritative event ID | Idempotent server writes |

Use versioned SQL migrations under `supabase/migrations/`, enable RLS on exposed tables, and test two users plus unauthenticated callers. Anonymous Auth users use the authenticated role; distinguish them deliberately where necessary. Privileged server keys can bypass RLS, so backend endpoints must enforce ownership themselves. [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Evidence before deployment completion

Two devices share the deployed room; expired/forged tokens fail; cross-user writes fail; no server secrets appear in the browser bundle; timeout and process replacement have tested recovery; health/SIGTERM work; load and cost assumptions are recorded. Public network reachability must still enforce application authentication, private invites and rate limits. This infrastructure choice is not authorization to buy services or publish a deployment.
