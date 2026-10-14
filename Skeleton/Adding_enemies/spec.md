### Specification for AI agent: Adding enemies

Implement a polished, fun, and slightly threatening enemy spawning + behavior system.

#### Enemy model
In the `components` directory, create an `Enemy.js` file with the following implementation:

**Original requirements (keep these):**
- Load the enemy model `enemy.glb` from `public/models/`.
- Positioning:
  - Calculate the Z offset based on the height of the model to position the model on top of the ground.
  - Apply a rotation of `model.rotation.x = Math.PI / 2;`.
- Set the model scale using a scalar of `5`.

**Enhanced additions (must implement):**
- Create a clean `createEnemy()` function that returns a `THREE.Group`.
- After loading the model:
  - Enable shadows on all meshes:
    ```js
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    ```
  - Make sure the enemy sits correctly on the ground (no floating).
- Give each enemy a unique slight random scale variation (±10%) so they don’t all look identical.
- Optional but recommended: slight random tint/color variation on the material for visual variety.

#### Spawning logic

**Original requirements:**
- Define four spawn locations at the corners of the map.
- Implement a mechanism to spawn enemies periodically or at the start. Store the spawning delay as a constant.
- Ensure the spawned enemies are added to the `THREE.Scene`.

**Enhanced & more exciting version:**
- Spawn points should be slightly outside the visible play area (so enemies “enter” the scene dramatically).
- Use a spawn timer system with a clear constant (`SPAWN_INTERVAL`).
- Start with a small number of enemies and gradually increase spawn rate over time (this creates rising tension).
- When an enemy spawns:
  - Slightly randomize the exact spawn position around the corner (so they don’t always appear in the exact same spot).
  - Give a short “spawn-in” effect (scale from 0 → full size quickly, or fade-in if possible).
- Keep a clean array of active enemies (`enemies = []`).

Recommended constants:
```js
const SPAWN_INTERVAL = 2.2;     // seconds between spawns (can decrease over time)
const MAX_ENEMIES = 12;         // hard limit so the game doesn’t explode
const ENEMY_SPEED = 18;         // base movement speed
```

#### Enemy behavior

**Original requirements:**
- In the animation loop, update each enemy's position so it moves toward the player's current coordinates.
- Rotate enemies to face the player while moving (update enemy rotation each frame based on the direction vector in the XY plane).
- Store the enemy's moving speed as a constant.
- At this stage, enemies can overlap with each other and the player.

**Enhanced behavior (much more fun):**
- Enemies should move smoothly toward the player using a normalized direction vector.
- Add a tiny bit of “wobble” or personality in movement (very subtle sine-based offset) so they don’t feel like robots.
- Rotation must be smooth — enemies should turn toward the player instead of instantly snapping.
- Slightly different speeds between enemies (randomize speed ±15% when spawning) so the pack feels more natural.
- When an enemy gets very close to the player, it can move a bit more aggressively (optional intensity boost).

#### Visual & Feel Polish
- Enemies should feel like a real threat, not just floating objects.
- They should clearly face the player at all times.
- Spawning should feel intentional and a bit scary/fun.
- Keep performance in mind — don’t create unnecessary objects every frame.

#### Code Quality Rules
- Keep enemy logic modular (`Enemy.js` + clean update function).
- Use a proper array to manage all active enemies.
- Make movement frame-rate independent (use delta time).
- Clean up / remove enemies later when they die (prepare the structure now).
- Do not leave magic numbers — use named constants.

---

**Final Goal:**
Enemies should feel alive, slightly unpredictable, and threatening.  
Spawning should create rising pressure.  
Movement and rotation should look smooth and intentional — like a modern action game, not a basic prototype.