import * as THREE from 'three';

const BASE_ATTACK_COOLDOWN = 0.85;
const BASE_ATTACK_RADIUS = 38;
const ATTACK_VISUAL_LIFETIME = 0.32;
const HITSTOP_DURATION = 0.05;

export function createAttack(scene, playerGroup, enemyManager, onKill) {
  let lastAttackTime = 0;
  let attackVisual = null;
  let hitStopRemaining = 0;

  // Difficulty-controlled parameters
  let cooldown = BASE_ATTACK_COOLDOWN;
  let radius = BASE_ATTACK_RADIUS;

  function setCooldown(value) {
    cooldown = value;
  }

  function setRadius(value) {
    radius = value;
    // Update an in-flight visual so the ring tracks the new radius
    if (attackVisual) {
      attackVisual.geometry.dispose();
      attackVisual.geometry = new THREE.RingGeometry(radius * 0.8, radius, 32);
    }
  }

  function createAttackVisual() {
    if (attackVisual) {
      scene.remove(attackVisual);
      attackVisual.geometry.dispose();
      attackVisual.material.dispose();
      attackVisual = null;
    }

    const geometry = new THREE.RingGeometry(radius * 0.8, radius, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffee44,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    attackVisual = new THREE.Mesh(geometry, material);
    attackVisual.position.copy(playerGroup.position);
    attackVisual.position.z = 0.3;
    attackVisual.userData.life = 0;
    scene.add(attackVisual);
  }

  function updateVisual(delta) {
    if (!attackVisual) return;

    attackVisual.userData.life += delta;
    const progress = attackVisual.userData.life / ATTACK_VISUAL_LIFETIME;

    if (progress >= 1) {
      scene.remove(attackVisual);
      attackVisual.geometry.dispose();
      attackVisual.material.dispose();
      attackVisual = null;
      return;
    }

    if (progress < 0.2) {
      const t = progress / 0.2;
      attackVisual.scale.setScalar(0.5 + t * 0.5);
      attackVisual.material.opacity = 0.9;
    } else {
      const t = (progress - 0.2) / 0.8;
      attackVisual.material.opacity = 0.9 * (1 - t);
    }
  }

  function attack(currentTime) {
    if (currentTime - lastAttackTime < cooldown * 1000) return;
    lastAttackTime = currentTime;

    createAttackVisual();

    const enemies = enemyManager.getEnemies();
    const playerPos = playerGroup.position;
    let hitCount = 0;

    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (enemy.isSpawning) continue;

      const enemyPos = enemy.group.position;
      const dx = playerPos.x - enemyPos.x;
      const dy = playerPos.y - enemyPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        enemyManager.killEnemy(i); // plays death anim before removal
        hitCount++;
      }
    }

    if (hitCount > 0) {
      hitStopRemaining = HITSTOP_DURATION;
      if (onKill) onKill(hitCount);
    }
  }

  function getHitStopDelta(delta) {
    if (hitStopRemaining > 0) {
      if (delta >= hitStopRemaining) {
        const remaining = delta - hitStopRemaining;
        hitStopRemaining = 0;
        return remaining;
      }
      hitStopRemaining -= delta;
      return 0;
    }
    return delta;
  }

  return {
    attack,
    updateVisual,
    getHitStopDelta,
    setCooldown,
    setRadius
  };
}
