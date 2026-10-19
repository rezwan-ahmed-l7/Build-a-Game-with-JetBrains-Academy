import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mulberry32 } from '../utils/rng.js';
import { WORLD_RADIUS } from './WorldBounds.js';

// Layout counts. Tuned for a forest you can SEE from the player but
// not run into every two steps. We bias placement to the outer ring so
// the immediate play area stays open and the trees form a horizon line.
// Counts increased to fill the expanded playable area (840 radius).
const TREE_COUNT = 240;          // more trees to fill expanded edges
const BUSH_COUNT = 65;
const BIG_ROCK_COUNT = 38;
const SMALL_ROCK_COUNT = 55;
const STUMP_COUNT = 18;
const GRASS_TUFT_COUNT = 110;
const MUSHROOM_COUNT = 35;
const LILY_PAD_COUNT = 9;        // around the pond
const POND_COUNT = 6;            // 3 main ponds + 3 small ponds scattered across the meadow
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
const FOREST_INNER_RADIUS = 150;
// Outer band where 75% of the trees go (creates the horizon forest look).
// Lower bias than before because the expanded area needs more inner trees too.
const FOREST_OUTER_BIAS = 0.75;
const CLEARING_RADIUS = 40;
const POND_EXCLUSION_RADIUS = 48;  // keep other obstacles away from pond

// Ground-footprint collision radii; tree canopies and boulder silhouettes
// are intentionally larger than the space they occupy at ground level.
const TREE_COLLISION_RADIUS = 4.5;
const BIG_ROCK_COLLISION_RADIUS = 2;
const STUMP_COLLISION_RADIUS = 4;
const HOUSE_COLLISION_RADIUS = 14;

const _color = new THREE.Color();
const _greenTint = new THREE.Color();

function snapToGround(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  mesh.position.z -= box.min.z;
  return box;
}

// Weathering breaks up the perfect primitive silhouette: broad uneven planes,
// flattened bases, slightly asymmetric sides, and softened but non-spherical edges.
function distortGeometry(geo, rand, flatness) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const lower = z < 0 ? 0.78 : 1.0;
    const sideVariation = 0.82 + rand() * 0.30;
    const verticalVariation = 0.80 + rand() * 0.32;
    pos.setXYZ(
      i,
      x * sideVariation,
      y * (0.84 + rand() * 0.28),
      z * verticalVariation * lower * (flatness / 0.55)
    );
  }
  geo.computeVertexNormals();
}

// ---------- Tree builders ----------


// Five ornamental red-leaf tree silhouettes, each with its own canopy profile.
// A separate seeded RNG is used for these models so existing forest placement
// and the other 200 trees keep their previous deterministic layout.
const RED_LEAF_PALETTE = [
  0x9f1239, // deep crimson
  0xc21e3a, // ruby red
  0x7f1d35, // burgundy
  0xe04455, // scarlet
  0xb83250, // rose crimson
  0x8f243f
];
const RED_LEAF_MATERIALS = RED_LEAF_PALETTE.map((color) => new THREE.MeshStandardMaterial({
  color,
  roughness: 0.88,
  metalness: 0,
  flatShading: true,
  emissive: 0x18030a,
  emissiveIntensity: 0.08
}));
const RED_LEAF_GEOMETRIES = [
  new THREE.IcosahedronGeometry(1, 1),
  new THREE.DodecahedronGeometry(1, 0),
  new THREE.SphereGeometry(1, 8, 6)
];

function makeRedLeafTree(rand, style) {
  const group = new THREE.Group();
  const height = 34 + rand() * 13;
  const trunkHeight = height * ([0.48, 0.43, 0.56, 0.40, 0.50][style]);
  const trunkRadius = 1.35 + rand() * 0.65;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkRadius * 0.55, trunkRadius, trunkHeight, 7),
    new THREE.MeshStandardMaterial({ color: 0x563522, roughness: 0.96, flatShading: true })
  );
  trunk.rotation.x = Math.PI / 2;
  trunk.position.z = trunkHeight / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // Visible branching gives the red crown a tree-like silhouette rather than
  // a single generic ball. Branch direction is calculated in this Z-up world.
  const branchCount = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < branchCount; i++) {
    const angle = (i / branchCount) * Math.PI * 2 + (rand() - 0.5) * 0.35;
    const start = new THREE.Vector3(
      Math.cos(angle) * 0.35,
      Math.sin(angle) * 0.35,
      trunkHeight * (0.48 + rand() * 0.30)
    );
    const length = 5 + rand() * 4;
    const end = new THREE.Vector3(
      start.x + Math.cos(angle) * length,
      start.y + Math.sin(angle) * length,
      start.z + 2 + rand() * 5
    );
    const direction = end.clone().sub(start);
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.48, direction.length(), 5),
      new THREE.MeshStandardMaterial({ color: 0x654027, roughness: 1, flatShading: true })
    );
    branch.position.copy(start).add(end).multiplyScalar(0.5);
    branch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    branch.castShadow = true;
    group.add(branch);
  }

  // Each style distributes the foliage differently: layered maple, wide
  // umbrella crown, upright column, weeping crown, and multi-tier fan crown.
  const clusterCount = [17, 19, 15, 18, 20][style];
  const crownWidth = [10.5, 14.5, 8.2, 12.0, 13.0][style];
  const crownHeight = height - trunkHeight;
  for (let i = 0; i < clusterCount; i++) {
    const angle = rand() * Math.PI * 2;
    const layer = i / Math.max(1, clusterCount - 1);
    let x = 0, y = 0, z = 0;
    let sx = 0, sy = 0, sz = 0;

    if (style === 0) { // Japanese maple: layered, spreading crown
      const ring = i % 3;
      const radius = ring === 0 ? crownWidth * 0.28 : crownWidth * (0.48 + rand() * 0.16);
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
      z = crownHeight * (0.35 + (Math.floor(i / 3) / Math.ceil(clusterCount / 3)) * 0.55);
      sx = 3.0 + rand() * 1.5; sy = 2.8 + rand() * 1.3; sz = 2.5 + rand() * 1.4;
    } else if (style === 1) { // broad umbrella-shaped crimson tree
      const radius = crownWidth * Math.sqrt(rand()) * 0.72;
      x = Math.cos(angle) * radius; y = Math.sin(angle) * radius;
      z = crownHeight * (0.55 + rand() * 0.30) - radius * 0.10;
      sx = 3.2 + rand() * 1.8; sy = 3.0 + rand() * 1.7; sz = 2.0 + rand() * 1.1;
    } else if (style === 2) { // upright columnar red ornamental tree
      const radius = crownWidth * (0.22 + rand() * 0.25);
      x = Math.cos(angle) * radius; y = Math.sin(angle) * radius;
      z = crownHeight * (0.16 + layer * 0.78);
      sx = 2.7 + rand() * 1.1; sy = 2.5 + rand() * 1.0; sz = 3.0 + rand() * 1.5;
    } else if (style === 3) { // cascading / weeping red crown
      const radius = crownWidth * (0.22 + rand() * 0.46);
      x = Math.cos(angle) * radius; y = Math.sin(angle) * radius;
      z = crownHeight * (0.52 + rand() * 0.26) - radius * (0.12 + rand() * 0.12);
      sx = 2.8 + rand() * 1.4; sy = 2.7 + rand() * 1.4; sz = 2.6 + rand() * 1.3;
    } else { // sculpted multi-tier fan crown
      const tier = i % 4;
      const radius = crownWidth * (0.20 + tier * 0.17) * (0.82 + rand() * 0.28);
      x = Math.cos(angle) * radius; y = Math.sin(angle) * radius;
      z = crownHeight * (0.30 + tier * 0.16) + (rand() - 0.5) * 3;
      sx = 3.1 + rand() * 1.6; sy = 2.7 + rand() * 1.5; sz = 2.4 + rand() * 1.2;
    }

    const geometry = RED_LEAF_GEOMETRIES[Math.floor(rand() * RED_LEAF_GEOMETRIES.length)];
    const material = RED_LEAF_MATERIALS[Math.floor(rand() * RED_LEAF_MATERIALS.length)];
    const leaves = new THREE.Mesh(geometry, material);
    leaves.position.set(x, y, trunkHeight + z);
    leaves.scale.set(sx, sy, sz);
    leaves.rotation.z = rand() * Math.PI * 2;
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    group.add(leaves);
  }

  // Small hanging clusters make the weeping variety visibly distinct.
  if (style === 3) {
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const radius = crownWidth * 0.55;
      const drop = 4 + rand() * 4;
      const tip = new THREE.Mesh(
        RED_LEAF_GEOMETRIES[1],
        RED_LEAF_MATERIALS[i % RED_LEAF_MATERIALS.length]
      );
      tip.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, trunkHeight + crownHeight * 0.62 - drop);
      tip.scale.set(1.7, 1.7, 3.0 + rand() * 1.5);
      group.add(tip);
    }
  }

  return { group, totalHeight: height };
}

// Shared bark materials and unit branch geometry keep the richer tree
// silhouettes inexpensive even with a large forest.
const TREE_BRANCH_GEOMETRY = new THREE.CylinderGeometry(0.42, 0.78, 1, 6);
const TREE_BRANCH_MATERIALS = [
  new THREE.MeshStandardMaterial({ color: 0x563821, roughness: 1, flatShading: true }),
  new THREE.MeshStandardMaterial({ color: 0x6a472b, roughness: 1, flatShading: true }),
  new THREE.MeshStandardMaterial({ color: 0x785235, roughness: 1, flatShading: true })
];

function addTreeBranch(group, start, end, thickness, materialIndex = 0) {
  const direction = end.clone().sub(start);
  const branch = new THREE.Mesh(TREE_BRANCH_GEOMETRY, TREE_BRANCH_MATERIALS[materialIndex % TREE_BRANCH_MATERIALS.length]);
  branch.position.copy(start).add(end).multiplyScalar(0.5);
  branch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  branch.scale.set(thickness, direction.length(), thickness);
  branch.castShadow = true;
  branch.receiveShadow = true;
  group.add(branch);
}

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

  // Whorled lateral limbs break up the perfect cone silhouette. The lowest
  // limbs stay visible beneath the canopy and the upper limbs peek between
  // foliage tiers, with small natural differences in angle and length.
  const limbLevels = 5;
  for (let level = 0; level < limbLevels; level++) {
    const z = trunkHeight * (0.55 + level * 0.23);
    const limbCount = 4 + Math.floor(rand() * 2);
    const phase = rand() * Math.PI * 2;
    for (let i = 0; i < limbCount; i++) {
      const angle = phase + (i / limbCount) * Math.PI * 2;
      const length = (5.2 + rand() * 3.4) * (1 - level * 0.105);
      const start = new THREE.Vector3(Math.cos(angle) * 0.45, Math.sin(angle) * 0.45, z);
      const end = new THREE.Vector3(
        Math.cos(angle) * length,
        Math.sin(angle) * length,
        z + 0.8 + rand() * 1.7
      );
      addTreeBranch(group, start, end, 0.55 + rand() * 0.25, Math.floor(rand() * 3));
    }
  }

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

  // Main limbs fan out from the trunk into the crown. A few thicker branches
  // remain visible around the canopy edge, giving broadleaf trees a readable
  // trunk-to-branch structure instead of a stack of detached green blobs.
  const limbCount = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < limbCount; i++) {
    const angle = (i / limbCount) * Math.PI * 2 + (rand() - 0.5) * 0.28;
    const start = new THREE.Vector3(
      Math.cos(angle) * 0.45,
      Math.sin(angle) * 0.45,
      trunkHeight * (0.68 + rand() * 0.18)
    );
    const length = 5.5 + rand() * 4.2;
    const end = new THREE.Vector3(
      Math.cos(angle) * length,
      Math.sin(angle) * length,
      start.z + 1.5 + rand() * 4
    );
    addTreeBranch(group, start, end, 0.8 + rand() * 0.35, Math.floor(rand() * 3));
  }

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

// Large weathered boulders use varied mineral colors, asymmetric silhouettes,
// non-uniform proportions, and small moss patches instead of identical round balls.
function makeBigRock(rand) {
  const group = new THREE.Group();
  const size = 3.6 + rand() * 4.0;
  const geo = new THREE.IcosahedronGeometry(size, 2);
  distortGeometry(geo, rand, 0.52);
  const palette = [0x777b78, 0x89877d, 0x6f7779, 0x938b7b, 0x686f70, 0x81766b];
  const rockMat = new THREE.MeshStandardMaterial({
    color: palette[Math.floor(rand() * palette.length)],
    roughness: 0.98,
    metalness: 0,
    flatShading: true
  });
  const rock = new THREE.Mesh(geo, rockMat);
  rock.scale.set(0.88 + rand() * 0.42, 0.78 + rand() * 0.48, 0.62 + rand() * 0.35);
  rock.rotation.set((rand() - 0.5) * 0.18, (rand() - 0.5) * 0.18, rand() * Math.PI * 2);
  rock.castShadow = true;
  rock.receiveShadow = true;
  group.add(rock);

  // Small, uneven moss patches sit on only part of the boulder, not as a perfect cap.
  const mossMat = new THREE.MeshStandardMaterial({
    color: [0x3d5b32, 0x536a3b, 0x66754a][Math.floor(rand() * 3)],
    roughness: 1.0,
    metalness: 0,
    flatShading: true
  });
  const patchCount = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < patchCount; i++) {
    const patch = new THREE.Mesh(
      new THREE.IcosahedronGeometry(size * (0.17 + rand() * 0.12), 1),
      mossMat
    );
    distortGeometry(patch.geometry, rand, 0.42);
    const a = rand() * Math.PI * 2;
    patch.position.set(
      Math.cos(a) * size * (0.22 + rand() * 0.24),
      Math.sin(a) * size * (0.22 + rand() * 0.24),
      size * (0.25 + rand() * 0.28)
    );
    patch.scale.set(1.3 + rand() * 0.6, 0.8 + rand() * 0.5, 0.28);
    patch.castShadow = false;
    patch.receiveShadow = true;
    group.add(patch);
  }
  return { group, size };
}

function makeSmallRock(rand) {
  const size = 0.65 + rand() * 1.35;
  const geo = new THREE.IcosahedronGeometry(size, 1);
  distortGeometry(geo, rand, 0.48);
  const palette = [0xaaa394, 0x827f77, 0x6c7777, 0xb3a68d, 0x77716a, 0x8d9996];
  const rock = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: palette[Math.floor(rand() * palette.length)],
      roughness: 0.98,
      metalness: 0,
      flatShading: true
    })
  );
  rock.scale.set(0.72 + rand() * 0.65, 0.68 + rand() * 0.7, 0.48 + rand() * 0.68);
  rock.rotation.set((rand() - 0.5) * 0.2, (rand() - 0.5) * 0.2, rand() * Math.PI * 2);
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

// Lily pad with a natural notch, layered leaf surface, subtle veins and a
// proper multi-petal water-lily bloom. All geometry is native Three.js.
function makeLilyPad(rand) {
  const r = 2.0 + rand() * 1.0;
  const pad = new THREE.Group();
  const leafShape = new THREE.Shape();
  const start = Math.PI * 0.24;
  const end = Math.PI * 1.76;
  leafShape.moveTo(0, 0);
  leafShape.absarc(0, 0, r, start, end, false);
  leafShape.lineTo(0, 0);
  leafShape.closePath();

  const leaf = new THREE.Mesh(
    new THREE.ShapeGeometry(leafShape, 20),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.30 + rand() * 0.035, 0.48 + rand() * 0.16, 0.23 + rand() * 0.09),
      roughness: 0.82,
      metalness: 0,
      side: THREE.DoubleSide
    })
  );
  leaf.position.z = 0.04;
  leaf.receiveShadow = true;
  pad.add(leaf);

  // A small raised center and radial veins catch light and make the leaf
  // read as a real plant rather than a flat green polygon.
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 5),
    new THREE.MeshStandardMaterial({ color: 0x8ca85a, roughness: 0.9 })
  );
  center.scale.z = 0.22;
  center.position.z = 0.12;
  pad.add(center);

  const veinMat = new THREE.LineBasicMaterial({ color: 0x8aa66a, transparent: true, opacity: 0.62 });
  for (let i = 0; i < 5; i++) {
    const angle = start + 0.18 + i * ((end - start - 0.36) / 4);
    const points = [
      new THREE.Vector3(0.1, 0.0, 0.14),
      new THREE.Vector3(Math.cos(angle) * r * 0.78, Math.sin(angle) * r * 0.78, 0.14)
    ];
    const vein = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      veinMat
    );
    pad.add(vein);
  }

  const hasFlower = rand() < 0.62;
  if (hasFlower) {
    const bloom = new THREE.Group();
    const flowerColor = new THREE.Color().setHSL(rand() < 0.65 ? 0.94 + rand() * 0.055 : 0.12 + rand() * 0.025, 0.72, 0.72);
    const petalMat = new THREE.MeshStandardMaterial({
      color: flowerColor,
      emissive: flowerColor,
      emissiveIntensity: 0.16,
      roughness: 0.42,
      metalness: 0.02,
      side: THREE.DoubleSide
    });
    const petalCount = 8;
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2;
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.48, 8, 6),
        petalMat
      );
      petal.scale.set(0.62, 1.0, 0.24);
      petal.position.set(Math.cos(angle) * 0.46, Math.sin(angle) * 0.46, 0.22);
      petal.rotation.z = angle - Math.PI / 2;
      bloom.add(petal);
    }

    const heart = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 7),
      new THREE.MeshStandardMaterial({
        color: 0xf7c95e,
        emissive: 0x8c5a18,
        emissiveIntensity: 0.12,
        roughness: 0.5
      })
    );
    heart.scale.z = 0.55;
    heart.position.z = 0.34;
    bloom.add(heart);
    bloom.position.set((rand() - 0.5) * 0.7, (rand() - 0.5) * 0.7, 0.08);
    pad.add(bloom);
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

  // A clean, near-perfect circular shoreline with a natural sandy/pebble lip.
  // Higher segment counts avoid visibly polygonal edges at close camera angles.
  const shore = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.965, radius * 1.045, 128),
    new THREE.MeshStandardMaterial({
      color: 0x9a8a65,
      roughness: 0.98,
      metalness: 0,
      side: THREE.DoubleSide
    })
  );
  shore.position.z = 0.025;
  group.add(shore);

  // Clear turquoise shallows fade into richer blue-green pond water.
  const shallows = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.86, radius * 0.99, 128),
    new THREE.MeshStandardMaterial({
      color: 0x56c5b3,
      roughness: 0.52,
      metalness: 0.03,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  shallows.position.z = 0.035;
  group.add(shallows);

  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x278b98,
    roughness: 0.38,
    metalness: 0.06,
    side: THREE.DoubleSide
  });
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.91, 128),
    waterMat
  );
  // Z-up world: CircleGeometry is already on the XY ground plane.
  water.position.z = 0.05;
  water.receiveShadow = true;
  group.add(water);

  // Three fine, staggered wave rings create a continuous, gentle water-motion effect.
  const rippleMat = new THREE.MeshBasicMaterial({
    color: 0xc5fff4,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.18, radius * 0.195, 128),
    rippleMat
  );
  ripple.position.set(-radius * 0.1, radius * 0.06, 0.19);
  group.add(ripple);

  const rippleSecondary = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.38, radius * 0.395, 128),
    rippleMat.clone()
  );
  rippleSecondary.position.set(radius * 0.12, -radius * 0.08, 0.18);
  group.add(rippleSecondary);

  const rippleTertiary = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.56, radius * 0.575, 128),
    rippleMat.clone()
  );
  rippleTertiary.position.set(-radius * 0.02, -radius * 0.02, 0.175);
  group.add(rippleTertiary);

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

  // Pond-edge stones vary in hue, size, height and rotation like naturally
  // weathered pebbles embedded unevenly around the shoreline.
  const edgeRockMats = [0x8e8779, 0x777c79, 0xa39882, 0x646f70, 0x7d7063].map((color) =>
    new THREE.MeshStandardMaterial({
      color, roughness: 0.98, metalness: 0, flatShading: true
    })
  );
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + (rand() - 0.5) * 0.18;
    const sz = 1.0 + rand() * 2.0;
    const r = radius + 0.4 + rand() * 2.8;
    const stone = new THREE.Mesh(
      new THREE.IcosahedronGeometry(sz, 1),
      edgeRockMats[Math.floor(rand() * edgeRockMats.length)]
    );
    distortGeometry(stone.geometry, rand, 0.45);
    stone.scale.set(0.7 + rand() * 0.7, 0.7 + rand() * 0.65, 0.42 + rand() * 0.65);
    stone.rotation.set((rand() - 0.5) * 0.16, (rand() - 0.5) * 0.16, rand() * Math.PI * 2);
    stone.position.x = Math.cos(ang) * r;
    stone.position.y = Math.sin(ang) * r;
    stone.position.z = sz * 0.35;
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

  return { group, radius, water, ripple, rippleSecondary, rippleTertiary, lilyPads };
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
  // Three large main ponds + three smaller satellite ponds scattered in
  // different parts of the meadow. Each pond placement enforces a
  // minimum spacing from previously placed ponds so they never bunch up.
  const POND_MIN_SPACING = 300;  // world units between pond centers (reduced for 6 ponds)
  const ponds = [];
  for (let p = 0; p < POND_COUNT; p++) {
    const isMain = p < 3;  // first 3 are main ponds, rest are small
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
      const maxR = isMain ? 280 : 600;  // small ponds can go further out with expanded playable area
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

  // ----- Trees: 40 spaced red-leaf ornamentals + 200 original trees -----
  // Generate all original tree choices/positions first, using the existing
  // seeded RNG sequence. This preserves the old placement/layout for the
  // remaining 200 trees and for all other world props.
  const treeRecords = [];
  for (let i = 0; i < TREE_COUNT; i++) {
    const isBroadleaf = rand() < 0.4;
    const originalTree = isBroadleaf ? makeBroadleafTree(rand) : makePineTree(rand);
    const avoid = playerAvoid.concat(pondAvoid, placed);
    const pos = placeTree(rand, avoid, TREE_SPACING_MIN);
    placed.push(pos);
    treeRecords.push({
      index: i,
      group: originalTree.group,
      pos,
      rotation: rand() * Math.PI * 2
    });
    obstacles.push({
      position: { x: pos.x, y: pos.y },
      radius: TREE_COLLISION_RADIUS
    });
  }

  // Pick 40 tree locations spread across the existing forest. Farthest-point
  // selection prevents the red trees from bunching together; every position
  // already lies within WORLD_RADIUS (840), inside GROUND_RADIUS (900).
  const redTreeIndices = new Set();
  const redTreeRecords = [];
  if (treeRecords.length > 0) {
    let first = 0;
    let farthestFromSpawn = -1;
    for (let i = 0; i < treeRecords.length; i++) {
      const p = treeRecords[i].pos;
      const distance = Math.hypot(p.x, p.y);
      if (distance > farthestFromSpawn) {
        farthestFromSpawn = distance;
        first = i;
      }
    }
    redTreeIndices.add(first);
    redTreeRecords.push(treeRecords[first]);

    while (redTreeIndices.size < Math.min(40, treeRecords.length)) {
      let bestIndex = -1;
      let bestDistance = -1;
      for (let i = 0; i < treeRecords.length; i++) {
        if (redTreeIndices.has(i)) continue;
        const candidate = treeRecords[i].pos;
        let nearestRedDistance = Infinity;
        for (const selected of redTreeRecords) {
          const dx = candidate.x - selected.pos.x;
          const dy = candidate.y - selected.pos.y;
          nearestRedDistance = Math.min(nearestRedDistance, Math.hypot(dx, dy));
        }
        if (nearestRedDistance > bestDistance) {
          bestDistance = nearestRedDistance;
          bestIndex = i;
        }
      }
      if (bestIndex < 0) break;
      redTreeIndices.add(bestIndex);
      redTreeRecords.push(treeRecords[bestIndex]);
    }
  }

  // Separate seeded stream means different red-leaf silhouettes never shift
  // the established world layout. Five ornamental forms rotate across the
  // selected positions for visible variety rather than repeated copies.
  const redDesignRand = mulberry32(982451653);
  const redStyleOrder = [0, 2, 1, 4, 3];
  for (const record of treeRecords) {
    let group = record.group;
    if (redTreeIndices.has(record.index)) {
      const style = redStyleOrder[redTreeIndices.size ? redTreeRecords.findIndex((r) => r.index === record.index) % redStyleOrder.length : 0];
      group = makeRedLeafTree(redDesignRand, style).group;
    }
    group.position.x = record.pos.x;
    group.position.y = record.pos.y;
    group.rotation.z = record.rotation;
    snapToGround(group);
    scene.add(group);
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
      const phase = pondTime * 0.42 + p * 0.27;
      const t = phase % 1;
      pond.ripple.scale.setScalar(0.72 + t * 1.45);
      pond.ripple.material.opacity = 0.30 * (1 - t);
      const secondaryT = (t + 0.38) % 1;
      pond.rippleSecondary.scale.setScalar(0.72 + secondaryT * 1.35);
      pond.rippleSecondary.material.opacity = 0.23 * (1 - secondaryT);
      const tertiaryT = (t + 0.68) % 1;
      pond.rippleTertiary.scale.setScalar(0.72 + tertiaryT * 1.2);
      pond.rippleTertiary.material.opacity = 0.18 * (1 - tertiaryT);
      // Gentle, non-synchronous shimmer keeps the water from feeling static.
      pond.water.material.color.setHSL(
        0.505 + Math.sin(pondTime * 0.38 + p * 0.7) * 0.008,
        0.58,
        0.37 + Math.sin(pondTime * 0.52 + p) * 0.018
      );
      for (let i = 0; i < pond.lilyPads.length; i++) {
        const pad = pond.lilyPads[i];
        pad.position.z = 0.05 + Math.sin(pondTime * 1.2 + i * 0.7 + p) * 0.08;
      }
    }
  }

  function getObstacles() {
    return obstacles;
  }

  // Pond movement area matches the actual water disc. Lily pads are placed
  // within the inner 70% of this radius, so standing on a pad gets the same
  // environmental movement effect as standing on the water.
  function isPositionOverPond(x, y) {
    return ponds.some((pond) => {
      const dx = x - pond.x;
      const dy = y - pond.y;
      return Math.hypot(dx, dy) <= pond.ref.radius * 0.91;
    });
  }

  return { getObstacles, updatePond, ponds, isPositionOverPond };
}
