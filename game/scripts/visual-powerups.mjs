// Spawn redesigned power-ups at known positions and capture screenshots.
//
//   wide      -> all four side-by-side
//   heal      -> close-up of the heart
//   score     -> close-up of the star
//   speed     -> close-up of the lightning bolt
//   attack    -> close-up of the sword
//
// The dev hook window.__game.__setFreezeCamera(true) keeps CameraFollow
// from snapping the camera back while we pose it for the close-up.
import puppeteer from 'puppeteer-core';

const url = process.argv[2] || 'http://localhost:5173/';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const TYPES = ['heal', 'score', 'speed', 'attack'];

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

  // Click Play
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-start');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  // ---------- Wide shot: all four side by side around the player ----------
  // The wide composition looks at the world around the player so the
  // meadow + trees are visible behind the icons. Player is hidden
  // because the model is large enough to dominate any top-down frame.
  await page.evaluate(async () => {
    const mod = await import('/src/components/PowerUp.js');
    const scene = window.__game.scene;
    const types = ['heal', 'score', 'speed', 'attack'];
    // Smaller spread + closer camera so all four icons are fully framed.
    const offsets = [
      { x: -14, y: -14 },
      { x:  14, y: -14 },
      { x: -14, y:  14 },
      { x:  14, y:  14 }
    ];
    window.__testPowerUps = [];
    window.__game.player.group.visible = false;
    types.forEach((t, i) => {
      const pu = mod.createPowerUp(t, offsets[i].x, offsets[i].y);
      scene.add(pu.group);
      window.__testPowerUps.push(pu);
    });

    // Pose the camera top-down so all four icons read clearly.
    window.__game.__setFreezeCamera(true);
    const cam = window.__game.camera;
    cam.position.set(0, 0, 40);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    cam.zoom = 1.0;
    cam.updateProjectionMatrix();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return {
      sceneChildren: scene.children.length,
      puCount: window.__testPowerUps.length
    };
  }).then((info) => console.log('wide shot info:', JSON.stringify(info)));
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: 'visual-powerup-all.png' });
  console.log('all four -> visual-powerup-all.png');

  // Restore player visibility for the per-type close-ups.
  await page.evaluate(() => {
    window.__game.player.group.visible = true;
  });

  // ---------- Per-type close-ups ----------
  for (const type of TYPES) {
    // Freeze the camera, remove any earlier per-type power-ups, spawn exactly
    // one of this type at a fixed offset, and pose the camera top-down.
    await page.evaluate(async (t) => {
      // Stop existing test power-ups: drop their groups from the scene
      // entirely. markCollected alone is not enough because the mesh
      // remains attached to the scene until the manager ticks past it.
      (window.__testPowerUps || []).forEach((p) => {
        if (p.group && p.group.parent) p.group.parent.remove(p.group);
        p.markCollected && p.markCollected();
      });
      window.__testPowerUps = [];

      const mod = await import('/src/components/PowerUp.js');
      const scene = window.__game.scene;
      // Spawn the power-up out in the open, well away from the player.
      // Origin (0,0) sits in the meadow next to the pond; the player
      // model gets teleported far away so it doesn't dominate the frame.
      const pu = mod.createPowerUp(t, 0, 0);
      scene.add(pu.group);
      window.__testPowerUps.push(pu);
      window.__game.player.group.position.set(800, 800, 0);

      // Freeze camera-follow and pose it straight down on origin.
      window.__game.__setFreezeCamera(true);
      const cam = window.__game.camera;
      cam.position.set(0, 0, 38);
      cam.up.set(0, 1, 0);
      cam.lookAt(0, 0, 0);
      cam.zoom = 1.0;
      cam.updateProjectionMatrix();
    }, type);
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: `visual-powerup-${type}.png` });
    console.log(`${type} -> visual-powerup-${type}.png`);
  }

  // Unfreeze for cleanliness, even though we're closing the page next.
  await page.evaluate(() => window.__game.__setFreezeCamera(false));

  if (errors.length) {
    console.log('\n=== ERRORS ===');
    errors.forEach((e) => console.log(e));
  } else {
    console.log('no errors');
  }
  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
