import * as THREE from 'three';
import {
  CHECKPOINTS,
  CITY_COLLIDERS,
  CITY_ROADS,
  RACE_CIRCUIT,
  SPEED_BOOST_PADS,
} from '@synccity/shared/world';
import type { StateSnapshot } from '../network/NetworkClient.js';
import { CameraFollow } from './CameraFollow.js';

interface SmokeSlot {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
}

const VEHICLE_LIVERIES: { body: number; accent: number; underglow: number }[] = [
  { body: 0x161233, accent: 0x73e6f5, underglow: 0x00f0ff }, // veh_1: Cyber Cyan GT
  { body: 0xd91e47, accent: 0xffffff, underglow: 0xff2a55 }, // veh_2: DashCraft Formula Red/White
  { body: 0x261c10, accent: 0xffd15c, underglow: 0xffaa00 }, // veh_3: Solar Gold GT
  { body: 0x0f2d25, accent: 0x38ef7d, underglow: 0x00ff66 }, // veh_4: Emerald Formula Open-Wheel
  { body: 0x2a0e38, accent: 0xf26cda, underglow: 0xff2ae0 }, // veh_5: Neon Magenta GT
  { body: 0x143266, accent: 0x00e5ff, underglow: 0x00b8ff }, // veh_6: Cobalt Formula Open-Wheel
];

export class World {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  public cameraFollow: CameraFollow;

  private avatarMeshes = new Map<string, THREE.Group>();
  private vehicleMeshes = new Map<string, THREE.Group>();
  private animatedMaterials: THREE.MeshBasicMaterial[] = [];
  private trafficLightMaterials: THREE.MeshBasicMaterial[] = [];
  private rotatingCrystals: THREE.Object3D[] = [];

  private pickupBeacon!: THREE.Group;
  private destBeacon!: THREE.Group;

  // Pre-allocated zero-GC tire smoke pool
  private smokePool: SmokeSlot[] = [];
  private smokeCursor = 0;

  // Shared wheel geometry for all cars
  private sharedWheelGeom!: THREE.CylinderGeometry;
  private sharedRimGeom!: THREE.CylinderGeometry;
  private sharedTireMat!: THREE.MeshLambertMaterial;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0821);
    this.scene.fog = new THREE.FogExp2(0x0d0821, 0.0032);

    this.camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.2,
      550
    );

    const isMobileViewport = window.innerWidth <= 950 || window.innerHeight <= 480;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobileViewport && window.devicePixelRatio <= 1.5,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // DashCraft.io mobile/WebGL optimization: lock pixelRatio to 1.0 on compact mobile screens
    this.renderer.setPixelRatio(isMobileViewport ? 1.0 : Math.min(window.devicePixelRatio, 1.35));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.cameraFollow = new CameraFollow(this.camera, canvas);

    this.initSharedAssets();
    this.setupLighting();
    this.buildCity();
    this.buildCheckpoints();
    this.initSmokePool();
  }

  private initSharedAssets(): void {
    this.sharedWheelGeom = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
    this.sharedWheelGeom.rotateZ(Math.PI / 2);

    this.sharedRimGeom = new THREE.CylinderGeometry(0.22, 0.22, 0.3, 8);
    this.sharedRimGeom.rotateZ(Math.PI / 2);

    this.sharedTireMat = new THREE.MeshLambertMaterial({ color: 0x111116 });
  }

  private initSmokePool(): void {
    const geom = new THREE.DodecahedronGeometry(0.26, 0);
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xd8c8ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.smokePool.push({ mesh, mat, life: 0 });
    }
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0x7e48b8, 1.35);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x8b4ddb, 0x0d0821, 0.95);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffe0f7, 1.55);
    sunLight.position.set(-70, 55, -70);
    this.scene.add(sunLight);

    // Synthwave Horizon Sun with Retro Horizontal Cut Bars
    const sunGroup = new THREE.Group();
    sunGroup.position.set(-320, 58, -320);
    sunGroup.lookAt(0, 0, 0);

    const sunGeom = new THREE.CircleGeometry(76, 32);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xff3b9d,
      fog: false,
    });
    sunGroup.add(new THREE.Mesh(sunGeom, sunMat));

    const barMat = new THREE.MeshBasicMaterial({ color: 0x0d0821, fog: false });
    for (let i = 0; i < 5; i++) {
      const barGeom = new THREE.PlaneGeometry(160, 3.5 + i * 1.4);
      const bar = new THREE.Mesh(barGeom, barMat);
      bar.position.set(0, -12 - i * 11, 0.2);
      sunGroup.add(bar);
    }
    this.scene.add(sunGroup);
  }

  private buildCity(): void {
    // 1. Base Ground (Fast Lambert shader)
    const groundGeom = new THREE.PlaneGeometry(500, 500);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x0c071d });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    this.scene.add(ground);

    // 2. Synthwave Grid
    const cityGrid = new THREE.GridHelper(440, 44, 0x4a2a78, 0x1c1236);
    cityGrid.position.y = 0.005;
    this.scene.add(cityGrid);

    this.buildRoadsInstanced();
    this.buildCentralPlaza();
    this.buildStreetlightsInstanced();
    this.buildBuildings();
    this.buildRaceGates();
    this.buildDashCraftTrack();
  }

  /**
   * Builds all roads and merges hundreds of road dashes into 2 InstancedMesh draw calls.
   */
  private buildRoadsInstanced(): void {
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x141224 });
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x221a3e });
    const magentaBorderMat = new THREE.MeshBasicMaterial({ color: 0xf26cda });
    const yellowStripeMat = new THREE.MeshBasicMaterial({ color: 0xffd15c });
    const cyanStripeMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5 });

    const yellowDashTransforms: THREE.Matrix4[] = [];
    const cyanDashTransforms: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();

    CITY_ROADS.forEach((road) => {
      const isNS = Math.abs(road.startX - road.endX) < 1;
      const length = isNS ? Math.abs(road.endZ - road.startZ) : Math.abs(road.endX - road.startX);
      const centerX = (road.startX + road.endX) / 2;
      const centerZ = (road.startZ + road.endZ) / 2;

      const roadGeom = isNS
        ? new THREE.PlaneGeometry(road.width, length)
        : new THREE.PlaneGeometry(length, road.width);
      const roadMesh = new THREE.Mesh(roadGeom, roadMat);
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.position.set(centerX, 0.015, centerZ);
      this.scene.add(roadMesh);

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

        const borderGeom = new THREE.PlaneGeometry(0.18, length);
        const bL = new THREE.Mesh(borderGeom, magentaBorderMat);
        bL.rotation.x = -Math.PI / 2;
        bL.position.set(centerX - road.width / 2 + 0.2, 0.02, centerZ);
        const bR = new THREE.Mesh(borderGeom, magentaBorderMat);
        bR.rotation.x = -Math.PI / 2;
        bR.position.set(centerX + road.width / 2 - 0.2, 0.02, centerZ);
        this.scene.add(bL, bR);

        const numDashes = Math.floor(length / 8);
        const minZ = Math.min(road.startZ, road.endZ);
        for (let i = 0; i < numDashes; i++) {
          dummy.position.set(centerX, 0.025, minZ + i * 8 + 4);
          dummy.rotation.set(-Math.PI / 2, 0, 0);
          dummy.updateMatrix();
          (road.lanes === 4 ? yellowDashTransforms : cyanDashTransforms).push(dummy.matrix.clone());
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
        const minX = Math.min(road.startX, road.endX);
        for (let i = 0; i < numDashes; i++) {
          dummy.position.set(minX + i * 8 + 4, 0.025, centerZ);
          dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
          dummy.updateMatrix();
          (road.lanes === 4 ? yellowDashTransforms : cyanDashTransforms).push(dummy.matrix.clone());
        }
      }
    });

    const dashGeom = new THREE.PlaneGeometry(0.32, 4.0);
    if (yellowDashTransforms.length > 0) {
      const instYellow = new THREE.InstancedMesh(dashGeom, yellowStripeMat, yellowDashTransforms.length);
      yellowDashTransforms.forEach((m, i) => instYellow.setMatrixAt(i, m));
      instYellow.instanceMatrix.needsUpdate = true;
      this.scene.add(instYellow);
    }
    if (cyanDashTransforms.length > 0) {
      const instCyan = new THREE.InstancedMesh(dashGeom, cyanStripeMat, cyanDashTransforms.length);
      cyanDashTransforms.forEach((m, i) => instCyan.setMatrixAt(i, m));
      instCyan.instanceMatrix.needsUpdate = true;
      this.scene.add(instCyan);
    }
  }

  private buildCentralPlaza(): void {
    const ringGeom = new THREE.RingGeometry(6.5, 15.5, 36);
    const ringMat = new THREE.MeshLambertMaterial({ color: 0x141222 });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 0.016, 0);
    this.scene.add(ringMesh);

    const dividerGeom = new THREE.RingGeometry(10.8, 11.2, 36);
    const dividerMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5, side: THREE.DoubleSide });
    const dividerMesh = new THREE.Mesh(dividerGeom, dividerMat);
    dividerMesh.rotation.x = -Math.PI / 2;
    dividerMesh.position.set(0, 0.025, 0);
    this.scene.add(dividerMesh);

    const islandGeom = new THREE.CylinderGeometry(6.4, 6.4, 0.25, 24);
    const islandMat = new THREE.MeshLambertMaterial({ color: 0x221a3e });
    const island = new THREE.Mesh(islandGeom, islandMat);
    island.position.set(0, 0.12, 0);
    this.scene.add(island);

    // Multi-Ring Holographic Synthwave Obelisk Monument
    const monumentGroup = new THREE.Group();
    monumentGroup.position.set(0, 4.2, 0);

    const coreGeom = new THREE.OctahedronGeometry(2.4, 0);
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x73e6f5,
      emissive: 0x1a5b78,
      shininess: 120,
      flatShading: true,
    });
    const coreMesh = new THREE.Mesh(coreGeom, coreMat);
    monumentGroup.add(coreMesh);

    const gyroGeom = new THREE.TorusGeometry(3.4, 0.12, 8, 28);
    const gyroMat = new THREE.MeshBasicMaterial({ color: 0xf26cda });
    const gyroMesh = new THREE.Mesh(gyroGeom, gyroMat);
    gyroMesh.rotation.x = Math.PI / 3;
    monumentGroup.add(gyroMesh);

    this.scene.add(monumentGroup);
    this.rotatingCrystals.push(monumentGroup);
  }

  /**
   * Instanced streetlights: 3 draw calls total instead of 132.
   */
  private buildStreetlightsInstanced(): void {
    const placements: { x: number; z: number; rotY: number }[] = [];
    for (let z = -170; z <= 170; z += 34) {
      if (Math.abs(z) < 22) continue;
      placements.push({ x: -9.5, z, rotY: 0 });
      placements.push({ x: 9.5, z, rotY: Math.PI });
    }
    for (let x = -170; x <= 170; x += 34) {
      if (Math.abs(x) < 22) continue;
      placements.push({ x, z: -9.5, rotY: Math.PI / 2 });
      placements.push({ x, z: 9.5, rotY: -Math.PI / 2 });
    }

    const postGeom = new THREE.CylinderGeometry(0.08, 0.11, 4.8, 6);
    const lanternGeom = new THREE.BoxGeometry(0.45, 0.14, 0.65);
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x261d3d });
    const lanternMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5 });

    const instPosts = new THREE.InstancedMesh(postGeom, metalMat, placements.length);
    const instLanterns = new THREE.InstancedMesh(lanternGeom, lanternMat, placements.length);
    const dummy = new THREE.Object3D();

    placements.forEach((p, idx) => {
      dummy.position.set(p.x, 2.4, p.z);
      dummy.rotation.set(0, p.rotY, 0);
      dummy.updateMatrix();
      instPosts.setMatrixAt(idx, dummy.matrix);

      const cosY = Math.cos(p.rotY);
      const sinY = Math.sin(p.rotY);
      dummy.position.set(p.x + 0.65 * cosY, 4.65, p.z - 0.65 * sinY);
      dummy.rotation.set(0, p.rotY, 0);
      dummy.updateMatrix();
      instLanterns.setMatrixAt(idx, dummy.matrix);
    });

    instPosts.instanceMatrix.needsUpdate = true;
    instLanterns.instanceMatrix.needsUpdate = true;
    this.scene.add(instPosts, instLanterns);
  }

  private buildBuildings(): void {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x181130 });
    const tierMat = new THREE.MeshLambertMaterial({ color: 0x231942 });
    const cyanMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5 });
    const magentaMat = new THREE.MeshBasicMaterial({ color: 0xf26cda });
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xffd15c });

    CITY_COLLIDERS.forEach((b, idx) => {
      if (b.id === 'plaza_center') return;

      const width = b.maxX - b.minX;
      const depth = b.maxZ - b.minZ;
      const height = b.height;
      const posX = (b.minX + b.maxX) / 2;
      const posZ = (b.minZ + b.maxZ) / 2;

      const group = new THREE.Group();
      group.position.set(posX, 0, posZ);

      // Main Tower Base
      const geom = new THREE.BoxGeometry(width, height, depth);
      const mesh = new THREE.Mesh(geom, bodyMat);
      mesh.position.y = height / 2;
      group.add(mesh);

      const isCyan = idx % 2 === 0;
      const neonMat = isCyan ? cyanMat : magentaMat;

      // Stepped Crown Penthouse Tier + Rooftop Spire for Skyscrapers
      if (height >= 20) {
        const crownW = width * 0.68;
        const crownD = depth * 0.68;
        const crownH = 4.5;
        const crown = new THREE.Mesh(new THREE.BoxGeometry(crownW, crownH, crownD), tierMat);
        crown.position.y = height + crownH / 2;
        group.add(crown);

        const crownTrim = new THREE.Mesh(
          new THREE.BoxGeometry(crownW + 0.25, 0.35, crownD + 0.25),
          neonMat
        );
        crownTrim.position.y = height + crownH;
        group.add(crownTrim);

        // Glowing Rooftop Communications Spire
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.25, 6, 6), metalMatStatic);
        spire.position.y = height + crownH + 3;
        group.add(spire);

        const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), goldMat);
        beacon.position.y = height + crownH + 6.2;
        group.add(beacon);
      }

      // Roof Neon Crown Trim
      const edgeGeom = new THREE.BoxGeometry(width + 0.25, 0.4, depth + 0.25);
      const edgeMesh = new THREE.Mesh(edgeGeom, neonMat);
      edgeMesh.position.y = height;
      group.add(edgeMesh);

      // Vertical Neon Corner Fin Strips
      const finH = height * 0.85;
      const vStrip = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.3, 0.35, depth + 0.3),
        idx % 3 === 0 ? goldMat : neonMat
      );
      vStrip.position.y = finH * 0.6;
      group.add(vStrip);

      this.scene.add(group);
    });
  }

  private buildRaceGates(): void {
    // 1. Start / Finish Gantry at Gate 0 (x: 0, z: 25)
    const startGate = RACE_CIRCUIT[0];
    const gantry = new THREE.Group();
    gantry.position.set(startGate.x, 0, startGate.z);
    gantry.rotation.y = startGate.yaw;

    const pillarGeom = new THREE.CylinderGeometry(0.35, 0.45, 7.5, 8);
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x261c42 });

    const leftPillar = new THREE.Mesh(pillarGeom, pillarMat);
    leftPillar.position.set(-8.5, 3.75, 0);
    const rightPillar = new THREE.Mesh(pillarGeom, pillarMat);
    rightPillar.position.set(8.5, 3.75, 0);
    gantry.add(leftPillar, rightPillar);

    const bridgeGeom = new THREE.BoxGeometry(18, 1.2, 1.2);
    const bridgeMat = new THREE.MeshLambertMaterial({ color: 0x160f29 });
    const bridge = new THREE.Mesh(bridgeGeom, bridgeMat);
    bridge.position.set(0, 7.2, 0);
    gantry.add(bridge);

    const bannerGeom = new THREE.BoxGeometry(16, 0.28, 1.3);
    const bannerMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5 });
    const banner = new THREE.Mesh(bannerGeom, bannerMat);
    banner.position.set(0, 7.9, 0);
    gantry.add(banner);

    // Glowing 3D Sign: "BUILT BY MOTATO & MARMOURA"
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 1024;
    signCanvas.height = 128;
    const sCtx = signCanvas.getContext('2d')!;
    sCtx.fillStyle = '#120a28';
    sCtx.fillRect(0, 0, 1024, 128);
    sCtx.strokeStyle = '#73e6f5';
    sCtx.lineWidth = 6;
    sCtx.strokeRect(4, 4, 1016, 120);
    sCtx.font = '900 44px Orbitron, sans-serif';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    sCtx.fillStyle = '#ffd15c';
    sCtx.fillText('★ BUILT BY MOTATO & MARMOURA ★', 512, 66);
    const signTex = new THREE.CanvasTexture(signCanvas);
    const signBoardMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
    const signBoard = new THREE.Mesh(new THREE.PlaneGeometry(14.5, 1.8), signBoardMat);
    signBoard.position.set(0, 9.0, -0.65);
    signBoard.rotation.y = Math.PI;
    const signBoardBack = new THREE.Mesh(new THREE.PlaneGeometry(14.5, 1.8), signBoardMat);
    signBoardBack.position.set(0, 9.0, 0.65);
    gantry.add(signBoard, signBoardBack);

    // 3 Traffic Light Globes
    this.trafficLightMaterials = [
      new THREE.MeshBasicMaterial({ color: 0x330000 }),
      new THREE.MeshBasicMaterial({ color: 0x332200 }),
      new THREE.MeshBasicMaterial({ color: 0x003300 }),
    ];

    const lightOffsets = [-2.5, 0, 2.5];
    lightOffsets.forEach((lx, i) => {
      const globeGeom = new THREE.SphereGeometry(0.45, 12, 12);
      const globe = new THREE.Mesh(globeGeom, this.trafficLightMaterials[i]);
      globe.position.set(lx, 7.2, -0.7);
      gantry.add(globe);
    });

    const checkGroup = new THREE.Group();
    checkGroup.position.set(0, 0.03, 0);
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (let row = 0; row < 2; row++) {
      for (let col = -7; col <= 7; col++) {
        const sqGeom = new THREE.PlaneGeometry(1.0, 1.0);
        const isWhite = (row + col) % 2 === 0;
        const sq = new THREE.Mesh(sqGeom, isWhite ? whiteMat : blackMat);
        sq.rotation.x = -Math.PI / 2;
        sq.position.set(col * 1.0, 0, row * 1.0 - 0.5);
        checkGroup.add(sq);
      }
    }
    gantry.add(checkGroup);
    this.scene.add(gantry);

    // 2. Intermediate Checkpoint Arches + Floating Arcade Boost Prisms
    const pylonGeom = new THREE.CylinderGeometry(0.18, 0.28, 6.0, 8);
    const pylonMat = new THREE.MeshBasicMaterial({
      color: 0xffd15c,
      transparent: true,
      opacity: 0.78,
    });
    const ringGeom = new THREE.RingGeometry(startGate.radius - 0.5, startGate.radius, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd15c,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const boostCrystalGeom = new THREE.OctahedronGeometry(0.85, 0);
    const boostCrystalMat = new THREE.MeshPhongMaterial({
      color: 0x00ffcc,
      emissive: 0x00aa88,
      shininess: 140,
      flatShading: true,
    });

    for (let i = 1; i < RACE_CIRCUIT.length; i++) {
      const gate = RACE_CIRCUIT[i];
      const gateGroup = new THREE.Group();
      gateGroup.position.set(gate.x, 0, gate.z);
      gateGroup.rotation.y = gate.yaw;

      const pL = new THREE.Mesh(pylonGeom, pylonMat);
      pL.position.set(-7.5, 3.0, 0);
      const pR = new THREE.Mesh(pylonGeom, pylonMat);
      pR.position.set(7.5, 3.0, 0);
      gateGroup.add(pL, pR);

      const gRing = new THREE.Mesh(ringGeom, ringMat);
      gRing.rotation.x = -Math.PI / 2;
      gRing.position.y = 0.03;
      gateGroup.add(gRing);

      // Rotating Arcade Boost Prism suspended in the center of the gate
      const crystal = new THREE.Mesh(boostCrystalGeom, boostCrystalMat);
      crystal.position.set(0, 1.35, 0);
      gateGroup.add(crystal);
      this.rotatingCrystals.push(crystal);

      this.scene.add(gateGroup);
    }
  }

  /**
   * DashCraft-inspired modular racetrack package:
   * 1. Instanced Red & White Apex Racing Curbs (Kerbs) at circuit turns and start straight
   * 2. Glowing LED Arrow Chevron Corner Walls (">>>") guiding drivers into each turn
   * 3. Glowing Speed Booster Pads with 3 chevron arrows embedded in the track surface
   * 4. Pit-Lane Grandstand Bleachers & Canopy along the Start/Finish straight
   */
  private buildDashCraftTrack(): void {
    const dummy = new THREE.Object3D();

    // 1. Instanced Red & White Apex Racing Curbs (2 draw calls total)
    const redCurbTransforms: THREE.Matrix4[] = [];
    const whiteCurbTransforms: THREE.Matrix4[] = [];

    const addCurbStrip = (
      startX: number,
      startZ: number,
      endX: number,
      endZ: number,
      count: number
    ) => {
      const dx = (endX - startX) / count;
      const dz = (endZ - startZ) / count;
      const yaw = Math.atan2(dx, dz);
      for (let i = 0; i < count; i++) {
        dummy.position.set(startX + (i + 0.5) * dx, 0.08, startZ + (i + 0.5) * dz);
        dummy.rotation.set(0, yaw, 0);
        dummy.updateMatrix();
        (i % 2 === 0 ? redCurbTransforms : whiteCurbTransforms).push(dummy.matrix.clone());
      }
    };

    // Start/Finish Pit Straight Curbs (x = ±7.8, z = 18..90)
    addCurbStrip(-7.8, 18, -7.8, 90, 36);
    addCurbStrip(7.8, 18, 7.8, 90, 36);

    // Corner 1 Apex & Exit Curbs (0, 100 -> turning toward -X)
    addCurbStrip(-8, 92.8, -28, 92.8, 10);
    addCurbStrip(8, 107.2, -28, 107.2, 18);

    // Corner 2 Apex & Exit Curbs (-100, 100 -> turning toward -Z)
    addCurbStrip(-92.8, 92, -92.8, 72, 10);
    addCurbStrip(-107.2, 108, -107.2, 72, 18);

    // Corner 3 Apex & Exit Curbs (-100, -100 -> turning toward +X)
    addCurbStrip(-92, -92.8, -72, -92.8, 10);
    addCurbStrip(-108, -107.2, -72, -107.2, 18);

    // Corner 5 Apex & Exit Curbs (100, -100 -> turning toward +Z)
    addCurbStrip(92.8, -92, 92.8, -72, 10);
    addCurbStrip(107.2, -108, 107.2, -72, 18);

    // Corner 6 Apex & Chicane Curbs (100, 25 -> 100, 0 -> 0, 0)
    addCurbStrip(92.8, 18, 92.8, -8, 13);
    addCurbStrip(107.2, 26, 107.2, -8, 17);
    addCurbStrip(92, -7.2, 68, -7.2, 12);
    addCurbStrip(92, 7.2, 68, 7.2, 12);

    const curbBlockGeom = new THREE.BoxGeometry(0.95, 0.16, 1.95);
    const redCurbMat = new THREE.MeshBasicMaterial({ color: 0xff2a55 });
    const whiteCurbMat = new THREE.MeshBasicMaterial({ color: 0xf5f7ff });

    const instRedCurbs = new THREE.InstancedMesh(curbBlockGeom, redCurbMat, redCurbTransforms.length);
    redCurbTransforms.forEach((m, i) => instRedCurbs.setMatrixAt(i, m));
    instRedCurbs.instanceMatrix.needsUpdate = true;

    const instWhiteCurbs = new THREE.InstancedMesh(curbBlockGeom, whiteCurbMat, whiteCurbTransforms.length);
    whiteCurbTransforms.forEach((m, i) => instWhiteCurbs.setMatrixAt(i, m));
    instWhiteCurbs.instanceMatrix.needsUpdate = true;

    this.scene.add(instRedCurbs, instWhiteCurbs);

    // 2. DashCraft-Style Corner Arrow Display Boards (">>>" Chevron Walls)
    const cornerSigns: { x: number; z: number; faceYaw: number; dir: 1 | -1 }[] = [
      // Gate 1 (0, 100): Approaching +Z, turn right toward -X
      { x: 0, z: 111.5, faceYaw: Math.PI, dir: 1 },
      // Gate 2 (-100, 100): Approaching -X, turn right toward -Z
      { x: -111.5, z: 100, faceYaw: Math.PI / 2, dir: 1 },
      // Gate 3 (-100, -100): Approaching -Z, turn right toward +X
      { x: -100, z: -111.5, faceYaw: 0, dir: 1 },
      // Gate 5 (100, -100): Approaching +X, turn right toward +Z
      { x: 111.5, z: -100, faceYaw: -Math.PI / 2, dir: 1 },
      // Gate 6 (100, 25 -> 100, 0): Turn toward -X onto Grand Ave
      { x: 111.5, z: 8, faceYaw: -Math.PI / 2, dir: -1 },
    ];

    const boardMat = new THREE.MeshLambertMaterial({ color: 0x120c28 });
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x38ef7d });
    const borderNeonMat = new THREE.MeshBasicMaterial({ color: 0xff2a55 });

    cornerSigns.forEach((cfg) => {
      const signGroup = new THREE.Group();
      signGroup.position.set(cfg.x, 0, cfg.z);
      signGroup.rotation.y = cfg.faceYaw;

      const board = new THREE.Mesh(new THREE.BoxGeometry(11.5, 2.4, 0.45), boardMat);
      board.position.y = 1.3;
      signGroup.add(board);

      const topRail = new THREE.Mesh(new THREE.BoxGeometry(11.7, 0.2, 0.5), borderNeonMat);
      topRail.position.y = 2.55;
      signGroup.add(topRail);

      // 4 glowing chevron arrows pointing in turn direction
      for (let a = -1.5; a <= 1.5; a += 1) {
        const chev = new THREE.Group();
        chev.position.set(a * 2.4, 1.3, 0.26);

        const barGeom = new THREE.BoxGeometry(0.32, 0.95, 0.08);
        const topBar = new THREE.Mesh(barGeom, arrowMat);
        topBar.position.set(0, 0.28, 0);
        topBar.rotation.z = cfg.dir * 0.65;

        const botBar = new THREE.Mesh(barGeom, arrowMat);
        botBar.position.set(0, -0.28, 0);
        botBar.rotation.z = -cfg.dir * 0.65;

        chev.add(topBar, botBar);
        signGroup.add(chev);
      }

      this.scene.add(signGroup);
    });

    // 3. DashCraft-Style Speed Booster Track Pads
    const padBaseMat = new THREE.MeshLambertMaterial({ color: 0x0b1d28 });
    const padRailMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const padChevronMat = new THREE.MeshBasicMaterial({
      color: 0x73e6f5,
      transparent: true,
      opacity: 0.9,
    });
    this.animatedMaterials.push(padChevronMat);

    SPEED_BOOST_PADS.forEach((pad) => {
      const padGroup = new THREE.Group();
      padGroup.position.set(pad.x, 0.03, pad.z);
      padGroup.rotation.y = pad.yaw;

      const base = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 7.6), padBaseMat);
      padGroup.add(base);

      const railGeom = new THREE.BoxGeometry(0.24, 0.14, 7.6);
      const railL = new THREE.Mesh(railGeom, padRailMat);
      railL.position.set(-2.5, 0.06, 0);
      const railR = new THREE.Mesh(railGeom, padRailMat);
      railR.position.set(2.5, 0.06, 0);
      padGroup.add(railL, railR);

      // 3 Forward-Pointing Glowing Chevron Arrows on the Pad
      for (let row = -1; row <= 1; row++) {
        const zOff = row * 2.1;
        const wingGeom = new THREE.BoxGeometry(1.9, 0.05, 0.38);
        const wingL = new THREE.Mesh(wingGeom, row === 0 ? padRailMat : padChevronMat);
        wingL.position.set(0.72, 0.05, zOff);
        wingL.rotation.y = -0.52;

        const wingR = new THREE.Mesh(wingGeom, row === 0 ? padRailMat : padChevronMat);
        wingR.position.set(-0.72, 0.05, zOff);
        wingR.rotation.y = 0.52;

        padGroup.add(wingL, wingR);
      }

      this.scene.add(padGroup);
    });

    // 4. Grandstand Bleachers along Start/Finish Straight (x = ±14.5, z = 48)
    const standMat = new THREE.MeshLambertMaterial({ color: 0x1e1538 });
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x2a1d4e });
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x73e6f5 });
    const neonMagentaMat = new THREE.MeshBasicMaterial({ color: 0xf26cda });

    [-14.5, 14.5].forEach((xPos, sideIdx) => {
      const standGroup = new THREE.Group();
      standGroup.position.set(xPos, 0, 52);
      standGroup.rotation.y = sideIdx === 0 ? Math.PI / 2 : -Math.PI / 2;

      for (let tier = 0; tier < 3; tier++) {
        const bench = new THREE.Mesh(
          new THREE.BoxGeometry(26, 0.8 + tier * 0.8, 1.4),
          standMat
        );
        bench.position.set(0, (0.8 + tier * 0.8) / 2, -tier * 1.4);
        standGroup.add(bench);
      }

      const roof = new THREE.Mesh(new THREE.BoxGeometry(27, 0.35, 5.2), canopyMat);
      roof.position.set(0, 4.4, -1.2);
      roof.rotation.x = 0.15;
      standGroup.add(roof);

      const lightStrip = new THREE.Mesh(
        new THREE.BoxGeometry(26.5, 0.18, 0.22),
        sideIdx === 0 ? neonCyanMat : neonMagentaMat
      );
      lightStrip.position.set(0, 4.15, 1.3);
      standGroup.add(lightStrip);

      this.scene.add(standGroup);
    });
  }

  private buildCheckpoints(): void {
    this.pickupBeacon = this.createCheckpointMesh(
      CHECKPOINTS.pickup.x,
      CHECKPOINTS.pickup.z,
      CHECKPOINTS.pickup.radius,
      CHECKPOINTS.pickup.color
    );
    this.scene.add(this.pickupBeacon);

    this.destBeacon = this.createCheckpointMesh(
      CHECKPOINTS.destination.x,
      CHECKPOINTS.destination.z,
      CHECKPOINTS.destination.radius,
      CHECKPOINTS.destination.color
    );
    this.destBeacon.visible = false;
    this.scene.add(this.destBeacon);
  }

  private createCheckpointMesh(x: number, z: number, radius: number, colorHex: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const cylGeom = new THREE.CylinderGeometry(radius, radius, 6, 20, 1, true);
    const cylMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cyl = new THREE.Mesh(cylGeom, cylMat);
    cyl.position.y = 3;
    group.add(cyl);
    this.animatedMaterials.push(cylMat);

    const ringGeom = new THREE.RingGeometry(radius - 0.3, radius, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
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

    // 1. Animate Beacons & Rotating Arcade Crystals
    const pulse = 0.6 + Math.sin(time * 3.5) * 0.35;
    for (let i = 0; i < this.animatedMaterials.length; i++) {
      this.animatedMaterials[i].opacity = pulse;
    }
    for (let i = 0; i < this.rotatingCrystals.length; i++) {
      const c = this.rotatingCrystals[i];
      c.rotation.y += dt * 2.2;
    }

    // 2. Traffic Lights on Start/Finish Gantry
    if (this.trafficLightMaterials.length === 3) {
      const race = snapshot.race;
      if (race && race.status === 'countdown') {
        const sec = race.countdownSeconds;
        this.trafficLightMaterials[0].color.setHex(sec >= 3 ? 0xff0033 : 0x330000);
        this.trafficLightMaterials[1].color.setHex(sec === 2 ? 0xffbb00 : 0x332200);
        this.trafficLightMaterials[2].color.setHex(sec === 1 ? 0x00ff66 : 0x003300);
      } else if (race && race.status === 'racing') {
        this.trafficLightMaterials[0].color.setHex(0x330000);
        this.trafficLightMaterials[1].color.setHex(0x332200);
        this.trafficLightMaterials[2].color.setHex(0x00ff66);
      } else {
        this.trafficLightMaterials[0].color.setHex(0x330000);
        this.trafficLightMaterials[1].color.setHex(0x332200);
        this.trafficLightMaterials[2].color.setHex(0x003300);
      }
    }

    this.pickupBeacon.visible = snapshot.delivery.phase === 'available';
    this.destBeacon.visible = snapshot.delivery.phase === 'active';

    // 3. Update Supercar Vehicles
    const activeVehicles = new Set<string>();
    for (const [id, veh] of Object.entries(snapshot.vehicles)) {
      activeVehicles.add(id);
      let mesh = this.vehicleMeshes.get(id);
      if (!mesh) {
        mesh = this.createSupercarMesh(id);
        this.vehicleMeshes.set(id, mesh);
        this.scene.add(mesh);
      }

      mesh.position.set(veh.x, veh.y, veh.z);
      mesh.rotation.y = veh.yaw;

      const prevSpeed = ((mesh as any)._prevSpeed as number) ?? veh.speed;
      const prevYaw = ((mesh as any)._prevYaw as number) ?? veh.yaw;

      // Spin wheels & steer front wheels visually
      const wheels = (mesh as any)._wheels as THREE.Object3D[];
      const frontPivots = (mesh as any)._frontPivots as THREE.Object3D[];
      if (wheels && Math.abs(veh.speed) > 0.05) {
        const wheelRotSpeed = (veh.speed / 0.36) * dt;
        for (let i = 0; i < wheels.length; i++) {
          wheels[i].rotation.x += wheelRotSpeed;
        }
      }

      let yawDelta = veh.yaw - prevYaw;
      while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
      while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
      const yawRate = yawDelta / Math.max(0.016, dt);

      if (frontPivots) {
        const targetSteerAngle = Math.max(-0.45, Math.min(0.45, yawRate * 0.18));
        for (let i = 0; i < frontPivots.length; i++) {
          frontPivots[i].rotation.y += (targetSteerAngle - frontPivots[i].rotation.y) * Math.min(1, dt * 12);
        }
      }

      // Active Brake Taillights, Exhaust Flame, & Drift Smoke
      const isBraking = Math.abs(veh.speed) < Math.abs(prevSpeed) - 0.06 || veh.speed < -0.5;
      const isAccelerating = veh.speed > prevSpeed + 0.04 && veh.speed > 4;
      const isDrifting = Math.abs(veh.speed) > 7.5 && Math.abs(yawRate) > 0.65;

      const tlMat = (mesh as any)._tlMat as THREE.MeshBasicMaterial | undefined;
      if (tlMat) {
        tlMat.color.setHex(isBraking ? 0xff1744 : 0xb8297e);
      }

      const exhaustFlames = (mesh as any)._exhaustFlames as THREE.Object3D | undefined;
      if (exhaustFlames) {
        exhaustFlames.visible = isAccelerating || veh.speed > 13;
        const s = 0.8 + Math.sin(time * 40) * 0.35;
        exhaustFlames.scale.set(1, 1, s);
      }

      if ((isDrifting || (isBraking && Math.abs(veh.speed) > 8)) && Math.random() < 0.55) {
        this.spawnSmokePuff(veh.x, veh.z, veh.yaw);
      }

      (mesh as any)._prevSpeed = veh.speed;
      (mesh as any)._prevYaw = veh.yaw;
    }

    this.updateSmokePool(dt);

    for (const [id, mesh] of this.vehicleMeshes.entries()) {
      if (!activeVehicles.has(id)) {
        this.scene.remove(mesh);
        this.vehicleMeshes.delete(id);
      }
    }

    // 4. Update Articulated Cyberpunk Avatars
    const activePlayers = new Set<string>();
    let localTransform = { x: 0, y: 0, z: 0, yaw: 0, isVehicle: false, speed: 0 };

    for (const [id, player] of Object.entries(snapshot.players)) {
      activePlayers.add(id);
      let avatar = this.avatarMeshes.get(id);
      if (!avatar) {
        avatar = this.createAvatarMesh(player.displayName, id === localPlayerId);
        this.avatarMeshes.set(id, avatar);
        this.scene.add(avatar);
      }

      const prevX = ((avatar as any)._prevX as number) ?? player.x;
      const prevZ = ((avatar as any)._prevZ as number) ?? player.z;
      const moveSpeed = Math.hypot(player.x - prevX, player.z - prevZ) / Math.max(0.016, dt);
      (avatar as any)._prevX = player.x;
      (avatar as any)._prevZ = player.z;

      avatar.position.set(player.x, player.y, player.z);
      avatar.rotation.y = player.yaw;

      const leftArm = (avatar as any)._leftArm as THREE.Object3D;
      const rightArm = (avatar as any)._rightArm as THREE.Object3D;
      const leftLeg = (avatar as any)._leftLeg as THREE.Object3D;
      const rightLeg = (avatar as any)._rightLeg as THREE.Object3D;
      const rigRoot = (avatar as any)._rigRoot as THREE.Object3D;

      if (player.mode === 'walking') {
        rigRoot.position.y = 0;
        const swing = moveSpeed > 0.3 ? Math.sin(time * 11) * 0.55 : 0;
        leftArm.rotation.x = swing;
        rightArm.rotation.x = -swing;
        leftLeg.rotation.x = -swing;
        rightLeg.rotation.x = swing;
      } else {
        // Seated pose inside cockpit
        rigRoot.position.y = -0.26;
        leftArm.rotation.x = -0.75;
        rightArm.rotation.x = -0.75;
        leftLeg.rotation.x = -1.1;
        rightLeg.rotation.x = -1.1;
      }

      if (id === localPlayerId) {
        const isSeated = player.mode !== 'walking';
        const veh = isSeated ? snapshot.vehicles[player.vehicleId] : undefined;
        localTransform = {
          x: veh ? veh.x : player.x,
          y: 0,
          z: veh ? veh.z : player.z,
          yaw: veh ? veh.yaw : player.yaw,
          isVehicle: isSeated,
          speed: veh ? Math.abs(veh.speed) : 0,
        };
      }
    }

    for (const [id, avatar] of this.avatarMeshes.entries()) {
      if (!activePlayers.has(id)) {
        this.scene.remove(avatar);
        this.avatarMeshes.delete(id);
      }
    }

    // 5. Camera Follow (Rigid height & constant FOV for zero vertical bobbing)
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

    this.renderer.render(this.scene, this.camera);
  }

  private spawnSmokePuff(vx: number, vz: number, yaw: number): void {
    const slot = this.smokePool[this.smokeCursor];
    this.smokeCursor = (this.smokeCursor + 1) % this.smokePool.length;

    const side = (Math.random() > 0.5 ? 1 : -1) * 0.85;
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    slot.mesh.position.set(
      vx - sinY * 1.7 + cosY * side,
      0.22,
      vz - cosY * 1.7 - sinY * side
    );
    slot.mesh.scale.setScalar(0.6);
    slot.mat.opacity = 0.48;
    slot.mesh.visible = true;
    slot.life = 0.42;
  }

  private updateSmokePool(dt: number): void {
    for (let i = 0; i < this.smokePool.length; i++) {
      const s = this.smokePool[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
      } else {
        s.mesh.position.y += dt * 1.1;
        s.mesh.scale.addScalar(dt * 2.2);
        s.mat.opacity = s.life;
      }
    }
  }

  /**
   * Dual-Class 3D Vehicle Builder:
   * - Even indices (veh_1, veh_3, veh_5): Sculpted Synthwave Wedge GT Supercar
   * - Odd indices (veh_2, veh_4, veh_6): DashCraft-Style Open-Wheel Formula Track-Day Hypercar
   * Both share identical wheel positions and authoritative collision bounds.
   */
  private createSupercarMesh(vehicleId: string): THREE.Group {
    const car = new THREE.Group();
    const numIdx = Math.max(0, (parseInt(vehicleId.replace(/\D/g, ''), 10) || 1) - 1);
    const livery = VEHICLE_LIVERIES[numIdx % VEHICLE_LIVERIES.length];
    const isFormulaCar = numIdx % 2 === 1;

    const bodyMat = new THREE.MeshPhongMaterial({
      color: livery.body,
      specular: 0x9988ff,
      shininess: 95,
      flatShading: true,
    });
    const accentMat = new THREE.MeshBasicMaterial({ color: livery.accent });
    const darkTrimMat = new THREE.MeshLambertMaterial({ color: 0x0b0816 });
    const glassMat = new THREE.MeshPhongMaterial({
      color: 0x091326,
      emissive: 0x061b33,
      specular: 0x73e6f5,
      shininess: 140,
      flatShading: true,
    });

    // Neon Underglow Strips
    const glowMat = new THREE.MeshBasicMaterial({ color: livery.underglow });
    const underglow = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.05, 3.4), glowMat);
    underglow.position.y = 0.18;
    car.add(underglow);

    if (isFormulaCar) {
      // === DASHCRAFT-STYLE OPEN-WHEEL FORMULA TRACK CAR ===
      // 1. Carbon Floor Pan & Diffuser
      const floorPan = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.1, 3.7), darkTrimMat);
      floorPan.position.y = 0.22;
      car.add(floorPan);

      // 2. Sculpted Narrow Formula Monocoque + Pointed Nosecone (+Z)
      const monocoque = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.38, 2.5), bodyMat);
      monocoque.position.set(0, 0.46, -0.2);
      car.add(monocoque);

      const noseCone = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 1.45), bodyMat);
      noseCone.position.set(0, 0.36, 1.38);
      noseCone.rotation.x = 0.12;
      car.add(noseCone);

      const noseStripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 3.5), accentMat);
      noseStripe.position.set(0, 0.66, 0.15);
      car.add(noseStripe);

      // 3. Multi-Element Front Wing + Endplates (+Z)
      const frontWing = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.07, 0.44), accentMat);
      frontWing.position.set(0, 0.22, 1.94);
      const fwFlap = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.06, 0.24), bodyMat);
      fwFlap.position.set(0, 0.27, 1.82);
      const fwEndGeom = new THREE.BoxGeometry(0.07, 0.24, 0.52);
      const fwEndL = new THREE.Mesh(fwEndGeom, bodyMat);
      fwEndL.position.set(-0.96, 0.28, 1.92);
      const fwEndR = new THREE.Mesh(fwEndGeom, bodyMat);
      fwEndR.position.set(0.96, 0.28, 1.92);
      car.add(frontWing, fwFlap, fwEndL, fwEndR);

      // 4. Wide Aerodynamic Sidepods + Suspension Wishbones
      const sidepodGeom = new THREE.BoxGeometry(0.44, 0.34, 1.65);
      const podL = new THREE.Mesh(sidepodGeom, bodyMat);
      podL.position.set(-0.7, 0.44, -0.25);
      const podR = new THREE.Mesh(sidepodGeom, bodyMat);
      podR.position.set(0.7, 0.44, -0.25);
      car.add(podL, podR);

      const wishboneGeom = new THREE.BoxGeometry(1.88, 0.05, 0.12);
      const frontArm = new THREE.Mesh(wishboneGeom, darkTrimMat);
      frontArm.position.set(0, 0.36, 1.26);
      const rearArm = new THREE.Mesh(wishboneGeom, darkTrimMat);
      rearArm.position.set(0, 0.36, -1.24);
      car.add(frontArm, rearArm);

      // 5. Overhead Airbox Scoop + Halo Cockpit Bar
      const airbox = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.95), bodyMat);
      airbox.position.set(0, 0.82, -0.82);
      const sharkFin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.95), accentMat);
      sharkFin.position.set(0, 0.96, -1.28);
      car.add(airbox, sharkFin);

      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.045, 6, 14, Math.PI), accentMat);
      halo.position.set(0, 0.84, 0.12);
      halo.rotation.x = Math.PI / 2 - 0.22;
      car.add(halo);

      // 6. Dual-Element Tall Formula Rear Wing (-Z)
      const rwEndGeom = new THREE.BoxGeometry(0.07, 0.56, 0.52);
      const rwEndL = new THREE.Mesh(rwEndGeom, bodyMat);
      rwEndL.position.set(-0.82, 0.92, -1.85);
      const rwEndR = new THREE.Mesh(rwEndGeom, bodyMat);
      rwEndR.position.set(0.82, 0.92, -1.85);
      const rwMain = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.07, 0.38), bodyMat);
      rwMain.position.set(0, 1.04, -1.84);
      const rwDRS = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.06, 0.22), accentMat);
      rwDRS.position.set(0, 1.16, -1.94);
      car.add(rwEndL, rwEndR, rwMain, rwDRS);
    } else {
      // === SYNTHWAVE WEDGE GT SUPERCAR ===
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.14, 4.12), darkTrimMat);
      splitter.position.y = 0.24;
      car.add(splitter);

      const mainChassis = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.42, 3.95), bodyMat);
      mainChassis.position.y = 0.48;
      car.add(mainChassis);

      const hood = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.22, 1.35), bodyMat);
      hood.position.set(0, 0.64, 1.22);
      hood.rotation.x = 0.14;
      car.add(hood);

      const stripeGeom = new THREE.BoxGeometry(0.18, 0.04, 3.96);
      const stripeL = new THREE.Mesh(stripeGeom, accentMat);
      stripeL.position.set(-0.16, 0.7, 0);
      const stripeR = new THREE.Mesh(stripeGeom, accentMat);
      stripeR.position.set(0.16, 0.7, 0);
      car.add(stripeL, stripeR);

      const rearFenders = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.36, 1.45), bodyMat);
      rearFenders.position.set(0, 0.56, -1.1);
      car.add(rearFenders);

      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.42, 0.65), glassMat);
      windshield.position.set(0, 0.85, 0.48);
      windshield.rotation.x = -0.52;
      car.add(windshield);

      const rollBar = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.38, 0.16), darkTrimMat);
      rollBar.position.set(0, 0.92, -0.68);
      car.add(rollBar);

      const strutGeom = new THREE.BoxGeometry(0.08, 0.42, 0.28);
      const strutL = new THREE.Mesh(strutGeom, darkTrimMat);
      strutL.position.set(-0.62, 0.88, -1.78);
      const strutR = new THREE.Mesh(strutGeom, darkTrimMat);
      strutR.position.set(0.62, 0.88, -1.78);

      const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.07, 0.42), bodyMat);
      wingBlade.position.set(0, 1.08, -1.82);
      wingBlade.rotation.x = 0.12;

      const wingTrim = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.04, 0.08), accentMat);
      wingTrim.position.set(0, 1.11, -2.01);
      car.add(strutL, strutR, wingBlade, wingTrim);
    }

    // Shared Cockpit Interior: Driver & Passenger Racing Bucket Seats + Neon Steering Wheel
    const seatGeom = new THREE.BoxGeometry(0.46, 0.42, 0.46);
    const driverSeat = new THREE.Mesh(seatGeom, new THREE.MeshLambertMaterial({ color: 0x163b5c }));
    driverSeat.position.set(0.52, 0.66, -0.12);
    const passSeat = new THREE.Mesh(seatGeom, new THREE.MeshLambertMaterial({ color: 0x4a154b }));
    passSeat.position.set(-0.52, 0.66, -0.12);
    car.add(driverSeat, passSeat);

    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 12), accentMat);
    wheelRing.position.set(0.52, 0.82, 0.25);
    wheelRing.rotation.x = -0.35;
    car.add(wheelRing);

    // Headlights (+Z) & Active Brake Lightbar (-Z)
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xe0ffff });
    const hlGeom = new THREE.BoxGeometry(0.38, 0.1, 0.1);
    const hlL = new THREE.Mesh(hlGeom, hlMat);
    hlL.position.set(-0.58, 0.46, 1.94);
    const hlR = new THREE.Mesh(hlGeom, hlMat);
    hlR.position.set(0.58, 0.46, 1.94);
    car.add(hlL, hlR);

    const tlMat = new THREE.MeshBasicMaterial({ color: 0xb8297e });
    const lightbar = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.14, 0.1), tlMat);
    lightbar.position.set(0, 0.54, -1.96);
    car.add(lightbar);
    (car as any)._tlMat = tlMat;

    // Twin Exhaust Pipes + Dynamic Afterburner Cones
    const exhaustGroup = new THREE.Group();
    const flameMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const coneGeom = new THREE.ConeGeometry(0.11, 0.55, 6);
    coneGeom.rotateX(-Math.PI / 2);
    const flameL = new THREE.Mesh(coneGeom, flameMat);
    flameL.position.set(-0.38, 0.32, -2.2);
    const flameR = new THREE.Mesh(coneGeom, flameMat);
    flameR.position.set(0.38, 0.32, -2.2);
    exhaustGroup.add(flameL, flameR);
    exhaustGroup.visible = false;
    car.add(exhaustGroup);
    (car as any)._exhaustFlames = exhaustGroup;

    // 4 Deep-Dish Alloy Wheels with Steering Pivots on Front Axle
    const wheels: THREE.Object3D[] = [];
    const frontPivots: THREE.Object3D[] = [];
    const wheelConfigs = [
      { x: -0.96, y: 0.36, z: 1.26, isFront: true },
      { x: 0.96, y: 0.36, z: 1.26, isFront: true },
      { x: -0.98, y: 0.36, z: -1.24, isFront: false },
      { x: 0.98, y: 0.36, z: -1.24, isFront: false },
    ];

    wheelConfigs.forEach(({ x, y, z, isFront }) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);

      const spinGroup = new THREE.Group();
      const tire = new THREE.Mesh(this.sharedWheelGeom, this.sharedTireMat);
      const rim = new THREE.Mesh(this.sharedRimGeom, accentMat);
      spinGroup.add(tire, rim);

      pivot.add(spinGroup);
      car.add(pivot);
      wheels.push(spinGroup);
      if (isFront) frontPivots.push(pivot);
    });

    (car as any)._wheels = wheels;
    (car as any)._frontPivots = frontPivots;
    return car;
  }

  /**
   * Articulated Cyberpunk Racer Avatar (Helmet, Glowing Visor, Jacket, Swinging Arms & Legs)
   */
  private createAvatarMesh(name: string, isLocal: boolean): THREE.Group {
    const avatar = new THREE.Group();
    const rigRoot = new THREE.Group();
    avatar.add(rigRoot);
    (avatar as any)._rigRoot = rigRoot;

    const primaryColor = isLocal ? 0x73e6f5 : 0xf26cda;
    const jacketColor = isLocal ? 0x162b4d : 0x2e1442;

    const jacketMat = new THREE.MeshPhongMaterial({
      color: jacketColor,
      shininess: 70,
      flatShading: true,
    });
    const neonMat = new THREE.MeshBasicMaterial({ color: primaryColor });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x120d24 });
    const helmetMat = new THREE.MeshPhongMaterial({
      color: 0x1a142e,
      specular: 0xffffff,
      shininess: 130,
    });

    // 1. Cyber Jacket Torso + Glowing Collar
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.58, 0.28), jacketMat);
    torso.position.y = 0.84;
    rigRoot.add(torso);

    const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.1, 0.3), neonMat);
    chestStripe.position.y = 0.96;
    rigRoot.add(chestStripe);

    // 2. Racing Helmet + Wrap-Around Glowing LED Visor
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), helmetMat);
    helmet.position.y = 1.34;
    rigRoot.add(helmet);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.22), neonMat);
    visor.position.set(0, 1.34, 0.14);
    rigRoot.add(visor);

    // 3. Articulated Left & Right Arms
    const armGeom = new THREE.BoxGeometry(0.15, 0.48, 0.15);
    armGeom.translate(0, -0.2, 0);

    const leftArm = new THREE.Mesh(armGeom, jacketMat);
    leftArm.position.set(0.32, 1.06, 0);
    const rightArm = new THREE.Mesh(armGeom, jacketMat);
    rightArm.position.set(-0.32, 1.06, 0);
    rigRoot.add(leftArm, rightArm);

    // 4. Articulated Left & Right Legs
    const legGeom = new THREE.BoxGeometry(0.18, 0.52, 0.18);
    legGeom.translate(0, -0.24, 0);

    const leftLeg = new THREE.Mesh(legGeom, pantsMat);
    leftLeg.position.set(0.13, 0.54, 0);
    const rightLeg = new THREE.Mesh(legGeom, pantsMat);
    rightLeg.position.set(-0.13, 0.54, 0);
    rigRoot.add(leftLeg, rightLeg);

    (avatar as any)._leftArm = leftArm;
    (avatar as any)._rightArm = rightArm;
    (avatar as any)._leftLeg = leftLeg;
    (avatar as any)._rightLeg = rightLeg;

    // 5. Crisp Nametag Billboard
    const nameSprite = this.createNameSprite(name, isLocal);
    nameSprite.position.set(0, 1.88, 0);
    avatar.add(nameSprite);

    return avatar;
  }

  private createNameSprite(text: string, isLocal: boolean): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = isLocal ? 'rgba(115, 230, 245, 0.9)' : 'rgba(24, 14, 46, 0.88)';
    ctx.beginPath();
    ctx.roundRect(8, 10, 240, 44, 22);
    ctx.fill();

    ctx.font = 'bold 23px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isLocal ? '#091224' : '#f5f2ff';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.9, 0.48, 1.0);
    return sprite;
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    const isMobileViewport = width <= 950 || height <= 480;
    this.renderer.setPixelRatio(isMobileViewport ? 1.0 : Math.min(window.devicePixelRatio, 1.35));
  }

  public dispose(): void {
    this.renderer.dispose();
  }
}

const metalMatStatic = new THREE.MeshLambertMaterial({ color: 0x32264d });
