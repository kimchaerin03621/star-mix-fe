import React, { useRef, useMemo, useEffect, Suspense, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { XR, IfInSessionMode } from '@react-three/xr';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SONG_STEMS, getStemColor } from '../audio/songStems';
import { getInstrumentTexture } from './instrumentIcons';
import { WhiteGraph } from './graph/WhiteGraph';
import { REGION_COLORS, WHITE_GRAPH_CENTER } from './graph/graphConstants';
import { regionShapes, registerRegion, unregisterRegion } from './graph/graphRegistry';
import { isStillMode } from '../stillMode';
import { ENTRY_CAMERA_POSITION, ENTRY_CAMERA_TARGET } from '../audio/stemLayout';
import { WebcamGestureController } from '../hand-tracking/WebcamGestureController';


function ControllerHelpers() {
  const ref0 = useRef();
  const ref1 = useRef();
  
  useFrame((state) => {
    const xr = state.gl.xr;
    if (xr && xr.isPresenting) {
      const ctrl0 = xr.getController(0);
      const ctrl1 = xr.getController(1);
      
      if (ctrl0 && ctrl0.visible && ref0.current) {
        ref0.current.position.copy(ctrl0.position);
        ref0.current.visible = true;
      } else if (ref0.current) {
        ref0.current.visible = false;
      }
      
      if (ctrl1 && ctrl1.visible && ref1.current) {
        ref1.current.position.copy(ctrl1.position);
        ref1.current.visible = true;
      } else if (ref1.current) {
        ref1.current.visible = false;
      }
    }
  });
  
  return (
    <>
      <mesh ref={ref0} visible={false}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color="red" />
      </mesh>
      <mesh ref={ref1} visible={false}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color="blue" />
      </mesh>
    </>
  );
}

const sparkleTextureCache = {};

function getSparkleStarTexture(colorHex) {
  if (typeof document === 'undefined') return null;
  if (sparkleTextureCache[colorHex]) return sparkleTextureCache[colorHex];

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  const cx = 64;
  const cy = 64;

  ctx.clearRect(0, 0, 128, 128);

  // Soft Outer Glow
  const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50);
  glowGrad.addColorStop(0.0, colorHex);
  glowGrad.addColorStop(0.4, colorHex + '66');
  glowGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 50, 0, Math.PI * 2);
  ctx.fill();

  // 4-point Diamond Sparkle shape (vertical & horizontal needle spikes)
  const drawSpike = (angle, length, width) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -length);
    ctx.quadraticCurveTo(width, 0, 0, length);
    ctx.quadraticCurveTo(-width, 0, 0, -length);
    ctx.closePath();

    const spikeGrad = ctx.createLinearGradient(0, -length, 0, length);
    spikeGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0)');
    spikeGrad.addColorStop(0.2, colorHex);
    spikeGrad.addColorStop(0.5, '#ffffff');
    spikeGrad.addColorStop(0.8, colorHex);
    spikeGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = spikeGrad;
    ctx.fill();
    ctx.restore();
  };

  // Primary vertical and horizontal long spikes
  drawSpike(0, 48, 5);
  drawSpike(Math.PI / 2, 48, 5);

  // Secondary subtle diagonal inner spikes
  drawSpike(Math.PI / 4, 22, 3);
  drawSpike(-Math.PI / 4, 22, 3);

  // Bright White Core Center
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8);
  coreGrad.addColorStop(0.0, '#ffffff');
  coreGrad.addColorStop(0.6, '#ffffff');
  coreGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  sparkleTextureCache[colorHex] = texture;
  return texture;
}

// Organic Satellite Star Swarm & Nebula Cloud Component
// Surrounds each audio stem orb with small 4-pointed sparkle stars and micro-stardust particles
// tightly clustered within a 0.85m radius around the instrument orb.
function OrbSwarmSatellites({ color, isDragging }) {
  const groupRef = useRef();
  const sparkleTexture = useMemo(() => getSparkleStarTexture(color), [color]);

  const satelliteCount = 75; // Clean, elegant star count per orb

  // Initialize individual satellite star dynamic physics state
  const satellites = useMemo(() => {
    const arr = [];
    for (let i = 0; i < satelliteCount; i++) {
      // Tight spread radius tightly clustered between 0.15m and 0.85m around the core orb
      const phi = Math.acos(-1 + (2 * i) / satelliteCount);
      const theta = Math.sqrt(satelliteCount * Math.PI) * phi;
      const radius = 0.15 + Math.pow(Math.random(), 0.8) * 0.70; // Max 0.85m radius

      const baseRelPos = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );

      // Fine, delicate star sizes (0.03~0.15)
      const isCoreTiny = Math.random() < 0.70;
      const scale = isCoreTiny ? (0.03 + Math.random() * 0.05) : (0.08 + Math.random() * 0.07);

      arr.push({
        baseRelPos,
        currentPos: baseRelPos.clone(),
        speed: 0.5 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
        scale,
        rotationSpeed: (Math.random() - 0.5) * 2.2,
        opacityPhase: Math.random() * Math.PI * 2,
        orbitSpeed: (Math.random() - 0.5) * 0.5
      });
    }
    return arr;
  }, []);

  const spriteRefs = useRef([]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const time = state.clock.getElapsedTime();
    const lerpFactor = isDragging ? 0.05 : 0.12;

    satellites.forEach((sat, i) => {
      const sprite = spriteRefs.current[i];
      if (!sprite) return;

      // Slow organic orbital rotation around the core orb
      const angle = time * sat.orbitSpeed;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const rotatedX = sat.baseRelPos.x * cosA - sat.baseRelPos.z * sinA;
      const rotatedZ = sat.baseRelPos.x * sinA + sat.baseRelPos.z * cosA;
      const rotatedY = sat.baseRelPos.y;

      // Gentle organic float oscillation right around the orb
      const floatAmp = 0.02 + (sat.baseRelPos.length() * 0.02);
      const offsetX = Math.sin(time * sat.speed + sat.phase) * floatAmp;
      const offsetY = Math.cos(time * sat.speed * 1.3 + sat.phase) * floatAmp;
      const offsetZ = Math.sin(time * sat.speed * 0.8 + sat.phase) * floatAmp;

      const targetPos = new THREE.Vector3(rotatedX + offsetX, rotatedY + offsetY, rotatedZ + offsetZ);

      // Organic lerp interpolation: creates fluid trailing nebula swarm effect when orb is moved
      sat.currentPos.lerp(targetPos, lerpFactor);
      sprite.position.copy(sat.currentPos);

      // Subtle twinkling rotation and shimmer
      if (sprite.material) {
        sprite.material.rotation += sat.rotationSpeed * delta;
        const shimmer = 0.60 + Math.sin(time * 3.5 + sat.opacityPhase) * 0.40;
        sprite.material.opacity = shimmer * 0.92;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {satellites.map((sat, i) => (
        <sprite
          key={i}
          ref={(el) => (spriteRefs.current[i] = el)}
          raycast={() => null}
          position={sat.currentPos.toArray()}
          scale={[sat.scale, sat.scale, sat.scale]}
        >
          <spriteMaterial
            map={sparkleTexture}
            transparent={true}
            opacity={0.85}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  );
}

const starTextureCache = {};

// three.js numbers its controllers in the order they connect, which does not have
// to match the order of session.inputSources (that differs per device and
// browser). Each controller announces its input source when it connects, so we
// remember that pairing instead of guessing from the array order.
const controllerSources = new WeakMap();
const watchedControllers = new WeakSet();

function watchControllerSources(xr) {
  [0, 1].forEach((index) => {
    const controller = xr.getController(index);
    if (watchedControllers.has(controller)) return;
    watchedControllers.add(controller);
    controller.addEventListener('connected', (event) => controllerSources.set(controller, event.data));
    controller.addEventListener('disconnected', () => controllerSources.delete(controller));
  });
}

function getControllerSource(xr, session, index) {
  const announced = controllerSources.get(xr.getController(index));
  if (announced) return announced;
  const sources = Array.from(session.inputSources);
  return sources.find((source, i) => i === index
    || (index === 0 && source.handedness === 'right')
    || (index === 1 && source.handedness === 'left')) || sources[index];
}

// Touch controllers report the thumbstick on axes 2/3 (axes 0/1 are the unused
// touchpad); a pad with only two axes puts it on 0/1.
function getThumbstickY(gamepad) {
  const axes = gamepad.axes ?? [];
  const value = axes.length >= 4 ? axes[3] : axes[1];
  return Number.isFinite(value) ? value : 0;
}

// Instruments shown as a colored region of the white graph (any other keeps the plain glowing star).
const REGION_INSTRUMENTS = ['vocal', 'drum', 'bass', 'piano', 'guitar'];
// A region is grabbed anywhere within this distance of its sounding node (a bit inside the
// colored area's edge), and regions are kept this far apart so two never sit on top of each other.
const REGION_GRAB_RADIUS = 1.5;
// Dragging a region with the mouse: how near the eye and how far away (meters) the wheel can take it.
// The far limit covers the whole graph even when the camera is zoomed all the way out.
const MOUSE_DRAG_MIN = 0.6; // closest the wheel brings a held region: right in front of the eye, still in view
const MOUSE_DRAG_MAX = 40;
const MOUSE_WHEEL_SPEED = 0.0015; // per wheel unit; the distance changes by a share, so far and near both feel even
// Far away, a region is a tiny target; its click area grows with distance so it stays about as easy to hit.
const HIT_RADIUS_PER_METER = 0.06;
const STAR_MIN_DISTANCE = 2.2;
// Reading a stem's sound (the analyser has 128 bins of about 190 Hz each).
const SOUND_LOW_BINS = 4; // below ~750 Hz: the weight of drums and bass
const SOUND_HIGH_FROM_BIN = 24; // above ~4.5 kHz: the sparkle of cymbals and plucks
const SOUND_LOW_FLOOR = 0.5; // the low bins always carry some energy; only what is above this counts
const SOUND_HIGH_GAIN = 0.9;
const SOUND_SLOW_FOLLOW = 3; // how fast the "usual level" follows the real one
const SOUND_HIT_MARGIN = 0.01; // how far above the usual level counts as a hit
const SOUND_HIT_GAIN = 8;
const SOUND_HIT_FADE = 6; // per second

// Instrument silhouette opacity/size (world units) for each interaction state.
const ICON_STATE = {
  rest: { opacity: 0.6, scale: 0.46 },
  hovered: { opacity: 0.95, scale: 0.62 },
  grabbed: { opacity: 1, scale: 0.68 },
};

// `dimCore` swaps the white-hot center for a soft halo, leaving room for the
// instrument line drawing to sit in the middle of the star.
function getMenuStarTexture(colorHex, dimCore = false) {
  if (typeof document === 'undefined') return null;
  const cacheKey = dimCore ? `${colorHex}:dim` : colorHex;
  if (starTextureCache[cacheKey]) return starTextureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const centerX = 128;
  const centerY = 128;
  const radius = 128;

  const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  if (dimCore) {
    grad.addColorStop(0.0, colorHex + '55');
    grad.addColorStop(0.35, colorHex + '44');
    grad.addColorStop(0.6, colorHex + '22');
    grad.addColorStop(0.8, colorHex + '0a');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  } else {
    grad.addColorStop(0.0, '#ffffff');
    grad.addColorStop(0.18, 'rgba(255, 255, 255, 0.92)');
    grad.addColorStop(0.42, colorHex);
    grad.addColorStop(0.68, colorHex + '33');
    grad.addColorStop(0.88, 'rgba(0, 0, 0, 0)');
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  starTextureCache[cacheKey] = texture;
  return texture;
}

// Stars that can be picked with a controller, and which star each controller is holding.
// When several stars line up along the controller's ray, only the front one can be picked,
// and a controller that already holds a star cannot pick a second one.
const grabTargets = new Map(); // star key -> { group (ref), rayRadius, touchRadius }
const controllerHolds = [null, null]; // controller index -> star key it holds

const pickScratch = { to: new THREE.Vector3(), onRay: new THREE.Vector3() };

// The star this controller would pick right now: one touching the controller (the nearest),
// else the nearest one along the ray. Returns { key, grabDistance } or null.
function pickGrabTarget(origin, direction) {
  let touched = null;
  let touchedDistance = Infinity;
  let aimed = null;
  let aimedDistance = Infinity;
  grabTargets.forEach((target, key) => {
    const position = target.group.current?.position;
    if (!position) return;
    const distance = origin.distanceTo(position);
    if (distance < target.touchRadius && distance < touchedDistance) {
      touched = { key, grabDistance: Math.max(0.3, distance) };
      touchedDistance = distance;
    }
    pickScratch.to.subVectors(position, origin);
    const along = pickScratch.to.dot(direction);
    if (along > 0.1 && along < 15.0 && along < aimedDistance) {
      pickScratch.onRay.copy(direction).multiplyScalar(along).add(origin);
      const tolerance = Math.max(target.rayRadius, along * 0.05 + 0.18);
      if (position.distanceTo(pickScratch.onRay) < tolerance) {
        aimed = { key, grabDistance: Math.max(0.4, along) };
        aimedDistance = along;
      }
    }
  });
  return touched ?? aimed;
}

// Several stars can lie along one mouse ray (their click areas overlap, or one is in front of
// another). The one whose center the ray passes nearest is the one meant; the others let go.
function isNearestToRay(orbKey, ray) {
  const to = new THREE.Vector3();
  let bestKey = null;
  let bestDistance = Infinity;
  grabTargets.forEach((target, key) => {
    const position = target.hitCenter ?? target.group.current?.position;
    if (!position) return;
    to.subVectors(position, ray.origin);
    const along = to.dot(ray.direction);
    if (along <= 0) return;
    const side = to.addScaledVector(ray.direction, -along).length();
    const reach = target.hitReach ?? Math.max(target.rayRadius, along * HIT_RADIUS_PER_METER);
    if (side < reach && side < bestDistance) {
      bestDistance = side;
      bestKey = key;
    }
  });
  return bestKey === null || bestKey === orbKey;
}

// 3D Interactive Audio Orb (Main Menu Volumetric Celestial Star Style)
function InteractiveOrb({
  color,
  initialPos,
  orbKey,
  coordsRef,
  setIsDraggingOrb,
  analysersRef,
  draggingOrbsRef,
  instrument,
  isHandHovered,
  isHandGrabbed,
}) {
  const meshRef = useRef();
  const iconRef = useRef();
  const auraRef = useRef();
  
  const instrumentTexture = useMemo(() => getInstrumentTexture(instrument, color), [instrument, color]);
  const starTexture = useMemo(() => getMenuStarTexture(color, Boolean(instrumentTexture)), [color, instrumentTexture]);

  const [isDragging, setIsDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isVisualHovered = hovered || isHandHovered || isHandGrabbed;
  const usesRegion = REGION_INSTRUMENTS.includes(instrument);
  // What this star's stem sounds like right now: overall level, low and high parts, and
  // a short flash on each new hit (a drum stroke, a plucked note).
  const soundRef = useRef({ vol: 0, low: 0, high: 0, hit: 0, slow: 0, age: 9 });
  const spectrumRef = useRef(null);
  const interactionRef = useRef({ hovered: false, grabbed: false });

  // Tells the white graph where this star is, what color it is and how it sounds and is
  // being touched, so the graph can color a region around it.
  useEffect(() => {
    if (!usesRegion) return undefined;
    registerRegion(orbKey, { color: REGION_COLORS[instrument] ?? color, group: meshRef, sound: soundRef, interaction: interactionRef });
    return () => unregisterRegion(orbKey);
  }, [usesRegion, orbKey, color, instrument]);
  useEffect(() => {
    interactionRef.current = { hovered: isVisualHovered, grabbed: isHandGrabbed || isDragging };
  }, [isVisualHovered, isHandGrabbed, isDragging]);

  // Lets the controller picking logic know where this star is and how big a target it is.
  useEffect(() => {
    grabTargets.set(orbKey, {
      group: meshRef,
      rayRadius: usesRegion ? REGION_GRAB_RADIUS : 0.28,
      touchRadius: usesRegion ? REGION_GRAB_RADIUS * 0.6 : 0.3,
    });
    return () => {
      grabTargets.delete(orbKey);
      controllerHolds.forEach((key, index) => { if (key === orbKey) controllerHolds[index] = null; });
    };
  }, [orbKey, usesRegion]);

  // The instrument silhouette is faint at rest, clear on hover, brightest once grabbed.
  useFrame((_, delta) => {
    const icon = iconRef.current;
    if (!icon) return;
    const target = isHandGrabbed || isDragging
      ? ICON_STATE.grabbed
      : isVisualHovered ? ICON_STATE.hovered : ICON_STATE.rest;
    const ease = 1 - Math.exp(-delta * 10);
    icon.material.opacity += (target.opacity - icon.material.opacity) * ease;
    const nextScale = icon.scale.x + (target.scale - icon.scale.x) * ease;
    icon.scale.set(nextScale, nextScale, nextScale);
  });
  const { raycaster, gl } = useThree();
  
  // Track dragging distance and active grabbing controller (0, 1, or 'mouse')
  const dragDistanceRef = useRef(2.5);
  // Where the star was relative to the mouse ray when it was picked, so it does not jump on click.
  const dragOffsetRef = useRef(new THREE.Vector3());
  const dragStartDistanceRef = useRef(1);
  const hitRef = useRef();
  const activeControllerRef = useRef(null);
  const isHoveredRef = useRef(false);

  // Sync drag state to parent collision manager
  useEffect(() => {
    if (draggingOrbsRef && draggingOrbsRef.current) {
      draggingOrbsRef.current[orbKey] = isDragging || isHandGrabbed;
    }
  }, [isDragging, isHandGrabbed, orbKey, draggingOrbsRef]);

  // Desktop mouse pointer feedback
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.style.cursor = hovered ? 'pointer' : 'auto';
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.cursor = 'auto';
      }
    };
  }, [hovered]);

  // Handle PC scroll wheel zoom (depth sliding) during dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleWheel = (e) => {
      e.preventDefault();
      dragDistanceRef.current *= Math.exp(-e.deltaY * MOUSE_WHEEL_SPEED);
      dragDistanceRef.current = Math.max(MOUSE_DRAG_MIN, Math.min(MOUSE_DRAG_MAX, dragDistanceRef.current));
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [isDragging]);

  const handlePointerDown = (e) => {
    // Another star is the one the mouse is pointing at: let it take the click.
    if (!gl.xr.isPresenting && !isNearestToRay(orbKey, raycaster.ray)) return;
    e.stopPropagation();
    if (e.target && typeof e.target.setPointerCapture === 'function' && e.pointerId) {
      try { e.target.setPointerCapture(e.pointerId); } catch { /* Capture is optional. */ }
    }
    
    const xr = gl.xr;
    if (xr && xr.isPresenting && meshRef.current) {
      const orbPos = meshRef.current.position;
      let chosen = 0;
      let minDist = Infinity;
      
      for (let i = 0; i < 2; i++) {
        const ctrl = xr.getController(i);
        if (ctrl && ctrl.visible) {
          const d = ctrl.position.distanceTo(orbPos);
          if (d < minDist) {
            minDist = d;
            chosen = i;
          }
        }
      }
      activeControllerRef.current = chosen;
      const ctrl = xr.getController(chosen);
      const dist = ctrl ? ctrl.position.distanceTo(orbPos) : 2.5;
      dragDistanceRef.current = Math.max(0.3, Math.min(10.0, dist));
    } else {
      activeControllerRef.current = 'mouse';
      // Hold the star where it is: remember how far it is along the ray and how far off the ray it sits.
      const dist = raycaster.ray.origin.distanceTo(meshRef.current.position);
      dragDistanceRef.current = Math.max(MOUSE_DRAG_MIN, Math.min(MOUSE_DRAG_MAX, dist));
      dragStartDistanceRef.current = dragDistanceRef.current;
      dragOffsetRef.current
        .copy(meshRef.current.position)
        .sub(raycaster.ray.at(dragDistanceRef.current, new THREE.Vector3()));
    }
    
    setIsDragging(true);
    setIsDraggingOrb(true); // Disable OrbitControls
  };

  const handlePointerUp = (e) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    setIsDragging(false);
    setIsDraggingOrb(false); // Re-enable OrbitControls
  };

  // 60fps/90fps frame loop: Continuously update position and check VR controller joystick input!
  useFrame((state, delta) => {
    const xr = state.gl.xr;

    // Billboard camera alignment for borderless volumetric light cloud quad
    if (auraRef.current) {
      auraRef.current.quaternion.copy(state.camera.quaternion);
    }

    // 0. Audio Analyser Pulse Effect
    let currentVol = 0;

    if (meshRef.current && analysersRef && analysersRef.current && analysersRef.current[orbKey]) {
      const analyser = analysersRef.current[orbKey];
      const bufferLength = analyser.frequencyBinCount;
      if (!spectrumRef.current || spectrumRef.current.length !== bufferLength) {
        spectrumRef.current = new Uint8Array(bufferLength);
      }
      const dataArray = spectrumRef.current;
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      let lowSum = 0;
      let highSum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
        if (i < SOUND_LOW_BINS) lowSum += dataArray[i];
        else if (i >= SOUND_HIGH_FROM_BIN) highSum += dataArray[i];
      }
      const avg = sum / (bufferLength || 1);
      currentVol = Math.pow(avg / 255, 1.2);

      const sound = soundRef.current;
      sound.vol = currentVol;
      sound.low = Math.min(1, Math.max(0, (lowSum / (SOUND_LOW_BINS * 255) - SOUND_LOW_FLOOR) / (1 - SOUND_LOW_FLOOR)));
      sound.high = Math.min(1, Math.pow(highSum / ((bufferLength - SOUND_HIGH_FROM_BIN) * 255), 1.2) * SOUND_HIGH_GAIN);
      // A hit = the level jumping above its own slow average; it flashes, then fades quickly.
      sound.slow += (currentVol - sound.slow) * Math.min(1, delta * SOUND_SLOW_FOLLOW);
      const onset = Math.min(1, Math.max(0, currentVol - sound.slow - SOUND_HIT_MARGIN) * SOUND_HIT_GAIN);
      // The ring of light that runs out from the sounding node starts on each fresh hit.
      sound.age = onset > 0.5 && sound.hit < 0.3 ? 0 : Math.min(9, sound.age + delta);
      sound.hit = Math.max(sound.hit * Math.exp(-delta * SOUND_HIT_FADE), onset);

      // A region does not swell (the graph itself shows the sound); a plain star pulses.
      const baseScale = isVisualHovered && !usesRegion ? 1.25 : 1.0;
      const pulseScale = usesRegion ? 1 : baseScale + currentVol * 0.95;
      meshRef.current.scale.set(pulseScale, pulseScale, pulseScale);
    } else if (meshRef.current) {
      const baseScale = isVisualHovered && !usesRegion ? 1.25 : 1.0;
      meshRef.current.scale.set(baseScale, baseScale, baseScale);
    }

    // Far from the eye the click area grows, so a zoomed-out star is not a tiny target.
    if (hitRef.current && usesRegion && meshRef.current) {
      const shape = regionShapes.get(orbKey);
      const eyeDistance = state.camera.position.distanceTo(meshRef.current.position);
      const reach = Math.max(shape ? shape.radius : 0, REGION_GRAB_RADIUS, eyeDistance * HIT_RADIUS_PER_METER);
      // The click area sits on the colored region itself (not on the star's own point, which can
      // be up to a meter away) and is as wide as that region looks.
      if (shape) hitRef.current.position.set(shape.center[0], shape.center[1], shape.center[2]).sub(meshRef.current.position);
      else hitRef.current.position.set(0, 0, 0);
      hitRef.current.scale.setScalar(reach / REGION_GRAB_RADIUS);
      const target = grabTargets.get(orbKey);
      if (target) {
        target.hitCenter = target.hitCenter ?? new THREE.Vector3();
        target.hitCenter.copy(meshRef.current.position).add(hitRef.current.position);
        target.hitReach = reach;
      }
    }

    // VR Ray Pointer & Proximity Detection, Hover Feedback, and Auto-Grab (60/90fps frame loop)
    if (xr && xr.isPresenting && meshRef.current) {
      const session = (typeof xr.getSession === 'function') ? xr.getSession() : null;
      let isAnyCtrlHovering = false;

      for (let i = 0; i < 2; i++) {
        const ctrl = xr.getController(i);
        if (ctrl && ctrl.visible) {
          const rayOrigin = new THREE.Vector3();
          ctrl.getWorldPosition(rayOrigin);

          const worldQuat = new THREE.Quaternion();
          ctrl.getWorldQuaternion(worldQuat);
          const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat).normalize();

          // Only the front star under this controller counts, and not while it holds another.
          const holder = controllerHolds[i];
          const pick = holder === null || holder === orbKey ? pickGrabTarget(rayOrigin, rayDir) : null;
          const isTargeted = pick !== null && pick.key === orbKey;
          const grabDistance = isTargeted ? pick.grabDistance : 2.5;

          if (isTargeted) {
            isAnyCtrlHovering = true;

            if (!isDragging) {
              let isButtonPressed = false;
              if (session && session.inputSources) {
                const sourceToUse = getControllerSource(xr, session, i);
                if (sourceToUse && sourceToUse.gamepad && sourceToUse.gamepad.buttons) {
                  const btn0 = sourceToUse.gamepad.buttons[0]; // Trigger
                  const btn1 = sourceToUse.gamepad.buttons[1]; // Grip / Squeeze
                  if ((btn0 && (btn0.pressed || btn0.value > 0.15)) ||
                      (btn1 && (btn1.pressed || btn1.value > 0.15))) {
                    isButtonPressed = true;
                  }
                }
              }

              if (isButtonPressed) {
                activeControllerRef.current = i;
                controllerHolds[i] = orbKey;
                dragDistanceRef.current = grabDistance;
                setIsDragging(true);
                setIsDraggingOrb(true);
                break;
              }
            }
          }
        }
      }

      if (!isDragging) {
        if (isHoveredRef.current !== isAnyCtrlHovering) {
          isHoveredRef.current = isAnyCtrlHovering;
          setHovered(isAnyCtrlHovering);
        }
      }
    }

    if (!isDragging) {
      // Synchronize the mesh position with the collision-resolved coordsRef
      if (meshRef.current && coordsRef.current && coordsRef.current[orbKey]) {
        const solvedPos = coordsRef.current[orbKey];
        meshRef.current.position.copy(solvedPos);
      }
      return;
    }

    // Active VR Controller Tracking & Movement
    if (xr && xr.isPresenting && activeControllerRef.current !== 'mouse') {
      const idx = activeControllerRef.current ?? 0;
      const ctrl = xr.getController(idx);
      const session = (typeof xr.getSession === 'function') ? xr.getSession() : null;

      // Release check: if trigger & grip buttons are unpressed, release grab automatically!
      if (session && session.inputSources) {
        const sourceToUse = getControllerSource(xr, session, idx);
        if (sourceToUse && sourceToUse.gamepad && sourceToUse.gamepad.buttons) {
          const btn0 = sourceToUse.gamepad.buttons[0];
          const btn1 = sourceToUse.gamepad.buttons[1];
          const pressed0 = btn0 ? (btn0.pressed || btn0.value > 0.15) : false;
          const pressed1 = btn1 ? (btn1.pressed || btn1.value > 0.15) : false;

          if (!pressed0 && !pressed1) {
            if (controllerHolds[idx] === orbKey) controllerHolds[idx] = null;
            setIsDragging(false);
            setIsDraggingOrb(false);
            return;
          }

          // Joystick Y axis adjusts depth distance along pointer ray
          const stickY = getThumbstickY(sourceToUse.gamepad);
          if (Math.abs(stickY) > 0.1) {
            dragDistanceRef.current += stickY * -0.06;
            dragDistanceRef.current = Math.max(0.3, Math.min(10.0, dragDistanceRef.current));
          }
        }
      }

      if (ctrl && ctrl.visible && meshRef.current) {
        const rayOrigin = new THREE.Vector3();
        ctrl.getWorldPosition(rayOrigin);

        const worldQuat = new THREE.Quaternion();
        ctrl.getWorldQuaternion(worldQuat);
        const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat).normalize();

        const targetPos = rayOrigin.clone().add(rayDir.multiplyScalar(dragDistanceRef.current));

        meshRef.current.position.copy(targetPos);
        coordsRef.current[orbKey].copy(targetPos);

      }
    } else if (meshRef.current) {
      // Desktop Mouse Ray Position Update: follow the mouse ray, keeping the grab offset.
      // The offset scales with the distance: the star stays at the same spot on screen as the
      // wheel moves it, so it can never slide off to the side or behind the eye.
      const nextPoint = raycaster.ray.at(dragDistanceRef.current, new THREE.Vector3())
        .addScaledVector(dragOffsetRef.current, dragDistanceRef.current / dragStartDistanceRef.current);

      meshRef.current.position.copy(nextPoint);
      coordsRef.current[orbKey].copy(nextPoint);

    }
  });

  return (
    <group>
      {/* Main Interactive Celestial Star Group (Borderless Volumetric Glowing Light Cloud) */}
      <group
        ref={meshRef}
        position={initialPos}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); if (!isDragging) setIsDraggingOrb(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); if (!isDragging) setIsDraggingOrb(false); }}
      >
        {/* Invisible Hit-Test Proxy Sphere for 100% Precise Mouse/Raycast Drag Interaction */}
        <mesh ref={hitRef} visible={false}>
          <sphereGeometry args={[usesRegion ? REGION_GRAB_RADIUS : 0.22, 16, 16]} />
          <meshBasicMaterial />
        </mesh>

        {!usesRegion && starTexture && (
          <sprite
            raycast={() => null}
            scale={isVisualHovered ? [1.45, 1.45, 1.45] : [1.15, 1.15, 1.15]}
          >
            <spriteMaterial
              map={starTexture}
              transparent={true}
              opacity={isVisualHovered ? 0.95 : 0.82}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </sprite>
        )}

        {/* Instrument silhouette cut into the star's glowing core */}
        {!usesRegion && instrumentTexture && (
          <sprite ref={iconRef} raycast={() => null} scale={[ICON_STATE.rest.scale, ICON_STATE.rest.scale, ICON_STATE.rest.scale]} renderOrder={10}>
            <spriteMaterial
              map={instrumentTexture}
              transparent={true}
              opacity={ICON_STATE.rest.opacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </sprite>
        )}

        {/* Dynamic point light to illuminate surrounding space stars */}
        <pointLight position={[0, 0, 0]} color={color} intensity={isVisualHovered ? 2.0 : 1.2} distance={6} decay={1.5} />
      </group>
    </group>
  );
}

// Level of the whole spatial mix (1 = untouched). About 0.3 matches the galaxy's loudness.
const SPATIAL_OUTPUT_GAIN = 0.3;
// Stems closer than this to the listener play at full volume (inverse model).
const SPATIAL_REF_DISTANCE = 4.0;

// Where the listener's head is and which way it faces. In a headset session the scene camera's
// own rotation can be wrong (it is a two-eye camera), so the pose is read from the eyes;
// otherwise the camera itself is the head.
const eyeScratch = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(), other: new THREE.Vector3() };
function readHeadPose(state, out) {
  const eyes = state.gl.xr.isPresenting ? state.gl.xr.getCamera().cameras : null;
  if (eyes && eyes.length > 0) {
    eyes[0].matrixWorld.decompose(out.position, out.quaternion, eyeScratch.scale);
    if (eyes[1]) {
      eyes[1].matrixWorld.decompose(eyeScratch.other, eyeScratch.quaternion, eyeScratch.scale);
      out.position.add(eyeScratch.other).multiplyScalar(0.5);
    }
  } else {
    out.position.copy(state.camera.position);
    out.quaternion.copy(state.camera.quaternion);
  }
  return out;
}
const headPose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };

// 3D VR Spatial Audio Experience (다이내믹 멀티트랙 스템 믹서 엔진)
function VRAudioExperience({
  starColors,
  activeSong,
  leftRate,
  rightRate,
  activePreset,
  isAudioActive,
  setIsDraggingOrb,
  playbackTimeRef,
  handData,
  orbitControlsRef,
  onWebcamInteractionChange,
  handVisualFrameRef,
}) {
  const { camera, gl } = useThree();

  useEffect(() => {
    if (gl.xr?.isPresenting) return;
    camera.position.set(...ENTRY_CAMERA_POSITION);
    const controls = orbitControlsRef.current;
    if (controls) {
      // Turn the view around the middle of the whole graph (where the listener's head is), not
      // around a point out in front of the starting camera.
      controls.target.set(...WHITE_GRAPH_CENTER);
      controls.update();
    } else {
      camera.lookAt(...ENTRY_CAMERA_TARGET);
    }
  }, [camera, gl, orbitControlsRef]);

  const audioCtxRef = useRef(null);
  const audioElementsRef = useRef({});
  const pannersRef = useRef({});

  // Dev-only: lets the tests read how the sound is currently placed around the listener.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__starMixAudio = () => {
      const listener = audioCtxRef.current?.listener;
      if (!listener?.forwardX) return null;
      return {
        position: [listener.positionX.value, listener.positionY.value, listener.positionZ.value],
        forward: [listener.forwardX.value, listener.forwardY.value, listener.forwardZ.value],
        panners: Object.fromEntries(Object.entries(pannersRef.current).map(([key, panner]) => [key, [panner.positionX.value, panner.positionY.value, panner.positionZ.value]])),
      };
    };
    return () => { delete window.__starMixAudio; };
  }, []);
  const gainsRef = useRef({});
  const analysersRef = useRef({});
  const eqFiltersRef = useRef({ low: null, mid: null, high: null });
  const masterFilterRef = useRef(null);

  // Sync refs to avoid canvas render loop teardown and layout reflow on every frame
  const leftRateRef = useRef(leftRate);
  const rightRateRef = useRef(rightRate);
  const activePresetRef = useRef(activePreset);
  useEffect(() => { leftRateRef.current = leftRate; }, [leftRate]);
  useEffect(() => { rightRateRef.current = rightRate; }, [rightRate]);
  useEffect(() => { activePresetRef.current = activePreset; }, [activePreset]);

  // 활성 곡 및 테마별 악기 고유 컬러 동적 매핑 (보컬, 드럼, 베이스, 피아노, 기타 등 각각 고유 색상 부여)
  const stems = useMemo(() => {
    const rawStems = SONG_STEMS[activeSong] || SONG_STEMS[1];
    return rawStems.map((stem) => ({
      ...stem,
      color: getStemColor(stem)
    }));
  }, [activeSong, starColors]);

  // 스템별 3D 좌표를 60fps 추적이 가능한 useRef 좌표계 사전에 동적 적재
  const orbCoordsRef = useRef({});
  useEffect(() => {
    stems.forEach(stem => {
      if (!orbCoordsRef.current[stem.key]) {
        orbCoordsRef.current[stem.key] = new THREE.Vector3(...stem.initialPos);
      }
    });
  }, [stems]);

  useEffect(() => {
    watchControllerSources(gl.xr);
  }, [gl]);

  // Dev-only hook so the end-to-end tests can read where each star is.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__starMixTest = {
      getStemPositions: () => Object.fromEntries(
        Object.entries(orbCoordsRef.current).map(([key, position]) => [key, position.toArray()]),
      ),
      endSession: () => gl.xr.getSession()?.end(),
      setStemPosition: (key, position) => orbCoordsRef.current[key]?.set(...position),
      getControllerHolds: () => [...controllerHolds],
      getDragging: () => ({ ...draggingOrbsRef.current }),
      getOrbitTarget: () => orbitControlsRef.current?.target.toArray() ?? null,
      // Where a star is on the page (pixels), and how far the eye is from it.
      getStarOnScreen: (key) => {
        const position = orbCoordsRef.current[key];
        if (!position) return null;
        const projected = position.clone().project(camera);
        const box = gl.domElement.getBoundingClientRect();
        return {
          x: box.left + (projected.x + 1) / 2 * box.width,
          y: box.top + (1 - projected.y) / 2 * box.height,
          distance: camera.position.distanceTo(position),
          // In front of the eye and inside the picture.
          visible: projected.z < 1 && Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1,
        };
      },
      getCameraDistanceTo: (key) => (orbCoordsRef.current[key] ? camera.position.distanceTo(orbCoordsRef.current[key]) : null),
      getRenderStats: () => ({ ...gl.info.render }),
      getControllerState: () => {
        const session = gl.xr.getSession();
        return {
          presenting: gl.xr.isPresenting,
          renderedFrames: gl.info.render.frame,
          controllers: [0, 1].map((index) => {
            const controller = gl.xr.getController(index);
            const source = session?.inputSources[index];
            return {
              visible: controller.visible,
              position: controller.getWorldPosition(controller.position.clone()).toArray(),
              rayDirection: controller.getWorldDirection(new THREE.Vector3()).negate().toArray(),
              handedness: source?.handedness ?? null,
              triggerValue: source?.gamepad?.buttons[0]?.value ?? null,
              axes: source ? Array.from(source.gamepad?.axes ?? []) : null,
            };
          }),
        };
      },
    };
    return () => { delete window.__starMixTest; };
  }, [gl]);

  // Initialize Web Audio Engine (곡 전환 시 정밀한 가비지 컬렉션 및 리소스 파기 보장)
  useEffect(() => {
    if (!isAudioActive) return;

    const initAudio = async () => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const curTime = ctx.currentTime;

      // Master lowpass filter
      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.value = 20000;

      // Dynamics Compressor to limit distortion and boost perceived volume
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-16, curTime);
      compressor.knee.setValueAtTime(30, curTime);
      compressor.ratio.setValueAtTime(12, curTime);
      compressor.attack.setValueAtTime(0.003, curTime);
      compressor.release.setValueAtTime(0.25, curTime);

      masterFilter.connect(compressor);
      // Trim the spatial mix so it sits at the galaxy's loudness (they used to differ by
      // ~8 dB) and no longer clips.
      const outputGain = ctx.createGain();
      outputGain.gain.value = SPATIAL_OUTPUT_GAIN;
      compressor.connect(outputGain);
      outputGain.connect(ctx.destination);
      masterFilterRef.current = masterFilter;

      // EQ Shelf filters
      const lowShelf = ctx.createBiquadFilter();
      lowShelf.type = 'lowshelf';
      lowShelf.frequency.value = 250;
      lowShelf.gain.value = 0;

      const midPeaking = ctx.createBiquadFilter();
      midPeaking.type = 'peaking';
      midPeaking.frequency.value = 1000;
      midPeaking.Q.value = 0.7;
      midPeaking.gain.value = 0;

      const highShelf = ctx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 5000;
      highShelf.gain.value = 0;

      lowShelf.connect(midPeaking);
      midPeaking.connect(highShelf);
      highShelf.connect(masterFilter);
      eqFiltersRef.current = { low: lowShelf, mid: midPeaking, high: highShelf };

      const elements = {};
      const panners = {};
      const gains = {};
      const analysers = {};

      // 다이내믹 루프: url이 있는 실제 음색 스템만 오디오 그래프 연결
      stems.forEach(stem => {
        if (!stem.url) return;

        const audio = new Audio(stem.url);
        audio.crossOrigin = "anonymous";
        audio.loop = true;
        audio.preservesPitch = true;
        // Continue the song from where the galaxy left off.
        const resumeAt = playbackTimeRef?.current || 0;
        if (resumeAt > 0) {
          audio.addEventListener('loadedmetadata', () => { audio.currentTime = resumeAt; }, { once: true });
        }

        const source = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();
        gain.gain.value = 1.0;

        // Create AnalyserNode for dynamic waveform pulse effect!
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5; // quicker than the default so hits are not smeared out

        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF'; // Web Audio API HRTF (Binaural 3D Spatial Audio)
        panner.distanceModel = 'inverse';
        panner.refDistance = SPATIAL_REF_DISTANCE;
        panner.maxDistance = 10000;
        panner.rolloffFactor = 1.0; // Realistic 3D distance attenuation (Dolby Atmos feel)

        // 초기 지정 3D 공간 좌표 주입
        const pos = orbCoordsRef.current[stem.key] || new THREE.Vector3(...stem.initialPos);
        panner.positionX.setValueAtTime(pos.x, curTime);
        panner.positionY.setValueAtTime(pos.y, curTime);
        panner.positionZ.setValueAtTime(pos.z, curTime);

        // Connect graph: source -> gain -> analyser -> panner -> lowShelf
        source.connect(gain);
        gain.connect(analyser);
        analyser.connect(panner);
        panner.connect(lowShelf);

        elements[stem.key] = audio;
        panners[stem.key] = panner;
        gains[stem.key] = gain;
        analysers[stem.key] = analyser;
      });

      audioElementsRef.current = elements;
      pannersRef.current = panners;
      gainsRef.current = gains;
      analysersRef.current = analysers;

      const startPlayback = async () => {
        try {
          if (ctx.state === 'suspended') await ctx.resume();
          // Play all active stems, catching AbortError individually to prevent unhandled promise rejections on song changes
          await Promise.all(
            Object.values(elements).map(audio =>
              (isStillMode ? Promise.resolve() : audio.play()).catch(err => {
                if (err.name !== 'AbortError') {
                  console.warn("Spatial stem play failed:", err);
                }
              })
            )
          );
        } catch (err) {
          console.error("Failed to start spatial playback:", err);
        }
      };

      // 실제 오디오 파일이 존재하는 스템의 갯수만 체킹
      const activeStemsCount = stems.filter(s => s.url).length;
      let readyCount = 0;
      const checkStatus = () => {
        if (readyCount >= activeStemsCount) {
          startPlayback();
        }
      };

      Object.values(elements).forEach(audio => {
        audio.oncanplay = () => {
          readyCount++;
          checkStatus();
        };
        if (audio.readyState >= 2) {
          readyCount++;
        }
      });
      checkStatus();
    };

    initAudio();

    return () => {
      // 30곡 이상 전환해도 기기 메모리를 파괴하지 않는 정밀 가비지 컬렉터(Garbage Collector) 청소
      if (audioElementsRef.current) {
        Object.values(audioElementsRef.current).forEach(audio => {
          audio.pause();
          audio.src = ''; // 브라우저 스트리밍 버퍼 즉각 해제
          audio.load();
        });
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close(); // 오디오 맥동 차단 및 소멸
      }
    };
  }, [isAudioActive, stems]);

  const draggingOrbsRef = useRef({});
  const [handInteraction, setHandInteraction] = useState({
    hoveredOrbKey: null,
    grabbedOrbKey: null,
    grabHandId: null,
    mode: 'idle',
    activeHandId: null,
  });

  const handleHandInteractionChange = (interaction) => {
    setHandInteraction(interaction);
    onWebcamInteractionChange?.(interaction);
  };

  // Frame Loop updates: Head/Camera Tracking, 3D Sound Positioning & Sphere Collision
  useFrame((state) => {
    // 0. Sphere Collision & Repulsion: Prevent stars from colliding/merging with each other
    const stemKeys = Object.keys(orbCoordsRef.current);
    const minDistance = STAR_MIN_DISTANCE; // minimum distance between star centers, so two never overlap

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < stemKeys.length; i++) {
        for (let j = i + 1; j < stemKeys.length; j++) {
          const keyA = stemKeys[i];
          const keyB = stemKeys[j];
          const posA = orbCoordsRef.current[keyA];
          const posB = orbCoordsRef.current[keyB];

          if (posA && posB) {
            const dist = posA.distanceTo(posB);
            if (dist < minDistance) {
              const overlap = minDistance - dist;
              let pushDir = new THREE.Vector3().subVectors(posA, posB);

              if (pushDir.lengthSq() < 0.0001) {
                pushDir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
              }
              pushDir.normalize();

              const isDragA = draggingOrbsRef.current[keyA];
              const isDragB = draggingOrbsRef.current[keyB];

              if (isDragA && !isDragB) {
                posB.sub(pushDir.clone().multiplyScalar(overlap));
              } else if (isDragB && !isDragA) {
                posA.add(pushDir.clone().multiplyScalar(overlap));
              } else {
                posA.add(pushDir.clone().multiplyScalar(overlap * 0.5));
                posB.sub(pushDir.clone().multiplyScalar(overlap * 0.5));
              }
            }
          }
        }
      }
    }

    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // Keep the song position current for the galaxy to pick up when we leave.
    // (This scene's cleanup runs on a separate renderer and can fire too late.)
    const leadAudio = Object.values(audioElementsRef.current)[0];
    if (playbackTimeRef && leadAudio && !leadAudio.paused && leadAudio.currentTime > 0) {
      playbackTimeRef.current = leadAudio.currentTime;
    }

    const webAudioTime = ctx.currentTime;

    // 1. Sync Audio Listener with the head's position and orientation (Using setValueAtTime to prevent WebAudio queue accumulation).
    // In a headset the scene camera's own rotation is not reliable, so the head pose is read from the eyes.
    const head = readHeadPose(state, headPose);
    const listener = ctx.listener;
    if (listener.positionX) {
      listener.positionX.setValueAtTime(head.position.x, webAudioTime);
      listener.positionY.setValueAtTime(head.position.y, webAudioTime);
      listener.positionZ.setValueAtTime(head.position.z, webAudioTime);

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(head.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(head.quaternion);

      listener.forwardX.setValueAtTime(forward.x, webAudioTime);
      listener.forwardY.setValueAtTime(forward.y, webAudioTime);
      listener.forwardZ.setValueAtTime(forward.z, webAudioTime);

      listener.upX.setValueAtTime(up.x, webAudioTime);
      listener.upY.setValueAtTime(up.y, webAudioTime);
      listener.upZ.setValueAtTime(up.z, webAudioTime);
    } else {
      listener.setPosition(head.position.x, head.position.y, head.position.z);
    }

    // 2. Loop through all active stems and update their panners & BPM rates! (Dummy 스템 제외)
    stems.forEach(stem => {
      if (!stem.url) return;

      const panner = pannersRef.current[stem.key];
      const pos = orbCoordsRef.current[stem.key];
      const audio = audioElementsRef.current[stem.key];

      if (panner && pos) {
        panner.positionX.setValueAtTime(pos.x, webAudioTime);
        panner.positionY.setValueAtTime(pos.y, webAudioTime);
        panner.positionZ.setValueAtTime(pos.z, webAudioTime);
      }

      if (audio) {
        const isRhythm = ['drum', 'drums', 'bass'].includes(stem.key);
        audio.playbackRate = isRhythm ? rightRateRef.current : leftRateRef.current;
      }

      const gainNode = gainsRef.current[stem.key];
      if (gainNode) {
        gainNode.gain.setValueAtTime(1.5, webAudioTime);
      }
    });
  });

  return (
    <>
      <WebcamGestureController
        handData={handData}
        stems={stems}
        orbCoordsRef={orbCoordsRef}
        draggingOrbsRef={draggingOrbsRef}
        orbitControlsRef={orbitControlsRef}
        onInteractionChange={handleHandInteractionChange}
        setIsDraggingOrb={setIsDraggingOrb}
        visualFrameRef={handVisualFrameRef}
      />
      {stems.map((stem) => (
        <InteractiveOrb
          key={stem.key}
          orbKey={stem.key}
          color={stem.color}
          initialPos={stem.initialPos}
          coordsRef={orbCoordsRef}
          setIsDraggingOrb={setIsDraggingOrb}
          analysersRef={analysersRef}
          draggingOrbsRef={draggingOrbsRef}
          instrument={stem.instrument}
          isHandHovered={handInteraction.hoveredOrbKey === stem.key}
          isHandGrabbed={handInteraction.grabbedOrbKey === stem.key}
        />
      ))}
    </>
  );
}

function CameraRig({ vrCameraPos, vrCameraRot }) {
  const { camera, controls } = useThree();
  useFrame(() => {
    // Only override camera if MIDI controller position is actively offset
    if (vrCameraPos && (vrCameraPos.x !== 0 || vrCameraPos.y !== 0 || vrCameraPos.z !== 0)) {
      const yaw = vrCameraRot?.yaw || 0;
      const pitch = vrCameraRot?.pitch || 0;

      // Calculate 3D target look vector based on Jog Wheel Yaw and Pitch angles
      const lookDistance = 10;
      const targetX = vrCameraPos.x + lookDistance * Math.sin(yaw) * Math.cos(pitch);
      const targetY = vrCameraPos.y + lookDistance * Math.sin(pitch);
      const targetZ = vrCameraPos.z - lookDistance * Math.cos(yaw) * Math.cos(pitch);

      camera.position.set(vrCameraPos.x, vrCameraPos.y, vrCameraPos.z);
      camera.lookAt(targetX, targetY, targetZ);
      
      if (controls) {
        controls.target.set(targetX, targetY, targetZ);
        controls.update();
      }
    }
  });
  return null;
}

// Tells the page when the 3D canvas and its XR connection are up. Asking for a VR
// session before that fails ("not connected to three.js"), and a headset is slow to
// get here. The short delay lets the XR component finish connecting first.
function SceneReadySignal({ onReady }) {
  useEffect(() => {
    const timer = setTimeout(() => onReady(true), 300);
    return () => clearTimeout(timer);
  }, [onReady]);
  return null;
}

export function VRScene({ store, starColors, handData, isInVR, isDesktopVR, activeSong, leftRate, rightRate, activePreset, isAudioActive, vrModeType, playbackTimeRef, vrCameraPos, vrCameraRot, onWebcamInteractionChange, handVisualFrameRef, onSceneReady }) {
  const isVRActive = isInVR || isDesktopVR;
  const [isDraggingOrb, setIsDraggingOrb] = useState(false);
  const orbitControlsRef = useRef(null);

  return (
    <div style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100vw', 
      height: '100vh', 
      pointerEvents: isVRActive ? (isDesktopVR ? 'auto' : 'none') : 'none',
      zIndex: isVRActive ? 1 : -1,
      opacity: isVRActive ? 1 : 0,
      visibility: isVRActive ? 'visible' : 'hidden',
      transition: 'opacity 0.3s ease, visibility 0.3s ease'
    }}>
      <Canvas 
        gl={{ preserveDrawingBuffer: true, powerPreference: 'high-performance', antialias: true }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('WebGL Context Lost - Attempting Restoration...');
          }, false);
        }}
      >
        <XR store={store}>
            {onSceneReady && <SceneReadySignal onReady={onSceneReady} />}
            <CameraRig vrCameraPos={vrCameraPos} vrCameraRot={vrCameraRot} />
            <color attach="background" args={['#07070a']} />
            
            {isVRActive && vrModeType === 2 && <ambientLight intensity={0.5} />}
            
            {/* A plain dark dome (it also blocks WebXR passthrough), and the white graph inside it */}
            <mesh scale={[45, 45, 45]} raycast={() => null}>
              <sphereGeometry args={[1, 32, 32]} />
              <meshBasicMaterial color="#07070a" side={THREE.BackSide} />
            </mesh>
            {isVRActive && vrModeType === 2 && <WhiteGraph />}

            <ControllerHelpers />
            {isDesktopVR && <OrbitControls ref={orbitControlsRef} enabled={!isDraggingOrb} enableZoom={true} enablePan={false} maxDistance={25} minDistance={1} />}

            {/* Premium 3D VR Spatial Audio Experience - ONLY in VR 2 */}
            {isVRActive && vrModeType === 2 && (
              <VRAudioExperience
                starColors={starColors}
                activeSong={activeSong}
                leftRate={leftRate}
                rightRate={rightRate}
                activePreset={activePreset}
                isAudioActive={isAudioActive}
                setIsDraggingOrb={setIsDraggingOrb}
                playbackTimeRef={playbackTimeRef}
                handData={handData}
                orbitControlsRef={orbitControlsRef}
                onWebcamInteractionChange={onWebcamInteractionChange}
                handVisualFrameRef={handVisualFrameRef}
              />
            )}
        </XR>
      </Canvas>
    </div>
  );
}
