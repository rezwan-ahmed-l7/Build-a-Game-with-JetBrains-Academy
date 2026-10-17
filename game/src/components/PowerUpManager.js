// PowerUpManager: spawns power-ups on a timer, ticks their lifetime, removes
// expired ones, and detects pickup by the player.

import * as THREE from 'three';
import { createPowerUp, POWERUP_TYPES } from './PowerUp.js';

const PICKUP_RADIUS = 22;
const SPAWN_RADIUS = 280;

export function createPowerUpManager(scene, playerGroup) {
  const active = [];
  let nextSpawnIn = 8; // first one is quick so the player sees it
  let elapsed = 0;

  function spawn() {
    // Random angle & radius; never on top of the player.
    const angle = Math.random() * Math.PI * 2;
    const r = 100 + Math.random() * SPAWN_RADIUS;
    const x = playerGroup.position.x + Math.cos(angle) * r;
    const y = playerGroup.position.y + Math.sin(angle) * r;

    // Weighted type: heal is most common, score next, attack + speed rare
    const r2 = Math.random();
    let type = 'heal';
    if (r2 > 0.92) type = 'speed';
    else if (r2 > 0.78) type = 'attack';
    else if (r2 > 0.55) type = 'score';

    const pu = createPowerUp(type, x, y);
    scene.add(pu.group);
    active.push(pu);
  }

  function update(delta, time, onPickup) {
    elapsed += delta;
    nextSpawnIn -= delta;
    if (nextSpawnIn <= 0) {
      nextSpawnIn = 14 + Math.random() * 8;
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

  function removeAll() {
    for (const pu of active) {
      scene.remove(pu.group);
      pu.dispose();
    }
    active.length = 0;
  }

  return { update, removeAll };
}
