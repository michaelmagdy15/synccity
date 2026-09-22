# Acceptance and release evidence

Status values are PASS, FAIL, and NOT RUN. Every result needs a command/log or manual observation with browser/device details. The preparation kit has not run gameplay tests because the game is not implemented yet.

## P0 private prototype gate

| ID | Test | Expected observation |
|---|---|---|
| P01 | Clean install, typecheck, production build | All exit zero using lockfile; no missing assets |
| P02 | Create in A; join same exact room from independent B | Both see each other, same room ID and independent controls |
| P03 | Walk opposite directions, turn and stop | Both perspectives converge; held input stops when released |
| P04 | A drives, B enters passenger seat | Both move together; B cannot steer; seat/avatar/camera agree |
| P05 | A/B request same empty seat at once; repeat requests | Exactly one success and one occupied result, no duplicate seats |
| P06 | Exit beside wall/car and re-enter | Safe non-overlapping placement; seat released; repeatable |
| P07 | Driver loses connection / closes tab | Server brakes/stops, releases ownership according to protocol; no runaway car |
| P08 | Reconnect or refresh; stale packet replay | Documented new/resumed identity behavior; no ghost or duplicated player |
| P09 | Send chat, blank, oversized, rapid messages, HTML payload | Valid chat delivered; invalid/rate-limited requests handled; HTML is text |
| P10 | Touch acceleration/steer/enter/exit; pointercancel/blur | Usable control placement and no stuck movement |
| P11 | Focus chat while holding movement, open software keyboard | Controls reset; typing does not move avatar; input remains visible |
| P12 | Driver/passenger finish cooperative delivery | Same completion displayed to both; cannot complete twice by duplicate packet |
| P13 | Join nonexistent/full room, drop network | Explicit error/disconnected state and usable retry |
| P14 | Invalid numeric values, out-of-order seq, excessive input | Server rejects/clamps per contract; bounded speed and no crash |
| P15 | 10-minute two-client soak with repeated seats and chat | No unbounded history growth, accumulating listeners, or duplicated entities |

Run P02–P12 in independent sessions, not two local avatars controlled in one simulation. Ideally use a second physical device on the same server. For remote readiness repeat over HTTPS/WSS on different networks. Test approximately 100–150 ms latency and modest packet loss if tooling permits; record how network conditions were produced.

## Performance targets, initially unverified

Choose and name one reference phone and one laptop. Record browser version, viewport, player count, scene, measured FPS, first interactive load time and transferred bytes. Target sustained 30 FPS on the phone, 60 FPS on laptop, and interactive in under 5 seconds on a named tested network. Cap pixel ratio and degrade effects before dropping gameplay update correctness. Test thermal behavior for at least ten minutes; a single FPS screenshot is insufficient.

## Optional voice gate

Two real devices join one authorized party; both initially muted. User explicitly enables microphone; denial does not break gameplay. Check mute, deafen, leave, reconnect, headset/echo behavior, background suspend, and expired token. A third room must not hear or join the first. Test that client-chosen identities/rooms and expired gameplay sessions cannot obtain a voice token. No credentials means NOT RUN and voice remains off.

## Native and public release gates

- Generate iOS project on the documented Mac toolchain; compile, sign, and run on device. Test microphone permission, deny/retry, safe areas, suspension, deep links, and web build parity.
- Exercise Game Center authenticated, cancelled, unavailable, and signed-out paths in the configured environment. Server identity and rewards must not trust client claims.
- Before public chat/voice: working report/block/mute, abuse triage ownership, retention/deletion policy, rate limiting, privacy policy, age-rating review, and support contact. Run an actual report through triage.
- Before accounts: provider token validation, secure account linking, session expiry, account deletion, guest upgrade without losing identity, recovery handling.
- Before purchases: sandbox purchase/cancel/pending/refund/restore, server verification and idempotent entitlements, storefront-specific compliance review. Do not enable a pretend store.
- Before larger launch: measured concurrent room load, rolling deploy/reconnect behavior, region/latency strategy, observability, cost alerts, incident runbook, and recovery of persisted data.

These later gates are not included in a three-hour implementation promise.
