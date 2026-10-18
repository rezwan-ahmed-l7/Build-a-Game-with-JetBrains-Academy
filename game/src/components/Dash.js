// Dash: brief burst of movement in a direction, with i-frames. We don't
// replace Movement's grid step — we just apply a position nudge per frame
// for a short duration. The grid step is queued normally; the player
// simply slides on top of it for the dash duration.
//
// I-frames and cooldown are wall-clock based (performance.now) so they
// remain accurate even when frame deltas spike (e.g. background tab,
// headless rendering, slow first frames).

import * as THREE from 'three';

let DASH_DURATION_MS = 250; // base 250ms, grows with level
const DASH_SPEED = 360;
let DASH_COOLDOWN_MS = 1000; // fixed 1.0s
let I_FRAME_DURATION_MS = 250; // base 250ms, grows with level
const DASH_BLINK_INTERVAL_MS = 50; // fixed 50ms

const _camDir = new THREE.Vector3();

export function createDash(playerGroup, camera, getInputDirection, applyDisplacement = null) {
  let dashElapsedMs = 0;
  let dashRemainingMs = 0;
  let cooldownUntilMs = 0;
  let iFramesUntilMs = 0;
  let lastBlinkMs = 0;
  let dirX = 0, dirY = 0;
  let blinkVisible = true;

  function now() { return performance.now(); }

  function tryStart() {
    const t = now();
    if (t < cooldownUntilMs) return false;
    if (dashRemainingMs > 0) return false;
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

    // Input.getHeldDirection() uses "forward"/"backward", while touch
    // controls use "fwd"/"back". Accept both shapes so keyboard and touch
    // dash directions work consistently.
    if (inputDir.fwd || inputDir.forward) { dirX += fwdX; dirY += fwdY; }
    if (inputDir.back || inputDir.backward) { dirX -= fwdX; dirY -= fwdY; }
    if (inputDir.right) { dirX -= rightX; dirY -= rightY; }
    if (inputDir.left) { dirX += rightX; dirY += rightY; }
    const dlen = Math.sqrt(dirX * dirX + dirY * dirY);
    if (dlen < 0.001) return false;
    dirX /= dlen;
    dirY /= dlen;

    dashElapsedMs = 0;
    dashRemainingMs = DASH_DURATION_MS;
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

    // Advance dash duration by simulation delta, not wall-clock time.
    // Under low FPS, a wall-clock deadline can expire between frames before
    // a single movement update runs, making the dash appear to do nothing.
    if (dashRemainingMs > 0) {
      const progress = dashElapsedMs / DASH_DURATION_MS;
      const speed = DASH_SPEED * (1 - progress * 0.4);
      // Clamp delta so a single big frame doesn't yeet the player across the map.
      const stepDt = Math.min(delta, 0.05);
      const dx = dirX * speed * stepDt;
      const dy = dirY * speed * stepDt;
      if (typeof applyDisplacement === 'function') {
        applyDisplacement(dx, dy);
      } else {
        playerGroup.position.x += dx;
        playerGroup.position.y += dy;
      }
      dashElapsedMs = Math.min(DASH_DURATION_MS, dashElapsedMs + delta * 1000);
      dashRemainingMs = Math.max(0, DASH_DURATION_MS - dashElapsedMs);
    }
  }

  function setLevel(level) {
    // Duration & i-frames grow with level: base 250ms, lvl3 300ms, lvl5 350ms
    if (level >= 5) {
      DASH_DURATION_MS = 350;
      I_FRAME_DURATION_MS = 350;
    } else if (level >= 3) {
      DASH_DURATION_MS = 300;
      I_FRAME_DURATION_MS = 300;
    } else {
      DASH_DURATION_MS = 250;
      I_FRAME_DURATION_MS = 250;
    }
  }

  function isDashing() { return dashRemainingMs > 0; }
  function isInvulnerable() { return now() < iFramesUntilMs; }
  function getCooldown() {
    const left = cooldownUntilMs - now();
    return left > 0 ? left / 1000 : 0;
  }
  function getCooldownMax() { return DASH_COOLDOWN_MS / 1000; }

  function cancel() {
    dashElapsedMs = 0;
    dashRemainingMs = 0;
  }

  function reset() {
    cancel();
    cooldownUntilMs = 0;
    iFramesUntilMs = 0;
    lastBlinkMs = 0;
    blinkVisible = true;
    playerGroup.visible = true;
  }

  function setCooldown(ms) {
    DASH_COOLDOWN_MS = Math.max(500, Math.floor(ms));
  }

  return { tryStart, update, isDashing, isInvulnerable,
           getCooldown, getCooldownMax, setCooldown, setLevel, cancel, reset };
}
