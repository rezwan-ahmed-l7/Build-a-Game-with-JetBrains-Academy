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
  await page.locator('#menu-start').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('canvas.game').waitFor({ state: 'visible' });
  if (await page.locator('#boot-banner').count()) throw new Error('Temporary boot debug banner is still visible');
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

  await page.keyboard.down('w');
  await page.waitForTimeout(350);
  await page.keyboard.up('w');
  const afterMove = await page.evaluate(() => ({
    x: window.__game.player.group.position.x,
    y: window.__game.player.group.position.y
  }));
  if (Math.hypot(afterMove.x - before.x, afterMove.y - before.y) < 1) {
    throw new Error('Player did not move after holding W');
  }

  await page.keyboard.down('w');
  await page.keyboard.press('Shift');
  await page.waitForTimeout(60);
  const earlyDashPosition = await page.evaluate(() => ({
    x: window.__game.player.group.position.x,
    y: window.__game.player.group.position.y
  }));
  const earlyDashDistance = Math.hypot(earlyDashPosition.x - afterMove.x, earlyDashPosition.y - afterMove.y);
  if (earlyDashDistance < 5) {
    throw new Error(`Dash did not produce its expected quick burst; moved only ${earlyDashDistance.toFixed(2)} units`);
  }
  await page.waitForTimeout(200);
  await page.keyboard.up('w');
  const afterDash = await page.evaluate(() => ({
    x: window.__game.player.group.position.x,
    y: window.__game.player.group.position.y
  }));

  // Verify a real attack reduces HP, not merely that its animation plays.
  await page.waitForFunction(() => window.__game.enemyManager.getEnemies().some((enemy) => !enemy.isSpawning && !enemy.isDying), null, { timeout: 8000 });
  const damageCheck = await page.evaluate(() => {
    const player = window.__game.player.group;
    const enemy = window.__game.enemyManager.getEnemies().find((item) => !item.isSpawning && !item.isDying);
    enemy.group.position.set(player.position.x + 12, player.position.y, player.position.z);
    enemy.isSpawning = false;
    enemy.isDying = false;
    enemy.hp = 5;
    return { before: enemy.hp, index: window.__game.enemyManager.getEnemies().indexOf(enemy) };
  });
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const hpAfterAttack = await page.evaluate((index) => window.__game.enemyManager.getEnemies()[index]?.hp ?? null, damageCheck.index);
  if (hpAfterAttack !== damageCheck.before - 1) {
    throw new Error(`Attack should reduce enemy HP by 1; expected ${damageCheck.before - 1}, got ${hpAfterAttack}`);
  }

  await page.keyboard.press('Escape');
  await page.locator('#menu-pause').waitFor({ state: 'visible' });
  await page.locator('#btn-resume').click();
  await page.locator('#menu-pause').waitFor({ state: 'hidden' });

  // Pause during an active dash and ensure the player stays still.
  await page.waitForTimeout(900);
  await page.keyboard.down('w');
  await page.keyboard.press('Shift');
  await page.waitForTimeout(50);
  await page.keyboard.press('Escape');
  await page.locator('#menu-pause').waitFor({ state: 'visible' });
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
  await page.waitForTimeout(100);
  const modeAfter = await page.locator('.environment-mode').innerText();
  if (modeBefore === modeAfter) throw new Error('Day/night mode label did not change after cycling environment');

  await page.screenshot({ path: 'browser-smoke-playing.png' });
  if (browserErrors.length) throw new Error(`Browser console/runtime issues:\n- ${browserErrors.join('\n- ')}`);

  console.log(JSON.stringify({
    result: 'PASS',
    checks: ['canvas boot', 'start game', 'keyboard movement', 'dash input', 'enemy attack reduces HP', 'pause/resume', 'dash stops while paused', 'day-night mode toggle', 'no browser console/runtime/request errors'],
    initialPosition: before,
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