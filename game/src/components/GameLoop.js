// Game loop: central animation frame handler that updates all game systems
// in the correct order. Extracted from main.js for clarity.

import { GameState } from './GameState.js';

export function createGameLoop({
  renderer, scene, camera,
  health, particles, damageNumbers, audio,
  gameManager, difficulty, enemyManager, attack,
  movement, dash, player, powerUps, score, combo,
  obstacles, environment, menus,
  sky, skyMaterial,
  screenShake, cameraFollow,
  lightTarget, directionalLight,
  resolveEnemyVsEnemy, resolveEnemyVsObstacles,
  resolveEnemyVsPlayer, resolvePlayerVsObstacles,
  PLAYER_VS_ENEMY_DIST
}) {
  let previousTime = performance.now();

  function animate(currentTime) {
    requestAnimationFrame(animate);
    const delta = Math.min((currentTime - previousTime) / 1000, 0.1);
    previousTime = currentTime;

    const effectiveDelta = attack.getHitStopDelta(delta);

    // Always-on systems
    health.update(delta);
    particles.update(delta);
    damageNumbers.update(delta, camera);
    audio.update && audio.update(delta);
    if (gameManager.getFlashTimer() > 0) {
      gameManager.setFlashTimer(Math.max(0, gameManager.getFlashTimer() - delta));
    }

    if (gameManager.currentState() === GameState.PLAYING) {
      if (gameManager.checkPlayerEnemyContact(PLAYER_VS_ENEMY_DIST)) {
        // damage handled inside health onChange
      }
      difficulty.setScore(score.getScore());
      const d = difficulty.get();
      enemyManager.setSpawnInterval(d.spawnInterval);
      enemyManager.setSpeedMultiplier(d.enemySpeed / 16);
      enemyManager.setDifficulty(d.difficulty);
      attack.setCooldown(d.attackCooldown);
      attack.setRadius(d.attackRadius);

      if (gameManager.getSpeedBoostRemaining() > 0) {
        gameManager.setSpeedBoostTimer(Math.max(0, gameManager.getSpeedBoostRemaining() - delta));
        movement.setSpeedMultiplier(gameManager.getSpeedBoostRemaining() > 0 ? gameManager.SPEED_BOOST_MULT : 1);
      }

      // Long-attack boost: tick down the timer and re-apply the boosted
      // radius AFTER the difficulty set so it never desyncs.
      if (gameManager.getAttackBoostRemaining() > 0) {
        gameManager.setAttackBoostTimer(Math.max(0, gameManager.getAttackBoostRemaining() - delta));
        if (gameManager.getAttackBoostRemaining() > 0) {
          attack.setRadius(gameManager.getBoostedAttackRadius());
        }
      }

      movement.update(effectiveDelta);
      // Apply dash after normal movement for this frame, while Movement's
      // translate() shifts the active interpolation anchors to preserve it.
      dash.update(delta);
      movement.applySquashStretch();
      player.setMoving(movement.isCurrentlyMoving());

      enemyManager.update(effectiveDelta, currentTime / 1000);

      // Footstep dust when moving on the ground
      if (movement.isCurrentlyMoving()) {
        if (Math.random() < 0.25) {
          particles.spawnDust(player.group.position.x, player.group.position.y, 0);
        }
      }

      const enemies = enemyManager.getEnemies();
      const obstacleList = obstacles.getObstacles();
      resolveEnemyVsEnemy(enemies);
      resolveEnemyVsObstacles(enemies, obstacleList);
      resolveEnemyVsPlayer(enemies, player.group.position);
      resolvePlayerVsObstacles(player.group.position, obstacleList);

      combo.update(delta);
      gameManager.tickComboHud();

      powerUps.update(delta, currentTime / 1000, gameManager.onPowerUpPickup);
      score.tick(delta);
      score.render();
    } else if (gameManager.currentState() === GameState.PAUSED) {
      // Nothing simulates; only visual systems run
    } else if (gameManager.currentState() === GameState.GAMEOVER) {
      // Player.update still runs (idle continues at game-over) for the body
    }

    // Environment always runs (day/night keeps cycling through pause/over)
    const environmentState = environment.update(delta);
    menus.setEnvironmentMode(environmentState.label, environment.getMode());

    // Sky dome follows the player so the gradient is always centered.
    sky.position.set(
      player.group.position.x,
      player.group.position.y,
      player.group.position.z
    );
    // Tint sky by day/dusk factor if the environment exposes one.
    if (environmentState && typeof environmentState.skyTopColor === 'number') {
      skyMaterial.uniforms.topColor.value.setHex(environmentState.skyTopColor);
      skyMaterial.uniforms.bottomColor.value.setHex(environmentState.skyBottomColor);
    }

    // Pond animation (ripple expands, lily pads bob). Always runs.
    if (obstacles.updatePond) obstacles.updatePond(delta);

    // Player visual update always runs (idle breathing continues during game over)
    player.update(delta);
    attack.updateVisual(delta);

    // Anchor directional light to player
    lightTarget.position.copy(player.group.position);
    lightTarget.position.z = 0;
    directionalLight.position.set(
      player.group.position.x - 140,
      player.group.position.y - 160,
      280
    );

    // Camera follow + screen shake offset
    // Dev-only escape hatch so headless QA scripts can pose the camera
    // without it snapping back. No-op unless explicitly toggled.
    if (!(import.meta.env.DEV && window.__testFreezeCamera)) {
      cameraFollow.update(delta);
    }
    const shake = screenShake.getIntensity();
    if (shake > 0) {
      const off = screenShake.update(delta, null);
      // Save camera position, apply shake offset temporarily, render, then restore
      const savedX = camera.position.x;
      const savedY = camera.position.y;
      const savedZ = camera.position.z;
      camera.position.x += off.x;
      camera.position.y += off.y;
      camera.position.z += off.z;
      renderer.render(scene, camera);
      camera.position.x = savedX;
      camera.position.y = savedY;
      camera.position.z = savedZ;
      return;
    }
    renderer.render(scene, camera);
  }

  return { animate };
}
