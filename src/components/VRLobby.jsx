import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SONG_STEMS, EXHIBITION_SONG } from '../audio/songStems';
import { LOBBY } from './graph/graphConstants';

// The first thing a headset visitor sees: the logo and an enter button in front, and sound nodes
// all around them. Swish the nodes with a controller and they drift away and slowly come back; where
// they are decides how much of the one song comes from the left and how much from the right.

const seededRandom = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function makeNodes() {
  const random = seededRandom(20240607);
  const count = LOBBY.NODE_COUNT;
  const home = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const left = new THREE.Color(LOBBY.LEFT_COLOR);
  const right = new THREE.Color(LOBBY.RIGHT_COLOR);
  const coneCos = Math.cos((LOBBY.CLEAR_CONE_DEGREES * Math.PI) / 180);
  let made = 0;
  let guard = 0;
  while (made < count && guard < count * 60) {
    guard += 1;
    const gauss = () => random() + random() + random() - 1.5;
    const direction = new THREE.Vector3(gauss(), gauss() * 0.7, gauss()).normalize();
    const radius = LOBBY.NEAREST + (LOBBY.FARTHEST - LOBBY.NEAREST) * random() ** 0.7;
    const x = direction.x * radius;
    const y = 1.6 + direction.y * radius;
    const z = direction.z * radius;
    if (y < LOBBY.HEIGHT[0] || y > LOBBY.HEIGHT[1]) continue;
    // Keep the front clear for the logo and the button.
    const horizontal = Math.hypot(x, z) || 1;
    if (-z / horizontal > coneCos && horizontal < LOBBY.CLEAR_DISTANCE) continue;
    home.set([x, y, z], made * 3);
    const tint = x < 0 ? left : right;
    color.set([tint.r, tint.g, tint.b], made * 3);
    size[made] = LOBBY.NODE_SIZE[0] + (LOBBY.NODE_SIZE[1] - LOBBY.NODE_SIZE[0]) * random();
    made += 1;
  }
  return { count: made, home, color, size };
}

const NODE_VERTEX = /* glsl */ `
  attribute vec3 aPos;
  attribute vec3 aColor;
  attribute float aSize;
  varying vec3 vColor;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vec4 view = modelViewMatrix * vec4(aPos, 1.0);
    float dist = length(view.xyz);
    float near = 1.0 - smoothstep(2.0, 8.0, dist);
    float size = aSize * mix(0.7, 1.3, near);
    view.xy += position.xy * size * 5.0;
    gl_Position = projectionMatrix * view;
    vUv = position.xy + 0.5;
    vColor = aColor;
    vAlpha = mix(0.4, 1.0, near) * smoothstep(0.3, 0.9, dist);
  }
`;

// The same look as a node of the main space: a small crisp disc with a soft glow around it.
const NODE_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float disc = 1.0 - smoothstep(0.17, 0.21, d);
    float glow = exp(-d * d * 9.0) * 0.16 * (1.0 - smoothstep(0.8, 1.0, d));
    float alpha = clamp(disc + glow, 0.0, 1.0) * vAlpha;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), disc * 0.3), alpha);
  }
`;

const fontReady = () => (document.fonts?.ready ?? Promise.resolve());

function drawLabel(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  paint(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const paintLogo = (c, w, h) => {
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#ffffff';
  c.font = '900 190px Inter, "Helvetica Neue", Arial, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('CHANNEL', w / 2, h / 2 + 6);
};

const paintButton = (hover) => (c, w, h) => {
  c.clearRect(0, 0, w, h);
  const radius = h / 2 - 4;
  c.beginPath();
  c.roundRect(4, 4, w - 8, h - 8, radius);
  if (hover) {
    c.fillStyle = '#ffffff';
    c.fill();
  } else {
    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.stroke();
  }
  c.fillStyle = hover ? '#07070a' : '#ffffff';
  c.font = '600 92px "Noto Sans KR", "Malgun Gothic", Inter, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('VR룸 입장하기', w / 2, h / 2 + 4);
};

export function VRLobby({ onEnter, playbackTimeRef }) {
  const { gl } = useThree();
  const nodes = useMemo(makeNodes, []);
  const buttonRef = useRef();
  const logoRef = useRef();
  const textures = useRef({});
  const hovered = useRef(false);
  const sim = useRef(null);
  const audio = useRef({ ctx: null, panner: null, elements: [] });
  const virtual = useRef(null); // a pretend controller (used by the tests)
  const triggerWasDown = useRef(false);
  const enterRef = useRef(onEnter);
  enterRef.current = onEnter;

  const { geometry, material, attributes } = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = plane.index;
    geometry.setAttribute('position', plane.attributes.position);
    const position = new THREE.InstancedBufferAttribute(new Float32Array(nodes.count * 3), 3);
    position.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aPos', position);
    geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(nodes.color, 3));
    geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(nodes.size, 1));
    geometry.instanceCount = nodes.count;
    const material = new THREE.ShaderMaterial({
      vertexShader: NODE_VERTEX,
      fragmentShader: NODE_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    return { geometry, material, attributes: { position } };
  }, [nodes]);

  // Where every node is, how fast it moves, and where each controller was a moment ago.
  if (!sim.current) {
    sim.current = {
      position: Float32Array.from(nodes.home),
      velocity: new Float32Array(nodes.count * 3),
      pushers: [{ last: null, seen: false, lastDirection: null }, { last: null, seen: false, lastDirection: null }],
      balance: 0,
      restMean: 0,
    };
    let rest = 0;
    for (let i = 0; i < nodes.count; i += 1) rest += Math.max(-1, Math.min(1, nodes.home[i * 3] / LOBBY.BALANCE_REACH));
    sim.current.restMean = rest / nodes.count;
  }

  // Textures for the logo and the button (drawn once the fonts are in).
  useEffect(() => {
    let cancelled = false;
    fontReady().then(() => {
      if (cancelled) return;
      textures.current.logo = drawLabel(1024, 256, paintLogo);
      textures.current.button = drawLabel(1024, 256, paintButton(false));
      textures.current.buttonHover = drawLabel(1024, 256, paintButton(true));
      if (logoRef.current) { logoRef.current.material.map = textures.current.logo; logoRef.current.material.needsUpdate = true; }
      if (buttonRef.current) { buttonRef.current.material.map = textures.current.button; buttonRef.current.material.needsUpdate = true; }
    });
    return () => { cancelled = true; };
  }, []);

  // A trigger pull while pointing at the button enters the room.
  useEffect(() => {
    const xr = gl.xr;
    const raycaster = new THREE.Raycaster();
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const handlers = [0, 1].map((index) => {
      const controller = xr.getController(index);
      const onSelect = () => {
        if (!buttonRef.current) return;
        controller.getWorldPosition(origin);
        controller.getWorldQuaternion(quaternion);
        direction.set(0, 0, -1).applyQuaternion(quaternion);
        raycaster.set(origin, direction);
        if (raycaster.intersectObject(buttonRef.current).length > 0) enterRef.current?.();
      };
      controller.addEventListener('selectstart', onSelect);
      return () => controller.removeEventListener('selectstart', onSelect);
    });
    return () => handlers.forEach((off) => off());
  }, [gl]);

  // The one song: every stem plays together, and a stereo panner tilts it left or right.
  useEffect(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const stems = SONG_STEMS[EXHIBITION_SONG].filter((stem) => stem.url);
    const mix = ctx.createGain();
    mix.gain.value = LOBBY.VOLUME;
    const panner = ctx.createStereoPanner();
    const compressor = ctx.createDynamicsCompressor();
    mix.connect(panner);
    panner.connect(compressor);
    compressor.connect(ctx.destination);

    const elements = stems.map((stem) => {
      const element = new Audio(stem.url);
      element.crossOrigin = 'anonymous';
      element.loop = true;
      const resumeAt = playbackTimeRef?.current || 0;
      if (resumeAt > 0) element.addEventListener('loadedmetadata', () => { element.currentTime = resumeAt; }, { once: true });
      ctx.createMediaElementSource(element).connect(mix);
      return element;
    });
    audio.current = { ctx, panner, elements };

    let ready = 0;
    const startAll = () => {
      ready += 1;
      if (ready < elements.length) return;
      ctx.resume?.().catch(() => {});
      elements.forEach((element) => element.play().catch(() => {}));
    };
    elements.forEach((element) => {
      if (element.readyState >= 3) startAll();
      else element.addEventListener('canplaythrough', startAll, { once: true });
    });

    // A headset may suspend the sound when the session starts; keep nudging it back.
    const keepPlaying = setInterval(() => {
      if (ctx.state === 'closed') return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      elements.forEach((element) => {
        if (element.paused && element.readyState >= 3 && !element.error) element.play().catch(() => {});
      });
    }, 1000);

    return () => {
      clearInterval(keepPlaying);
      if (playbackTimeRef && elements[0]) playbackTimeRef.current = elements[0].currentTime;
      elements.forEach((element) => { element.pause(); element.src = ''; element.load(); });
      ctx.close();
      audio.current = { ctx: null, panner: null, elements: [] };
    };
  }, [playbackTimeRef]);

  // Test hooks: a look at the balance, and a pretend controller that sweeps through the nodes.
  useEffect(() => {
    window.__starMixLobby = {
      getState: () => ({ count: nodes.count, balance: sim.current.balance, buttonHovered: hovered.current }),
      sweep: ({ from, velocity, seconds = 1, radius = LOBBY.TOUCH_RADIUS }) => {
        virtual.current = { position: new THREE.Vector3(...from), velocity: new THREE.Vector3(...velocity), until: performance.now() + seconds * 1000, radius };
      },
      enter: () => enterRef.current?.(),
    };
    return () => { delete window.__starMixLobby; };
  }, [nodes]);

  const scratch = useMemo(() => ({
    point: new THREE.Vector3(),
    last: new THREE.Vector3(),
    origin: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    raycaster: new THREE.Raycaster(),
  }), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    if (dt <= 0) return;
    const time = state.clock.elapsedTime;
    const { position, velocity } = sim.current;
    const radius = LOBBY.TOUCH_RADIUS;

    // Who is touching: each controller, and the pretend one.
    const touchers = [];
    const beams = [];
    const xr = gl.xr;
    if (xr.isPresenting) {
      [0, 1].forEach((index) => {
        const pusher = sim.current.pushers[index];
        const controller = xr.getController(index);
        controller.getWorldPosition(scratch.point);
        const moved = pusher.last ? scratch.point.clone().sub(pusher.last).divideScalar(dt) : new THREE.Vector3();
        // A controller that has not reported yet sits at the origin: ignore it until it moves.
        const reported = scratch.point.lengthSq() > 1e-6;
        if (reported) {
          pusher.seen = true;
          pusher.last = scratch.point.clone();
          touchers.push({ position: scratch.point.clone(), velocity: moved, radius });
          // The beam it points: sweeping it sideways carries the nodes along, far or near.
          controller.getWorldQuaternion(scratch.quaternion);
          const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(scratch.quaternion);
          const swing = pusher.lastDirection ? direction.clone().sub(pusher.lastDirection).divideScalar(dt) : new THREE.Vector3();
          pusher.lastDirection = direction.clone();
          beams.push({ origin: scratch.point.clone(), direction, swing });
        }
      });
    }
    if (virtual.current) {
      if (performance.now() > virtual.current.until) virtual.current = null;
      else {
        virtual.current.position.addScaledVector(virtual.current.velocity, dt);
        touchers.push({ position: virtual.current.position.clone(), velocity: virtual.current.velocity.clone(), radius: virtual.current.radius });
      }
    }

    const homeNow = new THREE.Vector3();
    let sumSide = 0;
    for (let i = 0; i < nodes.count; i += 1) {
      const k = i * 3;
      const phase = nodes.size[i] * 97;
      homeNow.set(
        nodes.home[k] + LOBBY.IDLE_DRIFT * Math.sin(time * 0.4 + phase),
        nodes.home[k + 1] + LOBBY.IDLE_DRIFT * Math.cos(time * 0.33 + phase * 1.3),
        nodes.home[k + 2] + LOBBY.IDLE_DRIFT * Math.sin(time * 0.27 + phase * 0.7),
      );
      let vx = velocity[k];
      let vy = velocity[k + 1];
      let vz = velocity[k + 2];
      const px = position[k];
      const py = position[k + 1];
      const pz = position[k + 2];

      for (const toucher of touchers) {
        const dx = px - toucher.position.x;
        const dy = py - toucher.position.y;
        const dz = pz - toucher.position.z;
        const distance = Math.hypot(dx, dy, dz);
        if (distance > toucher.radius || distance < 1e-4) continue;
        const strength = 1 - distance / toucher.radius;
        const speed = toucher.velocity.length();
        const outward = (1.5 + speed) * strength * LOBBY.PUSH * dt;
        vx += (dx / distance) * outward + toucher.velocity.x * 0.4 * strength * LOBBY.PUSH * dt;
        vy += (dy / distance) * outward + toucher.velocity.y * 0.4 * strength * LOBBY.PUSH * dt;
        vz += (dz / distance) * outward + toucher.velocity.z * 0.4 * strength * LOBBY.PUSH * dt;
      }

      for (const beam of beams) {
        const wx = px - beam.origin.x;
        const wy = py - beam.origin.y;
        const wz = pz - beam.origin.z;
        const along = wx * beam.direction.x + wy * beam.direction.y + wz * beam.direction.z;
        if (along < 0.3 || along > LOBBY.RAY_REACH) continue;
        const sx = wx - beam.direction.x * along;
        const sy = wy - beam.direction.y * along;
        const sz = wz - beam.direction.z * along;
        const off = Math.hypot(sx, sy, sz);
        const width = LOBBY.RAY_RADIUS + along * LOBBY.RAY_SPREAD;
        if (off > width) continue;
        const strength = 1 - off / width;
        // The sideways speed of the beam at this distance (a swing of the wrist is a fast sweep far away).
        const lateral = along * LOBBY.RAY_CARRY;
        const sideways = Math.hypot(beam.swing.x, beam.swing.y, beam.swing.z) * along;
        const gain = strength * LOBBY.PUSH * dt;
        vx += (beam.swing.x * lateral + (off > 1e-4 ? (sx / off) * sideways * 0.3 : 0)) * gain;
        vy += (beam.swing.y * lateral + (off > 1e-4 ? (sy / off) * sideways * 0.3 : 0)) * gain;
        vz += (beam.swing.z * lateral + (off > 1e-4 ? (sz / off) * sideways * 0.3 : 0)) * gain;
      }

      vx += ((homeNow.x - px) * LOBBY.SPRING - vx * LOBBY.DAMPING) * dt;
      vy += ((homeNow.y - py) * LOBBY.SPRING - vy * LOBBY.DAMPING) * dt;
      vz += ((homeNow.z - pz) * LOBBY.SPRING - vz * LOBBY.DAMPING) * dt;
      let nx = px + vx * dt;
      let ny = py + vy * dt;
      let nz = pz + vz * dt;
      const away = Math.hypot(nx - nodes.home[k], ny - nodes.home[k + 1], nz - nodes.home[k + 2]);
      if (away > LOBBY.MAX_OFFSET) {
        const pull = LOBBY.MAX_OFFSET / away;
        nx = nodes.home[k] + (nx - nodes.home[k]) * pull;
        ny = nodes.home[k + 1] + (ny - nodes.home[k + 1]) * pull;
        nz = nodes.home[k + 2] + (nz - nodes.home[k + 2]) * pull;
      }
      velocity[k] = vx; velocity[k + 1] = vy; velocity[k + 2] = vz;
      position[k] = nx; position[k + 1] = ny; position[k + 2] = nz;
      sumSide += Math.max(-1, Math.min(1, nx / LOBBY.BALANCE_REACH));
    }
    attributes.position.array.set(position);
    attributes.position.needsUpdate = true;

    // Left/right balance: how far the nodes as a whole have drifted from where they started.
    const drift = sumSide / nodes.count - sim.current.restMean;
    const balance = Math.max(-1, Math.min(1, drift * LOBBY.BALANCE_GAIN));
    sim.current.balance = balance;
    const { ctx, panner } = audio.current;
    if (ctx && panner && ctx.state !== 'closed') panner.pan.setTargetAtTime(balance, ctx.currentTime, LOBBY.PAN_EASE);
    if (playbackTimeRef && audio.current.elements[0]) playbackTimeRef.current = audio.current.elements[0].currentTime;

    // The button lights up while a controller points at it, and a trigger pull on it enters the room.
    let pointed = false;
    if (xr.isPresenting && buttonRef.current) {
      [0, 1].forEach((index) => {
        const controller = xr.getController(index);
        controller.getWorldPosition(scratch.origin);
        if (scratch.origin.lengthSq() < 1e-6) return;
        controller.getWorldQuaternion(scratch.quaternion);
        scratch.direction.set(0, 0, -1).applyQuaternion(scratch.quaternion);
        scratch.raycaster.set(scratch.origin, scratch.direction);
        if (scratch.raycaster.intersectObject(buttonRef.current).length > 0) pointed = true;
      });
      const session = xr.getSession?.();
      const triggerDown = Array.from(session?.inputSources ?? []).some((source) => {
        const trigger = source.gamepad?.buttons?.[0];
        return trigger && (trigger.pressed || trigger.value > 0.5);
      });
      if (triggerDown && !triggerWasDown.current && pointed) enterRef.current?.();
      triggerWasDown.current = triggerDown;
    }
    if (pointed !== hovered.current) setHover(pointed);
  });

  const setHover = (value) => {
    hovered.current = value;
    const mesh = buttonRef.current;
    const map = value ? textures.current.buttonHover : textures.current.button;
    if (mesh && map) { mesh.material.map = map; mesh.material.needsUpdate = true; }
  };

  return (
    <group>
      <mesh geometry={geometry} material={material} frustumCulled={false} raycast={() => null} renderOrder={1} />
      <mesh ref={logoRef} position={LOBBY.LOGO.position} raycast={() => null}>
        <planeGeometry args={LOBBY.LOGO.size} />
        <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh
        ref={buttonRef}
        position={LOBBY.BUTTON.position}
        onClick={() => enterRef.current?.()}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <planeGeometry args={LOBBY.BUTTON.size} />
        <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
