# Game World Specification — Forest Theme

## Overview
This document defines the game world: sky, lighting, ground, obstacles, and integration.
The world is a **dark, atmospheric forest** matching the game's cinematic + tense mood.
All elements follow a **Z-up coordinate system**.

---

## 1. Sky

**File:** `components/Sky.js`

### Requirements
- Large inverted sphere (radius ~500), `THREE.BackSide`.
- Vertical gradient shader material:
  - Top: deep navy `#0a0f1f`
  - Horizon: muted teal-purple `#1a2a3a`
  - Bottom: near-black `#05080d`
- Add a soft glowing **moon** (sprite or emissive sphere).
- Optional: **star field** using `THREE.Points` on the upper hemisphere.
- Optional: slow-drifting dark cloud sprites.

### Notes
- Sky must not overpower the fog or lighting.
- Sky color should blend with the fog color at the horizon.

---

## 2. Lighting

**File:** `components/Lighting.js`

### Requirements
- **AmbientLight** — cool blue `#2a3a5a`, intensity ~0.25
- **DirectionalLight (moonlight)** — `#8ab4d8`, intensity ~0.6, casts shadows
- **HemisphereLight** — sky `#1a2a3a`, ground `#0a1510`, intensity ~0.3
- **Teal rim light** — `#3affd0`, low intensity, positioned opposite the moon
- **Firefly points** — 10–15 small emissive spheres with gentle bobbing and flicker

### Notes
- Shadows: `PCFSoftShadowMap`, resolution 2048.
- Total light intensity must stay **dark and moody** — never bright daylight.

---

## 3. Ground (Forest Floor)

**File:** `components/Ground.js`

### Requirements
- Large plane (200×200), subdivided for subtle displacement.
- **Material:** `MeshStandardMaterial`
  - Base color: deep green-brown `#1a2a1a`
  - `roughness: 1`, `metalness: 0`
  - Procedural noise texture with low-contrast patches:
    - Dark moss `#0f1f12`
    - Lighter soil `#2a3a22`
- Optional: vertex displacement via simplex noise for gentle bumps.
- Optional: grass tufts (InstancedMesh) near the player area.

### Notes
- **No checkerboard.** No bright green. Everything muted and moody.
- Ground must blend into the fog at distance.

---

## 4. Obstacles

### 4.1 Trees — `components/Tree.js`

#### Requirements
- Low-poly tree:
  - Trunk: cylinder, dark brown `#2a1a10`
  - Foliage: 2–3 stacked cones or icospheres, dark green `#0f2a15`
- Height: 3–6 units.
- Random Y rotation.
- Sit exactly on ground (`Z = 0`) via bounding box calculation.
- **Collision:** AABB or bounding sphere around the trunk (not foliage).
- Count: 15–25 trees.
- Placement: denser at the edges, sparser in the center clearing.

#### Notes
- Trees act as **cover** and **obstacles** for both player and enemies.

---

### 4.2 Rocks — `components/Rock.js`

#### Requirements
- Low-poly icosahedron, irregularly scaled, gray `#3a3a3a` with moss tint.
- Size: 0.5–2 units.
- Random rotation.
- Sit exactly on ground via bounding box.
- **Collision:** bounding sphere.
- Count: 8–12 rocks.

---

### 4.3 Ruins / Stumps — `components/Ruin.js` (Optional)

#### Requirements
- Broken stone pillars or old tree stumps.
- Count: 3–5.
- Same collision logic as rocks.
- Adds storytelling + extra cover.

---

## 5. Houses (Legacy / Optional)

**File:** `components/House.js`

> If the game later needs houses (e.g., a village zone), keep this spec.
> For the pure forest theme, houses are **optional** and can be replaced by ruins.

#### Requirements
- Use `small_house.glb` from `/models/` at scale `65`.
- Add 3 houses at random positions.
- Rotate all houses `Math.PI / 2` around the X-axis (Z-up alignment).
- Random Y rotation in multiples of `Math.PI / 2`.
- Snap to ground (`Z = 0`) via bounding box.
- **Collision:** houses vs entities, houses vs player.
- Neither enemies nor player can pass through.

---

## 6. Atmosphere

**File:** `components/Fireflies.js` (and fog config in `main.js`)

### Requirements
- **Fog:** `THREE.FogExp2`, color `#0a1a1a`, density ~0.015.
- **Fireflies:** 15–20 additive points, slow sine bobbing, subtle flicker.
- **Dust particles:** very subtle, slow drifting.
- Optional post-processing: vignette + slight teal shadow grade.

---

## 7. Player

**File:** `components/Player.js`

### Requirements
- Start position: center of clearing `(0, 0, 0)`.
- Movement: WASD / arrow keys, Z-up.
- Speed: base value, scales with difficulty (see difficulty spec).
- Model: frog (existing).
- **Collision:** trees, rocks, ruins, houses (if present).
- Camera: third-person follow, smooth lerp.

---

## 8. Enemies

**File:** `components/Enemy.js`

### Requirements
- Spawn from edges of the forest (outside tree ring).
- Move toward player.
- **Spawn timer:** accumulated with `clock.getDelta()`.
- **Speed & spawn rate scale with difficulty.**
- **Collision:** trees, rocks, ruins, houses, player.
- Visual: dark silhouette with faint glowing eyes.

---

## 9. Difficulty Integration

**File:** `components/Difficulty.js`

### Requirements
- Recalculate each frame from current score:
  - Enemy spawn delay ↓
  - Enemy speed ↑
  - Player speed ↑ (slightly)
  - Player attack delay ↓
  - Player attack range ↑ (slightly)
- Enemy parameters scale **slightly faster** than player.
- Apply safety caps so nothing breaks.


---

## 10. Integration in `main.js`

### Requirements
1. Create scene, camera, renderer.
2. Add `Sky`.
3. Add `Lighting`.
4. Create `Map` group:
  - Add `Ground`.
  - Scatter `Tree`s (15–25).
  - Scatter `Rock`s (8–12).
  - Scatter `Ruin`s (3–5).
  - (Optional) Load `House`s and add to map group.
5. Add `Player` at center.
6. Add `Fireflies`.
7. Configure fog.
8. Animation loop:
  - Update player movement.
  - Update enemies (spawn timer, movement, collision).
  - Update difficulty based on score.
  - Update fireflies and particles.
  - Render.

---

## 11. Style Summary

| Element    | Style                                          |
|------------|------------------------------------------------|
| Sky        | Dark gradient + moon + stars                   |
| Lighting   | Moonlight + teal rim + ambient                 |
| Ground     | Dark mossy noise, no checkerboard              |
| Trees      | Dark low-poly, collision                       |
| Rocks      | Gray, collision                                |
| Ruins      | Optional, collision                            |
| Houses     | Optional / legacy, collision                   |
| Fog        | Deep teal, atmospheric                         |
| Fireflies  | Additive glow, drifting                        |
| Mood       | Dark, tense, cinematic forest                  |

---

## 12. Notes for the AI Agent

- **Never** use bright green (`#90EE90`) or checkerboard for the forest theme.
- Always respect **Z-up**.
- Always snap objects to ground via bounding box.
- Always implement collision for trees, rocks, ruins, houses, player, and enemies.
- Keep the mood **dark, cinematic, and tense** — this is Tode the Frog's world.
