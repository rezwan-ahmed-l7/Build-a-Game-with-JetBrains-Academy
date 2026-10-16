// Force-spawn a few enemies and capture them in the actual game camera
// (no freeze) so we see the real colors, including the gold accent.
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

  // Teleport the player to a clear spot, freeze the camera, and
  // spawn one of each enemy type nearby at z=8 so the camera frames them.
  await page.evaluate(async () => {
    const g = window.__game;
    g.player.group.position.set(0, 0, 0);
    g.player.group.visible = false;

    const mod = await import('/src/components/Enemy.js');
    const types = ['chaser', 'sprinter', 'brute'];
    // Spread them on the Y axis (screen depth in top-down) so the
    // camera at z=70 sees all three without overlap.
    const spacing = 18;
    window.__testEnemies = [];
    types.forEach((t, i) => {
      const e = mod.createEnemy(t);
      e.group.position.set(0, (i - 1) * spacing, 8);
      g.scene.add(e.group);
      window.__testEnemies.push(e);
    });
    // Wait a beat for GLBs to load + colors to apply.
    await new Promise((r) => setTimeout(r, 1500));
    return { ok: true };
  });

  // Pose the camera so all 3 are in frame. With Y spread of 36 units
  // we need to fit the spread in the vertical view at z=70.
  await page.evaluate(() => {
    window.__game.__setFreezeCamera(true);
    const cam = window.__game.camera;
    cam.position.set(0, 0, 60);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 8);
    cam.zoom = 1.0;
    cam.updateProjectionMatrix();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: 'visual-enemies-all2.png' });
  console.log('enemies -> visual-enemies-all2.png');

  if (errors.length) {
    console.log('\n=== ERRORS ===');
    errors.forEach((e) => console.log(e));
  } else {
    console.log('no errors');
  }
  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
