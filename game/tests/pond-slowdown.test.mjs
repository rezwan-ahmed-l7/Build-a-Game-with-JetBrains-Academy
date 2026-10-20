import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMovement } from '../src/components/Movement.js';
import { isPositionOverAnyPond } from '../src/components/Obstacles.js';

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

test('pond footprint includes water and lily-pad positions but excludes the outside', () => {
  const ponds = [{ x: 100, y: 50, ref: { radius: 80 } }];
  assert.equal(isPositionOverAnyPond(100, 50, ponds), true);
  assert.equal(isPositionOverAnyPond(156, 50, ponds), true);
  assert.equal(isPositionOverAnyPond(172, 50, ponds), true);
  assert.equal(isPositionOverAnyPond(174, 50, ponds), false);
  assert.equal(isPositionOverAnyPond(500, 500, ponds), false);
});

test('pond slowdown composes with power-up speed and does not overwrite it', () => {
  const { movement } = makeMovement();
  movement.setSpeedMultiplier(1.5);
  movement.setEnvironmentalSpeedMultiplier(0.7);
  assert.equal(movement.getSpeedMultiplier(), 1.5);
  assert.equal(movement.getEnvironmentalSpeedMultiplier(), 0.7);
  assert.ok(Math.abs(movement.getEffectiveSpeedMultiplier() - 1.05) < 1e-9);
  movement.setEnvironmentalSpeedMultiplier(1);
  assert.equal(movement.getEffectiveSpeedMultiplier(), 1.5);
});

test('pond-speed movement remains controllable and finishes after leaving the pond', () => {
  const { player, movement } = makeMovement();
  movement.setEnvironmentalSpeedMultiplier(0.7);
  movement.update(0);
  assert.equal(movement.isCurrentlyMoving(), true);
  movement.update(0.38);
  assert.equal(movement.isCurrentlyMoving(), true);
  assert.ok(player.position.y > 0);
  assert.ok(player.position.y < 40);
  movement.setEnvironmentalSpeedMultiplier(1);
  movement.update(0.12);
  assert.equal(movement.isCurrentlyMoving(), false);
  assert.equal(player.position.y, 40);
});
