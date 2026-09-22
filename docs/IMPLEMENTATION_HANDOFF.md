# SyncCity — Implementation Handoff

Completed: 2026-09-23. Authoritative P0 vertical slice delivered within the 180-minute sprint budget.

---

## 1. Setup, Start, and Build Commands

### Prerequisites
- Node.js `24.16.0` (or Node `>=24.0.0 <25`)
- npm (using committed `package-lock.json`)

### Development & Execution
```powershell
# 1. Typecheck all workspaces
npm run typecheck

# 2. Run automated server invariant & simulation tests
npm run test

# 3. Build web client production bundle
npm run build

# 4. Start authoritative game server (listens on http://0.0.0.0:2567)
npm run server:dev

# 5. Start Vite web client dev server (in a separate terminal)
npm run dev
# Web app runs at http://localhost:5173
```

---

## 2. Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `2567` | Port for the Colyseus game server & HTTP `/health` endpoint |
| `VITE_SERVER_URL` | *(auto-detected)* | Optional override for remote authoritative server WebSocket URL |

*No secrets are stored in client bundles, Git, or environment variables.*

---

## 3. Exact Working User Journey

1. **Join / Lobby Screen:**
   - Open `http://localhost:5173` (or share invite link `http://localhost:5173/?room=<ROOM_ID>`).
   - Enter your nickname (defaults to a cool synthwave rider handle).
   - Click **Create Private Room** or enter an existing Room Code and click **Join Room**.
2. **Plaza Spawn & Free Walking:**
   - Both clients spawn in the central plaza facing the neon skyline.
   - Use `WASD` or Arrow keys (or touch virtual joystick on mobile) to roam on foot.
   - 20 Hz server-authoritative kinematics smoothly slides characters around building colliders.
3. **Boarding the Same Car (Driver & Passenger):**
   - Approach any of the 4 parked retro coupe cars parked around the plaza.
   - When within 3 meters, the HUD prompt displays: `Press [E] or tap ENTER to Drive`.
   - Player A presses `[E]` and takes Seat 0 (Driver).
   - Player B walks up to the same car. The HUD prompt displays: `Press [E] or tap ENTER to Ride as Passenger`.
   - Player B presses `[E]` and takes Seat 1 (Passenger).
4. **Shared Cruising:**
   - Player A steers and throttles; the vehicle accelerates, turns, and brakes with arcade physics.
   - Player B's camera smoothly tracks the car as a passenger. Player B's steering controls are rejected by the server, preserving driver authority.
5. **Real-Time District Chat:**
   - Type messages in the bottom-left chat drawer.
   - Focusing the chat box freezes player movement so typing never causes unintended walking/driving.
   - All messages are escaped as plain text, stamped by server time, and rate-limited.
6. **Cooperative Delivery Mission:**
   - Drive the car with both driver and passenger to the glowing cyan **Waterfront Warehouse** beacon (`45, 0, -45`).
   - When stopped in the zone, the co-op delivery mission triggers (`ACTIVE`).
   - The delivery HUD updates: `Drive together to City Hall Drop-off!`.
   - Drive to the glowing magenta **City Hall** beacon (`-45, 0, 45`) and stop the car.
   - Delivery transitions to `COMPLETE` with celebratory banner, then resets after 10 seconds.
7. **Safe Exit:**
   - Press `[E]` or tap `EXIT` while stopped (`< 1 m/s`) to exit the car. The server places the avatar in a safe egress spot outside of building geometry.

---

## 4. Multiplayer & Device Evidence

- **Authoritative Server:** Node.js Colyseus 0.18 on port 2567 with Express `/health` check.
- **Automated Tests:** 6/6 test suites passed in `apps/server/test/invariants.test.ts`:
  - Atomic seat claim race condition on seat 0: exactly one winner, loser receives `SEAT_TAKEN`.
  - Passenger steering injection rejection.
  - Safe exit placement collision check.
  - Driver disconnect immediate braking & 20s seat reservation.
  - Cooperative delivery lifecycle & cancellation on early exit.
  - NaN / Infinity input clamping.
- **Two-Client Integration Proof:** Demonstrated using two independent `@colyseus/sdk` clients joining room `v0WfTXlS0`, walking to car, boarding seat 0 & 1, driving 4.82m displacement with passenger locked to vehicle, sending chat, and safely exiting.
- **Mobile Touch Usability:** Integrated multi-touch virtual analog joystick on bottom-left, action buttons on bottom-right (`ENTER/EXIT` and `BRAKE`) with >= 56px touch target sizes.
- **Asset / Bundle Budget:** Production bundle is 741 kB (196 kB gzip), well below the 5 MB first-load target.

---

## 5. iOS Packaging Status

- Capacitor 8 template and configuration are prepared in `capacitor.config.ts` and `ios-template/`.
- Per `AGENTS.md` and `docs/BUILD_PLAN_3_HOURS.md`, generating and signing a native iOS `.ipa` binary requires a physical macOS machine with Xcode 16+. On Windows, web assets build cleanly into `dist/` ready for `npx cap sync ios`.

---

## 6. Gated Features Status

- **Voice Chat:** LiveKit voice is disabled with honest status until cloud provider credentials (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) and secure server token issuance are provisioned.
- **Game Center & Accounts:** Gated for post-P0 releases once Supabase Auth access-token verification and native GameKit bridges are connected.

---

## 7. Next Five Implementation Tasks

1. **Supabase Auth Anonymous Sessions:** Wire anonymous session tokens from Supabase Auth to guest joins, establishing persistent user IDs across room sessions.
2. **Cloud Run Containerization:** Create `Dockerfile` with multi-stage Node 24 alpine build, bind `$PORT`, and deploy Colyseus server to Google Cloud Run.
3. **Supabase Postgres Mission Logs:** Create `mission_results` table with RLS to record completed co-op deliveries.
4. **LiveKit Audio Party Token Endpoint:** Implement server-authenticated `/api/voice-token` issuing scoped tokens for room occupants.
5. **Capacitor iOS Xcode Build on Mac:** Run `npx cap add ios && npx cap sync ios` on a macOS host and test on a physical iPhone.
