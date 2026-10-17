// Difficulty scales linearly with score, with caps on every parameter
// so the game never becomes unfair or broken.
const DIFFICULTY_GROWTH = 0.018;

const BASE_SPAWN_INTERVAL = 2.4;
const BASE_ENEMY_SPEED = 16;
const BASE_PLAYER_SPEED_MULT = 1.0;
const BASE_ATTACK_COOLDOWN = 0.85;
const BASE_ATTACK_RADIUS = 38;

const MAX_DIFFICULTY = 3.2;
const ENEMY_SPEED_CAP = 2.8;

export function createDifficulty() {
  let lastScore = 0;

  function compute(score) {
    const difficulty = 1 + score * DIFFICULTY_GROWTH;
    return {
      difficulty,
      spawnInterval: BASE_SPAWN_INTERVAL / Math.min(difficulty, MAX_DIFFICULTY),
      enemySpeed: BASE_ENEMY_SPEED * Math.min(difficulty * 1.15, ENEMY_SPEED_CAP),
      // Player stats remain constant — difficulty should only make enemies harder,
      // not give the player superpowers.
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
