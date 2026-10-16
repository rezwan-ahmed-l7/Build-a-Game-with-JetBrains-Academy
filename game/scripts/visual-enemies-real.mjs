// Capture an enemy in its natural game state — let EnemyManager spawn
// one naturally, then move the player close and take a screenshot.
import puppeteer from 'puppeteer-core';

const url = process.argv[2] || 'http://localhost:5173/';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const errors = [];
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));

  try { await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 }); } catch (e) {}
  await new Promise((r) => setTimeout(r, 1500));

  await page.evaluate(() => {
    const btn = document.querySelector('#btn-start');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  // Force-spawn all three enemy types right at the player, so the
  // game camera sees them at full size.
  await page.evaluate(async () => {
    const g = window.__game;
    g.player.group.position.set(0, 0, 0);
    const mod = await import('/src/components/Enemy.js');
    const types = ['chaser', 'sprinter', 'brute'];
    // Use EnemyManager.spawn so the hover update fires.
    const mgr = g.enemyManager;
    window.__testEnemies = [];
    types.forEach((t, i) => {
      // Spawn via the manager so z-hover is animated.
      const e = mod.createEnemy(t);
      e.group.position.set(0, 0, 0);
      mgr.spawnAt && mgr.spawnAt(e, { x: 0, y: 0 });
      window.__testEnemies.push(e);
    });
    return { ok: true };
  });

  // Wait for the next 3D frame, then pose the camera to look at
  // (0,0,8) where the enemies are hovering.
  await new Promise((r) => setTimeout(r, 1200));
  await page.evaluate(() => {
    window.__game.__setFreezeCamera(true);
    const cam = window.__game.camera;
    cam.position.set(0, 0, 25);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 8);
    cam.zoom = 1.5;
    cam.updateProjectionMatrix();
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: 'visual-enemies-real.png' });
  console.log('enemies real -> visual-enemies-real.png');

  if (errors.length) {
    console.log('\n=== ERRORS ===');
    errors.forEach((e) => console.log(e));
  } else {
    console.log('no errors');
  }
  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
