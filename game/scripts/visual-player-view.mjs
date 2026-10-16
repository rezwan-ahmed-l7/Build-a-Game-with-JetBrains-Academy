// Capture the actual gameplay view (3rd person chase cam) so we can see
// what the player sees: a clean immediate play area with trees forming
// a horizon line in the distance.
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
  await new Promise((r) => setTimeout(r, 1500));

  // Day, default gameplay camera (3rd-person chase)
  await page.evaluate(() => {
    window.__game.environment.setMode('day');
    window.__game.environment.setPhase(0.5);
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: 'visual-player-day.png' });
  console.log('shot: visual-player-day.png');

  // Walk the player ~150 units to the east to see how the world feels
  await page.evaluate(() => {
    const player = window.__game.player;
    player.group.position.x = 200;
    player.group.position.y = 0;
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: 'visual-player-walked.png' });
  console.log('shot: visual-player-walked.png');

  // Sunset
  await page.evaluate(() => {
    const player = window.__game.player;
    player.group.position.x = 0;
    player.group.position.y = 0;
    window.__game.environment.setPhase(0.96);
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: 'visual-player-sunset.png' });
  console.log('shot: visual-player-sunset.png');

  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
