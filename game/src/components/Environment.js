import * as THREE from 'three';

const CYCLE_SECONDS = 180;
const STAR_COUNT = 260;
const FIREFLY_COUNT = 46;
const CLOUD_COUNT = 18;

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function createEnvironment(scene, lights, groundMaterial, playerGroup) {
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
  const dayFog = new THREE.Color(0x91c9df);
  const duskFog = new THREE.Color(0x6e405f);
  const nightFog = new THREE.Color(0x263b55);
  const dayGround = new THREE.Color(0x344b2b);
  const nightGround = new THREE.Color(0x293b39);
  const workingColor = new THREE.Color();

  // ----- Sun: multi-layer halo for a fat bloom feel -----
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(40, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff0b8 })
  );
  const sunHaloInner = new THREE.Mesh(
    new THREE.SphereGeometry(58, 20, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffd078, transparent: true, opacity: 0.45, depthWrite: false
    })
  );
  const sunHaloMid = new THREE.Mesh(
    new THREE.SphereGeometry(96, 18, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffa54a, transparent: true, opacity: 0.22, depthWrite: false
    })
  );
  const sunHaloOuter = new THREE.Mesh(
    new THREE.SphereGeometry(150, 14, 8),
    new THREE.MeshBasicMaterial({
      color: 0xff7a3a, transparent: true, opacity: 0.10, depthWrite: false
    })
  );

  // Sprite-based lens flare (a soft round disc using a radial-gradient texture).
  function makeLensFlareTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,236,180,0.95)');
    g.addColorStop(0.18, 'rgba(255,200,120,0.55)');
    g.addColorStop(0.45, 'rgba(255,150,80,0.18)');
    g.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }
  const flareTex = makeLensFlareTexture();
  const sunFlareMat = new THREE.SpriteMaterial({
    map: flareTex, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const sunFlare = new THREE.Sprite(sunFlareMat);
  sunFlare.scale.set(360, 360, 1);

  // ----- Moon: cool blue gradient + soft halo -----
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(30, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xeaf0ff })
  );
  const moonHaloInner = new THREE.Mesh(
    new THREE.SphereGeometry(46, 20, 12),
    new THREE.MeshBasicMaterial({
      color: 0xb4d4ff, transparent: true, opacity: 0.40, depthWrite: false
    })
  );
  const moonHaloOuter = new THREE.Mesh(
    new THREE.SphereGeometry(80, 16, 10),
    new THREE.MeshBasicMaterial({
      color: 0x7ea8ff, transparent: true, opacity: 0.15, depthWrite: false
    })
  );
  const moonFlareMat = new THREE.SpriteMaterial({
    map: flareTex, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
    color: 0xb8d4ff
  });
  const moonFlare = new THREE.Sprite(moonFlareMat);
  moonFlare.scale.set(220, 220, 1);

  // A subtle dark "spot" on the moon surface for character
  const moonSpotMat = new THREE.MeshBasicMaterial({ color: 0xa8bcd8, transparent: true, opacity: 0.55 });
  const moonSpot = new THREE.Mesh(
    new THREE.CircleGeometry(6, 14),
    moonSpotMat
  );
  moonSpot.position.set(-8, 6, 28);
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
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    fireflyPositions[i * 3] = randomRange(-260, 260);
    fireflyPositions[i * 3 + 1] = randomRange(-260, 260);
    fireflyPositions[i * 3 + 2] = randomRange(8, 55);
    fireflyOffsets.push(Math.random() * Math.PI * 2);
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

  // Soft, layered low-poly clouds float above the horizon and follow the player.
  const clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const cloud = new THREE.Group();
    const puffCount = 4 + Math.floor(Math.random() * 4);
    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xeaf4ff, transparent: true, opacity: 0.62,
      depthWrite: false, fog: false
    });
    for (let j = 0; j < puffCount; j++) {
      const radius = randomRange(9, 19);
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 9, 6),
        cloudMaterial
      );
      puff.position.set(
        (j - (puffCount - 1) / 2) * randomRange(12, 20),
        randomRange(-8, 8),
        randomRange(-4, 5)
      );
      puff.scale.set(1.35, 0.72, 0.52);
      cloud.add(puff);
    }
    cloud.userData = {
      offsetX: randomRange(-760, 760),
      offsetY: randomRange(260, 900),
      height: randomRange(155, 300),
      drift: randomRange(1.2, 3.8),
      material: cloudMaterial
    };
    scene.add(cloud);
    clouds.push(cloud);
  }

  let mode = 'auto';
  let phase = 0.08;
  let elapsed = 0;

  function cycleMode() {
    mode = mode === 'auto' ? 'day' : mode === 'day' ? 'night' : 'auto';
    return mode;
  }

  function getMode() {
    return mode;
  }

  function update(delta) {
    elapsed += delta;
    if (mode === 'auto') phase = (phase + delta / CYCLE_SECONDS) % 1;

    const wave = (Math.cos(phase * Math.PI * 2) + 1) * 0.5;
    const dayFactor = mode === 'day' ? 1 : mode === 'night' ? 0 : wave;
    const duskFactor = mode === 'auto'
      ? Math.max(0, 1 - Math.abs(wave - 0.5) * 3.2)
      : 0;

    workingColor.copy(nightBackground).lerp(duskBackground, duskFactor * 0.42);
    workingColor.lerp(dayBackground, dayFactor);
    scene.background.copy(workingColor);

    workingColor.copy(nightFog).lerp(duskFog, duskFactor * 0.5);
    workingColor.lerp(dayFog, dayFactor);
    if (scene.fog) scene.fog.color.copy(workingColor);

    workingColor.copy(nightGround).lerp(dayGround, dayFactor);
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

    const orbit = phase * Math.PI * 2;
    const px = playerGroup.position.x;
    const py = playerGroup.position.y;
    const pz = playerGroup.position.z;
    if (mode === 'day') {
      sun.position.set(px + 180, py + 220, pz + 520);
      moon.position.set(px - 180, py + 180, pz + 460);
    } else if (mode === 'night') {
      sun.position.set(px + 180, py + 220, pz + 420);
      moon.position.set(px - 180, py + 180, pz + 520);
    } else {
      sun.position.set(px + Math.cos(orbit) * 650, py + 200, pz + 220 + Math.sin(orbit) * 480);
      moon.position.set(px - Math.cos(orbit) * 620, py + 180, pz + 220 - Math.sin(orbit) * 460);
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
    // Halos intensify near the horizon (dusk)
    const sunHorizonGlow = 1 - Math.abs(dayFactor - 0.5) * 1.4;
    sunHaloInner.material.opacity = 0.45 * Math.max(0, sunHorizonGlow);
    sunHaloMid.material.opacity = 0.22 * Math.max(0, sunHorizonGlow);
    sunHaloOuter.material.opacity = 0.10 * Math.max(0, sunHorizonGlow);
    sunFlare.material.opacity = 0.55 * Math.max(0, sunHorizonGlow);
    moon.visible = dayFactor < 0.76 && mode !== 'day';
    moonHaloInner.visible = moon.visible;
    moonHaloOuter.visible = moon.visible;
    moonFlare.visible = moon.visible;
    const moonHorizonGlow = 1 - Math.abs(dayFactor - 0.0) * 0.6;
    moonHaloInner.material.opacity = 0.40 * Math.max(0.2, moonHorizonGlow);
    moonHaloOuter.material.opacity = 0.15 * Math.max(0.2, moonHorizonGlow);
    moonFlare.material.opacity = 0.30 * Math.max(0.2, moonHorizonGlow);

    stars.visible = dayFactor < 0.78;
    starMaterial.opacity = Math.max(0, (0.78 - dayFactor) / 0.78) * 0.9;

    // Star coordinates are local offsets, so only move the Points object with the player.
    stars.position.set(px, py, 0);

    const fireflyAttr = fireflyGeometry.getAttribute('position');
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const offset = fireflyOffsets[i];
      fireflyAttr.array[i * 3] = px + Math.cos(elapsed * 0.23 + offset) * (100 + (i % 7) * 23);
      fireflyAttr.array[i * 3 + 1] = py + Math.sin(elapsed * 0.19 + offset) * (90 + (i % 5) * 25);
      fireflyAttr.array[i * 3 + 2] = 8 + (Math.sin(elapsed * 1.6 + offset) + 1) * 22;
    }
    fireflyAttr.needsUpdate = true;
    fireflies.visible = dayFactor < 0.58;
    fireflyMaterial.opacity = Math.max(0, (0.58 - dayFactor) / 0.58) * (0.7 + Math.sin(elapsed * 3) * 0.22);
    fireflyMaterial.size = 3.2 + Math.sin(elapsed * 2.6) * 0.7;

    for (const cloud of clouds) {
      const data = cloud.userData;
      cloud.position.set(
        px + data.offsetX + Math.sin(elapsed * 0.025 + data.offsetY) * 14,
        py + data.offsetY + elapsed * data.drift,
        pz + data.height
      );
      // Clouds soften at night rather than disappearing into the dark sky.
      data.material.opacity = 0.18 + dayFactor * 0.46;
      data.material.color.set(dayFactor > 0.55 ? 0xf7fbff : 0x9ebce0);
    }

    // External listeners (e.g. audio ambient brightness) — called after
    // all visual state is settled.
    for (const fn of onCycle) fn(dayFactor);

    return {
      dayFactor,
      label: mode === 'auto' ? 'AUTO CYCLE' : mode === 'day' ? 'DAYLIGHT' : 'NIGHT',
      // HSL lightness values for the sky-dome shader (top / horizon).
      skyTop: 0.05 + dayFactor * 0.55,
      skyBottom: 0.15 + dayFactor * 0.55
    };
  }

  function onUpdate(fn) {
    onCycle.push(fn);
  }

  function dispose() {
    const allObjects = [
      sun, sunHaloInner, sunHaloMid, sunHaloOuter, sunFlare,
      moon, moonHaloInner, moonHaloOuter, moonFlare,
      stars, fireflies, ...clouds
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
    }
    if (flareTex) flareTex.dispose();
  }

  return { update, cycleMode, getMode, dispose, onUpdate };
}
