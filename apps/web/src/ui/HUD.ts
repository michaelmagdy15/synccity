import type {
  ActionError,
  ChatMessage,
  DeliveryState,
  PlayerState,
  RaceState,
} from '@synccity/shared/protocol';

export interface HUDActions {
  onJoin: (displayName: string, roomId?: string, isCreate?: boolean) => Promise<void>;
  onSendChat: (text: string) => Promise<void>;
  onEnterVehicle: (vehicleId: string, seatIndex: 0 | 1) => Promise<void>;
  onExitVehicle: () => Promise<void>;
  onStartRace?: () => Promise<void>;
  onChatFocusChange: (focused: boolean) => void;
}

export class HUD {
  private root: HTMLElement;
  private actions: HUDActions;

  // DOM elements
  private modalEl!: HTMLElement;
  private hudTopBarEl!: HTMLElement;
  private deliveryCardEl!: HTMLElement;
  private interactToastEl!: HTMLElement;
  private chatDrawerEl!: HTMLElement;
  private touchZoneEl!: HTMLElement;

  private pingDotEl!: HTMLElement;
  private pingTextEl!: HTMLElement;
  private roomIdEl!: HTMLElement;
  private copyBtnEl!: HTMLElement;
  private rolePillEl!: HTMLElement;
  private speedDisplayEl!: HTMLElement;

  private deliveryBadgeEl!: HTMLElement;
  private deliveryTextEl!: HTMLElement;
  private toastTextEl!: HTMLElement;

  private chatMessagesEl!: HTMLElement;
  private chatInputEl!: HTMLInputElement;

  // Racing & Scoreboard elements
  private raceHudCardEl!: HTMLElement;
  private raceLapBadgeEl!: HTMLElement;
  private raceTimerEl!: HTMLElement;
  private btnStartRaceEl!: HTMLElement;
  private raceCountdownOverlayEl!: HTMLElement;
  private countdownTextEl!: HTMLElement;
  private raceScoreboardEl!: HTMLElement;
  private scoreboardStatusEl!: HTMLElement;
  private scoreboardEntriesEl!: HTMLElement;

  public joystickZoneEl: HTMLElement | null = null;
  public joystickKnobEl: HTMLElement | null = null;
  public enterBtnEl: HTMLElement | null = null;
  public brakeBtnEl: HTMLElement | null = null;

  private currentNearbyVehicle: { id: string; availableSeat: 0 | 1 | null } | null = null;
  private currentLocalMode: 'walking' | 'driver' | 'passenger' = 'walking';

  constructor(root: HTMLElement, actions: HUDActions) {
    this.root = root;
    this.actions = actions;
    this.render();
  }

  private render(): void {
    this.root.innerHTML = `
      <!-- Top Bar HUD -->
      <header class="hud-top-bar" id="hud-top-bar" style="display: none;">
        <div class="hud-panel room-badge">
          <span>ROOM: <span class="room-id" id="room-id">----</span></span>
          <button class="btn btn-secondary btn-sm" id="btn-copy-invite">Share Invite</button>
          <div class="ping-indicator">
            <span class="ping-dot" id="ping-dot"></span>
            <span id="ping-text">-- ms</span>
          </div>
        </div>

        <div class="hud-center-group">
          <div class="delivery-card" id="delivery-card">
            <span class="delivery-phase-badge available" id="delivery-phase-badge">AVAILABLE</span>
            <span class="delivery-text" id="delivery-text">Co-op Delivery: 2 players board a car at Waterfront</span>
          </div>

          <!-- Grand Prix Racing HUD Card -->
          <div class="race-hud-card" id="race-hud-card">
            <span class="race-lap-badge" id="race-lap-badge">GRAND PRIX</span>
            <span class="race-timer" id="race-timer">READY</span>
            <button class="btn btn-primary btn-xs" id="btn-start-race">🏁 Start Race</button>
          </div>
        </div>

        <div class="hud-panel role-badge">
          <span class="role-pill walking" id="role-pill">WALKING</span>
          <span class="speed-display" id="speed-display" style="display: none;">0 KM/H</span>
        </div>
      </header>

      <!-- Center Countdown Overlay -->
      <div class="race-countdown-overlay" id="race-countdown-overlay" style="display: none;">
        <span class="countdown-number" id="countdown-text">3</span>
      </div>

      <!-- Live Race Scoreboard (Top Right Below Header) -->
      <aside class="race-scoreboard" id="race-scoreboard" style="display: none;">
        <div class="scoreboard-header">
          <span>🏆 LEADERBOARD</span>
          <span class="scoreboard-status" id="scoreboard-status">LIVE</span>
        </div>
        <div class="scoreboard-entries" id="scoreboard-entries"></div>
      </aside>

      <!-- Center Proximity Prompt -->
      <div class="interact-toast" id="interact-toast" style="display: none;">
        <span id="toast-text">Press [E] to Drive</span>
      </div>

      <!-- Bottom Chat & Touch Area -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%;">
        <!-- Text Chat Drawer -->
        <aside class="chat-drawer" id="chat-drawer" style="display: none;">
          <div class="chat-header">
            <span>DISTRICT CHAT</span>
            <span style="font-size: 10px; color: var(--cyan);">PRIVATE PROTOTYPE</span>
          </div>
          <div class="chat-messages" id="chat-messages"></div>
          <form class="chat-form" id="chat-form">
            <input type="text" class="chat-input" id="chat-input" placeholder="Press Enter to chat..." maxlength="240" autocomplete="off" />
            <button type="submit" class="btn btn-primary btn-sm">Send</button>
          </form>
        </aside>

        <!-- Touch Controls -->
        <div class="touch-zone" id="touch-zone" style="display: none;">
          <div class="joystick-zone" id="joystick-zone">
            <div class="joystick-base">
              <div class="joystick-knob" id="joystick-knob"></div>
            </div>
          </div>
          <div class="actions-zone">
            <button class="touch-btn btn-enter" id="touch-btn-enter">ENTER</button>
            <button class="touch-btn btn-brake" id="touch-btn-brake" style="display: none;">BRAKE</button>
          </div>
        </div>
      </div>

      <div class="proto-disclaimer">SyncCity v1.0 · Authoritative Physics & Seating · Multi-Client Prototype</div>

      <!-- Lobby / Room Join Modal -->
      <div class="modal-overlay" id="lobby-modal">
        <div class="modal-card">
          <div class="modal-header">
            <h1 class="modal-title">SYNC<span>CITY</span></h1>
            <p class="modal-tagline">Meet in the city. Jump in the same car. Deliver together.</p>
          </div>

          <div id="modal-error" class="error-banner" style="display: none;"></div>

          <div class="form-group">
            <label for="input-nickname">Your Nickname</label>
            <input type="text" id="input-nickname" class="form-input" placeholder="e.g. NeonRider" maxlength="20" autofocus />
          </div>

          <button class="btn btn-primary" id="btn-create-room">Create Private Room</button>

          <div class="divider">OR JOIN EXISTING ROOM</div>

          <div class="form-group">
            <label for="input-room-id">Room Code</label>
            <input type="text" id="input-room-id" class="form-input" placeholder="e.g. ABC123XYZ" maxlength="32" />
          </div>

          <button class="btn btn-secondary" id="btn-join-room">Join Room</button>
        </div>
      </div>
    `;

    // Cache elements
    this.modalEl = this.root.querySelector('#lobby-modal')!;
    this.hudTopBarEl = this.root.querySelector('#hud-top-bar')!;
    this.deliveryCardEl = this.root.querySelector('#delivery-card')!;
    this.interactToastEl = this.root.querySelector('#interact-toast')!;
    this.chatDrawerEl = this.root.querySelector('#chat-drawer')!;
    this.touchZoneEl = this.root.querySelector('#touch-zone')!;

    this.pingDotEl = this.root.querySelector('#ping-dot')!;
    this.pingTextEl = this.root.querySelector('#ping-text')!;
    this.roomIdEl = this.root.querySelector('#room-id')!;
    this.copyBtnEl = this.root.querySelector('#btn-copy-invite')!;
    this.rolePillEl = this.root.querySelector('#role-pill')!;
    this.speedDisplayEl = this.root.querySelector('#speed-display')!;

    this.deliveryBadgeEl = this.root.querySelector('#delivery-phase-badge')!;
    this.deliveryTextEl = this.root.querySelector('#delivery-text')!;
    this.toastTextEl = this.root.querySelector('#toast-text')!;

    this.chatMessagesEl = this.root.querySelector('#chat-messages')!;
    this.chatInputEl = this.root.querySelector('#chat-input')!;

    // Racing & Scoreboard elements
    this.raceHudCardEl = this.root.querySelector('#race-hud-card')!;
    this.raceLapBadgeEl = this.root.querySelector('#race-lap-badge')!;
    this.raceTimerEl = this.root.querySelector('#race-timer')!;
    this.btnStartRaceEl = this.root.querySelector('#btn-start-race')!;
    this.raceCountdownOverlayEl = this.root.querySelector('#race-countdown-overlay')!;
    this.countdownTextEl = this.root.querySelector('#countdown-text')!;
    this.raceScoreboardEl = this.root.querySelector('#race-scoreboard')!;
    this.scoreboardStatusEl = this.root.querySelector('#scoreboard-status')!;
    this.scoreboardEntriesEl = this.root.querySelector('#scoreboard-entries')!;

    this.joystickZoneEl = this.root.querySelector('#joystick-zone');
    this.joystickKnobEl = this.root.querySelector('#joystick-knob');
    this.enterBtnEl = this.root.querySelector('#touch-btn-enter');
    this.brakeBtnEl = this.root.querySelector('#touch-btn-brake');

    this.bindEvents();
    this.detectTouchDevice();
  }

  private detectTouchDevice(): void {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) {
      this.touchZoneEl.style.display = 'flex';
    }
  }

  private bindEvents(): void {
    const nickInput = this.root.querySelector<HTMLInputElement>('#input-nickname')!;
    const roomInput = this.root.querySelector<HTMLInputElement>('#input-room-id')!;
    const createBtn = this.root.querySelector<HTMLButtonElement>('#btn-create-room')!;
    const joinBtn = this.root.querySelector<HTMLButtonElement>('#btn-join-room')!;

    // Auto-generate cool default name
    nickInput.value = `Rider_${Math.floor(100 + Math.random() * 900)}`;

    createBtn.addEventListener('click', async () => {
      const name = nickInput.value.trim() || 'Player';
      createBtn.disabled = true;
      try {
        await this.actions.onJoin(name, undefined, true);
        this.hideLobby();
      } catch (err: any) {
        this.showError(err?.message || 'Could not create room');
      } finally {
        createBtn.disabled = false;
      }
    });

    joinBtn.addEventListener('click', async () => {
      const name = nickInput.value.trim() || 'Player';
      const code = roomInput.value.trim();
      if (!code) {
        this.showError('Please enter a room code');
        return;
      }
      joinBtn.disabled = true;
      try {
        await this.actions.onJoin(name, code, false);
        this.hideLobby();
      } catch (err: any) {
        this.showError(err?.message || 'Could not join room');
      } finally {
        joinBtn.disabled = false;
      }
    });

    // Start Race Button
    this.btnStartRaceEl.addEventListener('click', async () => {
      if (this.actions.onStartRace) {
        this.btnStartRaceEl.setAttribute('disabled', 'true');
        try {
          await this.actions.onStartRace();
        } finally {
          this.btnStartRaceEl.removeAttribute('disabled');
        }
      }
    });

    // Copy / Share invite
    this.copyBtnEl.addEventListener('click', async () => {
      const url = `${window.location.origin}${window.location.pathname}?room=${this.roomIdEl.textContent}`;
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'SyncCity',
            text: `Meet me in SyncCity room ${this.roomIdEl.textContent}!`,
            url,
          });
          return;
        } catch {}
      }

      navigator.clipboard.writeText(url).then(() => {
        const originalText = this.copyBtnEl.textContent;
        this.copyBtnEl.textContent = 'Copied Link!';
        setTimeout(() => {
          this.copyBtnEl.textContent = originalText;
        }, 2000);
      });
    });

    // Chat form
    const chatForm = this.root.querySelector<HTMLFormElement>('#chat-form')!;
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = this.chatInputEl.value.trim();
      if (!text) return;
      this.chatInputEl.value = '';
      try {
        await this.actions.onSendChat(text);
      } catch (err: any) {
        console.warn('Chat error:', err);
      }
    });

    this.chatInputEl.addEventListener('focus', () => {
      this.actions.onChatFocusChange(true);
    });

    this.chatInputEl.addEventListener('blur', () => {
      this.actions.onChatFocusChange(false);
    });
  }

  public showLobby(roomFromUrl?: string): void {
    this.modalEl.style.display = 'flex';
    this.hudTopBarEl.style.display = 'none';
    this.chatDrawerEl.style.display = 'none';

    if (roomFromUrl) {
      const roomInput = this.root.querySelector<HTMLInputElement>('#input-room-id');
      if (roomInput) roomInput.value = roomFromUrl;
    }
  }

  public hideLobby(): void {
    this.modalEl.style.display = 'none';
    this.hudTopBarEl.style.display = 'flex';
    this.chatDrawerEl.style.display = 'flex';
    this.detectTouchDevice();
  }

  public showError(msg: string): void {
    const errorBanner = this.root.querySelector<HTMLElement>('#modal-error')!;
    errorBanner.textContent = msg;
    errorBanner.style.display = 'block';
  }

  public updateStatus(status: 'connected' | 'reconnecting' | 'disconnected', error?: string): void {
    if (status === 'connected') {
      this.pingDotEl.className = 'ping-dot';
    } else if (status === 'reconnecting') {
      this.pingDotEl.className = 'ping-dot warning';
      this.pingTextEl.textContent = 'Reconnecting...';
    } else {
      this.pingDotEl.className = 'ping-dot danger';
      this.pingTextEl.textContent = 'Disconnected';
      if (error) this.showError(error);
    }
  }

  public updateLatency(pingMs: number): void {
    this.pingTextEl.textContent = `${Math.round(pingMs)} ms`;
    if (pingMs > 250) {
      this.pingDotEl.className = 'ping-dot danger';
    } else if (pingMs > 120) {
      this.pingDotEl.className = 'ping-dot warning';
    } else {
      this.pingDotEl.className = 'ping-dot';
    }
  }

  private formatTimeMs(ms: number): string {
    if (!ms || ms <= 0) return '00:00.0';
    const totalSec = ms / 1000;
    const mins = Math.floor(totalSec / 60);
    const secs = (totalSec % 60).toFixed(1);
    const mStr = mins < 10 ? `0${mins}` : `${mins}`;
    const sStr = parseFloat(secs) < 10 ? `0${secs}` : `${secs}`;
    return `${mStr}:${sStr}`;
  }

  public updateGameHUD(data: {
    roomId: string;
    localPlayer: PlayerState;
    nearbyVehicle: { id: string; availableSeat: 0 | 1 | null } | null;
    carSpeed?: number;
    delivery: DeliveryState;
    race?: RaceState;
  }): void {
    this.roomIdEl.textContent = data.roomId;
    this.currentNearbyVehicle = data.nearbyVehicle;
    this.currentLocalMode = data.localPlayer.mode;

    // Role badge & Speedometer
    this.rolePillEl.className = `role-pill ${data.localPlayer.mode}`;
    this.rolePillEl.textContent = data.localPlayer.mode.toUpperCase();

    if (data.localPlayer.mode === 'driver') {
      this.speedDisplayEl.style.display = 'inline-block';
      const kmh = Math.round(Math.abs(data.carSpeed || 0) * 3.6);
      this.speedDisplayEl.textContent = `${kmh} KM/H`;
      if (this.brakeBtnEl) this.brakeBtnEl.style.display = 'flex';
      if (this.enterBtnEl) this.enterBtnEl.textContent = 'EXIT';
    } else if (data.localPlayer.mode === 'passenger') {
      this.speedDisplayEl.style.display = 'inline-block';
      const kmh = Math.round(Math.abs(data.carSpeed || 0) * 3.6);
      this.speedDisplayEl.textContent = `${kmh} KM/H`;
      if (this.brakeBtnEl) this.brakeBtnEl.style.display = 'none';
      if (this.enterBtnEl) this.enterBtnEl.textContent = 'EXIT';
    } else {
      this.speedDisplayEl.style.display = 'none';
      if (this.brakeBtnEl) this.brakeBtnEl.style.display = 'none';
      if (this.enterBtnEl) this.enterBtnEl.textContent = 'ENTER';
    }

    // Interaction Prompt
    if (data.localPlayer.mode !== 'walking') {
      this.interactToastEl.style.display = 'block';
      this.toastTextEl.textContent = 'Press [E] or tap EXIT to leave vehicle';
    } else if (data.nearbyVehicle && data.nearbyVehicle.availableSeat !== null) {
      this.interactToastEl.style.display = 'block';
      const roleText = data.nearbyVehicle.availableSeat === 0 ? 'Drive' : 'Ride as Passenger';
      this.toastTextEl.textContent = `Press [E] or tap ENTER to ${roleText}`;
    } else {
      this.interactToastEl.style.display = 'none';
    }

    // Delivery Card
    const deliv = data.delivery;
    this.deliveryBadgeEl.className = `delivery-phase-badge ${deliv.phase}`;
    this.deliveryBadgeEl.textContent = deliv.phase.toUpperCase();

    if (deliv.phase === 'available') {
      this.deliveryTextEl.textContent = 'Co-op Delivery: 2 players board a car at Waterfront Warehouse';
    } else if (deliv.phase === 'active') {
      this.deliveryTextEl.textContent = 'Active Delivery: Drive together to City Hall Drop-off!';
    } else if (deliv.phase === 'complete') {
      this.deliveryTextEl.textContent = 'Delivery Complete! Well done! (New mission in 10s)';
    }

    // Grand Prix Racing HUD & Countdown
    const race = data.race;
    if (race) {
      if (race.status === 'countdown') {
        this.raceCountdownOverlayEl.style.display = 'flex';
        this.countdownTextEl.textContent = race.countdownSeconds === 0 ? 'GO!' : `${race.countdownSeconds}`;
        this.countdownTextEl.className = race.countdownSeconds === 0 ? 'countdown-number go' : 'countdown-number';
      } else {
        this.raceCountdownOverlayEl.style.display = 'none';
      }

      if (race.status === 'racing') {
        const localPart = race.participants[data.localPlayer.id];
        const lap = localPart ? localPart.currentLap : 1;
        this.raceLapBadgeEl.textContent = `LAP ${lap}/${race.totalLaps}`;
        this.raceLapBadgeEl.className = 'race-lap-badge racing';
        const elapsedMs = race.startedAtMs ? Date.now() - race.startedAtMs : 0;
        this.raceTimerEl.textContent = this.formatTimeMs(elapsedMs);
        this.btnStartRaceEl.style.display = 'none';
      } else if (race.status === 'finished') {
        this.raceLapBadgeEl.textContent = 'FINISHED';
        this.raceLapBadgeEl.className = 'race-lap-badge complete';
        this.btnStartRaceEl.style.display = 'inline-block';
        this.btnStartRaceEl.textContent = '🏁 New Race';
      } else {
        this.raceLapBadgeEl.textContent = 'GRAND PRIX';
        this.raceLapBadgeEl.className = 'race-lap-badge';
        this.raceTimerEl.textContent = 'READY';
        this.btnStartRaceEl.style.display = 'inline-block';
        this.btnStartRaceEl.textContent = '🏁 Start Race';
      }

      // Live Scoreboard
      if (race.status === 'racing' || race.status === 'finished') {
        this.raceScoreboardEl.style.display = 'flex';
        this.scoreboardStatusEl.textContent = race.status === 'finished' ? 'FINAL RESULTS' : 'LIVE';

        const parts = Object.values(race.participants).sort((a, b) => {
          if (a.finished && !b.finished) return -1;
          if (!a.finished && b.finished) return 1;
          if (a.finished && b.finished) return a.rank - b.rank;
          return b.currentLap - a.currentLap;
        });

        this.scoreboardEntriesEl.innerHTML = parts
          .map((p, idx) => {
            const isLocal = p.playerId === data.localPlayer.id;
            const rankLabel = p.finished ? `#${p.rank}` : `#${idx + 1}`;
            const timeLabel = p.finished
              ? this.formatTimeMs(p.totalTimeMs)
              : p.bestLapMs > 0
              ? `Best: ${this.formatTimeMs(p.bestLapMs)}`
              : `Lap ${p.currentLap}`;
            return `
              <div class="scoreboard-row ${isLocal ? 'local' : ''}">
                <span class="sb-rank">${rankLabel}</span>
                <span class="sb-name">${p.displayName || 'Racer'}</span>
                <span class="sb-time">${timeLabel}</span>
              </div>
            `;
          })
          .join('');
      } else {
        this.raceScoreboardEl.style.display = 'none';
      }
    } else {
      this.raceCountdownOverlayEl.style.display = 'none';
      this.raceScoreboardEl.style.display = 'none';
    }
  }

  public handleInteract(): void {
    if (this.currentLocalMode !== 'walking') {
      this.actions.onExitVehicle();
    } else if (this.currentNearbyVehicle && this.currentNearbyVehicle.availableSeat !== null) {
      this.actions.onEnterVehicle(this.currentNearbyVehicle.id, this.currentNearbyVehicle.availableSeat);
    }
  }

  public addChatMessage(msg: ChatMessage): void {
    const div = document.createElement('div');
    div.className = 'chat-msg';

    const senderSpan = document.createElement('span');
    senderSpan.className = 'sender';
    senderSpan.textContent = msg.displayName;

    const textSpan = document.createElement('span');
    textSpan.className = 'text';
    textSpan.textContent = msg.text;

    div.appendChild(senderSpan);
    div.appendChild(textSpan);

    this.chatMessagesEl.appendChild(div);
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;

    // Prune history client-side <= 50 messages
    while (this.chatMessagesEl.children.length > 50) {
      this.chatMessagesEl.removeChild(this.chatMessagesEl.firstChild!);
    }
  }
}
