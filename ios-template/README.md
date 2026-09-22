# SyncCity iOS source kit

These are integration sources and configuration templates, not a generated Xcode project, signed application, tested native build, or App Store submission. Follow [the setup guide](../docs/IOS_SETUP.md) on macOS after the web client builds. Keep these source templates in version control. Generated native application files belong in the root `ios/` directory created by Capacitor.

`native/` implements local Game Center sign-in and status. `web/gameCenter.ts` is the matching typed bridge. Gameplay identity verification, leaderboards, achievements, purchases, native sharing, and voice integration remain implementation tasks.
