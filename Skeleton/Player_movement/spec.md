### Specification for AI agent: Player movement

Implement a polished, modern, and satisfying player movement system featuring smooth jump animation controlled by keyboard input.

#### Input collection
- Use `addEventListener` to capture keyboard events for the arrow keys (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`).
- Maintain a clean input queue to store pending inputs.
- Prevent default browser behavior for arrow keys.
- Support both keydown (to queue moves) and ignore rapid repeated keydown events while a jump is already in progress (to keep control tight and intentional).

#### Movement state & logic
- Track the current movement state clearly:
    - `direction` (forward, backward, left, right)
    - `progress` (0 to 1)
    - `isMoving` / completion status
- Implement smooth jump arc using `Math.sin(progress * Math.PI)` to adjust the player's height on the Z-axis.
- Update the player's position and rotation based on the current move.
- Store these as clear constants (easy to tweak later):
    - `MOVE_SPEED`
    - `JUMP_HEIGHT`
    - `JUMP_DISTANCE`
- Keep a reference to the loaded model object and rotate **that model** rather than rotating the entire player group (important for correct visual orientation).

#### Enhanced Feel & Polish (Must Implement)

**1. Smooth & Satisfying Jump**
- The jump should feel bouncy and responsive, not floaty or robotic.
- Use easing on the horizontal movement as well (not only vertical) so the whole motion feels fluid.
- Slight squash & stretch on the model during jump is highly recommended for modern game feel:
    - On takeoff → slightly stretch
    - At peak → normal
    - On landing → slight squash then recover

**2. Rotation & Facing**
- The frog must smoothly face the direction it is jumping toward.
- Use clean rotation on the model (`rotation.z` or appropriate axis) so it always looks where it’s going.
- Avoid instant snapping — make the turn feel natural.

**3. Landing Feedback**
- When the jump completes (progress reaches 1), give subtle landing feedback:
    - Small scale punch (quick squash)
    - Optional: tiny camera shake or subtle visual pulse later if desired

**4. Input Buffering**
- Allow one next move to be queued while the current jump is still happening.
- This makes the controls feel more responsive and modern (common in polished action games).

**5. Constants (Recommended starting values)**
```js
const MOVE_DISTANCE = 40;      // how far one jump travels
const JUMP_HEIGHT = 28;        // peak height of the jump
const JUMP_DURATION = 0.38;    // seconds (feels snappy)
```

#### Animation loop integration
Inside `setAnimationLoop` (or the main `animate` function):

- Process the input queue.
- Update movement progress using delta time (frame-rate independent).
- Update object transformation (position + rotation + optional squash/stretch).
- Only re-render when needed (but for simplicity, rendering every frame is acceptable at this stage).
- When a jump finishes, cleanly reset state and allow the next queued input to start.

#### Visual Direction for Movement
- Movement should feel **adventurous, bouncy, and alive**.
- The frog should have personality in how it jumps — not just sliding from A to B.
- Keep the motion readable and satisfying even when jumping quickly in different directions.

#### Code Quality Rules
- Keep movement logic clean and separated (preferably in its own module or clearly organized section).
- Do not hardcode magic numbers without naming them as constants.
- Make sure the model rotation stays correct after every jump.
- Ensure the player never floats or sinks into the ground after landing.

---

**Final Goal of this system:**
The player should feel fun and responsive to control.  
Every jump should feel intentional, smooth, and slightly juicy — like a modern indie game, not a basic prototype.