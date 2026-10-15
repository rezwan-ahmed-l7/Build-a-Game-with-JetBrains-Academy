// Dash: brief burst of movement in a direction, with i-frames. We don't
// replace Movement's grid step — we just apply a position nudge per frame
// for a short duration. The grid step is queued normally; the player
// simply slides on top of it for the dash duration.
//
// I-frames and cooldown are wall-clock based (performance.now) so they
// remain accurate even when frame deltas spike (e.g. background tab,
// headless rendering, slow first frames).

import * as THREE from 'three';

const DASH_DURATION_MS = 220;
const DASH_SPEED = 360;
const DASH_COOLDOWN_MS = 1100;
const I_FRAME_DURATION_MS = 280;
const DASH_BLINK_INTERVAL_MS = 50;

const _camDir = new THREE.Vector3();

export function createDash(playerGroup, camera, getInputDirection) {
  let activeUntilMs = 0;
  let dashStartMs = 0;
  let cooldownUntilMs = 0;
  let iFramesUntilMs = 0;
  let lastBlinkMs = 0;
  let dirX = 0, dirY = 0;
  let blinkVisible = true;

  function now() { return performance.now(); }

  function tryStart() {
    if (now() < cooldownUntilMs) return false;
    dirX = 0;
    dirY = 0;
    const inputDir = getInputDirection();
    if (!inputDir) return false;

    camera.getWorldDirection(_camDir);
    const len = Math.sqrt(_camDir.x * _camDir.x + _camDir.y * _camDir.y);
    if (len < 0.001) return false;
    const fwdX = _camDir.x / len;
    const fwdY = _camDir.y / len;
    const rightX = -fwdY;
    const rightY = fwdX;

    if (inputDir.fwd) { dirX += fwdX; dirY += fwdY; }
    if (inputDir.back) { dirX -= fwdX; dirY -= fwdY; }
    if (inputDir.right) { dirX -= rightX; dirY -= rightY; }
    if (inputDir.left) { dirX += rightX; dirY += rightY; }
    const dlen = Math.sqrt(dirX * dirX + dirY * dirY);
    if (dlen < 0.001) return false;
    dirX /= dlen;
    dirY /= dlen;

    const t = now();
    dashStartMs = t;
    activeUntilMs = t + DASH_DURATION_MS;
    iFramesUntilMs = t + I_FRAME_DURATION_MS;
    cooldownUntilMs = t + DASH_COOLDOWN_MS;
    return true;
  }

  function update(delta) {
    const t = now();

    // I-frame blink — flip visibility every DASH_BLINK_INTERVAL_MS while in i-frames.
    if (t < iFramesUntilMs) {
      if (t - lastBlinkMs > DASH_BLINK_INTERVAL_MS) {
        lastBlinkMs = t;
        blinkVisible = !blinkVisible;
        playerGroup.visible = blinkVisible;
      }
    } else if (!blinkVisible) {
      // i-frames over — restore visibility
      blinkVisible = true;
      playerGroup.visible = true;
    }

    // Active dash burst — apply slide.
    if (t < activeUntilMs) {
      const elapsed = t - dashStartMs;
      const progress = elapsed / DASH_DURATION_MS;
      const speed = DASH_SPEED * (1 - progress * 0.4);
      // Clamp delta so a single big frame doesn't yeet the player across the map
      const stepDt = Math.min(delta, 0.05);
      playerGroup.position.x += dirX * speed * stepDt;
      playerGroup.position.y += dirY * speed * stepDt;
    }
  }

  function isDashing() { return now() < activeUntilMs; }
  function isInvulnerable() { return now() < iFramesUntilMs; }
  function getCooldown() {
    const left = cooldownUntilMs - now();
    return left > 0 ? left / 1000 : 0;
  }
  function getCooldownMax() { return DASH_COOLDOWN_MS / 1000; }

  function reset() {
    activeUntilMs = 0;
    dashStartMs = 0;
    cooldownUntilMs = 0;
    iFramesUntilMs = 0;
    lastBlinkMs = 0;
    blinkVisible = true;
    playerGroup.visible = true;
  }

  return { tryStart, update, isDashing, isInvulnerable,
           getCooldown, getCooldownMax, reset };
}
