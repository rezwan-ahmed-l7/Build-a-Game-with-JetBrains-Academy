import * as THREE from 'three';

const TREE_COUNT = 20;
const ROCK_COUNT = 10;
const WORLD_RADIUS = 600;       // scatter within this radius
const CLEARING_RADIUS = 80;     // keep this area empty around the player
const TREE_TRUNK_RADIUS = 4;
const TREE_COLLISION_RADIUS = 8;  // includes foliage buffer
const ROCK_COLLISION_RADIUS = 6;

const TREE_HEIGHT_MIN = 18;
const TREE_HEIGHT_MAX = 32;

const _color = new THREE.Color();

function seededRandom(seed) {
  // Mulberry32 — deterministic so layout is stable between reloads
  let t = seed | 0;
  return function () {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function snapToGround(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  // Put the lowest point on the Z=0 ground plane.
  mesh.position.z -= box.min.z;
  return box;
}

function makeFoliage(rand, colorHex) {
  // 2-3 stacked cones for a low-poly pine look
  const group = new THREE.Group();
  const layers = 2 + Math.floor(rand() * 2);
  const baseRadius = 2.2 + rand() * 1.0;
  let z = 0;
  for (let i = 0; i < layers; i++) {
    const r = baseRadius * (1 - i * 0.25);
    const h = 3.5 + rand() * 1.2;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 7),
      new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.95,
        metalness: 0,
        flatShading: true
      })
    );
    // ConeGeometry is Y-up by default; rotate its axis into world Z-up.
    cone.rotation.x = Math.PI / 2;
    cone.position.z = z + h / 2;
    z += h * 0.7;
    cone.castShadow = true;
    cone.receiveShadow = true;
    group.add(cone);
  }
  return group;
}

function makeTree(rand) {
  const group = new THREE.Group();
  const height = TREE_HEIGHT_MIN + rand() * (TREE_HEIGHT_MAX - TREE_HEIGHT_MIN);

  // Trunk
  const trunkHeight = height * 0.4;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(TREE_TRUNK_RADIUS * 0.4, TREE_TRUNK_RADIUS * 0.6, trunkHeight, 6),
    new THREE.MeshStandardMaterial({
      color: 0x2a1a10,
      roughness: 1.0,
      metalness: 0,
      flatShading: true
    })
  );
  // CylinderGeometry is Y-up by default; rotate its axis into world Z-up.
  trunk.rotation.x = Math.PI / 2;
  trunk.position.z = trunkHeight / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // Slight color variation on foliage (dark green band)
  const greenHue = 0.28 + (rand() - 0.5) * 0.05;
  const greenSat = 0.55 + rand() * 0.2;
  const greenLum = 0.10 + rand() * 0.06;
  _color.setHSL(greenHue, greenSat, greenLum);
  const foliageColorHex = _color.getHex();

  const foliage = makeFoliage(rand, foliageColorHex);
  foliage.position.z = trunkHeight;
  // Foliage height varies; resize by ratio
  const foliageHeight = height - trunkHeight;
  const targetFoliageHeight = 6 + rand() * 4;  // 2-3 layers worth
  foliage.scale.set(1, foliageHeight / targetFoliageHeight, 1);
  group.add(foliage);

  return { group, totalHeight: height };
}

function makeRock(rand) {
  const size = 0.5 + rand() * 1.5;
  const geo = new THREE.IcosahedronGeometry(size, 0);
  // Distort vertices for irregular shape
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) * (0.7 + rand() * 0.6),
      pos.getY(i) * (0.5 + rand() * 0.4),  // flatten vertically
      pos.getZ(i) * (0.7 + rand() * 0.6)
    );
  }
  geo.computeVertexNormals();

  const tint = 0.3 + rand() * 0.1;
  const rock = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(tint, tint, tint * 0.95),
      roughness: 1.0,
      metalness: 0,
      flatShading: true
    })
  );
  rock.castShadow = true;
  rock.receiveShadow = true;
  return { mesh: rock, size };
}

function placeRandomly(rand, avoid, minDist) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const angle = rand() * Math.PI * 2;
    const r = CLEARING_RADIUS + rand() * (WORLD_RADIUS - CLEARING_RADIUS);
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
  // Fallback: just return whatever, accept some overlap
  const angle = rand() * Math.PI * 2;
  const r = CLEARING_RADIUS + rand() * (WORLD_RADIUS - CLEARING_RADIUS);
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

export function createObstacles(scene) {
  const obstacles = [];   // { position: {x,y}, radius }
  const rand = seededRandom(12345);
  const placed = [];

  // Trees
  for (let i = 0; i < TREE_COUNT; i++) {
    const { group, totalHeight } = makeTree(rand);
    const pos = placeRandomly(rand, placed, 22);
    placed.push(pos);

    group.position.x = pos.x;
    group.position.y = pos.y;
    group.rotation.z = rand() * Math.PI * 2; // yaw around the Z-up axis
    snapToGround(group);

    scene.add(group);
    obstacles.push({
      position: { x: pos.x, y: pos.y },
      radius: TREE_COLLISION_RADIUS
    });
  }

  // Rocks
  for (let i = 0; i < ROCK_COUNT; i++) {
    const { mesh, size } = makeRock(rand);
    const pos = placeRandomly(rand, placed, 14);
    placed.push(pos);

    mesh.position.x = pos.x;
    mesh.position.y = pos.y;
    mesh.rotation.z = rand() * Math.PI * 2; // yaw around the Z-up axis
    snapToGround(mesh);

    scene.add(mesh);
    obstacles.push({
      position: { x: pos.x, y: pos.y },
      radius: ROCK_COLLISION_RADIUS + size
    });
  }

  function getObstacles() {
    return obstacles;
  }

  return { getObstacles };
}
