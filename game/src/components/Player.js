import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createPlayer() {
  const group = new THREE.Group();
  // Keep world-Z yaw separate from the model's intrinsic orientation and idle sway.
  const facingGroup = new THREE.Group();
  group.add(facingGroup);
  let model = null;

  // Procedural animation state (Tode has no skeleton animations)
  const anim = {
    time: 0,
    isMoving: false,
    moveProgress: 0, // 0..1 during a jump
    idlePhase: Math.random() * Math.PI * 2
  };

  // Hurt-flash state: tints the model emissive red for a brief moment.
  let flashTime = 0;
  const FLASH_DURATION = 0.25;

  // Saved base material colors so we can restore after flash.
  const baseEmissives = [];

  const loader = new GLTFLoader();
  loader.load(
    '/models/tode.glb',
    (gltf) => {
      model = gltf.scene;

      model.rotation.x = Math.PI / 2;
      model.scale.setScalar(20);

      // World is Z-up; recenter along Z so the base sits on the ground plane
      const box = new THREE.Box3().setFromObject(model);
      // Put the lowest point on the Z=0 ground plane.
      model.position.z -= box.min.z;

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // Remember original emissive so we can flash and restore
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => {
                if (!m.emissive) m.emissive = new THREE.Color(0x000000);
                baseEmissives.push(m);
              });
            } else {
              if (!child.material.emissive) child.material.emissive = new THREE.Color(0x000000);
              baseEmissives.push(child.material);
            }
          }
        }
      });

      facingGroup.add(model);
    },
    undefined,
    (error) => {
      console.error('Failed to load Tode model:', error);
    }
  );

  function setMoving(isMoving) {
    anim.isMoving = isMoving;
  }

  function flash() {
    flashTime = FLASH_DURATION;
  }

  function updateAnim(delta) {
    anim.time += delta;
    if (!model) return;
    // While moving, Movement.js owns model rotation and scale (jump arc +
    // squash/stretch). Don't fight it.
    if (anim.isMoving) return;

    const t = anim.time;
    // Idle: gentle breathing + sway. Y is the model's local "up" after the
    // Math.PI/2 X-rotation, so we squash it for a breath pulse.
    const breath = Math.sin(t * 2.2 + anim.idlePhase) * 0.04;
    const sway = Math.sin(t * 1.6 + anim.idlePhase) * 0.04;

    model.rotation.z = sway;
    const baseScale = 20;
    const breathScale = 1 + breath * 0.5;
    model.scale.y = baseScale * breathScale;
  }

  function update(delta) {
    updateAnim(delta);
    updateFlash(delta);
  }

  function updateFlash(delta) {
    if (flashTime <= 0) {
      // Make sure emissives are back to base
      for (const m of baseEmissives) {
        if (m.emissive && m.userData?.todeBaseEmissiveR !== undefined) {
          m.emissive.setRGB(
            m.userData.todeBaseEmissiveR,
            m.userData.todeBaseEmissiveG,
            m.userData.todeBaseEmissiveB
          );
        }
      }
      return;
    }
    flashTime = Math.max(0, flashTime - delta);
    const t = flashTime / FLASH_DURATION;
    // Cache the base emissive on first flash
    for (const m of baseEmissives) {
      if (m.userData?.todeBaseEmissiveR === undefined) {
        m.userData.todeBaseEmissiveR = m.emissive.r;
        m.userData.todeBaseEmissiveG = m.emissive.g;
        m.userData.todeBaseEmissiveB = m.emissive.b;
      }
      m.emissive.setRGB(1, 0.1, 0.1).multiplyScalar(t);
    }
  }

  function getModel() {
    return model;
  }

  // Briefly hide/restore model visibility (used during dash i-frames blink).
  function setVisible(v) {
    group.visible = v;
  }

  return { group, getModel, update, setMoving, flash, setVisible };
}
