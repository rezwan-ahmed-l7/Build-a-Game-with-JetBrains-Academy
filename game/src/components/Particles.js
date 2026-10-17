// Lightweight pooled particle system. A single THREE.Points with a fixed
// pool of N "slots". Each slot has position, velocity, color, life, maxLife.
// We use additive blending so bursts glow nicely without bloom postprocessing.

import * as THREE from 'three';

const POOL = 480;
const ATTRIBUTES_PER_VERTEX = 9; // pos(3) + color(3) + size(1) + life(2) — life as float pair

export function createParticles(scene) {
  const positions = new Float32Array(POOL * 3);
  const colors = new Float32Array(POOL * 3);
  const sizes = new Float32Array(POOL);
  const alphas = new Float32Array(POOL);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

  // Round soft-edged sprite, generated in a canvas so we have no asset deps.
  const sprite = makeSpriteTexture();

  const material = new THREE.PointsMaterial({
    size: 1,
    map: sprite,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    opacity: 1
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  // Particle data kept on the CPU side.
  const data = new Array(POOL);
  for (let i = 0; i < POOL; i++) {
    data[i] = {
      active: false,
      vx: 0, vy: 0, vz: 0,
      r: 1, g: 1, b: 1,
      baseSize: 0,
      life: 0,
      maxLife: 0
    };
    // Park offscreen
    positions[i * 3 + 0] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = -10000;
    sizes[i] = 0;
    alphas[i] = 0;
  }

  // Hot-path scratch
  const _color = new THREE.Color();
  let writeIdx = 0;

  function spawn({ x, y, z, vx, vy, vz, r, g, b, size, life }) {
    // Find a free slot, starting from a rotating cursor for even distribution.
    for (let i = 0; i < POOL; i++) {
      const idx = (writeIdx + i) % POOL;
      if (!data[idx].active) {
        writeIdx = (idx + 1) % POOL;
        writeSlot(idx, { x, y, z, vx, vy, vz, r, g, b, size, life });
        return;
      }
    }
    // Pool exhausted — overwrite oldest
    writeSlot(writeIdx, { x, y, z, vx, vy, vz, r, g, b, size, life });
    writeIdx = (writeIdx + 1) % POOL;
  }

  function writeSlot(idx, p) {
    const d = data[idx];
    d.active = true;
    d.vx = p.vx; d.vy = p.vy; d.vz = p.vz;
    d.r = p.r; d.g = p.g; d.b = p.b;
    d.baseSize = p.size;
    d.life = p.life;
    d.maxLife = p.life;
    positions[idx * 3 + 0] = p.x;
    positions[idx * 3 + 1] = p.y;
    positions[idx * 3 + 2] = p.z;
    colors[idx * 3 + 0] = p.r;
    colors[idx * 3 + 1] = p.g;
    colors[idx * 3 + 2] = p.b;
    sizes[idx] = p.size;
    alphas[idx] = 1;
  }

  // Convenience: emit a circular burst of N particles around (x, y, z).
  // color is a hex int, e.g. 0xffaa55.
  function spawnBurst(x, y, z, opts = {}) {
    const count = opts.count ?? 14;
    const color = opts.color ?? 0xffd166;
    const speed = opts.speed ?? 80;
    const life = opts.life ?? 0.6;
    const size = opts.size ?? 6;
    const upBias = opts.upBias ?? 30;
    _color.setHex(color);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const s = speed * (0.6 + Math.random() * 0.6);
      spawn({
        x, y, z,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        vz: upBias + Math.random() * upBias,
        r: _color.r, g: _color.g, b: _color.b,
        size,
        life: life * (0.7 + Math.random() * 0.6)
      });
    }
  }

  // Footstep puff: a few particles falling near the ground.
  function spawnDust(x, y, z) {
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 6 + Math.random() * 8;
      spawn({
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        z: z + 0.5,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        vz: 6 + Math.random() * 10,
        r: 0.7, g: 0.65, b: 0.5,
        size: 4,
        life: 0.45
      });
    }
  }

  // Trail behind a moving object (e.g. dash)
  function spawnTrail(x, y, z, color = 0x9ee7ff, size = 4) {
    _color.setHex(color);
    spawn({
      x: x + (Math.random() - 0.5) * 2,
      y: y + (Math.random() - 0.5) * 2,
      z: z + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      vz: (Math.random() - 0.5) * 4,
      r: _color.r, g: _color.g, b: _color.b,
      size,
      life: 0.3
    });
  }

  function update(delta) {
    let dirty = false;
    for (let i = 0; i < POOL; i++) {
      const d = data[i];
      if (!d.active) continue;
      dirty = true;
      d.life -= delta;
      if (d.life <= 0) {
        d.active = false;
        positions[i * 3 + 2] = -10000;
        alphas[i] = 0;
        sizes[i] = 0;
        continue;
      }
      // Gravity-ish fall
      d.vz -= 90 * delta;
      // Light drag
      d.vx *= 0.96;
      d.vy *= 0.96;
      positions[i * 3 + 0] += d.vx * delta;
      positions[i * 3 + 1] += d.vy * delta;
      positions[i * 3 + 2] += d.vz * delta;
      const t = d.life / d.maxLife;
      alphas[i] = t;
      sizes[i] = d.baseSize * (0.4 + t * 0.6);
    }
    if (dirty) {
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
      geometry.attributes.aAlpha.needsUpdate = true;
    }
  }

  function dispose() {
    scene.remove(points);
    geometry.dispose();
    material.dispose();
    if (sprite) sprite.dispose();
  }

  return { spawnBurst, spawnDust, spawnTrail, update, dispose };
}

function makeSpriteTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
