import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMovement } from '../src/components/Movement.js';

function makeMovement() {
  const player = new THREE.Group();
  const queue = ['forward'];
  const input = {
    isEmpty: () => queue.length === 0,
    peek: () => queue[0],
    dequeue: () => queue.shift()
  };
  const camera = {
    getWorldDirection(target) {
      return target.set(0, 1, 0);
    }
  };
  const movement = createMovement(player, () => null, input, camera, null);
  return { player, movement };
}

test('pond slowdown applies a 0.7 environmental factor without overwriting level or power-up speed', () => {
  const { movement } = makeMovement();

  movement.setSpeedMultiplier(1.5);
  movement.setEnvironmentalSpeedMultiplier(0.7);

  assert.equal(movement.getSpeedMultiplier(), 1.5);
  assert.equal(movement.getEnvironmentalSpeedMultiplier(), 0.7);
  assert.ok(Math.abs(movement.getEffectiveSpeedMultiplier() - 1.05) < 1e-9);
});

test('movement remains controllable at pond speed and completes after leaving the pond', () => {
  const { player, movement } = makeMovement();

  movement.setEnvironmentalSpeedMultiplier(0.7);
  movement.update(0); // Consume the queued direction and start the hop.
  assert.equal(movement.isCurrentlyMoving(), true);

  movement.update(0.38); // 0.7 of a normal hop, not a full hop.
  assert.equal(movement.isCurrentlyMoving(), true);
  assert.ok(player.position.y > 0);
  assert.ok(player.position.y < 40);

  movement.setEnvironmentalSpeedMultiplier(1); // Leaving water restores normal speed.
  movement.update(0.12);
  assert.equal(movement.isCurrentlyMoving(), false);
  assert.equal(player.position.y, 40);
});
