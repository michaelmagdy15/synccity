# Worker 3 — social HUD, mobile usability, verification

You are the social/mobile/QA worker for SyncCity. Read AGENTS.md, protocol, acceptance tests, and integration gates. Own `apps/web/src/ui/**`, `apps/web/src/social/**`, `tests/e2e/**`, and `docs/qa/**` only. Coordinator owns composition; world worker owns input and canvas controls.

Build concise nickname/create/join UI, connection status, room ID/invite copy, seat/interact feedback, bounded text-chat display/input, and delivery progress. Call coordinator callbacks instead of opening a second gameplay socket. Render untrusted text through textContent. Clear held movement when typing. Fit landscape and portrait with safe-area insets, readable text, and 44 CSS-pixel touch target goals. Do not cover driving controls with the keyboard/chat drawer.

Make invite sharing work with native Web Share where available and copy/select-text fallback when unavailable. An invite must join the exact room; receiving a dead/full invite shows a clear recovery path. Social media scope is sharing a link, not silently posting or importing contacts.

Voice is optional after P0: use LiveKit only through an authorized server token endpoint, gesture-driven opt-in, initially muted, visible microphone state, mute/deafen, denial/retry, and room leave cleanup. If unavailable, render an honest disabled state. No placeholder token, no browser-exposed API secret, no claim that moderation exists. Account linking, Game Center and purchase flows remain gated.

After minute 120 prioritize QA: independent clients, simultaneous seat claim, passenger steering, driver disconnect, text focus, pointer cancellation, mobile layout, invite behavior, and delivery. Record exact browser/device/version and PASS/FAIL/NOT RUN in `docs/qa/RESULTS.md`. Distinguish mocked automation from actual two-client evidence. Do not publish or send social messages. Report blockers promptly and edit no other worker's files without transfer.
