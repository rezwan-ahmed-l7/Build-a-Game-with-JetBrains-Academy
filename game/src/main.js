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
scene.fog = new THREE.Fog(0x263c49, 560, 1900);

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
  // A restrained, softly mottled meadow: large quiet patches, almost no speckling.
  for (let i = 0; i < 70; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 18 + random() * 48;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const tint = random() > 0.5
      ? 'rgba(190, 192, 126, 0.11)'
      : 'rgba(45, 83, 45, 0.085)';
    gradient.addColorStop(0, tint);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // A few subtle grass strokes add texture without making the floor look noisy.
  for (let i = 0; i < 4200; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 0.45 + random() * 0.8;
    ctx.fillStyle = random() > 0.5
      ? 'rgba(72, 112, 48, 0.075)'
      : 'rgba(180, 198, 126, 0.065)';
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.4, radius * 0.65, random() * Math.PI, 0, Math.PI * 2);
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

const groundGeometry = new THREE.CircleGeometry(2200, 128);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x344b2b, map: createMeadowTexture(), roughness: 1.0, metalness: 0
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.position.z = -0.5;
ground.receiveShadow = true;
scene.add(ground);

// Keep the ground edge beyond the fogged playable world, with a restrained
// dark falloff so the map has a believable boundary rather than an enormous plane.
const vignetteGeometry = new THREE.RingGeometry(2100, 2200, 128);
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
  (targetPos) => canPlayerMoveTo(targetPos, enemyManager.getEnemies(), obstacles.getObstacles())
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
// the button; keyboard users can still press Space (the existing
// keydown handler in main.js also calls gameManager.resetGame()).
score.setOnRestart(() => gameManager.resetGame());

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

// ----- Global keybinds -----
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (gameManager.isPlaying()) {
      attack.attack(performance.now());
    }
  } else if (e.code === 'Enter') {
    e.preventDefault();
    if (gameManager.isMenu()) {
      gameManager.startGame();
      return;
    }
    if (gameManager.isGameOver()) {
      gameManager.resetGame();
      return;
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

  if (gameManager.currentState() === GameState.PLAYING) {
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
    resolvePlayerVsObstacles(player.group.position, obstacleList);

    combo.update(delta);
    gameManager.tickComboHud();

    powerUps.update(delta, currentTime / 1000, gameManager.onPowerUpPickup, gameManager.getMagnetRemaining() > 0);
    score.tick(delta);
    score.render();
  } else if (gameManager.currentState() === GameState.PAUSED) {
    // Nothing simulates; only visual systems run
  } else if (gameManager.currentState() === GameState.GAMEOVER) {
    // Player.update still runs (idle continues at game-over) for the body
  }

  // Environment always runs (day/night keeps cycling through pause/over)
  const environmentState = environment.update(delta);
  menus.setEnvironmentMode(environmentState.label, environment.getMode());

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