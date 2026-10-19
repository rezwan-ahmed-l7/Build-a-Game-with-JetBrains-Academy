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
import { createSeaShips } from './components/SeaShips.js';

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

  // Earthy base under the grass: exposed soil should be part of the meadow,
  // not a uniformly green carpet. The environment tint still drives day/night.
  ctx.fillStyle = '#c0ad83';
  ctx.fillRect(0, 0, size, size);

  let seed = 0x51a7e;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Fine mineral/soil grain across the entire ground.
  for (let i = 0; i < 14500; i++) {
    const x = random() * size;
    const y = random() * size;
    const r = 0.35 + random() * 1.25;
    const shade = random();
    ctx.fillStyle = shade > 0.55
      ? `rgba(83, 68, 43, ${0.035 + random() * 0.07})`
      : `rgba(244, 224, 177, ${0.04 + random() * 0.09})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.5, r * 0.7, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Irregular dry-soil clearings with soft, broken edges; no perfect circles.
  for (let i = 0; i < 155; i++) {
    const x = random() * size;
    const y = random() * size;
    const rx = 9 + random() * 38;
    const ry = rx * (0.42 + random() * 0.75);
    const rotation = random() * Math.PI;
    const palette = [
      'rgba(153, 119, 73, 0.30)',
      'rgba(184, 151, 99, 0.34)',
      'rgba(104, 91, 60, 0.18)',
      'rgba(208, 184, 132, 0.32)'
    ];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = palette[Math.floor(random() * palette.length)];
    ctx.beginPath();
    const points = 9;
    for (let p = 0; p <= points; p++) {
      const a = (p / points) * Math.PI * 2;
      const wobble = 0.72 + random() * 0.42;
      const px = Math.cos(a) * rx * wobble;
      const py = Math.sin(a) * ry * wobble;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Grass cover grows in uneven clumps, leaving gaps of visible earth.
  for (let i = 0; i < 245; i++) {
    const x = random() * size;
    const y = random() * size;
    const rx = 12 + random() * 45;
    const ry = rx * (0.45 + random() * 0.8);
    const hue = random();
    const tint = hue > 0.72
      ? 'rgba(116, 133, 64, 0.42)'
      : hue > 0.38
        ? 'rgba(87, 119, 54, 0.56)'
        : 'rgba(54, 91, 43, 0.48)';
    const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    grad.addColorStop(0, tint);
    grad.addColorStop(0.65, tint.replace(/0\.\d+\)$/, '0.20)'));
    grad.addColorStop(1, 'rgba(80, 104, 48, 0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(random() * Math.PI);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, rx, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Tiny blades and flattened grass strokes, grouped in natural directions.
  for (let i = 0; i < 5600; i++) {
    const x = random() * size;
    const y = random() * size;
    const len = 0.8 + random() * 3.1;
    const angle = random() * Math.PI;
    const color = random() > 0.52
      ? `rgba(49, 83, 35, ${0.10 + random() * 0.13})`
      : `rgba(191, 190, 113, ${0.09 + random() * 0.12})`;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.45 + random() * 0.55;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len * 0.6);
    ctx.stroke();
  }

  // A few pebbles and dry leaf flecks help exposed patches read as soil.
  for (let i = 0; i < 360; i++) {
    const x = random() * size;
    const y = random() * size;
    const rx = 0.6 + random() * 2.0;
    const ry = rx * (0.45 + random() * 0.55);
    ctx.fillStyle = random() > 0.5
      ? 'rgba(76, 72, 61, 0.24)'
      : 'rgba(228, 210, 169, 0.30)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sparse tiny meadow flowers; kept subtle so the arena remains readable.
  for (let i = 0; i < 105; i++) {
    const x = random() * size;
    const y = random() * size;
    ctx.fillStyle = random() > 0.5
      ? 'rgba(255, 235, 176, 0.38)'
      : 'rgba(232, 224, 244, 0.26)';
    ctx.beginPath();
    ctx.arc(x, y, 0.6 + random() * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

const groundGeometry = new THREE.CircleGeometry(GROUND_RADIUS, 128);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x344b2b,
  map: createMeadowTexture(),
  roughness: 1.0,
  metalness: 0
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.position.z = -0.5;
ground.receiveShadow = true;
scene.add(ground);

// Sand beach ring — a sandy shore around the ground edge (840–900)
// that gives the island a natural beach look before the dark water beyond.
function createSandTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c9b184';
  ctx.fillRect(0, 0, size, size);

  // Deterministic fine sand grains and mineral flecks.
  let seed = 0x5ea51;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 12500; i++) {
    const x = random() * size, y = random() * size;
    const r = 0.3 + random() * 1.4;
    const warm = random() > 0.5;
    ctx.fillStyle = warm
      ? `rgba(111, 83, 48, ${0.035 + random() * 0.09})`
      : `rgba(255, 241, 204, ${0.05 + random() * 0.13})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * (1.1 + random()), r * 0.65, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Uneven dry patches and wind-swept sand streaks.
  for (let i = 0; i < 115; i++) {
    const x = random() * size, y = random() * size;
    const rx = 8 + random() * 38, ry = 2 + random() * 7;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((random() - 0.5) * 0.7);
    ctx.fillStyle = random() > 0.5 ? 'rgba(150, 119, 77, 0.11)' : 'rgba(255, 239, 198, 0.20)';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Tiny shell fragments and dark wet-sand specks.
  for (let i = 0; i < 230; i++) {
    const x = random() * size, y = random() * size;
    ctx.fillStyle = random() > 0.45 ? 'rgba(248, 235, 205, 0.58)' : 'rgba(93, 85, 66, 0.20)';
    ctx.beginPath();
    ctx.ellipse(x, y, 0.6 + random() * 1.5, 0.35 + random() * 0.75, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 2);
  texture.anisotropy = 4;
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

// Sea — layered island water with a soft coastal gradient and restrained surface detail.
function createSeaTexture() {
  const size = 768;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // The shore starts in clear turquoise and gradually deepens into ocean blue.
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.53);
  gradient.addColorStop(0, '#b0f0df');
  gradient.addColorStop(0.08, '#63d5ca');
  gradient.addColorStop(0.22, '#2baab8');
  gradient.addColorStop(0.43, '#167c9d');
  gradient.addColorStop(0.70, '#105574');
  gradient.addColorStop(1, '#092c49');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Fine, low-contrast curved streaks catch the light without looking like stripes.
  // Their subtle opacity keeps the water attractive even when the texture is minified.
  for (let i = 0; i < 96; i++) {
    const y = (i / 96) * size;
    const wave = 3 + (i % 5) * 1.4;
    ctx.beginPath();
    ctx.moveTo(-20, y);
    ctx.bezierCurveTo(size * 0.24, y - wave, size * 0.64, y + wave * 1.6, size + 20, y - wave * 0.4);
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(196,255,244,0.055)' : 'rgba(4,45,75,0.045)';
    ctx.lineWidth = i % 4 === 0 ? 2 : 1;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}
const seaGeometry = new THREE.RingGeometry(1000, 2000, 256, 24);
const seaMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff, map: createSeaTexture(), roughness: 0.34, metalness: 0.04,
  transparent: true, opacity: 0.97, depthWrite: false,
  side: THREE.DoubleSide
});
const seaDayTint = new THREE.Color(0xe8ffff);
const seaDuskTint = new THREE.Color(0xffc4a0);
const seaNightTint = new THREE.Color(0x7896c8);
const seaTint = new THREE.Color();
const sea = new THREE.Mesh(seaGeometry, seaMaterial);
sea.position.z = -2;
sea.receiveShadow = true;
scene.add(sea);

// Decorative ships remain well offshore and do not participate in collisions.
const seaShips = createSeaShips(scene);

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

// Bright scarlet and vermilion shore crabs, roaming along the beach.
const crabGroup = new THREE.Group();
const crabColors = [0xe53935, 0xc92724, 0xf04b32, 0xb91f24];
for (let i = 0; i < 18; i++) {
  const angle = Math.random() * Math.PI * 2;
  const radius = GROUND_RADIUS + 18 + Math.random() * 118;
  const crab = createCrabShape(crabColors[i % crabColors.length]);
  crab.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.15);
  crab.rotation.z = angle + Math.PI / 2;
  crab.scale.setScalar([1.8, 2.25, 2.7][i % 3]);
  crab.userData.anchorAngle = angle;
  crab.userData.anchorRadius = radius;
  crab.userData.phase = Math.random() * Math.PI * 2;
  crab.userData.speed = 0.24 + Math.random() * 0.16;
  crab.userData.roamSpan = 28 + Math.random() * 52;
  crab.userData.legs = crab.userData.legs || [];
  crabGroup.add(crab);
}
scene.add(crabGroup);

// Sparse coastal dune vegetation: sea-oat seed heads, beach grass and low
// salt-tolerant shrubs. Groups are scattered irregularly on the sand, leaving
// open beach lanes for the crabs and keeping the shoreline visually readable.
const beachPlants = new THREE.Group();
const duneGrassMat = [
  new THREE.MeshStandardMaterial({ color: 0x71864a, roughness: 0.96 }),
  new THREE.MeshStandardMaterial({ color: 0x9b9b5a, roughness: 0.98 }),
  new THREE.MeshStandardMaterial({ color: 0x526c3b, roughness: 0.96 })
];
const oatStemMat = new THREE.MeshStandardMaterial({ color: 0x9b8650, roughness: 0.95 });
const oatHeadMat = new THREE.MeshStandardMaterial({ color: 0xc5ad70, roughness: 0.94 });
const beachShrubMat = new THREE.MeshStandardMaterial({ color: 0x496d43, roughness: 0.98 });
for (let i = 0; i < 34; i++) {
  const angle = Math.random() * Math.PI * 2;
  const radius = GROUND_RADIUS + 42 + Math.random() * 94;
  const cluster = new THREE.Group();
  cluster.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.02);
  cluster.rotation.z = Math.random() * Math.PI * 2;
  const clumpScale = 0.7 + Math.random() * 0.85;
  cluster.scale.setScalar(clumpScale);

  const blades = 5 + Math.floor(Math.random() * 5);
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + Math.random() * 0.5;
    const h = 3.5 + Math.random() * 5.5;
    const blade = new THREE.Mesh(
      new THREE.SphereGeometry(1, 7, 5),
      duneGrassMat[Math.floor(Math.random() * duneGrassMat.length)]
    );
    blade.position.set(Math.cos(a) * (1.8 + Math.random() * 2.5), Math.sin(a) * (1.8 + Math.random() * 2.5), h * 0.38);
    blade.scale.set(0.42, 0.20, h * 0.62);
    blade.rotation.x = (Math.random() - 0.5) * 0.24;
    blade.rotation.y = Math.cos(a) * 0.22;
    blade.rotation.z = a;
    blade.castShadow = true;
    cluster.add(blade);
  }

  // A few taller sea oats with warm seed heads create a recognizable coastal silhouette.
  if (i % 2 === 0) {
    for (let s = 0; s < 2; s++) {
      const a = Math.random() * Math.PI * 2;
      const h = 7 + Math.random() * 4;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, h, 5), oatStemMat);
      stem.position.set(Math.cos(a) * 2, Math.sin(a) * 2, h / 2);
      stem.rotation.x = Math.PI / 2 - Math.cos(a) * 0.12;
      stem.rotation.y = Math.sin(a) * 0.12;
      cluster.add(stem);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.8, 7, 5), oatHeadMat);
      head.position.set(Math.cos(a) * (2 + h * 0.14), Math.sin(a) * (2 + h * 0.14), h + 0.4);
      head.scale.set(0.52, 0.52, 1.25);
      cluster.add(head);
    }
  }
  if (i % 4 === 0) {
    const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6 + Math.random() * 1.5, 1), beachShrubMat);
    shrub.position.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, 1.2);
    shrub.scale.set(1.2, 0.9, 0.65);
    shrub.castShadow = true;
    cluster.add(shrub);
  }
  beachPlants.add(cluster);
}
scene.add(beachPlants);

// Coconut palms on the outer beach: curved ringed trunks, clustered coconuts,
// and feather-like fronds made from opaque solid-color geometry. These are
// deliberately placed near the outer sand so they frame the shore without
// filling the crab walking lanes.
const palmGroup = new THREE.Group();
const palmBarkMat = new THREE.MeshStandardMaterial({
  color: 0x765036, roughness: 0.96, metalness: 0, transparent: false, opacity: 1
});
const palmRingMat = new THREE.MeshStandardMaterial({
  color: 0xb18a5a, roughness: 0.95, metalness: 0, transparent: false, opacity: 1
});
const coconutMats = [
  new THREE.MeshStandardMaterial({ color: 0x4b5a2b, roughness: 0.88, transparent: false, opacity: 1 }),
  new THREE.MeshStandardMaterial({ color: 0x72502c, roughness: 0.92, transparent: false, opacity: 1 })
];
const palmFrondMats = [
  new THREE.MeshStandardMaterial({ color: 0x285d35, roughness: 0.9, side: THREE.DoubleSide, transparent: false, opacity: 1 }),
  new THREE.MeshStandardMaterial({ color: 0x397943, roughness: 0.9, side: THREE.DoubleSide, transparent: false, opacity: 1 }),
  new THREE.MeshStandardMaterial({ color: 0x568747, roughness: 0.92, side: THREE.DoubleSide, transparent: false, opacity: 1 })
];

function addPalmLeaflet(vertices, indices, a, b, c) {
  const base = vertices.length / 3;
  vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  indices.push(base, base + 1, base + 2, base + 2, base + 1, base);
}

function makeCoconutPalm() {
  const palm = new THREE.Group();
  const trunkHeight = 25 + Math.random() * 7;
  const bendAngle = Math.random() * Math.PI * 2;
  const bend = 1.5 + Math.random() * 2.8;
  const trunkPoints = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    trunkPoints.push(new THREE.Vector3(
      Math.cos(bendAngle) * bend * t * t,
      Math.sin(bendAngle) * bend * t * t,
      trunkHeight * t
    ));
  }

  // Tapered trunk sections follow a subtle natural curve.
  for (let i = 0; i < trunkPoints.length - 1; i++) {
    const start = trunkPoints[i];
    const end = trunkPoints[i + 1];
    const direction = end.clone().sub(start);
    const trunkSegment = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95 - i * 0.065, 1.2 - i * 0.075, direction.length(), 9, 1),
      palmBarkMat
    );
    trunkSegment.position.copy(start).add(end).multiplyScalar(0.5);
    trunkSegment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    trunkSegment.castShadow = true;
    trunkSegment.receiveShadow = true;
    palm.add(trunkSegment);

    // Subtle raised growth rings help the trunk read as fibrous palm wood.
    if (i > 0 && i < 6) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.86 - i * 0.055, 0.075, 5, 10), palmRingMat);
      ring.position.copy(start);
      ring.rotation.x = Math.PI / 2;
      ring.scale.set(1, 1, 0.85);
      palm.add(ring);
    }
  }

  const crown = trunkPoints[trunkPoints.length - 1].clone();
  const frondVertices = [];
  const frondIndices = [];
  const frondGroups = [[], [], []];
  const frondCount = 7 + Math.floor(Math.random() * 2);
  for (let f = 0; f < frondCount; f++) {
    const angle = (f / frondCount) * Math.PI * 2 + Math.random() * 0.28;
    const length = 14 + Math.random() * 7;
    const droop = 5.5 + Math.random() * 4.5;
    const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
    const side = new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0);
    const spinePoints = [];
    for (let s = 0; s <= 4; s++) {
      const t = s / 4;
      spinePoints.push(new THREE.Vector3(
        crown.x + direction.x * length * t,
        crown.y + direction.y * length * t,
        crown.z + 2.5 * t - droop * t * t
      ));
    }
    for (let s = 0; s < spinePoints.length - 1; s++) {
      const a = spinePoints[s], b = spinePoints[s + 1];
      const delta = b.clone().sub(a);
      const rachis = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13 * (1 - s * 0.12), 0.25 * (1 - s * 0.12), delta.length(), 5),
        palmRingMat
      );
      rachis.position.copy(a).add(b).multiplyScalar(0.5);
      rachis.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
      palm.add(rachis);
    }

    const matIndex = f % palmFrondMats.length;
    for (let k = 1; k <= 9; k++) {
      const t = 0.12 + k * 0.078;
      const spine = new THREE.Vector3(
        crown.x + direction.x * length * t,
        crown.y + direction.y * length * t,
        crown.z + 2.5 * t - droop * t * t
      );
      const leafletLength = (2.6 + Math.random() * 1.6) * (1 - t * 0.38);
      for (const sign of [-1, 1]) {
        const root = spine.clone();
        const outer = spine.clone().addScaledVector(side, sign * leafletLength);
        outer.z -= 1.2 + t * 1.5;
        const tip = outer.clone().addScaledVector(direction, length * 0.065);
        tip.z -= 0.45;
        const center = root.clone().lerp(outer, 0.48);
        center.z += 0.28;
        const target = frondGroups[matIndex];
        addPalmLeaflet(target, frondIndices, root, center, tip);
        addPalmLeaflet(target, frondIndices, root, outer, center);
      }
    }
  }

  // Build each color family into one mesh to keep the extra palm detail light.
  for (let m = 0; m < frondGroups.length; m++) {
    const positions = [];
    const indices = [];
    const vertices = frondGroups[m];
    for (let i = 0; i < vertices.length; i += 9) {
      const base = positions.length / 3;
      positions.push(...vertices.slice(i, i + 9));
      indices.push(base, base + 1, base + 2, base + 2, base + 1, base);
    }
    if (positions.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const fronds = new THREE.Mesh(geometry, palmFrondMats[m]);
      fronds.castShadow = true;
      fronds.receiveShadow = true;
      palm.add(fronds);
    }
  }

  // A tight cluster of coconuts sits directly below the frond crown.
  const coconutCount = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < coconutCount; i++) {
    const a = (i / coconutCount) * Math.PI * 2;
    const coconut = new THREE.Mesh(
      new THREE.SphereGeometry(0.95 + Math.random() * 0.22, 9, 7),
      coconutMats[i % coconutMats.length]
    );
    coconut.position.set(
      crown.x + Math.cos(a) * 1.1,
      crown.y + Math.sin(a) * 1.1,
      crown.z - 1.1 + Math.random() * 0.5
    );
    coconut.scale.set(1, 0.9, 1.15);
    coconut.castShadow = true;
    palm.add(coconut);
  }

  return palm;
}

for (let i = 0; i < 9; i++) {
  const angle = (i / 9) * Math.PI * 2 + (Math.random() - 0.5) * 0.28;
  const radius = GROUND_RADIUS + 112 + Math.random() * 27;
  const palm = makeCoconutPalm();
  palm.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.02);
  palm.rotation.z = Math.random() * Math.PI * 2;
  palm.scale.setScalar(0.82 + Math.random() * 0.38);
  palmGroup.add(palm);
}
scene.add(palmGroup);

function createCrabShape(color) {
  const g = new THREE.Group();
  const shellColor = new THREE.Color(color || 0xe53935);
  const bodyMat = new THREE.MeshStandardMaterial({ color: shellColor, roughness: 0.48, metalness: 0.02, flatShading: false });
  const darkMat = new THREE.MeshStandardMaterial({ color: shellColor.clone().multiplyScalar(0.48), roughness: 0.68, metalness: 0.01 });
  const highlightMat = new THREE.MeshStandardMaterial({ color: shellColor.clone().lerp(new THREE.Color(0xffb09a), 0.42), roughness: 0.42 });
  // Body — wider, flatter oval with shell texture
  const bodyGeo = new THREE.SphereGeometry(1, 24, 16);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(1.22, 0.9, 0.34);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // Raised shell rim and a restrained highlight catch light like a hard carapace.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.83, 0.055, 6, 24), darkMat);
  rim.scale.set(1.2, 0.84, 0.35);
  rim.position.z = 0.12;
  g.add(rim);
  const shellHighlight = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), highlightMat);
  shellHighlight.position.set(-0.12, 0.02, 0.27);
  shellHighlight.scale.set(0.52, 0.24, 0.035);
  g.add(shellHighlight);
  // Shell ridge
  const ridgeGeo = new THREE.SphereGeometry(1, 18, 12);
  const ridge = new THREE.Mesh(ridgeGeo, darkMat);
  ridge.position.set(0, 0, 0.24);
  ridge.scale.set(0.72, 0.16, 0.055);
  g.add(ridge);
  // Claws — more detailed with segments
  const clawMat = new THREE.MeshStandardMaterial({ color: shellColor.clone().multiplyScalar(0.88), roughness: 0.45, metalness: 0.01 });
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
      leg.userData.baseZ = leg.position.z;
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

// Mobile browsers may suspend WebAudio after tab switching or screen lock.
// Resume from a real pointer gesture so music and frog/action sounds recover.
window.addEventListener('pointerdown', () => {
  audio.resume().then(() => {
    if (gameManager.isPlaying()) audio.startAmbient();
  }).catch(() => {});
}, { capture: true, passive: true });

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
  // The sea surrounds the island: bring in surf ambience smoothly only
  // when the frog approaches the shoreline, and fade it back out inland.
  if (audio.setShoreProximity) {
    audio.setShoreProximity(Math.hypot(player.group.position.x, player.group.position.y));
  }
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
      const baseRadius = gameManager.LEVEL_STATS[Math.min(lvl, 9)]?.attackRadius ?? gameManager.BASE_ATTACK_RADIUS;
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
      if (joystickDirection && input.enqueueDirection(joystickDirection)) {
        touch.markMoveQueued?.(joystickDirection);
      }
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
    const crest = Math.max(0, swell);
    // Smaller shoreline travel and eased opacity make the wash feel continuous,
    // rather than making bright foam jump visibly across the beach.
    const easedCrest = crest * crest * (3 - 2 * crest);
    const radius = 1012 + swell * 22;
    const driftAngle = d.angle + Math.sin(time * 0.22 + d.phase) * 0.012;
    foam.position.set(Math.cos(driftAngle) * radius, Math.sin(driftAngle) * radius, -0.10 + easedCrest * 0.08);
    foam.rotation.z = driftAngle + Math.PI / 2;
    foam.material.opacity = 0.08 + easedCrest * 0.25;
    foam.scale.x = 8 + easedCrest * 5;
  }
  for (const crab of crabGroup.children) {
    const d = crab.userData;
    const t = time * d.speed + d.phase;
    // Crabs scuttle back and forth along a short shoreline arc, keeping a
    // stable beach radius while their body faces the direction of travel.
    const roamOffset = Math.sin(t) * d.roamSpan;
    const roamAngle = d.anchorAngle + roamOffset / d.anchorRadius;
    const movingForward = Math.cos(t) >= 0;
    crab.position.x = Math.cos(roamAngle) * d.anchorRadius;
    crab.position.y = Math.sin(roamAngle) * d.anchorRadius;
    crab.rotation.z = roamAngle + (movingForward ? Math.PI / 2 : -Math.PI / 2);
    crab.position.z = 0.15 + Math.abs(Math.sin(t * 9)) * 0.045;
    crab.position.x += Math.cos(roamAngle) * Math.sin(t * 5) * 0.8;
    crab.position.y += Math.sin(roamAngle) * Math.sin(t * 5) * 0.8;
    for (const leg of d.legs || []) {
      const stride = Math.sin(t * 12 + leg.userData.phase);
      leg.rotation.z = leg.userData.baseRotation + stride * 0.32;
      leg.position.z = leg.userData.baseZ + Math.max(0, stride) * 0.055;
    }
    for (const claw of d.claws || []) {
      claw.rotation.z = Math.sin(t * 3.4 + claw.userData.side) * 0.14;
    }
  }
  // Blend ocean color continuously with the same day/dusk/night state as the sky.
  // The tint is intentionally restrained so the shore-to-deep-water gradient remains visible.
  seaTint.copy(seaNightTint).lerp(seaDayTint, environmentState?.dayFactor ?? 0.5);
  seaTint.lerp(seaDuskTint, Math.min(0.55, (environmentState?.duskFactor ?? 0) * 0.42));
  seaMaterial.color.copy(seaTint);

  const pos = seaGeometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ox = seaPositions[i * 3];
    const oy = seaPositions[i * 3 + 1];
    const dist = Math.sqrt(ox * ox + oy * oy);
    const angle = Math.atan2(oy, ox);
    // Three low-amplitude, different-frequency layers create broad rolling motion
    // without lifting the ocean into the beach or causing a visibly jagged surface.
    const wave = Math.sin(dist * 0.008 - time * 0.72) * 2.8
               + Math.sin(dist * 0.004 + time * 0.46 + angle * 1.5) * 1.7
               + Math.sin(dist * 0.015 - time * 1.05 + angle * 3) * 0.65;
    pos.setZ(i, wave);
  }
  pos.needsUpdate = true;
  seaGeometry.computeVertexNormals();
  // Ships use the same wave field as the ocean mesh so their hulls rise and fall with the swell.
  seaShips.update(delta, time);

  // Sea ripple rings — expanding from shore inward
  for (const ripple of seaRipples) {
    const phase = (time * ripple.userData.speed + ripple.userData.phase) % 3;
    const t = phase / 3;
    // Move from shore (1000) outward into sea
    const dist = 1000 + t * 600;
    ripple.position.x = Math.cos(ripple.userData.angle) * dist;
    ripple.position.y = Math.sin(ripple.userData.angle) * dist;
    ripple.scale.setScalar(1 + t * 30);
    const fadeIn = Math.min(1, t * 4);
    const fadeOut = (1 - t) * (1 - t);
    ripple.material.opacity = 0.22 * fadeIn * fadeOut;
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