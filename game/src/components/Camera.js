import * as THREE from 'three';

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 1, 9000);
  
  camera.position.set(290, -310, 290);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 0, 0);

  return camera;
}
