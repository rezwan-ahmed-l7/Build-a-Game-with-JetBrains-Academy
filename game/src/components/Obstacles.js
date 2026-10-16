import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mulberry32 } from '../utils/rng.js';

// Layout counts. Tuned for a dense-but-readable fantasy meadow.
const TREE_COUNT = 40;           // mixed pine + broadleaf
const BUSH_COUNT = 64;           // low foliage clumps (no collision)
const BIG_ROCK_COUNT = 26;       // large boulders with moss
const SMALL_ROCK_COUNT = 70;     // pebbles / shards
const STUMP_COUNT = 12;          // old cut stumps
const GRASS_TUFT_COUNT = 480;    // scattered blades, non-colliding
const MUSHROOM_COUNT = 48;       // bioluminescent clusters
const LILY_PAD_COUNT = 9;        // around the pond
const POND_COUNT = 1;            // single calm pond
const HOUSE_COUNT = 3;

const WORLD_RADIUS = 360;
const CLEARING_RADIUS = 56;
const POND_EXCLUSION_RADIUS = 48;  // keep other obstacles away from pond

const TREE_COLLISION_RADIUS = 8;
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
function distortGeometry(geo, rand, flatness) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const lower = z < 0 ? 0.72 : 1.0;
    pos.setXYZ(
      i,
      x * (0.82 + rand() * 0.34),
      y * (0.82 + rand() * 0.34),
      z * (0.62 + rand() * 0.22) * lower * (flatness / 0.55)
    );
  }
  geo.computeVertexNormals();
}

// ---------- Tree builders ----------

// Pine / fir — stacked cone layers with darker, colder foliage.
function makePineTree(rand) {
  const group = new THREE.Group();
  const height = 18 + rand() * 8;

  const trunkHeight = height * 0.38;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.6, trunkHeight, 7),
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

  // Cold dark-green conifer
  _greenTint.setHSL(0.30 + (rand() - 0.5) * 0.04,
                    0.62 + rand() * 0.10,
                    0.16 + rand() * 0.04);
  const foliageColor = _greenTint.getHex();

  // 3-4 stacked cones, each smaller as we go up
  const layers = 3 + Math.floor(rand() * 2);
  let z = trunkHeight;
  const baseRadius = 4.2 + rand() * 1.0;
  for (let i = 0; i < layers; i++) {
    const t = i / Math.max(1, layers - 1);
    const r = baseRadius * (1 - t * 0.48);
    const h = 5.0 + rand() * 1.4;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 7),
      new THREE.MeshStandardMaterial({
        color: foliageColor,
        roughness: 0.95,
        metalness: 0,
        flatShading: true
      })
    );
    cone.rotation.x = Math.PI / 2;
    cone.position.z = z + h * 0.48;
    cone.position.x = (rand() - 0.5) * 0.5;
    cone.castShadow = true;
    cone.receiveShadow = true;
    group.add(cone);
    z += h * 0.65;
  }
  return { group, totalHeight: z };
}

// Broadleaf — single dome of foliage on a taller, slimmer trunk.
function makeBroadleafTree(rand) {
  const group = new THREE.Group();
  const height = 16 + rand() * 8;

  const trunkHeight = height * 0.58;
  const trunkR = 1.0 + rand() * 0.35;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.55, trunkR, trunkHeight, 6),
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

  // Lighter, warmer foliage
  _greenTint.setHSL(0.24 + (rand() - 0.5) * 0.06,
                    0.55 + rand() * 0.18,
                    0.28 + rand() * 0.08);
  const foliageColor = _greenTint.getHex();

  // Layered, asymmetrical canopy gives broadleaf trees a recognizable silhouette.
  const blobs = 4 + Math.floor(rand() * 2);
  const canopy = new THREE.Group();
  for (let i = 0; i < blobs; i++) {
    const r = (i === 0 ? 3.4 : 2.4) + rand() * 1.2;
    const blob = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 1),
      new THREE.MeshStandardMaterial({
        color: foliageColor,
        roughness: 0.95,
        metalness: 0,
        flatShading: true
      })
    );
    // Slightly randomize the blob position so the canopy is irregular
    const ang = rand() * Math.PI * 2;
    const dist = rand() * 1.4;
    blob.position.x = Math.cos(ang) * dist;
    blob.position.y = Math.sin(ang) * dist;
    blob.position.z = (i === 0 ? 0.8 : 1.2 + rand() * 2.4);
    blob.scale.set(1.0 + rand() * 0.35, 0.85 + rand() * 0.25, 0.85 + rand() * 0.3);
    blob.castShadow = true;
    blob.receiveShadow = true;
    canopy.add(blob);
  }
  canopy.position.z = trunkHeight + 1.0;
  group.add(canopy);
  return { group, totalHeight: trunkHeight + 4 };
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

// Big boulder — gray with a top "moss" cap
function makeBigRock(rand) {
  const group = new THREE.Group();
  const size = 3.5 + rand() * 3.0;
  const geo = new THREE.IcosahedronGeometry(size, 1);
  distortGeometry(geo, rand, 0.42);
  const baseGray = 0.32 + rand() * 0.10;
  const rockMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseGray - 0.02, baseGray, baseGray + 0.02),
    roughness: 0.95,
    metalness: 0,
    flatShading: true
  });
  const rock = new THREE.Mesh(geo, rockMat);
  rock.castShadow = true;
  rock.receiveShadow = true;
  group.add(rock);

  // Moss cap (top half): a slightly smaller copy in a mossy green
  const mossGeo = new THREE.IcosahedronGeometry(size * 0.48, 1);
  distortGeometry(mossGeo, rand, 0.28);
  // bias the cap upward
  const mossMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x2a4a26),
    roughness: 1.0,
    metalness: 0,
    flatShading: true
  });
  const moss = new THREE.Mesh(mossGeo, mossMat);
  moss.position.z = size * 0.52;
  moss.scale.set(1.0 + rand() * 0.25, 0.9 + rand() * 0.2, 0.48);
  moss.castShadow = false;
  moss.receiveShadow = true;
  group.add(moss);

  return { group, size };
}

function makeSmallRock(rand) {
  const size = 0.7 + rand() * 1.1;
  const geo = new THREE.IcosahedronGeometry(size, 1);
  distortGeometry(geo, rand, 0.38);
  const baseGray = 0.42 + rand() * 0.16;
  const rock = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseGray, baseGray, baseGray + 0.01),
      roughness: 0.95,
      metalness: 0,
      flatShading: true
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
  top.rotation.x = Math.PI / 2;
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

// Build a pond: water disc + animated ripple ring + lily pads + edge rocks + cattails
function makePond(rand) {
  const group = new THREE.Group();
  const radius = 70 + rand() * 18;

  // Water surface (low, semi-reflective looking via a darker material)
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x143b4a,
    roughness: 0.18,
    metalness: 0.55,
    transparent: true,
    opacity: 0.92
  });
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    waterMat
  );
  water.rotation.x = Math.PI / 2;
  water.position.z = -0.4;     // slightly below ground
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
  ripple.rotation.x = Math.PI / 2;
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

  // Edge rocks (smooth, dark)
  const edgeRockMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    roughness: 0.95,
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

export function createObstacles(scene) {
  const obstacles = [];
  const rand = mulberry32(12345);
  const placed = [];

  // ----- Pond (placed first; other obstacles avoid it) -----
  const pondCenter = (() => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const angle = rand() * Math.PI * 2;
      const r = 125 + rand() * 150;     // keep the pond within the active camera view
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (r < CLEARING_RADIUS + POND_EXCLUSION_RADIUS) continue;
      return { x, y };
    }
    return { x: 320, y: 240 };
  })();
  const pond = makePond(rand);
  pond.group.position.x = pondCenter.x;
  pond.group.position.y = pondCenter.y;
  scene.add(pond.group);
  placed.push({ x: pondCenter.x, y: pondCenter.y });
  // Pond has no collision (player walks around it visually)

  // ----- Trees (mixed pine + broadleaf) -----
  for (let i = 0; i < TREE_COUNT; i++) {
    const isBroadleaf = rand() < 0.4;
    const { group, totalHeight } = isBroadleaf
      ? makeBroadleafTree(rand)
      : makePineTree(rand);
    const pos = placeRandomly(rand, placed, 26);
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
    const pos = placeRandomly(rand, placed, 7);
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
    const pos = placeRandomly(rand, placed, 22);
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
    const pos = placeRandomly(rand, placed, 5);
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
    const pos = placeRandomly(rand, placed, 18);
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
    const pos = placeRandomly(rand, placed, 4);
    group.position.x = pos.x;
    group.position.y = pos.y;
    group.rotation.z = rand() * Math.PI * 2;
    group.position.z = 0;
    scene.add(group);
  }

  // ----- Mushroom clusters (bioluminescent) -----
  for (let i = 0; i < MUSHROOM_COUNT; i++) {
    const cluster = makeMushroomCluster(rand);
    const pos = placeRandomly(rand, placed, 12);
    placed.push(pos);
    cluster.position.set(pos.x, pos.y, 0);
    cluster.rotation.z = rand() * Math.PI * 2;
    scene.add(cluster);
  }

  // ----- Houses (GLB) -----
  const housePositions = [];
  const houseLoader = new GLTFLoader();
  for (let i = 0; i < HOUSE_COUNT; i++) {
    const pos = placeRandomly(rand, placed, 60);
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
  let pondTime = 0;
  function updatePond(delta) {
    pondTime += delta;
    const t = (pondTime * 0.6) % 1;
    pond.ripple.scale.setScalar(1 + t * 0.7);
    pond.ripple.material.opacity = 0.45 * (1 - t);
    for (let i = 0; i < pond.lilyPads.length; i++) {
      const pad = pond.lilyPads[i];
      pad.position.z = 0.05 + Math.sin(pondTime * 1.2 + i * 0.7) * 0.08;
    }
  }

  function getObstacles() {
    return obstacles;
  }

  return { getObstacles, updatePond, pondCenter };
}
