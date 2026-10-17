import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5173';
const browserErrors = [];
// Spawn Vite directly rather than through npm so cleanup terminates the
// actual server process instead of leaving an orphaned child in CI.
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited early:\n${serverOutput}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite did not start in time:\n${serverOutput}`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    if (!request.url().startsWith('data:')) browserErrors.push(`Request failed: ${request.url()} — ${request.failure()?.errorText}`);
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.locator('#menu-start').waitFor({ state: 'visible', timeout: 10000 });
  } catch (error) {
    await page.screenshot({ path: 'browser-smoke-start.png' }).catch(() => {});
    const diagnostics = await page.evaluate(() => ({
      title: document.title,
      bodyText: document.body.innerText.slice(0, 1200),
      menuCount: document.querySelectorAll('#menu-start').length,
      canvasCount: document.querySelectorAll('canvas.game').length
    })).catch(() => ({}));
    throw new Error(`Start menu failed to render. Browser errors: ${browserErrors.join(' | ') || 'none captured'}. DOM: ${JSON.stringify(diagnostics)}. Original: ${error.message}`);
  }
  await page.locator('canvas.game').waitFor({ state: 'visible' });
  if (await page.locator('#boot-banner').count()) throw new Error('Temporary boot debug banner is still visible');

  // A clean CI browser has no saved profile. The Play button is intentionally
  // disabled until both a valid player name and a country flag are selected.
  // Set these through the real UI so the smoke test exercises the onboarding
  // flow instead of trying to click a disabled button.
  await page.locator('#profile-name').fill('SmokeTester');
  await page.locator('#profile-flag').click();
  await page.locator('.flag-cell[data-code="BD"]').click();
  await page.locator('#flag-confirm').click();
  await page.locator('#btn-start').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const button = document.querySelector('#btn-start');
    return button && !button.disabled;
  });

  await page.screenshot({ path: 'browser-smoke-start.png' });

  await page.locator('#btn-start').click();
  await page.locator('#menu-start').waitFor({ state: 'hidden' });
  await page.waitForTimeout(700);

  const before = await page.evaluate(() => ({
    x: window.__game.player.group.position.x,
    y: window.__game.player.group.position.y,
    state: window.__game.currentState()
  }));
  if (before.state !== 'playing') throw new Error(`Expected playing state after Play; got ${before.state}`);

  // The spawn point can be near an obstacle, so try available directions
  // rather than mistaking a correctly blocked step for broken input.
  let afterMove = null;
  let successfulDirection = null;
  for (const key of ['w', 's', 'a', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    const attemptStart = await page.evaluate(() => ({
      x: window.__game.player.group.position.x,
      y: window.__game.player.group.position.y
    }));
    await page.keyboard.press(key);
    await page.waitForTimeout(430);
    const attemptEnd = await page.evaluate(() => ({
      x: window.__game.player.group.position.x,
      y: window.__game.player.group.position.y
    }));
    if (Math.hypot(attemptEnd.x - attemptStart.x, attemptEnd.y - attemptStart.y) > 10) {
      afterMove = attemptEnd;
      successfulDirection = key;
      break;
    }
  }
  if (!afterMove) {
    const diagnostics = await page.evaluate(() => ({
      state: window.__game.currentState(),
      queuedInput: window.__game.input.peek(),
      heldDirection: window.__game.input.getHeldDirection(),
      movementActive: window.__game.movement.isCurrentlyMoving(),
      cameraBasis: window.__game.movement.getCameraBasis(),
      playerPosition: {
        x: window.__game.player.group.position.x,
        y: window.__game.player.group.position.y
      },
      obstacleCount: window.__game.obstacles.getObstacles().length
    }));
    throw new Error(`Player did not move in any of the eight keyboard directions. Diagnostics: ${JSON.stringify(diagnostics)}`);
  }

  await page.keyboard.down('w');
  await page.keyboard.press('Shift');
  let earlyDashPosition = afterMove;
  let earlyDashDistance = 0;
  // Headless software rendering may produce fewer frames than a desktop GPU.
  // Wait for an actual movement frame rather than assuming 60 ms guarantees one.
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(50);
    earlyDashPosition = await page.evaluate(() => ({
      x: window.__game.player.group.position.x,
      y: window.__game.player.group.position.y
    }));
    earlyDashDistance = Math.hypot(earlyDashPosition.x - afterMove.x, earlyDashPosition.y - afterMove.y);
    if (earlyDashDistance >= 5) break;
  }
  if (earlyDashDistance < 5) {
    const diagnostics = await page.evaluate(() => ({
      state: window.__game.currentState(),
      heldDirection: window.__game.input.getHeldDirection(),
      dashing: window.__game.dash.isDashing(),
      invulnerable: window.__game.dash.isInvulnerable(),
      position: {
        x: window.__game.player.group.position.x,
        y: window.__game.player.group.position.y
      }
    }));
    throw new Error(`Dash did not produce its expected quick burst; moved only ${earlyDashDistance.toFixed(2)} units. Diagnostics: ${JSON.stringify(diagnostics)}`);
  }
  await page.waitForTimeout(200);
  await page.keyboard.up('w');
  const afterDash = await page.evaluate(() => ({
    x: window.__game.player.group.position.x,
    y: window.__game.player.group.position.y
  }));

  // Spawn a controlled enemy so combat can be tested even on a slow
  // software-rendered browser where the automatic spawn timer advances slowly.
  const damageCheck = await page.evaluate(() => {
    const manager = window.__game.enemyManager;
    manager.spawnEnemy();
    const enemies = manager.getEnemies();
    const enemy = enemies[enemies.length - 1];
    const player = window.__game.player.group;
    enemy.group.position.set(player.position.x + 12, player.position.y, player.position.z);
    enemy.isSpawning = false;
    enemy.isDying = false;
    enemy.hp = 5;
    return { before: enemy.hp, index: enemies.length - 1 };
  });
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const hpAfterAttack = await page.evaluate((index) => window.__game.enemyManager.getEnemies()[index]?.hp ?? null, damageCheck.index);
  if (hpAfterAttack !== damageCheck.before - 1) {
    throw new Error(`Attack should reduce enemy HP by 1; expected ${damageCheck.before - 1}, got ${hpAfterAttack}`);
  }
  // Avoid letting the deliberately close test enemy interfere with later
  // pause/menu checks through normal player-contact damage.
  await page.evaluate((index) => {
    const enemy = window.__game.enemyManager.getEnemies()[index];
    if (enemy) {
      enemy.isDying = true;
      enemy.deathProgress = 0;
    }
  }, damageCheck.index);

  // Exercise both power-up effects through the same pickup handler used in play.
  const powerupPosition = await page.evaluate(() => ({
    x: window.__game.player.group.position.x,
    y: window.__game.player.group.position.y,
    z: window.__game.player.group.position.z
  }));
  const baseAttackRadius = await page.evaluate(() => window.__game.attack.getRadius());
  await page.evaluate((position) => window.__game.onPowerUpPickup('attack', position), powerupPosition);
  const boostedAttackRadius = await page.evaluate(() => window.__game.attack.getRadius());
  if (boostedAttackRadius <= baseAttackRadius * 1.8) {
    throw new Error(`Attack power-up failed to expand radius: ${baseAttackRadius} -> ${boostedAttackRadius}`);
  }
  await page.evaluate((position) => window.__game.onPowerUpPickup('speed', position), powerupPosition);
  const speedMultiplier = await page.evaluate(() => window.__game.movement.getSpeedMultiplier());
  if (speedMultiplier <= 1) throw new Error(`Speed power-up did not increase movement speed: ${speedMultiplier}`);

  await page.keyboard.press('Escape');
  await page.locator('#menu-pause').waitFor({ state: 'visible' });
  await page.locator('#btn-resume').click();
  await page.locator('#menu-pause').waitFor({ state: 'hidden' });

  // Pause during an active dash and ensure the player stays still.
  await page.waitForTimeout(900);
  const beforePauseDash = await page.evaluate(() => ({
    x: window.__game.player.group.position.x,
    y: window.__game.player.group.position.y
  }));
  await page.keyboard.down('w');
  await page.keyboard.press('Shift');
  let pauseDashDistance = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(50);
    const position = await page.evaluate(() => ({
      x: window.__game.player.group.position.x,
      y: window.__game.player.group.position.y
    }));
    pauseDashDistance = Math.hypot(position.x - beforePauseDash.x, position.y - beforePauseDash.y);
    if (pauseDashDistance >= 5) break;
  }
  if (pauseDashDistance < 5) throw new Error('Could not observe dash movement before pause');
  await page.keyboard.press('Escape');
  await page.locator('#menu-pause').waitFor({ state: 'visible' });
  const pausedInput = await page.evaluate(() => ({
    held: window.__game.input.getHeldDirection(),
    queued: window.__game.input.peek()
  }));
  if (pausedInput.held !== null || pausedInput.queued !== undefined) {
    throw new Error(`Movement input was not cleared on pause: ${JSON.stringify(pausedInput)}`);
  }
  const pausedPosition = await page.evaluate(() => ({
    x: window.__game.player.group.position.x,
    y: window.__game.player.group.position.y
  }));
  await page.waitForTimeout(350);
  const stillPausedPosition = await page.evaluate(() => ({
    x: window.__game.player.group.position.x,
    y: window.__game.player.group.position.y
  }));
  await page.keyboard.up('w');
  if (Math.hypot(stillPausedPosition.x - pausedPosition.x, stillPausedPosition.y - pausedPosition.y) > 0.5) {
    throw new Error('Player continued moving while paused during a dash');
  }
  await page.locator('#btn-resume').click();
  await page.locator('#menu-pause').waitFor({ state: 'hidden' });

  const modeBefore = await page.locator('.environment-mode').innerText();
  await page.locator('.cycle-button').click();
  let modeAfter = modeBefore;
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(50);
    modeAfter = await page.locator('.environment-mode').innerText();
    if (modeAfter !== modeBefore) break;
  }
  if (modeBefore === modeAfter) throw new Error('Day/night mode label did not change after cycling environment');

  await page.screenshot({ path: 'browser-smoke-playing.png' });
  if (browserErrors.length) throw new Error(`Browser console/runtime issues:\n- ${browserErrors.join('\n- ')}`);

  console.log(JSON.stringify({
    result: 'PASS',
    checks: ['canvas boot', 'start game', 'keyboard movement', 'dash input', 'enemy attack reduces HP', 'attack-radius power-up', 'speed power-up', 'pause/resume', 'dash stops while paused', 'paused input lock', 'day-night mode toggle', 'no browser console/runtime/request errors'],
    initialPosition: before,
    successfulMovementKey: successfulDirection,
    movedPosition: afterMove,
    dashPosition: afterDash,
    environmentMode: { before: modeBefore, after: modeAfter }
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => server.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 2000))
    ]);
    if (server.exitCode === null) server.kill('SIGKILL');
  }
}