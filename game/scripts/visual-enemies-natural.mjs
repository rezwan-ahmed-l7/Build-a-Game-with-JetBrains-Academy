// Capture the natural in-game enemy rendering by playing for a few
// seconds and letting EnemyManager spawn.
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
  await new Promise((r) => setTimeout(r, 1500));

  // Force-spawn 3 enemies via the live manager so their z-hover fires.
  await page.evaluate(async () => {
    const g = window.__game;
    g.player.group.position.set(0, 0, 0);
    // The EnemyManager.spawn method handles position+scene add. Look at
    // its surface and call the right thing.
    const mgr = g.enemyManager;
    const types = ['chaser', 'sprinter', 'brute'];
    // Force each spawn directly via the manager if it has a public
    // method; otherwise create + add to scene.
    for (let i = 0; i < types.length; i++) {
      const t = types[i];
      if (typeof mgr.spawn === 'function') {
        // mgr.spawn expects a difficulty and we may need a position.
        // Try calling it without args first; if it crashes, fallback.
        try { mgr.spawn(t); } catch (e) {
          const mod = await import('/src/components/Enemy.js');
          const e = mod.createEnemy(t);
          const ang = (i / types.length) * Math.PI * 2;
          e.group.position.set(Math.cos(ang) * 18, Math.sin(ang) * 18, 0);
          g.scene.add(e.group);
          mgr.enemies && mgr.enemies.push(e);
        }
      }
    }
    return { ok: true, count: mgr.enemies ? mgr.enemies.length : 0 };
  }).then((info) => console.log('spawn info:', JSON.stringify(info)));

  // Wait, then take a screenshot with the natural camera (don't freeze).
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: 'visual-enemies-natural.png' });
  console.log('enemies natural -> visual-enemies-natural.png');

  if (errors.length) {
    console.log('\n=== ERRORS ===');
    errors.forEach((e) => console.log(e));
  } else {
    console.log('no errors');
  }
  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
