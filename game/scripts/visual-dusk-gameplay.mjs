// Capture the actual gameplay camera at sunset vs day so we can see
// what the user sees when they say the ground doesn't change color.
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
  await new Promise((r) => setTimeout(r, 800));

  // Day (noon) — gameplay camera, do NOT freeze it.
  await page.evaluate(() => {
    window.__game.environment.setMode('day');
    window.__game.environment.setPhase(0.5);
  });
  // Don't freeze camera, let it sit at its initial position.
  await new Promise((r) => setTimeout(r, 400));
  // Inspect ALL meshes to find what's at the bottom-right of the screen.
  const meshes = await page.evaluate(() => {
    const scene = window.__game.scene;
    const camera = window.__game.camera;
    const cam = camera;
    const result = [];
    scene.traverse((o) => {
      if (o.isMesh && o.geometry && o.geometry.type !== 'BufferGeometry') {
        // Project to screen
        const v = o.position.clone();
        o.updateWorldMatrix(true, false);
        const wp = o.getWorldPosition(new (Object.getPrototypeOf(o.position).constructor)());
        const ndc = wp.project(cam);
        if (ndc.x > 0.2 && ndc.x < 1.0 && ndc.y < -0.3) {
          result.push({
            geom: o.geometry.type,
            params: JSON.stringify(o.geometry.parameters).slice(0, 100),
            mat: o.material && o.material.color ? '#' + o.material.color.getHexString() : '?',
            worldPos: { x: Math.round(wp.x), y: Math.round(wp.y), z: Math.round(wp.z) },
            ndc: { x: ndc.x.toFixed(2), y: ndc.y.toFixed(2), z: ndc.z.toFixed(2) },
            visible: o.visible,
            name: o.name || ''
          });
        }
      }
    });
    return result.slice(0, 20);
  });
  console.log('bottom-right meshes:', JSON.stringify(meshes, null, 2));
  await page.screenshot({ path: 'visual-play-day.png' });
  console.log('shot: visual-play-day.png');

  // Sunset — gameplay camera, do NOT freeze it.
  await page.evaluate(() => {
    window.__game.environment.setPhase(0.96);
  });
  await new Promise((r) => setTimeout(r, 400));
  // Log the actual env state so we can debug.
  const state = await page.evaluate(() => {
    // Hacky: read color of background
    const bg = window.__game.scene.background;
    return {
      bgR: bg.r, bgG: bg.g, bgB: bg.b,
      bgHex: '#' + bg.getHexString()
    };
  });
  console.log('sunset bg:', state);
  await page.screenshot({ path: 'visual-play-sunset.png' });
  console.log('shot: visual-play-sunset.png');

  // Sunrise
  await page.evaluate(() => {
    window.__game.environment.setPhase(0.04);
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: 'visual-play-sunrise.png' });
  console.log('shot: visual-play-sunrise.png');

  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
