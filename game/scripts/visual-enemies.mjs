// Capture close-ups of each enemy type so we can see their current colors
// and decide how to match the reference (dark body + yellow/gold stripes).
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
  await new Promise((r) => setTimeout(r, 1500));

  // Force-spawn one of each enemy type near the player.
  await page.evaluate(async () => {
    const g = window.__game;
    g.player.group.position.set(0, 0, 0);
    const mod = await import('/src/components/Enemy.js');
    const types = ['chaser', 'sprinter', 'brute'];
    const offsets = [
      { x:  20, y: -20 },
      { x: -20, y: -20 },
      { x:  0,  y:  30 }
    ];
    window.__testEnemies = [];
    types.forEach((t, i) => {
      const e = mod.createEnemy(t);
      // Hover height matches EnemyManager default so the model sits
      // clearly above the ground.
      e.group.position.set(offsets[i].x, offsets[i].y, 8);
      g.scene.add(e.group);
      window.__testEnemies.push(e);
    });
    // Give the GLB a moment to load.
    await new Promise((r) => setTimeout(r, 1200));
    return { enemyCount: window.__testEnemies.length, modelsLoaded: window.__testEnemies.filter((e) => e.getModel()).length };
  }).then((info) => console.log('enemy info:', JSON.stringify(info)));

  // Move the player out of the way, top-down camera.
  await page.evaluate(() => {
    window.__game.player.group.visible = false;
    window.__game.__setFreezeCamera(true);
    const cam = window.__game.camera;
    cam.position.set(0, 0, 38);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    cam.zoom = 1.4;
    cam.updateProjectionMatrix();
  });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: 'visual-enemies-all.png' });
  console.log('all enemies -> visual-enemies-all.png');

  if (errors.length) {
    console.log('\n=== ERRORS ===');
    errors.forEach((e) => console.log(e));
  } else {
    console.log('no errors');
  }
  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
