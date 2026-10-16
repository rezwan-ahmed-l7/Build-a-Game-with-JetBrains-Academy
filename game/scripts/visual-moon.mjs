// Force night mode and pose the camera so the moon is clearly visible.
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
  const logs = [];
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

  try { await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 }); } catch (e) {}
  await new Promise((r) => setTimeout(r, 1500));

  await page.evaluate(() => {
    const btn = document.querySelector('#btn-start');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  await page.evaluate(() => {
    const g = window.__game;
    if (g.environment && g.environment.setMode) {
      g.environment.setMode('night');
    }
    window.__game.__setFreezeCamera(true);
    const cam = window.__game.camera;
    // In night mode, moon is at (px-180, py+180, pz+520) = (-180, 180, 520)
    cam.position.set(100, -200, 200);
    cam.up.set(0, 0, 1);
    cam.lookAt(-180, 180, 520);
    cam.zoom = 1.0;
    cam.updateProjectionMatrix();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: 'visual-moon-night.png' });
  console.log('moon -> visual-moon-night.png');

  if (errors.length) {
    console.log('\n=== ERRORS ===');
    errors.forEach((e) => console.log(e));
  } else {
    console.log('no errors');
  }
  if (logs.length) {
    console.log('\n=== LOGS ===');
    logs.forEach((l) => console.log(l));
  }
  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
