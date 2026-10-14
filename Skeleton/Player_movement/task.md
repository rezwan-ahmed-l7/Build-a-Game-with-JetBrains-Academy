Now that our scene is set up and our hero is in place, it's time to bring them to life! 
In this task, we will implement keyboard-controlled movement with a simple jumping animation.

We've prepared the agent prompt with the technical specifications for the movement logic.

Here is what we’ll be focusing on:

### Input collection
To make Tode move, we need to listen for user input via the arrow keys.
Because players often press keys in quick succession, we’ll save these inputs to a queue. 
This ensures every move is processed in the order it was received, making the controls feel responsive and intentional.

### Movement logic & jump animation
A simple "teleport" from one point to another doesn't look very natural. 
To make the movement feel like a hop, we’ll use a bit of math:
- Progress Tracking: Each move tracks a progress value from 0 to 1.
- The "Jump" Effect: We use `Math.sin(progress * Math.PI)` to calculate the height (the Z-axis). This creates a parabolic arc, making Tode lift off the ground and land smoothly.
- Rotation: We’ll also ensure the player model rotates to face the direction of the move.

### The animation loop
The heart of any game is the **animation loop**. It creates the illusion of motion.
Since 3D objects don't move "on their own," you need a central place to recalculate their position, 
rotation, and animation many times per second. 

Usually, this function is synced with your monitor's refresh rate (typically 60 times per second) to ensure smooth, tear-free visuals.

Inside the Three.js animation loop, we will:
1. Check if the player is currently in motion.
2. If the player is idle, pull the next instruction from the input queue.
3. Update the movement progress and apply the calculated position and rotation to the player group.
4. Tell the renderer to draw the updated scene.

### Putting it all together
Use the specification in the `spec.md` file to implement the movement system. This will update your `Player.js` component and the main animation loop in `main.js`.

By the end of this task, you will be able to move your character around the screen using the arrow keys:

![](images/movement.gif)

### Customize it your way
The speed and jump distance are key to how your game feels to play. 
If the jump is too slow, the game feels sluggish; if it's too fast, the controls might feel twitchy and hard to manage. 
Try to find the right balance between jump speed, height, and distance. Small changes to these constants can completely transform the player's experience!
