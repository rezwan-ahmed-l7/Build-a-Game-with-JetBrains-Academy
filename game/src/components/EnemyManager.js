import { createEnemy } from './Enemy.js';
import { lerpAngle } from '../utils/math.js';
import { easeOutBack } from '../utils/easings.js';
import { getEnemyWeights, ENEMY_TYPES } from './EnemyTypes.js';
import { pickWeighted } from '../utils/rng.js';

const SPAWN_INTERVAL = 2.2;
const MAX_ENEMIES = 20;
const ENEMY_SPEED = 18;
const SPAWN_RADIUS = 140;
const SPAWN_RANDOMIZE = 70;
const SPAWN_IN_DURATION = 0.3;
const HOVER_AMPLITUDE = 2.5;
const HOVER_BASE_Z = 4;
const TURN_SPEED = 6;
const DEATH_DURATION = 0.6;
const PLAYER_SAFE_RADIUS = 120;   // enemies don't spawn right on top of the player

// "Jhatka" / buzz parameters — make flying enemies look like they're
// hovering insects instead of smooth sliders. These are deliberately
// small per-frame perturbations; cumulative effect = buzzing.
const BUZZ_HORIZONTAL_AMP = 3.5;   // sideways sway amplitude (world units)
const BUZZ_VERTICAL_AMP   = 1.2;   // extra vertical bob on top of hover
const BUZZ_FREQ_FAST      = 8;     // primary buzz frequency (Hz-ish)
const BUZZ_FREQ_SLOW      = 3;     // secondary slower component
const TILT_BANK_MAX       = 0.45;  // how far they bank into turns (radians)

const spawnPoints = [
  { x: -SPAWN_RADIUS, y: 0 },
  { x: SPAWN_RADIUS, y: 0 },
  { x: 0, y: -SPAWN_RADIUS },
  { x: 0, y: SPAWN_RADIUS }
];

export function createEnemyManager(scene, playerGroup, audio = null) {
  const enemies = [];
  let spawnTimer = 0;
  let elapsed = 0;
  let difficultyLevel = 1;
  // Difficulty-controlled parameters, set externally each frame
  let dynamicSpawnInterval = SPAWN_INTERVAL;
  let dynamicSpeedMultiplier = 1;
  // Avoid rapid-fire spawn SFX when several enemies spawn back-to-back in
  // the same tick. Throttle to one wing-buzz every SPAWN_SOUND_MIN_GAP.
  let lastSpawnSound = -1;
  const SPAWN_SOUND_MIN_GAP = 0.18; // seconds

  function setSpawnInterval(value) {
    dynamicSpawnInterval = value;
  }

  function setSpeedMultiplier(value) {
    dynamicSpeedMultiplier = value;
  }

  function setDifficulty(d) {
    difficultyLevel = d;
  }

  function getSpawnInterval() {
    return dynamicSpawnInterval;
  }

  function maybePlaySpawnSound() {
    if (!audio || !audio.playEnemySpawn) return;
    if (elapsed - lastSpawnSound < SPAWN_SOUND_MIN_GAP) return;
    lastSpawnSound = elapsed;
    try { audio.playEnemySpawn(); } catch { /* ignore */ }
  }

  function spawnEnemy() {
    if (enemies.length >= MAX_ENEMIES) return;

    // Pick a type weighted by difficulty
    const weights = getEnemyWeights(difficultyLevel);
    const type = pickWeighted(Math.random, weights);
    const enemy = createEnemy(type);
    const group = enemy.group;

    // Try a few candidate positions to keep enemies away from the player
    let x = 0, y = 0;
    for (let attempt = 0; attempt < 5; attempt++) {
      const point = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
      x = point.x + (Math.random() - 0.5) * SPAWN_RANDOMIZE;
      y = point.y + (Math.random() - 0.5) * SPAWN_RANDOMIZE;
      const dx = x - playerGroup.position.x;
      const dy = y - playerGroup.position.y;
      if (Math.sqrt(dx * dx + dy * dy) >= PLAYER_SAFE_RADIUS) break;
    }
    group.position.x = x;
    group.position.y = y;
    group.position.z = 0;

    const def = ENEMY_TYPES[type];
    enemies.push({
      group,
      yawGroup: enemy.yawGroup,
      enemyRef: enemy,
      type,
      def,
      hp: def.hp,
      baseSpeed: ENEMY_SPEED * def.speedMul * (0.85 + Math.random() * 0.3),
      hoverPhase: Math.random() * Math.PI * 2,
      hoverSpeed: 2.2 + Math.random() * 1.4,
      // Per-instance buzz offsets so the swarm doesn't sync up
      buzzPhaseA: Math.random() * Math.PI * 2,
      buzzPhaseB: Math.random() * Math.PI * 2,
      buzzPhaseC: Math.random() * Math.PI * 2,
      currentYaw: Math.random() * Math.PI * 2,
      // Smoothed banking for visual "lean into turn"
      bankAngle: 0,
      // The position we WANT to be at (after chase) — buzz offsets are
      // added on top, so we still resolve collision against the un-jittered
      // desired position to keep movement rules clean.
      desiredX: x,
      desiredY: y,
      spawnProgress: 0,
      isSpawning: true,
      isDying: false,
      deathProgress: 0
    });
    scene.add(group);
    // Wing-buzz / drone SFX when a new bee spawns. The enemy itself will
    // be visible a beat later (model load) but the spawn pop is what the
    // player hears — a soft "bwzzzz" that telegraphs "incoming".
    maybePlaySpawnSound();
  }

  function update(delta, time) {
    elapsed += delta;

    spawnTimer += delta;
    if (spawnTimer >= getSpawnInterval()) {
      spawnTimer = 0;
      spawnEnemy();
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      const group = enemy.group;

      if (enemy.mixer) enemy.mixer.update(delta);
      if (enemy.enemyRef && enemy.enemyRef.pulseStripes) {
        enemy.enemyRef.pulseStripes(elapsed);
      }

      if (enemy.isDying) {
        enemy.deathProgress += delta / DEATH_DURATION;
        const t = Math.min(enemy.deathProgress, 1);
        // Scale punch then shrink while rotating away
        const punch = t < 0.2 ? 1 + (t / 0.2) * 0.4 : 1.4 - (t - 0.2) / 0.8 * 0.5;
        const shrink = t < 0.2 ? 1 : 1 - (t - 0.2) / 0.8;
        group.scale.setScalar(Math.max(0.01, punch * shrink));

        if (enemy.yawGroup) enemy.yawGroup.rotation.z += delta * 8;

        if (enemy.deathProgress >= 1) {
          removeEnemy(i);
        }
        continue;
      }

      if (enemy.isSpawning) {
        enemy.spawnProgress += delta / SPAWN_IN_DURATION;
        if (enemy.spawnProgress >= 1) {
          enemy.spawnProgress = 1;
          enemy.isSpawning = false;
        }
        group.scale.setScalar(easeOutBack(Math.min(enemy.spawnProgress, 1)));
        continue;
      }

      const dx = playerGroup.position.x - group.position.x;
      const dy = playerGroup.position.y - group.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // When idle (very close), decay the bank back to neutral so the
      // enemy doesn't stay tilted forever.
      if (dist <= 1) {
        enemy.bankAngle += (0 - enemy.bankAngle) * Math.min(8 * delta, 1);
        group.rotation.z = enemy.bankAngle;
      } else {
        const dirX = dx / dist;
        const dirY = dy / dist;

        const speed = enemy.baseSpeed * dynamicSpeedMultiplier;
        // Move the *desired* position along the chase vector, but clamp
        // it so the enemy never overshoots past the player. The buzz
        // offset is added on top at the end, so collision / pathing
        // (if we add it later) still sees the un-jittered target.
        const moveStep = speed * delta;
        enemy.desiredX += dirX * moveStep;
        enemy.desiredY += dirY * moveStep;

        // Clamp desired position so it doesn't overshoot the player.
        // If the desired position has moved past the player along the chase
        // direction, clamp it to the player's position.
        const fromSpawnToDesiredX = enemy.desiredX - x;
        const fromSpawnToDesiredY = enemy.desiredY - y;
        const fromDesiredToPlayerX = playerGroup.position.x - enemy.desiredX;
        const fromDesiredToPlayerY = playerGroup.position.y - enemy.desiredY;
        // Dot product: if negative, desired has passed the player
        const dot = fromSpawnToDesiredX * fromDesiredToPlayerX + fromSpawnToDesiredY * fromDesiredToPlayerY;
        if (dot < 0) {
          enemy.desiredX = playerGroup.position.x;
          enemy.desiredY = playerGroup.position.y;
        }

        // "Jhatka" — perpendicular sway that makes the enemy look like a
        // real insect, not a smooth slider. Use two sin waves at
        // different frequencies so the motion never lines up cleanly.
        const sway =
          Math.sin(time * BUZZ_FREQ_FAST + enemy.buzzPhaseA) * BUZZ_HORIZONTAL_AMP +
          Math.sin(time * BUZZ_FREQ_SLOW + enemy.buzzPhaseB) * (BUZZ_HORIZONTAL_AMP * 0.4);
        // Perpendicular vector to (dirX, dirY) is (-dirY, dirX)
        const offsetX = -dirY * sway;
        const offsetY = dirX * sway;

        group.position.x = enemy.desiredX + offsetX;
        group.position.y = enemy.desiredY + offsetY;

        // +PI/2 offset compensates for the model's intrinsic Math.PI/2 X-rotation
        const targetYaw = Math.atan2(dirY, dirX) + Math.PI / 2;
        enemy.currentYaw = lerpAngle(
          enemy.currentYaw,
          targetYaw,
          Math.min(TURN_SPEED * delta, 1)
        );
        if (enemy.yawGroup) enemy.yawGroup.rotation.z = enemy.currentYaw;

        // Bank into the turn: difference between current and target yaw
        // (normalized) is the angular velocity; lean in that direction
        // for a "G-force" look. Clamp so it doesn't go full sideways.
        const yawDelta = Math.atan2(
          Math.sin(enemy.currentYaw - targetYaw),
          Math.cos(enemy.currentYaw - targetYaw)
        );
        const targetBank = Math.max(-TILT_BANK_MAX, Math.min(TILT_BANK_MAX, -yawDelta * 1.6));
        enemy.bankAngle += (targetBank - enemy.bankAngle) * Math.min(10 * delta, 1);
        // Apply bank on the GROUP (not yawGroup) so the world-up axis
        // rolls the body without rotating the chase heading.
        group.rotation.z = enemy.bankAngle;
      }

      // Vertical bob: smooth sine hover + faster buzz on top so they
      // don't look like they're floating on a wire.
      const hoverZ =
        Math.sin(time * enemy.hoverSpeed + enemy.hoverPhase) * HOVER_AMPLITUDE +
        Math.sin(time * BUZZ_FREQ_FAST * 1.3 + enemy.buzzPhaseC) * BUZZ_VERTICAL_AMP;
      group.position.z = HOVER_BASE_Z + hoverZ;
    }
  }

  // Triggers death instead of immediate removal so the Death animation plays
  function killEnemy(index) {
    const enemy = enemies[index];
    if (!enemy || enemy.isDying) return;
    enemy.isDying = true;
    enemy.deathProgress = 0;
  }

  function removeEnemy(index) {
    const enemy = enemies[index];
    if (!enemy) return;

    scene.remove(enemy.group);
    enemy.group.traverse((child) => {
      if (!child.isMesh) return;
      if (child.geometry) child.geometry.dispose();
      if (!child.material) return;
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    });

    enemies.splice(index, 1);
  }

  function removeAll() {
    for (let i = enemies.length - 1; i >= 0; i--) {
      removeEnemy(i);
    }
  }

  return {
    update,
    spawnEnemy,
    killEnemy,
    removeEnemy,
    removeAll,
    setSpawnInterval,
    setSpeedMultiplier,
    setDifficulty,
    damageEnemy(index, n = 1) {
      const e = enemies[index];
      if (!e) return null;
      e.hp = Math.max(0, (e.hp || 0) - n);
      return e;
    },
    getEnemies: () => enemies
  };
}