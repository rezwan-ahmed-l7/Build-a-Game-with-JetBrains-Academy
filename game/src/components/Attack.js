import * as THREE from 'three';

const BASE_ATTACK_COOLDOWN = 0.50;
const BASE_ATTACK_RADIUS = 38;
const ATTACK_VISUAL_LIFETIME = 0.32;
const HITSTOP_DURATION = 0.05;

// createAttack returns the attack pipeline. Optional hooks:
//  onHit(enemy, position): called for every enemy that took damage (even if
//    it didn't die yet — used for spawning damage numbers / sparks)
//  onKill(count, position): called for each enemy that actually died
//  onScreenShake(amount): called on hit (used to drive ScreenShake)
//  onParticles(kind, x, y, z, color): particle burst hook
export function createAttack(scene, playerGroup, enemyManager, callbacks = {}) {
  const onHit = callbacks.onHit || (() => {});
  const onKill = callbacks.onKill || (() => {});
  const onShake = callbacks.onShake || (() => {});
  const onParticles = callbacks.onParticles || (() => {});

  let lastAttackTime = -Infinity;
  let attackVisual = null;
  let hitStopRemaining = 0;

  let cooldown = BASE_ATTACK_COOLDOWN;
  let radius = BASE_ATTACK_RADIUS;
  let damage = 1;

  function setCooldown(value) {
    cooldown = value;
  }

  function setDamage(value) {
    damage = Math.max(1, Math.floor(value));
  }

  function getDamage() {
    return damage;
  }

  function setRadius(value) {
    if (!Number.isFinite(value) || value <= 0) return;
    radius = value;
    if (attackVisual) {
      attackVisual.geometry.dispose();
      attackVisual.geometry = new THREE.RingGeometry(radius * 0.8, radius, 32);
    }
  }

  function getRadius() {
    return radius;
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

    // Spark burst at the player's feet
    onParticles('sparks',
      playerGroup.position.x,
      playerGroup.position.y,
      playerGroup.position.z,
      0xffd166
    );
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
    let killCount = 0;

    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (enemy.isSpawning || enemy.isDying) continue;
      const enemyPos = enemy.group.position;
      const dx = playerPos.x - enemyPos.x;
      const dy = playerPos.y - enemyPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) {
        // Damage; if HP drops to 0, kill (plays death anim).
        // EnemyManager exposes wrapper records, so apply damage through its API.
        const damagedEnemy = typeof enemyManager.damageEnemy === 'function'
          ? enemyManager.damageEnemy(i, damage)
          : enemy;
        if (!damagedEnemy) continue;

        onHit(damagedEnemy, enemyPos);
        if (damagedEnemy.hp <= 0 || (typeof damagedEnemy.damageHp === 'function' && damagedEnemy.getHp?.() <= 0)) {
          enemyManager.killEnemy(i);
          killCount++;
          onKill(damagedEnemy, enemyPos);
          onParticles('death', enemyPos.x, enemyPos.y, enemyPos.z, 0xff5577);
        }
      }
    }

    if (killCount > 0) {
      hitStopRemaining = HITSTOP_DURATION;
      onShake(2 + killCount * 0.6);
    } else {
      onShake(0.6);
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
    setDamage,
    getDamage,
    setRadius,
    getRadius
  };
}
