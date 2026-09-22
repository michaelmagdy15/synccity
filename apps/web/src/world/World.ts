import * as THREE from 'three';
import {
  CHECKPOINTS,
  CITY_BOUNDS,
  CITY_COLLIDERS,
  CITY_ROADS,
  RACE_CIRCUIT,
} from '@synccity/shared/world';
import type { StateSnapshot } from '../network/NetworkClient.js';
import { CameraFollow } from './CameraFollow.js';

export class World {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  public cameraFollow: CameraFollow;

  private avatarMeshes = new Map<string, THREE.Group>();
  private vehicleMeshes = new Map<string, THREE.Group>();
  private animatedMaterials: THREE.MeshBasicMaterial[] = [];
  private trafficLightMaterials: THREE.MeshBasicMaterial[] = [];

  private pickupBeacon!: THREE.Group;
  private destBeacon!: THREE.Group;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x100b24);
    this.scene.fog = new THREE.FogExp2(0x100b24, 0.0035);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.cameraFollow = new CameraFollow(this.camera, canvas);

    this.setupLighting();
    this.buildCity();
    this.buildCheckpoints();
  }

  private setupLighting(): void {
    // Synthwave dusk lighting
    const ambientLight = new THREE.AmbientLight(0x7844a8, 1.2);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x8b4ddb, 0x100b24, 0.9);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffd4f0, 1.5);
    sunLight.position.set(-60, 45, -60);
    this.scene.add(sunLight);

    // Neon accent lights
    const cyanLight = new THREE.DirectionalLight(0x73e6f5, 0.8);
    cyanLight.position.set(50, 20, 50);
    this.scene.add(cyanLight);

    // Distant Synthwave Sunset Disc
    const sunGeom = new THREE.CircleGeometry(75, 32);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xf26cda,
      fog: false,
      side: THREE.DoubleSide,
    });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunMesh.position.set(-320, 50, -320);
    sunMesh.lookAt(0, 0, 0);
    this.scene.add(sunMesh);
  }

  private buildCity(): void {
    // 1. Base Terrain
    const groundGeom = new THREE.PlaneGeometry(500, 500);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f0a24,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    this.scene.add(ground);

    // 2. Faint city grid mesh
    const cityGrid = new THREE.GridHelper(440, 44, 0x4a2a78, 0x1f143a);
    cityGrid.position.y = 0.005;
    this.scene.add(cityGrid);

    // 3. Asphalt Roads Network with glowing lane dividers & curbs
    this.buildRoads();

    // 4. Central Roundabout & Plaza
    this.buildCentralPlaza();

    // 5. Retro Streetlights along Avenues
    this.buildStreetlights();

    // 6. Buildings matching CITY_COLLIDERS
    this.buildBuildings();

    // 7. Race Circuit Gantry & Checkpoint Gates
    this.buildRaceGates();
  }

  private buildRoads(): void {
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x141222,
      roughness: 0.8,
      metalness: 0.15,
    });
    const yellowStripeMat = new THREE.MeshBasicMaterial({ color: 0xffd15c });
    const cyanStripeMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5 });
    const magentaBorderMat = new THREE.MeshBasicMaterial({ color: 0xf26cda });
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x221a3e,
      roughness: 0.85,
    });

    CITY_ROADS.forEach((road) => {
      const isNS = Math.abs(road.startX - road.endX) < 1;
      const length = isNS ? Math.abs(road.endZ - road.startZ) : Math.abs(road.endX - road.startX);
      const centerX = (road.startX + road.endX) / 2;
      const centerZ = (road.startZ + road.endZ) / 2;

      // Road Surface Mesh
      const roadGeom = isNS
        ? new THREE.PlaneGeometry(road.width, length)
        : new THREE.PlaneGeometry(length, road.width);
      const roadMesh = new THREE.Mesh(roadGeom, roadMat);
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.position.set(centerX, 0.015, centerZ);
      this.scene.add(roadMesh);

      // Sidewalk Curbs along both flanks
      const curbWidth = 1.8;
      const curbHeight = 0.14;
      const offsetDist = road.width / 2 + curbWidth / 2;

      if (isNS) {
        const curbGeom = new THREE.BoxGeometry(curbWidth, curbHeight, length);
        const curbWest = new THREE.Mesh(curbGeom, sidewalkMat);
        curbWest.position.set(centerX - offsetDist, curbHeight / 2, centerZ);
        const curbEast = new THREE.Mesh(curbGeom, sidewalkMat);
        curbEast.position.set(centerX + offsetDist, curbHeight / 2, centerZ);
        this.scene.add(curbWest, curbEast);

        // Neon road edge border lines
        const borderGeom = new THREE.PlaneGeometry(0.18, length);
        const bL = new THREE.Mesh(borderGeom, magentaBorderMat);
        bL.rotation.x = -Math.PI / 2;
        bL.position.set(centerX - road.width / 2 + 0.2, 0.02, centerZ);
        const bR = new THREE.Mesh(borderGeom, magentaBorderMat);
        bR.rotation.x = -Math.PI / 2;
        bR.position.set(centerX + road.width / 2 - 0.2, 0.02, centerZ);
        this.scene.add(bL, bR);

        // Center dashed lines
        const numDashes = Math.floor(length / 8);
        for (let i = 0; i < numDashes; i++) {
          const minZ = Math.min(road.startZ, road.endZ);
          const dashZ = minZ + i * 8 + 4;
          const dashGeom = new THREE.PlaneGeometry(0.3, 4);
          const dash = new THREE.Mesh(dashGeom, road.lanes === 4 ? yellowStripeMat : cyanStripeMat);
          dash.rotation.x = -Math.PI / 2;
          dash.position.set(centerX, 0.025, dashZ);
          this.scene.add(dash);
        }
      } else {
        const curbGeom = new THREE.BoxGeometry(length, curbHeight, curbWidth);
        const curbNorth = new THREE.Mesh(curbGeom, sidewalkMat);
        curbNorth.position.set(centerX, curbHeight / 2, centerZ - offsetDist);
        const curbSouth = new THREE.Mesh(curbGeom, sidewalkMat);
        curbSouth.position.set(centerX, curbHeight / 2, centerZ + offsetDist);
        this.scene.add(curbNorth, curbSouth);

        const borderGeom = new THREE.PlaneGeometry(length, 0.18);
        const bN = new THREE.Mesh(borderGeom, magentaBorderMat);
        bN.rotation.x = -Math.PI / 2;
        bN.position.set(centerX, 0.02, centerZ - road.width / 2 + 0.2);
        const bS = new THREE.Mesh(borderGeom, magentaBorderMat);
        bS.rotation.x = -Math.PI / 2;
        bS.position.set(centerX, 0.02, centerZ + road.width / 2 - 0.2);
        this.scene.add(bN, bS);

        const numDashes = Math.floor(length / 8);
        for (let i = 0; i < numDashes; i++) {
          const minX = Math.min(road.startX, road.endX);
          const dashX = minX + i * 8 + 4;
          const dashGeom = new THREE.PlaneGeometry(4, 0.3);
          const dash = new THREE.Mesh(dashGeom, road.lanes === 4 ? yellowStripeMat : cyanStripeMat);
          dash.rotation.x = -Math.PI / 2;
          dash.position.set(dashX, 0.025, centerZ);
          this.scene.add(dash);
        }
      }
    });
  }

  private buildCentralPlaza(): void {
    // Roundabout road ring
    const ringGeom = new THREE.RingGeometry(6.5, 15.5, 48);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x141222, roughness: 0.8 });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 0.016, 0);
    this.scene.add(ringMesh);

    // Glowing roundabout divider
    const dividerGeom = new THREE.RingGeometry(10.8, 11.2, 48);
    const dividerMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5, side: THREE.DoubleSide });
    const dividerMesh = new THREE.Mesh(dividerGeom, dividerMat);
    dividerMesh.rotation.x = -Math.PI / 2;
    dividerMesh.position.set(0, 0.025, 0);
    this.scene.add(dividerMesh);

    // Central circular sidewalk island
    const islandGeom = new THREE.CylinderGeometry(6.4, 6.4, 0.2, 32);
    const islandMat = new THREE.MeshStandardMaterial({ color: 0x221a3e, roughness: 0.85 });
    const island = new THREE.Mesh(islandGeom, islandMat);
    island.position.set(0, 0.1, 0);
    this.scene.add(island);

    // Central Plaza Monument
    const prismGeom = new THREE.OctahedronGeometry(2.8, 0);
    const prismMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5, wireframe: true });
    const prism = new THREE.Mesh(prismGeom, prismMat);
    prism.position.set(0, 4.5, 0);
    this.scene.add(prism);

    // Crosswalks at roundabout entrances
    const crosswalkOffsets = [
      { x: 0, z: 18, isHoriz: true },
      { x: 0, z: -18, isHoriz: true },
      { x: 18, z: 0, isHoriz: false },
      { x: -18, z: 0, isHoriz: false },
    ];
    crosswalkOffsets.forEach(({ x, z, isHoriz }) => {
      const cwGroup = new THREE.Group();
      cwGroup.position.set(x, 0.022, z);
      for (let s = -5; s <= 5; s += 2) {
        const stripeGeom = isHoriz ? new THREE.PlaneGeometry(1.2, 2.5) : new THREE.PlaneGeometry(2.5, 1.2);
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf5f2ff });
        const stripe = new THREE.Mesh(stripeGeom, stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        if (isHoriz) stripe.position.x = s;
        else stripe.position.z = s;
        cwGroup.add(stripe);
      }
      this.scene.add(cwGroup);
    });
  }

  private buildStreetlights(): void {
    const postGeom = new THREE.CylinderGeometry(0.08, 0.1, 4.8, 8);
    const armGeom = new THREE.BoxGeometry(0.8, 0.08, 0.08);
    const headGeom = new THREE.BoxGeometry(0.35, 0.15, 0.5);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x221a36, roughness: 0.5 });
    const lanternMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5 });

    const createLight = (x: number, z: number, rotY: number) => {
      const sl = new THREE.Group();
      sl.position.set(x, 0, z);
      sl.rotation.y = rotY;

      const post = new THREE.Mesh(postGeom, metalMat);
      post.position.y = 2.4;
      sl.add(post);

      const arm = new THREE.Mesh(armGeom, metalMat);
      arm.position.set(0.4, 4.7, 0);
      sl.add(arm);

      const head = new THREE.Mesh(headGeom, lanternMat);
      head.position.set(0.7, 4.6, 0);
      sl.add(head);

      this.scene.add(sl);
    };

    // Streetlights along Grand Boulevard
    for (let z = -170; z <= 170; z += 34) {
      if (Math.abs(z) < 22) continue;
      createLight(-9.5, z, 0);
      createLight(9.5, z, Math.PI);
    }

    // Streetlights along Grand Avenue
    for (let x = -170; x <= 170; x += 34) {
      if (Math.abs(x) < 22) continue;
      createLight(x, -9.5, Math.PI / 2);
      createLight(x, 9.5, -Math.PI / 2);
    }
  }

  private buildBuildings(): void {
    CITY_COLLIDERS.forEach((b) => {
      if (b.id === 'plaza_center') return;

      const width = b.maxX - b.minX;
      const depth = b.maxZ - b.minZ;
      const height = b.height;
      const posX = (b.minX + b.maxX) / 2;
      const posZ = (b.minZ + b.maxZ) / 2;

      const group = new THREE.Group();
      group.position.set(posX, height / 2, posZ);

      // Building main body
      const geom = new THREE.BoxGeometry(width, height, depth);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1b1434,
        roughness: 0.6,
        metalness: 0.35,
      });
      const mesh = new THREE.Mesh(geom, mat);
      group.add(mesh);

      // Emissive neon roof edge trim
      const edgeGeom = new THREE.BoxGeometry(width + 0.2, 0.4, depth + 0.2);
      const isCyan = (Math.abs(Math.round(b.minX)) + Math.abs(Math.round(b.minZ))) % 2 === 0;
      const edgeColor = isCyan ? 0x73e6f5 : 0xf26cda;
      const edgeMat = new THREE.MeshBasicMaterial({ color: edgeColor });
      const edgeMesh = new THREE.Mesh(edgeGeom, edgeMat);
      edgeMesh.position.y = height / 2;
      group.add(edgeMesh);

      // Emissive multi-tier window bands
      if (height > 16) {
        const bands = Math.min(4, Math.floor(height / 10));
        for (let i = 1; i <= bands; i++) {
          const bandGeom = new THREE.BoxGeometry(width + 0.15, 0.35, depth + 0.15);
          const bandMesh = new THREE.Mesh(bandGeom, edgeMat);
          bandMesh.position.y = -height / 2 + (height / (bands + 1)) * i;
          group.add(bandMesh);
        }
      }

      // Rooftop antennas / spires on tall skyscrapers
      if (height >= 40) {
        const spireGeom = new THREE.CylinderGeometry(0.1, 0.4, 10, 8);
        const spireMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5 });
        const spire = new THREE.Mesh(spireGeom, spireMat);
        spire.position.y = height / 2 + 5;
        group.add(spire);

        const beaconGeom = new THREE.SphereGeometry(0.35, 8, 8);
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
        const beacon = new THREE.Mesh(beaconGeom, beaconMat);
        beacon.position.y = height / 2 + 10;
        group.add(beacon);
      }

      this.scene.add(group);
    });
  }

  private buildRaceGates(): void {
    // 1. Start / Finish Gantry at Gate 0 (z = 25 on Grand Boulevard)
    const gantry = new THREE.Group();
    gantry.position.set(0, 0, 25);

    const pMat = new THREE.MeshStandardMaterial({ color: 0x16102b, roughness: 0.4 });
    const archMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5 });

    // Left and Right Truss Towers
    const towerGeom = new THREE.BoxGeometry(0.8, 6.0, 0.8);
    const tL = new THREE.Mesh(towerGeom, pMat);
    tL.position.set(-8.8, 3.0, 0);
    const tR = new THREE.Mesh(towerGeom, pMat);
    tR.position.set(8.8, 3.0, 0);
    gantry.add(tL, tR);

    // Overhead Bridge
    const bridgeGeom = new THREE.BoxGeometry(18.4, 0.8, 1.0);
    const bridge = new THREE.Mesh(bridgeGeom, pMat);
    bridge.position.set(0, 5.8, 0);
    gantry.add(bridge);

    // Checkered neon finish banner
    const bannerGeom = new THREE.BoxGeometry(14.0, 0.7, 0.1);
    const banner = new THREE.Mesh(bannerGeom, archMat);
    banner.position.set(0, 5.8, 0.55);
    gantry.add(banner);

    // 3 Traffic Light Globes (Red, Yellow, Green)
    const lightGeom = new THREE.SphereGeometry(0.32, 16, 16);
    const redMat = new THREE.MeshBasicMaterial({ color: 0x330000 });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0x332200 });
    const greenMat = new THREE.MeshBasicMaterial({ color: 0x003300 });
    this.trafficLightMaterials = [redMat, yellowMat, greenMat];

    const lRed = new THREE.Mesh(lightGeom, redMat);
    lRed.position.set(-1.2, 5.8, 0.7);
    const lYellow = new THREE.Mesh(lightGeom, yellowMat);
    lYellow.position.set(0, 5.8, 0.7);
    const lGreen = new THREE.Mesh(lightGeom, greenMat);
    lGreen.position.set(1.2, 5.8, 0.7);
    gantry.add(lRed, lYellow, lGreen);

    // Starting grid painted lines on asphalt
    for (let slot = 0; slot < 4; slot++) {
      const gz = 16 - slot * 6;
      const gx = slot % 2 === 0 ? -4 : 4;
      const gridGeom = new THREE.PlaneGeometry(3.5, 0.4);
      const gridMat = new THREE.MeshBasicMaterial({ color: 0xffd15c });
      const gridLine = new THREE.Mesh(gridGeom, gridMat);
      gridLine.rotation.x = -Math.PI / 2;
      gridLine.position.set(gx, 0.024, gz);
      this.scene.add(gridLine);
    }

    this.scene.add(gantry);

    // 2. Checkpoint gates along the circuit
    for (let i = 1; i < RACE_CIRCUIT.length; i++) {
      const gate = RACE_CIRCUIT[i];
      const gateGroup = new THREE.Group();
      gateGroup.position.set(gate.x, 0, gate.z);
      gateGroup.rotation.y = gate.yaw;

      const pillarGeom = new THREE.CylinderGeometry(0.2, 0.35, 5, 8);
      const pillarMat = new THREE.MeshBasicMaterial({ color: 0xf26cda });
      const p1 = new THREE.Mesh(pillarGeom, pillarMat);
      p1.position.set(-gate.radius * 0.7, 2.5, 0);
      const p2 = new THREE.Mesh(pillarGeom, pillarMat);
      p2.position.set(gate.radius * 0.7, 2.5, 0);
      gateGroup.add(p1, p2);

      const chevronGeom = new THREE.OctahedronGeometry(0.8, 0);
      const chevronMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5, wireframe: true });
      const chevron = new THREE.Mesh(chevronGeom, chevronMat);
      chevron.position.set(0, 5.2, 0);
      gateGroup.add(chevron);

      const ringGeom = new THREE.RingGeometry(gate.radius - 1, gate.radius, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x73e6f5,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      gateGroup.add(ring);
      this.animatedMaterials.push(ringMat);

      this.scene.add(gateGroup);
    }
  }

  private buildCheckpoints(): void {
    // Pickup Beacon (Cyan)
    this.pickupBeacon = this.createBeaconGroup(CHECKPOINTS.pickup.x, CHECKPOINTS.pickup.z, 0x73e6f5);
    this.scene.add(this.pickupBeacon);

    // Destination Beacon (Magenta)
    this.destBeacon = this.createBeaconGroup(CHECKPOINTS.destination.x, CHECKPOINTS.destination.z, 0xf26cda);
    this.scene.add(this.destBeacon);
  }

  private createBeaconGroup(x: number, z: number, color: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Vertical light beam
    const beamGeom = new THREE.CylinderGeometry(0.3, 0.8, 18, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeom, beamMat);
    beam.position.y = 9;
    group.add(beam);

    // Animated ground pulse ring
    const ringGeom = new THREE.RingGeometry(6.2, 7.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    group.add(ring);
    this.animatedMaterials.push(ringMat);

    return group;
  }

  public update(snapshot: StateSnapshot, localPlayerId: string, dt: number): void {
    const time = performance.now() * 0.001;

    // 1. Animate beacons
    const pulse = 0.6 + Math.sin(time * 3.5) * 0.35;
    this.animatedMaterials.forEach((mat) => {
      mat.opacity = pulse;
    });

    // 2. Animate traffic lights on start/finish gantry
    if (this.trafficLightMaterials.length === 3) {
      const race = snapshot.race;
      if (race && race.status === 'countdown') {
        const sec = race.countdownSeconds;
        this.trafficLightMaterials[0].color.setHex(sec >= 3 ? 0xff0033 : 0x330000); // Red
        this.trafficLightMaterials[1].color.setHex(sec === 2 ? 0xffbb00 : 0x332200); // Yellow
        this.trafficLightMaterials[2].color.setHex(sec === 1 ? 0x00ff66 : 0x003300); // Green
      } else if (race && race.status === 'racing') {
        this.trafficLightMaterials[0].color.setHex(0x330000);
        this.trafficLightMaterials[1].color.setHex(0x332200);
        this.trafficLightMaterials[2].color.setHex(0x00ff66); // Green GO
      } else {
        this.trafficLightMaterials[0].color.setHex(0x330000);
        this.trafficLightMaterials[1].color.setHex(0x332200);
        this.trafficLightMaterials[2].color.setHex(0x003300);
      }
    }

    if (snapshot.delivery.phase === 'available') {
      this.pickupBeacon.visible = true;
      this.destBeacon.visible = false;
    } else if (snapshot.delivery.phase === 'active') {
      this.pickupBeacon.visible = false;
      this.destBeacon.visible = true;
    } else {
      this.pickupBeacon.visible = false;
      this.destBeacon.visible = false;
    }

    // 2. Update Vehicles
    const activeVehicles = new Set<string>();
    for (const [id, veh] of Object.entries(snapshot.vehicles)) {
      activeVehicles.add(id);
      let mesh = this.vehicleMeshes.get(id);
      if (!mesh) {
        mesh = this.createVehicleMesh();
        this.vehicleMeshes.set(id, mesh);
        this.scene.add(mesh);
      }

      mesh.position.set(veh.x, veh.y, veh.z);
      mesh.rotation.y = veh.yaw;

      // Rotate wheels if moving
      const wheels = (mesh as any)._wheels as THREE.Mesh[];
      if (wheels && Math.abs(veh.speed) > 0.05) {
        const wheelRotSpeed = (veh.speed / 0.4) * dt;
        wheels.forEach((w) => {
          w.rotation.x += wheelRotSpeed;
        });
      }
    }

    // Cleanup dead vehicles
    for (const [id, mesh] of this.vehicleMeshes.entries()) {
      if (!activeVehicles.has(id)) {
        this.scene.remove(mesh);
        this.vehicleMeshes.delete(id);
      }
    }

    // 3. Update Avatars
    const activePlayers = new Set<string>();
    let localTransform = { x: 0, y: 0, z: 0, yaw: 0, isVehicle: false };

    for (const [id, player] of Object.entries(snapshot.players)) {
      activePlayers.add(id);
      let avatar = this.avatarMeshes.get(id);
      if (!avatar) {
        avatar = this.createAvatarMesh(player.displayName, id === localPlayerId);
        this.avatarMeshes.set(id, avatar);
        this.scene.add(avatar);
      }

      avatar.position.set(player.x, player.y, player.z);
      avatar.rotation.y = player.yaw;

      // Seated avatar pose vs walking pose
      const bodyMesh = (avatar as any)._bodyMesh as THREE.Mesh;
      if (player.mode === 'walking') {
        avatar.visible = true;
        bodyMesh.scale.set(1, 1, 1);
      } else {
        // Seated in car
        avatar.visible = true;
        bodyMesh.scale.set(1, 0.75, 1); // Crouch slightly in seat
      }

      if (id === localPlayerId) {
        const isSeated = player.mode !== 'walking';
        localTransform = {
          x: player.x,
          y: player.y,
          z: player.z,
          yaw: player.yaw,
          isVehicle: isSeated,
        };
      }
    }

    // Cleanup disconnected players
    for (const [id, avatar] of this.avatarMeshes.entries()) {
      if (!activePlayers.has(id)) {
        this.scene.remove(avatar);
        this.avatarMeshes.delete(id);
      }
    }

    // 4. Update Camera Follow
    if (activePlayers.has(localPlayerId)) {
      this.cameraFollow.update(
        localTransform.x,
        localTransform.y,
        localTransform.z,
        localTransform.yaw,
        localTransform.isVehicle,
        dt
      );
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  private createVehicleMesh(): THREE.Group {
    const car = new THREE.Group();

    // Main Chassis: Wedge sports coupe
    const chassisGeom = new THREE.BoxGeometry(1.8, 0.5, 3.8);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x1f143a,
      metalness: 0.6,
      roughness: 0.3,
    });
    const chassis = new THREE.Mesh(chassisGeom, chassisMat);
    chassis.position.y = 0.45;
    car.add(chassis);

    // Cyan racing bonnet stripe
    const stripeGeom = new THREE.BoxGeometry(0.5, 0.05, 3.82);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5 });
    const stripe = new THREE.Mesh(stripeGeom, stripeMat);
    stripe.position.y = 0.71;
    car.add(stripe);

    // Windshield & Cabin Cockpit
    const cabinGeom = new THREE.BoxGeometry(1.5, 0.45, 1.8);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x100a20,
      metalness: 0.8,
      roughness: 0.2,
    });
    const cabin = new THREE.Mesh(cabinGeom, cabinMat);
    cabin.position.set(0, 0.85, -0.2);
    car.add(cabin);

    // Two bucket seats (Left: Driver, Right: Passenger)
    const seatGeom = new THREE.BoxGeometry(0.5, 0.4, 0.5);
    const driverSeatMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5 }); // Cyan for driver
    const passSeatMat = new THREE.MeshBasicMaterial({ color: 0xf26cda });   // Magenta for passenger

    const driverSeat = new THREE.Mesh(seatGeom, driverSeatMat);
    driverSeat.position.set(0.55, 0.7, -0.1);
    car.add(driverSeat);

    const passSeat = new THREE.Mesh(seatGeom, passSeatMat);
    passSeat.position.set(-0.55, 0.7, -0.1);
    car.add(passSeat);

    // Headlights (Cyan emissive)
    const hlGeom = new THREE.BoxGeometry(0.3, 0.15, 0.1);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5 });
    const hlL = new THREE.Mesh(hlGeom, hlMat);
    hlL.position.set(-0.65, 0.45, 1.91);
    const hlR = new THREE.Mesh(hlGeom, hlMat);
    hlR.position.set(0.65, 0.45, 1.91);
    car.add(hlL, hlR);

    // Taillights (Magenta emissive)
    const tlGeom = new THREE.BoxGeometry(0.4, 0.12, 0.1);
    const tlMat = new THREE.MeshBasicMaterial({ color: 0xf26cda });
    const tlL = new THREE.Mesh(tlGeom, tlMat);
    tlL.position.set(-0.65, 0.5, -1.91);
    const tlR = new THREE.Mesh(tlGeom, tlMat);
    tlR.position.set(0.65, 0.5, -1.91);
    car.add(tlL, tlR);

    // 4 Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16);
    wheelGeom.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

    const wheels: THREE.Mesh[] = [];
    const wheelPositions = [
      [-0.95, 0.35, 1.2],
      [0.95, 0.35, 1.2],
      [-0.95, 0.35, -1.2],
      [0.95, 0.35, -1.2],
    ];

    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeom, wheelMat);
      wheel.position.set(wx, wy, wz);
      car.add(wheel);
      wheels.push(wheel);
    });

    (car as any)._wheels = wheels;
    return car;
  }

  private createAvatarMesh(name: string, isLocal: boolean): THREE.Group {
    const avatar = new THREE.Group();

    // Torso (Stylized low-poly capsule / cylinder)
    const bodyGeom = new THREE.CylinderGeometry(0.3, 0.25, 1.0, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isLocal ? 0x73e6f5 : 0x8b4ddb,
      metalness: 0.2,
      roughness: 0.6,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.7;
    avatar.add(body);
    (avatar as any)._bodyMesh = body;

    // Head
    const headGeom = new THREE.SphereGeometry(0.24, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffd1ba, roughness: 0.7 });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 1.35;
    avatar.add(head);

    // Visor indicating facing direction (+Z forward)
    const visorGeom = new THREE.BoxGeometry(0.28, 0.1, 0.12);
    const visorMat = new THREE.MeshBasicMaterial({ color: isLocal ? 0xf26cda : 0x73e6f5 });
    const visor = new THREE.Mesh(visorGeom, visorMat);
    visor.position.set(0, 1.35, 0.18);
    avatar.add(visor);

    // Nametag Billboard Sprite
    const nameSprite = this.createNameSprite(name, isLocal);
    nameSprite.position.set(0, 1.85, 0);
    avatar.add(nameSprite);

    return avatar;
  }

  private createNameSprite(text: string, isLocal: boolean): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Background pill
    ctx.fillStyle = isLocal ? 'rgba(115, 230, 245, 0.85)' : 'rgba(33, 20, 56, 0.85)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 48, 24);
    ctx.fill();

    // Text
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isLocal ? '#100b24' : '#f5f2ff';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.0, 0.5, 1.0);
    return sprite;
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  }

  public dispose(): void {
    this.renderer.dispose();
  }
}
