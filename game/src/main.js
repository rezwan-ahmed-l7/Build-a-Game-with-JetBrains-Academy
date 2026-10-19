import * as THREE from 'three';
import './style.css';

import { createRenderer } from './components/Renderer.js';
import { createCamera } from './components/Camera.js';
import { createPlayer } from './components/Player.js';
import { createInput } from './components/Input.js';
import { createMovement } from './components/Movement.js';
import { createCameraFollow } from './components/CameraFollow.js';
import { createEnemyManager } from './components/EnemyManager.js';
import {
  resolveEnemyVsEnemy,
  resolveEnemyVsPlayer,
  resolveEnemyVsObstacles,
  resolvePlayerVsObstacles,
  canPlayerMoveTo,
  PLAYER_COLLISION_RADIUS,
  ENEMY_COLLISION_RADIUS
} from './components/Collision.js';
import { createAttack } from './components/Attack.js';
import { createScore, getLevel } from './components/Score.js';
import { getEffectiveProfile } from './components/Profile.js';
import { submitScore as leaderboardSubmit } from './components/Leaderboard.js';
import { createDifficulty } from './components/Difficulty.js';
import { createObstacles } from './components/Obstacles.js';
import { createEnvironment } from './components/Environment.js';
import { GROUND_RADIUS } from './components/WorldBounds.js';

import { GameState } from './components/GameState.js';
import { createHealth } from './components/Health.js';
import { createCombo } from './components/Combo.js';
import { createDash } from './components/Dash.js';
import { createParticles } from './components/Particles.js';
import { createDamageNumbers } from './components/DamageNumbers.js';
import { createPowerUpManager } from './components/PowerUpManager.js';
import { createAudio } from './components/Audio.js';
import { createMenus } from './components/Menus.js';
import { createTouchControls } from './components/TouchControls.js';
import { createScreenShake } from './components/ScreenShake.js';
import { createGameManager } from './components/GameManager.js';
import { isTouchDevice } from './utils/dom.js';

const PLAYER_VS_ENEMY_DIST = PLAYER_COLLISION_RADIUS + ENEMY_COLLISION_RADIUS;

// Touch controls reference (initialized later for touch devices)
let touch = null;

// Damage flash element
const damageFlash = document.createElement('div');
damageFlash.className = 'damage-flash';
document.body.appendChild(damageFlash);

// -------- Scene --------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071024);
// No fog — sea surrounds the ground like an island

// Sky dome: gradient sphere that follows the camera. Day side is warmer,
// night side is cooler. This sits behind everything else and replaces the
// flat dark-blue background that was making the world feel boxy.
const skyGeometry = new THREE.SphereGeometry(2400, 32, 16);
const skyMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    topColor: { value: new THREE.Color(0x1b3a78) },     // upper sky
    bottomColor: { value: new THREE.Color(0x80b6e8) },  // horizon
    offset: { value: 200 },
    exponent: { value: 0.5 }
  },
  vertexShader: /* glsl */`
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition + vec3(0.0, 0.0, offset)).z;
      // Smooth step for more natural gradient transition
      float t = smoothstep(-0.1, 1.0, pow(max(h, 0.0), exponent));
      gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
    }
  `
});
const sky = new THREE.Mesh(skyGeometry, skyMaterial);
sky.renderOrder = -1;
scene.add(sky);

// Lighting
const ambientLight = new THREE.AmbientLight(0xa0b0d0, 1.3);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xfff0dd, 1.8);
directionalLight.position.set(-140, -160, 280);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(2048, 2048);
directionalLight.shadow.camera.near = 10;
directionalLight.shadow.camera.far = 1200;
directionalLight.shadow.bias = -0.0001;
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0x88c0ff, 0.55);
fillLight.position.set(160, 120, 200);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0x00e6b8, 1.0, 700);
rimLight.position.set(0, -40, 160);
scene.add(rimLight);

const lightTarget = new THREE.Object3D();
scene.add(lightTarget);
directionalLight.target = lightTarget;

// Ground — a subtle procedural meadow texture prevents the arena from
// reading as a single flat green sheet, without adding external assets.
function createMeadowTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Deterministic noise so the meadow looks consistent between runs.
  let seed = 0x51a7e;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Large, soft color patches that create a natural meadow feel.
  for (let i = 0; i < 120; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 30 + random() * 70;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const tint = random() > 0.5
      ? 'rgba(190, 192, 126, 0.08)'
      : 'rgba(45, 83, 45, 0.06)';
    gradient.addColorStop(0, tint);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // Subtle grass strokes for texture without noise.
  for (let i = 0; i < 3000; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 0.35 + random() * 0.6;
    ctx.fillStyle = random() > 0.5
      ? 'rgba(72, 112, 48, 0.05)'
      : 'rgba(180, 198, 126, 0.04)';
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.4, radius * 0.65, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tiny bright specks — wildflowers scattered sparsely across the meadow.
  for (let i = 0; i < 180; i++) {
    const x = random() * size;
    const y = random() * size;
    const r = 0.5 + random() * 0.8;
    const hue = random() > 0.5 ? 'rgba(255,240,180,0.12)' : 'rgba(200,220,255,0.08)';
    ctx.fillStyle = hue;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

const groundGeometry = new THREE.CircleGeometry(GROUND_RADIUS, 128);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x344b2b, map: createMeadowTexture(), roughness: 1.0, metalness: 0
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.position.z = -0.5;
ground.receiveShadow = true;
scene.add(ground);

// Sand beach ring — a sandy shore around the ground edge (840–900)
// that gives the island a natural beach look before the dark water beyond.
function createSandTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  // Base sandy color
  ctx.fillStyle = '#c4a96a';
  ctx.fillRect(0, 0, size, size);
  // Add noise for grain
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.5;
    const brightness = 160 + Math.random() * 60;
    ctx.fillStyle = `rgba(${brightness},${brightness - 30},${brightness - 60},0.3)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 1);
  texture.needsUpdate = true;
  return texture;
}
const sandGeometry = new THREE.RingGeometry(GROUND_RADIUS, GROUND_RADIUS + 150, 128);
const sandMaterial = new THREE.MeshStandardMaterial({
  color: 0xc4a96a, map: createSandTexture(), roughness: 1.0, metalness: 0
});
const sand = new THREE.Mesh(sandGeometry, sandMaterial);
sand.position.z = -0.4;
sand.receiveShadow = true;
scene.add(sand);

// Sea — dark water ring surrounding the island, visible beyond the sand beach
// Uses a canvas texture for a gradient: lighter near shore, darker far out.
function createSeaTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  // Radial gradient: light turquoise near shore, deep navy far out
  const gradient = ctx.createRadialGradient(size/2, size/2, size * 0.1, size/2, size/2, size/2);
  gradient.addColorStop(0, '#63d9d1');
  gradient.addColorStop(0.12, '#28a9b5');
  gradient.addColorStop(0.34, '#167b9b');
  gradient.addColorStop(0.68, '#105071');
  gradient.addColorStop(1, '#08283f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
const seaGeometry = new THREE.RingGeometry(1000, 2000, 128, 8);
const seaMaterial = new THREE.MeshStandardMaterial({
  color: 0x4caeb7, map: createSeaTexture(), roughness: 0.22, metalness: 0.18,
  transparent: true, opacity: 0.85, depthWrite: false
});
const sea = new THREE.Mesh(seaGeometry, seaMaterial);
sea.position.z = -2;
sea.receiveShadow = true;
scene.add(sea);

// Store original sea vertex positions for wave animation
const seaPositions = seaGeometry.attributes.position.array.slice();

// Sea ripple rings — expanding circles from shore inward like pond effect
const seaRipples = [];
for (let i = 0; i < 10; i++) {
  const rippleMat = new THREE.MeshBasicMaterial({
    color: 0x87ceeb, transparent: true, opacity: 0, depthWrite: false
  });
  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(50, 100, 48),
    rippleMat
  );
  ripple.position.z = -1.5;
  const angle = (i / 10) * Math.PI * 2;
  // Start at shore edge (1000)
  ripple.position.x = Math.cos(angle) * 1000;
  ripple.position.y = Math.sin(angle) * 1000;
  ripple.userData.phase = i * 0.6;
  ripple.userData.speed = 0.15 + Math.random() * 0.1;
  ripple.userData.angle = angle;
  scene.add(ripple);
  seaRipples.push(ripple);
}

// Rolling shore wash: independently animated foam crests make waves visibly
// reach onto the sand, then retreat. This is purely decorative.
const shoreFoam = [];
for (let i = 0; i < 36; i++) {
  const foamMaterial = new THREE.MeshBasicMaterial({
    color: 0xc9fff5, transparent: true, opacity: 0.38,
    depthWrite: false, side: THREE.DoubleSide
  });
  const foam = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), foamMaterial);
  const angle = (i / 36) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
  foam.userData = { angle, phase: Math.random() * Math.PI * 2, speed: 0.65 + Math.random() * 0.55 };
  foam.scale.set(9 + Math.random() * 8, 3 + Math.random() * 4, 0.22);
  foam.position.set(Math.cos(angle) * 991, Math.sin(angle) * 991, -0.12);
  scene.add(foam);
  shoreFoam.push(foam);
}

// Starfish on sand beach — small 5-pointed shapes scattered on the sand
const starfishGroup = new THREE.Group();
const starfishColors = [0xd45a3a, 0xc44a2a, 0xe46a4a];
for (let i = 0; i < 40; i++) {
  const angle = Math.random() * Math.PI * 2;
  const radius = GROUND_RADIUS + 10 + Math.random() * 130; // on sand ring
  const sfMat = new THREE.MeshStandardMaterial({
    color: starfishColors[i % 3], roughness: 0.8, metalness: 0.05
  });
  const sf = createStarfishShape(sfMat);
  sf.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.1);
  sf.rotation.z = Math.random() * Math.PI * 2;
  const sizes = [3.2, 4.1, 5.0];
  const s = sizes[i % 3];
  sf.scale.setScalar(s);
  starfishGroup.add(sf);
}
scene.add(starfishGroup);

function createStarfishShape(mat) {
  const g = new THREE.Group();
  const shellMat = mat || new THREE.MeshStandardMaterial({ color: 0xd45a3a, roughness: 0.92 });
  const shape = new THREE.Shape();
  const points = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 === 0 ? 1.35 : 0.62;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1], curr = points[i];
    shape.quadraticCurveTo((prev[0] + curr[0]) * 0.54, (prev[1] + curr[1]) * 0.54, curr[0], curr[1]);
  }
  shape.closePath();
  const shellGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.18, bevelEnabled: true, bevelSegments: 3, steps: 1,
    bevelSize: 0.12, bevelThickness: 0.08, curveSegments: 8
  });
  shellGeo.computeVertexNormals();
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.position.z = 0.02;
  g.add(shell);
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.43, 16, 10),
    new THREE.MeshStandardMaterial({ color: shellMat.color.clone().multiplyScalar(0.86), roughness: 0.94 })
  );
  center.scale.set(1, 1, 0.42);
  center.position.z = 0.24;
  g.add(center);
  const bumpMat = new THREE.MeshStandardMaterial({
    color: shellMat.color.clone().lerp(new THREE.Color(0xffc18a), 0.22), roughness: 0.96
  });
  for (let b = 0; b < 34; b++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.25 + Math.random() * 0.88;
    const bump = new THREE.Mesh(new THREE.SphereGeometry(0.045 + Math.random() * 0.035, 8, 6), bumpMat);
    bump.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.24 + Math.random() * 0.035);
    bump.scale.z = 0.6;
    g.add(bump);
  }
  return g;
}

// Crabs on sand beach — small simple crab shapes
const crabGroup = new THREE.Group();
const crabColors = [0x8a3a2a, 0x7a2a1a, 0x9a4a3a];
for (let i = 0; i < 15; i++) {
  const angle = Math.random() * Math.PI * 2;
  const radius = GROUND_RADIUS + 5 + Math.random() * 140; // on sand ring
  const crab = createCrabShape(crabColors[i % 3]);
  crab.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.15);
  crab.rotation.z = Math.random() * Math.PI * 2;
  crab.scale.setScalar([1.8, 2.5, 3.2][i % 3]);
  crab.userData.anchorX = crab.position.x;
  crab.userData.anchorY = crab.position.y;
  crab.userData.anchorAngle = angle;
  crab.userData.anchorRadius = radius;
  crab.userData.baseAngle = crab.rotation.z;
  crab.userData.phase = Math.random() * Math.PI * 2;
  crab.userData.speed = 3 + Math.random() * 4;
  crab.userData.drift = 5 + Math.random() * 10;
  crabGroup.add(crab);
}
scene.add(crabGroup);

function createCrabShape(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: color || 0x8a3a2a, roughness: 0.6, metalness: 0.05 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x5a2a1a, roughness: 0.7, metalness: 0.05 });
  // Body — wider, flatter oval with shell texture
  const bodyGeo = new THREE.SphereGeometry(1, 24, 16);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(1.2, 0.8, 0.28);
  g.add(body);
  // Shell ridge
  const ridgeGeo = new THREE.SphereGeometry(1, 18, 12);
  const ridge = new THREE.Mesh(ridgeGeo, darkMat);
  ridge.position.set(0, 0, 0.24);
  ridge.scale.set(0.72, 0.16, 0.055);
  g.add(ridge);
  // Claws — more detailed with segments
  const clawMat = new THREE.MeshStandardMaterial({ color: color || 0x8a3a2a, roughness: 0.5, metalness: 0.08 });
  for (let side = -1; side <= 1; side += 2) {
    const clawGroup = new THREE.Group();
    // Arm segment
    const armGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.8, 10);
    const arm = new THREE.Mesh(armGeo, clawMat);
    arm.rotation.z = side * 0.5;
    arm.position.set(0.6, side * 0.3, 0.1);
    clawGroup.add(arm);
    // Claw pincer
    const pincerGeo = new THREE.SphereGeometry(0.25, 14, 10);
    const pincer = new THREE.Mesh(pincerGeo, clawMat);
    pincer.position.set(1.0, side * 0.6, 0.2);
    pincer.scale.set(1.2, 0.8, 0.7);
    clawGroup.add(pincer);
    // Pincer tip
    const tipGeo = new THREE.SphereGeometry(0.12, 10, 8);
    const tip = new THREE.Mesh(tipGeo, darkMat);
    tip.position.set(1.2, side * 0.7, 0.25);
    clawGroup.add(tip);
    clawGroup.userData.side = side;
    g.add(clawGroup);
    g.userData = g.userData || {};
    g.userData.claws = g.userData.claws || [];
    g.userData.claws.push(clawGroup);
  }
  // Legs — 4 pairs of thin legs
  const legGeo = new THREE.CylinderGeometry(0.045, 0.065, 0.68, 8);
  for (let side = -1; side <= 1; side += 2) {
    for (let l = 0; l < 4; l++) {
      const leg = new THREE.Mesh(legGeo, darkMat);
      const la = (l / 4) * Math.PI * 0.6 + 0.3;
      leg.position.set(Math.cos(la) * 0.4, side * (0.5 + l * 0.15), 0.05);
      leg.rotation.z = side * (0.3 + l * 0.2);
      leg.userData.baseRotation = leg.rotation.z;
      leg.userData.phase = l * 0.9 + (side > 0 ? Math.PI : 0);
      g.add(leg);
      g.userData = g.userData || {};
      g.userData.legs = g.userData.legs || [];
      g.userData.legs.push(leg);
    }
  }
  // Eyes — on stalks
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (let side = -1; side <= 1; side += 2) {
    // Stalk
    const stalkGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.3, 8);
    const stalk = new THREE.Mesh(stalkGeo, darkMat);
    stalk.position.set(0.8, side * 0.2, 0.28);
    stalk.rotation.x = Math.PI / 2;
    stalk.rotation.y = side * 0.2;
    g.add(stalk);
    // Eye ball
    const eyeGeo = new THREE.SphereGeometry(0.12, 12, 8);
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0.9, side * 0.25, 0.42);
    g.add(eye);
    // Pupil
    const pupilGeo = new THREE.SphereGeometry(0.055, 8, 6);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(0.98, side * 0.28, 0.44);
    g.add(pupil);
  }
  return g;
}

// Player
const player = createPlayer();
scene.add(player.group);
// Environment (depends on lights + player)
const environment = createEnvironment(scene, {
  ambientLight, directionalLight, fillLight, rimLight
}, groundMaterial, player.group, skyMaterial);
// Camera — child of player group so it follows the player naturally
const camera = createCamera();
scene.add(camera);

const canvas = document.querySelector('canvas.game');
const cameraFollow = createCameraFollow(camera, player.group, canvas);
// Input + Movement
const input = createInput();
input.setEnabled(false); // menu accepts menu shortcuts, not queued movement
const obstacles = createObstacles(scene);  // create BEFORE movement

// Audio (created BEFORE enemyManager so the spawn SFX can be wired in)
const audio = createAudio();

const enemyManager = createEnemyManager(scene, player.group, audio);
const movement = createMovement(
  player.group, player.getModel, input, camera,
  (targetPos) => {
    // While dashing, skip obstacle check so the player can pass through
    if (dash.isDashing()) {
      return canPlayerMoveTo(targetPos, enemyManager.getEnemies(), []);
    }
    return canPlayerMoveTo(targetPos, enemyManager.getEnemies(), obstacles.getObstacles());
  },
  audio
);
// Score / Health / Combo / Difficulty
// `submitScore` is the single swap-point for a future backend. It reads
// the current profile (or falls back to Anonymous + frog emoji) and
// hands the entry to the Leaderboard. The leaderboard now uses JSONBin.io
// for cloud storage — any device can read/write scores. Falls back to
// localStorage if network is unavailable.
async function submitScore({ score: s, ts }) {
  console.log('[main] submitScore called, score:', s);
  const profile = getEffectiveProfile();
  console.log('[main] Profile:', profile);
  const entry = { name: profile.name, flag: profile.flag, score: s, ts: ts || Date.now() };
  console.log('[main] Submitting entry:', entry);
  const rank = await leaderboardSubmit(entry);
  console.log('[main] Leaderboard rank:', rank);
  return rank;
}
const score = createScore({ submitter: submitScore });
const health = createHealth(3);
const combo = createCombo();
const difficulty = createDifficulty();
score.setHearts(health.getHp(), health.getMax());

// Particles, damage numbers, screen shake
const particles = createParticles(scene);
const damageNumbers = createDamageNumbers(scene);
const screenShake = createScreenShake();

// Dash
const dash = createDash(player.group, camera, () => {
  // Combine keyboard + touch joystick
  const fromKeys = input.getHeldDirection ? input.getHeldDirection() : null;
  if (fromKeys) return fromKeys;
  if (touch && touch.getDirection) return touch.getDirection();
  return null;
}, (dx, dy) => movement.translate(dx, dy));

// Power-ups
const powerUps = createPowerUpManager(scene, player.group);

// ----- Game Manager (state, transitions, power-ups) -----
// Note: menus is created below to avoid circular dependency with gameManager.menuCallbacks
const gameManager = createGameManager({
  player,
  input,
  movement,
  health,
  combo,
  score,
  enemyManager,
  powerUps,
  dash,
  attack: null, // set after attack is created
  audio,
  menus: null, // set after menus is created
  particles,
  damageNumbers,
  screenShake,
  damageFlash
});

// Wire the game-over panel's visible Restart button. Touch users tap
// the button; keyboard users press Space or Enter (the keydown handler in
// main.js also calls gameManager.resetGame()).
score.setOnRestart(() => gameManager.resetGame());

// Back button returns to main menu
score.setOnBack(() => gameManager.showMenu());

// ----- Attack (with hooks from game manager) -----
const attack = createAttack(scene, player.group, enemyManager, gameManager.attackHooks);
gameManager.setAttack(attack);

// ----- Menus -----
const menus = createMenus({
  ...gameManager.menuCallbacks,
  onCycleMode: () => environment.cycleMode()
});
gameManager.setMenus(menus);
menus.showStart();
menus.showHud(false); // hidden until start

// Audio ambient brightness follows day/night
environment.onUpdate((dayFactor) => {
  audio.setAmbientNightness(1 - dayFactor);
});

// ----- Touch controls (mount only on touch devices) -----
if (isTouchDevice()) {
  touch = createTouchControls({
    onPause: gameManager.togglePause,
    onAttack: () => {
      if (gameManager.isPlaying()) attack.attack(performance.now());
    },
    onDash: () => {
      // Mobile dash uses the last joystick direction, even after the
      // player lifts their thumb to tap the separate DASH button.
      if (gameManager.isPlaying()) {
        const started = dash.tryStart();
        if (started) {
          audio.playDash();
          particles.spawnBurst(player.group.position.x, player.group.position.y, player.group.position.z + 4, {
            count: 14, color: 0x9ee7ff, speed: 50, life: 0.4, size: 6
          });
        }
      }
    }
  });
}

// Attach click-to-attack on the canvas for non-touch
input.attachClickToAttack(canvas, () => {
  if (gameManager.isPlaying()) attack.attack(performance.now());
});

// Right-click triggers dash during gameplay
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (gameManager.isPlaying()) {
    const started = dash.tryStart();
    if (started) {
      audio.playDash();
      particles.spawnBurst(player.group.position.x, player.group.position.y, player.group.position.z + 4, {
        count: 14, color: 0x9ee7ff, speed: 50, life: 0.4, size: 6
      });
    }
  }
});

// ----- Global keybinds -----
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Enter') {
    e.preventDefault();
    if (gameManager.isMenu()) {
      gameManager.startGame();
      return;
    }
    if (gameManager.isGameOver()) {
      return; // Let Score.js handle Enter for restart
    }
    if (gameManager.isPaused()) {
      menus.hidePause();
      gameManager.resetGame();
      return;
    }
  } else if (e.code === 'Space') {
    e.preventDefault();
    // Space is ONLY for attacking during gameplay; Enter handles restart/pause.
    if (gameManager.isPlaying()) {
      attack.attack(performance.now());
    }
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (gameManager.isPlaying()) {
      gameManager.togglePause();
    } else if (gameManager.isPaused()) {
      gameManager.beginResumeCountdown();
    } else if (gameManager.isGameOver()) {
      gameManager.showMenu();
    }
  } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    e.preventDefault();
    if (gameManager.isPlaying()) {
      const started = dash.tryStart();
      if (started) {
        audio.playDash();
        particles.spawnBurst(player.group.position.x, player.group.position.y, player.group.position.z + 4, {
          count: 14, color: 0x9ee7ff, speed: 50, life: 0.4, size: 6
        });
      }
    }
  }
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// Movement exposes getCameraBasis natively now.

// ----- Renderer -----
const renderer = createRenderer(canvas);


// Development-only debug hooks support browser QA without exposing the
// full game object on production builds.
if (import.meta.env.DEV) {
  window.__game = {
    scene, player, enemyManager, obstacles, health, score,
    environment,
    input, movement, dash, attack, powerUps,
    gameManager,
    onPowerUpPickup: gameManager.onPowerUpPickup,
    currentState: gameManager.currentState,
    // Test-only: setting __testFreezeCamera to true short-circuits the
    // camera-follow update so headless screenshot scripts can pose the
    // camera without it snapping back. This block is dead in production.
    __setFreezeCamera: (freeze) => { window.__testFreezeCamera = !!freeze; },
    camera
  };
}

// ----- Main loop -----
let previousTime = performance.now();
function animate(currentTime) {
  requestAnimationFrame(animate);
  const delta = Math.min((currentTime - previousTime) / 1000, 0.1);
  previousTime = currentTime;

  const effectiveDelta = attack.getHitStopDelta(delta);

  // Always-on systems
  health.update(delta);
  particles.update(delta);
  damageNumbers.update(delta, camera);
  audio.update && audio.update(delta);
  if (gameManager.getFlashTimer() > 0) {
    gameManager.setFlashTimer(Math.max(0, gameManager.getFlashTimer() - delta));
  }

  if (gameManager.currentState() === GameState.PLAYING || gameManager.currentState() === GameState.COUNTDOWN) {
    // During countdown, only update visuals — skip all gameplay logic
    const isCountdown = gameManager.currentState() === GameState.COUNTDOWN;
    if (isCountdown) {
      // Still render the scene and update visuals, but skip gameplay
    } else {
    if (gameManager.checkPlayerEnemyContact(PLAYER_VS_ENEMY_DIST)) {
      // damage handled inside health onChange
    }
    difficulty.setScore(score.getScore());
    const d = difficulty.get();
    enemyManager.setSpawnInterval(d.spawnInterval);
    enemyManager.setSpeedMultiplier(d.enemySpeed / 16);
    enemyManager.setDifficulty(d.difficulty);

    // Level detection — check if score crossed into a new level
    const displayScore = Math.floor(score.getScore());
    const newLevel = getLevel(displayScore);
    if (newLevel > gameManager.getCurrentLevel()) {
      gameManager.triggerLevelUp(newLevel);
    }

    // Speed boost timer
    if (gameManager.getSpeedBoostRemaining() > 0) {
      gameManager.setSpeedBoostTimer(Math.max(0, gameManager.getSpeedBoostRemaining() - delta));
      movement.setSpeedMultiplier(gameManager.SPEED_BOOST_MULT);
    } else {
      // Restore level-based speed when boost expires
      const lvl = gameManager.getCurrentLevel();
      const levelSpeed = gameManager.LEVEL_STATS[lvl] ? gameManager.LEVEL_STATS[lvl].moveSpeedMult : 1.0;
      movement.setSpeedMultiplier(levelSpeed);
    }

    // Long-attack boost: tick down the timer and re-apply the boosted
    // radius AFTER the difficulty set so it never desyncs.
    if (gameManager.getAttackBoostRemaining() > 0) {
      gameManager.setAttackBoostTimer(Math.max(0, gameManager.getAttackBoostRemaining() - delta));
      attack.setRadius(gameManager.getBoostedAttackRadius());
    } else {
      // Restore base attack radius when boost expires
      const lvl = gameManager.getCurrentLevel();
      const baseRadius = gameManager.BASE_ATTACK_RADIUS;
      attack.setRadius(baseRadius);
    }

    // Shield timer
    if (gameManager.getShieldRemaining() > 0) {
      gameManager.setShieldTimer(Math.max(0, gameManager.getShieldRemaining() - delta));
    }

    // Double attack timer
    if (gameManager.getDoubleAttackRemaining() > 0) {
      gameManager.setDoubleAttackTimer(Math.max(0, gameManager.getDoubleAttackRemaining() - delta));
    }

    // Magnet timer — auto-pull power-ups toward player
    if (gameManager.getMagnetRemaining() > 0) {
      gameManager.setMagnetTimer(Math.max(0, gameManager.getMagnetRemaining() - delta));
    }

    // Freeze timer — pause enemy movement
    if (gameManager.getFreezeRemaining() > 0) {
      gameManager.setFreezeTimer(Math.max(0, gameManager.getFreezeRemaining() - delta));
    }

    // Feed the held virtual joystick direction into the same one-step
    // movement queue as keyboard input. Re-queue only after the current
    // jump finishes, so holding the stick keeps moving without flooding input.
    if (touch && touch.getMoveDirection && !movement.isCurrentlyMoving()) {
      const joystickDirection = touch.getMoveDirection();
      if (joystickDirection) input.enqueueDirection(joystickDirection);
    }

    movement.update(effectiveDelta);
    // Apply dash after normal movement for this frame, while Movement's
    // translate() shifts the active interpolation anchors to preserve it.
    dash.update(delta);
    movement.applySquashStretch();
    player.setMoving(movement.isCurrentlyMoving());

    // Apply freeze to enemies
    enemyManager.setFrozen(gameManager.getFreezeRemaining() > 0);
    enemyManager.update(effectiveDelta, currentTime / 1000);

    // Footstep dust when moving on the ground
    if (movement.isCurrentlyMoving()) {
      if (Math.random() < 0.25) {
        particles.spawnDust(player.group.position.x, player.group.position.y, 0);
      }
    }

    const enemies = enemyManager.getEnemies();
    const obstacleList = obstacles.getObstacles();
    resolveEnemyVsEnemy(enemies);
    resolveEnemyVsObstacles(enemies, obstacleList);
    resolveEnemyVsPlayer(enemies, player.group.position);
    // Skip player-vs-obstacle collision while dashing so the player can pass through
    if (!dash.isDashing()) {
      resolvePlayerVsObstacles(player.group.position, obstacleList);
    }

    combo.update(delta);
    gameManager.tickComboHud();

    powerUps.update(delta, currentTime / 1000, gameManager.onPowerUpPickup, gameManager.getMagnetRemaining() > 0);
    score.tick(delta);
    score.render();
    } // end else (not countdown)
  } else if (gameManager.currentState() === GameState.PAUSED) {
    // Nothing simulates; only visual systems run
  } else if (gameManager.currentState() === GameState.GAMEOVER) {
    // Player.update still runs (idle continues at game-over) for the body
  }

  // Environment always runs (day/night keeps cycling through pause/over)
  // When paused or counting down, freeze the phase so the cycle doesn't advance.
  let environmentState;
  if (gameManager.isPaused() || gameManager.isCountdown()) {
    const savedPhase = environment.getPhase && environment.getPhase();
    environmentState = environment.update(delta);
    if (savedPhase != null && environment.setPhase) {
      environment.setPhase(savedPhase);
    }
  } else {
    environmentState = environment.update(delta);
  }
  menus.setEnvironmentMode({
    label: environmentState.label,
    mode: environment.getMode()
  });

  // Sky dome follows the player so the gradient is always centered.
  sky.position.set(
    player.group.position.x,
    player.group.position.y,
    player.group.position.z
  );
  // Tint sky by day/dusk factor if the environment exposes one.
  // The Environment returns pre-blended hex colors for the dome top and
  // horizon so the gradient is reliable (no HSL hue quirks).
  if (environmentState && typeof environmentState.skyTopColor === 'number') {
    skyMaterial.uniforms.topColor.value.setHex(environmentState.skyTopColor);
    skyMaterial.uniforms.bottomColor.value.setHex(environmentState.skyBottomColor);
  }

  // Pond animation (ripple expands, lily pads bob). Always runs.
  if (obstacles.updatePond) obstacles.updatePond(delta);

  // Sea wave animation — multiple layers of large, visible waves
  const time = currentTime / 1000;
  for (const foam of shoreFoam) {
    const d = foam.userData;
    const swell = Math.sin(time * d.speed + d.phase);
    // The wet edge travels across the overlapping sand/water boundary:
    // the crest reaches up the beach, then drains back into the sea.
    const radius = 1015 + swell * 55;
    const driftAngle = d.angle + Math.sin(time * 0.35 + d.phase) * 0.018;
    foam.position.set(Math.cos(driftAngle) * radius, Math.sin(driftAngle) * radius, -0.12 + Math.max(0, swell) * 0.22);
    foam.rotation.z = driftAngle + Math.PI / 2;
    foam.material.opacity = 0.12 + (0.5 + 0.5 * swell) * 0.38;
    foam.scale.x = 9 + Math.max(0, swell) * 7;
  }
  for (const crab of crabGroup.children) {
    const d = crab.userData;
    const t = time * d.speed + d.phase;
    // Roam tangentially along the beach so crabs don't wander into grass
    // or out into the sea.
    const roamAngle = d.anchorAngle + Math.sin(t * 0.28) * (d.drift / d.anchorRadius);
    crab.position.x = Math.cos(roamAngle) * d.anchorRadius;
    crab.position.y = Math.sin(roamAngle) * d.anchorRadius;
    crab.rotation.z = d.baseAngle + Math.sin(t * 0.65) * 0.18;
    crab.position.z = 0.15 + Math.abs(Math.sin(t * 3.2)) * 0.035;
    for (const leg of d.legs || []) leg.rotation.z = leg.userData.baseRotation + Math.sin(t * 7 + leg.userData.phase) * 0.16;
    for (const claw of d.claws || []) claw.rotation.z = Math.sin(t * 2.3 + claw.userData.side) * 0.09;
  }
  const pos = seaGeometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ox = seaPositions[i * 3];
    const oy = seaPositions[i * 3 + 1];
    const dist = Math.sqrt(ox * ox + oy * oy);
    const angle = Math.atan2(oy, ox);
    // Three overlapping wave layers for big, visible waves
    const wave = Math.sin(dist * 0.008 - time * 1.0) * 12.0
               + Math.sin(dist * 0.004 + time * 0.6 + angle * 1.5) * 8.0
               + Math.sin(dist * 0.015 - time * 1.8 + angle * 3) * 4.0;
    pos.setZ(i, wave);
  }
  pos.needsUpdate = true;

  // Sea ripple rings — expanding from shore inward
  for (const ripple of seaRipples) {
    const phase = (time * ripple.userData.speed + ripple.userData.phase) % 3;
    const t = phase / 3;
    // Move from shore (1000) outward into sea
    const dist = 1000 + t * 600;
    ripple.position.x = Math.cos(ripple.userData.angle) * dist;
    ripple.position.y = Math.sin(ripple.userData.angle) * dist;
    ripple.scale.setScalar(1 + t * 30);
    ripple.material.opacity = 0.5 * (1 - t) * Math.min(1, t * 5);
  }

  // Player visual update always runs (idle breathing continues during game over)
  player.update(delta);
  attack.updateVisual(delta);

  // Anchor directional light to player
  lightTarget.position.copy(player.group.position);
  lightTarget.position.z = 0;
  directionalLight.position.set(
    player.group.position.x - 140,
    player.group.position.y - 160,
    280
  );

  // Camera follow + screen shake offset
  // Dev-only escape hatch so headless QA scripts can pose the camera
  // without it snapping back. No-op unless explicitly toggled.
  if (!(import.meta.env.DEV && window.__testFreezeCamera)) {
    cameraFollow.update(delta);
  }
  const shake = screenShake.getIntensity();
  if (shake > 0) {
    const off = screenShake.update(delta, null);
    const savedX = camera.position.x;
    const savedY = camera.position.y;
    const savedZ = camera.position.z;
    camera.position.x += off.x;
    camera.position.y += off.y;
    camera.position.z += off.z;
    renderer.render(scene, camera);
    camera.position.x = savedX;
    camera.position.y = savedY;
    camera.position.z = savedZ;
    return;
  }
  renderer.render(scene, camera);
}

// Environment mode label is owned by Menus now (single mode pill in the HUD).
// Debug: ?autoplay=1 jumps straight into the game (no menu).
// Useful for screenshot/headless testing.
if (new URLSearchParams(location.search).get('autoplay') === '1') {
  setTimeout(() => gameManager.startGame(), 200);
}

// ----- Boot -----
animate(previousTime);