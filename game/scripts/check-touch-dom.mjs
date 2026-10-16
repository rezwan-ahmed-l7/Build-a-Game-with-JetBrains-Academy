// Diagnostic — dump body.children ordering + computed display on .controls-strip
// on a touch viewport. Used to verify CSS hiding rules actually apply.
import puppeteer from 'puppeteer-core';

const url = process.argv[2] || 'http://localhost:5173/';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  try { await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 }); } catch (e) {}
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => {
    localStorage.removeItem('tode:profile');
    localStorage.removeItem('tode:leaderboard');
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  await page.type('#profile-name', 'X');
  await page.click('#profile-flag');
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    const b = document.querySelector('.flag-cell[data-flag="🇧🇩"]');
    if (b) b.click();
    const c = document.querySelector('#flag-confirm');
    if (c) c.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.click('#btn-start');
  await new Promise(r => setTimeout(r, 1500));
  const dom = await page.evaluate(() => {
    const out = [];
    for (const el of document.body.children) {
      const cls = el.className || el.tagName;
      const cs = window.getComputedStyle(el);
      out.push({ tag: el.tagName, cls, display: cs.display });
    }
    const cs = document.querySelector('.controls-strip');
    return {
      children: out,
      hasTouchRoot: !!document.querySelector('.touch-root'),
      controlsStripDisplay: cs ? window.getComputedStyle(cs).display : 'missing',
      controlsStripComputedDisplay: cs ? window.getComputedStyle(cs).getPropertyValue('display') : null
    };
  });
  console.log(JSON.stringify(dom, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });