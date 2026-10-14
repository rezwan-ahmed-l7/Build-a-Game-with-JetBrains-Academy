import * as THREE from 'three';

const _targetPos = new THREE.Vector3();

export function createCameraFollow(camera, playerGroup) {
  const offset = new THREE.Vector3(290, -310, 290);
  const smoothSpeed = 5;

  function update(delta) {
    const currentPos = playerGroup.position;

    _targetPos.set(
      currentPos.x + offset.x,
      currentPos.y + offset.y,
      offset.z
    );

    camera.position.lerp(_targetPos, Math.min(smoothSpeed * delta, 1));
    camera.up.set(0, 0, 1);
    camera.lookAt(currentPos);
  }

  return { update };
}
