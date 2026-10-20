import * as THREE from 'three';

const BASE_ATTACK_COOLDOWN = 0.50;
const BASE_ATTACK_RADIUS = 40;
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
    damage = Math.max(0, Number(value) || 0);
  }

  function getDamage() {
    return damage;
  }

  function setRadius(value) {
    if (!Number.isFinite(value) || value <= 0) return;
    radius = value;
    if (attackVisual) {
      for (const child of attackVisual.children) {
        if (child.userData?.ringRatios) {
          child.geometry.dispose();
          child.geometry = new THREE.RingGeometry(
            radius * child.userData.ringRatios[0],
            radius * child.userData.ringRatios[1],
            48
          );
        } else if (child.userData?.slashRatios) {
          child.geometry.dispose();
          const positions = [];
          const [inner, outer] = child.userData.slashRatios;
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            positions.push(
              Math.cos(a) * radius * inner, Math.sin(a) * radius * inner, 0,
              Math.cos(a) * radius * outer, Math.sin(a) * radius * outer, 0
            );
          }
          child.geometry = new THREE.BufferGeometry();
          child.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        }
      }
    }
  }

  function getRadius() {
    return radius;
  }

  function createAttackVisual() {
    if (attackVisual) {
      scene.remove(attackVisual);
      attackVisual.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
      attackVisual = null;
    }

    // A layered shockwave: warm impact core, bright outer sweep, and radial
    // energy slashes. All are lightweight Three.js geometry (no textures or
    // post-processing), designed to read clearly from the gameplay camera.
    attackVisual = new THREE.Group();
    attackVisual.position.set(playerGroup.position.x, playerGroup.position.y, 0.45);
    attackVisual.userData.life = 0;
    attackVisual.userData.layers = [];

    const ringLayers = [
      { inner: 0.82, outer: 1.0, color: 0xfff4a3, opacity: 0.98, delay: 0.0, scale: 0.28 },
      { inner: 0.58, outer: 0.65, color: 0xff4fc8, opacity: 0.94, delay: 0.035, scale: 0.34 },
      { inner: 0.42, outer: 0.49, color: 0x8c5bff, opacity: 0.92, delay: 0.065, scale: 0.26 },
      { inner: 0.30, outer: 0.36, color: 0x54f6ff, opacity: 0.92, delay: 0.02, scale: 0.22 },
      { inner: 0.12, outer: 0.19, color: 0xa7ff58, opacity: 0.90, delay: 0.0, scale: 0.18 }
    ];
    for (const layer of ringLayers) {
      const geometry = new THREE.RingGeometry(radius * layer.inner, radius * layer.outer, 48);
      const material = new THREE.MeshBasicMaterial({
        color: layer.color,
        transparent: true,
        opacity: layer.opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(layer.scale);
      mesh.userData = {
        ringRatios: [layer.inner, layer.outer],
        baseScale: layer.scale,
        delay: layer.delay,
        baseOpacity: layer.opacity
      };
      attackVisual.add(mesh);
      attackVisual.userData.layers.push(mesh);
    }

    // Short radial streaks give the pulse a punchy, arcade-like impact read.
    const slashPositions = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const inner = radius * 0.72;
      const outer = radius * (i % 2 === 0 ? 1.08 : 0.98);
      slashPositions.push(
        Math.cos(angle) * inner, Math.sin(angle) * inner, 0.02,
        Math.cos(angle) * outer, Math.sin(angle) * outer, 0.02
      );
    }
    const slashGeometry = new THREE.BufferGeometry();
    slashGeometry.setAttribute('position', new THREE.Float32BufferAttribute(slashPositions, 3));
    const slashMaterial = new THREE.LineBasicMaterial({
      color: 0xffe9a3,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const slashes = new THREE.LineSegments(slashGeometry, slashMaterial);
    slashes.userData.slashRatios = [0.72, 1.08];
    slashes.userData.baseOpacity = 0.95;
    slashes.scale.setScalar(0.35);
    attackVisual.add(slashes);
    attackVisual.userData.layers.push(slashes);

    // A second, offset set of colored streaks creates a layered prismatic burst.
    const accentPositions = [];
    for (let i = 0; i < 10; i++) {
      const angle = ((i + 0.5) / 10) * Math.PI * 2;
      accentPositions.push(
        Math.cos(angle) * radius * 0.48, Math.sin(angle) * radius * 0.48, 0.04,
        Math.cos(angle) * radius * (i % 2 ? 0.94 : 1.14),
        Math.sin(angle) * radius * (i % 2 ? 0.94 : 1.14), 0.04
      );
    }
    const accentGeometry = new THREE.BufferGeometry();
    accentGeometry.setAttribute('position', new THREE.Float32BufferAttribute(accentPositions, 3));
    const accentMaterial = new THREE.LineBasicMaterial({
      color: 0xff62e5, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    const accents = new THREE.LineSegments(accentGeometry, accentMaterial);
    accents.userData.slashRatios = [0.48, 1.14];
    accents.userData.baseOpacity = 0.9;
    accents.scale.setScalar(0.24);
    attackVisual.add(accents);
    attackVisual.userData.layers.push(accents);

    scene.add(attackVisual);

    // A compact spark burst anchors the shockwave to the frog's position.
    onParticles('sparks',
      playerGroup.position.x,
      playerGroup.position.y,
      playerGroup.position.z + 1,
      0xffd166
    );
  }

  function updateVisual(delta) {
    if (!attackVisual) return;
    attackVisual.userData.life += delta;
    const progress = attackVisual.userData.life / ATTACK_VISUAL_LIFETIME;
    if (progress >= 1) {
      scene.remove(attackVisual);
      attackVisual.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
      attackVisual = null;
      return;
    }

    const eased = 1 - Math.pow(1 - progress, 2.4);
    attackVisual.rotation.z += delta * (1.8 + progress * 3.2);
    for (const layer of attackVisual.userData.layers) {
      const delay = layer.userData.delay || 0;
      const local = THREE.MathUtils.clamp((progress - delay) / (1 - delay), 0, 1);
      const baseScale = layer.userData.baseScale ?? 1;
      const scale = baseScale + eased * (1.0 - baseScale);
      layer.scale.setScalar(scale);
      layer.material.opacity = (layer.userData.baseOpacity || 0.9) * (1 - local) * (progress < delay ? 0 : 1);
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
