// PowerUp factory. Each pickup is a small floating/bobbing mesh with a
// distinct color + glyph so the player can read it at a glance.

import * as THREE from 'three';

export const POWERUP_TYPES = {
  heal:   { name: 'heal',   color: 0xff5577, label: '+',   desc: 'Heal' },
  score:  { name: 'score',  color: 0xffd166, label: 'x2',  desc: 'Score x2' },
  speed:  { name: 'speed',  color: 0x4cc9f0, label: '>>',  desc: 'Speed Boost' },
  attack: { name: 'attack', color: 0x9ee7ff, label: '*',   desc: 'Long Attack' }
};

export function createPowerUp(type, x, y) {
  const def = POWERUP_TYPES[type] || POWERUP_TYPES.heal;

  const group = new THREE.Group();
  group.position.set(x, y, 8);

  // Core sphere
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(6, 1),
    new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.color,
      emissiveIntensity: 0.7,
      roughness: 0.4,
      metalness: 0.2
    })
  );
  core.castShadow = true;
  group.add(core);

  // Halo ring
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(8, 10, 24),
    new THREE.MeshBasicMaterial({
      color: def.color,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    })
  );
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

  // Label sprite (canvas texture for the glyph)
  const labelTex = makeLabel(def.label, def.color);
  const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true });
  const label = new THREE.Sprite(labelMat);
  label.scale.set(10, 10, 1);
  label.position.set(0, 0, 0);
  group.add(label);

  let life = 0;
  let lifetime = 14; // seconds before despawn
  let collected = false;

  function update(delta, time) {
    if (collected) return;
    life += delta;
    if (life >= lifetime) {
      // Mark for removal (caller will dispose)
      collected = true;
      return false;
    }
    // Bob + slow spin
    group.position.z = 8 + Math.sin(time * 2.4) * 2;
    group.rotation.z += delta * 0.8;
    core.rotation.x += delta * 1.2;
    core.rotation.y += delta * 1.5;

    // Last 3 seconds: blink
    const remaining = lifetime - life;
    if (remaining < 3) {
      const blink = Math.sin(time * 12) > 0;
      core.visible = blink;
    } else {
      core.visible = true;
    }
    return true;
  }

  function dispose() {
    core.geometry.dispose();
    core.material.dispose();
    halo.geometry.dispose();
    halo.material.dispose();
    labelMat.dispose();
    if (labelTex) labelTex.dispose();
  }

  function getType() { return def.name; }
  function isCollected() { return collected; }
  function markCollected() { collected = true; }
  function getPosition() { return group.position; }

  return { group, update, dispose, getType, isCollected, markCollected, getPosition };
}

function makeLabel(text, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.font = 'bold 80px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // White outline so glyphs read on any background
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeText(text, 64, 70);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 64, 70);
  // small color dot in corner
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.beginPath();
  ctx.arc(64, 110, 8, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
