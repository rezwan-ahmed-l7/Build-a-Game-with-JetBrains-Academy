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

const PLAYER_VS_ENEMY_DIST = PLAYER_COLLISION_RADIUS + ENEMY_COLLISION_RADIUS;
import { createAttack } from './components/Attack.js';
import { createScore, GameState } from './components/Score.js';
import { createDifficulty } from './components/Difficulty.js';
import { createObstacles } from './components/Obstacles.js';
import { createEnvironment } from './components/Environment.js';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071024);
scene.fog = new THREE.Fog(0x101b38, 600, 2800);

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

// A visible target keeps the directional light's shadow camera stable.
const lightTarget = new THREE.Object3D();
scene.add(lightTarget);
directionalLight.target = lightTarget;

// Ground — forest floor with a soft radial gradient
const groundGeometry = new THREE.CircleGeometry(1200, 64);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x344b2b,
  roughness: 1.0,
  metalness: 0
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
// The world uses Z-up, so CircleGeometry already lies on the ground plane.
ground.position.z = -0.5;
ground.receiveShadow = true;
scene.add(ground);

// A second darker ring under the ground for vignette effect
const vignetteGeometry = new THREE.RingGeometry(800, 1200, 64);
const vignetteMaterial = new THREE.MeshBasicMaterial({
  color: 0x05080d,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.85
});
const vignette = new THREE.Mesh(vignetteGeometry, vignetteMaterial);
vignette.position.z = -0.3;
scene.add(vignette);

// Player
const player = createPlayer();
scene.add(player.group);

const environment = createEnvironment(scene, {
  ambientLight,
  directionalLight,
  fillLight,
  rimLight
}, groundMaterial, player.group);

const STARTING_POSITION = { x: 0, y: 0, z: 0 };

// Camera
const camera = createCamera();
scene.add(camera);

const canvas = document.querySelector('canvas.game');
const cameraFollow = createCameraFollow(camera, player.group);

const input = createInput();
const movement = createMovement(
  player.group,
  player.getModel,
  input,
  camera,
  (targetPos) => canPlayerMoveTo(targetPos, enemyManager.getEnemies(), obstacles.getObstacles())
);

const enemyManager = createEnemyManager(scene, player.group);

// Obstacles (trees + rocks) — must exist before movement/collision callbacks
const obstacles = createObstacles(scene);

const score = createScore();
const difficulty = createDifficulty();

// Compact HUD for the environment mode and basic controls.
const environmentHud = document.createElement('div');
environmentHud.className = 'environment-hud';
environmentHud.innerHTML = '<span class="environment-mode">AUTO CYCLE</span><button type="button" class="cycle-button">Cycle: Auto / Day / Night</button><span class="controls-hint">WASD / Arrows: Move · Space: Attack / Restart</span>';
document.body.appendChild(environmentHud);
const environmentModeEl = environmentHud.querySelector('.environment-mode');
const cycleButton = environmentHud.querySelector('.cycle-button');
cycleButton.addEventListener('click', () => {
  environment.cycleMode();
});

const attack = createAttack(scene, player.group, enemyManager, (killCount) => {
  // Award score per kill; bump the score chip for visual feedback
  for (let i = 0; i < killCount; i++) score.addKillBonus();
  const scoreEl = document.querySelector('.score');
  if (scoreEl) {
    scoreEl.classList.remove('bump');
    // Force reflow so the animation re-triggers
    void scoreEl.offsetWidth;
    scoreEl.classList.add('bump');
    setTimeout(() => scoreEl.classList.remove('bump'), 200);
  }
});

// Game state — controls whether movement/enemies/attack are active
let currentState = GameState.PLAYING;

function checkPlayerEnemyCollision() {
  const enemies = enemyManager.getEnemies();
  for (const enemy of enemies) {
    if (enemy.isSpawning || enemy.isDying) continue;
    const dx = player.group.position.x - enemy.group.position.x;
    const dy = player.group.position.y - enemy.group.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < PLAYER_VS_ENEMY_DIST) return true;
  }
  return false;
}

function triggerGameOver() {
  if (currentState === GameState.GAMEOVER) return;
  currentState = GameState.GAMEOVER;
  player.group.visible = false;
  score.showGameOver();
}

function resetGame() {
  // Clear queued input and reset in-flight movement/animation before restarting.
  input.clear();
  player.group.position.set(STARTING_POSITION.x, STARTING_POSITION.y, STARTING_POSITION.z);
  movement.reset();
  player.group.visible = true;
  // Clear all enemies
  enemyManager.removeAll();
  // Reset score
  score.reset();
  // Re-enable state
  currentState = GameState.PLAYING;
  score.hideGameOver();
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (currentState === GameState.GAMEOVER) {
      resetGame();
    } else {
      attack.attack(performance.now());
    }
  }
});

const renderer = createRenderer(canvas);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

let previousTime = performance.now();
function animate(currentTime) {
  requestAnimationFrame(animate);

  const delta = Math.min((currentTime - previousTime) / 1000, 0.1);
  previousTime = currentTime;

  // Hitstop on attacks; visual effects use raw delta so they never freeze
  const effectiveDelta = attack.getHitStopDelta(delta);

  // Game Over check has higher priority than normal collision resolution
  if (currentState === GameState.PLAYING) {
    if (checkPlayerEnemyCollision()) {
      triggerGameOver();
    }
  }

  // Movement + simulation only when playing
  if (currentState === GameState.PLAYING) {
    // Recalculate difficulty from current score, then apply to systems
    difficulty.setScore(score.getScore());
    const d = difficulty.get();
    enemyManager.setSpawnInterval(d.spawnInterval);
    // Map raw enemy speed (~16 at difficulty=1) to a multiplier that scales
    // every spawned enemy's per-instance base speed.
    enemyManager.setSpeedMultiplier(d.enemySpeed / 16);
    attack.setCooldown(d.attackCooldown);
    attack.setRadius(d.attackRadius);

    movement.update(effectiveDelta);
    movement.applySquashStretch();
    player.setMoving(movement.isCurrentlyMoving());

    enemyManager.update(effectiveDelta, currentTime / 1000);

    const enemies = enemyManager.getEnemies();
    const obstacleList = obstacles.getObstacles();
    resolveEnemyVsEnemy(enemies);
    resolveEnemyVsObstacles(enemies, obstacleList);
    resolveEnemyVsPlayer(enemies, player.group.position);
    resolvePlayerVsObstacles(player.group.position, obstacleList);

    score.tick(delta);
  }

  // Day/night keeps changing while the game is paused at game-over.
  const environmentState = environment.update(delta);
  environmentModeEl.textContent = environmentState.label;

  // Player visual update always runs (idle breathing continues during game over)
  player.update(delta);
  score.render();
  attack.updateVisual(delta);

  // Anchor directional light to player
  lightTarget.position.copy(player.group.position);
  lightTarget.position.z = 0;
  directionalLight.position.set(
    player.group.position.x - 140,
    player.group.position.y - 160,
    280
  );

  cameraFollow.update(delta);
  renderer.render(scene, camera);
}
animate(previousTime);
