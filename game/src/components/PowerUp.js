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

// Shield — thicker ring for better visibility
function makeShieldGeometry() {
  const shape = new THREE.Shape();
  const outerR = 6;
  const innerR = 4.2;
  shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 2,
    bevelEnabled: true,
    bevelThickness: 0.5,
    bevelSize: 0.5,
    bevelSegments: 3,
    curveSegments: 24
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

// Magnet — spiral shape
function makeMagnetGeometry() {
  const shape = new THREE.Shape();
  // Spiral approximation using arcs
  const r = 5;
  shape.absarc(0, 0, r, 0, Math.PI * 1.5, false);
  // Inner spiral
  const inner = new THREE.Path();
  inner.absarc(0, 0, r * 0.6, Math.PI * 1.5, Math.PI * 2.5, true);
  shape.holes.push(inner);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 2,
    bevelEnabled: true,
    bevelThickness: 0.8,
    bevelSize: 0.6,
    bevelSegments: 3,
    curveSegments: 32
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
  const shapeMat = new THREE.MeshStandardMaterial({
    color: def.color,
    emissive: def.color,
    emissiveIntensity: 0.95,
    roughness: 0.25,
    metalness: 0.4
  });
  const shapeMesh = new THREE.Mesh(shapeGeom, shapeMat);
  shapeMesh.scale.setScalar(1.15);
  shapeMesh.castShadow = true;
  group.add(shapeMesh);

  // ----- Halo ring on the ground (sits under the floating icon) -----
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(9, 12, 32),
    new THREE.MeshBasicMaterial({
      color: def.accent,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.z = -7; // sit below the icon
  group.add(halo);

  // ----- Small ground shadow disc (so it reads as floating) -----
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(8, 24),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
      depthWrite: false
    })
  );
  shadow.rotation.x = Math.PI / 2;
  shadow.position.z = -7.5;
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
    // Subtle tilt so the shape never looks pasted on flat.
    shapeMesh.rotation.x = Math.sin(time * 1.4) * 0.08;

    // Halo pulses softly.
    const pulse = 0.45 + 0.25 * Math.sin(time * 3.2);
    halo.material.opacity = pulse;


    // Last 3 seconds: blink the icon (not the halo, so it's still findable).
    const remaining = lifetime - life;
    if (remaining < 3) {
      const blink = Math.sin(time * 12) > 0;
      shapeMesh.visible = blink;
      halo.visible = blink;
    } else {
      shapeMesh.visible = true;
      halo.visible = true;
    }
    return true;
  }

  function dispose() {
    shapeGeom.dispose();
    shapeMat.dispose();
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

// (makeLabel and roundRect removed — power-ups no longer carry a ground
// text label; the 3D shape itself communicates the buff.)
