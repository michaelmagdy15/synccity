# SyncCity — product brainstorm

Status: proposed product direction, not a statement of implemented features. Prepared 2026-09-23. The three-hour milestone is a playable private prototype; public launch is a separate release gate.

## The promise

**Send a link. Meet your friends. Pile into one car. Make a story in five minutes.**

SyncCity is a colorful, retro 3D social driving playground. Players freely roam on foot, enter and exit vehicles, and ride together as driver and passenger. The city is the lobby, the car is the party, and optional short cooperative challenges give friends something to do while hanging out. Its strongest differentiator is useful, funny shared-car play rather than the size of its world. Follow the user's neon synthwave image through `ART_DIRECTION.md`; Grid Drive is a proposed mode subtitle.

Use GTA as a broad reference for city freedom and getting into vehicles, not its assets, map, branding, characters, missions, or adult themes. Use the user-provided [Smash Karts reference](https://www.smashkarts.io/) for a discussion about readable arcade presentation; no assets or implementation are copied. The reference was opened on 2026-09-23, but its interactive gameplay was not evaluated by this research pass.

## Who it serves first

- Friends who already talk together and want an activity requiring little setup.
- Players mixing phones and laptops, joining for 5–15 minutes.
- People who prefer cooperative silliness and self-expression to competitive shooting.

Start private testing with invited adults. Decide supported ages and regions before public testing; cartoon graphics and a self-declared age do not by themselves solve child safety. Do not market the prototype as a children's product.

## Why someone returns

| Player need | Product response | Evidence to collect |
|---|---|---|
| “We want something to do right now” | Room link, quick spawn, friends visible | Time from opening link to seeing friend |
| “I am bad at driving” | Passenger navigation and team rewards | Passenger participation and voluntary role swaps |
| “We want our own hangout” | Recognizable plaza and cosmetic crew identity | Repeat parties across different days |
| “We want a funny moment” | Ramps, harmless bumps, group finish celebration | Unprompted laughter and voluntary shares |
| “We have only five minutes” | A short mission available beside spawn | Mission completion before session exit |

These are hypotheses. Do not call them validated demand or promise a worldwide hit.

## Three nested loops

1. **Moment loop, 10–30 seconds:** move → spot a friend or destination → enter car → accelerate, steer, jump or ping → enjoy a visible response.
2. **Session loop, 3–8 minutes:** assemble crew → pick a contract → reach ordered checkpoints together → receive shared result → swap driver or choose a new route.
3. **Return loop, later releases:** meet familiar friends → try a rotating challenge → earn cosmetic expression → invite someone to the next session.

Avoid an empty open world. Place an obvious cooperative activity within sight of spawn, with no economy or account tutorial in the way.

## First three-hour slice

The coordinator's implementation plan and network contract govern engineering details. This is the product acceptance target, in strict order:

| Priority | Deliverable | Visible acceptance |
|---|---|---|
| P0 | One small 3D city block with plaza, roads, garage and destination | Player understands where to go without external explanation |
| P0 | Keyboard and touch movement/camera | Movement works on a real phone and desktop |
| P0 | One real multiplayer room | Two independent clients see each other's movement |
| P0 | One shared vehicle with driver and passenger seats | Both clients agree who occupies each seat and travel together |
| P0 | Enter and exit vehicles safely | Players can leave stationary cars; server bounds and egress prevent trapping |
| P0 | One cooperative checkpoint delivery | Server judges ordered checkpoints and sends one shared completion |
| P0 | Private room link/code and player labels | Friend joins intended room; wrong/full room produces useful message |
| P0 | Private playtest room text | A recipient receives validated, rate-limited text; public release is gated on moderation |
| P2 | Opt-in party voice behind configuration | Two devices exchange audio with mute and permission-denial recovery |
| P2 | Share action with copy-link fallback | A user can deliberately share a join link |

Voice is a requested feature, but a missing provider credential or mobile audio failure must not derail real shared driving. Leave it visibly unavailable if it cannot be verified; do not simulate it. Persistent friends, social network OAuth, Game Center, purchases, large worlds, traffic, planes, and public discovery are not three-hour acceptance requirements.

## The first five minutes

1. Open an invitation; see a name field, basic controls and **Join crew**.
2. Spawn in the plaza near a friend's marker and the same bright car.
3. Approach the car; the contextual button says **Drive**, **Ride**, or **Full**.
4. Driver starts a delivery. Everyone sees the destination and remaining checkpoints.
5. Passenger follows the ride with a comfortable camera; a simple **Go here** ping is a stretch task.
6. Reach the destination. Both players see the same result and **Again / Swap driver** options.

An empty room must still allow driving practice. Never disguise bots as real players. A dropped connection must show a reconnect state, not silently keep granting rewards locally.

## Shared-car design

### Build now

- Driver controls movement; passengers ride the authoritative vehicle transform.
- Seat assignment is server owned. Simultaneous entry produces exactly one driver.
- Exit places the player beside a safe stationary position, not inside geometry.
- Driver departure stops the car; another player explicitly claims driving. Never surprise-transfer controls.
- A safe reset is a follow-up if needed: it must return the vehicle and occupants together to a validated spot with a cooldown; it is not part of protocol v1.
- Mission success is shared, regardless of who is driving.

### Make passengers fun next

- **Navigator:** ping the next turn or choose between two routes.
- **Photographer:** frame a landmark while the driver keeps the car steady.
- **Courier:** perform a short timing action at delivery stops.
- **DJ:** select from a small library of owned/licensed music or sound cues, with local mute. No streaming-service scraping or unlicensed music rebroadcast.
- **Spotter:** identify scavenger objects that award the entire crew points.

Roles must remain optional and understandable in one sentence. A two-player party should never need four people to start a mission. Do not withhold basic passenger interactivity behind a purchase.

## World and presentation

The first district is **Harbor Loop**: a plaza, garage, rooftop ramp, warehouse stop and waterfront lookout. Reuse the same compact environment for several future modes. Landmarks need distinct silhouettes and colors; map scale is less valuable than useful density.

- Low-poly 3D buildings and toy-like vehicles; original geometry and textures.
- Synthwave dusk, dark violet roads, readable ambient lighting, cyan markers and magenta accents from the supplied visual reference.
- Limited materials, short view distance, fog and simple shadows to protect phone performance.
- Third-person chase camera while driving, with controlled smoothing and reduced-motion option.
- Names readable above players, but never visible through the whole world by default.
- Separate sound, voice and music sliders; mute available without leaving a car.
- Touch controls avoid screen edges and safe-area cutouts; contextual actions reduce button count.
- Direction indicators use shapes as well as color. Critical instructions exist as text, not voice only.

## Mode backlog

| Mode | What friends do | Why it fits | Earliest stage |
|---|---|---|---|
| Crew Courier | Deliver a package through checkpoints | Reuses driving and rewards cooperation | Prototype |
| Sunset Cruise | Explore and meet without a timer | Social downtime between challenges | Closed alpha |
| Convoy Rally | Multiple cars travel a route together | Enables larger friend groups | Closed alpha |
| Photo Safari | Find landmarks and frame crew photos | Passenger role and shareable memories | Beta |
| City Tag | Transfer a harmless tag by reaching another car | Simple competitive rule | Beta |
| Stunt Relay | Take turns clearing controlled jumps | Short mastery loop | Beta |
| Street Festival | Rotate small challenges around a plaza | Scheduled community ritual | After retention proof |
| Rescue Run | Deliver fictional supplies before a timer expires | Cooperative tension without combat | After core polish |
| Air Club | Fly short routes and carry friends between hubs | New traversal fantasy | Expansion |

Keep public and private competition separate when custom room settings affect fairness. Avoid launching many modes that fragment a small player base.

## Social system, concretely defined

“Full social integration” is a roadmap category, not one checkbox.

| Surface | Minimum useful behavior | Dependency / boundary |
|---|---|---|
| Room invitations | Share/copy an expiring join link | No automatic posting or address-book upload |
| Text | Room messages and preset phrases | Server limits, mute, block, report; no stranger DMs initially |
| Voice | Explicitly joined party audio | Microphone permission, permission recovery, mute, leave and member removal |
| Friends | Mutual requests, accept/remove/block, join permissions | Durable identity and privacy settings |
| Presence | Online/in-party status for accepted friends | Invisible status and no precise real-world location |
| Crew | Named friend group and shared cosmetics | Moderation for names and invitations |
| External shares | OS share sheet, card or clip created on request | Each destination controls supported formats; no universal posting API promised |
| External identities | Optional provider linking only where useful | Provider review, current scopes and secure account linking |
| Game Center | Apple achievements and leaderboards; optional invitations | Native GameKit bridge and Apple configuration; web players still use SyncCity identity |

Apple documents Game Center identity, friends, leaderboards, achievements and matchmaking. Treat it as an Apple platform integration, not the cross-platform world server. [Apple Game Center overview](https://developer.apple.com/game-center/) (checked 2026-09-23).

## Safety designed into the experience

- Prototype rooms are invite-only. Public matchmaking is a later feature with its own staffing and abuse gate.
- Party voice starts off; joining a room never silently activates a microphone.
- Keep mute, block and report reachable from player names and the pause screen. Block must also prevent future direct invitations/contact.
- Report UI explains what evidence is sent and supplies a confirmation. Reports need an owned review queue and response process before public release.
- Do not store raw voice by default. Any later recording or transcription requires an explicit retention/access design and an appropriate consent/legal review.
- Filter text and names, rate-limit spam and keep enough scoped evidence to investigate reports under a documented retention policy.
- Underage access needs an explicit product policy and region-specific review. Plan restrictive communication defaults; do not infer parental consent from a checkbox.
- No exact real-world location, public personal profile fields, unrestricted media uploads or stranger DMs in the first release.

Apple requires filtering, reporting, blocking and published contact information for UGC services, and identifies random/anonymous-chat experiences as inappropriate for the App Store. These requirements are release constraints, not a guarantee that a particular implementation will pass review. [App Review Guidelines §1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content) (checked 2026-09-23).

## Product decisions to defer, deliberately

Do not spend the three-hour window choosing an entire fictional economy, importing a huge city, writing extensive lore, creating a battle pass, building a social feed, or generating dozens of vehicles. Preserve extension points in data, but implement the smallest complete shared experience first.

The next product decision depends on a playtest: if people enjoy riding together, improve passenger roles; if nobody invites friends, improve invitation and first-session flow before adding content; if performance is poor, reduce scene complexity before expanding the map.
