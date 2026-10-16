// Compare enemy positions across two timestamps to verify the buzz /
// jitter effect is producing real per-frame motion (not static).
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

  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  try { await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 }); } catch (e) {}
  await new Promise((r) => setTimeout(r, 2500));
  await page.waitForSelector('#btn-start', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => document.querySelector('#btn-start').click());
  await page.waitForFunction(() => window.__game && window.__game.environment, { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 2000));

  // Force enemy spawns near the player so we can capture motion
  await page.evaluate(() => {
    window.__game.environment.setMode('day');
    window.__game.environment.setPhase(0.5);

    // Drive the player into the open
    window.__game.player.group.position.x = 0;
    window.__game.player.group.position.y = 0;

    // Force a few enemies to spawn close
    const em = window.__game.enemyManager;
    for (let i = 0; i < 6; i++) em.spawnEnemy();
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Snap enemy positions and angles on frame 1
  const snap1 = await page.evaluate(() => {
    const out = [];
    const em = window.__game.enemyManager;
    const enemies = em.getEnemies();
    for (const e of enemies) {
      out.push({
        x: Math.round(e.group.position.x * 10) / 10,
        y: Math.round(e.group.position.y * 10) / 10,
        z: Math.round(e.group.position.z * 10) / 10,
        bank: Math.round((e.bankAngle || 0) * 100) / 100
      });
    }
    return out;
  });

  // Wait a few frames
  await new Promise((r) => setTimeout(r, 250));

  // Snap again
  const snap2 = await page.evaluate(() => {
    const out = [];
    const em = window.__game.enemyManager;
    const enemies = em.getEnemies();
    for (const e of enemies) {
      out.push({
        x: Math.round(e.group.position.x * 10) / 10,
        y: Math.round(e.group.position.y * 10) / 10,
        z: Math.round(e.group.position.z * 10) / 10,
        bank: Math.round((e.bankAngle || 0) * 100) / 100
      });
    }
    return out;
  });

  console.log('FRAME 1:', JSON.stringify(snap1));
  console.log('FRAME 2:', JSON.stringify(snap2));

  // Per-enemy jitter between frames
  for (let i = 0; i < Math.min(snap1.length, snap2.length); i++) {
    const a = snap1[i], b = snap2[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const dxy = Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10;
    console.log(`enemy[${i}]: horizontal drift ${dxy}u  vertical change ${dz}u  bank ${a.bank}→${b.bank}`);
  }

  // Take a screenshot for visual reference
  await page.evaluate(() => {
    const cam = window.__game.camera;
    cam.position.set(0, 0, 80);
    cam.up.set(0, 0, 1);
    cam.lookAt(0, 0, 0);
    cam.zoom = 1.5;
    cam.updateProjectionMatrix();
  });
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: 'visual-enemy-buzz.png' });
  console.log('shot: visual-enemy-buzz.png');

  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
