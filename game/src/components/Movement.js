import * as THREE from 'three';
import { lerpAngle } from '../utils/math.js';
import { easeInOutCubic, easeInOutQuart, easeOutQuad, easeInQuad } from '../utils/easings.js';
import { PLAYABLE_RADIUS } from './WorldBounds.js';

const MOVE_DISTANCE = 40;
const JUMP_HEIGHT = 28;
const JUMP_DURATION = 0.38;

const _camDir = new THREE.Vector3();
const _proposedPos = { x: 0, y: 0, z: 0 };

function clampToPlayableRadius(x, y) {
  const distance = Math.hypot(x, y);
  if (distance <= PLAYABLE_RADIUS || distance === 0) return { x, y };
  const scale = PLAYABLE_RADIUS / distance;
  return { x: x * scale, y: y * scale };
}

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
  let speedMultiplier = 1;

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
    // The tode model has its visual "front" (eyes) facing +X in world at
    // facingGroup.rotation.z = 0. With CCW rotation around Z (three.js Z-up,
    // right-hand rule), rot.z = theta sends the front to (cos theta,
    // sin theta).
    //
    // Camera forward (XY) = (fwdX, fwdY). The angle of that direction CCW
    // from +X is atan2(fwdY, fwdX) = pi/2 - camAngle. So the rotations below
    // express each desired facing direction as an angle CCW from +X.
    //
    //   forward  -> face away from camera = camera forward
    //   backward -> face toward camera
    //   left     -> face camera-left (strafing left = facing the screen-left
    //               side; this is camera-forward rotated +90 deg CCW)
    //   right    -> face camera-right (camera-forward rotated -90 deg CCW)
    switch (direction) {
      case 'forward':  return Math.PI / 2 - camAngle;
      case 'backward': return Math.PI / 2 - camAngle + Math.PI;
      case 'left':     return Math.PI - camAngle;
      case 'right':    return -camAngle;
    }
    return 0;
  }

  function tryStartNextMove() {
    if (input.isEmpty()) return;
    const next = input.peek();
    const basis = getCameraBasis();

    let direction = next;
    let dirInfo;
    if (next && typeof next === 'object' && next.click) {
      // Click-to-move: use the raw click offset scaled by MOVE_DISTANCE.
      // The offset is in [-1, 1] range (normalized screen coords), so
      // clicking near the center moves a short distance, clicking near
      // the edge moves the full MOVE_DISTANCE.
      dirInfo = {
        x: next.click.x * MOVE_DISTANCE,
        y: next.click.y * MOVE_DISTANCE
      };
      // Pick the best "directional" hint for facing the click target.
      // Use the angle of the click vector.
      const ang = Math.atan2(next.click.y, next.click.x);
      // Map to nearest of forward/back/left/right relative to camera.
      if (basis.valid) {
        // fwd is camera-forward projected on XY. We want the camera-space
        // angle of the click to determine the visual facing direction.
        // Compute click in camera space:
        const camFwdX = basis.fwdX, camFwdY = basis.fwdY;
        const camRightX = basis.rightX, camRightY = basis.rightY;
        const fwdDot = next.click.x * camFwdX + next.click.y * camFwdY;
        const rightDot = next.click.x * camRightX + next.click.y * camRightY;
        if (Math.abs(fwdDot) >= Math.abs(rightDot)) {
          direction = fwdDot >= 0 ? 'forward' : 'backward';
        } else {
          direction = rightDot >= 0 ? 'right' : 'left';
        }
        // unused: ang
        void ang;
      } else {
        direction = 'forward';
      }
    } else {
      dirInfo = getDeltaForDirection(next, basis);
    }

    _proposedPos.x = playerGroup.position.x + dirInfo.x;
    _proposedPos.y = playerGroup.position.y + dirInfo.y;
    _proposedPos.z = 0;

    // Hard gameplay boundary: never let a normal move cross into the outer
    // decorative margin where enemies/points could be farmed outside the arena.
    if (Math.hypot(_proposedPos.x, _proposedPos.y) > PLAYABLE_RADIUS) {
      input.dequeue();
      return;
    }

    // Block the move if it would land on top of an enemy; drop the bad input
    // so the player can press a different direction immediately.
    if (canMoveCallback && !canMoveCallback(_proposedPos)) {
      input.dequeue();
      return;
    }

    input.dequeue();
    startMove(direction, basis, dirInfo);
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

    progress += (delta * speedMultiplier) / JUMP_DURATION;

    if (progress >= 1) {
      progress = 1;
      const boundedTarget = clampToPlayableRadius(targetPos.x, targetPos.y);
      playerGroup.position.x = boundedTarget.x;
      playerGroup.position.y = boundedTarget.y;
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
    const interpolatedPos = clampToPlayableRadius(
      startPos.x + moveDelta.x * easedProgress,
      startPos.y + moveDelta.y * easedProgress
    );
    playerGroup.position.x = interpolatedPos.x;
    playerGroup.position.y = interpolatedPos.y;
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

  // Translate both the visible player and any active movement path.
  // Without shifting startPos/targetPos, the next movement frame overwrites
  // dash displacement and makes the dash appear to do nothing.
  function translate(dx, dy) {
    // Dash uses this path too, so clamp its displacement to the same arena.
    const nextX = playerGroup.position.x + dx;
    const nextY = playerGroup.position.y + dy;
    const distance = Math.hypot(nextX, nextY);
    const scale = distance > PLAYABLE_RADIUS ? PLAYABLE_RADIUS / distance : 1;
    const actualDx = nextX * scale - playerGroup.position.x;
    const actualDy = nextY * scale - playerGroup.position.y;
    playerGroup.position.x += actualDx;
    playerGroup.position.y += actualDy;
    startPos.x += actualDx;
    startPos.y += actualDy;
    targetPos.x += actualDx;
    targetPos.y += actualDy;
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

  function setSpeedMultiplier(value) {
    speedMultiplier = Number.isFinite(value) ? Math.max(0.5, Math.min(value, 2.5)) : 1;
  }

  function getSpeedMultiplier() {
    return speedMultiplier;
  }

  function isCurrentlyMoving() {
    return isMoving;
  }

  return {
    update,
    applySquashStretch,
    isCurrentlyMoving,
    setSpeedMultiplier,
    getSpeedMultiplier,
    reset,
    translate,
    getCameraBasis
  };
}
