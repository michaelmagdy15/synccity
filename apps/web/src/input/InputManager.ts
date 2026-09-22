export interface InputAxes {
  axisX: number;
  axisZ: number;
  throttle: number;
  steer: number;
  brake: boolean;
}

export type InteractCallback = () => void;

export class InputManager {
  private keysHeld = new Set<string>();
  private interactCallbacks: InteractCallback[] = [];

  // Touch joystick state
  private joystickTouchId: number | null = null;
  private joystickStartX = 0;
  private joystickStartY = 0;
  private joystickDeltaX = 0;
  private joystickDeltaY = 0;
  private touchBrake = false;

  private joystickKnobEl: HTMLElement | null = null;
  private joystickBaseEl: HTMLElement | null = null;

  public cameraYaw: number = 0;
  private isChatFocused = false;

  constructor() {
    this.setupKeyboard();
    this.setupWindowEvents();
  }

  public bindTouchElements(
    joystickZone: HTMLElement | null,
    joystickKnob: HTMLElement | null,
    enterBtn: HTMLElement | null,
    brakeBtn: HTMLElement | null
  ): void {
    this.joystickBaseEl = joystickZone;
    this.joystickKnobEl = joystickKnob;

    if (joystickZone) {
      joystickZone.addEventListener('touchstart', this.handleTouchStart, { passive: false });
      window.addEventListener('touchmove', this.handleTouchMove, { passive: false });
      window.addEventListener('touchend', this.handleTouchEnd);
      window.addEventListener('touchcancel', this.handleTouchEnd);
    }

    if (enterBtn) {
      enterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.triggerInteract();
      });
      enterBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.triggerInteract();
      }, { passive: false });
    }

    if (brakeBtn) {
      brakeBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.touchBrake = true;
      }, { passive: false });
      brakeBtn.addEventListener('touchend', () => {
        this.touchBrake = false;
      });
      brakeBtn.addEventListener('touchcancel', () => {
        this.touchBrake = false;
      });
      brakeBtn.addEventListener('mousedown', () => {
        this.touchBrake = true;
      });
      window.addEventListener('mouseup', () => {
        this.touchBrake = false;
      });
    }
  }

  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      if (this.isChatFocused) return;

      const code = e.code;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
        this.keysHeld.add(code);
      }

      if (code === 'KeyE') {
        this.triggerInteract();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysHeld.delete(e.code);
    });
  }

  private setupWindowEvents(): void {
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
  }

  private handleTouchStart = (e: TouchEvent): void => {
    if (this.isChatFocused || this.joystickTouchId !== null) return;
    const touch = e.changedTouches[0];
    if (!touch || !this.joystickBaseEl) return;

    const rect = this.joystickBaseEl.getBoundingClientRect();
    this.joystickTouchId = touch.identifier;
    this.joystickStartX = rect.left + rect.width / 2;
    this.joystickStartY = rect.top + rect.height / 2;
    this.updateJoystick(touch.clientX, touch.clientY);
    e.preventDefault();
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (this.joystickTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.joystickTouchId) {
        this.updateJoystick(touch.clientX, touch.clientY);
        e.preventDefault();
        break;
      }
    }
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    if (this.joystickTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.joystickTouchId) {
        this.joystickTouchId = null;
        this.joystickDeltaX = 0;
        this.joystickDeltaY = 0;
        if (this.joystickKnobEl) {
          this.joystickKnobEl.style.transform = 'translate(0px, 0px)';
        }
        break;
      }
    }
  };

  private updateJoystick(clientX: number, clientY: number): void {
    const maxRadius = 45;
    let dx = clientX - this.joystickStartX;
    let dy = clientY - this.joystickStartY;

    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    if (this.joystickKnobEl) {
      this.joystickKnobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    // Normalize to [-1, 1]
    this.joystickDeltaX = dx / maxRadius;
    this.joystickDeltaY = -dy / maxRadius; // Up is positive
  }

  public setChatFocus(focused: boolean): void {
    this.isChatFocused = focused;
    if (focused) {
      this.reset();
    }
  }

  public onInteract(cb: InteractCallback): void {
    this.interactCallbacks.push(cb);
  }

  private triggerInteract(): void {
    this.interactCallbacks.forEach((cb) => cb());
  }

  public sample(): InputAxes {
    if (this.isChatFocused) {
      return { axisX: 0, axisZ: 0, throttle: 0, steer: 0, brake: false };
    }

    let rawX = 0;
    let rawZ = 0;
    let throttle = 0;
    let steer = 0;
    let brake = this.keysHeld.has('Space') || this.touchBrake;

    // Keyboard inputs
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) {
      rawZ += 1;
      throttle += 1;
    }
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) {
      rawZ -= 1;
      throttle -= 1;
    }
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) {
      rawX -= 1;
      steer -= 1;
    }
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) {
      rawX += 1;
      steer += 1;
    }

    // Merge Touch joystick inputs if active
    if (this.joystickTouchId !== null) {
      rawX += this.joystickDeltaX;
      rawZ += this.joystickDeltaY;
      steer += this.joystickDeltaX;
      throttle += this.joystickDeltaY;
    }

    // Clamp driving inputs to [-1, 1]
    throttle = Math.max(-1, Math.min(1, throttle));
    steer = Math.max(-1, Math.min(1, steer));

    // Convert camera-relative walking input to world-space X/Z
    // cameraYaw 0 = looking +Z, PI/2 = looking +X
    const sinY = Math.sin(this.cameraYaw);
    const cosY = Math.cos(this.cameraYaw);

    // When facing +Z (cameraYaw = 0), screen right is -X, screen left is +X
    // Camera forward F = (sinY, cosY), Camera right R = (-cosY, sinY)
    const worldAxisX = -rawX * cosY + rawZ * sinY;
    const worldAxisZ = rawX * sinY + rawZ * cosY;

    return {
      axisX: Math.max(-1, Math.min(1, worldAxisX)),
      axisZ: Math.max(-1, Math.min(1, worldAxisZ)),
      throttle,
      steer,
      brake,
    };
  }

  public reset(): void {
    this.keysHeld.clear();
    this.touchBrake = false;
    this.joystickTouchId = null;
    this.joystickDeltaX = 0;
    this.joystickDeltaY = 0;
    if (this.joystickKnobEl) {
      this.joystickKnobEl.style.transform = 'translate(0px, 0px)';
    }
  }

  public dispose(): void {
    this.reset();
    this.interactCallbacks = [];
  }
}
