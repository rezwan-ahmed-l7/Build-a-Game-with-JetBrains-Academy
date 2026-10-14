### Specification for AI agent: Attack system

Implement a satisfying and clear player attack mechanism.

#### Attack trigger
**Original requirements:**
- Add a listener for the Space key to trigger an attack.
- Implement an attack cooldown. Store it as a constant and initialize it with a default value of 1 second.

**Enhanced version:**
- Listen for the `Space` key (`keydown` event).
- Prevent the attack from triggering if the cooldown is still active.
- Create a clear cooldown system:
  ```js
  const ATTACK_COOLDOWN = 0.85; // seconds (slightly snappier than 1s feels better)
  let lastAttackTime = 0;
  ```
- Only allow a new attack when `currentTime - lastAttackTime >= ATTACK_COOLDOWN`.

#### Visual feedback
**Original requirements:**
- Visualize the attack using a small yellow circle (`THREE.CircleGeometry` with `MeshBasicMaterial`) around the player.
- The circle should appear briefly and then disappear or fade out.
- Place the circle on the ground plane (XY) at a small Z offset (z = 0.25).

**Enhanced & much better visual feedback:**
- Create a bright yellow attack circle using `THREE.CircleGeometry`.
- Recommended look:
    - Color: `0xffee55` or `0xffdd33` (punchy yellow)
    - Slight transparency (`opacity: 0.75 → 0`)
    - Render on top (disable depth write if needed)
- Animation:
    - Scale the circle from small → larger quickly (attack "pulse")
    - Fade out opacity at the same time
    - Total lifetime of the visual: ~0.25–0.35 seconds
- Position: centered on the player, slightly above the ground (`z = 0.3`)
- The visual must clearly communicate the attack range.

#### Combat logic
**Original requirements:**
- Detect collisions between the attack area and enemies.
- If an enemy is within the attack radius, remove it from the scene and delete from the tracking array.
- Store the attack radius as a constant.

**Enhanced combat logic:**
- Define a clear attack radius constant:
  ```js
  const ATTACK_RADIUS = 38;
  ```
- When the player attacks:
    1. Create the visual feedback.
    2. Check distance from player to every active enemy.
    3. If an enemy is within `ATTACK_RADIUS`, destroy it.
- On successful hit:
    - Remove the enemy from the scene.
    - Remove it from the enemies array.
    - (Optional but recommended) Add a small hit effect or scale punch on the enemy before removing it.
- Make the hit detection use the same circular distance check style as the collision system for consistency.

#### Extra Juice (Strongly Recommended)
- Slight camera shake or quick zoom punch when the attack hits at least one enemy.
- Short freeze-frame (hitstop) of 2–3 frames when killing an enemy (makes the attack feel powerful).
- Different feedback when the attack hits vs when it misses.

#### Code Quality Rules
- Keep attack logic clean and separated.
- Use delta time / performance.now() for cooldown tracking.
- Make radius and cooldown easy to tune.
- Clean up the attack visual (geometry + material) after it finishes to avoid memory leaks.
- Structure the code so adding sound effects or particle hits later is easy.

---

**Final Goal:**
The attack should feel responsive, readable, and satisfying.  
Players must clearly see the attack range and feel rewarded when they hit enemies.  
No ghost hits or unclear feedback.