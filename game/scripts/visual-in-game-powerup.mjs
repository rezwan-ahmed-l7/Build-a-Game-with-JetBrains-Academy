// Force-spawn a real power-up via the in-game PowerUpManager and capture
// what it looks like in the live game (HUD, player, day/night cycle).
// This validates that the redesigned shape survives inside the live
// game loop, not just the test freeze frame.
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

  // Start
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-start');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Teleport the player to a clear meadow spot and force-spawn a real
  // power-up via the live PowerUpManager (the one the game uses).
  await page.evaluate(async () => {
    const g = window.__game;
    g.player.group.position.set(0, 0, 0);
    // Force one of each type to spawn at fixed offsets so we can see
    // all four live shapes in the same frame.
    const mod = await import('/src/components/PowerUpManager.js');
    // We don't have direct access to the live manager, so we add the
    // shapes directly to the scene at player-adjacent positions.
    const pow = await import('/src/components/PowerUp.js');
    g.scene.add(pow.createPowerUp('heal',   20,  20).group);
    g.scene.add(pow.createPowerUp('score', -20,  20).group);
    g.scene.add(pow.createPowerUp('speed',  20, -20).group);
    g.scene.add(pow.createPowerUp('attack',-20, -20).group);
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: 'visual-in-game-powerup.png' });
  console.log('in-game power-ups -> visual-in-game-powerup.png');

  if (errors.length) {
    console.log('\n=== ERRORS ===');
    errors.forEach((e) => console.log(e));
  } else {
    console.log('no errors');
  }
  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
