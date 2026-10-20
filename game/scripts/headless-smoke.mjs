// Headless smoke test. Boots the dev server URL in Chrome, captures
// console messages and any uncaught exceptions, and prints them. Used
// to debug blank-screen issues without a real browser.

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const url = process.argv[2] || 'http://localhost:5181/';
const chromeCandidates = [
  process.env.CHROME_PATH,
  process.env.CHROMIUM_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  ...(process.platform === 'win32'
    ? ['C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe']
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'])
].filter(Boolean);
const chromePath = chromeCandidates.find((candidate) => existsSync(candidate));
if (!chromePath) {
  throw new Error('Chrome/Chromium not found. Set CHROME_PATH to the browser executable.');
}

(async () => {
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const logs = [];
  const errors = [];

  page.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${err.message}\n${err.stack || ''}`);
  });
  page.on('requestfailed', (req) => {
    errors.push(`[requestfailed] ${req.url()} - ${req.failure().errorText}`);
  });

  console.log(`\nNavigating to ${url}...\n`);
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
  } catch (e) {
    console.error('Navigation error:', e.message);
  }

  // Give the app time to run boot steps
  await new Promise((r) => setTimeout(r, 3000));

  // Read boot banner text
  const bannerText = await page.evaluate(() => {
    const el = document.getElementById('boot-banner');
    return el ? el.textContent : '(no boot banner)';
  });

  // Read the canvas pixel data to see if there's anything drawn
  const canvasState = await page.evaluate(() => {
    const c = document.querySelector('canvas.game');
    if (!c) return null;
    return { width: c.width, height: c.height, clientW: c.clientWidth, clientH: c.clientHeight };
  });

  // Take a screenshot
  await page.screenshot({ path: 'headless-screenshot.png' });

  console.log('=== BOOT BANNER ===');
  console.log(bannerText);
  console.log('\n=== CANVAS STATE ===');
  console.log(JSON.stringify(canvasState, null, 2));
  console.log('\n=== ERRORS ===');
  if (errors.length === 0) console.log('(none)');
  errors.forEach((e) => console.log(e));
  console.log('\n=== CONSOLE LOGS ===');
  if (logs.length === 0) console.log('(none)');
  logs.forEach((l) => console.log(l));

  await browser.close();
  console.log('\nScreenshot saved to headless-screenshot.png');
})().catch((err) => {
  console.error('TEST CRASHED:', err);
  process.exit(1);
});
