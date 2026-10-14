### Specification for AI agent: Score

Implement a clear, satisfying, and well-presented scoring system that rewards both survival time and enemy defeats.

#### Score UI
**Original requirements:**
- Create a `div` element with the class `score` to display the current score.
- Position it at the top of the screen via CSS.
- Update the text content whenever the score changes.

**Enhanced version:**
- Create a `div` with class `score`.
- Style it cleanly and modernly:
    - Position: top center or top left
    - Large, readable font
    - Slight text shadow or glow for better visibility on dark background
    - Color: bright and clear (e.g. white or soft yellow)
- Example structure:
  ```html
  <div class="score">Score: 0</div>
  ```
- Update the text every time the score changes (prefer `Score: 123` format).
- Make sure the UI stays fixed on screen and does not interfere with gameplay.

#### Scoring logic
**Original requirements:**
- Survival: Add 1 point for every 10 seconds (or 0.1 points per second) the player stays alive.
- Kills: Add 10 points for each enemy defeated.
- Use a `Clock` to track elapsed time and update the score in the animation loop.

**Enhanced & better balanced version:**
- Use `THREE.Clock` (or `performance.now()`) to track time.
- Scoring rules:
    - **Survival**: Continuously add points based on time alive.
    - **Kills**: Instantly add points when an enemy is defeated.

Recommended constants:
```js
const SCORE_PER_SECOND = 1;     // 1 point per second alive (cleaner than 0.1)
const SCORE_PER_KILL = 15;      // slightly more rewarding than 10
```

- Update the score inside the animation loop using delta time so it stays frame-rate independent.
- When an enemy is killed, immediately add `SCORE_PER_KILL` to the total score.
- Always display the score as a whole number (use `Math.floor()`).

#### Implementation details
**Original requirements:**
- Define constants for `SCORE_PER_SECOND` and `SCORE_PER_KILL`.
- Ensure the displayed score is rounded down.

**Extra polish (strongly recommended):**
- Add a short visual feedback when the player gains points from a kill (e.g. the score briefly scales up or flashes).
- Keep a separate `highScore` variable (even if not shown yet) so it can be used later in the Game Over screen.
- Make the score update smooth and readable — avoid flickering.

#### Code Quality Rules
- Keep score logic clean and centralized.
- Do not scatter score calculations across multiple files.
- Use named constants only.
- Make it easy to later add multipliers, combos, or bonuses.

---

**Final Goal:**
The score should feel rewarding and clear.  
Players should immediately understand that both surviving longer and killing enemies increase their score.  
The UI must be clean, readable, and stylish.