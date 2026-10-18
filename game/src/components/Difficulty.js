// Difficulty scales linearly with score, with caps on every parameter
// so the game never becomes unfair or broken.
const DIFFICULTY_GROWTH = 0.008;

const BASE_SPAWN_INTERVAL = 4.0;
const BASE_ENEMY_SPEED = 12;
const BASE_PLAYER_SPEED_MULT = 1.0;
const BASE_ATTACK_COOLDOWN = 0.85;
const BASE_ATTACK_RADIUS = 38;

const MAX_DIFFICULTY = 3.2;
const ENEMY_SPEED_CAP = 2.8;
const PLAYER_SPEED_CAP = 1.6;
const ATTACK_COOLDOWN_CAP = 1.8;     // divisor cap
const ATTACK_RADIUS_CAP = 1.45;      // multiplier cap

export function createDifficulty() {
  let lastScore = 0;

  function compute(score) {
    const difficulty = 1 + score * DIFFICULTY_GROWTH;
    return {
      difficulty,
      spawnInterval: BASE_SPAWN_INTERVAL / Math.min(difficulty, MAX_DIFFICULTY),
      enemySpeed: BASE_ENEMY_SPEED * Math.min(difficulty * 1.15, ENEMY_SPEED_CAP),
      playerSpeedMultiplier: BASE_PLAYER_SPEED_MULT,
      attackCooldown: BASE_ATTACK_COOLDOWN,
      attackRadius: BASE_ATTACK_RADIUS
    };
  }

  function get() {
    return compute(lastScore);
  }

  function setScore(score) {
    lastScore = score;
  }

  return { get, setScore };
}
