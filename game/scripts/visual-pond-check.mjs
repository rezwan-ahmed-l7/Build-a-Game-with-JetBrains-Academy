// Capture the pond directly from above and from the side to verify
// it's actually flat on the ground.
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

  try { await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 }); } catch (e) {}
  await new Promise((r) => setTimeout(r, 2500));
  await page.waitForSelector('#btn-start', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => document.querySelector('#btn-start').click());
  await page.waitForFunction(() => window.__game && window.__game.environment, { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));

  // Find the pond position
  const pondPos = await page.evaluate(() => {
    const out = [];
    window.__game.scene.traverse((o) => {
      if (o.isMesh && o.geometry && o.geometry.type === 'CircleGeometry'
          && o.geometry.parameters.radius < 200) {
        o.updateWorldMatrix(true, false);
        const m = o.matrixWorld.elements;
        out.push({ x: m[12], y: m[13], z: m[14], radius: o.geometry.parameters.radius });
      }
    });
    return out;
  });
  console.log('small circles:', JSON.stringify(pondPos));

  // Force day mode and freeze camera, then look down at the pond.
  await page.evaluate(() => {
    window.__game.environment.setMode('day');
    window.__game.environment.setPhase(0.5);
    window.__game.__setFreezeCamera(true);
    const cam = window.__game.camera;
    // Reset the camera to follow the player naturally for the tree view
    window.__game.__setFreezeCamera(false);
    const player = window.__game.player;
    if (player) {
      cam.position.set(player.group.position.x + 200, player.group.position.y - 250, 180);
      cam.up.set(0, 0, 1);
      cam.lookAt(player.group.position.x, player.group.position.y, 0);
      cam.zoom = 1.0;
      cam.updateProjectionMatrix();
    }
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: 'visual-pond-top.png' });
  console.log('shot: visual-pond-top.png');

  // Now look at the pond from a side angle
  await page.evaluate(() => {
    const cam = window.__game.camera;
    cam.position.set(400, -200, 100);
    cam.up.set(0, 0, 1);
    cam.lookAt(100, 0, 30);
    cam.zoom = 1.0;
    cam.updateProjectionMatrix();
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: 'visual-pond-side.png' });
  console.log('shot: visual-pond-side.png');

  // Tree closeup: move close to a single tree
  await page.evaluate(() => {
    const cam = window.__game.camera;
    cam.position.set(60, -50, 50);
    cam.up.set(0, 0, 1);
    cam.lookAt(40, -10, 25);
    cam.zoom = 1.0;
    cam.updateProjectionMatrix();
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: 'visual-trees-closeup.png' });
  console.log('shot: visual-trees-closeup.png');

  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });