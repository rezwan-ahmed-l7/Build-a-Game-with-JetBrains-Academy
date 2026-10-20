// PowerUpManager: spawns power-ups on a timer, ticks their lifetime, removes
// expired ones, and detects pickup by the player.

import * as THREE from 'three';
import { createPowerUp, createMysteryBox } from './PowerUp.js';
import { PLAYABLE_RADIUS } from './WorldBounds.js';

const PICKUP_RADIUS = 22;
const SPAWN_RADIUS = 120;

export function createPowerUpManager(scene, playerGroup) {
  const active = [];
  const mysteryBoxes = [];
  let nextSpawnIn = 8; // first one is quick so the player sees it
  let elapsed = 0;
  let currentLevel = 1;

  function setLevel(level) {
    currentLevel = level;
  }

  function pickType() {
    // Disjoint probability bands preserve the intended rarity and keep Heal reachable.
    const r = Math.random();
    if (currentLevel >= 9 && r < 0.02) return 'freeze';          // 2%
    if (currentLevel >= 7 && r < 0.05) return 'magnet';          // next 3%
    if (currentLevel >= 5 && r < 0.10) return 'doubleAttack';    // next 5%
    if (currentLevel >= 3 && r < 0.18) return 'shield';          // next 8%
    const commonRoll = currentLevel >= 3 ? r - 0.18 : r;
    if (commonRoll < 0.15) return 'heal';                        // 15%
    if (commonRoll < 0.35) return 'score';                       // 20%
    if (commonRoll < 0.55) return 'attack';                      // 20%
    return 'speed';
  }

  function mysteryBoxChance() {
    if (currentLevel < 3) return 0;
    if (currentLevel >= 9) return 0.06;
    if (currentLevel >= 7) return 0.05;
    if (currentLevel >= 5) return 0.04;
    return 0.03;
  }

  function spawn() {
    // Random angle & radius; never on top of the player.
    const angle = Math.random() * Math.PI * 2;
    const r = 100 + Math.random() * SPAWN_RADIUS;
    let x = playerGroup.position.x + Math.cos(angle) * r;
    let y = playerGroup.position.y + Math.sin(angle) * r;
    // Keep pickups inside the intended arena so they never reward boundary exploits.
    const distance = Math.hypot(x, y);
    const maxPickupRadius = PLAYABLE_RADIUS - 24;
    if (distance > maxPickupRadius) {
      const scale = maxPickupRadius / distance;
      x *= scale;
      y *= scale;
    }

    // Mystery boxes are rare and never chain from another Mystery Box.
    // Only one may exist at a time; its own reward is handled by GameManager.
    if (currentLevel >= 3 && mysteryBoxes.length === 0 && Math.random() < mysteryBoxChance()) {
      const box = createMysteryBox(x, y);
      scene.add(box.group);
      mysteryBoxes.push(box);
      return;
    }
    const type = pickType();
    const pu = createPowerUp(type, x, y);
    scene.add(pu.group);
    active.push(pu);
  }

  function update(delta, time, onPickup, magnetActive, onMysteryBoxPickup) {
    elapsed += delta;
    nextSpawnIn -= delta;
    if (nextSpawnIn <= 0) {
      nextSpawnIn = 10 + Math.random() * 5;
      spawn();
    }

    for (let i = mysteryBoxes.length - 1; i >= 0; i--) {
      const box = mysteryBoxes[i];
      const alive = box.update(delta, time);
      if (!alive) {
        scene.remove(box.group);
        box.dispose();
        mysteryBoxes.splice(i, 1);
        continue;
      }
      const pos = box.getPosition();
      if (Math.hypot(pos.x - playerGroup.position.x, pos.y - playerGroup.position.y) < PICKUP_RADIUS) {
        box.markCollected();
        scene.remove(box.group);
        box.dispose();
        mysteryBoxes.splice(i, 1);
        if (onMysteryBoxPickup) onMysteryBoxPickup({ x: pos.x, y: pos.y, z: pos.z });
        return; // Do not also collect a regular power-up in the same frame.
      }
    }

    for (let i = active.length - 1; i >= 0; i--) {
      const pu = active[i];
      const alive = pu.update(delta, time);
      if (!alive) {
        scene.remove(pu.group);
        pu.dispose();
        active.splice(i, 1);
        continue;
      }
      if (pu.isCollected()) continue;

      // Magnet: auto-pull power-ups toward player
      if (magnetActive) {
        const pos = pu.getPosition();
        const mdx = playerGroup.position.x - pos.x;
        const mdy = playerGroup.position.y - pos.y;
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mDist > 1) {
          const pullSpeed = 120 * delta; // units per second
          const nx = mdx / mDist;
          const ny = mdy / mDist;
          pu.group.position.x += nx * pullSpeed;
          pu.group.position.y += ny * pullSpeed;
        }
        // Increase pickup radius when magnet is active
        if (mDist < PICKUP_RADIUS + 30) {
          pu.markCollected();
          onPickup(pu.getType(), pu.getPosition());
          scene.remove(pu.group);
          pu.dispose();
          active.splice(i, 1);
          continue;
        }
      } else {
        const dx = pu.getPosition().x - playerGroup.position.x;
        const dy = pu.getPosition().y - playerGroup.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < PICKUP_RADIUS) {
          pu.markCollected();
          onPickup(pu.getType(), pu.getPosition());
          scene.remove(pu.group);
          pu.dispose();
          active.splice(i, 1);
        }
      }
    }
  }

  function removeAll() {
    for (const pu of active) {
      scene.remove(pu.group);
      pu.dispose();
    }
    active.length = 0;
    for (const box of mysteryBoxes) {
      scene.remove(box.group);
      box.dispose();
    }
    mysteryBoxes.length = 0;
  }

  return { update, removeAll, setLevel };
}
