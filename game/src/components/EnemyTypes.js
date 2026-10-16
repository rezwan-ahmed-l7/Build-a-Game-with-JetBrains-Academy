// Enemy archetypes. Each one defines a small data block the spawner reads.
// `getStats(difficulty)` lets HP/speed/scale adjust with difficulty.
//
// Color palette is taken from the reference image in
// Skeleton/Adding_enemies/images/enemies.gif — a dark horned creature
// with bright yellow/gold body stripes. We keep a tiny hue/saturation
// jitter per enemy for visual variety, but the overall identity stays
// "dark body + gold accent" across all three archetypes. Players read
// the type from behavior (speed, HP, size) rather than color.

export const ENEMY_TYPES = {
  chaser: {
    name: 'chaser',
    hp: 1,
    scale: 6,
    speedMul: 1.0,
    // Cool dark body with a warm gold emissive (the stripes on the GLB
    // are a separate gold material; we tint the body material here).
    tint: { h: 0.08, s: 0.10, l: 0.10 },  // near-black charcoal
    emissive: 0.55,                        // gold emissive glow
    attackContact: 1
  },
  sprinter: {
    name: 'sprinter',
    hp: 1,
    scale: 5,
    speedMul: 1.9,
    tint: { h: 0.08, s: 0.10, l: 0.08 },  // slightly darker, leaner look
    emissive: 0.70,                        // brighter gold (fast + hot)
    attackContact: 1
  },
  brute: {
    name: 'brute',
    hp: 3,
    scale: 9,
    speedMul: 0.6,
    tint: { h: 0.10, s: 0.15, l: 0.12 },  // warm-dark (brown-black)
    emissive: 0.45,                        // softer gold (heavy)
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
