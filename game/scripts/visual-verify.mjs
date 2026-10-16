// Visual verification: switch the camera to a top-down (bird's-eye) view,
// press W/A/S/D, and take screenshots. Lets us visually confirm the frog
// faces the right way regardless of how the 3rd-person camera frames it.

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

  // Click Play to start
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Play');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2500));

  // Switch to top-down by directly manipulating the camera. We bypass
  // the game code and just position the camera straight above looking
  // down. This makes "front" of the frog unambiguous in the screenshot.
  await page.evaluate(() => {
    const g = window.__game;
    if (!g) return;
    const cam = g.scene.children.find((c) => c.isCamera) ||
      g.player.group.parent.children.find((c) => c.isCamera);
    if (!cam) return;
    // Place camera directly above player, looking straight down. Screen "up"
    // = world -Y (so frog facing -Y visually points "up" in the screenshot).
    cam.position.set(g.player.group.position.x, g.player.group.position.y, 400);
    cam.up.set(0, 1, 0);
    cam.lookAt(g.player.group.position.x, g.player.group.position.y - 1, 0);
    window.__cam = cam;
  });

  // Helper: reset position and facing, then press a key, then screenshot.
  async function snapKey(key, filename) {
    await page.evaluate(() => {
      const g = window.__game;
      if (g) {
        g.player.group.position.set(0, 0, 0);
        const m = g.player.getModel();
        if (m && m.parent) m.parent.rotation.set(0, 0, 0);
      }
    });
    await new Promise((r) => setTimeout(r, 250));
    await page.focus('canvas');
    await page.keyboard.down(key);
    await new Promise((r) => setTimeout(r, 100));
    await page.keyboard.up(key);
    await new Promise((r) => setTimeout(r, 700));

    // Re-pin camera to top-down (in case game state moved it)
    await page.evaluate(() => {
      const g = window.__game;
      if (!g || !window.__cam) return;
      const cam = window.__cam;
      cam.position.set(g.player.group.position.x, g.player.group.position.y, 400);
      cam.up.set(0, 1, 0);
      cam.lookAt(g.player.group.position.x, g.player.group.position.y - 1, 0);
    });

    await page.screenshot({ path: filename });
    const state = await page.evaluate(() => {
      const g = window.__game;
      if (!g || !g.player) return null;
      const m = g.player.getModel();
      const parent = m && m.parent;
      return {
        facing: parent ? parent.rotation.z * 180 / Math.PI : null,
        modelRotZ: m ? m.rotation.z * 180 / Math.PI : null
      };
    });
    console.log(`${key.toUpperCase()}: facingGroup.z=${state?.facing?.toFixed(1)}°, modelRotZ=${state?.modelRotZ?.toFixed(1)}° -> ${filename}`);
  }

  await snapKey('w', 'visual-w.png');
  await snapKey('s', 'visual-s.png');
  await snapKey('a', 'visual-a.png');
  await snapKey('d', 'visual-d.png');

  // Also test after rotating the camera (Q)
  console.log('\n-- After Q camera rotation --');
  await page.evaluate(() => {
    const g = window.__game;
    if (g) {
      g.player.group.position.set(0, 0, 0);
      const m = g.player.getModel();
      if (m && m.parent) m.parent.rotation.set(0, 0, 0);
    }
  });
  await new Promise((r) => setTimeout(r, 200));
  await page.focus('canvas');
  await page.keyboard.down('q');
  await new Promise((r) => setTimeout(r, 1500));
  await page.keyboard.up('q');
  await new Promise((r) => setTimeout(r, 300));

  // Re-pin camera
  await page.evaluate(() => {
    const g = window.__game;
    if (!g || !window.__cam) return;
    const cam = window.__cam;
    cam.position.set(g.player.group.position.x, g.player.group.position.y, 400);
    cam.up.set(0, 1, 0);
    cam.lookAt(g.player.group.position.x, g.player.group.position.y - 1, 0);
  });
  await page.screenshot({ path: 'visual-after-q.png' });

  await snapKey('w', 'visual-after-q-w.png');

  if (errors.length) {
    console.log('\n=== ERRORS ===');
    errors.forEach((e) => console.log(e));
  }

  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
