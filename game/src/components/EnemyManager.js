import { createEnemy } from './Enemy.js';
import { lerpAngle } from '../utils/math.js';
import { easeOutBack } from '../utils/easings.js';
import { getEnemyWeights, ENEMY_TYPES } from './EnemyTypes.js';
import { pickWeighted } from '../utils/rng.js';

const SPAWN_INTERVAL = 2.2;
const MAX_ENEMIES = 12;
const ENEMY_SPEED = 18;
const SPAWN_RADIUS = 480;
const SPAWN_RANDOMIZE = 60;
const SPAWN_IN_DURATION = 0.3;
const HOVER_AMPLITUDE = 2.5;
const HOVER_BASE_Z = 4;
const TURN_SPEED = 6;
const DEATH_DURATION = 0.6;
const PLAYER_SAFE_RADIUS = 120;   // enemies don't spawn right on top of the player

const spawnPoints = [
  { x: -SPAWN_RADIUS, y: -SPAWN_RADIUS },
  { x: SPAWN_RADIUS, y: -SPAWN_RADIUS },
  { x: -SPAWN_RADIUS, y: SPAWN_RADIUS },
  { x: SPAWN_RADIUS, y: SPAWN_RADIUS }
];

export function createEnemyManager(scene, playerGroup) {
  const enemies = [];
  let spawnTimer = 0;
  let elapsed = 0;
  let difficultyLevel = 1;
  // Difficulty-controlled parameters, set externally each frame
  let dynamicSpawnInterval = SPAWN_INTERVAL;
  let dynamicSpeedMultiplier = 1;

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
      yawGroup: enemy.getYawGroup,
      mixer: enemy.getMixer,
      rootBone: enemy.getRootBone,
      type,
      def,
      hp: def.hp,
      baseSpeed: ENEMY_SPEED * def.speedMul * (0.85 + Math.random() * 0.3),
      hoverPhase: Math.random() * Math.PI * 2,
      hoverSpeed: 2.2 + Math.random() * 1.4,
      currentYaw: Math.random() * Math.PI * 2,
      spawnProgress: 0,
      isSpawning: true,
      isDying: false,
      deathProgress: 0
    });
    scene.add(group);
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

      const mixer = enemy.mixer();
      if (mixer) mixer.update(delta);

      if (enemy.isDying) {
        enemy.deathProgress += delta / DEATH_DURATION;
        const t = Math.min(enemy.deathProgress, 1);
        // Scale punch then shrink while rotating away
        const punch = t < 0.2 ? 1 + (t / 0.2) * 0.4 : 1.4 - (t - 0.2) / 0.8 * 0.5;
        const shrink = t < 0.2 ? 1 : 1 - (t - 0.2) / 0.8;
        group.scale.setScalar(Math.max(0.01, punch * shrink));

        const yawGroup = enemy.yawGroup();
        if (yawGroup) yawGroup.rotation.z += delta * 8;

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

      if (dist > 1) {
        const dirX = dx / dist;
        const dirY = dy / dist;

        const speed = enemy.baseSpeed * dynamicSpeedMultiplier;
        group.position.x += dirX * speed * delta;
        group.position.y += dirY * speed * delta;

        // +PI/2 offset compensates for the model's intrinsic Math.PI/2 X-rotation
        const targetYaw = Math.atan2(dirY, dirX) + Math.PI / 2;
        enemy.currentYaw = lerpAngle(
          enemy.currentYaw,
          targetYaw,
          Math.min(TURN_SPEED * delta, 1)
        );
        const yawGroup = enemy.yawGroup();
        if (yawGroup) yawGroup.rotation.z = enemy.currentYaw;
      }

      group.position.z = HOVER_BASE_Z + Math.sin(time * enemy.hoverSpeed + enemy.hoverPhase) * HOVER_AMPLITUDE;
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