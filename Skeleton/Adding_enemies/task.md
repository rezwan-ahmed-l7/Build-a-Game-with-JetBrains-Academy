Now that our hero can move, it's time to add some challenge! 
In this task, we'll populate the world with enemies that track and move toward the player.

To help you get started, we have added the technical requirements for the enemy logic to the agent prompt.

Here are the key goals:

### Enemy model
Just like the player, our enemies need a physical presence. 
We'll create an `Enemy.js` component using the `enemy.glb` model.
Feel free to scale and rotate the model to get the exact look you want for your villains.

### Spawning logic
We don't want enemies appearing out of thin air right on top of the player.
Instead, we'll set up spawn points at the four corners of the map. Let's also implement a timer to spawn new enemies at regular intervals, keeping the pressure on.

### Enemy behavior: the chase
In every frame of the animation loop, each enemy needs to:
1. Calculate the direction toward the player's current position.
2. Update its coordinates to move one step closer.
3. Rotate to face the player so they look like they are actively hunting our hero.

Note: At this stage, enemies can overlap and don't inflict any damage yet.
We are focusing on the foundations of movement and spawning first!

### Putting it all together
Use the specification in the `spec.md` file to implement the enemy system. It will create the `Enemy.js` component and update the main loop in `main.js` to manage the collection of enemies.

By the end of this task, you should see enemies appearing at the corners and converging on Tode's position:

![](images/enemies.gif)

### Customize the difficulty
The feel of the game changes drastically based on just two numbers:
- Spawning Delay: How often do new enemies appear?
- Movement Speed: How fast can they run?

Try tweaking these constants! A high spawn rate with slow enemies creates a "horde" feel, while a few very fast enemies create a tense "hunter" vibe.

We used a ready-made 3D model `enemy.glb`: Armabee Evolved by Quaternius [Public Domain](https://creativecommons.org/publicdomain/zero/1.0/) via [Poly Pizza](https://poly.pizza/m/GcttdvsqsQ).

You can use it for now or replace it with your own creation later.
