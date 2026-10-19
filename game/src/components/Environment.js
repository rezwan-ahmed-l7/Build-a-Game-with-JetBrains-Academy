import * as THREE from 'three';

const CYCLE_SECONDS = 90;   // full day/night cycle in seconds (1.5 min) — slower feels more natural
const STAR_COUNT = 260;
const FIREFLY_COUNT = 46;
const CLOUD_COUNT = 18;
const BIRD_COUNT = 12;       // distant birds in the daytime sky

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

// Blend two hex colors in linear RGB by factor t in [0, 1].
function blendHex(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export function createEnvironment(scene, lights, groundMaterial, playerGroup, skyMaterial = null) {
  const {
    ambientLight,
    directionalLight,
    fillLight,
    rimLight
  } = lights;

  // Optional hooks for audio/visual sync
  const onCycle = []; // functions(dayFactor) called each update

  const dayBackground = new THREE.Color(0x91c9df);
  const duskBackground = new THREE.Color(0xf18b68);
  const nightBackground = new THREE.Color(0x172b49);
  const daySkyTop = new THREE.Color(0x1b3a78);
  const duskSkyTop = new THREE.Color(0x49335f);
  const nightSkyTop = new THREE.Color(0x081326);
  const daySkyHorizon = new THREE.Color(0x80b6e8);
  const duskSkyHorizon = new THREE.Color(0xf18b68);
  const nightSkyHorizon = new THREE.Color(0x263b55);
  const skyTopWorking = new THREE.Color();
  const skyHorizonWorking = new THREE.Color();
  const dayFog = new THREE.Color(0x91c9df);
  const duskFog = new THREE.Color(0x6e405f);
  const nightFog = new THREE.Color(0x263b55);
  const dayGround = new THREE.Color(0x344b2b);
  const duskGround = new THREE.Color(0x6a4a2a);  // warm brown meadow
  const nightGround = new THREE.Color(0x293b39);
  const workingColor = new THREE.Color();

  // ----- Sun: warm orange-amber core with golden halos (visibly warm) -----
  // Warmer palette: deep amber core fading to red-orange halos so the sun
  // looks like a setting sun even at high noon, and clearly arcs across
  // the sky during the day/night cycle.
  // fog:false keeps the warm color from being mixed into the cool fog at
  // long distances — the sun should always look like itself.
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(44, 28, 18),
    new THREE.MeshBasicMaterial({ color: 0xff8a1c, fog: false })  // warm amber
  );
  const sunHaloInner = new THREE.Mesh(
    new THREE.SphereGeometry(64, 22, 14),
    new THREE.MeshBasicMaterial({
      color: 0xffa030, transparent: true, opacity: 0.60,
      depthWrite: false, fog: false
    })
  );
  const sunHaloMid = new THREE.Mesh(
    new THREE.SphereGeometry(102, 20, 12),
    new THREE.MeshBasicMaterial({
      color: 0xff7020, transparent: true, opacity: 0.34,
      depthWrite: false, fog: false
    })
  );
  const sunHaloOuter = new THREE.Mesh(
    new THREE.SphereGeometry(160, 16, 10),
    new THREE.MeshBasicMaterial({
      color: 0xff4818, transparent: true, opacity: 0.18,
      depthWrite: false, fog: false
    })
  );

  // Sprite-based lens flare (a soft round disc using a radial-gradient texture).
  function makeLensFlareTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,241,138,0.95)');     // pure yellow
    g.addColorStop(0.18, 'rgba(255,224,102,0.55)');  // warm yellow
    g.addColorStop(0.45, 'rgba(255,204,68,0.18)');   // golden
    g.addColorStop(1, 'rgba(255,170,34,0)');         // amber fade
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }
  const flareTex = makeLensFlareTexture();
  const sunFlareMat = new THREE.SpriteMaterial({
    map: flareTex, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const sunFlare = new THREE.Sprite(sunFlareMat);
  sunFlare.scale.set(180, 180, 1);

  // ----- Moon: bright cool-white core with soft silver-blue halo -----
  // fog:false keeps the moon bright at long distances (see sun note).
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(34, 28, 18),
    new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })  // pure white core
  );
  const moonHaloInner = new THREE.Mesh(
    new THREE.SphereGeometry(52, 22, 14),
    new THREE.MeshBasicMaterial({
      color: 0xd6e4ff, transparent: true, opacity: 0.60,
      depthWrite: false, fog: false
    })
  );
  const moonHaloOuter = new THREE.Mesh(
    new THREE.SphereGeometry(92, 18, 12),
    new THREE.MeshBasicMaterial({
      color: 0x9ec0ff, transparent: true, opacity: 0.25,
      depthWrite: false, fog: false
    })
  );
  const moonFlareMat = new THREE.SpriteMaterial({
    map: flareTex, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xe0ecff
  });
  const moonFlare = new THREE.Sprite(moonFlareMat);
  moonFlare.scale.set(260, 260, 1);

  // A subtle dark "spot" on the moon surface for character
  const moonSpotMat = new THREE.MeshBasicMaterial({ color: 0xc8d4e6, transparent: true, opacity: 0.40, fog: false });
  const moonSpot = new THREE.Mesh(
    new THREE.CircleGeometry(6, 14),
    moonSpotMat
  );
  moonSpot.position.set(-8, 6, 32);
  moon.add(moonSpot);

  scene.add(sun, sunHaloInner, sunHaloMid, sunHaloOuter, sunFlare,
            moon, moonHaloInner, moonHaloOuter, moonFlare);

  const starPositions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    starPositions[i * 3] = randomRange(-850, 850);
    starPositions[i * 3 + 1] = randomRange(-850, 850);
    starPositions[i * 3 + 2] = randomRange(260, 620);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: 0xdceaff,
    size: 2.6,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: false
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  const fireflyPositions = new Float32Array(FIREFLY_COUNT * 3);
  const fireflyOffsets = [];
  // Each firefly has a fixed world anchor point; they drift randomly around
  // that point at night. The anchor is chosen once at creation and never
  // follows the player, so fireflies stay scattered across the meadow.
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    const anchorX = randomRange(-350, 350);
    const anchorY = randomRange(-350, 350);
    fireflyPositions[i * 3] = anchorX;
    fireflyPositions[i * 3 + 1] = anchorY;
    fireflyPositions[i * 3 + 2] = randomRange(8, 55);
    fireflyOffsets.push({
      anchorX,
      anchorY,
      anchorZ: fireflyPositions[i * 3 + 2],
      phase: Math.random() * Math.PI * 2,
      driftRadius: randomRange(15, 45),
      speedX: randomRange(0.15, 0.45),
      speedY: randomRange(0.12, 0.38),
      speedZ: randomRange(0.8, 2.0)
    });
  }
  const fireflyGeometry = new THREE.BufferGeometry();
  fireflyGeometry.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3));
  const fireflyMaterial = new THREE.PointsMaterial({
    color: 0xb9ff80,
    size: 5,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending
  });
  const fireflies = new THREE.Points(fireflyGeometry, fireflyMaterial);
  scene.add(fireflies);

  // ----- Distant birds: premium 3D silhouettes in the daytime sky -----
  // Sleek, modern bird models with swept-back wings, forked tail, and smooth body.
  // They circle independently in the distant sky, staying visible but far from the camera.
  const birds = [];
  for (let i = 0; i < BIRD_COUNT; i++) {
    const birdGroup = new THREE.Group();

    // Color variation: dark grey to near-black, with subtle warm/cool tones
    const colorVariation = [0x2a2a2e, 0x333338, 0x252528, 0x3a3a3e, 0x1e1e22][i % 5];
    const bellyColor = [0x5a5a60, 0x606068, 0x505058, 0x6a6a70, 0x4a4a50][i % 5];

    const birdMat = new THREE.MeshStandardMaterial({
      color: colorVariation, roughness: 0.7, metalness: 0.05,
      transparent: true, opacity: 0, depthWrite: false, fog: false
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: bellyColor, roughness: 0.75, metalness: 0.05,
      transparent: true, opacity: 0, depthWrite: false, fog: false
    });

    // --- Body: sleek torpedo shape using custom lathe ---
    const bodyPoints = [];
    const segments = 20;
    for (let p = 0; p <= segments; p++) {
      const t = p / segments;
      let r;
      // Tail (t=0): very thin taper
      if (t < 0.08) r = t / 0.08 * 0.15;
      // Tail-base to mid-body: smooth swell
      else if (t < 0.35) r = 0.15 + (t - 0.08) / 0.27 * 0.55;
      // Mid-body to chest: full width
      else if (t < 0.6) r = 0.70 + (t - 0.35) / 0.25 * 0.10;
      // Chest to neck: gradual taper
      else if (t < 0.82) r = 0.80 - (t - 0.6) / 0.22 * 0.50;
      // Neck to head: thin
      else if (t < 0.92) r = 0.30 - (t - 0.82) / 0.10 * 0.15;
      // Head: small sphere
      else r = 0.15 - (t - 0.92) / 0.08 * 0.10;
      bodyPoints.push(new THREE.Vector2(Math.max(0.01, r), t * 10 - 5));
    }
    const bodyGeo = new THREE.LatheGeometry(bodyPoints, 20);
    const body = new THREE.Mesh(bodyGeo, birdMat);
    body.rotation.z = -Math.PI / 2;
    birdGroup.add(body);

    // --- Belly: lighter underside ---
    const bellyPoints = [];
    for (let p = 0; p <= segments; p++) {
      const t = p / segments;
      let r;
      if (t < 0.08) r = t / 0.08 * 0.10;
      else if (t < 0.35) r = 0.10 + (t - 0.08) / 0.27 * 0.40;
      else if (t < 0.6) r = 0.50 + (t - 0.35) / 0.25 * 0.05;
      else if (t < 0.82) r = 0.55 - (t - 0.6) / 0.22 * 0.35;
      else r = 0.20 - (t - 0.82) / 0.18 * 0.15;
      bellyPoints.push(new THREE.Vector2(Math.max(0.01, r), t * 10 - 5));
    }
    const bellyGeo = new THREE.LatheGeometry(bellyPoints, 10, 0, Math.PI);
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.rotation.z = -Math.PI / 2;
    belly.rotation.y = Math.PI / 2;
    birdGroup.add(belly);

    // --- Wings: swept-back delta shape with feather detail ---
    const wingCanvas = document.createElement('canvas');
    wingCanvas.width = 256;
    wingCanvas.height = 128;
    const wCtx = wingCanvas.getContext('2d');
    wCtx.clearRect(0, 0, 256, 128);

    // Wing shape: swept-back delta with pointed tip and scalloped trailing edge
    wCtx.fillStyle = '#1a1a1e';
    wCtx.beginPath();
    wCtx.moveTo(20, 80);           // wing root (body attachment)
    wCtx.quadraticCurveTo(40, 40, 100, 15);  // leading edge sweep
    wCtx.quadraticCurveTo(180, 5, 240, 10);  // wing tip
    wCtx.quadraticCurveTo(245, 15, 238, 22); // tip curve
    // Scalloped trailing edge (primary feathers)
    const scallops = [
      [230, 30], [220, 25], [210, 35], [200, 28], [190, 38],
      [178, 30], [165, 40], [150, 32], [135, 42], [120, 34],
      [105, 44], [90, 36], [75, 46], [60, 40], [45, 50], [30, 60]
    ];
    for (const [sx, sy] of scallops) wCtx.lineTo(sx, sy);
    wCtx.closePath();
    wCtx.fill();

    // Feather texture lines
    wCtx.strokeStyle = 'rgba(60,60,65,0.4)';
    wCtx.lineWidth = 0.8;
    for (let f = 0; f < 14; f++) {
      const baseX = 100 + f * 10;
      wCtx.beginPath();
      wCtx.moveTo(baseX, 10 + f * 0.3);
      wCtx.lineTo(baseX - 5, 30 + f * 1.2);
      wCtx.stroke();
    }
    const wingTexture = new THREE.CanvasTexture(wingCanvas);
    wingTexture.needsUpdate = true;

    const wingMat = new THREE.MeshStandardMaterial({
      map: wingTexture, roughness: 0.8, metalness: 0.02,
      transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide
    });

    // Wings attach at the shoulders and extend laterally, not along the
    // bird's nose-to-tail axis. The canvas texture supplies the feathered edge.
    const leftWing = new THREE.Group();
    leftWing.position.set(-0.35, -0.62, 0.62);
    leftWing.rotation.z = -Math.PI / 2;
    const leftWingMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 6, 8, 4),
      wingMat.clone()
    );
    leftWingMesh.position.x = 7;
    leftWing.add(leftWingMesh);
    birdGroup.add(leftWing);

    const rightWing = new THREE.Group();
    rightWing.position.set(-0.35, 0.62, 0.62);
    rightWing.rotation.z = Math.PI / 2;
    const rightWingMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 6, 8, 4),
      wingMat.clone()
    );
    rightWingMesh.position.x = 7;
    rightWing.add(rightWingMesh);
    birdGroup.add(rightWing);

    // --- Head: smooth sphere with slight elongation ---
    const headGeo = new THREE.SphereGeometry(0.7, 18, 14);
    const head = new THREE.Mesh(headGeo, birdMat);
    head.position.set(4.5, 0.3, 0);
    head.scale.set(1.1, 0.9, 0.9);
    birdGroup.add(head);

    // --- Beak: thin, pointed ---
    const beakGeo = new THREE.ConeGeometry(0.15, 1.8, 6);
    const beakMat = new THREE.MeshStandardMaterial({
      color: 0x887755, roughness: 0.5, metalness: 0.1,
      transparent: true, opacity: 0, depthWrite: false, fog: false
    });
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.position.set(5.8, 0.3, 0);
    beak.rotation.z = -Math.PI / 2;
    birdGroup.add(beak);

    // --- Eye: tiny dark dot ---
    const eyeGeo = new THREE.SphereGeometry(0.12, 4, 4);
    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0x111111, transparent: true, opacity: 0, depthWrite: false, fog: false
    });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(5.0, 0.35, 0.6);
    birdGroup.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(5.0, -0.35, 0.6);
    birdGroup.add(eyeR);

    // --- Tail: forked (swallow-style) ---
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0x1e1e22, roughness: 0.8, metalness: 0.02,
      transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide
    });
    // Left fork
    const tailLGeo = new THREE.PlaneGeometry(3, 4);
    const tailL = new THREE.Mesh(tailLGeo, tailMat);
    tailL.position.set(-5.0, -0.45, 0.18);
    tailL.rotation.z = 0.28;
    birdGroup.add(tailL);
    // Right fork
    const tailRGeo = new THREE.PlaneGeometry(3, 4);
    const tailR = new THREE.Mesh(tailRGeo, tailMat);
    tailR.position.set(-5.0, 0.45, 0.18);
    tailR.rotation.z = -0.28;
    birdGroup.add(tailR);

    // --- Wing joints (shoulder bumps) ---
    const jointGeo = new THREE.SphereGeometry(0.35, 6, 4);
    const jointL = new THREE.Mesh(jointGeo, birdMat);
    jointL.position.set(-0.35, -0.62, 0.55);
    birdGroup.add(jointL);
    const jointR = new THREE.Mesh(jointGeo, birdMat);
    jointR.position.set(-0.35, 0.62, 0.55);
    birdGroup.add(jointR);

    // Flight parameters
    const birdHeight = randomRange(120, 250);
    const birdDistance = randomRange(200, 450);
    const birdAngle = randomRange(0, Math.PI * 2);
    const birdSpeed = randomRange(5, 15);
    const birdFlapSpeed = randomRange(3, 6);
    const birdFlapPhase = randomRange(0, Math.PI * 2);
    const birdWobble = randomRange(0.5, 2);
    const birdWobbleSpeed = randomRange(0.3, 0.8);

    birdGroup.userData = {
      height: birdHeight,
      distance: birdDistance,
      angle: birdAngle,
      speed: birdSpeed,
      flapSpeed: birdFlapSpeed,
      flapPhase: birdFlapPhase,
      wobble: birdWobble,
      wobbleSpeed: birdWobbleSpeed,
      leftWing,
      rightWing,
      tailL,
      tailR,
      bodyMat: birdMat,
      bellyMat,
      wingMatL: leftWingMesh.material,
      wingMatR: rightWingMesh.material,
      beakMat,
      tailMat,
      eyeMat,
      wingTexture
    };

    scene.add(birdGroup);
    birds.push(birdGroup);
  }

  // ----- Butterflies: small colorful shapes fluttering near the ground -----
  // Butterflies appear during daytime, moving randomly around fixed world
  // anchor points. They are small, decorative, and do not interact with gameplay.
  const BUTTERFLY_COUNT = 15;
  const butterflies = [];
  for (let i = 0; i < BUTTERFLY_COUNT; i++) {
    const bfGroup = new THREE.Group();
    const bfColor = [0xff9ecb, 0xffd166, 0xa8e6cf, 0xd4a5ff, 0xffaaa5, 0x87ceeb][i % 6];

    // Create a butterfly wing shape using canvas texture
    const bfCanvas = document.createElement('canvas');
    bfCanvas.width = 64;
    bfCanvas.height = 64;
    const bfCtx = bfCanvas.getContext('2d');
    const r = (bfColor >> 16) & 0xff;
    const g = (bfColor >> 8) & 0xff;
    const b = bfColor & 0xff;
    // Draw butterfly wings with gradient
    const grad = bfCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.95)`);
    grad.addColorStop(0.6, `rgba(${r},${g},${b},0.7)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0.1)`);
    bfCtx.fillStyle = grad;
    // Left wing
    bfCtx.beginPath();
    bfCtx.moveTo(32, 32);
    bfCtx.bezierCurveTo(20, 5, 2, 10, 5, 28);
    bfCtx.bezierCurveTo(8, 40, 25, 42, 32, 32);
    bfCtx.fill();
    // Right wing
    bfCtx.beginPath();
    bfCtx.moveTo(32, 32);
    bfCtx.bezierCurveTo(44, 5, 62, 10, 59, 28);
    bfCtx.bezierCurveTo(56, 40, 39, 42, 32, 32);
    bfCtx.fill();
    // Body
    bfCtx.fillStyle = '#333';
    bfCtx.beginPath();
    bfCtx.ellipse(32, 32, 2, 10, 0, 0, Math.PI * 2);
    bfCtx.fill();
    // Antennae
    bfCtx.strokeStyle = '#333';
    bfCtx.lineWidth = 1;
    bfCtx.beginPath();
    bfCtx.moveTo(32, 22);
    bfCtx.quadraticCurveTo(28, 14, 24, 12);
    bfCtx.moveTo(32, 22);
    bfCtx.quadraticCurveTo(36, 14, 40, 12);
    bfCtx.stroke();
    const bfTexture = new THREE.CanvasTexture(bfCanvas);
    bfTexture.needsUpdate = true;

    const bfMat = new THREE.MeshStandardMaterial({
      color: bfColor, roughness: 0.55, metalness: 0.02,
      transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide
    });
    const wingGeo = new THREE.SphereGeometry(1, 18, 12);
    const leftWing = new THREE.Group();
    leftWing.position.set(-0.55, 0.3, 0);
    const leftWingMesh = new THREE.Mesh(wingGeo, bfMat);
    leftWingMesh.scale.set(3.7, 2.8, 0.2);
    leftWingMesh.position.x = -2.3;
    leftWing.add(leftWingMesh);
    const rightWing = new THREE.Group();
    rightWing.position.set(0.55, 0.3, 0);
    const rightWingMesh = new THREE.Mesh(wingGeo, bfMat);
    rightWingMesh.scale.set(3.7, 2.8, 0.2);
    rightWingMesh.position.x = 2.3;
    rightWing.add(rightWingMesh);
    bfGroup.add(leftWing, rightWing);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x332b29, roughness: 0.8, transparent: true, opacity: 0,
      depthWrite: false
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.2, 4, 8), bodyMat);
    body.rotation.x = Math.PI / 2;
    body.position.z = 0.05;
    bfGroup.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), bodyMat);
    head.position.z = 0.82;
    bfGroup.add(head);
    const antennaMat = new THREE.MeshStandardMaterial({
      color: 0x332b29, roughness: 0.9, transparent: true, opacity: 0,
      depthWrite: false
    });
    for (const side of [-1, 1]) {
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.8, 6), antennaMat);
      antenna.position.set(side * 0.2, 0.18, 1.18);
      antenna.rotation.x = side * 0.28;
      antenna.rotation.y = side * 0.25;
      bfGroup.add(antenna);
    }

    // Fixed world anchor point near the ground
    const anchorX = randomRange(-300, 300);
    const anchorY = randomRange(-300, 300);
    const anchorZ = randomRange(3, 18);
    const driftRadius = randomRange(10, 30);
    const speedX = randomRange(0.3, 0.8);
    const speedY = randomRange(0.25, 0.7);
    const speedZ = randomRange(0.5, 1.5);
    const phase = randomRange(0, Math.PI * 2);

    bfGroup.userData = {
      anchorX, anchorY, anchorZ,
      driftRadius, speedX, speedY, speedZ, phase,
      flutterTime: randomRange(0, 100),
      material: bfMat,
      bodyMaterial: bodyMat,
      antennaMaterial: antennaMat,
      leftWing,
      rightWing,
      texture: bfTexture
    };

    bfGroup.position.set(anchorX, anchorY, anchorZ);
    scene.add(bfGroup);
    butterflies.push(bfGroup);
  }

  // Soft, layered low-poly clouds float across the entire sky and follow
  // the player. Clouds are scattered over a wide X and Y range so they
  // appear in every direction the camera looks, not bunched on one side.
  const clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const cloud = new THREE.Group();
    // Bigger puffs, more of them, layered into a chunkier cumulus shape.
    const puffCount = 5 + Math.floor(Math.random() * 5);   // 5..9 puffs
    const baseRadius = randomRange(13, 22);
    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xfdfdff, transparent: true, opacity: 0.88,
      depthWrite: false, fog: false
    });
    for (let j = 0; j < puffCount; j++) {
      const radius = baseRadius * randomRange(0.55, 1.0);
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 10, 7),
        cloudMaterial
      );
      // Layered spread: roughly horizontal chain, slightly lifted middle
      // (cumulus hump) and a couple of underbellies for depth.
      const t = j / Math.max(1, puffCount - 1);              // 0..1 along chain
      const chainOffset = (j - (puffCount - 1) / 2) * randomRange(15, 24);
      const hump = Math.sin(t * Math.PI) * randomRange(6, 14);
      const underside = (j === Math.floor(puffCount / 3) || j === Math.floor(2 * puffCount / 3))
        ? -randomRange(4, 9) : 0;
      puff.position.set(
        chainOffset,
        randomRange(-5, 5) + underside,
        hump + randomRange(-3, 6)
      );
      // Squashed horizontally so each puff reads as a cloud "lump", not a ball.
      puff.scale.set(1.45, 0.78, 0.62);
      cloud.add(puff);
    }
    // A second, slightly offset material gives the cloud a soft shaded
    // underbelly without needing real lighting (basic material).
    const shadeMaterial = new THREE.MeshBasicMaterial({
      color: 0xc9d6e6, transparent: true, opacity: 0.45,
      depthWrite: false, fog: false
    });
    const shadePuff = new THREE.Mesh(
      new THREE.SphereGeometry(baseRadius * 1.05, 10, 7),
      shadeMaterial
    );
    shadePuff.position.set(0, 0, -baseRadius * 0.35);
    shadePuff.scale.set(1.55, 0.55, 0.45);
    cloud.add(shadePuff);

    cloud.userData = {
      // Scatter clouds in EVERY direction around the player — full 360°
      // coverage so the sky reads as populated from any camera angle.
      offsetX: randomRange(-900, 900),
      offsetY: randomRange(-900, 900),   // both sides now
      height: randomRange(170, 340),
      // Slow drift on both axes — visible motion, but not rushing across the sky.
      drift: randomRange(0.35, 0.95),
      driftX: randomRange(0.2, 0.6),
      // Each cloud has a unique phase so they don't all drift in lockstep.
      phase: randomRange(0, Math.PI * 2),
      material: cloudMaterial,
      shadeMaterial
    };
    scene.add(cloud);
    clouds.push(cloud);
  }

  let mode = 'auto';
  // phase = 0.5 is midnight (moon overhead, sun below horizon).
  // The spec requires the cycle to start at moonlit night after countdown.
  let phase = 0.5;
  let elapsed = 0;

  function cycleMode() {
    mode = mode === 'auto' ? 'day' : mode === 'day' ? 'night' : 'auto';
    return mode;
  }

  function setMode(newMode) {
    if (newMode === 'auto' || newMode === 'day' || newMode === 'night') {
      mode = newMode;
    }
    return mode;
  }

  function getMode() {
    return mode;
  }

  // For testing: lets the QA script pin the phase to a specific moment in the
  // day cycle so we can verify the rise/set arc and the noon position.
  function setPhase(v) {
    phase = ((v % 1) + 1) % 1;
  }

  function update(delta) {
    elapsed += delta;
    // Phase progresses in all modes (auto/day/night) so the sun and moon
    // actually rise and set on screen, regardless of which cycle the user
    // picked. Without this, day/night would freeze the sun/moon to a
    // single arc position and the rise/set would be invisible.
    phase = (phase + delta / CYCLE_SECONDS) % 1;

    const wave = (Math.cos(phase * Math.PI * 2) + 1) * 0.5;
    const dayFactor = mode === 'day' ? 1 : mode === 'night' ? 0 : wave;
    // Drive the celestial height and lighting from the same normalized cycle.
    // In auto mode, daylight peaks at phase 0 and night at phase 0.5.
    // The sun is near the horizon only at the daylight-to-night edges; do
    // not leave a permanent sunset tint during the full night.
    const sunHeightFrac = wave;
    const duskFactor = mode === 'auto' && dayFactor > 0 && dayFactor < 0.25
      ? 1 - dayFactor / 0.25
      : 0;

    // Base sky color: blend night → day by dayFactor. Then OVERLAY the
    // dusk tint on top so the orange peak shows up in day mode too.
    // Use a strong lerp factor so the sky actually looks twilight, not
    // a slightly-tinted blue.
    workingColor.copy(nightBackground).lerp(dayBackground, dayFactor);
    workingColor.lerp(duskBackground, duskFactor * 0.95);
    scene.background.copy(workingColor);

    // The visible sky is a shader dome, so update its gradient too;
    // changing scene.background alone leaves the dome stuck in daytime blue.
    if (skyMaterial?.uniforms?.topColor && skyMaterial?.uniforms?.bottomColor) {
      skyTopWorking.copy(nightSkyTop).lerp(daySkyTop, dayFactor);
      skyTopWorking.lerp(duskSkyTop, duskFactor * 0.9);
      skyHorizonWorking.copy(nightSkyHorizon).lerp(daySkyHorizon, dayFactor);
      skyHorizonWorking.lerp(duskSkyHorizon, duskFactor * 0.95);
      skyMaterial.uniforms.topColor.value.copy(skyTopWorking);
      skyMaterial.uniforms.bottomColor.value.copy(skyHorizonWorking);
    }

    workingColor.copy(nightFog).lerp(dayFog, dayFactor);
    workingColor.lerp(duskFog, duskFactor * 0.85);
    if (scene.fog) scene.fog.color.copy(workingColor);

    workingColor.copy(nightGround).lerp(dayGround, dayFactor);
    // Ground also warms up at dusk — strong brown-meadow tint so the
    // twilight ground reads as visibly different from the day green.
    workingColor.lerp(duskGround, duskFactor * 0.95);
    groundMaterial.color.copy(workingColor);

    ambientLight.intensity = 0.48 + dayFactor * 0.92;
    ambientLight.color.setRGB(
      0.48 + dayFactor * 0.42,
      0.58 + dayFactor * 0.34,
      0.95 - dayFactor * 0.12
    );
    directionalLight.intensity = 0.34 + dayFactor * 1.36;
    directionalLight.color.set(0xffd6a0).lerp(new THREE.Color(0xfff2dc), dayFactor);
    fillLight.intensity = 0.30 + dayFactor * 0.34;
    rimLight.intensity = 0.34 + dayFactor * 0.42;

    // Sun/moon follow a real rise/set arc in auto mode:
    // - Z is height (negative = below ground, positive = above)
    // - X sweeps east-to-west across the sky
    // - Sun and moon are 180° out of phase so when one is up the other is down
    //
    // The arc: as phase goes 0→1, sin(phase*2π) goes -1→1→-1, giving a
    // smooth rise-overhead-set. Cos gives the east/west sweep.
    //
    // CRITICAL: Sun and moon are PLAYER-RELATIVE so they always appear in the
    // same part of the sky regardless of where the player moves. They rise from
    // and set into the visual sky horizon, not the ground surface.
    const orbit = phase * Math.PI * 2;
    const px = playerGroup.position.x;
    const py = playerGroup.position.y;
    const pz = playerGroup.position.z;

    // The camera sits at ~21° elevation, distance 138 from the player.
    // The visual horizon from this angle is roughly 50 units above ground.
    // The sky dome shader gradient horizon is at a similar height.
    // Sun/moon must rise from BELOW this horizon (negative relative to it)
    // and peak well above it, so they cross the horizon naturally.
    //
    // HORIZONTAL_DIST: how far east/west the sun sweeps — large enough that
    // the sun reads as distant, not hovering over the player.
    // PEAK_HEIGHT: maximum height above the horizon at noon/midnight.
    // HORIZON_HEIGHT: the visual horizon line the sun/moon cross.
    const HORIZONTAL_DIST = 1400;  // far away so sun/moon appear distant
    const PEAK_HEIGHT = 500;        // high above horizon at noon/midnight
    const HORIZON_HEIGHT = 60;      // visual horizon from camera perspective

    // Half-arc for height: reuses sunHeightFrac from above (0 at sunrise,
    // 1 at noon, 0 at sunset) so the arc positioning matches the sky
    // color. Do NOT redeclare sunHeightFrac here.
    const sunX = px + Math.cos(orbit) * HORIZONTAL_DIST;
    const sunY = py + Math.sin(orbit) * 300;
    const sunZ = HORIZON_HEIGHT + sunHeightFrac * (PEAK_HEIGHT - HORIZON_HEIGHT);
    // Moon is "up" during the night portion of the cycle (when sun is low)
    // Keep the moon high when the sun is near the horizon, and low when
    // the sun is near noon. The previous (orbit + 1) * PI expression mixed
    // radians with a cycle offset and produced an unrelated moon arc.
    const moonHeightFrac = 1 - sunHeightFrac;
    const moonX = px - Math.cos(orbit) * HORIZONTAL_DIST;
    const moonY = py - Math.sin(orbit) * 300;
    const moonZ = HORIZON_HEIGHT + moonHeightFrac * (PEAK_HEIGHT - HORIZON_HEIGHT);

    if (mode === 'day') {
      // Day mode also follows an arc — phase=0 is sunrise (horizon left),
      // phase=0.5 is noon (overhead), phase=1 is sunset (horizon right).
      // This way the user actually sees the sun rise and set, not a static sky.
      sun.position.set(sunX, sunY, sunZ);
      // Moon stays below the horizon during day — push it underground.
      moon.position.set(moonX, moonY, HORIZON_HEIGHT - 600);
    } else if (mode === 'night') {
      // Night mode: phase drives the moon's rise/set, sun goes underground.
      moon.position.set(moonX, moonY, moonZ);
      sun.position.set(sunX, sunY, HORIZON_HEIGHT - 600);
    } else {
      sun.position.set(sunX, sunY, sunZ);
      moon.position.set(moonX, moonY, moonZ);
    }
    // Move all halo layers + flares to follow the sun/moon
    sunHaloInner.position.copy(sun.position);
    sunHaloMid.position.copy(sun.position);
    sunHaloOuter.position.copy(sun.position);
    sunFlare.position.copy(sun.position);
    moonHaloInner.position.copy(moon.position);
    moonHaloOuter.position.copy(moon.position);
    moonFlare.position.copy(moon.position);
    sun.visible = dayFactor > 0.08 && mode !== 'night';
    sunHaloInner.visible = sun.visible;
    sunHaloMid.visible = sun.visible;
    sunHaloOuter.visible = sun.visible;
    sunFlare.visible = sun.visible;
    // Halos intensify at sunrise/sunset (horizon), fade at noon/midnight
    const sunHorizonGlow = 1 - Math.abs(dayFactor - 0.25) * 2.0;
    sunHaloInner.material.opacity = 0.50 * Math.max(0, Math.min(1, sunHorizonGlow));
    sunHaloMid.material.opacity = 0.25 * Math.max(0, sunHorizonGlow);
    sunHaloOuter.material.opacity = 0.12 * Math.max(0, sunHorizonGlow);
    sunFlare.material.opacity = 0.40 * Math.max(0, sunHorizonGlow);
    moon.visible = dayFactor < 0.76 && mode !== 'day';
    moonHaloInner.visible = moon.visible;
    moonHaloOuter.visible = moon.visible;
    moonFlare.visible = moon.visible;
    const moonHorizonGlow = 1 - Math.abs(dayFactor - 0.0) * 0.6;
    moonHaloInner.material.opacity = 0.60 * Math.max(0.2, moonHorizonGlow);
    moonHaloOuter.material.opacity = 0.25 * Math.max(0.2, moonHorizonGlow);
    moonFlare.material.opacity = 0.55 * Math.max(0.2, moonHorizonGlow);

    stars.visible = dayFactor < 0.78;
    starMaterial.opacity = Math.max(0, (0.78 - dayFactor) / 0.78) * 0.9;

    // Star coordinates are local offsets, so only move the Points object with the player.
    stars.position.set(px, py, 0);

    // Fireflies drift around fixed world anchor points — they do NOT follow
    // the player. Each firefly has its own speed, radius, and phase so the
    // swarm looks organic and independent.
    if (dayFactor < 0.58) {
      const fireflyAttr = fireflyGeometry.getAttribute('position');
      for (let i = 0; i < FIREFLY_COUNT; i++) {
        const ff = fireflyOffsets[i];
        fireflyAttr.array[i * 3] = ff.anchorX + Math.cos(elapsed * ff.speedX + ff.phase) * ff.driftRadius;
        fireflyAttr.array[i * 3 + 1] = ff.anchorY + Math.sin(elapsed * ff.speedY + ff.phase) * ff.driftRadius;
        fireflyAttr.array[i * 3 + 2] = ff.anchorZ + Math.sin(elapsed * ff.speedZ + ff.phase) * 12;
      }
      fireflyAttr.needsUpdate = true;
    }
    fireflies.visible = dayFactor < 0.58;
    fireflyMaterial.opacity = Math.max(0, (0.58 - dayFactor) / 0.58) * (0.7 + Math.sin(elapsed * 3) * 0.22);
    fireflyMaterial.size = 3.2 + Math.sin(elapsed * 2.6) * 0.7;

    for (const cloud of clouds) {
      const data = cloud.userData;
      // Slow, unique drift per cloud on both X and Y axes so the drift
      // looks natural from any camera angle. We mod both axes by a large
      // loop distance so clouds re-enter from the opposite edge instead
      // of racing off forever — gives a continuous sky full of clouds
      // without unbounded world growth.
      const LOOP = 2000;
      const xWorld = px + data.offsetX + elapsed * data.driftX;
      const xWrapped = ((xWorld + LOOP) % LOOP) - LOOP / 2;
      const yWorld = py + data.offsetY + elapsed * data.drift;
      const yWrapped = ((yWorld + LOOP) % LOOP) - LOOP / 2;
      const xWobble = Math.sin(elapsed * 0.04 + data.phase) * 18;
      cloud.position.set(
        xWrapped + xWobble,
        py + yWrapped,
        pz + data.height
      );
      // Clouds soften at night rather than disappearing into the dark sky.
      data.material.opacity = 0.28 + dayFactor * 0.60;
      // Pick cloud tint based on time of day: warm peach at dusk,
      // bright white at midday, cool steel-blue at night.
      if (duskFactor > 0.3) {
        data.material.color.set(0xffd9b0);
      } else if (dayFactor > 0.55) {
        data.material.color.set(0xfdfdff);
      } else {
        data.material.color.set(0x9ebce0);
      }
      if (data.shadeMaterial) {
        // Underbelly stays darker and is more visible against the
        // brighter top — gives a subtle volumetric feel.
        data.shadeMaterial.opacity = 0.22 + dayFactor * 0.30;
        data.shadeMaterial.color.set(dayFactor > 0.55 ? 0xc9d6e6 : 0x6f86a3);
      }
    }

    // ----- Update distant birds -----
    // Birds fly in the sky around the player's view area. Each bird is a 3D
    // model with body, wings, head, beak, and tail. They circle independently
    // in the distant sky, staying visible but far from the camera lens.
    const birdVisibility = Math.max(0, Math.min(1, (dayFactor - 0.2) / 0.3));
    for (let i = 0; i < birds.length; i++) {
      const bird = birds[i];
      const data = bird.userData;

      // Each bird has its own fixed flight path
      data.angle += data.speed * delta * 0.005;
      const wobbleOffset = Math.sin(elapsed * data.wobbleSpeed + i) * data.wobble;
      
      // Position relative to player so birds stay in camera view
      const bx = px + Math.cos(data.angle) * data.distance + wobbleOffset;
      const by = py + Math.sin(data.angle) * data.distance;
      const bz = pz + data.height + Math.sin(elapsed * 0.5 + i * 2) * 10;
      bird.position.set(bx, by, bz);

      // Face the direction of movement
      bird.rotation.z = data.angle + Math.PI / 2;

      // Wing flapping animation — rotate wings up and down
      const flapAngle = Math.sin(elapsed * data.flapSpeed + data.flapPhase) * 0.5;
      data.leftWing.rotation.x = flapAngle;
      data.rightWing.rotation.x = flapAngle;
      // Tail fork slight bob
      data.tailL.rotation.x = Math.sin(elapsed * data.flapSpeed * 0.5 + data.flapPhase) * 0.15;
      data.tailR.rotation.x = Math.sin(elapsed * data.flapSpeed * 0.5 + data.flapPhase) * 0.15;

      // Fade in/out based on time of day — set all materials
      // Use fully opaque silhouettes in daylight; the old 0.85 alpha made
      // distant birds look washed out, and the old wing references pointed
      // at Groups (which have no material), throwing during the update loop.
      const opacity = birdVisibility;
      data.bodyMat.opacity = opacity;
      data.bellyMat.opacity = opacity;
      data.wingMatL.opacity = opacity;
      data.wingMatR.opacity = opacity;
      data.beakMat.opacity = opacity;
      data.tailMat.opacity = opacity;
      data.eyeMat.opacity = opacity;
    }

    // ----- Update butterflies -----
    // Butterflies flutter near the ground during daytime, moving randomly
    // around fixed world anchor points. They are small, colorful, and purely
    // decorative — no collision or damage.
    const butterflyVisibility = Math.max(0, Math.min(1, (dayFactor - 0.15) / 0.25));
    for (let i = 0; i < butterflies.length; i++) {
      const bf = butterflies[i];
      const fd = bf.userData;

      // Flutter around anchor point with organic, erratic movement
      fd.flutterTime += delta * 1.2;
      const flutterX = Math.sin(fd.flutterTime * fd.speedX + fd.phase) * fd.driftRadius;
      const flutterY = Math.cos(fd.flutterTime * fd.speedY + fd.phase * 1.3) * fd.driftRadius;
      const flutterZ = Math.sin(fd.flutterTime * fd.speedZ + fd.phase * 0.7) * 8;

      bf.position.set(
        fd.anchorX + flutterX,
        fd.anchorY + flutterY,
        fd.anchorZ + flutterZ
      );
      // Rotate butterfly to face movement direction
      bf.rotation.z = Math.atan2(flutterY, flutterX);
      bf.rotation.x = Math.sin(elapsed * 1.1 + fd.phase) * 0.12;
      const wingFlap = Math.sin(elapsed * 13 + fd.phase) * 0.78;
      fd.leftWing.rotation.y = wingFlap;
      fd.rightWing.rotation.y = -wingFlap;
      fd.leftWing.rotation.z = -0.12 + Math.sin(elapsed * 6 + fd.phase) * 0.08;
      fd.rightWing.rotation.z = 0.12 - Math.sin(elapsed * 6 + fd.phase) * 0.08;

      // Fade the complete 3D model with daylight, including the body and
      // antennae (not just the wings).
      const butterflyOpacity = butterflyVisibility * 0.8;
      fd.material.opacity = butterflyOpacity;
      fd.bodyMaterial.opacity = butterflyOpacity;
      fd.antennaMaterial.opacity = butterflyOpacity;
    }

    // External listeners (e.g. audio ambient brightness) — called after
    // all visual state is settled.
    for (const fn of onCycle) fn(dayFactor);

    return {
      dayFactor,
      duskFactor,
      label: mode === 'auto' ? 'AUTO CYCLE' : mode === 'day' ? 'DAYLIGHT' : 'NIGHT',
      // RGB hex values for the sky-dome shader (top / horizon).
      // Direct color blending is more reliable than HSL hue math here.
      // Top: cool blue → muted purple/gray at twilight.
      // Bottom (horizon): bright sky-blue → warm orange at twilight.
      skyTopColor: blendHex(0x1b3a78, 0x2a2240, duskFactor),     // blue → dark plum
      skyBottomColor: blendHex(0x80b6e8, 0xff8b4a, duskFactor),  // sky-blue → sunset orange
      // Lightness is also reduced at dusk so the sky doesn't blow out.
      skyTopLightness: 1.0 - duskFactor * 0.30,
      skyBottomLightness: 1.0 - duskFactor * 0.15
    };
  }

  function onUpdate(fn) {
    onCycle.push(fn);
  }

  function dispose() {
    const allObjects = [
      sun, sunHaloInner, sunHaloMid, sunHaloOuter, sunFlare,
      moon, moonHaloInner, moonHaloOuter, moonFlare,
      stars, fireflies, ...clouds, ...birds, ...butterflies
    ];
    for (const object of allObjects) {
      scene.remove(object);
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((m) => m.dispose());
        } else {
          object.material.dispose();
        }
      }
      // Clean up child meshes (bird/butterfly wings) and textures
      if (object.children) {
        for (const child of object.children) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      }
      // Dispose canvas textures if present
      if (object.userData?.texture) {
        object.userData.texture.dispose();
      }
      // Dispose 3D bird materials and textures
      if (object.userData?.bodyMat) object.userData.bodyMat.dispose();
      if (object.userData?.wingMatL) object.userData.wingMatL.dispose();
      if (object.userData?.wingMatR) object.userData.wingMatR.dispose();
      if (object.userData?.beakMat) object.userData.beakMat.dispose();
      if (object.userData?.tailMat) object.userData.tailMat.dispose();
      if (object.userData?.eyeMat) object.userData.eyeMat.dispose();
      if (object.userData?.wingTexture) object.userData.wingTexture.dispose();
    }
    if (flareTex) flareTex.dispose();
  }

  return { update, cycleMode, setMode, setPhase, getPhase: () => phase, getMode, dispose, onUpdate };
}
