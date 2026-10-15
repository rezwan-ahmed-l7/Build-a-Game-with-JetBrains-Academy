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
import { createScreenShake } from './components/ScreenShake.js';
import { isTouchDevice } from './utils/dom.js';

const PLAYER_VS_ENEMY_DIST = PLAYER_COLLISION_RADIUS + ENEMY_COLLISION_RADIUS;

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

// Ground
const groundGeometry = new THREE.CircleGeometry(1200, 64);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x344b2b, roughness: 1.0, metalness: 0
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.position.z = -0.5;
ground.receiveShadow = true;
scene.add(ground);

const vignetteGeometry = new THREE.RingGeometry(800, 1200, 64);
const vignetteMaterial = new THREE.MeshBasicMaterial({
  color: 0x05080d, side: THREE.DoubleSide,
  transparent: true, opacity: 0.85
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
// Camera
const camera = createCamera();
scene.add(camera);

const canvas = document.querySelector('canvas.game');
const cameraFollow = createCameraFollow(camera, player.group, canvas);
// Input + Movement
const input = createInput();
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

// ----- Attack (with hooks) -----
const attack = createAttack(scene, player.group, enemyManager, {
  onHit(enemy, pos) {
    damageNumbers.spawn('1', pos.x, pos.y, pos.z + 8, '#ffdd66');
  },
  onKill(enemy, pos) {
    combo.register();
    const mul = combo.getMultiplier();
    score.addKillBonus(mul);
    score.setCombo(combo.getCount(), combo.getTimeLeft());
    audio.playHit();
    if (combo.getCount() >= 3) audio.playPowerUp();
    screenShake.kick(1.5 + mul * 0.6);
    particles.spawnBurst(pos.x, pos.y, pos.z + 6, {
      count: 18, color: 0xff5577, speed: 90, life: 0.6, size: 7
    });
  },
  onShake(amount) {
    screenShake.kick(amount);
    audio.playAttack();
  },
  onParticles(kind, x, y, z, color) {
    if (kind === 'sparks') {
      particles.spawnBurst(x, y, z, { count: 12, color, speed: 60, life: 0.4, size: 5 });
    } else if (kind === 'death') {
      particles.spawnBurst(x, y, z, { count: 22, color, speed: 100, life: 0.7, size: 8 });
    }
  }
});

// ----- Game state -----
let currentState = GameState.MENU;

// Damage flash element
const damageFlash = document.createElement('div');
damageFlash.className = 'damage-flash';
document.body.appendChild(damageFlash);

let flashTimer = 0;
function flashDamage() {
  damageFlash.classList.add('active');
  flashTimer = 0.2;
  setTimeout(() => damageFlash.classList.remove('active'), 200);
}

// ----- Health / damage flow -----
health.onChange((event, payload) => {
  if (event === 'damage') {
    player.flash();
    audio.playHurt();
    flashDamage();
    screenShake.kick(2.5);
  } else if (event === 'heal') {
    audio.playPickup();
    particles.spawnBurst(player.group.position.x, player.group.position.y, player.group.position.z + 8, {
      count: 16, color: 0xff7799, speed: 70, life: 0.6, size: 6
    });
  } else if (event === 'death') {
    triggerGameOver();
  } else if (event === 'reset') {
    damageFlash.classList.remove('active');
  }
  score.setHearts(payload.hp, payload.max);
});

// ----- Score: combo HUD mirror -----
function tickComboHud() {
  score.setCombo(combo.getCount(), combo.getTimeLeft());
}

// ----- Power-up pickup handler -----
const ATTACK_BOOST_DURATION = 10;   // seconds the long-attack power-up lasts
const ATTACK_BOOST_MULT = 1.85;     // 85% bigger radius
let attackBoostRemaining = 0;
// The "real" base radius the attack system resets to when the boost ends.
// We capture it once at startup, but every frame the Difficulty system
// updates the radius — we re-derive it from `attack.radius / currentBoost`
// so the boost never desyncs from difficulty changes.
function getBoostedAttackRadius() {
  // Difficulty drives attack.setRadius(d.attackRadius) each frame from the
  // main loop. Our boost scales on top of whatever that value is.
  return attack.radius * ATTACK_BOOST_MULT;
}

function onPowerUpPickup(type, pos) {
  audio.playPickup();
  if (type === 'heal') {
    health.heal(1);
    damageNumbers.spawn('+1 HP', pos.x, pos.y, pos.z + 6, '#ff7799');
  } else if (type === 'score') {
    score.addKillBonus(8);
    damageNumbers.spawn('x2 BONUS', pos.x, pos.y, pos.z + 6, '#ffd166');
    particles.spawnBurst(pos.x, pos.y, pos.z, { count: 24, color: 0xffd166, speed: 90, life: 0.7, size: 7 });
  } else if (type === 'speed') {
    // Visual feedback only — there's no movement speed scaling wired in,
    // but the power-up still rewards the player with bonus score and a
    // visual cue so the type stays useful.
    score.addKillBonus(2);
    damageNumbers.spawn('SPEED!', pos.x, pos.y, pos.z + 6, '#4cc9f0');
    particles.spawnBurst(pos.x, pos.y, pos.z, { count: 22, color: 0x4cc9f0, speed: 80, life: 0.7, size: 6 });
  } else if (type === 'attack') {
    // Boost the attack radius for ATTACK_BOOST_DURATION seconds.
    attackBoostRemaining = ATTACK_BOOST_DURATION;
    attack.setRadius(getBoostedAttackRadius());
    score.addKillBonus(4);
    damageNumbers.spawn('LONG ATTACK!', pos.x, pos.y, pos.z + 6, '#9ee7ff');
    particles.spawnBurst(pos.x, pos.y, pos.z, { count: 28, color: 0x9ee7ff, speed: 100, life: 0.8, size: 7 });
  }
}

// ----- Game state transitions -----
function triggerGameOver() {
  if (currentState === GameState.GAMEOVER) return;
  currentState = GameState.GAMEOVER;
  player.group.visible = false;
  audio.stopAmbient();
  audio.playGameOver();
  score.showGameOver();
}

function resetGame() {
  input.clear();
  player.group.position.set(0, 0, 0);
  movement.reset();
  player.group.visible = true;
  health.reset();
  combo.reset();
  enemyManager.removeAll();
  powerUps.removeAll();
  dash.reset();
  score.reset();
  score.setHearts(3, 3);
  attackBoostRemaining = 0;
  currentState = GameState.PLAYING;
  score.hideGameOver();
}

function startGame() {
  // Order matters: resume the AudioContext first (user gesture triggered
  // by the Play button) so the oscillators we build a moment later can
  // actually produce sound.
  audio.resume().then(() => {
    audio.startAmbient();
  }).catch(() => {
    audio.startAmbient();
  });
  resetGame();
  menus.hideStart();
  menus.showHud(true);
}

function togglePause() {
  if (currentState === GameState.PLAYING) {
    currentState = GameState.PAUSED;
    menus.showPause();
  } else if (currentState === GameState.PAUSED) {
    currentState = GameState.PLAYING;
    menus.hidePause();
  }
}

// ----- Menus -----
const menus = createMenus({
  onStart: startGame,
  onResume: () => {
    if (currentState === GameState.PAUSED) togglePause();
  },
  onTogglePause: () => {
    if (currentState === GameState.PLAYING || currentState === GameState.PAUSED) {
      togglePause();
    }
  },
  onRestart: () => {
    menus.hidePause();
    resetGame();
  },
  onToggleMute: () => {
    audio.setMuted(!audio.isMuted());
  },
  onCycleMode: () => environment.cycleMode(),
  isMuted: () => audio.isMuted()
});
menus.showStart();
menus.showHud(false); // hidden until start

// Audio ambient brightness follows day/night
environment.onUpdate((dayFactor) => {
  audio.setAmbientNightness(1 - dayFactor);
});

// ----- Touch controls (mount only on touch devices) -----
let touch = null;
if (isTouchDevice()) {
  touch = createTouchControls({
    onPause: togglePause,
    onAttack: () => {
      if (currentState === GameState.PLAYING) attack.attack(performance.now());
    },
    onDash: () => {
      if (currentState === GameState.PLAYING) dash.tryStart();
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
    if (currentState === GameState.MENU) {
      startGame();
      return;
    }
    if (currentState === GameState.GAMEOVER) {
      resetGame();
      return;
    }
    if (currentState === GameState.PLAYING) {
      attack.attack(performance.now());
    }
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (currentState === GameState.PLAYING || currentState === GameState.PAUSED) {
      togglePause();
    }
  } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    if (currentState === GameState.PLAYING) {
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

// ----- Player-enemy contact (replaces the old collision game-over check) -----
function checkPlayerEnemyContact() {
  if (health.isInvulnerable() || dash.isInvulnerable()) return false;
  const enemies = enemyManager.getEnemies();
  for (const enemy of enemies) {
    if (enemy.isSpawning || enemy.isDying) continue;
    const dx = player.group.position.x - enemy.group.position.x;
    const dy = player.group.position.y - enemy.group.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < PLAYER_VS_ENEMY_DIST) {
      health.damage(1);
      // Push the player back a bit
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);
      player.group.position.x += nx * 18;
      player.group.position.y += ny * 18;
      return true;
    }
  }
  return false;
}

// Development-only debug hooks support browser QA without exposing the
// full game object on production builds.
if (import.meta.env.DEV) {
  window.__game = {
    scene, player, enemyManager, obstacles, health, score,
    input, movement, dash, attack,
    currentState: () => currentState
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
  // Dash movement must stop with gameplay when paused or game over. Its
  // wall-clock duration still expires naturally, so resuming cannot continue
  // a dash that was interrupted by the pause.
  if (currentState === GameState.PLAYING) dash.update(delta);
  audio.update && audio.update(delta);
  if (flashTimer > 0) {
    flashTimer = Math.max(0, flashTimer - delta);
  }

  if (currentState === GameState.PLAYING) {
    if (checkPlayerEnemyContact()) {
      // damage handled inside health onChange
    }
    difficulty.setScore(score.getScore());
    const d = difficulty.get();
    enemyManager.setSpawnInterval(d.spawnInterval);
    enemyManager.setSpeedMultiplier(d.enemySpeed / 16);
    enemyManager.setDifficulty(d.difficulty);
    attack.setCooldown(d.attackCooldown);
    attack.setRadius(d.attackRadius);

    // Long-attack boost: tick down the timer and re-apply the boosted
    // radius AFTER the difficulty set so it never desyncs.
    if (attackBoostRemaining > 0) {
      attackBoostRemaining = Math.max(0, attackBoostRemaining - delta);
      if (attackBoostRemaining > 0) {
        attack.setRadius(getBoostedAttackRadius());
      }
    }

    movement.update(effectiveDelta);
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
    tickComboHud();

    powerUps.update(delta, currentTime / 1000, onPowerUpPickup);
    score.tick(delta);
    score.render();
  } else if (currentState === GameState.PAUSED) {
    // Nothing simulates; only visual systems run
  } else if (currentState === GameState.GAMEOVER) {
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
  setTimeout(() => startGame(), 200);
}

// ----- Boot -----
animate(previousTime);
