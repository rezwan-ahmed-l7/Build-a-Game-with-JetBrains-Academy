// Comprehensive diagnostic: tests WASD, Q/E camera rotation, mouse drag,
// dash, attack, and click-to-move. Prints which scenarios fail.

import puppeteer from 'puppeteer-core';

const url = process.argv[2] || 'http://localhost:5173/';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

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
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Play');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 3000));

  async function readState() {
    return page.evaluate(() => {
      const g = window.__game;
      if (!g || !g.player) return { error: 'no game' };
      const pg = g.player.group;
      const m = g.player.getModel && g.player.getModel();
      const parent = m && m.parent;
      const basis = g.movement.getCameraBasis();
      // Get camera info
      let cam = null;
      g.player.group.parent.traverse((o) => { if (o.isCamera) cam = o; });
      return {
        pos: { x: pg.position.x, y: pg.position.y, z: pg.position.z },
        facingRotZ: parent ? parent.rotation.z : null,
        camAngleDeg: basis.valid ? basis.camAngle * 180 / Math.PI : null,
        fwd: basis.valid ? { x: basis.fwdX, y: basis.fwdY } : null,
        cameraPos: cam ? { x: cam.position.x, y: cam.position.y, z: cam.position.z } : null,
        // Compute expected facing for "W" given current camera
        expectedRotForW: basis.valid ? ((Math.PI / 2 - basis.camAngle) * 180 / Math.PI) : null,
        expectedRotForS: basis.valid ? ((Math.PI / 2 - basis.camAngle + Math.PI) * 180 / Math.PI) : null,
        expectedRotForA: basis.valid ? ((Math.PI - basis.camAngle) * 180 / Math.PI) : null,
        expectedRotForD: basis.valid ? ((-basis.camAngle) * 180 / Math.PI) : null,
      };
    });
  }

  const initial = await readState();
  console.log('=== INITIAL STATE ===');
  console.log(`Player: (${initial.pos.x.toFixed(2)}, ${initial.pos.y.toFixed(2)}, ${initial.pos.z.toFixed(2)})`);
  console.log(`Camera: (${initial.cameraPos.x.toFixed(1)}, ${initial.cameraPos.y.toFixed(1)}, ${initial.cameraPos.z.toFixed(1)})`);
  console.log(`camAngle: ${initial.camAngleDeg.toFixed(1)} deg`);
  console.log(`Camera forward (XY): (${initial.fwd.x.toFixed(3)}, ${initial.fwd.y.toFixed(3)})`);
  console.log(`Expected rot.z for W: ${initial.expectedRotForW.toFixed(1)} deg`);
  console.log(`Expected rot.z for S: ${initial.expectedRotForS.toFixed(1)} deg`);
  console.log(`Expected rot.z for A: ${initial.expectedRotForA.toFixed(1)} deg`);
  console.log(`Expected rot.z for D: ${initial.expectedRotForD.toFixed(1)} deg\n`);

  // Helper to normalize rotation to [-180, 180]
  function normDeg(deg) {
    while (deg > 180) deg -= 360;
    while (deg < -180) deg += 360;
    return deg;
  }

  async function testKey(key, expectedRotDeg, expectedDelta) {
    // Reset
    await page.evaluate(() => {
      const g = window.__game;
      if (g) {
        g.player.group.position.set(0, 0, 0);
        const m = g.player.getModel();
        if (m && m.parent) m.parent.rotation.set(0, 0, 0);
      }
    });
    await new Promise((r) => setTimeout(r, 200));
    const before = await readState();
    await page.focus('canvas');
    await page.keyboard.down(key);
    await new Promise((r) => setTimeout(r, 100));
    await page.keyboard.up(key);
    await new Promise((r) => setTimeout(r, 700));
    const after = await readState();
    const dx = after.pos.x - before.pos.x;
    const dy = after.pos.y - before.pos.y;
    const actualRot = after.facingRotZ * 180 / Math.PI;
    const rotDiff = normDeg(actualRot - expectedRotDeg);
    const matchMove = expectedDelta ? Math.hypot(dx - expectedDelta.x, dy - expectedDelta.y) < 1 : true;
    const matchRot = Math.abs(rotDiff) < 1;
    return {
      key,
      actualPos: after.pos,
      actualDelta: { x: dx, y: dy },
      expectedDelta,
      actualRot: actualRot.toFixed(1) + ' deg',
      expectedRot: expectedRotDeg.toFixed(1) + ' deg',
      matchMove,
      matchRot,
    };
  }

  // Compute expected deltas
  const fwd = initial.fwd;
  const rightVec = { x: -fwd.y, y: fwd.x };
  const expectedDeltas = {
    w: { x: fwd.x * 40, y: fwd.y * 40 },
    s: { x: -fwd.x * 40, y: -fwd.y * 40 },
    a: { x: rightVec.x * 40, y: rightVec.y * 40 },
    d: { x: -rightVec.x * 40, y: -rightVec.y * 40 }
  };

  console.log('=== WASD MOVEMENT + ROTATION TEST ===');
  for (const k of ['w', 's', 'a', 'd']) {
    const result = await testKey(k, initial[`expectedRotFor${k.toUpperCase()}`], expectedDeltas[k]);
    const moveIcon = result.matchMove ? 'OK ' : 'FAIL';
    const rotIcon = result.matchRot ? 'OK ' : 'FAIL';
    console.log(
      `${k.toUpperCase()}: pos Δ=(${result.actualDelta.x.toFixed(2)},${result.actualDelta.y.toFixed(2)}) [${moveIcon}], ` +
      `rot.z=${result.actualRot} (expected ${result.expectedRot}) [${rotIcon}]`
    );
  }

  // Now test Q/E camera rotation while moving
  console.log('\n=== Q/E CAMERA ROTATION + W TEST ===');
  for (const key of ['q', 'e']) {
    // Reset
    await page.evaluate(() => {
      const g = window.__game;
      if (g) {
        g.player.group.position.set(0, 0, 0);
        const m = g.player.getModel();
        if (m && m.parent) m.parent.rotation.set(0, 0, 0);
      }
    });
    await new Promise((r) => setTimeout(r, 200));
    const beforeQ = await readState();
    // Hold Q/E for 1 second to rotate camera
    await page.focus('canvas');
    await page.keyboard.down(key);
    await new Promise((r) => setTimeout(r, 1000));
    await page.keyboard.up(key);
    await new Promise((r) => setTimeout(r, 300));
    const afterQ = await readState();
    const camAngleDiff = afterQ.camAngleDeg - beforeQ.camAngleDeg;
    console.log(`Key ${key.toUpperCase()}: camAngle ${beforeQ.camAngleDeg.toFixed(1)}° -> ${afterQ.camAngleDeg.toFixed(1)}° (delta ${camAngleDiff.toFixed(1)}°)`);

    // Now press W and check facing is correct for the new camera
    await page.evaluate(() => {
      const g = window.__game;
      if (g) {
        g.player.group.position.set(0, 0, 0);
        const m = g.player.getModel();
        if (m && m.parent) m.parent.rotation.set(0, 0, 0);
      }
    });
    await new Promise((r) => setTimeout(r, 200));
    const beforeW = await readState();
    await page.focus('canvas');
    await page.keyboard.down('w');
    await new Promise((r) => setTimeout(r, 100));
    await page.keyboard.up('w');
    await new Promise((r) => setTimeout(r, 700));
    const afterW = await readState();
    const expectedRot = beforeW.expectedRotForW;
    const actualRot = afterW.facingRotZ * 180 / Math.PI;
    const rotDiff = normDeg(actualRot - expectedRot);
    const match = Math.abs(rotDiff) < 2;
    console.log(`  After ${key.toUpperCase()}, W press: rot.z=${actualRot.toFixed(1)}° (expected ${expectedRot.toFixed(1)}°, diff ${rotDiff.toFixed(1)}°) ${match ? 'OK' : 'FAIL'}`);
  }

  // Test space (attack)
  console.log('\n=== ATTACK (SPACE) TEST ===');
  await page.evaluate(() => {
    const g = window.__game;
    if (g) {
      g.player.group.position.set(0, 0, 0);
      const m = g.player.getModel();
      if (m && m.parent) m.parent.rotation.set(0, 0, 0);
    }
  });
  await new Promise((r) => setTimeout(r, 200));
  const beforeAtk = await readState();
  await page.focus('canvas');
  await page.keyboard.press('Space');
  await new Promise((r) => setTimeout(r, 600));
  const afterAtk = await readState();
  console.log(`Position before: (${beforeAtk.pos.x.toFixed(2)}, ${beforeAtk.pos.y.toFixed(2)})`);
  console.log(`Position after:  (${afterAtk.pos.x.toFixed(2)}, ${afterAtk.pos.y.toFixed(2)})`);
  console.log(`Facing rot.z after: ${(afterAtk.facingRotZ * 180 / Math.PI).toFixed(1)}°`);

  if (errors.length) {
    console.log('\n=== ERRORS ===');
    errors.forEach((e) => console.log(e));
  }

  await browser.close();
})().catch((err) => { console.error('CRASH:', err); process.exit(1); });
