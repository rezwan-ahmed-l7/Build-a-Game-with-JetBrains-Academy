import * as THREE from 'three';

const CYCLE_SECONDS = 60;   // full day/night cycle in seconds (1 min)
const STAR_COUNT = 260;
const FIREFLY_COUNT = 46;
const CLOUD_COUNT = 18;

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
  let phase = 0.08;
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
    // Dusk factor is driven by the sun's HEIGHT (low sun = orange sky),
    // not just by mode. This way the sky actually goes orange when the
    // sun is near the horizon in any mode (auto / day / night), and
    // returns to blue/night as the sun climbs out of frame.
    // sunHeightFrac is sin(orbit*π): 0 at sunrise/sunset, 1 at noon.
    // We invert it so dusk is strong when sun is LOW.
    const sunHeightFrac = Math.sin(phase * Math.PI);
    const sunLowFactor = 1 - sunHeightFrac;  // 1 at horizon, 0 at noon
    // Squash the curve so dusk only shows in the lowest 25% of the arc.
    // 0..0.25 maps to 0..1 dusk strength; 0.25+ clamps to 0.
    const duskFactor = Math.max(0, 1 - sunHeightFrac * 4);

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
    const orbit = phase * Math.PI * 2;
    const px = playerGroup.position.x;
    const py = playerGroup.position.y;
    const pz = playerGroup.position.z;

    // Arc parameters — placed so the sun/moon always stay in the sky
    // (never touching the ground) while still arcing visibly across the
    // camera view. The Z (height) varies from MIN_HEIGHT at sunrise/sunset
    // to PEAK_HEIGHT at noon/midnight, never dropping below MIN_HEIGHT.
    //
    // Distance is large enough that the sun/moon read as far away in the
    // sky, not as nearby objects hovering over the player.
    const HORIZONTAL_DIST = 480;   // east/west sweep distance from player
    const MIN_HEIGHT = 110;        // sun/moon height at sunrise/sunset
    const PEAK_HEIGHT = 260;       // sun/moon height at noon/midnight
    // Half-arc for height: reuses sunHeightFrac from above (0 at sunrise,
    // 1 at noon, 0 at sunset) so the arc positioning matches the sky
    // color. Do NOT redeclare sunHeightFrac here.
    const sunX = Math.cos(orbit) * HORIZONTAL_DIST;
    const sunY = Math.sin(orbit) * 100;
    const sunZ = MIN_HEIGHT + sunHeightFrac * (PEAK_HEIGHT - MIN_HEIGHT);
    // Moon is "up" during the night portion of the cycle (when sun is low)
    // Keep the moon high when the sun is near the horizon, and low when
    // the sun is near noon. The previous (orbit + 1) * PI expression mixed
    // radians with a cycle offset and produced an unrelated moon arc.
    const moonHeightFrac = 1 - sunHeightFrac;
    const moonX = -Math.cos(orbit) * HORIZONTAL_DIST;
    const moonY = -Math.sin(orbit) * 100;
    const moonZ = MIN_HEIGHT + moonHeightFrac * (PEAK_HEIGHT - MIN_HEIGHT);

    if (mode === 'day') {
      // Day mode also follows an arc — phase=0 is sunrise (horizon left),
      // phase=0.5 is noon (overhead), phase=1 is sunset (horizon right).
      // This way the user actually sees the sun rise and set, not a static sky.
      sun.position.set(px + sunX, py + sunY, pz + sunZ);
      // Moon stays below the horizon during day — push it underground.
      moon.position.set(px + moonX, py + moonY, pz - 600);
    } else if (mode === 'night') {
      // Night mode: phase drives the moon's rise/set, sun goes underground.
      moon.position.set(px + moonX, py + moonY, pz + moonZ);
      sun.position.set(px + sunX, py + sunY, pz - 600);
    } else {
      sun.position.set(px + sunX, py + sunY, pz + sunZ);
      moon.position.set(px + moonX, py + moonY, pz + moonZ);
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

    // Fireflies only update when visible to save GPU bandwidth
    if (dayFactor < 0.58) {
      const fireflyAttr = fireflyGeometry.getAttribute('position');
      for (let i = 0; i < FIREFLY_COUNT; i++) {
        const offset = fireflyOffsets[i];
        fireflyAttr.array[i * 3] = px + Math.cos(elapsed * 0.23 + offset) * (100 + (i % 7) * 23);
        fireflyAttr.array[i * 3 + 1] = py + Math.sin(elapsed * 0.19 + offset) * (90 + (i % 5) * 25);
        fireflyAttr.array[i * 3 + 2] = 8 + (Math.sin(elapsed * 1.6 + offset) + 1) * 22;
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

  return { update, cycleMode, setMode, setPhase, getMode, dispose, onUpdate };
}
