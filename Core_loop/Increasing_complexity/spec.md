### Specification for AI agent: Increasing complexity

Implement a smooth and well-balanced dynamic difficulty system that scales the game's challenge based on the player's current score.

#### Difficulty scaling parameters
**Original requirements:**
As the score increases, adjust the following parameters:
- Enemy spawn delay: Decrease the delay between enemy spawns (enemies appear more frequently).
- Implement enemy spawning with an accumulated timer in the animation loop (advance it with `clock.getDelta()`)
- Enemy movement speed: Increase enemy speed.
- Player movement speed: Slightly increase the player's speed.
- Player attack delay: Decrease the time between player attacks.
- Player attack distance: Slightly increase the attack range.

**Enhanced version (cleaner & more controllable):**

Create clear base values + scaling:

```js
// Base values
const BASE_SPAWN_INTERVAL = 2.4;
const BASE_ENEMY_SPEED = 16;
const BASE_PLAYER_SPEED = 1.0;          // multiplier
const BASE_ATTACK_COOLDOWN = 0.85;
const BASE_ATTACK_RADIUS = 38;

// Scaling
const DIFFICULTY_GROWTH = 0.018;        // how fast difficulty rises with score
```

As score increases:
- Spawn interval decreases (more enemies)
- Enemy speed increases
- Player move speed slightly increases
- Attack cooldown decreases (faster attacks)
- Attack radius slightly increases

#### Scaling logic
**Original requirements:**
- Calculate a difficulty factor based on the complexity growth rate factor stored in a constant.
- Adjust the complexity parameters linearly in proportion to the growth difficulty factor.
- Ensure enemy parameters scale slightly faster than player parameters to maintain a challenge.

**Enhanced & better balanced logic:**

```js
const difficulty = 1 + score * DIFFICULTY_GROWTH;
```

Then apply:

- `spawnInterval = BASE_SPAWN_INTERVAL / Math.min(difficulty, 3.2)`
- `enemySpeed = BASE_ENEMY_SPEED * Math.min(difficulty * 1.15, 2.8)`
- `playerSpeedMultiplier = BASE_PLAYER_SPEED * Math.min(1 + (difficulty - 1) * 0.35, 1.6)`
- `attackCooldown = BASE_ATTACK_COOLDOWN / Math.min(1 + (difficulty - 1) * 0.4, 1.8)`
- `attackRadius = BASE_ATTACK_RADIUS * Math.min(1 + (difficulty - 1) * 0.25, 1.45)`

**Important design rules:**
- Enemy power should scale slightly faster than player power.
- Use `Math.min()` caps so the game never becomes completely unfair or broken.
- Keep the scaling linear and predictable.

#### Animation loop integration
**Original requirements:**
- Recalculate these parameters in each frame of the animation loop using the current score.
- Apply the updated speeds and delays to the respective game systems.

**Enhanced integration:**
- Recalculate difficulty parameters once per frame (or only when score changes for better performance).
- Apply the new values to:
    - Enemy spawn timer
    - Enemy movement speed
    - Player movement speed
    - Attack cooldown
    - Attack radius
- Make sure the spawn timer still uses `clock.getDelta()` (accumulated time).

#### Extra Polish (Recommended)
- Add a soft difficulty curve instead of pure linear if it feels too aggressive.
- Keep minimum and maximum limits on every parameter so the game stays playable.
- Optional: show a subtle “Difficulty Up” feedback when the player crosses certain score thresholds.

#### Code Quality Rules
- Keep all difficulty values in one place (easy to tune).
- Never hardcode scaling numbers deep inside movement or spawn logic.
- Make the system easy to adjust by changing only a few constants.
- Ensure the game still feels fair even at high scores.

---

**Final Goal:**
The game should start easy and gradually become more intense.  
Enemies should feel more dangerous over time, while the player also gets slightly stronger.  
Difficulty must rise smoothly — never suddenly unfair or broken.