// Verify clouds are scattered across the entire sky, drifting, with
// improved design. Captures 4 camera angles at two time-of-day phases.
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

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[console.${msg.type()}]`, msg.text());
    }
  });
  page.on('pageerror', (err) => {
    console.log('[pageerror]', err.message);
  });

  try { await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 }); } catch (e) {
    console.log('[goto]', e.message);
  }
  await new Promise((r) => setTimeout(r, 2500));

  // Wait for the start button to actually be present + clickable.
  await page.waitForSelector('#btn-start', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-start');
    if (btn) btn.click();
  });
  // Wait for the game to actually start and __game to be populated.
  await page.waitForFunction(() => window.__game && window.__game.environment, { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));

  // Force day mode so the sky is fully lit and clouds read against blue.
  await page.evaluate(() => {
    window.__game.environment.setMode('day');
    window.__game.environment.setPhase(0.5); // noon
  });

  async function shotFrom(pos, lookAt, name) {
    await page.evaluate((p, l) => {
      window.__game.__setFreezeCamera(true);
      const cam = window.__game.camera;
      cam.position.set(p[0], p[1], p[2]);
      cam.up.set(0, 0, 1);
      cam.lookAt(l[0], l[1], l[2]);
      cam.zoom = 1.0;
      cam.updateProjectionMatrix();
    }, pos, lookAt);
    await new Promise((r) => setTimeout(r, 350));
    await page.screenshot({ path: name });
    console.log(`shot: ${name}`);
  }

  // 4 directions of sky view, looking at the horizon.
  await shotFrom([0, -800, 220], [0, 0, 220], 'visual-clouds-n.png');
  await shotFrom([800, 0, 220], [0, 0, 220], 'visual-clouds-e.png');
  await shotFrom([0, 800, 220], [0, 0, 220], 'visual-clouds-s.png');
  await shotFrom([-800, 0, 220], [0, 0, 220], 'visual-clouds-w.png');
  // Overhead-ish wide view
  await shotFrom([-600, -600, 320], [200, 200, 220], 'visual-clouds-wide.png');

  // Now test dusk — sky should be orange and clouds tinted peach.
  await page.evaluate(() => {
    window.__game.environment.setPhase(0.04);  // just after sunrise
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: 'visual-clouds-dusk.png' });
  console.log('shot: visual-clouds-dusk.png');

  // Wait 4s and take a "drift" shot to confirm motion.
  await new Promise((r) => setTimeout(r, 4000));
  await page.screenshot({ path: 'visual-clouds-dusk-later.png' });
  console.log('shot: visual-clouds-dusk-later.png');

  // Reset camera so the ground is visible in the dusk shot.
  await page.evaluate(() => {
    window.__game.__setFreezeCamera(false);
  });
  // Now pin to sunset and capture from the actual gameplay camera angle.
  await page.evaluate(() => {
    window.__game.environment.setPhase(0.96);
    window.__game.__setFreezeCamera(true);
    const cam = window.__game.camera;
    cam.position.set(300, -320, 250);
    cam.up.set(0, 0, 1);
    cam.lookAt(0, 0, 30);
    cam.zoom = 1.0;
    cam.updateProjectionMatrix();
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: 'visual-ground-sunset.png' });
  console.log('shot: visual-ground-sunset.png');

  // Day version for comparison.
  await page.evaluate(() => {
    window.__game.environment.setPhase(0.5);
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: 'visual-ground-day.png' });
  console.log('shot: visual-ground-day.png');

  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
