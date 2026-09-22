# Integration scope and readiness

“Full social integration” is a product direction, not a single API. Build small independently testable adapters. The list below defines a concrete path without blocking three-hour gameplay. No providers are connected by this kit.

| Capability | Prototype | Later real integration | Required external setup |
|---|---|---|---|
| Text | Room text, validated and rate-limited, private testers | Block/report, moderation queue, policy and enforcement | Support/moderation owner before public use |
| Invitations | Exact room ID, copy invite; Web Share stretch | Universal Links, app/web fallback, expired invite recovery | Controlled HTTPS domain and iOS association files |
| Voice | Off by default; optional gated party voice | Managed LiveKit, mute/deafen, membership enforcement, abuse controls | LiveKit project, backend credentials, HTTPS, device tests |
| Identity | Connection-bound guest identity | Durable accounts, guest upgrade, secure provider linking | Database, auth provider, session/deletion design |
| Social login | Not required | Sign in with Apple plus explicitly selected providers | Registered provider apps, redirect URLs, verified tokens |
| Social posting | User deliberately shares a link | Optional share cards or provider-authorized publishing | Each provider's allowed API scopes/review |
| Social friends | Same room by invite | Mutual in-game friends and presence | Backend persistence, blocking and invitation permissions |
| Game Center | Native local-auth template only | Verified linking, achievements and server-approved scores | Apple team, App ID capability, App Store Connect configuration |
| Payments | Disabled | StoreKit plus server entitlement ledger | Product IDs, agreements, sandbox, server verification |

## Voice implementation sequence

1. Establish an authenticated game session without adding secrets to replicated state.
2. Backend checks that session's active membership in the target private room; resolve voice room/identity on the backend.
3. Mint short-lived LiveKit grants scoped to that identity/room and microphone permissions, no camera/admin grants.
4. Client joins only after user action, starts muted, offers clear mute/deafen/leave, and handles permission denial.
5. On game leave or kick, remove voice membership through server control; token expiration alone is not live-user removal.
6. Verify two physical devices, interruption/background behavior, cross-room isolation, and expired/forged credentials. Keep voice unavailable until this works.

Use [LiveKit token documentation](https://docs.livekit.io/frontends/reference/tokens-grants/) and the exact selected SDK documentation when implementing. Credentials must stay server-side. “Proximity” volume fading alone does not prevent an unauthorized listener from hearing audio.

## Guest identity progression

For the private local prototype, the authoritative Colyseus connection identifies actions; never accept player IDs in action payloads. A separate HTTP voice endpoint cannot authenticate callers from a body containing that connection ID. Before voice, establish backend-issued short-lived session credentials and check membership against server records. Before persistence, add durable identities and migration/linking rules. Game Center display names and client-provided player IDs are not proof of account ownership.

## Native/social policy references

[Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) cover UGC, payments, login choices and privacy. [Capacitor iOS](https://capacitorjs.com/docs/ios) documents native packaging. These were checked during preparation on 2026-09-23; recheck the exact service/platform requirements before activating a feature or submitting. No “full social integration” badge should appear until each advertised capability works.
