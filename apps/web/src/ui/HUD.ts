import type {
  ChatMessage,
  DeliveryState,
  PlayerState,
  RaceState,
} from '@synccity/shared/protocol';
import type { TouchControlBindings } from '../input/InputManager.js';

export interface HUDActions {
  onJoin: (displayName: string, roomId?: string, isCreate?: boolean) => Promise<void>;
  onSendChat: (text: string) => Promise<void>;
  onEnterVehicle: (vehicleId: string, seatIndex: 0 | 1) => Promise<void>;
  onExitVehicle: () => Promise<void>;
  onQuickSpawnVehicle?: (kind: 'car' | 'plane') => Promise<void>;
  onUseItem?: () => Promise<void>;
  onStartRace?: () => Promise<void>;
  onToggleAudio?: () => boolean;
  onChatFocusChange: (focused: boolean) => void;
}

const CYBER_NAMES = [
  'NeonDrifter',
  'ApexViper',
  'TurboPulse',
  'SynthRunner',
  'NightRider88',
  'VectorZero',
  'HyperNova',
  'ChromeGhost',
];

export class HUD {
  private root: HTMLElement;
  private actions: HUDActions;

  private modalEl!: HTMLElement;
  private hudTopBarEl!: HTMLElement;
  private radarWrapEl!: HTMLElement;
  public radarCanvasEl!: HTMLCanvasElement;

  private interactToastEl!: HTMLElement;
  private toastTextEl!: HTMLElement;

  private chatDrawerEl!: HTMLElement;
  private chatToggleBtnEl!: HTMLElement;
  private chatUnreadBadgeEl!: HTMLElement;
  private chatToastHostEl!: HTMLElement;
  private chatMessagesEl!: HTMLElement;
  private chatInputEl!: HTMLInputElement;
  private isChatOpen = false;
  private unreadCount = 0;

  private touchZoneEl!: HTMLElement;
  private walkingControlsEl!: HTMLElement;
  private drivingLeftControlsEl!: HTMLElement;
  private drivingRightControlsEl!: HTMLElement;

  private pingDotEl!: HTMLElement;
  private pingTextEl!: HTMLElement;
  private fpsTextEl!: HTMLElement;
  private roomIdEl!: HTMLElement;
  private copyBtnEl!: HTMLElement;
  private audioBtnEl!: HTMLElement;
  private fullscreenBtnEl!: HTMLElement;

  private cashPillEl!: HTMLElement;
  private itemBtnEl!: HTMLElement;
  private rolePillEl!: HTMLElement;
  private speedDisplayEl!: HTMLElement;
  private topExitBtnEl!: HTMLElement;

  private deliveryTextEl!: HTMLElement;

  // Racing & Scoreboard elements
  private raceLapBadgeEl!: HTMLElement;
  private raceTimerEl!: HTMLElement;
  private btnStartRaceEl!: HTMLElement;
  private btnSpawnCarEl!: HTMLElement;
  private btnSpawnPlaneEl!: HTMLElement;
  private raceCountdownOverlayEl!: HTMLElement;
  private countdownTextEl!: HTMLElement;
  private raceScoreboardEl!: HTMLElement;
  private scoreboardStatusEl!: HTMLElement;
  private scoreboardEntriesEl!: HTMLElement;
  private isScoreboardCollapsed = false;

  public touchBindings!: TouchControlBindings;

  private currentNearbyVehicle: { id: string; availableSeat: 0 | 1 | null } | null = null;
  private currentLocalMode: 'walking' | 'driver' | 'passenger' = 'walking';

  constructor(root: HTMLElement, actions: HUDActions) {
    this.root = root;
    this.actions = actions;
    this.render();
  }

  private render(): void {
    this.root.innerHTML = `
      <!-- Portrait Rotate Helper (Mobile Portrait Only) -->
      <div class="rotate-banner" id="rotate-banner">
        <span>↻ Rotate iPhone to <strong>Landscape</strong> for full cockpit view</span>
      </div>

      <!-- Compact Single-Row Top Bar -->
      <header class="hud-top-bar" id="hud-top-bar" style="display: none;">
        <!-- Left: Room + Telemetry + Utility Icons -->
        <div class="hud-panel hud-bar-left">
          <button class="room-copy-pill" id="btn-copy-invite" title="Tap to Share Room Link">
            <span class="room-label">ROOM</span>
            <span class="room-id" id="room-id">----</span>
            <span class="copy-icon">🔗</span>
          </button>
          <div class="telemetry-cluster">
            <span class="ping-indicator">
              <span class="ping-dot" id="ping-dot"></span>
              <span id="ping-text">-- ms</span>
            </span>
            <span class="fps-indicator" id="fps-text">60 FPS</span>
          </div>
          <button class="icon-btn" id="btn-audio-toggle" title="Toggle Sound">🔊</button>
          <button class="icon-btn" id="btn-fullscreen" title="Fullscreen">⛶</button>
        </div>

        <!-- Center: Unified Grand Prix, Quick Car/Plane Spawn & Objective Strip -->
        <div class="hud-panel hud-bar-center">
          <span class="race-lap-badge" id="race-lap-badge">GRAND PRIX</span>
          <span class="race-timer" id="race-timer">READY</span>
          <button class="btn btn-primary btn-xs" id="btn-start-race">🏁 Race</button>
          <button class="btn btn-secondary btn-xs" id="btn-spawn-car" title="Instant Car [C]">🏎️ Car</button>
          <button class="btn btn-accent btn-xs" id="btn-spawn-plane" title="Instant Plane [P]">✈️ Plane</button>
          <span class="mission-divider">|</span>
          <span class="delivery-text" id="delivery-text">🎯 Follow 3D Arrow to Heist Pickup</span>
          <span class="hud-creator-pill">★ BUILT BY MOTATO &amp; MARMOURA</span>
        </div>

        <!-- Right: Cash, Powerup Item, Digital Speedometer & Role -->
        <div class="hud-panel hud-bar-right">
          <span class="cash-pill" id="cash-pill">💰 $100</span>
          <button class="btn btn-item btn-xs" id="btn-use-item" style="display: none;">🔥 NITRO [F]</button>
          <div class="speedo-box" id="speed-display-wrap" style="display: none;">
            <span class="speed-value" id="speed-display">0</span>
            <span class="speed-unit">KM/H</span>
          </div>
          <span class="role-pill walking" id="role-pill">WALKING</span>
          <button class="btn btn-danger btn-xs" id="btn-top-exit" style="display: none;">⏏ EXIT</button>
        </div>
      </header>

      <!-- Top-Left Mini-Map Radar + Chat Toggle -->
      <div class="hud-left-stack" id="radar-wrap" style="display: none;">
        <div class="radar-card">
          <canvas id="radar-canvas" class="radar-canvas"></canvas>
          <div class="radar-label">METRO RADAR</div>
        </div>
        <button class="chat-fab" id="btn-chat-toggle" title="Toggle Chat">
          💬 <span class="chat-fab-label">CHAT</span>
          <span class="chat-unread-badge" id="chat-unread-badge" style="display: none;">0</span>
        </button>
      </div>

      <!-- Incoming Chat Toast Banner -->
      <div class="chat-toast-host" id="chat-toast-host"></div>

      <!-- Collapsible Top-Right Leaderboard -->
      <aside class="race-scoreboard" id="race-scoreboard" style="display: none;">
        <div class="scoreboard-header" id="scoreboard-header" title="Tap to collapse/expand">
          <span>🏆 STANDINGS</span>
          <span class="scoreboard-status" id="scoreboard-status">LIVE ▾</span>
        </div>
        <div class="scoreboard-entries" id="scoreboard-entries"></div>
      </aside>

      <!-- Center Countdown Overlay -->
      <div class="race-countdown-overlay" id="race-countdown-overlay" style="display: none;">
        <span class="countdown-number" id="countdown-text">3</span>
      </div>

      <!-- Center Proximity Toast -->
      <div class="interact-toast" id="interact-toast" style="display: none;">
        <span id="toast-text">Tap ENTER or press [E] to Drive</span>
      </div>

      <!-- Collapsible Chat Drawer Modal/Sheet -->
      <aside class="chat-drawer" id="chat-drawer" style="display: none;">
        <div class="chat-header">
          <span>💬 DISTRICT COMMS</span>
          <button class="chat-close-btn" id="btn-chat-close">✕</button>
        </div>
        <div class="chat-messages" id="chat-messages"></div>
        <form class="chat-form" id="chat-form">
          <input type="text" class="chat-input" id="chat-input" placeholder="Send message..." maxlength="240" autocomplete="off" />
          <button type="submit" class="btn btn-primary btn-sm">Send</button>
        </form>
      </aside>

      <!-- Anchored Corner Touch Controls (Walking vs Driving Mode) -->
      <div class="touch-layer" id="touch-zone" style="display: none;">
        <!-- WALKING: Left Analog Stick -->
        <div class="joystick-zone" id="joystick-zone">
          <div class="joystick-base">
            <div class="joystick-knob" id="joystick-knob"></div>
          </div>
        </div>

        <!-- DRIVING LEFT: Ergonomic Steer Left / Right Buttons -->
        <div class="driving-steer-zone" id="driving-steer-zone" style="display: none;">
          <button class="steer-btn" id="touch-btn-steer-left" aria-label="Steer Left">◀</button>
          <button class="steer-btn" id="touch-btn-steer-right" aria-label="Steer Right">▶</button>
        </div>

        <!-- RIGHT ACTIONS: Enter Car (Walking) OR Gas/Brake/Drift Pedals (Driving) -->
        <div class="actions-zone">
          <button class="touch-btn btn-enter" id="touch-btn-enter">🚗 ENTER</button>
          <div class="driving-pedals-zone" id="driving-pedals-zone" style="display: none;">
            <button class="pedal-btn btn-drift" id="touch-btn-drift">💨 DRIFT</button>
            <button class="pedal-btn btn-brake" id="touch-btn-brake">🛑 BRAKE / REV</button>
            <button class="pedal-btn btn-gas" id="touch-btn-gas">⚡ GAS</button>
          </div>
        </div>
      </div>

      <!-- Landscape-Optimized .io Instant Lobby Modal -->
      <div class="modal-overlay" id="lobby-modal">
        <div class="modal-card">
          <div class="modal-brand-col">
            <div class="modal-header">
              <div class="io-badge">LIVE .IO MULTIPLAYER</div>
              <h1 class="modal-title">SYNC<span>CITY</span></h1>
              <div class="creator-credit-badge">★ BUILT BY MOTATO &amp; MARMOURA ★</div>
              <p class="modal-tagline">400m Synthwave Metropolis · Co-op Driving &amp; Grand Prix Racing</p>
            </div>
            <div class="form-group">
              <label for="input-nickname">Driver Callsign</label>
              <input type="text" id="input-nickname" class="form-input" placeholder="e.g. NeonDrifter" maxlength="20" />
            </div>
            <div id="modal-error" class="error-banner" style="display: none;"></div>
          </div>

          <div class="modal-actions-col">
            <button class="btn btn-quickplay" id="btn-quick-play">
              ⚡ QUICK PLAY NOW
            </button>
            <button class="btn btn-secondary" id="btn-create-room">
              🔒 Create Private Room
            </button>
            <div class="join-row">
              <input type="text" id="input-room-id" class="form-input join-code-input" placeholder="Room Code..." maxlength="32" />
              <button class="btn btn-accent" id="btn-join-room">Join</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.modalEl = this.root.querySelector('#lobby-modal')!;
    this.hudTopBarEl = this.root.querySelector('#hud-top-bar')!;
    this.radarWrapEl = this.root.querySelector('#radar-wrap')!;
    this.radarCanvasEl = this.root.querySelector('#radar-canvas')!;

    this.interactToastEl = this.root.querySelector('#interact-toast')!;
    this.toastTextEl = this.root.querySelector('#toast-text')!;

    this.chatDrawerEl = this.root.querySelector('#chat-drawer')!;
    this.chatToggleBtnEl = this.root.querySelector('#btn-chat-toggle')!;
    this.chatUnreadBadgeEl = this.root.querySelector('#chat-unread-badge')!;
    this.chatToastHostEl = this.root.querySelector('#chat-toast-host')!;
    this.chatMessagesEl = this.root.querySelector('#chat-messages')!;
    this.chatInputEl = this.root.querySelector('#chat-input')!;

    this.touchZoneEl = this.root.querySelector('#touch-zone')!;
    this.walkingControlsEl = this.root.querySelector('#joystick-zone')!;
    this.drivingLeftControlsEl = this.root.querySelector('#driving-steer-zone')!;
    this.drivingRightControlsEl = this.root.querySelector('#driving-pedals-zone')!;

    this.pingDotEl = this.root.querySelector('#ping-dot')!;
    this.pingTextEl = this.root.querySelector('#ping-text')!;
    this.fpsTextEl = this.root.querySelector('#fps-text')!;
    this.roomIdEl = this.root.querySelector('#room-id')!;
    this.copyBtnEl = this.root.querySelector('#btn-copy-invite')!;
    this.audioBtnEl = this.root.querySelector('#btn-audio-toggle')!;
    this.fullscreenBtnEl = this.root.querySelector('#btn-fullscreen')!;

    this.cashPillEl = this.root.querySelector('#cash-pill')!;
    this.itemBtnEl = this.root.querySelector('#btn-use-item')!;
    this.rolePillEl = this.root.querySelector('#role-pill')!;
    this.speedDisplayEl = this.root.querySelector('#speed-display')!;
    this.topExitBtnEl = this.root.querySelector('#btn-top-exit')!;

    this.deliveryTextEl = this.root.querySelector('#delivery-text')!;

    this.raceLapBadgeEl = this.root.querySelector('#race-lap-badge')!;
    this.raceTimerEl = this.root.querySelector('#race-timer')!;
    this.btnStartRaceEl = this.root.querySelector('#btn-start-race')!;
    this.btnSpawnCarEl = this.root.querySelector('#btn-spawn-car')!;
    this.btnSpawnPlaneEl = this.root.querySelector('#btn-spawn-plane')!;
    this.raceCountdownOverlayEl = this.root.querySelector('#race-countdown-overlay')!;
    this.countdownTextEl = this.root.querySelector('#countdown-text')!;
    this.raceScoreboardEl = this.root.querySelector('#race-scoreboard')!;
    this.scoreboardStatusEl = this.root.querySelector('#scoreboard-status')!;
    this.scoreboardEntriesEl = this.root.querySelector('#scoreboard-entries')!;

    this.touchBindings = {
      joystickZone: this.root.querySelector('#joystick-zone'),
      joystickKnob: this.root.querySelector('#joystick-knob'),
      enterBtn: this.root.querySelector('#touch-btn-enter'),
      steerLeftBtn: this.root.querySelector('#touch-btn-steer-left'),
      steerRightBtn: this.root.querySelector('#touch-btn-steer-right'),
      gasBtn: this.root.querySelector('#touch-btn-gas'),
      brakeBtn: this.root.querySelector('#touch-btn-brake'),
      driftBtn: this.root.querySelector('#touch-btn-drift'),
    };

    this.bindEvents();
    this.detectTouchDevice();
  }

  private detectTouchDevice(): void {
    const isTouch =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;
    if (isTouch) {
      this.touchZoneEl.style.display = 'block';
    }
  }

  private bindEvents(): void {
    const nickInput = this.root.querySelector<HTMLInputElement>('#input-nickname')!;
    const roomInput = this.root.querySelector<HTMLInputElement>('#input-room-id')!;
    const quickPlayBtn = this.root.querySelector<HTMLButtonElement>('#btn-quick-play')!;
    const createBtn = this.root.querySelector<HTMLButtonElement>('#btn-create-room')!;
    const joinBtn = this.root.querySelector<HTMLButtonElement>('#btn-join-room')!;

    const randomPrefix = CYBER_NAMES[Math.floor(Math.random() * CYBER_NAMES.length)];
    nickInput.value = `${randomPrefix}_${Math.floor(10 + Math.random() * 89)}`;

    // 1-Tap Quick Play (Joins room code if entered, else joins/creates default room)
    quickPlayBtn.addEventListener('click', async () => {
      const name = nickInput.value.trim() || 'NeonDriver';
      const code = roomInput.value.trim();
      quickPlayBtn.disabled = true;
      try {
        if (code) {
          await this.actions.onJoin(name, code, false);
        } else {
          await this.actions.onJoin(name, undefined, false);
        }
        this.hideLobby();
      } catch (err: any) {
        this.showError(err?.message || 'Connection failed');
      } finally {
        quickPlayBtn.disabled = false;
      }
    });

    createBtn.addEventListener('click', async () => {
      const name = nickInput.value.trim() || 'NeonDriver';
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
      const name = nickInput.value.trim() || 'NeonDriver';
      const code = roomInput.value.trim();
      if (!code) {
        this.showError('Enter a room code to join');
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

    // Quick-Spawn Car & Plane Buttons
    this.btnSpawnCarEl.addEventListener('click', () => {
      this.actions.onQuickSpawnVehicle?.('car');
    });
    this.btnSpawnPlaneEl.addEventListener('click', () => {
      this.actions.onQuickSpawnVehicle?.('plane');
    });

    // Use Powerup Item Button
    this.itemBtnEl.addEventListener('click', () => {
      this.actions.onUseItem?.();
    });

    // Top Exit Vehicle Button
    this.topExitBtnEl.addEventListener('click', () => {
      this.actions.onExitVehicle();
    });

    // Audio Toggle
    this.audioBtnEl.addEventListener('click', () => {
      if (this.actions.onToggleAudio) {
        const muted = this.actions.onToggleAudio();
        this.audioBtnEl.textContent = muted ? '🔇' : '🔊';
      }
    });

    // Fullscreen Toggle
    this.fullscreenBtnEl.addEventListener('click', () => {
      const docEl = document.documentElement as any;
      if (!document.fullscreenElement) {
        if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
        else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      }
    });

    // Collapsible Scoreboard
    const sbHeader = this.root.querySelector('#scoreboard-header')!;
    sbHeader.addEventListener('click', () => {
      this.isScoreboardCollapsed = !this.isScoreboardCollapsed;
      this.scoreboardEntriesEl.style.display = this.isScoreboardCollapsed ? 'none' : 'flex';
    });

    // Copy / Share invite
    this.copyBtnEl.addEventListener('click', async () => {
      const code = this.roomIdEl.textContent || '';
      const url = `${window.location.origin}${window.location.pathname}?room=${code}`;
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'SyncCity Racing',
            text: `Race me in SyncCity! Room: ${code}`,
            url,
          });
          return;
        } catch {}
      }
      navigator.clipboard.writeText(url).then(() => {
        const prev = this.roomIdEl.textContent;
        this.roomIdEl.textContent = 'COPIED!';
        setTimeout(() => {
          this.roomIdEl.textContent = prev;
        }, 1500);
      });
    });

    // Chat Drawer Toggle
    const toggleChat = () => {
      this.isChatOpen = !this.isChatOpen;
      this.chatDrawerEl.style.display = this.isChatOpen ? 'flex' : 'none';
      if (this.isChatOpen) {
        this.unreadCount = 0;
        this.chatUnreadBadgeEl.style.display = 'none';
      } else {
        this.actions.onChatFocusChange(false);
      }
    };
    this.chatToggleBtnEl.addEventListener('click', toggleChat);
    this.root.querySelector('#btn-chat-close')!.addEventListener('click', toggleChat);

    // Chat Form
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
    this.radarWrapEl.style.display = 'none';
    this.chatDrawerEl.style.display = 'none';

    if (roomFromUrl) {
      const roomInput = this.root.querySelector<HTMLInputElement>('#input-room-id');
      if (roomInput) roomInput.value = roomFromUrl;
    }
  }

  public hideLobby(): void {
    this.modalEl.style.display = 'none';
    this.hudTopBarEl.style.display = 'flex';
    this.radarWrapEl.style.display = 'flex';
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
      this.pingTextEl.textContent = 'Retry...';
    } else {
      this.pingDotEl.className = 'ping-dot danger';
      this.pingTextEl.textContent = 'Offline';
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

  public updateFPS(fps: number): void {
    this.fpsTextEl.textContent = `${Math.round(fps)} FPS`;
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
    allPlayers?: Record<string, PlayerState>;
    nearbyVehicle: { id: string; availableSeat: 0 | 1 | null } | null;
    carSpeed?: number;
    vehicleAltitude?: number;
    delivery: DeliveryState;
    race?: RaceState;
  }): void {
    this.roomIdEl.textContent = data.roomId;
    this.currentNearbyVehicle = data.nearbyVehicle;
    this.currentLocalMode = data.localPlayer.mode;

    const speedWrap = this.root.querySelector<HTMLElement>('#speed-display-wrap')!;
    const enterBtn = this.touchBindings.enterBtn;

    // Live Cash Counter
    const cashVal = data.localPlayer.cash ?? 100;
    this.cashPillEl.textContent = `💰 $${cashVal.toLocaleString()}`;

    // Active Powerup Item Button (SmashKarts style)
    const heldItem = data.localPlayer.heldItem || '';
    if (heldItem) {
      this.itemBtnEl.style.display = 'inline-flex';
      const itemLabel =
        heldItem === 'rocket'
          ? '🚀 ROCKET [F]'
          : heldItem === 'emp'
          ? '⚡ EMP [F]'
          : '🔥 NITRO [F]';
      this.itemBtnEl.textContent = itemLabel;
    } else {
      this.itemBtnEl.style.display = 'none';
    }

    const isPlane = (data.localPlayer.vehicleId || '').includes('plane');
    const altMeters = Math.round(data.vehicleAltitude || 0);

    // Role & Mode-Adaptive Controls (Walking vs Driving vs Flying)
    this.rolePillEl.className = `role-pill ${data.localPlayer.mode}`;
    if (data.localPlayer.mode === 'driver') {
      this.rolePillEl.textContent = isPlane ? `✈️ PILOT · ${altMeters}M` : '🏎️ DRIVER';
    } else if (data.localPlayer.mode === 'passenger') {
      this.rolePillEl.textContent = isPlane ? `✈️ CO-PILOT` : '💺 PASSENGER';
    } else {
      this.rolePillEl.textContent = '🚶 WALKING';
    }

    if (data.localPlayer.mode === 'driver') {
      speedWrap.style.display = 'inline-flex';
      const kmh = Math.round(Math.abs(data.carSpeed || 0) * 3.6);
      this.speedDisplayEl.textContent = `${kmh}`;
      this.topExitBtnEl.style.display = 'inline-flex';

      // Switch mobile controls to Arcade Steer + Pedals
      this.walkingControlsEl.style.display = 'none';
      this.drivingLeftControlsEl.style.display = 'flex';
      this.drivingRightControlsEl.style.display = 'flex';
      if (enterBtn) enterBtn.style.display = 'none';
    } else if (data.localPlayer.mode === 'passenger') {
      speedWrap.style.display = 'inline-flex';
      const kmh = Math.round(Math.abs(data.carSpeed || 0) * 3.6);
      this.speedDisplayEl.textContent = `${kmh}`;
      this.topExitBtnEl.style.display = 'inline-flex';

      this.walkingControlsEl.style.display = 'none';
      this.drivingLeftControlsEl.style.display = 'none';
      this.drivingRightControlsEl.style.display = 'none';
      if (enterBtn) {
        enterBtn.style.display = 'flex';
        enterBtn.textContent = '⏏ EXIT';
      }
    } else {
      speedWrap.style.display = 'none';
      this.topExitBtnEl.style.display = 'none';

      // Walking mode: Virtual Analog Stick + Contextual Enter Car/Plane button
      this.walkingControlsEl.style.display = 'flex';
      this.drivingLeftControlsEl.style.display = 'none';
      this.drivingRightControlsEl.style.display = 'none';

      if (enterBtn) {
        if (data.nearbyVehicle && data.nearbyVehicle.availableSeat !== null) {
          const isNearbyPlane = data.nearbyVehicle.id.includes('plane');
          enterBtn.style.display = 'flex';
          enterBtn.textContent =
            data.nearbyVehicle.availableSeat === 0
              ? isNearbyPlane
                ? '✈️ FLY'
                : '🚗 DRIVE'
              : '💺 RIDE';
        } else {
          enterBtn.style.display = 'none';
        }
      }
    }

    // Proximity Toast (Walking only, non-obstructive)
    if (data.localPlayer.mode === 'walking' && data.nearbyVehicle && data.nearbyVehicle.availableSeat !== null) {
      this.interactToastEl.style.display = 'block';
      const isNearbyPlane = data.nearbyVehicle.id.includes('plane');
      const roleText =
        data.nearbyVehicle.availableSeat === 0
          ? isNearbyPlane
            ? 'Fly Stunt Plane (Hold GAS to Takeoff!)'
            : 'Drive Supercar'
          : 'Ride as Co-Pilot';
      this.toastTextEl.textContent = `Tap Button or press [E] to ${roleText}`;
    } else {
      this.interactToastEl.style.display = 'none';
    }

    // Dynamic Objective & GPS Distance Banner
    const deliv = data.delivery;
    if (isPlane && altMeters > 4) {
      this.deliveryTextEl.textContent = '✈️ Fly through Gold Sky Rings (+$500) | Hold BRAKE to land';
    } else if (deliv.phase === 'available') {
      const dist = Math.round(Math.hypot(80 - data.localPlayer.x, -100 - data.localPlayer.z));
      this.deliveryTextEl.textContent = `🎯 Heist Pickup at Docks (${dist}m) · Solo +$1K / Co-op +$2.5K`;
    } else if (deliv.phase === 'active') {
      const dist = Math.round(Math.hypot(-80 - data.localPlayer.x, 100 - data.localPlayer.z));
      this.deliveryTextEl.textContent = `🚨 DELIVER CARGO TO CITY HALL (${dist}m) FOR PAYOUT!`;
    } else {
      this.deliveryTextEl.textContent = '💰 HEIST DELIVERED! Next drop spawning...';
    }

    // Grand Prix Racing HUD & Always-On Live Standings Leaderboard
    const race = data.race;
    if (race) {
      if (race.status === 'countdown') {
        this.raceCountdownOverlayEl.style.display = 'flex';
        this.countdownTextEl.textContent = race.countdownSeconds === 0 ? 'GO!' : `${race.countdownSeconds}`;
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
        this.btnStartRaceEl.style.display = 'inline-flex';
        this.btnStartRaceEl.textContent = '🏁 Rematch';
      } else {
        this.raceLapBadgeEl.textContent = 'GRAND PRIX';
        this.raceLapBadgeEl.className = 'race-lap-badge';
        this.raceTimerEl.textContent = 'READY';
        this.btnStartRaceEl.style.display = 'inline-flex';
        this.btnStartRaceEl.textContent = '🏁 Race';
      }

      this.raceScoreboardEl.style.display = 'flex';
      const suffix = this.isScoreboardCollapsed ? '▸' : '▾';

      if (race.status === 'racing' || race.status === 'finished') {
        this.scoreboardStatusEl.textContent =
          race.status === 'finished' ? `RESULTS ${suffix}` : `RACE ${suffix}`;

        const parts = Object.values(race.participants).sort((a, b) => {
          if (a.finished && !b.finished) return -1;
          if (!a.finished && b.finished) return 1;
          if (a.finished && b.finished) return a.rank - b.rank;
          return b.currentLap - a.currentLap;
        });

        this.scoreboardEntriesEl.innerHTML = parts
          .slice(0, 5)
          .map((p, idx) => {
            const isLocal = p.playerId === data.localPlayer.id;
            const rankLabel = p.finished ? `#${p.rank}` : `#${idx + 1}`;
            const timeLabel = p.finished
              ? this.formatTimeMs(p.totalTimeMs)
              : p.bestLapMs > 0
              ? this.formatTimeMs(p.bestLapMs)
              : `L${p.currentLap}`;
            return `
              <div class="scoreboard-row ${isLocal ? 'local' : ''}">
                <span class="sb-rank">${rankLabel}</span>
                <span class="sb-name">${p.displayName || 'Racer'}</span>
                <span class="sb-time">${timeLabel}</span>
              </div>
            `;
          })
          .join('');
      } else if (data.allPlayers) {
        // Show Syndicate Cash Leaderboard when not in an active race
        this.scoreboardStatusEl.textContent = `CASH ${suffix}`;
        const richList = Object.values(data.allPlayers)
          .filter((p) => p.connected)
          .sort((a, b) => (b.cash || 0) - (a.cash || 0));

        this.scoreboardEntriesEl.innerHTML = richList
          .slice(0, 5)
          .map((p, idx) => {
            const isLocal = p.id === data.localPlayer.id;
            const icon = (p.vehicleId || '').includes('plane')
              ? '✈️'
              : p.mode === 'driver'
              ? '🏎️'
              : '🚶';
            return `
              <div class="scoreboard-row ${isLocal ? 'local' : ''}">
                <span class="sb-rank">#${idx + 1}</span>
                <span class="sb-name">${icon} ${p.displayName || 'Driver'}</span>
                <span class="sb-time">$${(p.cash ?? 100).toLocaleString()}</span>
              </div>
            `;
          })
          .join('');
      }
    } else {
      this.raceCountdownOverlayEl.style.display = 'none';
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
    senderSpan.textContent = `${msg.displayName}:`;

    const textSpan = document.createElement('span');
    textSpan.className = 'text';
    textSpan.textContent = msg.text;

    div.appendChild(senderSpan);
    div.appendChild(textSpan);

    this.chatMessagesEl.appendChild(div);
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;

    while (this.chatMessagesEl.children.length > 50) {
      this.chatMessagesEl.removeChild(this.chatMessagesEl.firstChild!);
    }

    // If chat drawer is closed, show a non-intrusive floating toast for 4 seconds
    if (!this.isChatOpen) {
      this.unreadCount++;
      this.chatUnreadBadgeEl.textContent = `${this.unreadCount}`;
      this.chatUnreadBadgeEl.style.display = 'inline-flex';

      const toast = document.createElement('div');
      toast.className = 'chat-toast-pill';
      toast.innerHTML = `<strong>${msg.displayName}:</strong> ${msg.text}`;
      this.chatToastHostEl.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 4000);
    }
  }
}
