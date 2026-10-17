// PowerUpManager: spawns power-ups on a timer, ticks their lifetime, removes
// expired ones, and detects pickup by the player.

import * as THREE from 'three';
import { createPowerUp, POWERUP_TYPES } from './PowerUp.js';

const PICKUP_RADIUS = 22;
const SPAWN_RADIUS = 120;

export function createPowerUpManager(scene, playerGroup) {
  const active = [];
  let nextSpawnIn = 8; // first one is quick so the player sees it
  let elapsed = 0;
  let currentLevel = 1;

  function setLevel(level) {
    currentLevel = level;
  }

  function pickType() {
    // Weighted spawn — cumulative, level-aware
    // Base weights: heal 35%, score 20%, attack 15%, speed 10% = 80%
    // New types fill the remaining 20% based on level unlock
    const r = Math.random();
    if (currentLevel >= 9 && r < 0.02) return 'freeze';
    if (currentLevel >= 7 && r < 0.05) return 'magnet';
    if (currentLevel >= 5 && r < 0.10) return 'doubleAttack';
    if (currentLevel >= 3 && r < 0.15) return 'shield';
    if (r < 0.50) return 'heal';
    if (r < 0.70) return 'score';
    if (r < 0.85) return 'attack';
    return 'speed';
  }

  function spawn() {
    // Random angle & radius; never on top of the player.
    const angle = Math.random() * Math.PI * 2;
    const r = 100 + Math.random() * SPAWN_RADIUS;
    const x = playerGroup.position.x + Math.cos(angle) * r;
    const y = playerGroup.position.y + Math.sin(angle) * r;

    const type = pickType();
    const pu = createPowerUp(type, x, y);
    scene.add(pu.group);
    active.push(pu);
  }

  function update(delta, time, onPickup, magnetActive) {
    elapsed += delta;
    nextSpawnIn -= delta;
    if (nextSpawnIn <= 0) {
      nextSpawnIn = 10 + Math.random() * 5;
      spawn();
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
  }

  return { update, removeAll, setLevel };
}
