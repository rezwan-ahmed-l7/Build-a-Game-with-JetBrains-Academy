import * as THREE from 'three';

// Decorative distant ships; isolated from gameplay and collision systems.
const mat = (color, roughness = 0.85) => new THREE.MeshStandardMaterial({
  color, roughness, metalness: 0, transparent: false, opacity: 1, depthWrite: true
});
function box(parent, size, color, pos) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color));
  mesh.position.set(...pos);
  parent.add(mesh);
  return mesh;
}
function cylinder(parent, radiusTop, radiusBottom, height, color, pos, rot = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 7), mat(color));
  mesh.position.set(...pos); mesh.rotation.set(...rot); parent.add(mesh); return mesh;
}
function person(ship, x, y, scale, clothes) {
  const g = new THREE.Group(); g.position.set(x, y, 9); g.scale.setScalar(scale);
  cylinder(g, 1.6, 1.9, 5.5, clothes, [0, 0, 0], [Math.PI / 2, 0, 0]);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.65, 8, 7), mat(0xb8784f));
  head.position.z = 4.0; g.add(head);
  cylinder(g, 2.2, 2.2, 0.8, 0x29262b, [0, 0, 5.0], [Math.PI / 2, 0, 0]);
  ship.add(g);
}
function sail(ship, x, height, color) {
  cylinder(ship, 1, 1.3, height, 0x543923, [x, 0, height / 2 + 9], [Math.PI / 2, 0, 0]);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(height * 0.48, height * 0.12);
  shape.quadraticCurveTo(height * 0.45, height * 0.56, 0, height * 0.78); shape.closePath();
  const clothGeometry = new THREE.ShapeGeometry(shape, 6);
  clothGeometry.rotateX(Math.PI / 2);
  const cloth = new THREE.Mesh(clothGeometry, mat(color));
  cloth.material.side = THREE.DoubleSide;
  cloth.position.set(x + 1, -0.7, 15); ship.add(cloth);
  cylinder(ship, 0.55, 0.55, height * 0.5, 0x543923,
    [x + height * 0.18, 0, height * 0.38 + 15], [0, 0, Math.PI / 2]);
}
function createShip(kind) {
  const g = new THREE.Group();
  const pirate = kind === 'pirate', boat = kind === 'boat';
  const length = kind === 'cargo' ? 142 : kind === 'liner' ? 128 : kind === 'fishing' ? 68 : boat ? 52 : pirate ? 112 : 94;
  const width = kind === 'cargo' ? 36 : kind === 'liner' ? 34 : kind === 'fishing' ? 23 : boat ? 19 : pirate ? 30 : 25;
  const hull = new THREE.Shape();
  hull.moveTo(-length/2, -width*0.12); hull.lineTo(-length*0.34, -width/2);
  hull.lineTo(length*0.3, -width/2); hull.lineTo(length/2, -width*0.12);
  hull.lineTo(length*0.4, width*0.38); hull.lineTo(-length*0.35, width*0.38); hull.closePath();
  const hullMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(hull, {
    depth: 8, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 1, bevelThickness: 1
  }), mat(pirate ? 0x35262b : boat ? 0x70482b : 0x573723));
  hullMesh.position.z = -1; g.add(hullMesh);
  box(g, [length*0.76, width*0.65, 2.8], pirate ? 0x67452e : 0x92704a, [0,0,7.2]);
  box(g, [length*0.82, 1.5, 2], 0xd0aa66, [0,-width*0.37,7.4]);
  box(g, [length*0.82, 1.5, 2], 0xd0aa66, [0,width*0.37,7.4]);
  if (!boat) {
    box(g, [length*0.18,width*0.48,13], 0x493024, [-length*0.28,0,14]);
    const mainHeight = kind === 'liner' ? 46 : kind === 'cargo' ? 34 : pirate ? 75 : 66;
    if (kind === 'cargo' || kind === 'liner') {
      // Raised bridge and deckhouses make these read as larger modern vessels.
      box(g, [length*0.22, width*0.72, 20], kind === 'liner' ? 0xf1eee5 : 0xb9c4c8, [length*0.22, 0, 19]);
      box(g, [length*0.10, width*0.55, 10], 0x4c6572, [length*0.22, 0, 34]);
      for (let deck = 0; deck < (kind === 'liner' ? 3 : 2); deck++) {
        box(g, [length*0.11, width*0.58, 3], deck % 2 ? 0xd6e5e9 : 0x8faab6,
          [-length*0.16 + deck * length*0.10, 0, 13 + deck*4]);
      }
      if (kind === 'cargo') {
        const containerColors = [0xc64f3d, 0x2f7192, 0xd7a442, 0x477b55];
        for (let row = 0; row < 2; row++) {
          for (let boxIndex = 0; boxIndex < 4; boxIndex++) {
            box(g, [length*0.105, width*0.20, 10], containerColors[(row + boxIndex) % containerColors.length],
              [-length*0.28 + boxIndex*length*0.13, row ? width*0.20 : -width*0.20, 18 + row*10]);
          }
        }
      }
    } else {
      sail(g, -length*0.18, mainHeight, pirate ? 0x9b3035 : kind === 'merchant' ? 0xe4dcc3 : 0xf0e7d0);
      sail(g, length*0.16, mainHeight*0.78, pirate ? 0x9b3035 : 0xf0e7d0);
    }
    if (pirate) {
      sail(g, length*0.35, mainHeight*0.52, 0x29262b);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), mat(0x29262b));
      flag.position.set(-length*0.18, -1, mainHeight+14); g.add(flag);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(2.1,8,6),mat(0xf0e7d0));
      skull.position.set(-length*0.18+5,-1.4,mainHeight+13); g.add(skull);
    }
    if (kind !== 'cargo' && kind !== 'liner') {
      person(g,-length*0.03,-width*0.12,1,pirate?0x702b2b:0x315568);
      person(g,length*0.22,width*0.13,0.9,0x8e6d45);
    }
    if (pirate) person(g,-length*0.31,width*0.1,0.85,0x2b3546);
  } else {
    box(g,[22,2,1.5],0xd0aa66,[0,0,8.3]);
    cylinder(g,0.55,0.7,24,0x543923,[0,-13,9],[0,0,Math.PI/2]);
    cylinder(g,0.55,0.7,24,0x543923,[0,13,9],[0,0,Math.PI/2]);
    person(g,-8,0,0.9,0x315568); person(g,9,0,0.85,0x92704a);
  }
  return g;
}
export function createSeaShips(scene) {
  const ships = [
    {kind:'pirate', radius:1765, angle:0.42, drift:0.0058, scale:1, phase:0.4},
    {kind:'merchant',radius:1840, angle:2.05, drift:-0.0042,scale:0.88,phase:2},
    {kind:'sail',radius:1900, angle:3.62, drift:0.0048,scale:0.82,phase:3.2},
    {kind:'boat',radius:1805, angle:5.08, drift:-0.0062,scale:0.95,phase:4.6},
    {kind:'cargo', radius:1945, angle:1.12, drift:0.0036, scale:0.82, phase:1.4},
    {kind:'liner', radius:1980, angle:4.15, drift:-0.0028, scale:0.76, phase:5.1},
    {kind:'fishing', radius:1725, angle:5.72, drift:0.0072, scale:0.78, phase:2.8}
  ].map(c => {
    const ship=createShip(c.kind); ship.scale.setScalar(c.scale);
    ship.userData={...c}; scene.add(ship); return ship;
  });
  function update(_delta,time) {
    for (const ship of ships) {
      const d=ship.userData, a=d.angle+time*d.drift;
      const x=Math.cos(a)*d.radius, y=Math.sin(a)*d.radius;
      const polar=Math.atan2(y,x), dist=Math.hypot(x,y);
      const wave=Math.sin(dist*0.008-time*1.05)*5.2
        +Math.sin(dist*0.004+time*0.72+polar*1.5)*3.1
        +Math.sin(dist*0.015-time*1.55+polar*3)*1.25;
      ship.position.set(x,y,-2+wave+2+Math.sin(time*1.15+d.phase)*2.0);
      // Noticeable but restrained pitch/roll follows the stronger ocean swell.
      ship.rotation.set(Math.sin(time*1.05+d.phase)*0.035,
        Math.sin(time*1.22+d.phase)*0.045,a+Math.PI/2);
    }
  }
  return { update };
}
