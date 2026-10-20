// PowerUp factory. Each pickup is a small floating/bobbing mesh shaped
// like the thing it represents (heart, star, lightning bolt, sword) so
// the player can read it at a glance — no glyph memorization needed.
//
// Shapes are built with THREE.Shape + ExtrudeGeometry so they're real 3D
// geometry, readable from the top-down 3rd-person camera angle.

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Power-up definitions
// ---------------------------------------------------------------------------
// Each entry has a 3D shape (built by makeXxx), a primary color, an
// accent (used for the ring + light tint), and a short desc string.
// ---------------------------------------------------------------------------
export const POWERUP_TYPES = {
  heal:         { name: 'heal',         color: 0xff4d77, accent: 0xff8aa8, label: 'HEAL',         desc: '+1 HP' },
  score:        { name: 'score',        color: 0xffd166, accent: 0xffe39a, label: 'SCORE',        desc: '+8 Bonus' },
  speed:        { name: 'speed',        color: 0x4cc9f0, accent: 0x9ee7ff, label: 'SPEED',        desc: 'Move x1.7 for 8s' },
  attack:       { name: 'attack',       color: 0xb0e8ff, accent: 0x4cc9f0, label: 'ATTACK',       desc: 'Radius x1.85 for 10s' },
  shield:       { name: 'shield',       color: 0xffffff, accent: 0xcccccc, label: 'SHIELD',       desc: '5s Invincibility' },
  doubleAttack: { name: 'doubleAttack', color: 0xffdd44, accent: 0xffee88, label: '2X ATTACK',    desc: '2x Damage 8s' },
  magnet:       { name: 'magnet',       color: 0xaa88ff, accent: 0xccbbff, label: 'MAGNET',       desc: 'Auto-pickup 10s' },
  freeze:       { name: 'freeze',       color: 0x88ddff, accent: 0xaaffff, label: 'FREEZE',       desc: 'Freeze 3s' }
};

// ---------------------------------------------------------------------------
// Shape builders — each returns a THREE.BufferGeometry, scaled to roughly
// fit inside a 12-unit radius (so they read well from a distance).
// ---------------------------------------------------------------------------

// Heart — two top lobes + bottom point. Classic Valentine shape.
function makeHeartGeometry() {
  const shape = new THREE.Shape();
  const x = 0, y = 0;
  shape.moveTo(x, y + 2);
  shape.bezierCurveTo(x, y + 5, x - 6, y + 7, x - 6, y + 4);
  shape.bezierCurveTo(x - 6, y + 1, x - 3, y - 1, x, y - 4);
  shape.bezierCurveTo(x + 3, y - 1, x + 6, y + 1, x + 6, y + 4);
  shape.bezierCurveTo(x + 6, y + 7, x, y + 5, x, y + 2);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 3,
    bevelEnabled: true,
    bevelThickness: 1.2,
    bevelSize: 1.0,
    bevelSegments: 4,
    curveSegments: 16
  });
  geom.center();
  // World is Z-up. ExtrudeGeometry puts the silhouette in the XY plane
  // and extrudes depth along +Z — exactly what we want for a top-down
  // camera that looks down the -Z axis. No rotation needed.
  return geom;
}

// 5-pointed star — classic video-game shape.
function makeStarGeometry() {
  const shape = new THREE.Shape();
  const points = 5;
  const outer = 6.5;
  const inner = 2.6;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 2.2,
    bevelEnabled: true,
    bevelThickness: 1.0,
    bevelSize: 0.9,
    bevelSegments: 3,
    curveSegments: 1
  });
  geom.center();
  return geom;
}

// Lightning bolt — stylized Z shape.
function makeLightningGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-1.5, 6);
  shape.lineTo(2.5, 6);
  shape.lineTo(0.5, 0.5);
  shape.lineTo(3, 0.5);
  shape.lineTo(-2, -6);
  shape.lineTo(-0.5, -0.5);
  shape.lineTo(-3, -0.5);
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 2.2,
    bevelEnabled: true,
    bevelThickness: 0.8,
    bevelSize: 0.7,
    bevelSegments: 3,
    curveSegments: 1
  });
  geom.center();
  return geom;
}

// Sword — diamond blade + crossguard + hilt. Built as a single Extrude.
function makeSwordGeometry() {
  const s = new THREE.Shape();
  // Blade tip
  s.moveTo(0, 7);
  // Right side of blade
  s.lineTo(1.6, 4);
  s.lineTo(1.2, -1);
  // Right side of crossguard
  s.lineTo(4, -1.2);
  s.lineTo(4, -2.8);
  s.lineTo(1.2, -2.8);
  // Right side of hilt
  s.lineTo(0.9, -6);
  s.lineTo(2.4, -6.5);
  s.lineTo(2.4, -7.2);
  s.lineTo(-2.4, -7.2);
  s.lineTo(-2.4, -6.5);
  s.lineTo(-0.9, -6);
  s.lineTo(-1.2, -2.8);
  // Left side of crossguard
  s.lineTo(-4, -2.8);
  s.lineTo(-4, -1.2);
  s.lineTo(-1.2, -1);
  // Left side of blade
  s.lineTo(-1.6, 4);
  s.closePath();
  const geom = new THREE.ExtrudeGeometry(s, {
    depth: 1.6,
    bevelEnabled: true,
    bevelThickness: 0.6,
    bevelSize: 0.5,
    bevelSegments: 2,
    curveSegments: 1
  });
  geom.center();
  return geom;
}

// Shield — solid heraldic crest silhouette (readable at gameplay distance).
function makeShieldGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 7);
  shape.lineTo(5.5, 5);
  shape.lineTo(5, 0.5);
  shape.lineTo(3.5, -3);
  shape.lineTo(0, -6.5);
  shape.lineTo(-3.5, -3);
  shape.lineTo(-5, 0.5);
  shape.lineTo(-5.5, 5);
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 2.8,
    bevelEnabled: true,
    bevelThickness: 0.8,
    bevelSize: 0.65,
    bevelSegments: 4,
    curveSegments: 8
  });
  geom.center();
  return geom;
}

// Double Attack — two separate lightning bolts
function makeDoubleAttackGeometry() {
  // Left bolt
  const s1 = new THREE.Shape();
  s1.moveTo(-3.5, 5);
  s1.lineTo(-1.5, 5);
  s1.lineTo(-2.5, 1);
  s1.lineTo(-0.5, 1);
  s1.lineTo(-3.5, -5);
  s1.lineTo(-2.5, -1);
  s1.lineTo(-4.5, -1);
  s1.closePath();
  const g1 = new THREE.ExtrudeGeometry(s1, {
    depth: 2.2, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.7, bevelSegments: 3, curveSegments: 1
  });
  // Right bolt
  const s2 = new THREE.Shape();
  s2.moveTo(0.5, 5);
  s2.lineTo(2.5, 5);
  s2.lineTo(1.5, 1);
  s2.lineTo(3.5, 1);
  s2.lineTo(0.5, -5);
  s2.lineTo(1.5, -1);
  s2.lineTo(-0.5, -1);
  s2.closePath();
  const g2 = new THREE.ExtrudeGeometry(s2, {
    depth: 2.2, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.7, bevelSegments: 3, curveSegments: 1
  });
  // Merge into one geometry
  const geom = mergeGeometries([g1, g2]);
  g1.dispose();
  g2.dispose();
  return geom;
}

// Simple geometry merger
function mergeGeometries(geoms) {
  let totalVerts = 0;
  let totalIdx = 0;
  for (const g of geoms) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : g.attributes.position.count;
  }
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIdx);
  let vOffset = 0;
  let iOffset = 0;
  let idxCount = 0;
  for (const g of geoms) {
    const pos = g.attributes.position.array;
    const nor = g.attributes.normal ? g.attributes.normal.array : null;
    positions.set(pos, vOffset * 3);
    if (nor) normals.set(nor, vOffset * 3);
    const count = g.attributes.position.count;
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) {
        indices[idxCount++] = g.index.array[i] + vOffset;
      }
    } else {
      for (let i = 0; i < count; i++) {
        indices[idxCount++] = i + vOffset;
      }
    }
    vOffset += count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

// Magnet — unmistakable U silhouette instead of a spiral-like ring.
function makeMagnetGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-5.5, 6);
  shape.lineTo(-5.5, -0.5);
  shape.lineTo(-4.8, -3.2);
  shape.lineTo(-2.8, -5.4);
  shape.lineTo(0, -6.2);
  shape.lineTo(2.8, -5.4);
  shape.lineTo(4.8, -3.2);
  shape.lineTo(5.5, -0.5);
  shape.lineTo(5.5, 6);
  shape.lineTo(2.5, 6);
  shape.lineTo(2.5, -0.5);
  shape.lineTo(1.8, -2.2);
  shape.lineTo(0, -3);
  shape.lineTo(-1.8, -2.2);
  shape.lineTo(-2.5, -0.5);
  shape.lineTo(-2.5, 6);
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 2.6,
    bevelEnabled: true,
    bevelThickness: 0.8,
    bevelSize: 0.55,
    bevelSegments: 3,
    curveSegments: 4
  });
  geom.center();
  return geom;
}

// Freeze — snowflake shape (6-pointed star)
function makeFreezeGeometry() {
  const shape = new THREE.Shape();
  const points = 6;
  const outer = 6;
  const inner = 2.5;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 2,
    bevelEnabled: true,
    bevelThickness: 0.8,
    bevelSize: 0.7,
    bevelSegments: 3,
    curveSegments: 1
  });
  geom.center();
  return geom;
}

const SHAPE_BUILDERS = {
  heal: makeHeartGeometry,
  score: makeStarGeometry,
  speed: makeLightningGeometry,
  attack: makeSwordGeometry,
  shield: makeShieldGeometry,
  doubleAttack: makeDoubleAttackGeometry,
  magnet: makeMagnetGeometry,
  freeze: makeFreezeGeometry
};

// ---------------------------------------------------------------------------
// PowerUp factory
// ---------------------------------------------------------------------------
export function createPowerUp(type, x, y) {
  const def = POWERUP_TYPES[type] || POWERUP_TYPES.heal;
  const buildShape = SHAPE_BUILDERS[type] || SHAPE_BUILDERS.heal;

  const group = new THREE.Group();
  group.position.set(x, y, 8);

  // ----- The iconic shape -----
  // Slightly oversized so it reads from the top-down camera.
  const shapeGeom = buildShape();
  // Accent silhouette sits just behind the main icon, creating a crisp
  // colored edge without a ground ring or an expensive point light.
  const outlineGeom = shapeGeom.clone();
  const outlineMat = new THREE.MeshStandardMaterial({
    color: def.accent,
    emissive: def.accent,
    emissiveIntensity: 0.35,
    roughness: 0.32,
    metalness: 0.18,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });
  const outlineMesh = new THREE.Mesh(outlineGeom, outlineMat);
  outlineMesh.scale.setScalar(1.31);
  outlineMesh.position.z = -1.15;
  outlineMesh.castShadow = false;
  group.add(outlineMesh);

  const shapeMat = new THREE.MeshStandardMaterial({
    color: def.color,
    emissive: def.color,
    emissiveIntensity: 0.55,
    roughness: 0.3,
    metalness: 0.28
  });
  const shapeMesh = new THREE.Mesh(shapeGeom, shapeMat);
  shapeMesh.scale.setScalar(1.15);
  shapeMesh.castShadow = true;
  shapeMesh.renderOrder = 2;
  group.add(shapeMesh);

  // ----- Halo ring hidden — user prefers no visible circle -----
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(9, 12, 32),
    new THREE.MeshBasicMaterial({
      color: def.accent,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.z = -7;
  halo.visible = false;
  group.add(halo);

  // ----- Ground shadow disc hidden -----
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(8, 24),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  shadow.rotation.x = Math.PI / 2;
  shadow.position.z = -7.5;
  shadow.visible = false;
  group.add(shadow);

  // Glow comes from the emissive material above — no PointLight needed
  // to avoid per-power-up render pass overhead.

  // (No ground text label — the shape itself communicates the power-up.
  // Adding text would compete with the icon and clutter the field.)

  let life = 0;
  let lifetime = 20; // seconds before despawn
  let collected = false;

  function update(delta, time) {
    if (collected) return false;
    life += delta;
    if (life >= lifetime) {
      collected = true;
      return false;
    }

    // Bob + slow spin so the shape is always presenting its 3D-ness to the camera.
    group.position.z = 8 + Math.sin(time * 2.4) * 2;
    // Spin the shape on Y so different facets catch the light.
    shapeMesh.rotation.y += delta * 1.2;
    outlineMesh.rotation.y = shapeMesh.rotation.y;
    // Subtle tilt so the shape never looks pasted on flat.
    shapeMesh.rotation.x = Math.sin(time * 1.4) * 0.08;
    outlineMesh.rotation.x = shapeMesh.rotation.x;

    // Last 3 seconds: blink both layers together; keep the ground ring hidden.
    const remaining = lifetime - life;
    if (remaining < 3) {
      const blink = Math.sin(time * 12) > 0;
      shapeMesh.visible = blink;
      outlineMesh.visible = blink;
    } else {
      shapeMesh.visible = true;
      outlineMesh.visible = true;
    }
    halo.visible = false;
    return true;
  }

  function dispose() {
    shapeGeom.dispose();
    shapeMat.dispose();
    outlineGeom.dispose();
    outlineMat.dispose();
    halo.geometry.dispose();
    halo.material.dispose();
    shadow.geometry.dispose();
    shadow.material.dispose();
  }

  // No light to dispose — glow is handled by emissive material.

  function getType() { return def.name; }
  function isCollected() { return collected; }
  function markCollected() { collected = true; }
  function getPosition() { return group.position; }

  return { group, update, dispose, getType, isCollected, markCollected, getPosition };
}


// A highly readable, emissive treasure chest used only for the rare Mystery Box.
// Built from lightweight primitives (no textures or external assets).
export function createMysteryBox(x, y) {
  const group = new THREE.Group();
  group.position.set(x, y, 8);
  const materials = [];
  const material = (color, emissive, intensity = 0.7, metalness = 0.55) => {
    const m = new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: intensity,
      roughness: 0.28, metalness
    });
    materials.push(m);
    return m;
  };
  const gold = material(0xffc247, 0xff9f1c, 1.15);
  const goldBright = material(0xffe7a0, 0xffc247, 1.35);
  const purple = material(0x522b9b, 0x6428d9, 1.0, 0.35);
  const dark = material(0x21143c, 0x36155f, 0.35, 0.3);
  const mint = material(0x8ffff0, 0x32f5dd, 1.5, 0.25);

  const body = new THREE.Mesh(new THREE.BoxGeometry(20, 15, 11), purple);
  body.position.z = 0;
  group.add(body);
  const front = new THREE.Mesh(new THREE.BoxGeometry(21, 1.5, 12), gold);
  front.position.set(0, -7.5, 0);
  group.add(front);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 5), gold);
  lid.position.set(0, 6.7, 3.8);
  lid.rotation.x = -0.08;
  group.add(lid);
  const lidTop = new THREE.Mesh(new THREE.BoxGeometry(19, 1.6, 5.4), goldBright);
  lidTop.position.set(0, 9.9, 4.2);
  group.add(lidTop);
  const lockBase = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3.5, 2.4), goldBright);
  lockBase.position.set(0, -1.5, 6.6);
  group.add(lockBase);
  const lockGem = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), mint);
  lockGem.position.set(0, -1.5, 8.4);
  group.add(lockGem);
  const sideA = new THREE.Mesh(new THREE.BoxGeometry(1.5, 12, 12), goldBright);
  sideA.position.x = -8.5;
  group.add(sideA);
  const sideB = sideA.clone();
  sideB.position.x = 8.5;
  group.add(sideB);

  const aura = new THREE.Mesh(
    new THREE.TorusGeometry(18, 0.65, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0xb77aff, transparent: true, opacity: 0.85 })
  );
  aura.rotation.x = Math.PI / 2;
  aura.position.z = -5;
  group.add(aura);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(24, 0.45, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.6 })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.z = -6;
  group.add(halo);

  // Three floating glints make the rare pickup readable even in a busy arena.
  const glints = [];
  for (let i = 0; i < 3; i++) {
    const glint = new THREE.Mesh(new THREE.OctahedronGeometry(1.7, 0), i === 1 ? mint : goldBright);
    glint.position.set(Math.cos(i * Math.PI * 2 / 3) * 22, Math.sin(i * Math.PI * 2 / 3) * 22, 7 + i * 1.5);
    group.add(glint);
    glints.push(glint);
  }

  let life = 0;
  let collected = false;
  function update(delta, time) {
    if (collected) return false;
    life += delta;
    if (life >= 20) { collected = true; return false; }
    group.position.z = 8 + Math.sin(time * 3.2) * 2.3;
    group.rotation.z = Math.sin(time * 1.15) * 0.045;
    const pulse = 1 + Math.sin(time * 5.5) * 0.045;
    aura.scale.setScalar(pulse);
    halo.scale.setScalar(1 + Math.sin(time * 4.1 + 1) * 0.035);
    aura.material.opacity = 0.58 + (Math.sin(time * 6) + 1) * 0.17;
    halo.material.opacity = 0.38 + (Math.sin(time * 4.7) + 1) * 0.16;
    glints.forEach((glint, i) => {
      glint.position.z = 7 + i * 1.5 + Math.sin(time * 4 + i * 2) * 2;
      glint.rotation.x += delta * (1.2 + i * 0.3);
      glint.rotation.y += delta * (1.6 + i * 0.2);
    });
    return true;
  }
  function dispose() {
    group.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else if (obj.material && !materials.includes(obj.material)) obj.material.dispose();
    });
    materials.forEach((m) => m.dispose());
  }
  return {
    group, update, dispose,
    getPosition: () => group.position,
    isCollected: () => collected,
    markCollected: () => { collected = true; }
  };
}

// (makeLabel and roundRect removed — power-ups no longer carry a ground
// text label; the 3D shape itself communicates the buff.)
