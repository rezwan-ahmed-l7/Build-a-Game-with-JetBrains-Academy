To make the game exciting, we need to define the stakes: what happens when our hero loses?

To help you, we’ve prepared the agent prompt with the technical details needed to manage game states, detect collisions, and reset the game.

Here are the key points to focus on:

### Game Over condition
The game ends the moment an enemy touches our hero. This means we should constantly check for collisions between the player and the monsters. If a collision is detected, we immediately trigger the "Game Over" state. This state should take priority over all other collision handling — once the hero is hit, nothing should "override" that outcome. 

One important detail: make sure this collision check runs continuously during gameplay so that enemies can trigger a "Game Over" even if the player isn’t moving.

### Game Over state
When the player loses, the world should stop in its tracks. Display a "Game Over" overlay so the player instantly knows the run has ended.

At the same time, the hero should disappear (either by removing the player object or making it invisible). All enemies should stop moving, and any further player actions (like movement and attacks) must be disabled. The game should feel "frozen".

### Reset logic
A loss isn't the end — it's an invitation to try again. We'll use the **Space** key to reset the game. When **Space** is pressed in the "Game Over" state, the game should reset the player back to the starting position, clear all existing enemies and respawn them at the map corners, reset the score and update the UI, remove the "Game Over" message, and resume the game loop. This ensures everything feels fresh and ready for a new attempt.

### Putting it all together
Use the specification in the `spec.md` file to implement the "Game Over" flow. By the end of this task, an enemy touching the hero should trigger the "Game Over" message, hide the hero, and stop all enemy movement. Pressing **Space** should then reset the game, allowing you to play again immediately.

Experiment with the code manually or ask a coding agent to explore your customization options. Your result should look something like this:

![](images/game_over.gif)
