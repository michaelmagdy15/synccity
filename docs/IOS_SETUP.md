# SyncCity iOS setup and release gates

## Deliverable status

This repository supplies Capacitor configuration, native Swift source templates, microphone and orientation configuration, a Game Center entitlement template, and an intentionally incomplete privacy manifest. No Xcode project has been generated or compiled on this Windows host. No app is signed, uploaded, or App Store approved. The three-hour deliverable is a web multiplayer prototype plus an iOS handoff; a physical-device build is a separate gate requiring macOS and Apple configuration.

## Supported baseline

Use matching Capacitor 8 packages and commit the resolved lockfile. Capacitor 8 requires Node 22+, Xcode 26+, and iOS 15+; new iOS projects use Swift Package Manager by default. Confirm the selected Xcode version runs on your Mac. Source: [Capacitor 8 upgrade guide](https://capacitorjs.com/docs/updating/8-0).

Capacitor 8.5 introduces the scene lifecycle used by its new iOS template. Keep the generated scene delegate and forwarding hooks; Xcode 27 requires the scene lifecycle. Source: [Capacitor 8.5 guide](https://capacitorjs.com/docs/updating/8-5).

From the repository root on a Mac:

```sh
npm install
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

Run `cap add ios` only once. For subsequent client changes, rebuild then sync. If Capacitor dependencies are absent, install `@capacitor/core@8` and `@capacitor/ios@8` as dependencies and `@capacitor/cli@8` as a development dependency first. Use `npm ci` instead of `npm install` when a tested lockfile is present. Verify the root config uses `webDir: 'dist'`, app name `SyncCity`, and the provisional identifier `com.synccity.game`. Replace that identifier with one your team controls before creating the Apple App ID.

In Xcode, select a development team and a supported simulator or connected iPhone. Commit the generated native project and SPM resolution file, excluding build products, user settings, certificates, and provisioning profiles. Windows can edit Swift and configuration; compiling and signing iOS needs Apple's toolchain.

## Integrate Game Center

1. Add all three `ios-template/native/*.swift` files to the generated App target, with target membership enabled. They use the default Swift language settings of the Capacitor template; if you enable stricter Swift concurrency checking, resolve diagnostics rather than suppressing them globally.
2. For the Capacitor 8.5 template, edit the generated `SceneDelegate.swift` so `window?.rootViewController = SyncCityViewController()` replaces construction of `CAPBridgeViewController()`. Preserve scene setup, URL handling, and all `SceneDelegateProxy` forwarding calls. For an older storyboard-based template only, set the bridge controller custom class in `Main.storyboard` to `SyncCityViewController`, module `App` (or your actual target module). Verify which controller is instantiated; setting a storyboard class alone does not register this plugin when the scene delegate builds its own controller.
3. Enable Game Center in Signing & Capabilities and in the registered App ID. Compare generated entitlements with `ios-template/SyncCity.entitlements.template`; do not overwrite other entitlements. Configure Game Center in App Store Connect for the matching bundle ID.
4. Copy `ios-template/web/gameCenter.ts` into the client platform adapters. Feature-detect before calling it. Bind `authenticate()` to an explicit Game Center sign-in button, show cancellation/error states, and remove event listeners when their UI is destroyed.
5. Test local authentication on a signed physical device. Test cancellation, declined login, repeated taps, account changes, and returning from background. Poll `getStatus()` when the app resumes. A failed Game Center login must not prevent browser or guest gameplay.

The bridge supplies local identity display only. `gamePlayerId` received from JavaScript is untrusted. Before linking a backend account, implement Apple's identity verification signature flow and server verification with replay protection; never link accounts from an arbitrary player ID. Game Center does not replace cross-platform sessions, room authorization, or your multiplayer server. Leaderboard and achievement adapters are future work and should accept only server-approved results.

Sources: [Capacitor custom native code](https://capacitorjs.com/docs/ios/custom-code), [Apple player authentication](https://developer.apple.com/documentation/gamekit/authenticating-a-player).

## Voice and network behavior

Merge the `Info.plist.fragment` keys into the generated plist. Phone gameplay starts in landscape; iPad keeps all orientations for multitasking, so the game layout must adapt. The microphone description is permission copy, not a voice implementation. Request audio only when a player explicitly joins voice; start muted, show a persistent microphone state, and offer leave, mute, block, and report controls.

Prefer an authenticated party voice room. Obtain short-lived voice tokens from your server after checking room membership. Keep voice service secrets out of the client and Capacitor configuration. Verify WebRTC microphone capture on physical iOS devices before claiming compatibility; if the selected web SDK fails inside WKWebView, use its maintained native iOS SDK behind a plugin and keep voice disabled until tested. Do not bolt on custom mesh voice to save setup time.

Ship bundled web assets without a development `server.url`. Use HTTPS/WSS production endpoints and valid certificates. Configure backend CORS for the actual Capacitor origin (typically `capacitor://localhost`) plus approved web origins; never blindly allow every origin with credentials. A physical phone's `localhost` is the phone itself. Local LAN development requires separate configuration and may require local-network permission; do not add broad App Transport Security exceptions to release builds.

Test permission denied, one-time permission changes in Settings, Bluetooth headphones, speaker/earpiece routing, interruptions, app background/foreground, mobile network switching, and leaving a room. Stop microphone tracks and release voice tokens on exit; mute or disconnect when backgrounded. Background audio is out of prototype scope. Do not record voice by default.

## Privacy and store readiness

The privacy manifest template deliberately omits claims. Before naming it `PrivacyInfo.xcprivacy`, inventory your exact SDK versions, required-reason API calls, data collection, tracking, and domains. Include the final file in the App target and inspect Xcode's privacy report. Microphone permission, the privacy manifest, and App Store privacy labels are separate requirements. Do not copy a blanket "no data collected" statement into a multiplayer chat product. Sources: [Apple privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files), [Capacitor privacy manifest guide](https://capacitorjs.com/docs/ios/privacy-manifest).

Release checklist:

- Publish an accurate privacy policy, terms, support contact, and moderation rules. Map account IDs, chat, reports, diagnostics, purchases, and voice-provider processing to retention and deletion rules.
- Before public user communication, implement filtering, user reporting, blocking, and an operated response process. Position the product around gameplay with known parties; do not launch anonymous random-chat matchmaking.
- If creating accounts, include in-app account deletion and its backend implementation, including guest-account data where applicable. If using Sign in with Apple, revoke its tokens during deletion. Test the deletion flow end to end. [Apple account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app).
- If adding third-party social authentication, satisfy Apple's equivalent-login requirements; Sign in with Apple is the planned option. Game Center login is not a general substitute. Keep social sharing and optional sign-in separate.
- Use StoreKit in-app purchase for planned iOS digital goods by default. Do not add external checkout links without verifying applicable storefront rules and entitlement eligibility. Test purchase cancellation, pending transactions, restore, refunds/revocations, and idempotent server entitlement grants. Never trust a client purchase-success callback to mint currency.
- Complete accurate age ratings, safety access controls, screenshots, original licensed assets, accessibility labels, review notes, and review access. Recheck the current guidelines at submission. These gates derive from [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) sections 1.2, 3.1.1, 4.8, and 5.1.1.

## Native acceptance evidence

Record device model, iOS/Xcode/Capacitor versions, git revision, build result, and a short gameplay capture. Pass touch control/safe-area checks, two-device multiplayer, ten-minute memory/thermal testing, microphone-denial recovery, authenticated party voice on/off, Game Center cancellation, and network reconnect. Confirm 30 FPS on the chosen minimum test device under target room load. A simulator pass alone does not establish microphone, rendering performance, or signing readiness.

After these gates, archive through Xcode, validate, and distribute to TestFlight using the owner's Apple Developer account. App Store review timing and approval cannot be guaranteed inside the three-hour build sprint.
