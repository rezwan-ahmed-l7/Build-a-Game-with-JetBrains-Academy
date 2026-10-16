// Capture a real in-game state (3rd-person camera, no overrides) with the
// new HUD, plus take a "new best" game over triggered by actual gameplay.
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

  // Click Play
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-start');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Capture the in-game HUD with the 3rd-person camera (no overrides).
  await page.screenshot({ path: 'visual-3p-after.png' });
  console.log('in-game 3p -> visual-3p-after.png');

  // Cycle the day/night mode and capture again so the pill color changes.
  await page.evaluate(() => {
    const btn = document.querySelector('.mode-pill');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: 'visual-3p-night.png' });
  console.log('in-game 3p (night) -> visual-3p-night.png');

  // Trigger a kill to test the kill-bump on the score chip.
  await page.evaluate(() => {
    const g = window.__game;
    if (!g) return;
    g.score.addKillBonus(1);
  });
  await new Promise((r) => setTimeout(r, 100));
  await page.screenshot({ path: 'visual-3p-kill-bump.png' });
  console.log('kill bump -> visual-3p-kill-bump.png');

  if (errors.length) {
    console.log('\n=== ERRORS ===');
    errors.forEach((e) => console.log(e));
  } else {
    console.log('no errors');
  }
  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });