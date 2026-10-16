import * as THREE from 'three';

const _targetPos = new THREE.Vector3();

// Default camera setup: a classic 3rd-person action-adventure view.
// Keep the player prominent while leaving enough room to read nearby threats.
const BASE_DISTANCE = 165;
const MIN_DISTANCE = 125;
const MAX_DISTANCE = 360;
const BASE_ELEVATION = 0.36;   // ~21 deg above the ground plane
const MIN_ELEVATION = 0.16;    // low cinematic angle
const MAX_ELEVATION = 0.78;    // tactical overview

const AZIMUTH_SENSITIVITY = 0.012;
const PITCH_SENSITIVITY   = 0.010;
const KEY_ROT_SPEED = 1.8;
const SMOOTH_SPEED = 10;
const ZOOM_SENSITIVITY = 0.0015;
const DRAG_THRESHOLD_PX = 4;

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

  function onPointerDown(e) {
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
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD_PX) return;
      dragging = true;
      try {
        if (pendingPointer) (canvas || window).setPointerCapture(pendingPointer.pointerId);
      } catch {}
    }
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
    if (keyRot.left)  state.targetAzimuth   -= KEY_ROT_SPEED * delta;
    if (keyRot.right) state.targetAzimuth   += KEY_ROT_SPEED * delta;
    if (keyRot.up)    state.targetElevation += KEY_ROT_SPEED * 0.7 * delta;
    if (keyRot.down)  state.targetElevation -= KEY_ROT_SPEED * 0.7 * delta;
    if (state.targetElevation < MIN_ELEVATION) state.targetElevation = MIN_ELEVATION;
    if (state.targetElevation > MAX_ELEVATION) state.targetElevation = MAX_ELEVATION;

    const t = Math.min(SMOOTH_SPEED * delta, 1);
    state.azimuth  += (state.targetAzimuth  - state.azimuth)  * t;
    state.elevation += (state.targetElevation - state.elevation) * t;
    state.distance += (state.targetDistance - state.distance) * t;

    // Keep the camera in world space so player rotation does not rotate the camera rig.
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
    // Look slightly below the player so the frog sits above center.
    camera.lookAt(currentPos.x, currentPos.y, currentPos.z + 18);
  }

  return { update };
}
