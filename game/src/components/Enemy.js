import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ENEMY_TYPES } from './EnemyTypes.js';

// Shared loader so the enemy model is cached after the first load
const enemyLoader = new GLTFLoader();

// Per-archetype color palette. Each entry says exactly what color
// the model's named materials should be, so we can hit the
// "dark brown body + gold stripes" look without tinting the
// teeth/tongue/eyes by accident.
//
// `_stripes` and `_body` use absolute colors. The other slots (teeth,
// eyes, wings) get small per-instance jitter so packs don't look like
// clones of each other, but the overall identity stays consistent.
const ARCHETYPE_PALETTES = {
  chaser: {
    body:   0x6b3a1a,   // rich warm brown (clearly brown, not black)
    stripes: 0xff8a1c,  // warm amber-orange
    teeth:  0xf3e6c4,   // cream
    tongue: 0x6b3037,   // dark wine
    eyeWhite: 0xeef0f3,
    eyeBlack: 0x2a1208,
    wings: 0x4a2810,
    stripeGlow: 0.95,   // emissive intensity for stripes
    stripePulse: 0.10   // tiny flicker amplitude (kept low to avoid strobing)
  },
  sprinter: {
    body:   0x7a4220,   // warmer reddish-brown
    stripes: 0xff9a28,  // hot amber
    teeth:  0xf5e8c8,
    tongue: 0x7a353c,
    eyeWhite: 0xf0f2f5,
    eyeBlack: 0x281008,
    wings: 0x552a14,
    stripeGlow: 1.20,   // sprinters glow hotter
    stripePulse: 0.18
  },
  brute: {
    body:   0x5a3018,   // cocoa brown
    stripes: 0xff7a14,  // deep amber
    teeth:  0xe8d8b0,
    tongue: 0x5e2a30,
    eyeWhite: 0xc8cad0,
    eyeBlack: 0x1f0c06,
    wings: 0x3a2010,
    stripeGlow: 0.70,   // brutes glow less
    stripePulse: 0.06
  }
};

// Lookup table from material name -> color slot. Anything not in this
// map keeps the GLB's authored color (so we don't accidentally
// recolor something we shouldn't).
const MATERIAL_TO_SLOT = {
  Armabee_Main: 'body',
  Armabee_Secondary: 'stripes',
  Teeth: 'teeth',
  Tongue: 'tongue',
  Eye_White: 'eyeWhite',
  Eye_Black: 'eyeBlack',
  Wings: 'wings'
};

// createEnemy(type='chaser') → { group, getYawGroup, getModel, getMixer, getRootBone, getType, getStats }
export function createEnemy(type = 'chaser') {
  const def = ENEMY_TYPES[type] || ENEMY_TYPES.chaser;
  const palette = ARCHETYPE_PALETTES[type] || ARCHETYPE_PALETTES.chaser;

  const group = new THREE.Group();
  const yawGroup = new THREE.Group();
  group.add(yawGroup);
  // Keep invisible until the model finishes loading so the enemy doesn't
  // appear as an empty group that suddenly pops into view.
  group.visible = false;

  let model = null;
  let mixer = null;
  let flyAction = null;
  let rootBone = null;
  let stripeMaterials = []; // ref list so the animation loop can pulse them
  let hp = def.hp;

  // Per-instance jitter for non-stripe, non-body parts so packs look
  // varied without losing the "black + gold" identity.
  const instanceJitter = {
    teeth:  (Math.random() - 0.5) * 0.06,
    tongue: (Math.random() - 0.5) * 0.08,
    eyeWhite: (Math.random() - 0.5) * 0.04,
    wings: (Math.random() - 0.5) * 0.05
  };

  enemyLoader.load(
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

      // Per-material recolor. We DO NOT use a global HSL tint — each named
      // material gets its own absolute color so the gold stripes stay vivid
      // and the body stays pitch black.
      model.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        if (!child.material) return;

        const newMaterial = child.material.clone();
        const slot = MATERIAL_TO_SLOT[newMaterial.name];
        if (slot && palette[slot] !== undefined) {
          const baseCol = new THREE.Color(palette[slot]);
          // Apply small jitter to non-stripe parts only (body + stripes
          // must stay consistent across the pack for readability).
          if (instanceJitter[slot] !== undefined) {
            const hsl = { h: 0, s: 0, l: 0 };
            baseCol.getHSL(hsl);
            hsl.l = Math.max(0, Math.min(1, hsl.l + instanceJitter[slot]));
            baseCol.setHSL(hsl.h, hsl.s, hsl.l);
          }
          newMaterial.color.copy(baseCol);
        }

        // Stripes get a vivid gold emissive so they read as glowing bands
        // even in shadow. Other materials keep a tiny ambient self-light so
        // they don't disappear in dark scenes.
        if (newMaterial.name === 'Armabee_Secondary') {
          const stripeColor = new THREE.Color(palette.stripes);
          newMaterial.emissive.copy(stripeColor);
          newMaterial.emissiveIntensity = palette.stripeGlow;
          stripeMaterials.push(newMaterial);
        } else if (newMaterial.name === 'Eye_White') {
          newMaterial.emissive.setHex(0xffffff);
          newMaterial.emissiveIntensity = 0.18;
        } else {
          newMaterial.emissiveIntensity = 0;
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
      // Model loaded — make the group visible now.
      group.visible = true;
    },
    undefined,
    (error) => {
      console.error('Error loading enemy model:', error);
    }
  );

  // Subtle gold-stripe pulse — slowly varies emissive intensity so the
  // enemies feel alive without strobing. Keeps the same value for the
  // entire frame so the appearance is stable (no flicker).
  const baseGlow = palette.stripeGlow;
  const pulseAmp = palette.stripePulse;
  function pulseStripes(elapsed) {
    if (stripeMaterials.length === 0) return;
    // Two slow sines on different frequencies so the pulse never lines up
    // with the camera or animation frames — perceived as smooth glow, not
    // as a flicker.
    const t = elapsed;
    const k = baseGlow + Math.sin(t * 1.7) * pulseAmp * 0.6
                     + Math.sin(t * 0.6 + 1.1) * pulseAmp * 0.4;
    for (const m of stripeMaterials) {
      m.emissiveIntensity = k;
    }
  }

  function getModel() { return model; }
  function getType() { return def.name; }
  function getStats() { return def; }
  function getHp() { return hp; }
  function damageHp(n = 1) { hp = Math.max(0, hp - n); return hp; }

  // Return plain values for yawGroup; mixer and rootBone are lazy getters
  // because they are assigned asynchronously after the model loads.
  const ret = {
    group,
    yawGroup,
    getModel,
    getType,
    getStats,
    getHp,
    damageHp,
    pulseStripes,
    get mixer() { return mixer; },
    get rootBone() { return rootBone; }
  };

  return ret;
}
