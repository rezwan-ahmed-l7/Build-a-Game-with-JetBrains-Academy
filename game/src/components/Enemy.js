import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ENEMY_TYPES } from './EnemyTypes.js';

const _baseColor = new THREE.Color();
const _mixed = new THREE.Color();

// createEnemy(type='chaser') → { group, getYawGroup, getModel, getMixer, getRootBone, getType, getStats }
export function createEnemy(type = 'chaser') {
  const def = ENEMY_TYPES[type] || ENEMY_TYPES.chaser;

  const group = new THREE.Group();
  const yawGroup = new THREE.Group();
  group.add(yawGroup);

  let model = null;
  let mixer = null;
  let flyAction = null;
  let rootBone = null;
  let hp = def.hp;

  const loader = new GLTFLoader();
  loader.load(
    '/models/enemy.glb',
    (gltf) => {
      model = gltf.scene;

      model.rotation.x = Math.PI / 2;

      // ±10% scale variation so the pack looks natural
      const scaleVariation = 0.9 + Math.random() * 0.2;
      model.scale.setScalar(def.scale * scaleVariation);

      // World is Z-up; recenter along Z so the base sits on the ground plane
      const box = new THREE.Box3().setFromObject(model);
      model.position.z -= box.min.z;

      // HSL tint per type
      const tint = new THREE.Color();
      const t = def.tint;
      tint.setHSL(t.h + (Math.random() - 0.5) * 0.04,
                  t.s + (Math.random() - 0.5) * 0.1,
                  t.l + (Math.random() - 0.5) * 0.1);

      model.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        if (!child.material) return;

        const newMaterial = child.material.clone();
        _baseColor.copy(newMaterial.color);
        _mixed.lerpColors(_baseColor, tint, 0.45);  // moderate tint mix
        newMaterial.color.copy(_mixed);
        if ('emissive' in newMaterial) {
          newMaterial.emissive.copy(tint).multiplyScalar(def.emissive);
          newMaterial.emissiveIntensity = 0.9;
        }
        child.material = newMaterial;
      });

      yawGroup.add(model);

      mixer = new THREE.AnimationMixer(model);
      const clips = gltf.animations || [];
      const flyClip =
        THREE.AnimationClip.findByName(clips, 'CharacterArmature|Fast_Flying') ||
        THREE.AnimationClip.findByName(clips, 'CharacterArmature|Flying_Idle') ||
        clips[0];

      if (flyClip) {
        flyAction = mixer.clipAction(flyClip);
        // Sprinters flap faster; brutes flap slowly (heavy)
        if (def.name === 'sprinter') flyAction.setEffectiveTimeScale(1.8);
        if (def.name === 'brute') flyAction.setEffectiveTimeScale(0.6);
        flyAction.play();
      }

      model.traverse((c) => {
        if (c.name === 'Root' && !rootBone) rootBone = c;
      });
    },
    undefined,
    (error) => {
      console.error('Error loading enemy model:', error);
    }
  );

  function getYawGroup() { return yawGroup; }
  function getModel() { return model; }
  function getMixer() { return mixer; }
  function getRootBone() { return rootBone; }
  function getType() { return def.name; }
  function getStats() { return def; }
  function getHp() { return hp; }
  function damageHp(n = 1) { hp = Math.max(0, hp - n); return hp; }

  return { group, getYawGroup, getModel, getMixer, getRootBone,
           getType, getStats, getHp, damageHp };
}
