// Pin the phase to specific moments of the day cycle so we can verify
// the sun rise, noon, and sunset are all visible.
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
  await new Promise((r) => setTimeout(r, 1500));

  await page.evaluate(() => {
    const btn = document.querySelector('#btn-start');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  // Force day mode so phase controls the sun arc deterministically.
  await page.evaluate(() => {
    window.__game.environment.setMode('day');
    window.__game.__setFreezeCamera(true);
    const cam = window.__game.camera;
    // Wide sky view
    cam.position.set(-400, -600, 100);
    cam.up.set(0, 0, 1);
    cam.lookAt(400, 400, 200);
    cam.zoom = 1.0;
    cam.updateProjectionMatrix();
  });

  async function shotAt(phase, filename) {
    await page.evaluate((p) => {
      window.__game.environment.setPhase(p);
    }, phase);
    await new Promise((r) => setTimeout(r, 200));
    await page.screenshot({ path: filename });
    console.log(`phase=${phase} -> ${filename}`);
  }

  // Sunrise (phase 0.0): sun at east horizon
  await shotAt(0.00, 'visual-sunrise.png');
  // Morning (phase 0.15): sun climbing
  await shotAt(0.15, 'visual-morning.png');
  // Noon (phase 0.5): sun overhead
  await shotAt(0.50, 'visual-noon.png');
  // Afternoon (phase 0.7): sun descending
  await shotAt(0.70, 'visual-afternoon.png');
  // Sunset (phase 0.92): sun at west horizon
  await shotAt(0.92, 'visual-sunset.png');

  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
