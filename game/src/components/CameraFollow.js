import * as THREE from 'three';

const _targetPos = new THREE.Vector3();

// Default camera setup: a classic 3rd-person action-adventure view.
// - Elevation ~0.55 rad (~31°) — high enough to see the field ahead,
//   low enough that the player, ground and horizon all read at a glance.
// - Distance 500 — wide enough to see what's coming, close enough that
//   the frog feels present in the scene, not a speck.
// - Azimuth 4.0 rad ≈ 229° — camera behind/left of the player so the
//   frog is in the lower-left third of the screen and you can see far
//   ahead of it.
const BASE_DISTANCE = 185;
const MIN_DISTANCE = 135;
const MAX_DISTANCE = 400;
const BASE_ELEVATION = 0.36;   // ~25 deg: a readable action-adventure view
const MIN_ELEVATION = 0.16;    // ~10 deg — low cinematic angle
const MAX_ELEVATION = 0.78;    // ~49 deg — tactical overview

const AZIMUTH_SENSITIVITY = 0.012;   // a bit higher so trackpad micro-moves count
const PITCH_SENSITIVITY   = 0.010;
const KEY_ROT_SPEED = 1.8;            // radians/sec
const SMOOTH_SPEED = 10;
const ZOOM_SENSITIVITY = 0.0015;
const DRAG_THRESHOLD_PX = 4;          // ignore sub-pixel jitter

export function createCameraFollow(camera, playerGroup, canvas) {
  const state = {
    azimuth: 4.0,
    elevation: BASE_ELEVATION,
    distance: BASE_DISTANCE,
    targetAzimuth: 4.0,
    targetElevation: BASE_ELEVATION,
    targetDistance: BASE_DISTANCE
  };

  let dragging = false;
  let pendingPointer = null;
  let activePointerId = null;
  let lastX = 0;
  let lastY = 0;

  const keyRot = { left: false, right: false, up: false, down: false };

  function beginDrag(e) {
    // Only primary button / primary touch / pen
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pendingPointer = e;
    activePointerId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function endDrag(e) {
    if (activePointerId == null) return;
    if (e && e.pointerId !== activePointerId) return;
    pendingPointer = null;
    dragging = false;
    activePointerId = null;
  }

  // Use WINDOW-level move/up so drag continues even when the cursor
  // leaves the canvas (the canvas has small target — this prevents the
  // "drag stops mid-air" problem on touchpads).
  function onPointerDown(e) {
    // Skip if the click was on a UI overlay (menu/HUD). Only start drag
    // when the click is over the canvas itself.
    if (canvas && e.target !== canvas) return;
    beginDrag(e);
  }
  function onPointerMove(e) {
    if (activePointerId == null) return;
    if (e.pointerId !== activePointerId) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (!dragging) {
      // Wait until the user moves at least DRAG_THRESHOLD_PX before
      // treating the gesture as a drag (otherwise it counts as a click).
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD_PX) return;
      dragging = true;
      // Capture the pointer so we keep getting events even if the
      // touchpad cursor leaves the canvas region.
      try {
        if (pendingPointer) (canvas || window).setPointerCapture(pendingPointer.pointerId);
      } catch {}
    }
    // Subtract so the world rotates the direction the user drags.
    state.targetAzimuth -= dx * AZIMUTH_SENSITIVITY;
    state.targetElevation -= dy * PITCH_SENSITIVITY;
    if (state.targetElevation < MIN_ELEVATION) state.targetElevation = MIN_ELEVATION;
    if (state.targetElevation > MAX_ELEVATION) state.targetElevation = MAX_ELEVATION;
  }
  function onPointerUp(e) { endDrag(e); }

  function onWheel(e) {
    state.targetDistance += e.deltaY * ZOOM_SENSITIVITY * state.targetDistance;
    if (state.targetDistance < MIN_DISTANCE) state.targetDistance = MIN_DISTANCE;
    if (state.targetDistance > MAX_DISTANCE) state.targetDistance = MAX_DISTANCE;
  }

  function onKeyDown(e) {
    if (e.repeat) return;
    if (e.code === 'KeyQ') keyRot.left = true;
    else if (e.code === 'KeyE') keyRot.right = true;
    else if (e.code === 'KeyR') keyRot.up = true;
    else if (e.code === 'KeyF') keyRot.down = true;
  }
  function onKeyUp(e) {
    if (e.code === 'KeyQ') keyRot.left = false;
    else if (e.code === 'KeyE') keyRot.right = false;
    else if (e.code === 'KeyR') keyRot.up = false;
    else if (e.code === 'KeyF') keyRot.down = false;
  }

  // Bind pointerdown/move/up/wheel to WINDOW — this is the key fix.
  // Canvas-level listeners are flaky because the cursor leaves the
  // canvas area easily. Window-level ensures the drag works no matter
  // where the cursor is on the page.
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  if (canvas) {
    canvas.style.touchAction = 'none';
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function update(delta) {
    // Keyboard rotation (Q/E azimuth, R/F pitch).
    if (keyRot.left)  state.targetAzimuth   -= KEY_ROT_SPEED * delta;
    if (keyRot.right) state.targetAzimuth   += KEY_ROT_SPEED * delta;
    if (keyRot.up)    state.targetElevation += KEY_ROT_SPEED * 0.7 * delta;
    if (keyRot.down)  state.targetElevation -= KEY_ROT_SPEED * 0.7 * delta;
    if (state.targetElevation < MIN_ELEVATION) state.targetElevation = MIN_ELEVATION;
    if (state.targetElevation > MAX_ELEVATION) state.targetElevation = MAX_ELEVATION;

    // Smooth toward target spherical coords.
    const t = Math.min(SMOOTH_SPEED * delta, 1);
    state.azimuth  += (state.targetAzimuth  - state.azimuth)  * t;
    state.elevation += (state.targetElevation - state.elevation) * t;
    state.distance += (state.targetDistance - state.distance) * t;

    const currentPos = playerGroup.position;
    const cosE = Math.cos(state.elevation);
    const sinE = Math.sin(state.elevation);

    _targetPos.set(
      currentPos.x + Math.cos(state.azimuth) * cosE * state.distance,
      currentPos.y + Math.sin(state.azimuth) * cosE * state.distance,
      currentPos.z + sinE * state.distance
    );

    camera.position.lerp(_targetPos, t);
    camera.up.set(0, 0, 1);
    // Aim slightly below the frog so it sits higher in frame and less empty foreground dominates.
    camera.lookAt(currentPos.x, currentPos.y, currentPos.z - 22);
  }

  return { update };
}
