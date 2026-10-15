import * as THREE from 'three';

const CYCLE_SECONDS = 180;
const STAR_COUNT = 260;
const FIREFLY_COUNT = 70;

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

  const dayBackground = new THREE.Color(0x91c9df);
  const duskBackground = new THREE.Color(0xf18b68);
  const nightBackground = new THREE.Color(0x071024);
  const dayFog = new THREE.Color(0x91c9df);
  const duskFog = new THREE.Color(0x6e405f);
  const nightFog = new THREE.Color(0x101b38);
  const dayGround = new THREE.Color(0x344b2b);
  const nightGround = new THREE.Color(0x101d25);
  const workingColor = new THREE.Color();

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(34, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe6a0 })
  );
  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(48, 20, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffb95e,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    })
  );
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(25, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xd8e7ff })
  );
  const moonGlow = new THREE.Mesh(
    new THREE.SphereGeometry(38, 20, 12),
    new THREE.MeshBasicMaterial({
      color: 0x8eb8ff,
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    })
  );
  scene.add(sun, sunGlow, moon, moonGlow);

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

    ambientLight.intensity = 0.24 + dayFactor * 1.05;
    ambientLight.color.setRGB(
      0.48 + dayFactor * 0.42,
      0.58 + dayFactor * 0.34,
      0.95 - dayFactor * 0.12
    );
    directionalLight.intensity = 0.18 + dayFactor * 1.55;
    directionalLight.color.set(0xffd6a0).lerp(new THREE.Color(0xfff2dc), dayFactor);
    fillLight.intensity = 0.12 + dayFactor * 0.4;
    rimLight.intensity = 0.12 + dayFactor * 0.58;

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
    sunGlow.position.copy(sun.position);
    moonGlow.position.copy(moon.position);
    sun.visible = dayFactor > 0.08 && mode !== 'night';
    sunGlow.visible = sun.visible;
    moon.visible = dayFactor < 0.76 && mode !== 'day';
    moonGlow.visible = moon.visible;
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
    fireflies.visible = dayFactor < 0.48;
    fireflyMaterial.opacity = Math.max(0, (0.48 - dayFactor) / 0.48) * (0.55 + Math.sin(elapsed * 3) * 0.2);

    return { dayFactor, label: mode === 'auto' ? 'AUTO CYCLE' : mode === 'day' ? 'DAYLIGHT' : 'NIGHT' };
  }

  function dispose() {
    for (const object of [sun, sunGlow, moon, moonGlow, stars, fireflies]) {
      scene.remove(object);
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    }
  }

  return { update, cycleMode, getMode, dispose };
}
