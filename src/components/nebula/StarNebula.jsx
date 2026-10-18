import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildNebula, linkAttributes, nodeAttributes } from './nebulaGeometry';
import { PLACEMENT_GLSL } from './nebulaPlacement';
import { registerNebula, unregisterNebula } from './nebulaRegistry';

// How fast the cluster follows `shape`, how much it wriggles, how bright the links are.
const SHAPE_EASE_PER_SECOND = 5;
const WOBBLE_FREE = 0.12;
const WOBBLE_IN_SHAPE = 0.016;
const LINK_OPACITY = 0.24;

// Both shaders place a node the same way, so a link always meets its two nodes.
const PLACEMENT = PLACEMENT_GLSL;

const NODE_VERTEX = /* glsl */ `
  ${PLACEMENT}
  attribute vec3 aCloud;
  attribute vec3 aShape;
  attribute float aSeed;
  attribute float aSize;
  attribute vec3 aColor;
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vec3 center = place(aCloud, aShape, aSeed);
    float twinkle = 0.8 + 0.2 * sin(uTime * 2.0 + aSeed * 40.0);
    float size = aSize * twinkle * (1.0 + uPulse * 0.9);
    vec4 viewPosition = modelViewMatrix * vec4(center, 1.0);
    viewPosition.xy += position.xy * size;
    gl_Position = projectionMatrix * viewPosition;
    vUv = position.xy + 0.5;
    vColor = aColor * (1.0 + uPulse * 0.8);
  }
`;

const NODE_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float glow = pow(clamp(1.0 - d, 0.0, 1.0), 1.6);
    float core = smoothstep(0.35, 0.0, d);
    gl_FragColor = vec4(vColor * (0.7 + core * 0.9), glow);
  }
`;

const LINK_VERTEX = /* glsl */ `
  ${PLACEMENT}
  attribute vec3 aCloud;
  attribute vec3 aShape;
  attribute float aSeed;
  attribute vec3 aColor;
  attribute float aSet;
  uniform float uLinkOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 center = place(aCloud, aShape, aSeed);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(center, 1.0);
    vColor = aColor;
    // Cloud links fade out as the shape forms, outline links fade in.
    vAlpha = mix(1.0 - uShape, uShape, aSet) * uLinkOpacity * (1.0 + uPulse * 1.6);
  }
`;

const LINK_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

const WORLD_UP = new THREE.Vector3(0, 1, 0);

const baseUniforms = () => ({
  uTime: { value: 0 },
  uShape: { value: 0 },
  uWobble: { value: WOBBLE_FREE },
  uPulse: { value: 0 },
  uPullDir: { value: new THREE.Vector3(1, 0, 0) },
  uPull: { value: 0 },
});

// An Obsidian-graph style star: nodes joined by thin lines, always wriggling, that
// gather into the instrument's outline as `shapeTarget` goes from 0 to 1.
export function StarNebula({ instrument, seedKey, color, shapeTarget, volumeRef }) {
  const groupRef = useRef();
  const shapeRef = useRef(0);
  const targetRef = useRef(shapeTarget);

  useEffect(() => {
    targetRef.current = shapeTarget;
  }, [shapeTarget]);

  const { layout, nodeGeometry, nodeMaterial, linkGeometry, linkMaterial } = useMemo(() => {
    const layout = buildNebula({ instrument, seedKey, color });

    const quad = new THREE.PlaneGeometry(1, 1);
    const nodeGeometry = new THREE.InstancedBufferGeometry();
    nodeGeometry.index = quad.index;
    nodeGeometry.setAttribute('position', quad.getAttribute('position'));
    const nodes = nodeAttributes(layout);
    nodeGeometry.setAttribute('aCloud', new THREE.InstancedBufferAttribute(nodes.aCloud, 3));
    nodeGeometry.setAttribute('aShape', new THREE.InstancedBufferAttribute(nodes.aShape, 3));
    nodeGeometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(nodes.aSeed, 1));
    nodeGeometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(nodes.aSize, 1));
    nodeGeometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(nodes.aColor, 3));
    nodeGeometry.instanceCount = layout.nodes.length;

    const nodeMaterial = new THREE.ShaderMaterial({
      uniforms: baseUniforms(),
      vertexShader: NODE_VERTEX,
      fragmentShader: NODE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const links = linkAttributes(layout);
    const linkGeometry = new THREE.BufferGeometry();
    linkGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(links.count * 3), 3));
    linkGeometry.setAttribute('aCloud', new THREE.BufferAttribute(links.aCloud, 3));
    linkGeometry.setAttribute('aShape', new THREE.BufferAttribute(links.aShape, 3));
    linkGeometry.setAttribute('aSeed', new THREE.BufferAttribute(links.aSeed, 1));
    linkGeometry.setAttribute('aColor', new THREE.BufferAttribute(links.aColor, 3));
    linkGeometry.setAttribute('aSet', new THREE.BufferAttribute(links.aSet, 1));

    const linkMaterial = new THREE.ShaderMaterial({
      uniforms: { ...baseUniforms(), uLinkOpacity: { value: LINK_OPACITY } },
      vertexShader: LINK_VERTEX,
      fragmentShader: LINK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    quad.dispose();
    return { layout, nodeGeometry, nodeMaterial, linkGeometry, linkMaterial };
  }, [instrument, seedKey, color]);

  // Shared with the bridges between neighbouring stars: the star's live state, and the
  // direction/strength of the neighbour it is reaching toward (set from outside).
  const stateRef = useRef({ time: 0, shape: 0, wobble: WOBBLE_FREE, pulse: 0, pullDir: new THREE.Vector3(1, 0, 0), pull: 0 });
  const pullInputRef = useRef({ dir: new THREE.Vector3(1, 0, 0), amount: 0 });
  const inverseRotation = useRef(new THREE.Quaternion());
  const starPosition = useRef(new THREE.Vector3());
  const facingMatrix = useRef(new THREE.Matrix4());

  useEffect(() => {
    registerNebula(seedKey, { layout, group: groupRef, state: stateRef.current, pullInput: pullInputRef.current, color });
    return () => unregisterNebula(seedKey);
  }, [seedKey, layout, color]);

  useEffect(() => () => {
    nodeGeometry.dispose();
    nodeMaterial.dispose();
    linkGeometry.dispose();
    linkMaterial.dispose();
  }, [nodeGeometry, nodeMaterial, linkGeometry, linkMaterial]);

  useFrame((state, delta) => {
    // Face the viewer, so the instrument outline always reads front-on. This turns the star
    // toward the camera's *position*: inside a headset session the camera's own orientation
    // is not reliable (it is a special two-eye camera), but its position is.
    if (groupRef.current) {
      groupRef.current.getWorldPosition(starPosition.current);
      facingMatrix.current.lookAt(state.camera.position, starPosition.current, WORLD_UP);
      groupRef.current.quaternion.setFromRotationMatrix(facingMatrix.current);
    }

    shapeRef.current += (targetRef.current - shapeRef.current) * (1 - Math.exp(-delta * SHAPE_EASE_PER_SECOND));
    const wobble = THREE.MathUtils.lerp(WOBBLE_FREE, WOBBLE_IN_SHAPE, shapeRef.current);
    const pulse = volumeRef?.current ?? 0;

    // The neighbour's direction arrives in world space; the nodes live in this star's
    // own (viewer-facing) space.
    const shared = stateRef.current;
    if (groupRef.current) {
      inverseRotation.current.copy(groupRef.current.quaternion).invert();
      shared.pullDir.copy(pullInputRef.current.dir).applyQuaternion(inverseRotation.current).normalize();
    }
    shared.pull += (pullInputRef.current.amount - shared.pull) * (1 - Math.exp(-delta * 4));
    shared.time = state.clock.elapsedTime;
    shared.shape = shapeRef.current;
    shared.wobble = wobble;
    shared.pulse = pulse;

    [nodeMaterial, linkMaterial].forEach((material) => {
      material.uniforms.uTime.value = shared.time;
      material.uniforms.uShape.value = shared.shape;
      material.uniforms.uWobble.value = wobble;
      material.uniforms.uPulse.value = pulse;
      material.uniforms.uPullDir.value.copy(shared.pullDir);
      material.uniforms.uPull.value = shared.pull;
    });
  });

  // Not raycast: the star's own hit-test sphere handles pointing and grabbing.
  return (
    <group ref={groupRef}>
      <mesh geometry={nodeGeometry} material={nodeMaterial} frustumCulled={false} raycast={() => null} renderOrder={6} />
      <lineSegments geometry={linkGeometry} material={linkMaterial} frustumCulled={false} raycast={() => null} renderOrder={5} />
    </group>
  );
}
