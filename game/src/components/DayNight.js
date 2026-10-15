import * as THREE from 'three';

const DAY_SKY = new THREE.Color(0x9bc9e8);
const SUNSET_SKY = new THREE.Color(0x9b6c7b);
const NIGHT_SKY = new THREE.Color(0x080f27);
const DAY_FOG = new THREE.Color(0xb4d2df);
const NIGHT_FOG = new THREE.Color(0x10172d);
const DAY_GROUND = new THREE.Color(0x344b2d);
const NIGHT_GROUND = new THREE.Color(0x111c27);
const DAY_AMBIENT = new THREE.Color(0xffe8cc);
const NIGHT_AMBIENT = new THREE.Color(0x536da8);
const DAY_SUN = new THREE.Color(0xffd39a);
const NIGHT_SUN = new THREE.Color(0x7798e8);

export function createDayNightCycle({ scene, ambientLight, sunLight, fillLight, rimLight, groundMaterial, fog }) {
  const cycleDuration = 180;
  let elapsed = 0;

  const hud = document.createElement('div');
  hud.className = 'world-clock';
  hud.innerHTML = '<span class="world-clock__dot"></span><span class="world-clock__label">DAWN</span><span class="world-clock__time">06:00</span>';
  document.body.appendChild(hud);
  const label = hud.querySelector('.world-clock__label');
  const timeLabel = hud.querySelector('.world-clock__time');
  const dot = hud.querySelector('.world-clock__dot');

  const sky = new THREE.Color();
  const fogColor = new THREE.Color();
  const groundColor = new THREE.Color();
  const ambientColor = new THREE.Color();
  const sunColor = new THREE.Color();

  function update(delta) {
    elapsed = (elapsed + delta) % cycleDuration;
    const phase = (elapsed / cycleDuration) * Math.PI * 2;
    // Smooth daylight curve: sunrise -> noon -> sunset -> deep night.
    const daylight = THREE.MathUtils.smoothstep(Math.sin(phase), -0.32, 0.72);
    const twilight = 1 - Math.min(1, Math.abs(daylight - 0.5) * 2);
    const isNight = daylight < 0.22;

    sky.copy(NIGHT_SKY).lerp(SUNSET_SKY, twilight * 0.55).lerp(DAY_SKY, daylight);
    fogColor.copy(NIGHT_FOG).lerp(DAY_FOG, daylight);
    groundColor.copy(NIGHT_GROUND).lerp(DAY_GROUND, daylight);
    ambientColor.copy(NIGHT_AMBIENT).lerp(DAY_AMBIENT, daylight);
    sunColor.copy(NIGHT_SUN).lerp(DAY_SUN, daylight);

    scene.background.copy(sky);
    if (fog) fog.color.copy(fogColor);
    groundMaterial.color.copy(groundColor);
    ambientLight.color.copy(ambientColor);
    ambientLight.intensity = 0.38 + daylight * 1.05;
    sunLight.color.copy(sunColor);
    sunLight.intensity = 0.18 + daylight * 1.65;
    fillLight.intensity = 0.12 + daylight * 0.42;
    rimLight.intensity = 0.2 + (1 - daylight) * 0.95;

    const hours = Math.floor((elapsed / cycleDuration) * 24);
    const minutes = Math.floor(((elapsed / cycleDuration) * 24 * 60) % 60);
    const clock = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    const phaseName = daylight > 0.72 ? 'DAYLIGHT' : daylight > 0.42 ? 'GOLDEN HOUR' : isNight ? 'NIGHT' : 'DAWN';
    label.textContent = phaseName;
    timeLabel.textContent = clock;
    hud.dataset.phase = isNight ? 'night' : daylight > 0.72 ? 'day' : 'twilight';
    dot.style.opacity = String(0.55 + 0.45 * Math.sin(elapsed * 2.2) ** 2);
  }

  function dispose() {
    hud.remove();
  }

  update(0);
  return { update, dispose };
}
