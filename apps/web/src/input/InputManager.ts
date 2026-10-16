export interface InputAxes {
  axisX: number;
  axisZ: number;
  throttle: number;
  steer: number;
  brake: boolean;
}

export type InteractCallback = () => void;

export interface TouchControlBindings {
  joystickZone: HTMLElement | null;
  joystickKnob: HTMLElement | null;
  enterBtn: HTMLElement | null;
  steerLeftBtn: HTMLElement | null;
  steerRightBtn: HTMLElement | null;
  gasBtn: HTMLElement | null;
  brakeBtn: HTMLElement | null;
  driftBtn: HTMLElement | null;
}

export class InputManager {
  private keysHeld = new Set<string>();
  private interactCallbacks: InteractCallback[] = [];

  // Touch joystick state (used for walking & optional steering)
  private joystickTouchId: number | null = null;
  private joystickStartX = 0;
  private joystickStartY = 0;
  private joystickDeltaX = 0;
  private joystickDeltaY = 0;

  // Dedicated mobile driving pedals & buttons
  private touchSteerLeft = false;
  private touchSteerRight = false;
  private touchGas = false;
  private touchReverseBrake = false;
  private touchDrift = false;

  private joystickKnobEl: HTMLElement | null = null;
  private joystickBaseEl: HTMLElement | null = null;

  public cameraYaw: number = 0;
  private isChatFocused = false;

  constructor() {
    this.setupKeyboard();
    this.setupWindowEvents();
  }

  private vibrate(ms = 12): void {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch {}
  }

  private bindHoldButton(
    el: HTMLElement | null,
    onChange: (active: boolean) => void
  ): void {
    if (!el) return;
    const activate = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('active');
      onChange(true);
      this.vibrate(10);
    };
    const deactivate = (e: Event) => {
      e.preventDefault();
      el.classList.remove('active');
      onChange(false);
    };

    el.addEventListener('touchstart', activate, { passive: false });
    el.addEventListener('touchend', deactivate, { passive: false });
    el.addEventListener('touchcancel', deactivate, { passive: false });
    el.addEventListener('mousedown', activate);
    el.addEventListener('mouseup', deactivate);
    el.addEventListener('mouseleave', deactivate);
  }

  public bindTouchElements(bindings: TouchControlBindings): void {
    this.joystickBaseEl = bindings.joystickZone;
    this.joystickKnobEl = bindings.joystickKnob;

    if (bindings.joystickZone) {
      bindings.joystickZone.addEventListener('touchstart', this.handleTouchStart, { passive: false });
      window.addEventListener('touchmove', this.handleTouchMove, { passive: false });
      window.addEventListener('touchend', this.handleTouchEnd);
      window.addEventListener('touchcancel', this.handleTouchEnd);
    }

    if (bindings.enterBtn) {
      const trigger = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.vibrate(18);
        this.triggerInteract();
      };
      bindings.enterBtn.addEventListener('touchstart', trigger, { passive: false });
      bindings.enterBtn.addEventListener('click', trigger);
    }

    this.bindHoldButton(bindings.steerLeftBtn, (v) => (this.touchSteerLeft = v));
    this.bindHoldButton(bindings.steerRightBtn, (v) => (this.touchSteerRight = v));
    this.bindHoldButton(bindings.gasBtn, (v) => (this.touchGas = v));
    this.bindHoldButton(bindings.brakeBtn, (v) => (this.touchReverseBrake = v));
    this.bindHoldButton(bindings.driftBtn, (v) => (this.touchDrift = v));
  }

  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      if (this.isChatFocused) return;

      const code = e.code;
      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Space',
          'ShiftLeft',
          'ShiftRight',
        ].includes(code)
      ) {
        this.keysHeld.add(code);
      }

      if (code === 'KeyE' || code === 'KeyF') {
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
    const maxRadius = 40;
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

    this.joystickDeltaX = dx / maxRadius;
    this.joystickDeltaY = -dy / maxRadius;
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
    const brake = this.keysHeld.has('Space') || this.touchDrift;

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

    // Dedicated Touch Driving Pedals & Steer Buttons
    if (this.touchGas) throttle += 1;
    if (this.touchReverseBrake) throttle -= 1;
    if (this.touchSteerLeft) steer -= 1;
    if (this.touchSteerRight) steer += 1;

    // Touch Joystick (Walking + fallback steering)
    if (this.joystickTouchId !== null) {
      rawX += this.joystickDeltaX;
      rawZ += this.joystickDeltaY;
      steer += this.joystickDeltaX;
      if (!this.touchGas && !this.touchReverseBrake) {
        throttle += this.joystickDeltaY;
      }
    }

    throttle = Math.max(-1, Math.min(1, throttle));
    steer = Math.max(-1, Math.min(1, steer));

    const sinY = Math.sin(this.cameraYaw);
    const cosY = Math.cos(this.cameraYaw);

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
    this.touchSteerLeft = false;
    this.touchSteerRight = false;
    this.touchGas = false;
    this.touchReverseBrake = false;
    this.touchDrift = false;
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
