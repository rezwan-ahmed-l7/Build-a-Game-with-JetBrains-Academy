// End-to-end smoke for the onboarding + leaderboard feature.
// Walks the user through: empty start menu → fill profile → play → die → see leaderboard.
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
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[console.error]', msg.text());
  });

  // Clear any prior profile/leaderboard so the run is reproducible
  try { await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 }); } catch (e) {}
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => {
    localStorage.removeItem('tode:profile');
    localStorage.removeItem('tode:leaderboard');
    localStorage.removeItem('tode:attempts');
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));

  await page.waitForSelector('#menu-start', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 400));

  // 1) Empty start menu — Play should be disabled, leaderboard empty
  const playDisabledBefore = await page.evaluate(() => {
    const b = document.querySelector('#btn-start');
    return b && b.disabled;
  });
  const emptyText = await page.evaluate(() => {
    const e = document.querySelector('.leaderboard-empty');
    return e ? e.textContent : null;
  });
  console.log(`Play disabled before profile: ${playDisabledBefore}`);
  console.log(`Leaderboard empty text: "${emptyText}"`);
  await page.screenshot({ path: 'visual-onboard-empty.png' });
  console.log('shot: visual-onboard-empty.png');

  // 2) Fill in name + flag
  await page.type('#profile-name', 'Rezwan');
  await page.click('#profile-flag');
  await new Promise((r) => setTimeout(r, 300));
  // Pick Bangladesh — cell click locks the pending pick, then "Use this
  // flag" commits it. Both clicks are required now.
  await page.evaluate(() => {
    const btn = document.querySelector('.flag-cell[data-flag="🇧🇩"]');
    if (btn) btn.click();
    const confirm = document.querySelector('#flag-confirm');
    if (confirm) confirm.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  const playDisabledAfter = await page.evaluate(() => {
    const b = document.querySelector('#btn-start');
    return b && b.disabled;
  });
  const chipText = await page.evaluate(() => document.querySelector('#profile-flag').textContent);
  console.log(`Play disabled after profile: ${playDisabledAfter}`);
  console.log(`Flag chip now: ${chipText}`);
  // Wait for the Noto Color Emoji web font to be ready so the chip renders
  // as an actual flag pictogram rather than the two-letter regional-
  // indicator fallback.
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: 'visual-onboard-filled.png' });
  console.log('shot: visual-onboard-filled.png');

  // 3) Open flag picker again to show the modal
  await page.click('#profile-flag');
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: 'visual-flag-picker.png' });
  console.log('shot: visual-flag-picker.png');
  // close it — pick something to confirm close-on-pick, then confirm.
  await page.evaluate(() => {
    const btn = document.querySelector('.flag-cell[data-flag="🇺🇸"]');
    if (btn) btn.click();
    const confirm = document.querySelector('#flag-confirm');
    if (confirm) confirm.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  // (We re-pick US so the test verifies the path remains stable; we'll
  // restore the BD choice before playing so the leaderboard shows BD.)
  await page.evaluate(() => {
    const btn = document.querySelector('.flag-cell[data-flag="🇧🇩"]');
    if (btn) btn.click();
    const confirm = document.querySelector('#flag-confirm');
    if (confirm) confirm.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // 4) Click Play, then force a game-over so we can capture the leaderboard submit
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__game && window.__game.environment, { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => {
    // Force a quick game-over: set health to 0 then trigger game over
    const hm = window.__game.health;
    // GameManager exposes triggerGameOver? If not, just call score.showGameOver via the same hook
    window.__game.environment.setMode('day');
    window.__game.environment.setPhase(0.5);
    // Drop the player to 0 HP via a direct call
    if (hm && hm.damage) {
      // Damage to 0; but it stops at 1 because damage 0 isn't a thing. Use takeDamage:
    }
  });
  // Cheaper path: directly invoke the game-over by simulating damage until death
  await page.evaluate(() => {
    // Most reliable: just call gameManager.triggerGameOver() if exposed; otherwise
    // set health to 1 and call takeDamage(1)
    const gm = window.__game.gameManager;
    if (gm && gm.triggerGameOver) gm.triggerGameOver();
  });
  await new Promise((r) => setTimeout(r, 800));

  // Capture game-over panel
  const rankText = await page.evaluate(() => {
    const r = document.querySelector('.game-over-rank');
    return r ? r.textContent : null;
  });
  console.log(`Game-over rank text: "${rankText}"`);
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: 'visual-game-over-rank.png' });
  console.log('shot: visual-game-over-rank.png');

  // 5) Refresh the page to confirm the leaderboard persists
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  await page.waitForSelector('#menu-start', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 400));

  const restoredName = await page.evaluate(() => document.querySelector('#profile-name').value);
  const restoredFlag = await page.evaluate(() => document.querySelector('#profile-flag').textContent);
  const rowCount = await page.evaluate(() => document.querySelectorAll('.leaderboard-row').length);
  const firstRow = await page.evaluate(() => {
    const r = document.querySelector('.leaderboard-row');
    if (!r) return null;
    return {
      rank: r.querySelector('.lb-rank')?.textContent,
      flag: r.querySelector('.lb-flag')?.textContent,
      name: r.querySelector('.lb-name')?.textContent,
      score: r.querySelector('.lb-score')?.textContent,
      isMine: r.classList.contains('is-mine')
    };
  });
  console.log(`Restored name: "${restoredName}", flag: ${restoredFlag}`);
  console.log(`Leaderboard rows: ${rowCount}, first: ${JSON.stringify(firstRow)}`);
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: 'visual-leaderboard.png' });
  console.log('shot: visual-leaderboard.png');

  // 6) Mobile responsive check at 400px
  await page.setViewport({ width: 400, height: 720 });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: 'visual-leaderboard-mobile.png' });
  console.log('shot: visual-leaderboard-mobile.png');

  // 7) localStorage check
  const ls = await page.evaluate(() => ({
    profile: localStorage.getItem('tode:profile'),
    board: localStorage.getItem('tode:leaderboard')
  }));
  console.log('localStorage profile:', ls.profile);
  console.log('localStorage leaderboard:', ls.board);

  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
