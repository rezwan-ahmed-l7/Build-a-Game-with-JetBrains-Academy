import puppeteer from 'puppeteer-core';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 760 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => {
    localStorage.removeItem('tode:profile');
    localStorage.removeItem('tode:leaderboard');
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  await page.click('#profile-flag');
  await new Promise((r) => setTimeout(r, 500));
  // Hover an Argentina cell so the pick card shows a real country
  await page.evaluate(() => {
    const btn = document.querySelector('.flag-cell[data-flag="🇦🇷"]');
    if (btn) {
      btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      btn.click();
    }
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: 'visual-flag-picker-mobile.png' });
  console.log('shot: visual-flag-picker-mobile.png');
  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
