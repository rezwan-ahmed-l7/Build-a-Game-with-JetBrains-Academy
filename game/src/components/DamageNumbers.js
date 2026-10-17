// Floating world-space damage numbers. Each number is a canvas-texture
// sprite that floats up and fades out.
// Textures are cached so common values (+1, +2, +15, etc.) don't
// recreate the canvas on every spawn — reduces GC pressure.

import * as THREE from 'three';

const POOL = 24;

// Shared texture cache: key = "text|color", value = CanvasTexture
const textureCache = new Map();

export function createDamageNumbers(scene) {
  const slots = [];
  for (let i = 0; i < POOL; i++) {
    const tex = makeNumberTexture('', '#ffffff');
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(20, 20, 1);
    sprite.visible = false;
    scene.add(sprite);
    slots.push({ sprite, mat, tex, life: 0, maxLife: 0, vy: 0, active: false });
  }

  let writeIdx = 0;

  function spawn(text, x, y, z, color = '#ffffff', opts = {}) {
    const slot = slots[writeIdx];
    writeIdx = (writeIdx + 1) % POOL;

    const cacheKey = text + '|' + color;
    let tex = textureCache.get(cacheKey);
    if (!tex) {
      tex = makeNumberTexture(text, color);
      textureCache.set(cacheKey, tex);
    }
    slot.mat.map = tex;
    slot.mat.needsUpdate = true;

    slot.sprite.position.set(x, y, z);
    slot.sprite.visible = true;
    slot.life = 0;
    slot.maxLife = opts.life ?? 0.9;
    slot.vy = opts.vy ?? 30;
    slot.active = true;
  }

  function update(delta, camera) {
    for (const slot of slots) {
      if (!slot.active) continue;
      slot.life += delta;
      if (slot.life >= slot.maxLife) {
        slot.sprite.visible = false;
        slot.active = false;
        continue;
      }
      const t = slot.life / slot.maxLife;
      slot.sprite.position.z += slot.vy * delta;
      slot.sprite.material.opacity = 1 - t;
      // Billboard: face camera
      if (camera) slot.sprite.quaternion.copy(camera.quaternion);
    }
  }

  function dispose() {
    for (const s of slots) {
      s.sprite.parent && s.sprite.parent.remove(s.sprite);
      s.mat.dispose();
      if (s.tex) s.tex.dispose();
    }
  }

  return { spawn, update, dispose };
}

function makeNumberTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 128);
  ctx.font = 'bold 80px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(text, 128, 64);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
