import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const _baseColor = new THREE.Color();
const _mixed = new THREE.Color();

export function createEnemy() {
  const group = new THREE.Group();
  // Inner "yaw" group handles facing the player. The loaded model sits inside
  // it so we can keep the model's intrinsic Math.PI/2 X-rotation untouched.
  const yawGroup = new THREE.Group();
  group.add(yawGroup);

  let model = null;
  let mixer = null;
  let flyAction = null;
  let rootBone = null;

  const loader = new GLTFLoader();
  loader.load(
    '/models/enemy.glb',
    (gltf) => {
      model = gltf.scene;

      model.rotation.x = Math.PI / 2;

      // ±10% scale variation so the pack looks natural
      const scaleVariation = 0.9 + Math.random() * 0.2;
      model.scale.setScalar(5 * scaleVariation);

      // World is Z-up; recenter along Z so the base sits on the ground plane
      const box = new THREE.Box3().setFromObject(model);
      const height = box.max.z - box.min.z;
      model.position.z = -box.min.z - height / 2;

      // Bright HSL tint in the red-orange band; keep luminance high so the
      // multiply-onto-base blend never produces a black enemy.
      const tint = new THREE.Color();
      tint.setHSL(
        Math.random() * 0.1,
        0.4 + Math.random() * 0.3,
        0.6 + Math.random() * 0.2
      );

      model.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        if (!child.material) return;

        const newMaterial = child.material.clone();
        _baseColor.copy(newMaterial.color);
        _mixed.lerpColors(_baseColor, tint, 0.4);
        newMaterial.color.copy(_mixed);
        child.material = newMaterial;
      });

      yawGroup.add(model);

      // Setup flying animation. The model has these clips:
      //   CharacterArmature|Fast_Flying   - continuous flapping
      //   CharacterArmature|Flying_Idle   - hover in place
      // Pick Fast_Flying for chasers, falling back to Flying_Idle.
      mixer = new THREE.AnimationMixer(model);
      const clips = gltf.animations || [];
      const flyClip =
        THREE.AnimationClip.findByName(clips, 'CharacterArmature|Fast_Flying') ||
        THREE.AnimationClip.findByName(clips, 'CharacterArmature|Flying_Idle') ||
        clips[0];

      if (flyClip) {
        flyAction = mixer.clipAction(flyClip);
        flyAction.play();
      }

      // Find the Root bone (if any) for body tilt
      model.traverse((c) => {
        if (c.name === 'Root' && !rootBone) rootBone = c;
      });
    },
    undefined,
    (error) => {
      console.error('Error loading enemy model:', error);
    }
  );

  function getYawGroup() {
    return yawGroup;
  }

  function getModel() {
    return model;
  }

  function getMixer() {
    return mixer;
  }

  function getRootBone() {
    return rootBone;
  }

  return { group, getYawGroup, getModel, getMixer, getRootBone };
}
