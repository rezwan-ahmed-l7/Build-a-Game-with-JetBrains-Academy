// Top-down view of the full meadow to verify trees are spread across
// the whole ground and that no tree sits on top of a pond.
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
  await page.setViewport({ width: 1600, height: 1200 });

  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  try { await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 }); } catch (e) {}
  await new Promise((r) => setTimeout(r, 2500));
  await page.waitForSelector('#btn-start', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => document.querySelector('#btn-start').click());
  await page.waitForFunction(() => window.__game && window.__game.environment, { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1500));

  // Inventory trees + ponds
  const inventory = await page.evaluate(() => {
    const out = { trees: [], ponds: [] };
    // Use the obstacles' authoritative pond list (already exposed on __game.obstacles.ponds)
    if (window.__game.obstacles && window.__game.obstacles.ponds) {
      for (const p of window.__game.obstacles.ponds) {
        out.ponds.push({ x: Math.round(p.x), y: Math.round(p.y), r: Math.round(p.radius) });
      }
    }
    window.__game.scene.traverse((o) => {
      if (!o.isMesh) return;
      // Trees: trunk mesh is a Cylinder with tall height, inside a Group
      if (o.isMesh && o.geometry && o.geometry.type === 'CylinderGeometry'
          && o.geometry.parameters.height > 12 && o.geometry.parameters.radiusTop < 3
          && o.parent && o.parent.type === 'Group') {
        o.parent.updateWorldMatrix(true, false);
        const m = o.parent.matrixWorld.elements;
        const px = Math.round(m[12]);
        const py = Math.round(m[13]);
        if (!out.trees.find((t) => t.x === px && t.y === py)) {
          out.trees.push({ x: px, y: py });
        }
      }
    });
    return out;
  });
  console.log(`ponds: ${inventory.ponds.length}, trees: ${inventory.trees.length}`);
  console.log('pond positions:', JSON.stringify(inventory.ponds));

  // Bounding box of trees
  if (inventory.trees.length) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const t of inventory.trees) {
      if (t.x < minX) minX = t.x;
      if (t.x > maxX) maxX = t.x;
      if (t.y < minY) minY = t.y;
      if (t.y > maxY) maxY = t.y;
    }
    console.log(`tree bounds: x[${minX}..${maxX}]  y[${minY}..${maxY}]`);
  }

  // Force top-down camera for a screenshot
  await page.evaluate(() => {
    window.__game.environment.setMode('day');
    window.__game.environment.setPhase(0.5);
    window.__game.__setFreezeCamera(true);
    const cam = window.__game.camera;
    cam.position.set(0, 0, 900);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    cam.zoom = 0.7;
    cam.updateProjectionMatrix();
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: 'visual-trees-topdown.png' });
  console.log('shot: visual-trees-topdown.png');

  // Zoomed view of a single pond
  await page.evaluate(() => {
    const cam = window.__game.camera;
    if (window.__game.obstacles && window.__game.obstacles.ponds && window.__game.obstacles.ponds.length) {
      const p = window.__game.obstacles.ponds[0];
      cam.position.set(p.x, p.y - 200, 250);
      cam.up.set(0, 0, 1);
      cam.lookAt(p.x, p.y, 0);
      cam.zoom = 1.0;
      cam.updateProjectionMatrix();
    }
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: 'visual-pond-zoom.png' });
  console.log('shot: visual-pond-zoom.png');

  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
