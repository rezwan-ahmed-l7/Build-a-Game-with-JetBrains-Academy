// Inspect the enemy GLB by spawning one through the game's own loader
// and walking the resulting model.
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

  try { await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 }); } catch (e) {}
  await new Promise((r) => setTimeout(r, 1500));

  await page.evaluate(() => {
    const btn = document.querySelector('#btn-start');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  const result = await page.evaluate(async () => {
    const mod = await import('/src/components/Enemy.js');
    const e = mod.createEnemy('chaser');
    // Wait for GLB to load
    for (let i = 0; i < 60 && !e.getModel(); i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    const m = e.getModel();
    if (!m) return { error: 'no model' };
    const meshes = [];
    m.traverse((c) => {
      if (!c.isMesh) return;
      const mat = c.material;
      meshes.push({
        name: c.name,
        matName: mat?.name || '?',
        color: mat?.color ? '#' + mat.color.getHexString() : null,
        emissive: mat?.emissive ? '#' + mat.emissive.getHexString() : null,
        emissiveIntensity: mat?.emissiveIntensity ?? null,
        hasMap: !!mat?.map,
        roughness: mat?.roughness ?? null,
        metalness: mat?.metalness ?? null
      });
    });
    return { count: meshes.length, meshes };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
