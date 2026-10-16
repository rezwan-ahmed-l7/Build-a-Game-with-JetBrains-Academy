// Mobile UI verification — captures the three states a touch player
// interacts with: start menu (with touch-aware hints), flag picker, and
// game-over panel (with the visible Restart button). Then it taps the
// Restart button to confirm the run resets.
import puppeteer from 'puppeteer-core';

const url = process.argv[2] || 'http://localhost:5173/';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Mobile viewport: iPhone-ish portrait (390x844).
const W = 390, H = 844;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader']
  });
  const page = await browser.newPage();
  // Force a touch-primary UA + viewport so isTouchDevice() returns true.
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  );
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  page.on('pageerror', (err) => console.log('[pageerror]', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[console.error]', msg.text());
  });

  try { await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 }); } catch (e) {}
  await new Promise((r) => setTimeout(r, 1500));
  // Reset storage so the start menu is empty and the touch hints are the
  // default state (the script always shows the touch variant at mobile UA).
  await page.evaluate(() => {
    localStorage.removeItem('tode:profile');
    localStorage.removeItem('tode:leaderboard');
    localStorage.removeItem('tode:attempts');
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  await page.waitForSelector('#menu-start', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 400));

  // 1) Start menu — confirm touch hints grid is rendered, keyboard grid is absent.
  const isTouchInDom = await page.evaluate(() => {
    return !!document.querySelector('.menu-hints-touch');
  });
  const isKbInDom = await page.evaluate(() => {
    return !!document.querySelector('.menu.menu-start .menu-hints:not(.menu-hints-touch)');
  });
  const enterHintText = await page.evaluate(() => {
    const e = document.querySelector('.menu-enter-hint');
    return e ? e.textContent.trim() : null;
  });
  const touchChipCount = await page.evaluate(() => document.querySelectorAll('.touch-hint-chip').length);
  const touchIconCount = await page.evaluate(() => document.querySelectorAll('.touch-hint-icon').length);
  console.log(`Touch hints grid present: ${isTouchInDom}`);
  console.log(`Keyboard hints grid absent: ${!isKbInDom}`);
  console.log(`Enter hint text: "${enterHintText}"`);
  console.log(`Touch chips: ${touchChipCount}, touch icons: ${touchIconCount}`);
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: 'visual-mobile-start.png' });
  console.log('shot: visual-mobile-start.png');

  // 2) Fill profile, then open flag picker (mobile) — the modal should
  //    render correctly in a narrow viewport.
  await page.type('#profile-name', 'Rezwan');
  await page.click('#profile-flag');
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => {
    const btn = document.querySelector('.flag-cell[data-flag="🇧🇩"]');
    if (btn) btn.click();
    const confirm = document.querySelector('#flag-confirm');
    if (confirm) confirm.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.click('#profile-flag');
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: 'visual-mobile-flag-picker.png' });
  console.log('shot: visual-mobile-flag-picker.png');
  // close + re-confirm BD before play
  await page.evaluate(() => {
    const btn = document.querySelector('.flag-cell[data-flag="🇧🇩"]');
    if (btn) btn.click();
    const confirm = document.querySelector('#flag-confirm');
    if (confirm) confirm.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // 3) Play, force a game-over, then capture the panel.
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__game && window.__game.environment, { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => {
    const gm = window.__game.gameManager;
    if (gm && gm.triggerGameOver) gm.triggerGameOver();
  });
  await new Promise((r) => setTimeout(r, 800));

  const gameOverTouchClass = await page.evaluate(() => {
    const el = document.querySelector('.game-over');
    return el ? el.classList.contains('is-touch') : false;
  });
  const hintVisible = await page.evaluate(() => {
    const e = document.querySelector('.game-over-hint');
    if (!e) return null;
    return window.getComputedStyle(e).display !== 'none';
  });
  const btnVisible = await page.evaluate(() => {
    const e = document.querySelector('.game-over-restart');
    if (!e) return null;
    return window.getComputedStyle(e).display !== 'none';
  });
  const pauseHint = await page.evaluate(() => {
    // open the pause menu (touch) and read its hint text
    const gm = window.__game.gameManager;
    if (gm && gm.isPlaying()) gm.togglePause();
    return null;
  });
  // open pause menu
  await page.evaluate(() => {
    const gm = window.__game.gameManager;
    if (gm && (gm.isPlaying() || gm.isGameOver())) {
      // If game-over, can't pause — just skip the pause check.
    }
  });
  // Resume: tap the resume button OR click the in-game pause (top-right)
  // — the menu toggle we capture by directly calling pause from game state.
  // For the pause hint, start a fresh play, pause it, then read the hint.
  await page.evaluate(() => {
    const gm = window.__game.gameManager;
    if (gm && gm.isGameOver()) gm.resetGame();
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => {
    const gm = window.__game.gameManager;
    if (gm && gm.isPlaying()) gm.togglePause();
  });
  await new Promise((r) => setTimeout(r, 400));
  const pauseHintText = await page.evaluate(() => {
    const e = document.querySelector('.pause-hint');
    return e ? e.textContent.trim() : null;
  });
  const pauseIsTouchClass = await page.evaluate(() => {
    const m = document.querySelector('.menu.menu-pause');
    return m ? m.classList.contains('is-touch') : false;
  });
  console.log(`Game-over is-touch: ${gameOverTouchClass}`);
  console.log(`Game-over hint visible: ${hintVisible}`);
  console.log(`Game-over restart button visible: ${btnVisible}`);
  console.log(`Pause menu is-touch: ${pauseIsTouchClass}`);
  console.log(`Pause hint text: "${pauseHintText}"`);

  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: 'visual-mobile-pause.png' });
  console.log('shot: visual-mobile-pause.png');

  // 4) Force game-over again to capture the game-over panel.
  await page.evaluate(() => {
    const gm = window.__game.gameManager;
    if (gm && gm.isPaused()) gm.togglePause();   // un-pause
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const gm = window.__game.gameManager;
    if (gm && gm.triggerGameOver) gm.triggerGameOver();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: 'visual-mobile-game-over.png' });
  console.log('shot: visual-mobile-game-over.png');

  // 5) Tap the visible Restart button to confirm the click resets the run.
  const beforeReset = await page.evaluate(() => {
    return {
      visible: window.getComputedStyle(document.querySelector('.game-over')).display !== 'none',
      state: window.__game.gameManager.currentState()
    };
  });
  await page.click('#btn-game-over-restart');
  await new Promise((r) => setTimeout(r, 600));
  const afterReset = await page.evaluate(() => {
    return {
      visible: window.getComputedStyle(document.querySelector('.game-over')).display !== 'none',
      state: window.__game.gameManager.currentState()
    };
  });
  console.log(`Before tap: panel=${beforeReset.visible} state=${beforeReset.state}`);
  console.log(`After tap:  panel=${afterReset.visible} state=${afterReset.state}`);
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: 'visual-mobile-after-restart.png' });
  console.log('shot: visual-mobile-after-restart.png');

  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
