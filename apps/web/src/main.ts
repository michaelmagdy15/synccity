import './style.css';
import { LIMITS } from '@synccity/shared/protocol';
import { AudioEngine } from './audio/AudioEngine.js';
import { InputManager } from './input/InputManager.js';
import { NetworkClient } from './network/NetworkClient.js';
import { HUD } from './ui/HUD.js';
import { Radar } from './ui/Radar.js';
import { World } from './world/World.js';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const uiRoot = document.querySelector<HTMLElement>('#ui-root');
const speedLinesEl = document.querySelector<HTMLElement>('#speed-lines');

if (!canvas || !uiRoot) {
  throw new Error('Missing essential DOM mounting elements');
}

// 1. Initialize 3D World, Audio Synthesizer, Network, and Input
const world = new World(canvas);
const audio = new AudioEngine();
const network = new NetworkClient();
const inputManager = new InputManager();

// 2. Initialize Landscape-Optimized HUD Overlay
const hud = new HUD(uiRoot, {
  onJoin: async (displayName, roomId, isCreate) => {
    audio.unlock();
    await network.connect(displayName, roomId, isCreate);
  },
  onSendChat: async (text) => {
    await network.sendChat(text);
  },
  onEnterVehicle: async (vehicleId, seatIndex) => {
    audio.unlock();
    const res = await network.enterVehicle(vehicleId, seatIndex);
    if (res.ok) {
      audio.playDoorClunk();
    } else {
      console.warn('Enter vehicle rejected:', res.code);
    }
  },
  onExitVehicle: async () => {
    const res = await network.exitVehicle();
    if (res.ok) {
      audio.playDoorClunk();
      audio.stopEngine();
    } else {
      console.warn('Exit vehicle rejected:', res.code);
    }
  },
  onStartRace: async () => {
    audio.unlock();
    await network.startRace();
  },
  onToggleAudio: () => {
    return audio.toggleMute();
  },
  onChatFocusChange: (focused) => {
    inputManager.setChatFocus(focused);
  },
});

const radar = new Radar(hud.radarCanvasEl);

// Bind Touch Controls (Joystick + Dedicated Arcade Pedals)
inputManager.bindTouchElements(hud.touchBindings);

inputManager.onInteract(() => {
  hud.handleInteract();
});

// Network event listeners
network.onChat((msg) => {
  hud.addChatMessage(msg);
});

network.onLatency((pingMs) => {
  hud.updateLatency(pingMs);
});

network.onStatus((status, err) => {
  hud.updateStatus(status, err);
});

// Handle viewport & orientation resizing
const handleViewportResize = () => {
  world.resize(window.innerWidth, window.innerHeight);
};
window.addEventListener('resize', handleViewportResize);
window.addEventListener('orientationchange', () => {
  setTimeout(handleViewportResize, 120);
});

// Check if invite code was passed via URL query or hash
const urlParams = new URLSearchParams(window.location.search);
const roomParam =
  urlParams.get('room') ||
  (window.location.hash.startsWith('#room=') ? window.location.hash.slice(6) : '');
hud.showLobby(roomParam);

// High-frequency 30Hz (33ms) input sender + instant edge-trigger when keys/touch change
let latestAxes = { axisX: 0, axisZ: 0, throttle: 0, steer: 0, brake: false };
let lastSentAxes = { axisX: 0, axisZ: 0, throttle: 0, steer: 0, brake: false };
let lastInputSendMs = 0;

// State trackers for Audio cues (Countdown, Laps, Checkpoints)
let prevCountdownSec = -1;
let prevRaceStatus = 'idle';
let prevLap = 1;
let prevMode = 'walking';

// FPS & HUD Throttle Timers
let frameCount = 0;
let fpsAccumTime = 0;
let hudAccumTime = 0;
let lastTime = performance.now();

function animate(currentTime: number): void {
  requestAnimationFrame(animate);

  const rawDt = (currentTime - lastTime) * 0.001;
  const dt = Math.min(0.1, rawDt);
  lastTime = currentTime;

  frameCount++;
  fpsAccumTime += rawDt;
  hudAccumTime += rawDt;

  if (fpsAccumTime >= 0.5) {
    hud.updateFPS(frameCount / fpsAccumTime);
    frameCount = 0;
    fpsAccumTime = 0;
  }

  // Sample inputs locally every frame for zero-latency dead-reckoning
  inputManager.cameraYaw = world.cameraFollow.currentYaw;
  latestAxes = inputManager.sample();

  // Immediately transmit input on key/pedal transition OR every 33ms (30Hz)
  if (network.localPlayerId) {
    const inputChanged =
      Math.abs(latestAxes.axisX - lastSentAxes.axisX) > 0.02 ||
      Math.abs(latestAxes.axisZ - lastSentAxes.axisZ) > 0.02 ||
      Math.abs(latestAxes.throttle - lastSentAxes.throttle) > 0.02 ||
      Math.abs(latestAxes.steer - lastSentAxes.steer) > 0.02 ||
      latestAxes.brake !== lastSentAxes.brake;

    if ((inputChanged && currentTime - lastInputSendMs >= 14) || currentTime - lastInputSendMs >= 33) {
      lastInputSendMs = currentTime;
      lastSentAxes = { ...latestAxes };
      network.sendInput(latestAxes);
    }
  }

  const state = network.getInterpolatedState(latestAxes);
  if (state) {
    const localPlayer = state.players[network.localPlayerId];

    let nearbyVehicle: { id: string; availableSeat: 0 | 1 | null } | null = null;
    let currentCarSpeed = 0;

    if (localPlayer) {
      if (localPlayer.mode === 'walking') {
        if (prevMode !== 'walking') {
          audio.stopEngine();
          audio.updateTireScreech(false, 0);
        }
        let closestDistSq = LIMITS.enterDistance * LIMITS.enterDistance;
        for (const [vId, veh] of Object.entries(state.vehicles)) {
          const dx = localPlayer.x - veh.x;
          const dz = localPlayer.z - veh.z;
          const distSq = dx * dx + dz * dz;
          if (distSq <= closestDistSq && Math.abs(veh.speed) <= LIMITS.enterMaxSpeed) {
            closestDistSq = distSq;
            let seat: 0 | 1 | null = null;
            if (veh.seats[0] === '') seat = 0;
            else if (veh.seats[1] === '') seat = 1;

            nearbyVehicle = { id: vId, availableSeat: seat };
          }
        }
      } else {
        const drivenCar = state.vehicles[localPlayer.vehicleId];
        if (drivenCar) {
          currentCarSpeed = drivenCar.speed;
        }
        if (prevMode === 'walking') {
          audio.startEngine();
        }
        const kmh = Math.abs(currentCarSpeed) * 3.6;
        audio.updateEngine(kmh, latestAxes.throttle);

        const isSliding =
          kmh > 26 && (Math.abs(latestAxes.steer) > 0.55 || latestAxes.brake);
        audio.updateTireScreech(isSliding, Math.min(1, kmh / 65));
      }
      prevMode = localPlayer.mode;

      // Throttle DOM & 2D Radar updates to ~15 Hz (every 66ms) to eliminate layout thrashing
      if (hudAccumTime >= 0.066) {
        hudAccumTime = 0;

        if (speedLinesEl) {
          const kmh = Math.abs(currentCarSpeed) * 3.6;
          speedLinesEl.style.opacity = kmh > 42 ? `${Math.min(0.85, (kmh - 42) / 35)}` : '0';
        }

        const race = state.race;
        if (race) {
          if (race.status === 'countdown' && race.countdownSeconds !== prevCountdownSec) {
            prevCountdownSec = race.countdownSeconds;
            audio.playCountdownBeep(race.countdownSeconds === 0);
          } else if (race.status === 'racing' && prevRaceStatus === 'countdown') {
            audio.playCountdownBeep(true);
          }

          const localPart = race.participants[localPlayer.id];
          if (localPart) {
            if (localPart.currentLap > prevLap) {
              prevLap = localPart.currentLap;
              audio.playLapFanfare();
            } else if (race.status !== 'racing') {
              prevLap = 1;
            }
          }
          prevRaceStatus = race.status;
        }

        hud.updateGameHUD({
          roomId: network.roomId,
          localPlayer,
          nearbyVehicle,
          carSpeed: currentCarSpeed,
          delivery: state.delivery,
          race: state.race,
        });

        radar.render(state, network.localPlayerId, currentTime * 0.001);
      }
    }

    world.update(state, network.localPlayerId, dt);
  }
}

requestAnimationFrame(animate);
