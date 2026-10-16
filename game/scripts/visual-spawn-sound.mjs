// Hook AudioContext to count oscillator creations, then trigger several
// spawns and report how many "spawn" sounds were played.
import puppeteer from 'puppeteer-core';

const url = process.argv[2] || 'http://localhost:5173/';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader',
           '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  try { await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 }); } catch (e) {}
  await new Promise((r) => setTimeout(r, 2500));
  await page.waitForSelector('#btn-start', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 400));

  // Install a counter on AudioContext BEFORE the game creates its ctx
  await page.evaluate(() => {
    window.__oscCount = 0;
    const AC = window.AudioContext || window.webkitAudioContext;
    const orig = AC.prototype.createOscillator;
    AC.prototype.createOscillator = function (...args) {
      window.__oscCount += 1;
      return orig.apply(this, args);
    };
  });

  await page.evaluate(() => document.querySelector('#btn-start').click());
  await page.waitForFunction(() => window.__game && window.__game.environment, { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1500));

  const before = await page.evaluate(() => window.__oscCount);

  // Force spawn 5 enemies
  await page.evaluate(() => {
    const em = window.__game.enemyManager;
    for (let i = 0; i < 5; i++) em.spawnEnemy();
  });
  await new Promise((r) => setTimeout(r, 500));

  const after = await page.evaluate(() => window.__oscCount);

  console.log(`oscillators before spawn: ${before}`);
  console.log(`oscillators after  5 spawns: ${after}`);
  console.log(`delta (extra oscs from spawn SFX + ambient): ${after - before}`);
  console.log(`expected for 5 enemySpawn SFX (each has 1 osc): ~5, throttled to 1/180ms → at most 5`);

  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
