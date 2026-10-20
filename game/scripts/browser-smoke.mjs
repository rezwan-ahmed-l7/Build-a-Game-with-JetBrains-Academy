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
  // The game intentionally enters a short ready/countdown state after Play.
  // Wait for the actual gameplay state instead of assuming a fixed frame delay.
  await page.waitForFunction(() => window.__game?.currentState() === 'playing', null, { timeout: 10000 });

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
    return {
      before: enemy.hp,
      expectedDamage: window.__game.attack.getDamage(),
      index: enemies.length - 1
    };
  });
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const hpAfterAttack = await page.evaluate((index) => window.__game.enemyManager.getEnemies()[index]?.hp ?? null, damageCheck.index);
  const expectedHp = Math.max(0, damageCheck.before - damageCheck.expectedDamage);
  if (hpAfterAttack !== expectedHp) {
    throw new Error(`Attack damage mismatch; expected enemy HP ${expectedHp} from damage ${damageCheck.expectedDamage}, got ${hpAfterAttack}`);
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
  // Level 1's dash cooldown is 3 seconds, so don't assume a fixed 900 ms
  // wait is enough after the earlier dash. Wait for the actual game state.
  await page.waitForFunction(() => window.__game.dash.getCooldown() <= 0, null, { timeout: 5000 });
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

  // The current game exposes environment controls through its development
  // QA hook; there is no rendered .environment-mode / .cycle-button UI.
  const modeBefore = await page.evaluate(() => window.__game.environment.getMode());
  const modeAfter = await page.evaluate(() => window.__game.environment.cycleMode());
  if (modeBefore === modeAfter) throw new Error('Day/night environment mode did not change after cycling environment');
  await page.waitForTimeout(100);
  const renderedMode = await page.evaluate(() => window.__game.environment.getMode());
  if (renderedMode !== modeAfter) throw new Error(`Environment mode mismatch: expected ${modeAfter}, got ${renderedMode}`);

  // Mobile smoke: force touch-device detection, complete onboarding, and
  // exercise the virtual joystick with a quick flick that may end between frames.
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1
  });
  const mobilePage = await mobileContext.newPage();
  mobilePage.on('pageerror', (error) => browserErrors.push(`Mobile page error: ${error.message}`));
  mobilePage.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`Mobile console: ${message.text()}`);
  });
  mobilePage.on('requestfailed', (request) => {
    if (!request.url().startsWith('data:')) browserErrors.push(`Mobile request failed: ${request.url()} — ${request.failure()?.errorText}`);
  });
  await mobilePage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mobilePage.locator('#menu-start').waitFor({ state: 'visible', timeout: 10000 });
  if (!(await mobilePage.locator('.touch-root').count())) {
    throw new Error('Touch device detection did not mount virtual controls on mobile viewport');
  }
  await mobilePage.locator('#profile-name').fill('MobileSmoke');
  await mobilePage.locator('#profile-flag').click();
  await mobilePage.locator('.flag-cell[data-code="BD"]').click();
  await mobilePage.locator('#flag-confirm').click();
  await mobilePage.waitForFunction(() => {
    const button = document.querySelector('#btn-start');
    return button && !button.disabled;
  });
  await mobilePage.locator('#btn-start').click();
  await mobilePage.locator('#menu-start').waitFor({ state: 'hidden' });
  await mobilePage.waitForFunction(() => window.__game?.currentState() === 'playing');

  const touchButtonVisibility = await mobilePage.evaluate(() => ({
    joystick: !!document.querySelector('.joystick-base') &&
      getComputedStyle(document.querySelector('.joystick-base')).pointerEvents !== 'none',
    attack: !!document.querySelector('#touch-attack'),
    dash: !!document.querySelector('#touch-dash')
  }));
  if (!touchButtonVisibility.joystick || !touchButtonVisibility.attack || !touchButtonVisibility.dash) {
    throw new Error(`Mobile controls are missing or not interactive: ${JSON.stringify(touchButtonVisibility)}`);
  }

  let mobileMovement = null;
  let mobileDirection = null;
  for (const direction of [
    { name: 'right', dx: 28, dy: 0 },
    { name: 'left', dx: -28, dy: 0 },
    { name: 'forward', dx: 0, dy: -28 },
    { name: 'backward', dx: 0, dy: 28 }
  ]) {
    const joystickBox = await mobilePage.locator('.joystick-base').boundingBox();
    if (!joystickBox) throw new Error('Mobile joystick has no visible bounding box');
    const centerX = joystickBox.x + joystickBox.width / 2;
    const centerY = joystickBox.y + joystickBox.height / 2;
    const startPosition = await mobilePage.evaluate(() => ({
      x: window.__game.player.group.position.x,
      y: window.__game.player.group.position.y
    }));
    await mobilePage.mouse.move(centerX, centerY);
    await mobilePage.mouse.down();
    await mobilePage.mouse.move(centerX + direction.dx, centerY + direction.dy, { steps: 1 });
    await mobilePage.mouse.up();
    await mobilePage.waitForTimeout(480);
    const endPosition = await mobilePage.evaluate(() => ({
      x: window.__game.player.group.position.x,
      y: window.__game.player.group.position.y
    }));
    if (Math.hypot(endPosition.x - startPosition.x, endPosition.y - startPosition.y) > 10) {
      mobileMovement = endPosition;
      mobileDirection = direction.name;
      break;
    }
  }
  if (!mobileMovement) {
    const diagnostics = await mobilePage.evaluate(() => ({
      state: window.__game.currentState(),
      moveDirection: window.__game.touch?.getMoveDirection?.() ?? null,
      queuedInput: window.__game.input.peek(),
      moving: window.__game.movement.isCurrentlyMoving(),
      position: { x: window.__game.player.group.position.x, y: window.__game.player.group.position.y }
    }));
    throw new Error(`Mobile joystick quick flick did not move the player. Diagnostics: ${JSON.stringify(diagnostics)}`);
  }

  await mobilePage.evaluate(() => {
    window.__mobileAttackCalls = 0;
    const originalAttack = window.__game.attack.attack.bind(window.__game.attack);
    window.__game.attack.attack = (...args) => {
      window.__mobileAttackCalls++;
      return originalAttack(...args);
    };
    window.__mobileDashCalls = 0;
    const originalDash = window.__game.dash.tryStart.bind(window.__game.dash);
    window.__game.dash.tryStart = (...args) => {
      window.__mobileDashCalls++;
      return originalDash(...args);
    };
  });
  await mobilePage.locator('#touch-attack').click();
  await mobilePage.locator('#touch-dash').click();
  const mobileActionCalls = await mobilePage.evaluate(() => ({
    attack: window.__mobileAttackCalls,
    dash: window.__mobileDashCalls
  }));
  if (mobileActionCalls.attack < 1 || mobileActionCalls.dash < 1) {
    throw new Error(`Mobile action button handlers did not fire: ${JSON.stringify(mobileActionCalls)}`);
  }
  await mobilePage.screenshot({ path: 'browser-smoke-mobile.png' });
  await mobileContext.close();

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