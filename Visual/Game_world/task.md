An empty map is a bit boring, don't you think? Let's add some objects to make the environment more interesting and – importantly – make running away from enemies a little more challenging!

We’ve prepared the agent prompt with the technical details needed to generate the map, place obstacles, and handle collisions.

Here is what we’ll be focusing on:

### Map background
Start by creating a simple but readable ground. Add a checkerboard floor made from a grid of tiles with alternating colors: Dark Green `#228B22` and Light Green `#90EE90`. This defines the "game space" and makes player movement much easier to track visually.

### Obstacles
Next, let’s add some character to the world. Create a `House.js` file using the `small_house.glb` model and place three houses at random positions on the map.

To ensure they sit correctly in our coordinate system, you'll need to: 
- Rotate each house by `Math.PI / 2` around the X-axis.
- Randomize the rotation around the Y-axis using multiples of `Math.PI / 2`.
- Ensure the houses sit exactly on the ground level (Z = 0), without floating or sinking. Use the model’s bounding box to calculate the correct offset.

Finally, implement collision detection so neither the player nor the enemies can walk through the walls.

### Integration
Once your map and houses are ready, connect everything in `main.js`. Initialize the map, add it to the scene, and then load the houses into the map group so the whole world stays neatly organized.

### Customize it your way
Once the basic world is working, feel free to make it more "yours". You can add trees, rocks, or extra buildings. You can also switch the floor to a grassy texture or a "blue-sky" tile style.

You can download free models from sites like [poly.pizza](https://poly.pizza/) or [Sketchfab](https://sketchfab.com/), generate your own using AI tools like Nano Banana, or even build them from scratch in Blender. Most models you download will come in very different sizes. If a model looks giant or tiny, don't worry! Use the model’s `scale` property when loading it and tweak the value manually until it fits the scene next to other objects.

Any new model can be added the same way as the houses: load it, set its scale and rotation, place it on the ground using its bounding box, and make sure it blocks movement with the same collision rules.

### Putting it all together
Use the requirements in the `spec.md` file to build the game world. It will help you build a tiled background, generate the houses with correct placement, and integrate everything into `main.js`.

Try changing the code manually or asking a coding agent to better understand your customization options. By the end of this step, your scene should look something like this:
![](images/game_world.gif)
> `small_house.glb` — Small House by Jarlan Perez [CC-BY](https://creativecommons.org/licenses/by/3.0/) via [Poly Pizza](https://poly.pizza/m/053kskrV4U_).

