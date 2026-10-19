import * as THREE from 'three';

const _targetPos = new THREE.Vector3();
const _lookAtTarget = new THREE.Vector3();
const _lookAtPos = new THREE.Vector3();

// Default camera setup: a classic 3rd-person action-adventure view.
// Keep the player prominent while leaving enough room to read nearby threats.
const BASE_DISTANCE = 158; // Slightly wider default view, especially helpful on phones.
const MIN_DISTANCE = 108;
const MAX_DISTANCE = 320;
const BASE_ELEVATION = 0.43;   // ~21 deg above the ground plane
const MIN_ELEVATION = 0.16;    // low cinematic angle
const MAX_ELEVATION = 0.78;    // tactical overview

const AZIMUTH_SENSITIVITY = 0.012;
const PITCH_SENSITIVITY   = 0.010;
const KEY_ROT_SPEED = 1.8;
const SMOOTH_SPEED = 10;
const ZOOM_SENSITIVITY = 0.0015;
const DRAG_THRESHOLD_PX = 4;

export function createCameraFollow(camera, playerGroup, canvas) {
  // Keep camera height anchored to the player's ground level, not jump height.
  const groundZ = playerGroup.position.z;
  // Smooth the look target as well as the camera position. Snapping lookAt
  // directly to the frog each frame while the camera position is damped can
  // create visible angular jolts during jumps and rapid tile movement.
  _lookAtPos.set(playerGroup.position.x, playerGroup.position.y, groundZ + 18);
  const state = {
    azimuth: 5.45,
    elevation: BASE_ELEVATION,
    distance: BASE_DISTANCE,
    targetAzimuth: 5.45,
    targetElevation: BASE_ELEVATION,
    targetDistance: BASE_DISTANCE
  };

  let dragging = false;
  let pendingPointer = null;
  let activePointerId = null;
  // Track touch pointers separately so two-finger pinch can zoom without
  // interfering with one-finger camera orbit or the virtual game controls.
  const touchPoints = new Map();
  let lastPinchDistance = null;
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

  function clampDistance(value) {
    state.targetDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, value));
  }

  function getPinchDistance() {
    if (touchPoints.size < 2) return null;
    const points = [...touchPoints.values()];
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  function onPointerDown(e) {
    // Only begin camera gestures on the game canvas. Touches on the
    // joystick, DASH/ATK buttons, and menus must remain dedicated to those controls.
    if (canvas && e.target !== canvas) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    if (e.pointerType === 'touch') {
      touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPoints.size >= 2) {
        // Two fingers mean zoom, not orbit. Stop any in-progress one-finger drag.
        activePointerId = null;
        pendingPointer = null;
        dragging = false;
        lastPinchDistance = getPinchDistance();
      } else {
        beginDrag(e);
      }
    } else {
      beginDrag(e);
    }

    // Capture touch gestures on the canvas so they continue at its edges.
    if (e.pointerType === 'touch' && canvas?.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    }
  }
  function onPointerMove(e) {
    if (e.pointerType === 'touch' && touchPoints.has(e.pointerId)) {
      touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPoints.size >= 2) {
        const nextDistance = getPinchDistance();
        if (nextDistance != null && lastPinchDistance != null) {
          // Spreading fingers zooms in; bringing them together zooms out.
          clampDistance(state.targetDistance - (nextDistance - lastPinchDistance) * 0.65);
        }
        lastPinchDistance = nextDistance;
        return;
      }
    }
    if (activePointerId == null || e.pointerId !== activePointerId) return;
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
  function onPointerUp(e) {
    if (e?.pointerType === 'touch') {
      touchPoints.delete(e.pointerId);
      if (touchPoints.size < 2) lastPinchDistance = null;
      if (touchPoints.size === 1) {
        // Do not unexpectedly turn the end of a pinch into an orbit gesture.
        activePointerId = null;
        pendingPointer = null;
        dragging = false;
      }
    }
    endDrag(e);
  }

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
      groundZ + sinE * state.distance
    );

    camera.position.lerp(_targetPos, t);
    camera.up.set(0, 0, 1);
    // Damp the look target with the same factor as the camera position.
    // This prevents abrupt view-angle changes when the frog hops or changes tile.
    _lookAtTarget.set(currentPos.x, currentPos.y, groundZ + 18);
    _lookAtPos.lerp(_lookAtTarget, t);
    camera.lookAt(_lookAtPos);
  }

  return { update };
}
