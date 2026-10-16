// Capture the new pause menu and game-over panel after the UI pass.
// Run after `npm run dev` is up on the URL passed as argv[2].
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
  await new Promise((r) => setTimeout(r, 1800));
  // Capture the start menu at full viewport before doing anything else
  await page.screenshot({ path: 'visual-start-after.png' });
  console.log('start menu -> visual-start-after.png');

  // Click Play
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-start');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Pause
  await page.focus('canvas');
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: 'visual-pause.png' });
  console.log('paused -> visual-pause.png');

  // Resume
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-resume');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  // Force the game over panel so we can verify it
  await page.evaluate(() => {
    const g = window.__game;
    if (g && g.player) g.player.group.position.set(0, 0, 0);
  });
  // Pre-seed a high score so the next "new best" badge shows as a real new best
  // (not the FIRST BEST variant). The persistence helper uses a "tode:" prefix.
  await page.evaluate(() => {
    try {
      localStorage.setItem('tode:highScore', '500');
    } catch (e) {}
  });
  await page.evaluate(() => {
    const g = window.__game;
    if (!g) return { ok: false, reason: 'no game' };
    if (typeof g.score?.showGameOver === 'function') {
      g.score.addKillBonus(60);
      g.score.showGameOver();
      return { ok: true, via: 'showGameOver' };
    }
    return { ok: false, reason: 'no showGameOver' };
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: 'visual-gameover.png' });
  console.log('game over (with new best) -> visual-gameover.png');

  if (errors.length) {
    console.log('\n=== ERRORS ===');
    errors.forEach((e) => console.log(e));
  } else {
    console.log('no errors');
  }
  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });