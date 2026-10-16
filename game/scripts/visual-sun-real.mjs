// Capture the in-game camera at multiple phases to confirm the sun
// rises and sets in actual gameplay (not just the test camera).
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

  // Force day mode so the sun arc is deterministic.
  await page.evaluate(() => {
    window.__game.environment.setMode('day');
  });

  async function shotAt(phase, filename) {
    await page.evaluate((p) => {
      window.__game.environment.setPhase(p);
    }, phase);
    await new Promise((r) => setTimeout(r, 250));
    await page.screenshot({ path: filename });
    console.log(`phase=${phase} -> ${filename}`);
  }

  // Capture at 6 phases spread across the day cycle
  await shotAt(0.00, 'visual-real-1.png');
  await shotAt(0.15, 'visual-real-2.png');
  await shotAt(0.30, 'visual-real-3.png');
  await shotAt(0.50, 'visual-real-4.png');
  await shotAt(0.70, 'visual-real-5.png');
  await shotAt(0.85, 'visual-real-6.png');

  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
