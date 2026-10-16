// Force a low-angle camera so the sun and clouds are visible in the sky.
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

  // Pin the camera in a fixed low-angle so the sun (at +X +Y) is in view.
  await page.evaluate(() => {
    window.__game.__setFreezeCamera(true);
    const cam = window.__game.camera;
    // Player at origin, sun/moon is offset in X+Y direction in world.
    // Place the camera far away looking back at origin, slightly down.
    cam.position.set(-500, -500, 200);
    cam.up.set(0, 0, 1);
    cam.lookAt(500, 500, 220);
    cam.zoom = 1.0;
    cam.updateProjectionMatrix();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: 'visual-sky-sun.png' });
  console.log('sky -> visual-sky-sun.png');

  if (errors.length) {
    console.log('\n=== ERRORS ===');
    errors.forEach((e) => console.log(e));
  } else {
    console.log('no errors');
  }
  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
