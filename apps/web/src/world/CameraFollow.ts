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
    const desiredDistance = isVehicle ? 8.5 : 5.5;
    const desiredHeight = isVehicle ? 3.2 : 2.0;

    // Smoothly adjust distance
    this.currentDistance += (desiredDistance - this.currentDistance) * Math.min(1, dt * 5);

    // If not orbiting manually, gently align camera behind heading
    if (!this.isOrbiting) {
      let yawDiff = targetYaw - this.currentYaw;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      const alignSpeed = isVehicle ? 4.5 : 2.5;
      this.currentYaw += yawDiff * Math.min(1, dt * alignSpeed);
    }

    this.targetPosition.set(targetX, targetY + desiredHeight, targetZ);

    // Calculate camera offset behind the target using currentYaw & currentPitch
    // Yaw 0 looks along +Z, camera placed at -Z
    const cosPitch = Math.cos(this.currentPitch);
    const sinPitch = Math.sin(this.currentPitch);
    const sinYaw = Math.sin(this.currentYaw);
    const cosYaw = Math.cos(this.currentYaw);

    const offsetX = -sinYaw * cosPitch * this.currentDistance;
    const offsetY = sinPitch * this.currentDistance + desiredHeight;
    const offsetZ = -cosYaw * cosPitch * this.currentDistance;

    const desiredCamPos = new THREE.Vector3(
      targetX + offsetX,
      targetY + offsetY,
      targetZ + offsetZ
    );

    // Smooth camera damping
    const dampFactor = Math.min(1, dt * 10);
    this.smoothedPosition.lerp(desiredCamPos, dampFactor);
    this.camera.position.copy(this.smoothedPosition);

    // Look slightly above the target
    this.camera.lookAt(targetX, targetY + 1.2, targetZ);
  }
}
