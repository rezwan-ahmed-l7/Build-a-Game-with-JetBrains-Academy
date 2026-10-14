### Specification for AI agent: Start, play, and Game Over

Implement clean and reliable game state management including "Game Over" conditions and full game reset.

#### Game States
Use a clear state system:
```js
const GameState = {
  PLAYING: "playing",
  GAMEOVER: "gameover"
};
let currentState = GameState.PLAYING;
```

#### Game Over condition
**Original requirements:**
- Check for collisions between the player and enemies.
- If a collision occurs, trigger the "Game Over" state.
- Handling the "Game Over" state should have higher priority than collision handling.
- Moving enemies should be able to collide with the player to trigger the "Game Over" state.

**Enhanced version:**
- Continuously check player vs enemy collisions during the `PLAYING` state.
- As soon as a collision is detected → immediately switch to `GAMEOVER` state.
- Game Over check must have higher priority than normal movement/collision resolution.
- Once in `GAMEOVER`, stop all further gameplay logic.

#### Game Over state
**Original requirements:**
- Display a "Game Over" overlay (a `div` with the class `game-over`).
- The player character should be removed or made invisible.
- Enemies should stop moving (stop updating their positions).
- Disable further player actions (e.g., movement and attack).

**Enhanced & better presentation:**
- Show a centered "Game Over" overlay with class `game-over`.
- Recommended content inside the overlay:
    - “Game Over”
    - Final Score
    - “Press SPACE to Restart”
- Hide or remove the player model.
- Completely stop enemy movement and spawning.
- Disable all player input (movement + attack).
- Optionally pause the score counting.

#### Reset logic
**Original requirements:**
- The Space key triggers a reset.
- Reset player position to the starting point.
- Clear all existing enemies and re-spawn them at the map corners.
- Reset the score and update the UI.
- Remove the "Game Over" overlay and resume the game loop.

**Enhanced reset (clean & reliable):**
When the player presses **Space** while in `GAMEOVER` state:

1. Reset `currentState` back to `PLAYING`
2. Reset player position to the original starting point `(0, 0, 0)`
3. Make the player visible again
4. Clear the entire enemies array and remove all enemy objects from the scene
5. Re-spawn the initial set of enemies at the corner spawn points
6. Reset the score to `0` and update the score UI
7. Hide/remove the Game Over overlay
8. Re-enable player controls
9. Resume normal game loop behavior

#### Extra Polish (Recommended)
- Add a short delay or fade when transitioning to Game Over (feels less abrupt).
- Show the final score clearly on the Game Over screen.
- Prevent the Space key from triggering an attack while in Game Over (it should only restart).
- Make sure multiple rapid Space presses don’t break the reset.

#### Code Quality Rules
- Keep all state management in one clear place.
- Never leave the game in a half-reset state.
- Make the transition between `PLAYING` ↔ `GAMEOVER` deterministic and bug-free.
- Use the state variable to guard updates (example: only move enemies if `currentState === "playing"`).

---

**Final Goal:**
The game must have clear and reliable states.  
Dying should feel definitive.  
Restarting should feel instant and clean.  
No leftover enemies, score bugs, or input issues after reset.