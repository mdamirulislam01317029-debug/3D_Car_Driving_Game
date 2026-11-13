import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const container = $('scene-container');
const scoreEl = $('score-value');
const bestEl = $('high-score-value');
const speedEl = $('speed-value');
const heartsEl = $('health-hearts');
const wheelEl = $('steering-wheel');
const cameraLabel = $('camera-label');
const toast = $('collision-toast');
const levelEl = $('level-value');
const levelNameEl = $('level-name');
const levelNextEl = $('level-next');
const levelFillEl = $('level-fill');
const shieldStatusEl = $('shield-status');
const powerStatusEl = $('power-status-text');
const networkChip = $('network-chip');

let currentPlayerName = 'Driver';
let selectedStartLevel = 1;
let currentLevel = 1;
let shieldTimer = 0;
let extraPowerTimer = 0;
let powerupSpawnTimer = 7;
let powerups = [];
let multiplayerMode = false;
let socket = null;
let currentRoomCode = '';
let isRoomHost = false;
let networkSendTimer = 0;
let remotePlayers = new Map();
let localPlayerColor = 0x13a9bd;
let playerLaneOffset = 0;

let scene, camera, renderer, clock;
let playerCar;
let shieldBubble = null;
let groundMesh = null;
let sunLight = null;
let hemiLight = null;
let state = 'ready';
let cameraMode = 'chase';
let score = 0;
let highScore = Number(localStorage.getItem('highwayRushHighScore') || 0);
let lives = 3;
const NORMAL_SPEED = 48;       // Displayed as 173 KM/H
const TURBO_SPEED = 76;         // Displayed as 274 KM/H
let speed = NORMAL_SPEED;
let steering = 0;
let targetSteering = 0;
let steerDirection = 0;
let roadObjects = [];
let laneMarkers = [];
let obstacles = [];
let roadside = [];
let particles = [];
let toastTimer = 0;
let spawnTimer = 0;
let collisionCooldown = 0;
let lastTime = 0;
let keys = { left: false, right: false, boost: false };
let soundEnabled = true;
let audioContext = null;
let audioMaster = null;
let engineOscA = null;
let engineOscB = null;
let engineFilter = null;
let engineGain = null;
let roadNoiseGain = null;
let audioNoiseBuffer = null;
const laneX = [-3.9, 0, 3.9];
const ROAD_WIDTH = 13.5;
const PLAYER_Z = 5;
const LEVEL_SCORE_STEP = 1800;
const LEVEL_NAMES = ['VALLEY RUN', 'ALPINE CURVE', 'NIGHT SPRINT', 'STORM HIGHWAY', 'LEGEND RUN'];
const ROAD_START_Z = -220;
const ROAD_END_Z = 38;
const COLOR_OPTIONS = [0xe44d58, 0x2677c8, 0xe5a72f, 0x37a58a, 0x8d75ca, 0xe8edf2];


function rawRoadCurve(z) {
  return 7.2 * Math.sin((z + 48) * 0.016) + 2.2 * Math.sin((z - 15) * 0.038);
}
const ROAD_CURVE_ORIGIN = rawRoadCurve(PLAYER_Z);
function roadCenterAt(z) {
  return rawRoadCurve(z) - ROAD_CURVE_ORIGIN;
}
function roadHeadingAt(z) {
  const slope = (roadCenterAt(z + 1) - roadCenterAt(z - 1)) / 2;
  return Math.atan(slope);
}
function createRoadRibbon(width, y, zStart, zEnd, segments, offsetX, material) {
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const z = zStart + (zEnd - zStart) * t;
    const cx = roadCenterAt(z) + offsetX;
    positions.push(cx - width / 2, y, z, cx + width / 2, y, z);
    uvs.push(0, t * 12, 1, t * 12);
    if (i < segments) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}
function createCurvedRail(offsetX, y, material) {
  const points = [];
  for (let i = 0; i <= 100; i++) {
    const z = ROAD_START_Z + (ROAD_END_Z - ROAD_START_Z) * i / 100;
    points.push(new THREE.Vector3(roadCenterAt(z) + offsetX, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.075, 7, false), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9dbdce);
  scene.fog = new THREE.Fog(0x9dbdce, 48, 205);

  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 360);
  camera.position.set(0, 5.7, 13.2);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  container.appendChild(renderer.domElement);

  clock = new THREE.Clock();
  addLighting();
  buildWorld();
  playerCar = createCar(0x13a9bd, true);
  playerCar.position.set(roadCenterAt(PLAYER_Z) + playerLaneOffset, 0, PLAYER_Z);
  playerCar.rotation.y = roadHeadingAt(PLAYER_Z);
  shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(1.85, 20, 14), new THREE.MeshBasicMaterial({ color: 0x55dfff, wireframe: true, transparent: true, opacity: 0.22, depthWrite: false }));
  shieldBubble.scale.set(1.0, 0.82, 1.2);
  shieldBubble.position.y = 1.0;
  shieldBubble.visible = false;
  playerCar.add(shieldBubble);
  scene.add(playerCar);
  createInitialTraffic();
  updateScoreUI();
  updateHealthUI();
  updateLevelUI(true);
  restoreProfile();
  bindEvents();
  $('loading-cover').classList.add('done');
  animate();
}

function addLighting() {
  hemiLight = new THREE.HemisphereLight(0xdff4ff, 0x637044, 1.55);
  scene.add(hemiLight);
  sunLight = new THREE.DirectionalLight(0xffedcf, 2.25);
  const sun = sunLight;
  sun.position.set(-28, 38, -20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -35;
  sun.shadow.camera.right = 35;
  sun.shadow.camera.top = 35;
  sun.shadow.camera.bottom = -35;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 100;
  sun.shadow.bias = -0.00025;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xa4d8ef, 0.65);
  fill.position.set(25, 12, 30);
  scene.add(fill);
}

function makeAsphaltTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#353b40'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16000; i++) {
    const v = 45 + Math.random() * 55;
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 4},${Math.random() * 0.2})`;
    const x = Math.random() * 512, y = Math.random() * 512;
    const s = Math.random() * 2 + 0.3;
    ctx.fillRect(x, y, s, s);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 20);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildWorld() {
  groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(500, 330), new THREE.MeshStandardMaterial({ color: 0x6b8050, roughness: 1 }));
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(0, -0.14, -75);
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  const asphalt = createRoadRibbon(ROAD_WIDTH, -0.06, ROAD_START_Z, ROAD_END_Z, 180, 0,
    new THREE.MeshStandardMaterial({ map: makeAsphaltTexture(), color: 0x85898b, roughness: 0.97, metalness: 0.02, side: THREE.DoubleSide }));
  scene.add(asphalt);

  // Curved shoulders, edge paint and continuous guard rails follow the same road spline.
  const shoulderMat = new THREE.MeshStandardMaterial({ color: 0xb0a98f, roughness: 1, side: THREE.DoubleSide });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xf0e8c9, emissive: 0x29251c, roughness: .7, side: THREE.DoubleSide });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x929da4, metalness: .55, roughness: .42 });
  [-1, 1].forEach(side => {
    scene.add(createRoadRibbon(1.4, -0.05, ROAD_START_Z, ROAD_END_Z, 180, side * (ROAD_WIDTH / 2 + 0.68), shoulderMat));
    scene.add(createRoadRibbon(0.12, 0.025, ROAD_START_Z, ROAD_END_Z, 180, side * (ROAD_WIDTH / 2 - 0.32), edgeMat));
    scene.add(createCurvedRail(side * (ROAD_WIDTH / 2 + 1.18), 0.48, railMat));
    for (let i = 0; i < 34; i++) {
      const z = -i * 7.4 - 5;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.22), new THREE.MeshStandardMaterial({ color: 0x75818a, metalness: .38, roughness: .5 }));
      const offsetX = side * (ROAD_WIDTH / 2 + 1.18);
      post.position.set(roadCenterAt(z) + offsetX, 0.28, z);
      post.castShadow = true; scene.add(post); roadside.push({ mesh: post, wrap: 250, offsetX });
    }
  });

  // Dashed lane dividers are placed along the bends, not on a flat line.
  for (const x of [-2.25, 2.25]) {
    for (let i = 0; i < 25; i++) {
      const z = -i * 9 - 8;
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.025, 4.2), new THREE.MeshStandardMaterial({ color: 0xe9e8dc, emissive: 0x25251f, roughness: .65 }));
      dash.position.set(roadCenterAt(z) + x, 0.035, z);
      dash.receiveShadow = true;
      dash.userData.offsetX = x;
      scene.add(dash);
      laneMarkers.push(dash);
    }
  }

  // Distant layered mountain silhouettes.
  for (let i = 0; i < 19; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const h = 13 + Math.random() * 22;
    const r = 9 + Math.random() * 13;
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5 + Math.floor(Math.random() * 3)), new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? 0x879d9a : 0x758d85, roughness: 1, flatShading: true }));
    mountain.position.set(side * (26 + Math.random() * 55), h / 2 - 1, -100 - Math.random() * 100);
    mountain.rotation.y = Math.random() * Math.PI;
    scene.add(mountain);
  }

  // Repeating roadside scenery: trees and lamp posts.
  for (let i = 0; i < 38; i++) {
    for (const side of [-1, 1]) {
      const z = -i * 6.8 - 12 + (Math.random() * 2);
      if (i % 4 === 0) {
        const lamp = createLamp();
        const offsetX = side * (ROAD_WIDTH / 2 + 2.4);
        lamp.position.set(roadCenterAt(z) + offsetX, 0, z);
        scene.add(lamp);
        roadside.push({ mesh: lamp, wrap: 260, offsetX });
      } else {
        const tree = createTree();
        const offsetX = side * (ROAD_WIDTH / 2 + 3.2 + Math.random() * 8);
        tree.position.set(roadCenterAt(z) + offsetX, 0, z);
        tree.rotation.y = Math.random() * Math.PI;
        const s = 0.8 + Math.random() * 0.6;
        tree.scale.setScalar(s);
        scene.add(tree);
        roadside.push({ mesh: tree, wrap: 260, offsetX });
      }
    }
  }

  // Subtle roadside stones and reflectors.
  for (let i = 0; i < 30; i++) {
    for (const side of [-1, 1]) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(.17, .35, .25), new THREE.MeshStandardMaterial({ color: 0xe6e5d4, emissive: 0x181817, roughness: .65 }));
      const z = -i * 8 - 8;
      const offsetX = side * (ROAD_WIDTH / 2 + .27);
      marker.position.set(roadCenterAt(z) + offsetX, .18, z);
      scene.add(marker); roadside.push({ mesh: marker, wrap: 250, offsetX });
    }
  }
}

function createTree() {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.16, .24, 2.15, 7), new THREE.MeshStandardMaterial({ color: 0x60472e, roughness: 1 }));
  trunk.position.y = 1.05; trunk.castShadow = true; group.add(trunk);
  const greens = [0x315b3e, 0x3d6944, 0x486f45, 0x2f503c];
  for (let i = 0; i < 3; i++) {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.05 - i * .12, 1.8, 7), new THREE.MeshStandardMaterial({ color: greens[Math.floor(Math.random() * greens.length)], roughness: 1, flatShading: true }));
    crown.position.y = 2.15 + i * .73; crown.castShadow = true; group.add(crown);
  }
  return group;
}

function createLamp() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.055, .085, 6.1, 8), new THREE.MeshStandardMaterial({ color: 0x59666d, metalness: .65, roughness: .42 }));
  pole.position.y = 3.05; pole.castShadow = true; group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.35, .09, .09), pole.material);
  arm.position.set(-.58, 5.9, 0); group.add(arm);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(.62, .17, .36), new THREE.MeshStandardMaterial({ color: 0xdde9dc, emissive: 0xb8d9df, emissiveIntensity: .35, roughness: .4 }));
  lamp.position.set(-1.13, 5.84, 0); group.add(lamp);
  return group;
}

function makePaint(color) {
  return new THREE.MeshPhysicalMaterial({ color, metalness: .66, roughness: .28, clearcoat: .82, clearcoatRoughness: .2 });
}

function createCar(color = 0x13a9bd, isPlayer = false) {
  const car = new THREE.Group();
  const paint = makePaint(color);
  const dark = new THREE.MeshStandardMaterial({ color: 0x10171d, roughness: .46, metalness: .18 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x172b3a, metalness: .34, roughness: .12, transmission: .16, transparent: true, opacity: .88, clearcoat: 1 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc3d0d5, metalness: .83, roughness: .24 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111417, roughness: .9 });
  const headlight = new THREE.MeshStandardMaterial({ color: 0xf8f1d9, emissive: 0xffe6a7, emissiveIntensity: isPlayer ? 1.2 : .55, roughness: .2 });
  const redLight = new THREE.MeshStandardMaterial({ color: 0xe5313c, emissive: 0x7c0713, emissiveIntensity: .7 });

  // Lower chassis and sculpted-looking layered body.
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.88, .42, 3.8), dark);
  chassis.position.y = .58; chassis.castShadow = true; chassis.receiveShadow = true; car.add(chassis);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.82, .66, 3.55), paint);
  body.position.y = .82; body.castShadow = true; body.receiveShadow = true; car.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.74, .23, 1.13), paint);
  hood.position.set(0, 1.16, -1.16); hood.castShadow = true; car.add(hood);
  const rearDeck = new THREE.Mesh(new THREE.BoxGeometry(1.74, .24, .75), paint);
  rearDeck.position.set(0, 1.15, 1.37); rearDeck.castShadow = true; car.add(rearDeck);

  // Cabin with sloped windshield and roof.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.45, .72, 1.78), paint);
  cabin.position.set(0, 1.42, .03); cabin.castShadow = true; car.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.34, .13, 1.24), paint);
  roof.position.set(0, 1.83, .02); roof.castShadow = true; car.add(roof);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.31, .54, .045), glass);
  windshield.position.set(0, 1.47, -.885); windshield.rotation.x = -.12; car.add(windshield);
  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.27, .49, .045), glass);
  rearWindow.position.set(0, 1.47, .94); rearWindow.rotation.x = .12; car.add(rearWindow);
  for (const side of [-1, 1]) {
    const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(.045, .47, 1.18), glass);
    sideWindow.position.set(side * .733, 1.48, .02); car.add(sideWindow);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(.22, .13, .19), dark);
    mirror.position.set(side * .98, 1.37, -.66); mirror.castShadow = true; car.add(mirror);
  }

  // Front and rear fascia, lights and grille.
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, .22, .18), chrome);
  frontBumper.position.set(0, .58, -1.91); car.add(frontBumper);
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, .19, .16), chrome);
  rearBumper.position.set(0, .57, 1.89); car.add(rearBumper);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(.72, .22, .035), dark);
  grille.position.set(0, .82, -1.91); car.add(grille);
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(.39, .17, .09), headlight);
    lamp.position.set(side * .62, .96, -1.84); car.add(lamp);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(.39, .13, .07), redLight);
    tail.position.set(side * .62, .95, 1.82); car.add(tail);
    const fog = new THREE.Mesh(new THREE.BoxGeometry(.22, .075, .05), headlight);
    fog.position.set(side * .68, .62, -1.93); car.add(fog);
  }

  // Wheels and machined rims.
  car.userData.wheels = [];
  for (const x of [-.96, .96]) {
    for (const z of [-1.2, 1.22]) {
      const wheel = new THREE.Group();
      wheel.position.set(x, .52, z);
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(.43, .43, .28, 20), rubber);
      tyre.rotation.z = Math.PI / 2; tyre.castShadow = true; wheel.add(tyre);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(.255, .255, .292, 16), chrome);
      rim.rotation.z = Math.PI / 2; wheel.add(rim);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.105, .105, .305, 12), dark);
      hub.rotation.z = Math.PI / 2; wheel.add(hub);
      for (let s = 0; s < 5; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(.035, .32, .045), chrome);
        spoke.position.y = 0; spoke.rotation.z = s * Math.PI * 2 / 5;
        // Place spoke on outer face of the wheel.
        spoke.position.x = x < 0 ? -.151 : .151;
        wheel.add(spoke);
      }
      car.add(wheel); car.userData.wheels.push(wheel);
    }
  }

  // Sporty side skirts and a subtle roof fin.
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(.09, .14, 2.2), dark);
    skirt.position.set(side * .91, .51, 0); car.add(skirt);
  }
  if (isPlayer) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.45, .08, .23), dark);
    spoiler.position.set(0, 1.42, 1.64); car.add(spoiler);
    const supportMat = new THREE.MeshStandardMaterial({ color: 0x222d35, metalness: .45 });
    for (const x of [-.48, .48]) { const s = new THREE.Mesh(new THREE.BoxGeometry(.06, .24, .07), supportMat); s.position.set(x, 1.3, 1.61); car.add(s); }
  }

  // Headlight spill pools in front of the player vehicle.
  if (isPlayer) {
    for (const x of [-.58, .58]) {
      const spot = new THREE.SpotLight(0xd9f4ff, 1.6, 25, Math.PI / 8, .6, 1.2);
      spot.position.set(x, .9, -1.8); spot.target.position.set(x, .15, -18);
      car.add(spot); car.add(spot.target);
    }
  }
  return car;
}

function createInitialTraffic() {
  for (let i = 0; i < 5; i++) spawnObstacle(-45 - i * 31, i % 3);
}

function spawnObstacle(z = -130, forcedLane = null) {
  const lane = forcedLane === null ? Math.floor(Math.random() * 3) : forcedLane;
  const color = COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)];
  const car = createCar(color, false);
  const scale = .92 + Math.random() * .12;
  car.scale.setScalar(scale);
  car.position.set(roadCenterAt(z) + laneX[lane], 0, z);
  car.rotation.y = roadHeadingAt(z);
  car.userData.lane = lane;
  car.userData.laneOffset = laneX[lane];
  car.userData.passed = false;
  scene.add(car);
  obstacles.push(car);
}

function createImpact(x, z) {
  const group = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(.045 + Math.random() * .075, 6, 5), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffc86e : 0xff6a72 }));
    p.position.set((Math.random() - .5) * .8, .5 + Math.random() * 1.4, (Math.random() - .5) * .8);
    p.userData.velocity = new THREE.Vector3((Math.random() - .5) * 5, Math.random() * 4 + 1, (Math.random() - .5) * 5);
    p.userData.life = .5 + Math.random() * .5;
    group.add(p);
  }
  group.position.set(x, 0, z); scene.add(group);
  particles.push({ group, isGroup: true, life: 1.0 });
}

function createNoiseBuffer(ctx, seconds = 2) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.55;
  return buffer;
}

function ensureAudio() {
  if (audioContext) {
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => { });
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext = new AudioContextClass();
  audioContext.resume().catch(() => { });
  audioMaster = audioContext.createGain();
  audioMaster.gain.value = soundEnabled ? 0.72 : 0;
  audioMaster.connect(audioContext.destination);

  engineFilter = audioContext.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 310;
  engineFilter.Q.value = 0.8;
  engineGain = audioContext.createGain();
  engineGain.gain.value = 0.0001;
  engineFilter.connect(engineGain);
  engineGain.connect(audioMaster);

  engineOscA = audioContext.createOscillator();
  engineOscA.type = 'sawtooth';
  engineOscA.frequency.value = 48;
  engineOscA.connect(engineFilter);
  engineOscA.start();

  engineOscB = audioContext.createOscillator();
  engineOscB.type = 'triangle';
  engineOscB.frequency.value = 24;
  const engineSubGain = audioContext.createGain();
  engineSubGain.gain.value = 0.42;
  engineOscB.connect(engineSubGain);
  engineSubGain.connect(engineFilter);
  engineOscB.start();

  audioNoiseBuffer = createNoiseBuffer(audioContext, 2);
  const roadNoise = audioContext.createBufferSource();
  roadNoise.buffer = audioNoiseBuffer;
  roadNoise.loop = true;
  const roadFilter = audioContext.createBiquadFilter();
  roadFilter.type = 'bandpass';
  roadFilter.frequency.value = 520;
  roadFilter.Q.value = 0.65;
  roadNoiseGain = audioContext.createGain();
  roadNoiseGain.gain.value = 0.0001;
  roadNoise.connect(roadFilter);
  roadFilter.connect(roadNoiseGain);
  roadNoiseGain.connect(audioMaster);
  roadNoise.start();
  updateAudioState();
}

function updateAudioState() {
  if (!audioContext || !engineGain) return;
  const now = audioContext.currentTime;
  const active = soundEnabled && state === 'running';
  engineGain.gain.setTargetAtTime(active ? (keys.boost ? 0.095 : 0.065) : 0.0001, now, 0.12);
  if (roadNoiseGain) roadNoiseGain.gain.setTargetAtTime(active ? (keys.boost ? 0.025 : 0.014) : 0.0001, now, 0.18);
  const rpm = 42 + (speed - 28) * 2.15 + (keys.boost ? 22 : 0);
  engineOscA.frequency.setTargetAtTime(rpm, now, 0.08);
  engineOscB.frequency.setTargetAtTime(rpm * 0.49, now, 0.08);
  engineFilter.frequency.setTargetAtTime(260 + (speed - 28) * 12 + (keys.boost ? 240 : 0), now, 0.1);
}

function playAudioEffect(kind) {
  if (!soundEnabled || !audioContext || audioContext.state !== 'running') return;
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  filter.type = kind === 'collision' ? 'lowpass' : 'bandpass';
  filter.frequency.setValueAtTime(kind === 'collision' ? 260 : 900, now);
  osc.type = kind === 'collision' ? 'sawtooth' : 'sawtooth';
  if (kind === 'collision') {
    osc.frequency.setValueAtTime(105, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.28);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.32, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  } else {
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.22);
    osc.frequency.exponentialRampToValueAtTime(170, now + 0.56);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
  }
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioMaster);
  osc.start(now);
  osc.stop(now + (kind === 'collision' ? 0.45 : 0.65));
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  const button = $('sound-button');
  button.setAttribute('aria-pressed', String(!soundEnabled));
  button.setAttribute('aria-label', soundEnabled ? 'Mute sound' : 'Enable sound');
  button.title = soundEnabled ? 'Mute sound' : 'Enable sound';
  button.innerHTML = soundEnabled
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6m0-6-5 6"/></svg>';
  if (soundEnabled) {
    ensureAudio();
    if (audioMaster && audioContext) audioMaster.gain.setTargetAtTime(0.72, audioContext.currentTime, 0.04);
  } else if (audioMaster && audioContext) {
    audioMaster.gain.setTargetAtTime(0, audioContext.currentTime, 0.04);
  }
  updateAudioState();
}

function setBoost(active) {
  const wasActive = keys.boost;
  keys.boost = Boolean(active) && state === 'running';
  const chip = $('turbo-chip');
  const label = $('turbo-label');
  const touchButton = $('touch-boost');
  if (chip) chip.classList.toggle('active', keys.boost);
  if (label) label.textContent = keys.boost ? 'TURBO BOOST ACTIVE' : 'SPACE · HOLD FOR TURBO';
  if (touchButton) touchButton.classList.toggle('active', keys.boost);
  if (keys.boost && !wasActive) playAudioEffect('boost');
  updateAudioState();
}


function showToast(title, subtitle = '') {
  toast.innerHTML = `${title} ${subtitle ? `<span>${subtitle}</span>` : ''}`;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1100);
}

function updatePowerStatus() {
  if (shieldBubble) shieldBubble.visible = shieldTimer > 0;
  if (shieldStatusEl) {
    shieldStatusEl.textContent = shieldTimer > 0 ? `🛡 SHIELD ${Math.ceil(shieldTimer)}s` : '🛡 SHIELD —';
    shieldStatusEl.classList.toggle('active', shieldTimer > 0);
  }
  if (powerStatusEl) {
    powerStatusEl.textContent = extraPowerTimer > 0 ? `⚡ EXTRA POWER ${Math.ceil(extraPowerTimer)}s` : '⚡ EXTRA POWER —';
    powerStatusEl.classList.toggle('active', extraPowerTimer > 0);
  }
}

function updateLevelUI(initial = false) {
  if (levelEl) levelEl.textContent = `${String(currentLevel).padStart(2, '0')} / 05`;
  if (levelNameEl) levelNameEl.textContent = `LEVEL ${currentLevel} · ${LEVEL_NAMES[currentLevel - 1]}`;
  if (levelNextEl) levelNextEl.textContent = currentLevel >= 5 ? 'MAX LEVEL' : `NEXT ${(LEVEL_SCORE_STEP - (score % LEVEL_SCORE_STEP)).toLocaleString()}`;
  if (levelFillEl) {
    const progress = currentLevel >= 5 ? 100 : Math.max(0, Math.min(100, (score % LEVEL_SCORE_STEP) / LEVEL_SCORE_STEP * 100));
    levelFillEl.style.width = `${progress}%`;
  }
  if (initial) { updatePowerStatus(); applyLevelEnvironment(currentLevel); }
}


function applyLevelEnvironment(level) {
  if (!scene || !groundMesh) return;
  const themes = [
    { sky: 0x9dbdce, fog: 0x9dbdce, ground: 0x6b8050, sun: 2.25, hemi: 1.55, exposure: 1.13 },
    { sky: 0x9bb8c8, fog: 0x9bb8c8, ground: 0x75816d, sun: 2.05, hemi: 1.45, exposure: 1.08 },
    { sky: 0x17283e, fog: 0x17283e, ground: 0x263847, sun: 0.72, hemi: 0.82, exposure: 1.3 },
    { sky: 0x667987, fog: 0x667987, ground: 0x56604f, sun: 1.35, hemi: 1.15, exposure: 1.0 },
    { sky: 0x80536a, fog: 0x80536a, ground: 0x625341, sun: 1.8, hemi: 1.1, exposure: 1.12 }
  ];
  const theme = themes[Math.max(0, Math.min(4, level - 1))];
  scene.background.setHex(theme.sky);
  if (scene.fog) scene.fog.color.setHex(theme.fog);
  groundMesh.material.color.setHex(theme.ground);
  if (sunLight) sunLight.intensity = theme.sun;
  if (hemiLight) hemiLight.intensity = theme.hemi;
  if (renderer) renderer.toneMappingExposure = theme.exposure;
}

function updateLevelProgress() {
  const nextLevel = Math.min(5, selectedStartLevel + Math.floor(score / LEVEL_SCORE_STEP));
  if (nextLevel > currentLevel) {
    currentLevel = nextLevel;
    applyLevelEnvironment(currentLevel);
    showToast(`LEVEL ${currentLevel} UNLOCKED`, LEVEL_NAMES[currentLevel - 1]);
  }
  updateLevelUI();
}

function createPowerupMesh(type) {
  const group = new THREE.Group();
  const isShield = type === 'shield';
  const color = isShield ? 0x55dfff : 0xffc65a;
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, metalness: 0.45, roughness: 0.22 });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 0), material);
  core.position.y = 1.15;
  core.castShadow = true;
  group.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.075, 8, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.15;
  group.add(ring);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0xeafaff, emissive: color, emissiveIntensity: 0.45 }));
  stem.position.y = 0.35;
  group.add(stem);
  group.userData.type = type;
  return group;
}

function spawnPowerup() {
  const type = Math.random() < 0.52 ? 'shield' : 'extra';
  const lane = Math.floor(Math.random() * 3);
  const z = -145 - Math.random() * 25;
  const mesh = createPowerupMesh(type);
  mesh.position.set(roadCenterAt(z) + laneX[lane], 0, z);
  scene.add(mesh);
  powerups.push({ mesh, type, laneOffset: laneX[lane] });
}

function updatePowerups(dt) {
  powerupSpawnTimer -= dt;
  if (powerupSpawnTimer <= 0) {
    if (powerups.length < 2) spawnPowerup();
    powerupSpawnTimer = 12 + Math.random() * 10;
  }
  for (let i = powerups.length - 1; i >= 0; i--) {
    const item = powerups[i];
    item.mesh.position.z += speed * dt;
    item.mesh.position.x = roadCenterAt(item.mesh.position.z) + item.laneOffset;
    item.mesh.rotation.y += dt * 1.8;
    item.mesh.children[1].rotation.z += dt * 1.5;
    if (Math.abs(item.mesh.position.z - PLAYER_Z) < 2.7 && Math.abs(item.mesh.position.x - playerCar.position.x) < 2.15) {
      if (item.type === 'shield') {
        shieldTimer = Math.max(shieldTimer, 10);
        showToast('SHIELD ACTIVATED', '10 SECONDS PROTECTION');
      } else {
        extraPowerTimer = Math.max(extraPowerTimer, 10);
        showToast('EXTRA POWER', 'TURBO BOOST UPGRADED');
      }
      playAudioEffect('boost');
      scene.remove(item.mesh);
      powerups.splice(i, 1);
      updatePowerStatus();
    } else if (item.mesh.position.z > 20) {
      scene.remove(item.mesh);
      powerups.splice(i, 1);
    }
  }
}

function restoreProfile() {
  const savedName = localStorage.getItem('highwayRushPlayerName');
  if (savedName) $('player-name').value = savedName;
}

function completeLogin() {
  const name = $('player-name').value.trim().replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 18);
  if (!name) {
    $('player-name').focus();
    showToast('ENTER PLAYER NAME', 'LOGIN REQUIRED');
    return;
  }
  currentPlayerName = name;
  localStorage.setItem('highwayRushPlayerName', name);
  $('signed-in-name').textContent = name.toUpperCase();
  $('login-panel').classList.add('hidden');
  $('mode-panel').classList.remove('hidden');
  $('single-player-button').classList.add('selected');
  $('show-multiplayer-button').classList.remove('selected');
  $('single-setup').classList.remove('hidden');
  $('multiplayer-setup').classList.add('hidden');
}

function chooseMode(mode) {
  $('single-player-button').classList.toggle('selected', mode === 'single');
  $('show-multiplayer-button').classList.toggle('selected', mode === 'multi');
  $('single-setup').classList.toggle('hidden', mode !== 'single');
  $('multiplayer-setup').classList.toggle('hidden', mode !== 'multi');
}

function beginSinglePlayer() {
  for (const remote of remotePlayers.values()) { scene.remove(remote.car); if (remote.label) scene.remove(remote.label); }
  remotePlayers.clear();
  selectedStartLevel = Number($('starting-level').value || 1);
  currentLevel = selectedStartLevel;
  playerLaneOffset = 0;
  updateLevelUI(true);
  multiplayerMode = false;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentRoomCode = '';
  networkChip.classList.add('hidden');
  startGame();
}

function setupSocket() {
  if (socket && socket.connected) return true;
  if (typeof window.io !== 'function') {
    showToast('MULTIPLAYER SERVER REQUIRED', 'RUN RUN_GAME.BAT');
    $('network-note').textContent = 'Start the included server with RUN_GAME.bat or npm start, then reload this page.';
    return false;
  }
  if (!socket) {
    socket = window.io({ transports: ['websocket', 'polling'] });
    socket.on('connect_error', () => {
      $('network-note').textContent = 'Cannot reach multiplayer server. Make sure Node.js server is running.';
    });
    socket.on('room:error', (message) => {
      $('network-note').textContent = message || 'Room could not be opened.';
      showToast('ROOM CONNECTION FAILED', 'CHECK ROOM CODE');
    });
    socket.on('room:joined', (payload) => {
      currentRoomCode = payload.roomCode;
      isRoomHost = !!payload.isHost;
      multiplayerMode = true;
      $('room-code-display').textContent = currentRoomCode;
      $('room-player-count').textContent = `${payload.players.length} / 8`;
      $('room-lobby').classList.remove('hidden');
      $('host-start-button').classList.toggle('hidden', !isRoomHost);
      $('room-status').textContent = payload.started ? 'Race already running — joining now.' : (isRoomHost ? 'Room created. Share the code, then start the race.' : 'Joined successfully. Waiting for the host to start...');
      $('network-note').textContent = 'Room connected. Keep this browser tab open while racing.';
      for (const p of payload.players) {
        if (p.id !== socket.id) addOrUpdateRemotePlayer(p.id, p);
        else {
          playerLaneOffset = Number(p.x || 0);
          playerCar.position.x = roadCenterAt(PLAYER_Z) + playerLaneOffset;
        }
      }
      updateNetworkCount(payload.players.length);
      if (payload.started) startMultiplayerRace();
    });
    socket.on('room:players', (payload) => {
      const players = Array.isArray(payload) ? payload : (payload.players || []);
      if (!Array.isArray(payload) && payload.hostId) {
        isRoomHost = payload.hostId === socket.id;
        $('host-start-button').classList.toggle('hidden', !isRoomHost);
      }
      updateNetworkCount(players.length);
      $('room-player-count').textContent = `${players.length} / 8`;
      $('room-status').textContent = isRoomHost ? 'Room ready. Start when your friends have joined.' : `Connected with ${players.length} driver(s). Waiting for host...`;
      players.forEach(p => { if (p.id !== socket.id) addOrUpdateRemotePlayer(p.id, p); });
    });
    socket.on('player:update', ({ id, player }) => addOrUpdateRemotePlayer(id, player));
    socket.on('player:left', ({ id, players }) => {
      removeRemotePlayer(id);
      updateNetworkCount(players);
      $('room-player-count').textContent = `${players} / 8`;
    });
    socket.on('race:start', (payload = {}) => { selectedStartLevel = Math.max(1, Math.min(5, Number(payload.level) || 1)); startMultiplayerRace(); });
  }
  return true;
}

function createRoom() {
  if (!setupSocket()) return;
  const create = () => socket.emit('room:create', { name: currentPlayerName });
  if (socket.connected) create();
  else socket.once('connect', create);
}

function joinRoom() {
  if (!setupSocket()) return;
  const code = $('room-code').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (code.length < 4) {
    $('room-code').focus();
    $('network-note').textContent = 'Enter the 4–6 character room code shared by the host.';
    return;
  }
  const join = () => socket.emit('room:join', { roomCode: code, name: currentPlayerName });
  if (socket.connected) join();
  else socket.once('connect', join);
}

function startMultiplayerRace() {
  if (!socket || !currentRoomCode) return;
  currentLevel = selectedStartLevel;
  score = 0;
  updateLevelUI(true);
  multiplayerMode = true;
  networkChip.classList.remove('hidden');
  networkChip.querySelector('b').textContent = `${remotePlayers.size + 1} PLAYERS`;
  startGame();
}

function updateNetworkCount(count) {
  if (networkChip) {
    networkChip.classList.toggle('hidden', !multiplayerMode);
    const label = $('network-count');
    if (label) label.textContent = `${count} PLAYER${count === 1 ? '' : 'S'}`;
  }
}

function createNameSprite(name, color = '#eafcff') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(4,15,26,.78)';
  ctx.beginPath(); ctx.roundRect(8, 12, 496, 104, 22); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 42px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(name).slice(0, 18).toUpperCase(), 256, 65);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(3.2, 0.8, 1);
  sprite.position.y = 3.35;
  return sprite;
}

function addOrUpdateRemotePlayer(id, data) {
  if (!id || !data || id === (socket && socket.id)) return;
  let remote = remotePlayers.get(id);
  if (!remote) {
    const colors = [0xf28b48, 0x8b78e6, 0xe25a75, 0x54bf82, 0xd5dce5];
    const color = Number(data.color) || colors[remotePlayers.size % colors.length];
    const car = createCar(color, false);
    const label = createNameSprite(data.name || 'DRIVER', '#70e7ee');
    scene.add(car); scene.add(label);
    remote = { car, label, name: data.name || 'Driver', x: 0, score: 0, speed: 173, color };
    remotePlayers.set(id, remote);
  }
  remote.x = THREE.MathUtils.clamp(Number(data.x) || 0, -5, 5);
  remote.score = Number(data.score) || 0;
  remote.speed = Number(data.speed) || 173;
  remote.name = data.name || remote.name;
}

function removeRemotePlayer(id) {
  const remote = remotePlayers.get(id);
  if (!remote) return;
  scene.remove(remote.car);
  scene.remove(remote.label);
  remote.car.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); });
  remotePlayers.delete(id);
}

function updateRemotePlayers(dt) {
  for (const [id, remote] of remotePlayers) {
    const relativeZ = THREE.MathUtils.clamp((score - remote.score) * 0.012, -22, 22);
    const z = PLAYER_Z + relativeZ;
    remote.car.position.set(roadCenterAt(z) + remote.x, 0, z);
    remote.car.rotation.y = roadHeadingAt(z);
    remote.car.userData.wheels?.forEach(w => { w.rotation.x -= remote.speed / 3.6 * dt * 0.7; });
    remote.label.position.set(roadCenterAt(z) + remote.x, 3.15, z);
  }
  if (multiplayerMode && socket && socket.connected && state === 'running') {
    networkSendTimer -= dt;
    if (networkSendTimer <= 0) {
      networkSendTimer = 0.1;
      socket.emit('player:update', { x: playerLaneOffset, score: Math.floor(score), speed: Math.round(speed * 3.6), name: currentPlayerName });
    }
  }
}

function bindEvents() {
  window.addEventListener('resize', onResize);
  $('login-button').addEventListener('click', completeLogin);
  $('player-name').addEventListener('keydown', e => { if (e.key === 'Enter') completeLogin(); });
  $('change-user-button').addEventListener('click', () => { $('mode-panel').classList.add('hidden'); $('login-panel').classList.remove('hidden'); });
  $('single-player-button').addEventListener('click', () => chooseMode('single'));
  $('show-multiplayer-button').addEventListener('click', () => chooseMode('multi'));
  $('create-room-button').addEventListener('click', createRoom);
  $('join-room-button').addEventListener('click', joinRoom);
  $('room-code').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
  $('host-start-button').addEventListener('click', () => { if (socket && isRoomHost) socket.emit('race:start', { level: Number($('multi-start-level').value || 1) }); });
  window.addEventListener('keydown', (e) => {
    if (e.target?.closest?.('input, textarea, select, button')) return;
    const isSpace = e.code === 'Space' || e.key === ' ';
    if (['ArrowLeft', 'ArrowRight'].includes(e.code) || isSpace) e.preventDefault();

    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'Enter' && state === 'ready' && !$('start-screen').classList.contains('hidden')) { if (!$('login-panel').classList.contains('hidden')) completeLogin(); else if (!$('multiplayer-setup').classList.contains('hidden')) return; else beginSinglePlayer(); }

    // Turbo only activates after the player has entered a game.
    if (isSpace && state === 'running') setBoost(true);

    if (e.code === 'KeyC') toggleCamera();
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    if (e.code === 'KeyR' && (state === 'gameover' || state === 'paused')) restartGame();
  }, { passive: false });

  window.addEventListener('keyup', (e) => {
    const isSpace = e.code === 'Space' || e.key === ' ';
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (isSpace) {
      e.preventDefault();
      setBoost(false);
    }
  });
  window.addEventListener('blur', () => {
    keys.left = false;
    keys.right = false;
    setBoost(false);
  });
  $('start-button').addEventListener('click', beginSinglePlayer);
  $('resume-button').addEventListener('click', resumeGame);
  $('restart-button').addEventListener('click', restartGame);
  $('pause-restart-button').addEventListener('click', restartGame);
  $('pause-button').addEventListener('click', togglePause);
  $('camera-button').addEventListener('click', toggleCamera);
  $('sound-button').addEventListener('click', toggleSound);

  const bindTouch = (id, key) => {
    const button = $(id);
    const down = (e) => { e.preventDefault(); keys[key] = true; };
    const up = (e) => { e.preventDefault(); keys[key] = false; };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointerleave', up);
    button.addEventListener('pointercancel', up);
  };
  bindTouch('touch-left', 'left'); bindTouch('touch-right', 'right');
  const boostButton = $('touch-boost');
  const boostDown = (e) => { e.preventDefault(); setBoost(true); };
  const boostUp = (e) => { e.preventDefault(); setBoost(false); };
  boostButton.addEventListener('pointerdown', boostDown);
  boostButton.addEventListener('pointerup', boostUp);
  boostButton.addEventListener('pointerleave', boostUp);
  boostButton.addEventListener('pointercancel', boostUp);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'running') pauseGame(); });
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
}

function startGame() {
  if (state !== 'ready') return;
  ensureAudio();
  if (!multiplayerMode) { currentLevel = selectedStartLevel; score = 0; }
  state = 'running';
  $('start-screen').classList.add('hidden');
  lastTime = performance.now();
  updateAudioState();
}

function pauseGame() {
  if (state !== 'running') return;
  state = 'paused';
  $('pause-screen').classList.remove('hidden');
  keys.left = keys.right = false;
  setBoost(false);
  updateAudioState();
}
function resumeGame() {
  if (state !== 'paused') return;
  ensureAudio();
  state = 'running';
  $('pause-screen').classList.add('hidden');
  lastTime = performance.now();
  updateAudioState();
}
function togglePause() {
  if (state === 'running') pauseGame();
  else if (state === 'paused') resumeGame();
}
function restartGame() {
  for (const ob of obstacles) scene.remove(ob);
  obstacles = [];
  for (const item of powerups) scene.remove(item.mesh);
  powerups = [];
  for (const p of particles) if (p.isGroup) scene.remove(p.group); else if (p.parent) p.parent.remove(p);
  particles = [];
  score = 0; lives = 3; speed = NORMAL_SPEED; playerLaneOffset = 0; currentLevel = selectedStartLevel; shieldTimer = 0; extraPowerTimer = 0; steering = 0; targetSteering = 0; spawnTimer = 0; collisionCooldown = 0;
  keys.left = keys.right = false;
  setBoost(false);
  playerCar.position.x = roadCenterAt(PLAYER_Z) + playerLaneOffset; playerCar.rotation.y = roadHeadingAt(PLAYER_Z); playerCar.rotation.z = 0;
  playerCar.visible = true;
  createInitialTraffic();
  updateScoreUI(); updateHealthUI(); updateLevelUI(true);
  $('pause-screen').classList.add('hidden'); $('gameover-screen').classList.add('hidden');
  $('start-screen').classList.add('hidden');
  ensureAudio();
  state = 'running'; lastTime = performance.now();
  updateAudioState();
}
function toggleCamera() {
  cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
  cameraLabel.innerHTML = `<span class="camera-dot"></span> ${cameraMode === 'chase' ? 'CHASE CAM' : 'COCKPIT CAM'}`;
  playerCar.visible = true;
}

function updateScoreUI() {
  scoreEl.textContent = Math.floor(score).toString().padStart(6, '0');
  bestEl.textContent = Math.floor(highScore).toString().padStart(6, '0');
  speedEl.textContent = Math.round(speed * 3.6).toString();
  if (levelEl) levelEl.textContent = `${String(currentLevel).padStart(2, '0')} / 05`;
}
function updateHealthUI() {
  heartsEl.innerHTML = [0, 1, 2].map(i => `<span class="heart ${i < lives ? 'active' : 'lost'}">♥</span>`).join('');
}
function showCollision() {
  if (shieldTimer > 0) {
    playAudioEffect('shield');
    collisionCooldown = 1.1;
    createImpact(playerCar.position.x, PLAYER_Z - 1.3);
    showToast('PROTECTION ACTIVE', 'NO DAMAGE');
    return;
  }
  playAudioEffect('collision');
  lives = Math.max(0, lives - 1);
  collisionCooldown = 1.5;
  updateHealthUI();
  createImpact(playerCar.position.x, PLAYER_Z - 1.3);
  playerLaneOffset = THREE.MathUtils.clamp(playerLaneOffset + (playerLaneOffset > 0 ? -0.65 : 0.65), -5, 5);
  playerCar.position.x = roadCenterAt(PLAYER_Z) + playerLaneOffset;
  showToast('COLLISION DETECTED', '−1 LIFE');
  if (lives <= 0) endGame();
}
function endGame() {
  state = 'gameover';
  keys.left = keys.right = false;
  setBoost(false);
  updateAudioState();
  const final = Math.floor(score);
  if (final > highScore) {
    highScore = final;
    localStorage.setItem('highwayRushHighScore', String(highScore));
  }
  updateScoreUI();
  $('final-score').textContent = final.toString().padStart(6, '0');
  $('final-best').textContent = Math.floor(highScore).toString().padStart(6, '0');
  $('gameover-screen').classList.remove('hidden');
}

function updateRoad(dt, moveSpeed) {
  laneMarkers.forEach(dash => {
    dash.position.z += moveSpeed * dt;
    if (dash.position.z > 13) dash.position.z -= 225;
    dash.position.x = roadCenterAt(dash.position.z) + dash.userData.offsetX;
  });
  roadside.forEach(item => {
    item.mesh.position.z += moveSpeed * dt;
    if (item.mesh.position.z > 18) item.mesh.position.z -= item.wrap;
    item.mesh.position.x = roadCenterAt(item.mesh.position.z) + (item.offsetX || 0);
  });
}

function updateTraffic(dt) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const ob = obstacles[i];
    ob.position.z += speed * dt;
    ob.position.x = roadCenterAt(ob.position.z) + ob.userData.laneOffset;
    ob.rotation.y = roadHeadingAt(ob.position.z);
    ob.userData.wheels?.forEach(w => { w.rotation.x += speed * dt * .75; });
    if (!ob.userData.passed && ob.position.z > PLAYER_Z + 2.6) {
      ob.userData.passed = true;
      score += 35;
    }
    if (ob.position.z > 22) {
      scene.remove(ob); obstacles.splice(i, 1);
    }
    if (collisionCooldown <= 0 && Math.abs(ob.position.z - PLAYER_Z) < 2.45 && Math.abs((ob.position.x - roadCenterAt(ob.position.z)) - playerLaneOffset) < 1.5) {
      scene.remove(ob); obstacles.splice(i, 1);
      showCollision();
      if (state !== 'running') return;
    }
  }
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    const minDistance = obstacles.reduce((m, o) => Math.min(m, Math.abs(o.position.z + 120)), 999);
    const lane = Math.floor(Math.random() * 3);
    const safe = !obstacles.some(o => o.userData.lane === lane && o.position.z < -40 && o.position.z > -105);
    if (safe || minDistance > 35) spawnObstacle(-150 - Math.random() * 12, lane);
    spawnTimer = Math.max(.62, 1.72 - (currentLevel - 1) * 0.18 - (speed - NORMAL_SPEED) * .004) + Math.random() * .4;
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.isGroup) {
      p.group.children.forEach(child => {
        child.position.addScaledVector(child.userData.velocity, dt);
        child.userData.velocity.y -= 8 * dt;
        child.material.opacity = Math.max(0, p.life);
        child.material.transparent = true;
      });
      if (p.life <= 0) { scene.remove(p.group); particles.splice(i, 1); }
    } else if (p.life <= 0) {
      if (p.parent) p.parent.remove(p);
      particles.splice(i, 1);
    }
  }
}

function updateCamera(dt) {
  if (cameraMode === 'chase') {
    const desired = new THREE.Vector3(playerCar.position.x * .55, 5.6, 13.1);
    camera.position.lerp(desired, 1 - Math.pow(.001, dt));
    const look = new THREE.Vector3(roadCenterAt(PLAYER_Z - 22) + playerLaneOffset * .22, 1.0, PLAYER_Z - 22);
    camera.lookAt(look);
  } else {
    camera.position.set(playerCar.position.x * .97, 1.62, PLAYER_Z + .42);
    camera.lookAt(roadCenterAt(PLAYER_Z - 30) + playerLaneOffset * .97, 1.22, PLAYER_Z - 30);
    camera.rotation.z = -steering * .035;
  }
}

function updateGame(dt) {
  const input = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  steerDirection = input;
  targetSteering = input * .92;
  steering = THREE.MathUtils.lerp(steering, targetSteering, 1 - Math.pow(.0008, dt));
  const steerSpeed = 6.2;
  playerLaneOffset = THREE.MathUtils.clamp(playerLaneOffset + steering * steerSpeed * dt, -5.0, 5.0);
  playerCar.position.x = roadCenterAt(PLAYER_Z) + playerLaneOffset;
  playerCar.rotation.y = roadHeadingAt(PLAYER_Z);
  playerCar.rotation.z = THREE.MathUtils.lerp(playerCar.rotation.z, -steering * .09, 1 - Math.pow(.0005, dt));
  playerCar.userData.wheels?.forEach(w => { w.rotation.x -= speed * dt * .85; });
  wheelEl.style.transform = `rotate(${steering * 28}deg)`;

  // Base speed is 173 KM/H. Space smoothly boosts to 274 KM/H.
  // A collected Extra Power pickup temporarily raises Turbo to about 331 KM/H.
  const normalTarget = NORMAL_SPEED;
  const turboTarget = extraPowerTimer > 0 ? 92 : TURBO_SPEED;
  const targetSpeed = keys.boost ? turboTarget : normalTarget;
  const speedResponse = keys.boost ? 2.8 : 1.0;
  const speedBlend = 1 - Math.exp(-speedResponse * dt);
  speed += (targetSpeed - speed) * speedBlend;
  if (!keys.boost && Math.abs(speed - NORMAL_SPEED) < 0.015) speed = NORMAL_SPEED;

  shieldTimer = Math.max(0, shieldTimer - dt);
  extraPowerTimer = Math.max(0, extraPowerTimer - dt);
  updatePowerStatus();
  score += speed * dt * 1.8;
  updateLevelProgress();
  updateAudioState();
  collisionCooldown = Math.max(0, collisionCooldown - dt);
  updateRoad(dt, speed);
  updateTraffic(dt);
  updatePowerups(dt);
  updateRemotePlayers(dt);
  updateParticles(dt);
  updateScoreUI();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .04);
  if (state === 'running') updateGame(dt);
  else updateParticles(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}

try { init(); }
catch (error) {
  console.error(error);
  $('loading-cover').innerHTML = '<span>Unable to load the 3D scene. Please use a modern browser and check your internet connection.</span>';
}
