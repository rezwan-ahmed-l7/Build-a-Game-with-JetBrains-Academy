- Make changes in the `game` directory only
- Don't look for or run tests
# agents.md — Project Instructions for AI Coding Agent

## Project Overview
You are assisting in building a polished 3D browser game called **"Tode the Frog"**.
The player controls a frog that must survive waves of enemies, attack them, and achieve the highest score possible.

**Tech Stack:**
- JavaScript (ES6+)
- Three.js (r170 or newer)
- GLTFLoader for 3D models
- Vite (or similar) as the build tool
- Modular architecture (separate files for Player, Enemy, Camera, Renderer, Game, etc.)

**Core Philosophy:**
- Clean, readable, maintainable code
- Strong separation of concerns
- Performance-conscious (especially in the animation loop)
- Visual quality matters — lighting, shadows, tone mapping, and atmosphere are not optional
- Always prefer clarity over cleverness

---

## General Coding Rules

1. **Modularity is mandatory**
    - Never put everything in `main.js`
    - Create separate files/modules for: Player, Camera, Renderer, Enemy, GameState, Input, etc.
    - Export clean functions or classes

2. **Naming**
    - Use clear, descriptive names (`createPlayer`, `updateEnemies`, `handleCollision`)
    - Avoid abbreviations unless they are extremely common

3. **Comments**
    - Only comment non-obvious logic
    - Do not write obvious comments like `// create scene`

4. **Three.js Best Practices**
    - Always enable shadows properly
    - Use `ACESFilmicToneMapping` + `SRGBColorSpace`
    - Set reasonable `pixelRatio` (max 2)
    - Dispose of geometries/materials when removing objects
    - Prefer `Group` for complex objects

5. **Performance**
    - Keep the animation loop clean
    - Avoid creating objects inside the loop
    - Use object pooling for enemies if many are spawned

6. **Error Handling**
    - When loading models, always handle loading errors gracefully
    - Log clear messages when something fails

---

## Design & Visual Direction

- Atmosphere: Dark, slightly cinematic, modern
- Background: Deep dark blue-black (`0x0f0f1a` or similar)
- Lighting: Three-point lighting (Key + Fill + Rim)
- Shadows: Soft and high quality (`PCFSoftShadowMap`, 2048 map size)
- Ground: Subtle, dark, receives shadows
- Overall feeling: Clean, stylish, not childish or flat

---

## Workflow Rules (Very Important)

When you receive a task:

1. First understand the full requirement
2. Plan the file structure if new files are needed
3. Implement cleanly
4. After implementing, verify:
    - Does it run without errors?
    - Does it match the visual/functional expectation?
    - Are shadows, lighting, and positioning correct?
5. If something looks wrong (wrong rotation, floating model, missing shadows, etc.), fix it immediately before moving on

Never leave broken or half-working code.

### Lesson Spec Isolation
- Each lesson contains exactly one `spec.md`. When the user names a specific lesson (e.g., 'Scene Setup'), the agent must use and implement only that lesson's `spec.md` without jumping to any other lessons or specs.

### Feature Verification
- Each feature implementation must be visible in the UI and verifiable. After implementing each feature from the scope, the agent must stop and ask the user to verify it before continuing.

### Rotation Plane
- Everything should rotate in the x-z plane. The y-axis is up; rotations should keep objects oriented on the horizontal ground plane.

---

## Specific Game Systems Expectations

### Player
- Must sit correctly on the ground (no floating)
- Correct rotation (`rotation.x = Math.PI / 2` for the model)
- Casts and receives shadows
- Smooth movement later

### Camera
- Child of the player group (so it can follow later)
- Good framing (slightly elevated isometric-style view)
- `up` vector set to `(0, 0, 1)`

### Enemies
- Spawn outside the visible area
- Move toward the player
- Proper collision
- Die cleanly when attacked

### Game Loop
- Clear states: `menu` → `playing` → `gameover`
- Score system
- Increasing difficulty over time

---

## Communication Style with Me

- When you finish a task, briefly tell me what you did
- If you are unsure about a design decision, ask instead of assuming
- If the specification is ambiguous, propose the best professional solution and explain why

---

## Final Principle

Write code as if this game will be shown to other developers and players.
It should look intentional, feel solid, and be easy to extend later.

Quality > Speed.
Clarity > Cleverness.
Polish > "It works".
```