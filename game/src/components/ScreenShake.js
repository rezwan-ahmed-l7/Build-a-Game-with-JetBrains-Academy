// Screen shake: applies a decaying random offset on top of whatever the
// camera system already does. We don't replace camera positioning — we add
// to it and reset every frame.

import * as THREE from 'three';

const _offset = new THREE.Vector3();

export function createScreenShake() {
  let intensity = 0;
  let decay = 8; // intensity / sec
  let frequency = 30; // randomize samples per sec
  let accumulator = 0;
  let sampleX = 0, sampleY = 0, sampleZ = 0;
  let lastSampleTime = 0;

  function kick(amount) {
    intensity = Math.max(intensity, amount);
  }

  function update(delta, target, outOffset) {
    // outOffset: optional Vector3 the caller can apply to camera position
    const off = outOffset || _offset;
    off.set(0, 0, 0);
    if (intensity <= 0.001) {
      intensity = 0;
      return off;
    }
    accumulator += delta;
    if (accumulator > 1 / frequency) {
      accumulator = 0;
      sampleX = (Math.random() * 2 - 1) * intensity;
      sampleY = (Math.random() * 2 - 1) * intensity;
      sampleZ = (Math.random() * 2 - 1) * intensity * 0.4;
    }
    off.set(sampleX, sampleY, sampleZ);
    intensity = Math.max(0, intensity - decay * delta);
    return off;
  }

  function getIntensity() {
    return intensity;
  }

  return { kick, update, getIntensity };
}
