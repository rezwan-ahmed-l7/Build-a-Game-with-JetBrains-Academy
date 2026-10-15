import * as THREE from 'three';
import { lerpAngle } from '../utils/math.js';

const MOVE_DISTANCE = 40;
const JUMP_HEIGHT = 28;
const JUMP_DURATION = 0.38;

const _camDir = new THREE.Vector3();
const _proposedPos = { x: 0, y: 0, z: 0 };

// Coordinate system: Z is up (camera.up = (0, 0, 1))
// Horizontal movement is on the X-Y plane; jump height is along Z.
export function createMovement(playerGroup, getModel, input, camera, canMoveCallback) {
  let isMoving = false;
  let progress = 0;
  let startPos = { x: 0, y: 0, z: 0 };
  let targetPos = { x: 0, y: 0, z: 0 };
  let targetRotation = 0;
  let currentRotation = 0;
  let startRotation = 0;

  let squashStretch = 0;
  let squashStretchSpeed = 0;
  const SQUASH_STRETCH_DECAY = 8;

  let rotationProgress = 0;
  const ROTATION_DURATION = 0.3;

  let moveDelta = { x: 0, y: 0 };

  // Returns { x, y, fwdX, fwdY, rightX, rightY, camAngle, valid }
  // - valid=false if camera forward is degenerate
  function getCameraBasis() {
    camera.getWorldDirection(_camDir);
    const len = Math.sqrt(_camDir.x * _camDir.x + _camDir.y * _camDir.y);
    if (len < 0.001) {
      return { valid: false };
    }
    const fwdX = _camDir.x / len;
    const fwdY = _camDir.y / len;
    const rightX = -fwdY;
    const rightY = fwdX;
    const camAngle = Math.atan2(_camDir.x, _camDir.y);
    return { valid: true, fwdX, fwdY, rightX, rightY, camAngle };
  }

  function getDeltaForDirection(direction, basis) {
    if (!basis.valid) {
      return direction === 'backward'
        ? { x: MOVE_DISTANCE, y: 0 }
        : { x: -MOVE_DISTANCE, y: 0 };
    }
    const { fwdX, fwdY, rightX, rightY } = basis;
    switch (direction) {
      case 'forward':  return { x: fwdX * MOVE_DISTANCE, y: fwdY * MOVE_DISTANCE };
      case 'backward': return { x: -fwdX * MOVE_DISTANCE, y: -fwdY * MOVE_DISTANCE };
      case 'left':     return { x: rightX * MOVE_DISTANCE, y: rightY * MOVE_DISTANCE };
      case 'right':    return { x: -rightX * MOVE_DISTANCE, y: -rightY * MOVE_DISTANCE };
      default:         return { x: 0, y: 0 };
    }
  }

  function getRotationForDirection(direction, basis) {
    if (!basis.valid) return 0;
    const { camAngle } = basis;
    switch (direction) {
      // face away from camera (up on screen) — show back
      case 'forward':  return camAngle - Math.PI / 2;
      // face toward camera (down on screen) — show face
      case 'backward': return camAngle + Math.PI / 2;
      case 'left':     return camAngle;
      case 'right':    return camAngle + Math.PI;
    }
    return 0;
  }

  function tryStartNextMove() {
    if (input.isEmpty()) return;
    const next = input.peek();

    const basis = getCameraBasis();
    const dirInfo = getDeltaForDirection(next, basis);

    _proposedPos.x = playerGroup.position.x + dirInfo.x;
    _proposedPos.y = playerGroup.position.y + dirInfo.y;
    _proposedPos.z = 0;

    // Block the move if it would land on top of an enemy; drop the bad input
    // so the player can press a different direction immediately.
    if (canMoveCallback && !canMoveCallback(_proposedPos)) {
      input.dequeue();
      return;
    }

    input.dequeue();
    startMove(next, basis, dirInfo);
  }

  function startMove(direction, basis, dirInfo) {
    progress = 0;
    isMoving = true;
    startPos.x = playerGroup.position.x;
    startPos.y = playerGroup.position.y;
    startPos.z = playerGroup.position.z;
    startRotation = currentRotation;

    if (!basis) basis = getCameraBasis();
    if (!dirInfo) dirInfo = getDeltaForDirection(direction, basis);

    moveDelta.x = dirInfo.x;
    moveDelta.y = dirInfo.y;

    targetPos.x = startPos.x + moveDelta.x;
    targetPos.y = startPos.y + moveDelta.y;
    targetPos.z = 0;

    targetRotation = getRotationForDirection(direction, basis);
    rotationProgress = 0;
    const model = getModel();
    if (model) model.rotation.z = 0;

    squashStretch = 0.15;
    squashStretchSpeed = 1;
  }

  function update(delta) {
    const model = getModel();

    if (!isMoving) {
      tryStartNextMove();

      if (Math.abs(squashStretch) > 0.001) {
        squashStretchSpeed -= SQUASH_STRETCH_DECAY * delta * squashStretch;
        squashStretch += squashStretchSpeed * delta;
      } else {
        squashStretch = 0;
        squashStretchSpeed = 0;
      }

      if (model) model.rotation.x = Math.PI / 2;
      return;
    }

    progress += delta / JUMP_DURATION;

    if (progress >= 1) {
      progress = 1;
      playerGroup.position.x = targetPos.x;
      playerGroup.position.y = targetPos.y;
      playerGroup.position.z = 0;

      currentRotation = targetRotation;
      rotationProgress = 1;
      if (model) {
        if (model.parent) model.parent.rotation.z = currentRotation;
        model.rotation.x = Math.PI / 2;
      }

      squashStretch = -0.12;
      squashStretchSpeed = -0.5;

      isMoving = false;
      tryStartNextMove();
      return;
    }

    const easedProgress = easeInOutCubic(progress);
    playerGroup.position.x = startPos.x + moveDelta.x * easedProgress;
    playerGroup.position.y = startPos.y + moveDelta.y * easedProgress;
    playerGroup.position.z = Math.sin(progress * Math.PI) * JUMP_HEIGHT;

    if (progress < 0.2) {
      squashStretch = 0.15 * (1 - progress / 0.2);
    } else if (progress > 0.8) {
      squashStretch = -0.1 * ((progress - 0.8) / 0.2);
    } else {
      squashStretch = 0;
    }

    rotationProgress += delta / ROTATION_DURATION;
    const rotT = Math.min(rotationProgress, 1);
    const rotEased = easeInOutQuart(rotT);
    let rotFactor = rotEased;
    if (rotT > 0.85) {
      const overshootT = (rotT - 0.85) / 0.15;
      rotFactor = 1 + Math.sin(overshootT * Math.PI) * 0.08;
    }

    currentRotation = lerpAngle(startRotation, targetRotation, rotFactor);
    if (model) {
      if (model.parent) model.parent.rotation.z = currentRotation;

      let tiltAngle = 0;
      if (progress < 0.25) {
        tiltAngle = 0.2 * easeOutQuad(progress / 0.25);
      } else if (progress > 0.75) {
        tiltAngle = -0.1 * easeInQuad((progress - 0.75) / 0.25);
      }
      model.rotation.x = Math.PI / 2 + tiltAngle;
    }
  }

  function applySquashStretch() {
    const model = getModel();
    if (!model) return;

    const amount = Math.abs(squashStretch) < 0.001 ? 0 : squashStretch;
    const scaleZ = 1 + amount;
    const scaleXY = 1 - amount * 0.5;
    model.scale.x = 20 * scaleXY;
    model.scale.y = 20 * scaleXY;
    model.scale.z = 20 * scaleZ;
  }

  function reset() {
    isMoving = false;
    progress = 0;
    startPos = { x: playerGroup.position.x, y: playerGroup.position.y, z: 0 };
    targetPos = { x: startPos.x, y: startPos.y, z: 0 };
    targetRotation = 0;
    currentRotation = 0;
    startRotation = 0;
    moveDelta = { x: 0, y: 0 };
    rotationProgress = 0;
    squashStretch = 0;
    squashStretchSpeed = 0;

    const model = getModel();
    if (model) {
      model.rotation.set(Math.PI / 2, 0, 0);
      model.scale.setScalar(20);
      if (model.parent) model.parent.rotation.set(0, 0, 0);
    }
  }

  function isCurrentlyMoving() {
    return isMoving;
  }

  return {
    update,
    applySquashStretch,
    isCurrentlyMoving,
    reset
  };
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeInOutQuart(t) {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function easeInQuad(t) {
  return t * t;
}
