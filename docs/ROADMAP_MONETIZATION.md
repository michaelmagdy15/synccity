# SyncCity — roadmap, growth and monetization

Prepared 2026-09-23. Dates below are planning ranges, not delivery or revenue promises. Advance when the gate passes, not simply when time expires. All numbers labeled “target” are proposed internal targets, not industry benchmarks.

## Stage 0: three-hour private prototype

**Outcome:** two friends on separate clients can meet, enter the same car and finish one short cooperative route.

Deliver original low-poly city geometry, free roaming on foot, entering/exiting vehicles, touch/keyboard controls, real room networking, server-owned seating, private room text, one optional mission and honest connection states. Configured party voice is a stretch after these work. Prepare iOS source/configuration and Mac handoff instructions; producing signed, tested iOS distribution is a separate step requiring the appropriate Apple environment and account configuration.

**Gate:** run the complete two-client scenario; race two players for the driver seat; disconnect the driver; finish a mission; test a real mobile browser; record exactly what passed and what remains unavailable. A development scaffold is not an App Store release.

## Stage 1: closed alpha — proposed next 1–2 weeks

**Goal:** learn whether friends choose a second session.

- Fix driving feel, camera, onboarding and reconnect behavior from observed playtests.
- Add durable identity, mutual friends, private invitations and initial garage cosmetics.
- Make passengers active with one low-complexity role; add convoy rally only when courier works.
- Complete configured party voice, permissions, device audio interruptions, blocking and abuse workflows.
- Establish structured errors, server metrics, crash reporting, feature flags and emergency kill switches.
- Run iOS on-device profiling and native bridge tests; prepare an internal TestFlight build when prerequisites are available.
- Recruit approximately 10–20 invited adult friend groups, not isolated random testers.

**Gate:** most observed groups can join and complete a mission without coaching; no unresolved duplication, seat ownership or reconnect bugs; moderation has an owner. Target a five-minute successful core session before cosmetic scope expansion.

## Stage 2: regional beta — proposed following 2–4 weeks

**Goal:** demonstrate reliable sessions and repeat group play in a limited region.

- Add age/communication policies appropriate to launch markets; review privacy, consent, account deletion and support flows.
- Add invitation/deep-link recovery, friend presence, accessibility improvements and localization foundations.
- Integrate Game Center achievements and a small number of server-validated leaderboard categories on iOS.
- Verify mobile audio interruptions, background/resume, poor connectivity and thermal performance.
- Add one alternate mode, reporting operations and bounded public discovery only if safety readiness permits.
- Measure infrastructure cost per active user-hour, including voice, moderation and support.

**Gate:** device matrix and network impairment checks pass; block/report flows work end to end; operational response is staffed; enough returning groups exist to justify live-service costs. No paid acquisition while sessions routinely fail.

## Stage 3: soft launch — only after retention and operations gates

**Goal:** prove a sustainable product before attempting broad distribution.

- Release in a manageable set of regions with adequate language support and service coverage.
- Launch a small cosmetic catalog with verified entitlements, restore/reconciliation and refund handling.
- Add moderated crew identity, opt-in share cards and a regular event using existing content.
- Test store screenshots and onboarding against actual shipped behavior.
- Add regions through measured latency, cost and operational capacity, rather than assuming one server location serves the world.

**Gate:** retention cohorts stabilize, crash/session metrics meet chosen targets, purchases reconcile, and contribution margin has a plausible positive path. A popular launch is possible but cannot be guaranteed by features, automation or marketing.

## Stage 4: expansion — demand-led

Expand a district, add more cooperative roles, support community-hosted events with moderation, and evaluate creator tools only after enough players already enjoy the core game. Planes come after vehicle networking and ground-world performance are stable.

### Planes: preparation without premature implementation

- Model a vehicle category and seat manifest so later vehicles need not reuse car-only assumptions.
- Keep transport type independent of identity, party membership and mission eligibility.
- Add altitude, flight envelope, airspace boundaries, landing validation and recovery rules in a dedicated flight design.
- Benchmark larger visibility ranges and interest management before building a larger aerial world.
- Start with a small separate Air Club activity; do not immediately promise seamless continent-sized flight.
- First aircraft mission: pilot and navigator carry a crew between two marked landing pads; cooperative checkpoint validation reuses the mission concepts.

## Monetization principle

**Sell identity and expression after the game proves it is fun for free.** The invitation loop is the business's foundation: charging a friend to sit in a car would damage that loop.

Keep driving performance, passenger seats, communication safety controls, matchmaking quality and core missions equal for paying and non-paying players. Never sell protection from harassment or priority access to basic moderation.

## Proposed catalog

The following USD amounts are hypothetical research starting points, not configured StoreKit prices or financial forecasts. Validate purchasing power, store price points, taxes and localization before launch.

| Offer | Example contents | Experimental price idea | Stage |
|---|---|---|---|
| Individual cosmetic | Original vehicle paint or horn sound with local mute | $0.99–$2.99 | Soft launch |
| Crew style pack | Coordinated outfits, decals and photo pose | $4.99–$7.99 | Soft launch |
| Supporter pack | A clearly listed one-time cosmetic bundle | $4.99 | Soft launch |
| District style collection | Several cosmetics themed to an event | $7.99–$12.99 | After catalog demand |
| Season cosmetic track | Optional challenges awarding disclosed cosmetics | Test only after a sustainable content cadence | Later |

Favor direct purchases of clearly described items first. Delay premium currencies until there is a real usability need; display understandable real-money value if introduced. No paid randomized rewards, paid stat advantages, manipulative countdowns, punitive streaks or intentionally confusing bundles. Avoid subscriptions until the service offers clear recurring value and can sustain it.

Earnable cosmetic progression should provide an attractive free path. Earned rewards require server verification and must not make play feel like compulsory daily labor. Cosmetic ownership never grants permission to spam effects or overpower visual readability.

## Payment architecture requirements

- Use a store abstraction, but implement and test each actual purchase provider separately.
- For iOS digital goods, plan StoreKit IAP as the default route; storefront-specific alternatives require a separate current policy review, not a blanket external-checkout assumption. [Apple App Review Guidelines §3.1](https://developer.apple.com/app-store/review/guidelines/#payments) (checked 2026-09-23).
- Maintain a server-side entitlement ledger keyed to verified transaction identity, with idempotent fulfillment and auditable state changes.
- Handle pending, cancelled, failed, restored and refunded/revoked purchases. A client “success” message must not mint inventory by itself.
- Associate platform transactions with SyncCity accounts carefully; account linking must prevent theft and duplicate grants.
- Test sandbox purchases, interrupted flows, restore on another device and support recovery before charging anyone.
- Decide cross-platform ownership rules and paid-currency restrictions explicitly before enabling web purchases. Never assume Apple receipts or Game Center automatically become a universal wallet.

[Apple StoreKit in-app purchase documentation](https://developer.apple.com/documentation/storekit/in-app-purchase) is the starting implementation reference (checked 2026-09-23). No real product IDs, payment credentials or revenue integrations are created by this planning document.

## Unit economics to track before scaling

Do not equate gross sales with profit. Use observed values in a simple monthly model:

```text
Gross sales = monthly active users × payer conversion × average gross monthly spend per payer
Net receipts = gross sales − platform/payment deductions − refunds − applicable tax adjustments
Contribution = net receipts − game servers − voice − storage/egress − moderation/support − acquisition
```

Example only: 10,000 MAU × 2% payers × $5 spend = $1,000 gross monthly sales before every deduction above. This is arithmetic illustrating sensitivity, not a projection. Voice and moderation costs can dominate a small social game; measure costs by player-hour and party size before subsidizing global acquisition. Obtain current provider quotes rather than hardcoding a universal store fee.

## Metrics and instrumentation

Never log private message bodies or raw voice in ordinary analytics. Use pseudonymous identifiers with purpose-limited retention and access controls.

| Metric | Definition | Decision it informs |
|---|---|---|
| First friend seen | Time from accepted invitation to rendering an actual friend | Join-flow friction |
| Shared ride activation | Invited sessions where two humans occupy one car | Whether the distinctive feature is reached |
| Cooperative completion | Activated sessions completing a shared mission | Whether onboarding and challenge work |
| Passenger engagement | Passenger sessions using a role/ping or choosing another ride | Whether passengers have meaningful agency |
| Group return | Same friend pair returning on another day | Whether the social loop has value |
| Invitation conversion | Accepted invites resulting in real joins | Whether sharing creates active groups |
| Session health | Disconnects, join failures, frame-time percentiles and crashes | Technical readiness |
| Safety burden | Reports, blocked users, time to triage and repeated abuse | Moderation staffing and feature risk |
| Cost per player-hour | Infrastructure plus voice cost divided by active hours | Scaling viability |
| Purchase quality | Successful fulfillment, restores, refunds and support issues | Monetization reliability |

Proposed initial technical target: sustain 30 FPS on the selected lower-end test phone with the target room population. Record the actual phone, browser, room size and measured results; do not report the target as achieved. Choose retention thresholds after initial cohorts rather than manufacturing a benchmark.

## Growth experiments

1. **Friend-pair playtests:** watch five pairs join and ride without instruction. Fix the largest failure before acquiring more testers.
2. **One-session hook:** compare a direct “Join my car” invitation with a generic home-page link. Measure successful shared rides, not clicks alone.
3. **Photo finish:** create an optional end-of-mission share card with fictional avatars and a join link. Never post without the player's action; exclude private chat and real personal details.
4. **Creator convoy:** later invite a small creator to host an approved private session. Evaluate repeat parties, safety workload and new-player experience, not just impressions.
5. **Localized soft launch:** validate UI, slang moderation, networking and support in each market before expansion.

Do not require social posting to claim rewards, fabricate user counts or promise top charts. Verify name/trademark and domain availability before major branding investment; this plan has not performed a clearance search.

## Public release checklist

- Product claims match implemented, device-tested features; screenshots show actual gameplay.
- Backend, support channels and moderation operations are live and staffed.
- Privacy disclosures reflect real analytics, chat, voice, authentication and payment behavior.
- Applicable age ratings, regional obligations and account controls are reviewed for the chosen audience.
- Purchases work through their real provider, including recovery; no placeholder catalog is advertised as live.
- Assets, music, brand marks and dependencies have recorded provenance and licenses.
- The team can disable abusive communication surfaces and roll back broken server releases.
- Reviewers can access the full experience using documented credentials or an approved applicable alternative.

Apple distinguishes beta distribution from App Store submission and expects complete, tested apps and review access; use TestFlight when the build is still a beta. [App Review Guidelines §2.1–2.2](https://developer.apple.com/app-store/review/guidelines/#performance) (checked 2026-09-23). This checklist is a product gate, not legal advice or assurance of approval.
