import puppeteer from 'puppeteer-core';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => {
    localStorage.removeItem('tode:profile');
    localStorage.removeItem('tode:leaderboard');
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  await page.click('#profile-flag');
  await new Promise(r => setTimeout(r, 400));
  const info = await page.evaluate(() => {
    const cells = document.querySelectorAll('.flag-cell');
    const out = [];
    for (let i = 0; i < Math.min(5, cells.length); i++) {
      const c = cells[i];
      const emoji = c.querySelector('.flag-emoji');
      out.push({
        dataFlag: c.getAttribute('data-flag'),
        dataCode: c.getAttribute('data-code'),
        title: c.getAttribute('title'),
        ariaLabel: c.getAttribute('aria-label'),
        emojiText: emoji?.textContent,
        emojiCodes: Array.from(emoji?.textContent || '').map(ch => ch.codePointAt(0).toString(16)),
        innerHTML: c.innerHTML
      });
    }
    return out;
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch(err => { console.error('CRASH:', err); process.exit(1); });
