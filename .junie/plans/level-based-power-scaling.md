---
sessionId: session-261017-114045-9hs9
---

# Requirements

### Overview
Level বৃদ্ধির সাথে frog-এর power, power-up-এর quality, আর নতুন power-up types unlock হবো — যেন higher level-এ খেলা আরো satisfying হয়।

### Frog Stat Scaling
| Level | Max HP | Attack Damage | Attack Cooldown | Move Speed | Dash Cooldown |
|---|---|---|---|---|---|
| Lv. 1-2 | 3 | 1 | 0.85s | 1.0x | 3.0s |
| Lv. 3-4 | 4 | 1 | 0.75s | 1.1x | 2.5s |
| Lv. 5-6 | 5 | 1 | 0.65s | 1.2x | 2.0s |
| Lv. 7-8 | 5 | 2 | 0.65s | 1.2x | 2.0s |
| Lv. 9+ | 6 | 2 | 0.55s | 1.3x | 1.5s |

### Power-Up Quality Scaling
| Power-Up | Lv. 1-2 | Lv. 3-4 | Lv. 5-6 | Lv. 7+ |
|---|---|---|---|---|
| Heal | +1 HP | +1 HP | +2 HP | +2 HP |
| Score | +8 Bonus | +15 Bonus | +25 Bonus | +40 Bonus |
| Speed | 1.7x for 8s | 1.8x for 10s | 2.0x for 10s | 2.0x for 12s |
| Attack | 1.85x radius 10s | 2.0x radius 12s | 2.2x radius 12s | 2.2x radius 15s |

### New Power-Up Types
| Level Unlock | Type | Effect |
|---|---|---|
| Lv. 3 | 🛡️ Shield | 5s invincibility |
| Lv. 5 | ⚡ Double Attack | 8s, 2x damage per attack |
| Lv. 7 | 🌀 Magnet | 10s, auto-pickup radius 50 units |
| Lv. 9 | 💀 Freeze | 3s, all enemies frozen |

### Level-Up Feedback
- Floating text "⬆ Lv. 2!" with particle burst
- Audio feedback (level-up chime)
- Level badge bump animation

# Technical Design

### Current Implementation
- `Score.js`: `getLevel()` function exists but is **not exported**; only used internally for UI display
- `GameManager.js`: No awareness of level; all stats are static
- `Health.js`: Fixed max HP=3, no way to change per level
- `Attack.js`: Fixed cooldown=0.85s, fixed damage=1
- `Movement.js`: Fixed speed multiplier, no level-based scaling
- `Dash.js`: Fixed cooldown=3s
- `PowerUp.js`: 4 types (heal, score, speed, attack) with fixed effects
- `PowerUpManager.js`: Fixed spawn weights, no level awareness

### Key Decisions
- **Level as a central signal**: `Score.js` will export `getLevel()` and a `LEVEL_STATS` config. `GameManager.js` will read level on game start and on level-up, then apply stats to all subsystems.
- **No runtime stat changes during gameplay**: Stats are set at game start based on current level. Level-up mid-game will trigger a floating notification but stats apply next game (to avoid mid-game power spikes).
- **New power-up types unlocked gradually**: Spawn weights in `PowerUpManager.js` will be level-aware — new types only appear at their unlock level.
- **Effect scaling in GameManager**: Instead of hardcoding values in `onPowerUpPickup()`, a `getPowerUpEffect(type, level)` function will return scaled values.

### Proposed Changes

**Score.js**:
- Export `getLevel(score)` function
- Export `LEVEL_THRESHOLDS` constant
- Add `onLevelUp` callback support

**GameManager.js**:
- Import `getLevel` from Score.js
- Track current level, detect level-up during gameplay
- On game start: apply level-based stats to Health, Attack, Movement, Dash
- On power-up pickup: use level to scale effect values
- On level-up: trigger visual/audio feedback

**Health.js**:
- Accept `max` parameter dynamically via `setMax(max)` method
- GameManager will call `setMax()` based on level

**Attack.js**:
- Add `setDamage(amount)` method
- Cooldown already configurable via `setCooldown()`

**Movement.js**:
- Base speed multiplier will be set by GameManager based on level

**Dash.js**:
- Add `setCooldown(seconds)` method

**PowerUpManager.js**:
- Add `setLevel(level)` method
- Spawn weights will adjust based on level (new types unlock at Lv. 3, 5, 7, 9)

**PowerUp.js**:
- Add 4 new types: `shield`, `doubleAttack`, `magnet`, `freeze`
- Each with unique 3D shape builder
- Dynamic `desc` field based on level

**style.css**:
- Level-up floating text animation
- Level badge bump animation on level change

### Architecture Diagram
```mermaid
graph LR
    S[Score.js] -->|export getLevel| GM[GameManager.js]
    GM -->|applyLevelStats| H[Health.js]
    GM -->|applyLevelStats| A[Attack.js]
    GM -->|applyLevelStats| M[Movement.js]
    GM -->|applyLevelStats| D[Dash.js]
    GM -->|setLevel| PUM[PowerUpManager.js]
    PUM -->|level-based weights| PU[PowerUp.js]
    GM -->|getPowerUpEffect(type,level)| E[Effect Calculation]
    S -->|onLevelUp callback| GM
```

### File Structure
- **Modified**: `Score.js`, `GameManager.js`, `Health.js`, `Attack.js`, `Movement.js`, `Dash.js`, `PowerUpManager.js`, `PowerUp.js`, `style.css`
- **No new files needed** — all changes are extensions of existing modules

# Delivery Steps

### ✓ Step 1: Export level system and add level-up feedback
Score.js-এ `getLevel()` export করব, `onLevelUp` callback যোগ করব। GameManager.js-এ level tracking যোগ করব, level-up detect করলে floating text + particle burst + audio feedback trigger করব। style.css-এ level-up animation যোগ করব।

### ✓ Step 2: Scale frog stats by level
GameManager.js-এ game start-এ level-ভিত্তিক stats apply করব। Health.js-এ `setMax()` method যোগ করব (Lv.1-2: 3HP, Lv.3-4: 4HP, Lv.5-6: 5HP, Lv.7+: 6HP)। Attack.js-এ `setDamage()` method যোগ করব (Lv.7+: 2x damage)। Attack cooldown, movement speed, dash cooldown সব level-এ scale করব।

### ✓ Step 3: Scale power-up effects by level
GameManager.js-এ `getPowerUpEffect(type, level)` function যোগ করব। Heal, Score, Speed, Attack — সব power-up-এর effect level-এর ওপর ভিত্তি করে stronger হবো। PowerUpManager.js-এ `setLevel()` method যোগ করব।

### ✓ Step 4: Add 4 new power-up types
PowerUp.js-এ 4 নতুন type যোগ করব: Shield (🛡️ circle shape, 5s invincibility), Double Attack (⚡ double lightning, 8s 2x damage), Magnet (🌀 spiral, 10s auto-pickup), Freeze (❄️ snowflake, 3s enemy freeze)। PowerUpManager.js-এ spawn weights level-aware করব — Lv.3: Shield unlock, Lv.5: Double Attack, Lv.7: Magnet, Lv.9: Freeze। GameManager.js-এ নতুন types-এর handling logic যোগ করব।