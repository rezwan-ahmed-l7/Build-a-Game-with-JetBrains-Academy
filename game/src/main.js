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
import { createScore } from './components/Score.js';
import { createDifficulty } from './components/Difficulty.js';
import { createObstacles } from './components/Obstacles.js';
import { createEnvironment } from './components/Environment.js';

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
scene.fog = new THREE.Fog(0x101b38, 600, 2800);

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
    exponent: { value: 0.6 }
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
      gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
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
  // Soft, broad color patches create visible meadow variation at gameplay distance.
  for (let i = 0; i < 190; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 6 + random() * 18;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const warm = random() > 0.5;
    gradient.addColorStop(0, warm
      ? `rgba(177, 190, 105, ${0.035 + random() * 0.045})`
      : `rgba(42, 88, 43, ${0.04 + random() * 0.05})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  for (let i = 0; i < 22000; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 0.55 + random() * 1.9;
    const shade = random();
    ctx.fillStyle = shade > 0.5
      ? `rgba(72, 112, 48, ${0.035 + random() * 0.07})`
      : `rgba(180, 198, 126, ${0.03 + random() * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.7, radius, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 18);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

const groundGeometry = new THREE.CircleGeometry(14000, 128);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x344b2b, map: createMeadowTexture(), roughness: 1.0, metalness: 0
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.position.z = -0.5;
ground.receiveShadow = true;
scene.add(ground);

// The dark edge falloff now starts well beyond the active arena, so the
// camera cannot reveal a distracting black wedge at the edge of the ground.
const vignetteGeometry = new THREE.RingGeometry(13500, 14000, 128);
const vignetteMaterial = new THREE.MeshBasicMaterial({
  color: 0x05080d, side: THREE.DoubleSide,
  transparent: true, opacity: 0.72, depthWrite: false
});
const vignette = new THREE.Mesh(vignetteGeometry, vignetteMaterial);
vignette.position.z = -0.3;
scene.add(vignette);

// Player
const player = createPlayer();
scene.add(player.group);
// Environment (depends on lights + player)
const environment = createEnvironment(scene, {
  ambientLight, directionalLight, fillLight, rimLight
}, groundMaterial, player.group);
// Camera — child of player group so it follows the player naturally
const camera = createCamera();
player.group.add(camera);

const canvas = document.querySelector('canvas.game');
const cameraFollow = createCameraFollow(camera, player.group, canvas);
// Input + Movement
const input = createInput();
input.setEnabled(false); // menu accepts menu shortcuts, not queued movement
const obstacles = createObstacles(scene);  // create BEFORE movement
const enemyManager = createEnemyManager(scene, player.group);
const movement = createMovement(
  player.group, player.getModel, input, camera,
  (targetPos) => canPlayerMoveTo(targetPos, enemyManager.getEnemies(), obstacles.getObstacles())
);
// Score / Health / Combo / Difficulty
const score = createScore();
const health = createHealth(3);
const combo = createCombo();
const difficulty = createDifficulty();
score.setHearts(health.getHp(), health.getMax());

// Particles, damage numbers, screen shake
const particles = createParticles(scene);
const damageNumbers = createDamageNumbers(scene);
const screenShake = createScreenShake();

// Audio
const audio = createAudio();

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
      if (gameManager.isPlaying()) dash.tryStart();
    }
  });
}

// Attach click-to-move on the canvas for non-touch
input.attachClickToMove(canvas, () => movement.getCameraBasis());

// Environment HUD (mode label + cycle button) — recreated here because the
// original pehele-theke JS-created version was replaced.
const environmentHud = document.createElement('div');
environmentHud.className = 'environment-hud';
environmentHud.innerHTML = '<span class="environment-mode">AUTO CYCLE</span><button type="button" class="cycle-button">Cycle: Auto / Day / Night</button><span class="controls-hint">WASD / Arrows: Move · Space: Attack / Restart</span>';
document.body.appendChild(environmentHud);
const environmentModeEl = environmentHud.querySelector('.environment-mode');
const cycleButton = environmentHud.querySelector('.cycle-button');
if (cycleButton) cycleButton.addEventListener('click', () => environment.cycleMode());

// ----- Global keybinds -----
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (gameManager.isMenu()) {
      gameManager.startGame();
      return;
    }
    if (gameManager.isGameOver()) {
      gameManager.resetGame();
      return;
    }
    if (gameManager.isPlaying()) {
      attack.attack(performance.now());
    }
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (gameManager.isPlaying() || gameManager.isPaused()) {
      gameManager.togglePause();
    }
  } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
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
    input, movement, dash, attack,
    onPowerUpPickup: gameManager.onPowerUpPickup,
    currentState: gameManager.currentState
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

  if (gameManager.currentState() === GameState.PLAYING) {
    if (gameManager.checkPlayerEnemyContact(PLAYER_VS_ENEMY_DIST)) {
      // damage handled inside health onChange
    }
    difficulty.setScore(score.getScore());
    const d = difficulty.get();
    enemyManager.setSpawnInterval(d.spawnInterval);
    enemyManager.setSpeedMultiplier(d.enemySpeed / 16);
    enemyManager.setDifficulty(d.difficulty);
    attack.setCooldown(d.attackCooldown);
    attack.setRadius(d.attackRadius);

    if (gameManager.getSpeedBoostRemaining() > 0) {
      gameManager.setSpeedBoostTimer(Math.max(0, gameManager.getSpeedBoostRemaining() - delta));
      movement.setSpeedMultiplier(gameManager.getSpeedBoostRemaining() > 0 ? gameManager.SPEED_BOOST_MULT : 1);
    }

    // Long-attack boost: tick down the timer and re-apply the boosted
    // radius AFTER the difficulty set so it never desyncs.
    if (gameManager.getAttackBoostRemaining() > 0) {
      gameManager.setAttackBoostTimer(Math.max(0, gameManager.getAttackBoostRemaining() - delta));
      if (gameManager.getAttackBoostRemaining() > 0) {
        attack.setRadius(gameManager.getBoostedAttackRadius());
      }
    }

    movement.update(effectiveDelta);
    // Apply dash after normal movement for this frame, while Movement's
    // translate() shifts the active interpolation anchors to preserve it.
    dash.update(delta);
    movement.applySquashStretch();
    player.setMoving(movement.isCurrentlyMoving());

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
    resolvePlayerVsObstacles(player.group.position, obstacleList);

    combo.update(delta);
    gameManager.tickComboHud();

    powerUps.update(delta, currentTime / 1000, gameManager.onPowerUpPickup);
    score.tick(delta);
    score.render();
  } else if (gameManager.currentState() === GameState.PAUSED) {
    // Nothing simulates; only visual systems run
  } else if (gameManager.currentState() === GameState.GAMEOVER) {
    // Player.update still runs (idle continues at game-over) for the body
  }

  // Environment always runs (day/night keeps cycling through pause/over)
  const environmentState = environment.update(delta);
  environmentModeEl.textContent = environmentState.label;

  // Sky dome follows the player so the gradient is always centered.
  sky.position.set(
    player.group.position.x,
    player.group.position.y,
    player.group.position.z
  );
  // Tint sky by day factor if the environment exposes one
  if (environmentState && typeof environmentState.skyTop === 'number') {
    skyMaterial.uniforms.topColor.value.setHSL(0.60, 0.65, environmentState.skyTop);
    skyMaterial.uniforms.bottomColor.value.setHSL(0.58, 0.55, environmentState.skyBottom);
  }

  // Pond animation (ripple expands, lily pads bob). Always runs.
  if (obstacles.updatePond) obstacles.updatePond(delta);

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
  cameraFollow.update(delta);
  const shake = screenShake.getIntensity();
  if (shake > 0) {
    const off = screenShake.update(delta, camera.position);
    camera.position.add(off);
  }
  renderer.render(scene, camera);
}

// Environment mode label DOM ref (already declared above)

// Debug: ?autoplay=1 jumps straight into the game (no menu).
// Useful for screenshot/headless testing.
if (new URLSearchParams(location.search).get('autoplay') === '1') {
  setTimeout(() => gameManager.startGame(), 200);
}

// ----- Boot -----
animate(previousTime);