### Specification for AI agent: Collision detection

Implement a clean, reliable, and good-feeling collision detection system to prevent characters from overlapping.

#### Object shapes
**Original requirements:**
- Use a 3D model's shape to determine boundaries of the object.
- Do not use raw bounding boxes, as they are often too large and inaccurate for rounded characters.

**Enhanced version (recommended):**
- Prefer a simple but effective approach for this game stage:
    - Use a circular / cylindrical collision shape based on the model’s width (XZ plane).
    - Calculate an effective radius from the model’s bounding box (or hardcode a tuned radius per character type).
- Store a `collisionRadius` on both Player and Enemy.
- This is much more accurate and performant for rounded characters than full mesh collision at this stage.
- Avoid heavy exact mesh-vs-mesh collision (too expensive and unnecessary right now).

#### Collision rules

**Original requirements:**
- Enemy vs. Enemy: Enemies must not overlap. An enemy can only move to a new position if that movement does not result in a collision with another enemy.
- Enemy vs. Player: Enemies must not overlap with the player. The player should only move if the intended new position is clear of enemy collisions.
- Provide a separate constant to control the minimum distance required to trigger a collision.

**Enhanced & better feeling rules:**

1. **Enemy vs Enemy**
    - Enemies should gently push each other apart or simply refuse to move into each other.
    - Prefer a soft separation feel rather than hard freezing.
    - If two enemies are too close, apply a small push-away force instead of completely blocking movement (feels more natural).

2. **Enemy vs Player**
    - Enemies should not be able to walk through the player.
    - When an enemy collides with the player, it should stop or slide along the player rather than overlapping.
    - Later this collision will also be used to damage the player (prepare the structure cleanly).

3. **Player movement**
    - Before applying the player’s next jump/move position, check against all enemies.
    - Only allow the move if the landing position is clear.

4. **Constants**
```js
const PLAYER_COLLISION_RADIUS = 18;
const ENEMY_COLLISION_RADIUS = 14;
const MIN_SEPARATION = 32;          // minimum center-to-center distance
```

#### Integration

**Original requirements:**
- Perform all collision checks during the position update phase within the animation loop.
- Only update an object's coordinates if the intended next position is validated as "collision-free."

**Enhanced integration (cleaner & more professional):**

- Create a reusable helper function:
  ```js
  function isColliding(posA, radiusA, posB, radiusB)
  ```
  or
  ```js
  function getSeparationVector(posA, posB)
  ```

- Recommended update order inside the animation loop:
    1. Calculate intended new positions (player + enemies)
    2. Resolve Enemy vs Enemy collisions
    3. Resolve Enemy vs Player collisions
    4. Apply final validated positions

- Prefer **separation-based** resolution over pure rejection when possible (feels smoother).
- Keep everything frame-rate independent.

#### Extra Polish (Strongly Recommended)
- When two enemies collide, give a very subtle bounce / push effect.
- When an enemy hits the player, prepare a hook for future damage or knockback.
- Debug mode (optional): draw simple circles on the ground showing collision radii (helpful while tuning).

#### Code Quality Rules
- Keep collision logic in a clean, reusable place (not deeply nested inside movement code).
- Avoid checking every object against every other object in a naive O(n²) way if the number grows large (for now it’s acceptable, but structure it cleanly).
- Use named constants — no magic numbers.
- Make the system easy to extend later (for projectiles, power-ups, etc.).

---

**Final Goal:**
Collisions should feel solid and fair.  
Characters should never visibly overlap.  
Movement should still feel smooth — not sticky or jittery.  
The system must be simple enough to understand and extend.