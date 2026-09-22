import './style.css';
import { LIMITS } from '@synccity/shared/protocol';
import { HUD } from './ui/HUD.js';
import { InputManager } from './input/InputManager.js';
import { NetworkClient } from './network/NetworkClient.js';
import { World } from './world/World.js';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const uiRoot = document.querySelector<HTMLElement>('#ui-root');

if (!canvas || !uiRoot) {
  throw new Error('Missing essential DOM mounting elements');
}

// 1. Initialize World (Renderer & Camera)
const world = new World(canvas);

// 2. Initialize Network Client
const network = new NetworkClient();

// 3. Initialize Input Manager
const inputManager = new InputManager();

// 4. Initialize HUD Overlay
const hud = new HUD(uiRoot, {
  onJoin: async (displayName, roomId, isCreate) => {
    await network.connect(displayName, roomId, isCreate);
  },
  onSendChat: async (text) => {
    await network.sendChat(text);
  },
  onEnterVehicle: async (vehicleId, seatIndex) => {
    const res = await network.enterVehicle(vehicleId, seatIndex);
    if (!res.ok) {
      console.warn('Enter vehicle rejected:', res.code);
    }
  },
  onExitVehicle: async () => {
    const res = await network.exitVehicle();
    if (!res.ok) {
      console.warn('Exit vehicle rejected:', res.code);
    }
  },
  onStartRace: async () => {
    await network.startRace();
  },
  onChatFocusChange: (focused) => {
    inputManager.setChatFocus(focused);
  },
});

// Bind Input interaction & touch elements with HUD
inputManager.bindTouchElements(
  hud.joystickZoneEl,
  hud.joystickKnobEl,
  hud.enterBtnEl,
  hud.brakeBtnEl
);

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

// Handle window resizing
window.addEventListener('resize', () => {
  world.resize(window.innerWidth, window.innerHeight);
});

// Check if invite code was passed via URL query or hash
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room') || (window.location.hash.startsWith('#room=') ? window.location.hash.slice(6) : '');
hud.showLobby(roomParam);

// Input send timer at 20 Hz (50 ms)
setInterval(() => {
  if (!network.localPlayerId) return;
  inputManager.cameraYaw = world.cameraFollow.currentYaw;
  const axes = inputManager.sample();
  network.sendInput(axes);
}, 1000 / LIMITS.inputHz);

// Main Animation & Render Loop
let lastTime = performance.now();

function animate(currentTime: number): void {
  requestAnimationFrame(animate);

  const dt = Math.min(0.1, (currentTime - lastTime) * 0.001);
  lastTime = currentTime;

  const state = network.getInterpolatedState();
  if (state) {
    const localPlayer = state.players[network.localPlayerId];

    let nearbyVehicle: { id: string; availableSeat: 0 | 1 | null } | null = null;
    let currentCarSpeed = 0;

    if (localPlayer) {
      if (localPlayer.mode === 'walking') {
        // Find nearest car within enter distance (3m)
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
      }

      hud.updateGameHUD({
        roomId: network.roomId,
        localPlayer,
        nearbyVehicle,
        carSpeed: currentCarSpeed,
        delivery: state.delivery,
        race: state.race,
      });
    }

    world.update(state, network.localPlayerId, dt);
  }
}

requestAnimationFrame(animate);
