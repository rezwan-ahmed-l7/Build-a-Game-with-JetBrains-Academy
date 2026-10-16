// Force day mode and a low-angle camera so the sun is clearly visible
// in the sky (not overlapping the moon like auto-mode does).
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

  // Force day mode (so the sun is at a known position, and moon is hidden)
  // then position the camera so the sun fills the right side of the screen.
  await page.evaluate(() => {
    const g = window.__game;
    // Find the environment via the onUpdate hook or similar
    if (g.environment && g.environment.getMode && g.environment.getMode() !== 'day') {
      // Toggle until day
      let safety = 0;
      while (g.environment.getMode() !== 'day' && safety < 5) {
        g.environment.cycleMode();
        safety++;
      }
    }
    window.__game.__setFreezeCamera(true);
    const cam = window.__game.camera;
    // Player at origin, sun in day mode is at (px+180, py+220, pz+520) = (180, 220, 520).
    // Place camera looking up at the sun.
    cam.position.set(-100, -200, 200);
    cam.up.set(0, 0, 1);
    cam.lookAt(180, 220, 520);
    cam.zoom = 1.0;
    cam.updateProjectionMatrix();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: 'visual-sun-day.png' });
  console.log('sun -> visual-sun-day.png');

  if (errors.length) {
    console.log('\n=== ERRORS ===');
    errors.forEach((e) => console.log(e));
  } else {
    console.log('no errors');
  }
  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
