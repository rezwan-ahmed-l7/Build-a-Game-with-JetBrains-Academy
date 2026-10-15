// Enemy archetypes. Each one defines a small data block the spawner reads.
// `getStats(difficulty)` lets HP/speed/scale adjust with difficulty.
//
// tints are picked so the three types are unmistakably distinct at a glance:
//  - chaser: classic crimson red
//  - sprinter: blazing orange/yellow
//  - brute: deep purple/magenta, heavier feel

export const ENEMY_TYPES = {
  chaser: {
    name: 'chaser',
    hp: 1,
    scale: 6,
    speedMul: 1.0,
    tint: { h: 0.0,  s: 0.85, l: 0.55 },  // crimson red
    emissive: 0.28,
    attackContact: 1
  },
  sprinter: {
    name: 'sprinter',
    hp: 1,
    scale: 5,
    speedMul: 1.9,
    tint: { h: 0.10, s: 0.95, l: 0.55 },  // bright orange
    emissive: 0.42,
    attackContact: 1
  },
  brute: {
    name: 'brute',
    hp: 3,
    scale: 9,
    speedMul: 0.6,
    tint: { h: 0.78, s: 0.7, l: 0.40 },   // deep purple/magenta
    emissive: 0.35,
    attackContact: 2
  }
};

// Returns a weight table favoring chasers at low difficulty and adding
// brutes + sprinters as difficulty rises.
export function getEnemyWeights(difficulty) {
  // difficulty ~ 1..3.2 (capped by Difficulty.js)
  const d = Math.max(1, Math.min(3.2, difficulty));
  return [
    { value: 'chaser', weight: 10 - (d - 1) * 1.5 },
    { value: 'sprinter', weight: 1 + (d - 1) * 1.0 },
    { value: 'brute', weight: Math.max(0, (d - 1.6) * 2.2) }
  ];
}
