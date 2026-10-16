import * as THREE from 'three';

export class CameraFollow {
  public camera: THREE.PerspectiveCamera;
  public currentYaw: number = 0;
  private currentPitch: number = 0.25; // radians (tilt down)
  private currentDistance: number = 6.0;

  private targetPosition = new THREE.Vector3();
  private smoothedPosition = new THREE.Vector3(0, 5, -10);

  private isOrbiting = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.setupPointerControls(domElement);
  }

  private setupPointerControls(domElement: HTMLElement): void {
    domElement.addEventListener('pointerdown', (e) => {
      // Don't intercept touches if on UI or joystick
      if ((e.target as HTMLElement).closest('#ui-root')) return;
      this.isOrbiting = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isOrbiting) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      const sensitivity = 0.005;
      this.currentYaw -= dx * sensitivity;
      this.currentPitch = Math.max(0.05, Math.min(0.85, this.currentPitch + dy * sensitivity));
    });

    window.addEventListener('pointerup', () => {
      this.isOrbiting = false;
    });
    window.addEventListener('pointercancel', () => {
      this.isOrbiting = false;
    });
  }

  public update(
    targetX: number,
    targetY: number,
    targetZ: number,
    targetYaw: number,
    isVehicle: boolean,
    dt: number
  ): void {
    const desiredDistance = isVehicle ? 8.2 : 5.5;
    const desiredHeight = isVehicle ? 3.0 : 2.1;

    // Smoothly adjust boom distance only when switching between walking and driving
    const distBlend = 1 - Math.exp(-10 * dt);
    this.currentDistance += (desiredDistance - this.currentDistance) * distBlend;

    // If not orbiting manually, gently align camera yaw behind heading
    if (!this.isOrbiting) {
      let yawDiff = targetYaw - this.currentYaw;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      const alignSpeed = isVehicle ? 6.5 : 4.5;
      this.currentYaw += yawDiff * (1 - Math.exp(-alignSpeed * dt));
    }

    const cosPitch = Math.cos(this.currentPitch);
    const sinPitch = Math.sin(this.currentPitch);
    const sinYaw = Math.sin(this.currentYaw);
    const cosYaw = Math.cos(this.currentYaw);

    const offsetX = -sinYaw * cosPitch * this.currentDistance;
    const offsetY = sinPitch * this.currentDistance + desiredHeight;
    const offsetZ = -cosYaw * cosPitch * this.currentDistance;

    // Keep a rigid boom arm relative to the already-smoothed target so pitch never bobs up and down
    this.camera.position.set(
      targetX + offsetX,
      targetY + offsetY,
      targetZ + offsetZ
    );

    this.camera.lookAt(targetX, targetY + 1.15, targetZ);
  }
}
