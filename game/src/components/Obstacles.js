import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mulberry32 } from '../utils/rng.js';
import { WORLD_RADIUS } from './WorldBounds.js';

// Layout counts. Tuned for a forest you can SEE from the player but
// not run into every two steps. We bias placement to the outer ring so
// the immediate play area stays open and the trees form a horizon line.
const TREE_COUNT = 180;          // balanced forest — fewer trees for better performance
const BUSH_COUNT = 50;
const BIG_ROCK_COUNT = 28;
const SMALL_ROCK_COUNT = 40;
const STUMP_COUNT = 14;
const GRASS_TUFT_COUNT = 90;
const MUSHROOM_COUNT = 30;
const LILY_PAD_COUNT = 9;        // around the pond
const POND_COUNT = 3;            // multiple ponds scattered across the meadow
// How much smaller the additional ponds are compared to the main one
const SMALL_POND_SCALE_MIN = 0.45;
const SMALL_POND_SCALE_MAX = 0.65;
const HOUSE_COUNT = 3;

// Player has a clear arena to move around — no trees, rocks or houses inside.
const PLAYER_CLEARING_RADIUS = 90;
// Trees should be a comfortable distance from each other (a real forest
// has canopy gaps the player can see through).
const TREE_SPACING_MIN = 22;
// Inner forest ring — most of the trees live outside this radius so the
// player can move freely, but they still form a visible forest border.
const FOREST_INNER_RADIUS = 115;
// Outer band where 80% of the trees go (creates the horizon forest look).
const FOREST_OUTER_BIAS = 0.8;
const CLEARING_RADIUS = 40;
const POND_EXCLUSION_RADIUS = 48;  // keep other obstacles away from pond

const TREE_COLLISION_RADIUS = 12;
const BIG_ROCK_COLLISION_RADIUS = 9;
const STUMP_COLLISION_RADIUS = 4;
const HOUSE_COLLISION_RADIUS = 14;

const _color = new THREE.Color();
const _greenTint = new THREE.Color();

function snapToGround(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  mesh.position.z -= box.min.z;
  return box;
}

// Give each boulder an irregular footprint and a lower, grounded silhouette.
// Soft distortion: small per-vertex jitter so rocks don't look like
// perfectly-smooth balls, but nothing so aggressive that the silhouette
// reads as jagged/spiky.
function distortGeometry(geo, rand, flatness) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const lower = z < 0 ? 0.72 : 1.0;
    pos.setXYZ(
      i,
      x * (0.95 + rand() * 0.10),     // mild X jitter
      y * (0.95 + rand() * 0.10),     // mild Y jitter
      z * (0.85 + rand() * 0.10) * lower * (flatness / 0.55)
    );
  }
  geo.computeVertexNormals();
}

// ---------- Tree builders ----------

// Pine / fir — tall conifer with visible trunk, layered conical
// canopy, and slight color variation per layer for realism.
function makePineTree(rand) {
  const group = new THREE.Group();
  // Bigger trees — real conifers in the wild are 20-40m tall.
  const height = 38 + rand() * 14;

  // Exposed trunk under the canopy (taller + thicker than before)
  const trunkHeight = height * 0.30;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 2.1, trunkHeight, 8),
    new THREE.MeshStandardMaterial({
      color: 0x4a2e1a,
      roughness: 1.0,
      metalness: 0,
      flatShading: true
    })
  );
  trunk.rotation.x = Math.PI / 2;
  trunk.position.z = trunkHeight / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // Foliage color varies subtly per tree (cold dark green for conifers)
  const baseHue = 0.30 + (rand() - 0.5) * 0.05;
  const baseSat = 0.58 + rand() * 0.12;
  const baseLight = 0.18 + rand() * 0.05;

  // 5-6 stacked cone layers for a fuller, more realistic silhouette
  const layers = 5 + Math.floor(rand() * 2);
  let z = trunkHeight;
  const baseRadius = 7.0 + rand() * 1.8;
  for (let i = 0; i < layers; i++) {
    const t = i / Math.max(1, layers - 1);
    // Cone narrows from base (t=0) to top (t=1)
    const r = baseRadius * (1 - t * 0.55);
    const h = 7.5 + rand() * 2.0;
    // Slightly lighter green for upper layers, darker for lower (depth)
    const layerLight = baseLight + t * 0.05;
    _greenTint.setHSL(baseHue, baseSat, layerLight);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 8),
      new THREE.MeshStandardMaterial({
        color: _greenTint.getHex(),
        roughness: 0.95,
        metalness: 0,
        flatShading: true
      })
    );
    cone.rotation.x = Math.PI / 2;
    // Each layer overlaps the one below so no gaps show in silhouette
    cone.position.z = z + h * 0.42;
    // Tiny random horizontal offset so the cone stack isn't a perfect
    // totem pole — real trees lean a bit
    cone.position.x = (rand() - 0.5) * 0.8;
    cone.position.y = (rand() - 0.5) * 0.8;
    cone.castShadow = true;
    cone.receiveShadow = true;
    group.add(cone);
    z += h * 0.62;
  }
  return { group, totalHeight: z };
}

// Broadleaf — taller oak-style tree with a thicker trunk and a fuller,
// more spherical canopy built from many overlapping blobs at varied
// heights and colors (mimics the dappled light/shadow inside a real
// leafy crown).
function makeBroadleafTree(rand) {
  const group = new THREE.Group();
  // Bigger overall
  const height = 36 + rand() * 14;

  // Thicker trunk with a hint of taper and visible top "stub" where
  // the first branches fan out
  const trunkHeight = height * 0.58;
  const trunkR = 1.6 + rand() * 0.5;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.55, trunkR, trunkHeight, 7),
    new THREE.MeshStandardMaterial({
      color: 0x6b4a2a,
      roughness: 1.0,
      metalness: 0,
      flatShading: true
    })
  );
  trunk.rotation.x = Math.PI / 2;
  trunk.position.z = trunkHeight / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // Base foliage color (lighter / warmer than conifer)
  const baseHue = 0.24 + (rand() - 0.5) * 0.06;
  const baseSat = 0.55 + rand() * 0.18;
  const baseLight = 0.28 + rand() * 0.08;

  // 6-8 canopy blobs at varying heights for a fuller crown
  const blobs = 6 + Math.floor(rand() * 3);
  const canopy = new THREE.Group();
  const canopyHeight = height - trunkHeight;
  for (let i = 0; i < blobs; i++) {
    // Larger central blob, smaller satellite blobs
    const r = (i === 0 ? 5.4 : 2.6 + rand() * 1.6);
    // Vary the lightness slightly per blob — sunlit side vs shadow side
    const lightVar = (i === 0 ? 0 : (rand() - 0.5) * 0.10);
    _greenTint.setHSL(baseHue + (rand() - 0.5) * 0.02,
                      baseSat,
                      Math.max(0.18, baseLight + lightVar));
    const blob = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 1),
      new THREE.MeshStandardMaterial({
        color: _greenTint.getHex(),
        roughness: 0.95,
        metalness: 0,
        flatShading: true
      })
    );
    // Random horizontal scatter so the canopy is irregular
    const ang = rand() * Math.PI * 2;
    const dist = (i === 0 ? 0 : rand() * 2.4);
    blob.position.x = Math.cos(ang) * dist;
    blob.position.y = Math.sin(ang) * dist;
    // Stack blobs vertically through the crown height (some lower,
    // some higher) — gives a full 3D mass rather than a flat dome.
    blob.position.z = (i === 0
      ? canopyHeight * 0.55
      : (rand() * canopyHeight * 0.95) - 0.5);
    // Squash blobs slightly so they look like foliage clumps not balloons
    blob.scale.set(1.0 + rand() * 0.4, 0.85 + rand() * 0.3, 0.85 + rand() * 0.35);
    blob.castShadow = true;
    blob.receiveShadow = true;
    canopy.add(blob);
  }
  canopy.position.z = trunkHeight + 1.0;
  group.add(canopy);

  // A couple of visible branch tips sticking up out of the canopy to
  // give the silhouette a less-perfect, more natural feel.
  for (let i = 0; i < 2; i++) {
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, 2.5 + rand() * 1.5, 5),
      new THREE.MeshStandardMaterial({
        color: 0x5e3e22, roughness: 1.0, flatShading: true
      })
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.x = (rand() - 0.5) * 3.0;
    tip.position.y = (rand() - 0.5) * 3.0;
    tip.position.z = trunkHeight + canopyHeight + rand() * 0.6;
    group.add(tip);
  }

  return { group, totalHeight: trunkHeight + canopyHeight + 2 };
}

// Bush — low, multi-blob, no collision
function makeBush(rand) {
  const group = new THREE.Group();
  _greenTint.setHSL(0.26 + (rand() - 0.5) * 0.08,
                    0.55 + rand() * 0.20,
                    0.22 + rand() * 0.10);
  const foliageColor = _greenTint.getHex();

  const blobs = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < blobs; i++) {
    const r = 1.0 + rand() * 0.7;
    const blob = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 1),
      new THREE.MeshStandardMaterial({
        color: foliageColor,
        roughness: 0.95,
        metalness: 0,
        flatShading: true
      })
    );
    const ang = rand() * Math.PI * 2;
    const dist = rand() * 0.9;
    blob.position.x = Math.cos(ang) * dist;
    blob.position.y = Math.sin(ang) * dist;
    blob.position.z = r * 0.6;
    blob.castShadow = true;
    blob.receiveShadow = true;
    group.add(blob);
  }
  return { group };
}

// Big boulder — smooth gray with a top "moss" cap. Higher subdivision +
// gentle distortion = no jagged facets, just a rounded weathered stone.
function makeBigRock(rand) {
  const group = new THREE.Group();
  const size = 4.0 + rand() * 3.2;
  // 2 subdivisions → ~162 verts vs 12 for 1 subdivision. Smooth silhouette.
  const geo = new THREE.IcosahedronGeometry(size, 2);
  distortGeometry(geo, rand, 0.52);
  const baseGray = 0.25 + rand() * 0.07;
  const rockMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseGray - 0.02, baseGray, baseGray + 0.02),
    roughness: 0.95,
    metalness: 0,
    flatShading: false  // smooth shading — clean curves, not facets
  });
  const rock = new THREE.Mesh(geo, rockMat);
  rock.castShadow = true;
  rock.receiveShadow = true;
  group.add(rock);

  // Moss cap (top half): a slightly smaller copy in a mossy green
  const mossGeo = new THREE.SphereGeometry(size * 0.60, 12, 8);
  const mossMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x2f512b),
    roughness: 1.0,
    metalness: 0,
    flatShading: false
  });
  const moss = new THREE.Mesh(mossGeo, mossMat);
  moss.position.z = size * 0.22;
  moss.scale.set(1.0 + rand() * 0.12, 0.9 + rand() * 0.10, 0.24);
  moss.castShadow = false;
  moss.receiveShadow = true;
  group.add(moss);

  return { group, size };
}

function makeSmallRock(rand) {
  const size = 0.8 + rand() * 1.0;
  // Higher subdivision + smooth shading for the small pebbles too —
  // they read as clean river stones rather than shards.
  const geo = new THREE.IcosahedronGeometry(size, 2);
  distortGeometry(geo, rand, 0.48);
  const baseGray = 0.42 + rand() * 0.16;
  const rock = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseGray, baseGray, baseGray + 0.01),
      roughness: 0.95,
      metalness: 0,
      flatShading: false
    })
  );
  rock.castShadow = true;
  rock.receiveShadow = true;
  return { mesh: rock, size };
}

function makeStump(rand) {
  const radius = 1.6 + rand() * 1.0;
  const height = 2.4 + rand() * 1.2;
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.85, radius, height, 8),
    new THREE.MeshStandardMaterial({
      color: 0x4a2e1c,
      roughness: 1.0,
      metalness: 0,
      flatShading: true
    })
  );
  body.rotation.x = Math.PI / 2;
  body.position.z = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Top rings
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.85, 8),
    new THREE.MeshStandardMaterial({
      color: 0x8a5a30,
      roughness: 0.9,
      metalness: 0
    })
  );
  // CircleGeometry already lies in the XY ground plane (Z-up world).
  top.position.z = height;
  top.receiveShadow = true;
  group.add(top);

  // Moss collar
  const moss = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.95, 0.35, 6, 12),
    new THREE.MeshStandardMaterial({
      color: 0x2a4a26,
      roughness: 1.0,
      metalness: 0,
      flatShading: true
    })
  );
  moss.position.z = height * 0.7;
  group.add(moss);

  return { group, size: radius };
}

// Single grass tuft — 3-5 thin blades.
function makeGrassTuft(rand) {
  const group = new THREE.Group();
  const bladeColor = new THREE.Color().setHSL(
    0.25 + (rand() - 0.5) * 0.06,
    0.55 + rand() * 0.20,
    0.30 + rand() * 0.10
  );
  const mat = new THREE.MeshStandardMaterial({
    color: bladeColor,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide
  });
  const blades = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < blades; i++) {
    const h = 1.4 + rand() * 1.4;
    const blade = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, h, 1, 2),
      mat
    );
    blade.rotation.x = Math.PI / 2;
    blade.position.x = (rand() - 0.5) * 0.7;
    blade.position.y = (rand() - 0.5) * 0.7;
    blade.position.z = h / 2;
    // tip a little in a random direction
    blade.rotation.z = (rand() - 0.5) * 0.6;
    // No shadow casting (too many small meshes) but they receive shadow.
    blade.castShadow = false;
    blade.receiveShadow = true;
    group.add(blade);
  }
  return group;
}

// Mushroom cluster — bioluminescent (guides the eye at night)
function makeMushroomCluster(rand) {
  const cluster = new THREE.Group();
  const mushroomColors = [0x70e7bb, 0x79b7ff, 0xf6a6e8, 0xffd27a, 0xff8fbf];
  const count = 2 + Math.floor(rand() * 2);
  for (let j = 0; j < count; j++) {
    const radius = 0.9 + rand() * 0.8;
    const height = 2.0 + rand() * 1.6;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.25, radius * 0.35, height, 6),
      new THREE.MeshStandardMaterial({ color: 0xc8c1a4, roughness: 0.9 })
    );
    stem.rotation.x = Math.PI / 2;
    stem.position.set((j - 1) * 2.1, rand() * 1.8 - 0.9, height * 0.5);
    const color = mushroomColors[Math.floor(rand() * mushroomColors.length)];
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 8, 6),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.65,
        roughness: 0.65,
        flatShading: true
      })
    );
    cap.scale.z = 0.55;
    cap.position.set(stem.position.x, stem.position.y, height + 0.25);
    stem.castShadow = false;
    cap.castShadow = false;
    cluster.add(stem, cap);
  }
  return cluster;
}

// Lily pad for the pond
function makeLilyPad(rand) {
  const r = 1.6 + rand() * 0.8;
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(r, 8),
    new THREE.MeshStandardMaterial({
      color: 0x1f4a2a,
      roughness: 0.7,
      metalness: 0,
      side: THREE.DoubleSide
    })
  );
  pad.rotation.x = Math.PI / 2;
  // Notch by subtracting a triangle via group? Simpler: just place an
  // emissive bud on top so it reads as a lily from above.
  const hasFlower = rand() < 0.55;
  if (hasFlower) {
    const flowerColor = new THREE.Color().setHSL(0.95 + rand() * 0.05, 0.6, 0.65);
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 6, 4),
      new THREE.MeshStandardMaterial({
        color: flowerColor,
        emissive: flowerColor,
        emissiveIntensity: 0.6,
        roughness: 0.5
      })
    );
    flower.scale.z = 0.4;
    flower.position.z = 0.15;
    pad.add(flower);
  }
  return pad;
}

// Place a random position avoiding a list of points with custom per-point
// exclusion radii. `avoid` is an array of {x, y, r?} — r is the extra
// clearance the new point must keep from this avoid point (so we can
// keep trees well clear of pond water).
function placeRandomlyWithRadii(rand, avoid, minDist) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = rand() * Math.PI * 2;
    const r = Math.sqrt(CLEARING_RADIUS ** 2 + rand() * (WORLD_RADIUS ** 2 - CLEARING_RADIUS ** 2));
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    let ok = true;
    for (const p of avoid) {
      const dx = x - p.x;
      const dy = y - p.y;
      const need = minDist + (p.r || 0);
      if (Math.sqrt(dx * dx + dy * dy) < need) { ok = false; break; }
    }
    if (ok) return { x, y };
  }
  const angle = rand() * Math.PI * 2;
  const r = CLEARING_RADIUS + rand() * (WORLD_RADIUS - CLEARING_RADIUS);
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

// Build a pond: water disc + animated ripple ring + lily pads + edge rocks + cattails
function makePond(rand, scale = 1.0) {
  const group = new THREE.Group();
  const baseRadius = 70 + rand() * 18;
  const radius = baseRadius * scale;

  // Water surface (lighter teal that picks up the sky color so it doesn't
  // read as a black blob at dusk; the high metalness gives it a subtle
  // sky-reflection feel without needing actual cube maps).
  // side: DoubleSide so the disc reads as a flat pond from any camera
  // angle (otherwise a low camera can see only the back face and it
  // looks like a wall rising out of the ground).
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2a6a78,
    roughness: 0.30,
    metalness: 0.45,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide
  });
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    waterMat
  );
  // The game's coordinate system is Z-up — the ground plane is XY, with
  // Z as height. CircleGeometry's default plane is also XY with normal
  // pointing +Z, so it's ALREADY flat on the ground. No rotation needed.
  // (Earlier code rotated it +90° around X, which tipped the disc onto
  // its edge and made it appear as a vertical wall from the camera.)
  water.position.z = 0.05;          // just above ground so it never z-fights
  water.receiveShadow = true;
  group.add(water);

  // Animated ripple ring
  const rippleMat = new THREE.MeshBasicMaterial({
    color: 0x9ee7ff,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.30, radius * 0.36, 48),
    rippleMat
  );
  // Z-up world — ripple lies flat on the XY plane with no rotation.
  ripple.position.z = 0.2;
  group.add(ripple);

  // Lily pads, scattered around inner 70% of pond
  const lilyPads = [];
  for (let i = 0; i < LILY_PAD_COUNT; i++) {
    const pad = makeLilyPad(rand);
    const ang = rand() * Math.PI * 2;
    const r = rand() * radius * 0.7;
    pad.position.x = Math.cos(ang) * r;
    pad.position.y = Math.sin(ang) * r;
    pad.position.z = 0.05;
    pad.rotation.z = rand() * Math.PI * 2;
    group.add(pad);
    lilyPads.push(pad);
  }

  // Edge rocks (lighter warm gray so they read as stones, not black blobs
  // in low light / at dusk).
  const edgeRockMat = new THREE.MeshStandardMaterial({
    color: 0x6e6358,
    roughness: 0.92,
    metalness: 0,
    flatShading: true
  });
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + (rand() - 0.5) * 0.18;
    const r = radius + 1 + rand() * 2;
    const sz = 1.4 + rand() * 1.4;
    const stone = new THREE.Mesh(
      new THREE.IcosahedronGeometry(sz, 0),
      edgeRockMat
    );
    distortGeometry(stone.geometry, rand, 0.45);
    stone.position.x = Math.cos(ang) * r;
    stone.position.y = Math.sin(ang) * r;
    stone.position.z = sz * 0.4;
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }

  // Cattails (tall thin reeds) on the edge
  const cattailMat = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.9 });
  const cattailHeadMat = new THREE.MeshStandardMaterial({
    color: 0x6b4a26, roughness: 0.9, emissive: 0x6b4a26, emissiveIntensity: 0.05
  });
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + (rand() - 0.5) * 0.4;
    const r = radius + 3 + rand() * 4;
    const h = 5 + rand() * 4;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.20, h, 5),
      cattailMat
    );
    stem.rotation.x = Math.PI / 2;
    stem.position.set(Math.cos(ang) * r, Math.sin(ang) * r, h / 2);
    const head = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 1.6, 6),
      cattailHeadMat
    );
    head.rotation.x = Math.PI / 2;
    head.position.set(stem.position.x, stem.position.y, h - 0.4);
    group.add(stem, head);
  }

  return { group, radius, water, ripple, lilyPads };
}

function placeRandomly(rand, avoid, minDist) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const angle = rand() * Math.PI * 2;
    const r = Math.sqrt(CLEARING_RADIUS ** 2 + rand() * (WORLD_RADIUS ** 2 - CLEARING_RADIUS ** 2));
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    let ok = true;
    for (const p of avoid) {
      const dx = x - p.x;
      const dy = y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < minDist) { ok = false; break; }
    }
    if (ok) return { x, y };
  }
  const angle = rand() * Math.PI * 2;
  const r = CLEARING_RADIUS + rand() * (WORLD_RADIUS - CLEARING_RADIUS);
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

// Tree placement: bias toward the outer forest ring so the player has a
// comfortable clearing to move around in. Uses a "soft ring" — most
// trees land between FOREST_INNER_RADIUS and WORLD_RADIUS, but a small
// minority can be inside the inner ring to break the silhouette.
function placeTree(rand, avoid, minDist) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const angle = rand() * Math.PI * 2;
    // FOREST_OUTER_BIAS fraction of trees go in the outer band.
    // The rest pick anywhere from CLEARING_RADIUS to WORLD_RADIUS (with
    // sqrt-distribution so outer is still slightly more likely).
    let r;
    if (rand() < FOREST_OUTER_BIAS) {
      r = FOREST_INNER_RADIUS + rand() * (WORLD_RADIUS - FOREST_INNER_RADIUS);
    } else {
      r = Math.sqrt(CLEARING_RADIUS ** 2 + rand() * (FOREST_INNER_RADIUS ** 2 - CLEARING_RADIUS ** 2));
    }
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    let ok = true;
    for (const p of avoid) {
      const dx = x - p.x;
      const dy = y - p.y;
      const need = minDist + (p.r || 0);
      if (Math.sqrt(dx * dx + dy * dy) < need) { ok = false; break; }
    }
    if (ok) return { x, y };
  }
  // Fallback: a position in the outer ring.
  const angle = rand() * Math.PI * 2;
  const r = FOREST_INNER_RADIUS + rand() * (WORLD_RADIUS - FOREST_INNER_RADIUS);
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

export function createObstacles(scene) {
  const obstacles = [];
  const rand = mulberry32(12345);
  const placed = [];
  // Ponds get a generous exclusion zone so trees / rocks don't end up
  // standing on the water. Each entry is {x, y, r} where r is the extra
  // clearance from that point.
  const pondAvoid = [];
  // A virtual "avoid" entry at the origin representing the player spawn.
  // The radius is the player's clearing — no obstacles in this disc.
  const playerAvoid = [{ x: 0, y: 0, r: PLAYER_CLEARING_RADIUS }];

  // ----- Ponds (placed first; other obstacles avoid them) -----
  // One large main pond + two smaller satellite ponds scattered in
  // different parts of the meadow. Each pond placement enforces a
  // minimum spacing from previously placed ponds so they never bunch up.
  const POND_MIN_SPACING = 360;  // world units between pond centers
  const ponds = [];
  for (let p = 0; p < POND_COUNT; p++) {
    const isMain = p === 0;
    const scale = isMain
      ? 1.0
      : SMALL_POND_SCALE_MIN + rand() * (SMALL_POND_SCALE_MAX - SMALL_POND_SCALE_MIN);

    let placed2 = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      const angle = rand() * Math.PI * 2;
      // Main pond sits a bit closer to the action; smaller ponds spread
      // out further so they appear in different regions of the world.
      // Also keep the ponds outside the player clearing so the player
      // spawn area stays dry.
      const minR = Math.max(CLEARING_RADIUS + POND_EXCLUSION_RADIUS, PLAYER_CLEARING_RADIUS + 60);
      const maxR = isMain ? 220 : 480;
      const r = minR + rand() * (maxR - minR);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;

      // Skip if too close to any other pond
      let tooClose = false;
      for (const other of ponds) {
        const dx = x - other.x;
        const dy = y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Need at least POND_MIN_SPACING + both ponds' radii of clearance
        const need = POND_MIN_SPACING + other.radius + (70 * scale);
        if (dist < need) { tooClose = true; break; }
      }
      if (tooClose) continue;

      const pond = makePond(rand, scale);
      pond.group.position.x = x;
      pond.group.position.y = y;
      scene.add(pond.group);
      const pondRadius = 70 * scale;
      ponds.push({ x, y, radius: pondRadius, ref: pond });
      // Pond exclusion = water radius + a small extra buffer (15) so trees
      // don't visually graze the edge of the pond.
      pondAvoid.push({ x, y, r: pondRadius + 15 });
      placed2 = true;
      break;
    }
    if (!placed2) {
      // Fallback: place at a far corner so we always get the full count.
      const fallbackAngle = rand() * Math.PI * 2;
      const fr = 320 + rand() * 60;
      const fx = Math.cos(fallbackAngle) * fr;
      const fy = Math.sin(fallbackAngle) * fr;
      const pond = makePond(rand, scale);
      pond.group.position.x = fx;
      pond.group.position.y = fy;
      scene.add(pond.group);
      const pondRadius = 70 * scale;
      ponds.push({ x: fx, y: fy, radius: pondRadius, ref: pond });
      pondAvoid.push({ x: fx, y: fy, r: pondRadius + 15 });
    }
  }
  // Ponds have no collision (player walks around them visually)

  // ----- Trees (mixed pine + broadleaf) -----
  // Trees live primarily in the outer ring so the player has breathing room.
  // In addition, every tree must stay clear of pond water and (lightly)
  // clear of other trees so canopy gaps remain visible.
  for (let i = 0; i < TREE_COUNT; i++) {
    const isBroadleaf = rand() < 0.4;
    const { group, totalHeight } = isBroadleaf
      ? makeBroadleafTree(rand)
      : makePineTree(rand);
    // Combine: keep clear of player spawn, of pond water, and of other trees.
    const avoid = playerAvoid.concat(pondAvoid, placed);
    const pos = placeTree(rand, avoid, TREE_SPACING_MIN);
    placed.push(pos);
    group.position.x = pos.x;
    group.position.y = pos.y;
    group.rotation.z = rand() * Math.PI * 2;
    snapToGround(group);
    scene.add(group);
    obstacles.push({
      position: { x: pos.x, y: pos.y },
      radius: TREE_COLLISION_RADIUS
    });
  }

  // ----- Bushes (low, dense, non-colliding) -----
  for (let i = 0; i < BUSH_COUNT; i++) {
    const { group } = makeBush(rand);
    const avoid = playerAvoid.concat(pondAvoid, placed);
    const pos = placeRandomlyWithRadii(rand, avoid, 7);
    placed.push(pos);
    group.position.x = pos.x;
    group.position.y = pos.y;
    group.rotation.z = rand() * Math.PI * 2;
    snapToGround(group);
    scene.add(group);
  }

  // ----- Big boulders (with moss cap) -----
  for (let i = 0; i < BIG_ROCK_COUNT; i++) {
    const { group, size } = makeBigRock(rand);
    const avoid = playerAvoid.concat(pondAvoid, placed);
    const pos = placeRandomlyWithRadii(rand, avoid, 22);
    placed.push(pos);
    group.position.x = pos.x;
    group.position.y = pos.y;
    group.rotation.z = rand() * Math.PI * 2;
    snapToGround(group);
    scene.add(group);
    obstacles.push({
      position: { x: pos.x, y: pos.y },
      radius: BIG_ROCK_COLLISION_RADIUS + size
    });
  }

  // ----- Small pebbles (no collision) -----
  for (let i = 0; i < SMALL_ROCK_COUNT; i++) {
    const { mesh } = makeSmallRock(rand);
    const avoid = playerAvoid.concat(pondAvoid, placed);
    const pos = placeRandomlyWithRadii(rand, avoid, 5);
    placed.push(pos);
    mesh.position.x = pos.x;
    mesh.position.y = pos.y;
    mesh.rotation.z = rand() * Math.PI * 2;
    snapToGround(mesh);
    scene.add(mesh);
  }

  // ----- Stumps -----
  for (let i = 0; i < STUMP_COUNT; i++) {
    const { group, size } = makeStump(rand);
    const avoid = playerAvoid.concat(pondAvoid, placed);
    const pos = placeRandomlyWithRadii(rand, avoid, 18);
    placed.push(pos);
    group.position.x = pos.x;
    group.position.y = pos.y;
    group.rotation.z = rand() * Math.PI * 2;
    snapToGround(group);
    scene.add(group);
    obstacles.push({
      position: { x: pos.x, y: pos.y },
      radius: STUMP_COLLISION_RADIUS + size
    });
  }

  // ----- Grass tufts (decorative) -----
  for (let i = 0; i < GRASS_TUFT_COUNT; i++) {
    const group = makeGrassTuft(rand);
    const avoid = playerAvoid.concat(pondAvoid, placed);
    const pos = placeRandomlyWithRadii(rand, avoid, 4);
    group.position.x = pos.x;
    group.position.y = pos.y;
    group.rotation.z = rand() * Math.PI * 2;
    group.position.z = 0;
    scene.add(group);
  }

  // ----- Mushroom clusters (bioluminescent) -----
  for (let i = 0; i < MUSHROOM_COUNT; i++) {
    const cluster = makeMushroomCluster(rand);
    const avoid = playerAvoid.concat(pondAvoid, placed);
    const pos = placeRandomlyWithRadii(rand, avoid, 12);
    placed.push(pos);
    cluster.position.set(pos.x, pos.y, 0);
    cluster.rotation.z = rand() * Math.PI * 2;
    scene.add(cluster);
  }

  // ----- Houses (GLB) -----
  const housePositions = [];
  const houseLoader = new GLTFLoader();
  for (let i = 0; i < HOUSE_COUNT; i++) {
    const avoid = playerAvoid.concat(pondAvoid, placed);
    const pos = placeRandomlyWithRadii(rand, avoid, 60);
    placed.push(pos);
    housePositions.push(pos);
    houseLoader.load(
      '/models/small_house.glb',
      (gltf) => {
        const house = gltf.scene;
        house.position.set(pos.x, pos.y, 0);
        house.rotation.z = rand() * Math.PI * 2;
        house.scale.setScalar(2.0);
        house.traverse((c) => {
          if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });
        scene.add(house);
      },
      undefined,
      (err) => { console.warn('Failed to load house model:', err); }
    );
  }
  // Add houses to the collision obstacle list so neither enemies nor player can pass through.
  for (const pos of housePositions) {
    obstacles.push({
      position: { x: pos.x, y: pos.y },
      radius: HOUSE_COLLISION_RADIUS
    });
  }

  // Animation hook: ripple expands, lily pads bob. Called from main loop.
  // Animates every pond with a small phase offset so the ripples aren't
  // perfectly synchronized.
  let pondTime = 0;
  function updatePond(delta) {
    pondTime += delta;
    for (let p = 0; p < ponds.length; p++) {
      const pond = ponds[p].ref;
      const phase = pondTime * 0.6 + p * 0.33;
      const t = phase % 1;
      pond.ripple.scale.setScalar(1 + t * 0.7);
      pond.ripple.material.opacity = 0.45 * (1 - t);
      for (let i = 0; i < pond.lilyPads.length; i++) {
        const pad = pond.lilyPads[i];
        pad.position.z = 0.05 + Math.sin(pondTime * 1.2 + i * 0.7 + p) * 0.08;
      }
    }
  }

  function getObstacles() {
    return obstacles;
  }

  return { getObstacles, updatePond, ponds };
}
