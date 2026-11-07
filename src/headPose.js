import * as THREE from 'three';

// Where the listener's head is and which way it faces. In a headset session the scene camera's
// own pose can be wrong (it is a two-eye camera), so the pose is read from the eyes;
// otherwise the camera itself is the head. Everything that depends on where the viewer is (the
// sound's listener, what the white graph hides in front of a region) reads it from here.
const scratch = { scale: new THREE.Vector3(), other: new THREE.Vector3(), quaternion: new THREE.Quaternion() };

export function readHeadPose(state, out) {
  const eyes = state.gl.xr.isPresenting ? state.gl.xr.getCamera().cameras : null;
  if (eyes && eyes.length > 0) {
    eyes[0].matrixWorld.decompose(out.position, out.quaternion, scratch.scale);
    if (eyes[1]) {
      eyes[1].matrixWorld.decompose(scratch.other, scratch.quaternion, scratch.scale);
      out.position.add(scratch.other).multiplyScalar(0.5);
    }
  } else {
    out.position.copy(state.camera.position);
    out.quaternion.copy(state.camera.quaternion);
  }
  return out;
}
