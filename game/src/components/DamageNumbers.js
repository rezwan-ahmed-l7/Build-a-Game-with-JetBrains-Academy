// Floating world-space damage numbers. Each number is a canvas-texture
// sprite that floats up and fades out.
// Textures are cached so common values (+1, +2, +15, etc.) don't
// recreate the canvas on every spawn — reduces GC pressure.

import * as THREE from 'three';

const POOL = 24;
// Cap the texture cache to keep the GPU from accumulating one-off glyphs
// (e.g. the long "⬆ Lv. 4!" string only seen once per level-up).
const MAX_CACHE_ENTRIES = 64;

// Shared texture cache: key = "kind|text|color", value = CanvasTexture
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

    const kind = opts.kind || 'default';
    // Cache key now includes kind so 'crit' and 'default' variants of
    // the same number don't share a texture (different layout).
    const cacheKey = kind + '|' + text + '|' + color;
    let tex = textureCache.get(cacheKey);
    if (!tex) {
      tex = makeNumberTexture(text, color, kind);
      textureCache.set(cacheKey, tex);
      // Evict oldest entry if cache grew past the budget.
      if (textureCache.size > MAX_CACHE_ENTRIES) {
        const oldest = textureCache.keys().next().value;
        const stale = textureCache.get(oldest);
        textureCache.delete(oldest);
        if (stale && stale.dispose) stale.dispose();
      }
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

// Icon glyph drawn to the left of the number. `kind` is the same string
// passed to spawn() (crit / heal / power); falls back to no icon for
// any unrecognized kind so the layout stays predictable.
const ICON_KIND = {
  crit: 'crit',
  heal: 'heal',
  power: 'star',
};

function makeNumberTexture(text, color, kind = 'default') {
  const c = document.createElement('canvas');
  // Wider canvas when there's a leading icon so the number doesn't
  // crowd into the glyph.
  const iconKind = ICON_KIND[kind];
  const w = iconKind ? 320 : 256;
  const h = 128;
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.font = 'bold 80px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';

  if (iconKind) {
    drawIcon(ctx, iconKind, 60, 64, 60, color);
    ctx.strokeText(text, 200, 64);
    ctx.fillStyle = color;
    ctx.fillText(text, 200, 64);
  } else {
    ctx.strokeText(text, w / 2, h / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// Draws a simple icon glyph into the canvas. Painted with the same
// stroke + fill as the number so it visually reads as one unit. Kept
// procedural (no SVG, no font deps) so it works everywhere and stays
// crisp at any sprite scale.
function drawIcon(ctx, kind, cx, cy, size, color) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.fillStyle = color;
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (kind === 'crit') {
    // Lightning bolt — two-segment polyline.
    ctx.beginPath();
    ctx.moveTo(cx + size * 0.20, cy - size * 0.50);
    ctx.lineTo(cx - size * 0.30, cy + size * 0.05);
    ctx.lineTo(cx + size * 0.05, cy + size * 0.05);
    ctx.lineTo(cx - size * 0.20, cy + size * 0.50);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'heal') {
    // Plus sign — two crossed bars.
    const t = size * 0.45;
    const w = size * 0.18;
    ctx.fillRect(cx - w / 2, cy - t, w, t * 2);
    ctx.fillRect(cx - t, cy - w / 2, t * 2, w);
    ctx.fill();
    ctx.strokeRect(cx - w / 2, cy - t, w, t * 2);
    ctx.strokeRect(cx - t, cy - w / 2, t * 2, w);
  } else if (kind === 'star') {
    // 5-point star.
    const points = 5;
    const outer = size * 0.50;
    const inner = size * 0.22;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
