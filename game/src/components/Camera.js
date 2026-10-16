import * as THREE from 'three';

export function createCamera() {
  // Wider FOV (was 32) so the sky takes up a meaningful portion of the
  // screen and the sun/moon are visible as they rise and set. A narrower
  // FOV here pushes everything off-screen above the horizon line.
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 9000);

  camera.position.set(290, -310, 290);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 0, 0);

  return camera;
}
