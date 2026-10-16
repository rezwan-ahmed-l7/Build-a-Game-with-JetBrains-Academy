// Capture two screenshots a few frames apart to confirm enemy colors
// are stable (no flicker between frames).
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
  await new Promise((r) => setTimeout(r, 2000));

  await page.evaluate(async () => {
    const g = window.__game;
    g.player.group.position.set(0, 0, 0);
    g.player.group.visible = false;

    const mod = await import('/src/components/Enemy.js');
    const e = mod.createEnemy('chaser');
    e.group.position.set(0, 0, 8);
    g.scene.add(e.group);
    window.__testEnemy = e;
    await new Promise((r) => setTimeout(r, 1500));
  });

  await page.evaluate(() => {
    window.__game.__setFreezeCamera(true);
    const cam = window.__game.camera;
    cam.position.set(0, 0, 30);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 8);
    cam.zoom = 1.0;
    cam.updateProjectionMatrix();
  });

  // Capture two frames ~250ms apart — if enemy flickers, emissive will differ
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: 'visual-enemies-flicker-a.png' });
  await new Promise((r) => setTimeout(r, 250));
  await page.screenshot({ path: 'visual-enemies-flicker-b.png' });

  // Sample the gold-stripe pixel region across both frames and compare.
  const diff = await page.evaluate(() => {
    return new Promise((resolve) => {
      const cv1 = document.createElement('canvas');
      const cv2 = document.createElement('canvas');
      const img1 = new Image();
      const img2 = new Image();
      img1.onload = () => {
        img2.onload = () => {
          cv1.width = cv2.width = img1.width;
          cv1.height = cv2.height = img1.height;
          const c1 = cv1.getContext('2d');
          const c2 = cv2.getContext('2d');
          c1.drawImage(img1, 0, 0);
          c2.drawImage(img2, 0, 0);
          // Sample the central region (the enemy's body)
          const region = { x: 480, y: 280, w: 320, h: 200 };
          const d1 = c1.getImageData(region.x, region.y, region.w, region.h).data;
          const d2 = c2.getImageData(region.x, region.y, region.w, region.h).data;
          let total = 0;
          for (let i = 0; i < d1.length; i++) {
            total += Math.abs(d1[i] - d2[i]);
          }
          resolve({ total, samples: d1.length / 4 });
        };
        img2.src = 'visual-enemies-flicker-b.png?' + Date.now();
      };
      img1.src = 'visual-enemies-flicker-a.png?' + Date.now();
    });
  }).catch(() => null);

  console.log('enemies -> visual-enemies-flicker-a.png + -b.png');
  if (diff) {
    const avg = diff.total / diff.samples;
    console.log(`avg per-channel diff in body region: ${avg.toFixed(2)} (0 = identical, <5 = stable)`);
  }

  if (errors.length) {
    console.log('\n=== ERRORS ===');
    errors.forEach((e) => console.log(e));
  } else {
    console.log('no errors');
  }
  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
