Finally, to keep the game interesting, we need to implement dynamic difficulty. As the player scores more points, the world should gently push back — enemies get bolder, faster, and more frequent, while our hero gains experience and grows stronger with every step.

We’ve prepared the agent prompt with the technical details needed to scale the challenge based on the current score.

Here are the key concepts for this step:

### Speed and pressure
As your score grows, the world should feel more intense. Enemies become harder to ignore, and our hero must react faster to stay in control. We’ll tune the overall pace by adjusting:
* `Enemy Spawn Delay`: Enemies appear more frequently.
* `Enemy Movement Speed`: Enemies move faster.
* `Player Movement Speed`: The hero also gets a slight speed boost.

### Attacks and responsiveness
If only the enemies got faster, the game would quickly feel unfair. To maintain balance, we’ll also give the hero a subtle boost to their attack mechanics so they can keep up with the rising pressure:
* `Player Attack Delay`: The hero's attack speed increases slightly.
* `Player Attack Distance`: The hero's attack range extends slightly.

### Scaling logic
Instead of sudden jumps in difficulty, we’ll implement gradual scaling. You’ll calculate a difficulty factor based on the current score and a growth speed constant, then apply that factor to scale game parameters linearly. One important detail: ensure enemy parameters scale slightly faster than the player’s. This ensures the hero never truly "outgrows" the threat, keeping the challenge alive as the score climbs.

### Animation loop integration
Dynamic difficulty only works if it stays up to date. Recalculate the difficulty factor and update your parameters within the animation loop on each frame. By using the current score to adjust speeds and delays for both enemy and player systems, you ensure the game smoothly adapts in real time as the player progresses.

### Putting it all together
Use the specification in the `spec.md` file to implement the dynamic difficulty system. It will recalculate the difficulty factor based on the current score and update spawn delays, movement speeds, and attack timing/range within the animation loop.

Please note that the "feel" of your game depends heavily on the ratio between these numbers. Experiment with these dependencies to find the perfect balance for your gameplay. Your result should look something like this:
![](images/speed.gif)
