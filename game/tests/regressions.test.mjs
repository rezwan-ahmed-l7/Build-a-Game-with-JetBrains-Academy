import test from 'node:test';
import assert from 'node:assert/strict';
import { getLevel, getNextLevelScore } from '../src/components/Score.js';
import { createHealth } from '../src/components/Health.js';

test('getNextLevelScore returns the next threshold for the current score', () => {
  assert.equal(getNextLevelScore(0), 1000);
  assert.equal(getNextLevelScore(999), 1000);
  assert.equal(getNextLevelScore(1000), 2500);
  assert.equal(getNextLevelScore(5000), 8500);
  assert.equal(getNextLevelScore(41000), null);
  assert.equal(getNextLevelScore(999999), null);
});

test('getLevel remains consistent with next-level thresholds', () => {
  assert.equal(getLevel(0), 1);
  assert.equal(getLevel(1000), 2);
  assert.equal(getLevel(41000), 10);
});

test('setMax notifies HUD listeners and clamps HP when maximum decreases', () => {
  const health = createHealth(3);
  const events = [];
  health.onChange((event, payload) => events.push({ event, payload }));

  health.setMax(5);
  assert.deepEqual(events.at(-1), { event: 'max', payload: { hp: 3, max: 5 } });
  assert.equal(health.getMax(), 5);
  assert.equal(health.getHp(), 3);

  health.setMax(2);
  assert.deepEqual(events.at(-1), { event: 'max', payload: { hp: 2, max: 2 } });
  assert.equal(health.getHp(), 2);
  assert.equal(health.getMax(), 2);
});

test('setMax does not emit redundant events when the maximum is unchanged', () => {
  const health = createHealth(3);
  let events = 0;
  health.onChange(() => events++);
  health.setMax(3);
  assert.equal(events, 0);
});
