// Capture the live gameplay view with enemies buzzing around the player
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

  // Force enemies close to player
  await page.evaluate(() => {
    window.__game.environment.setMode('day');
    window.__game.environment.setPhase(0.5);
    window.__game.player.group.position.x = 0;
    window.__game.player.group.position.y = 0;
    const em = window.__game.enemyManager;
    em.setSpawnInterval(0.1);   // spawn fast
    em.setSpeedMultiplier(0.4); // slow so we can see buzz
  });
  // Let several enemies spawn
  await new Promise((r) => setTimeout(r, 4000));

  // Default gameplay camera + freeze so the screenshot is clean
  await page.evaluate(() => {
    window.__game.__setFreezeCamera(true);
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: 'visual-enemies-buzz.png' });
  console.log('shot: visual-enemies-buzz.png');

  // Pose camera behind/above the player at a nice angle
  await page.evaluate(() => {
    const cam = window.__game.camera;
    const p = window.__game.player.group.position;
    cam.position.set(p.x - 80, p.y - 140, 90);
    cam.up.set(0, 0, 1);
    cam.lookAt(p.x, p.y, 20);
    cam.zoom = 1.0;
    cam.updateProjectionMatrix();
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: 'visual-enemies-buzz-side.png' });
  console.log('shot: visual-enemies-buzz-side.png');

  // Top-down close-up to see banking visually
  await page.evaluate(() => {
    const cam = window.__game.camera;
    const p = window.__game.player.group.position;
    cam.position.set(p.x, p.y, 200);
    cam.up.set(0, 1, 0);
    cam.lookAt(p.x, p.y, 0);
    cam.zoom = 1.0;
    cam.updateProjectionMatrix();
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: 'visual-enemies-buzz-top.png' });
  console.log('shot: visual-enemies-buzz-top.png');

  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
