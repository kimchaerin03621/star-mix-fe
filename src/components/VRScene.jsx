import React, { useRef, useMemo, useEffect, Suspense, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { XR, IfInSessionMode, useXR } from '@react-three/xr';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// 곡별 멀티트랙 스템 메타데이터 정의
// 보컬(핑크, #ff007f)과 드럼(화이트, #ffffff)만 실제 오디오 파일을 매핑하고,
// 나머지 기타/신스/베이스 등의 테스트 오브들은 회색(#888888) 컬러와 url: null로 셋팅하여
// 음원 로딩 없이 독립적으로 물리적 드래그 조작만 가능하도록 다이내믹 셋팅을 하였습니다.
const songStemsMap = {
  1: [
    { key: 'vocal', name: '🎤 Vocal', color: '#ff007f', url: '/Bohemian Rhapsody/Bohemian Rhapsody_vocal.mp3', initialPos: [-2.2, 1.6, -2.5] },
    { key: 'drum', name: '🥁 Drums', color: '#ffffff', url: '/Bohemian Rhapsody/Bohemian Rhapsody_drum.mp3', initialPos: [2.2, 1.6, -2.5] },
    { key: 'bass', name: '🎸 Bass', color: '#ffcc00', url: '/Bohemian Rhapsody/Bohemian Rhapsody_bass.mp3', initialPos: [-1.5, 1.8, -3.8] },
    { key: 'piano', name: '🎹 Piano', color: '#00ffff', url: '/Bohemian Rhapsody/Bohemian Rhapsody_piano.mp3', initialPos: [1.5, 1.4, -3.8] },
    { key: 'guitar1', name: '🎸 Guitar 1', color: '#7f00ff', url: '/Bohemian Rhapsody/Bohemian Rhapsody_electric guitar1.mp3', initialPos: [-2.5, 1.3, -4.5] },
    { key: 'guitar2', name: '🎸 Guitar 2', color: '#00ff66', url: '/Bohemian Rhapsody/Bohemian Rhapsody_electric guitar2.mp3', initialPos: [2.5, 1.3, -4.5] }
  ],
  2: [
    { key: 'lead_vocal', name: '🎤 Vocal', color: '#ff007f', url: '/Hype Boy/Hype Boy_vocal.mp3', initialPos: [-2.5, 1.6, -2.0] },
    { key: 'drums', name: '🥁 Drums', color: '#ffffff', url: '/Hype Boy/Hype Boy_drum.mp3', initialPos: [2.5, 1.6, -2.0] },
    { key: 'bass', name: '🎸 Bass', color: '#00aaff', url: '/Hype Boy/Hype Boy_bass.mp3', initialPos: [-1.8, 1.4, -3.8] },
    { key: 'piano', name: '🎹 Piano', color: '#ffaa00', url: '/Hype Boy/Hype Boy_piano.mp3', initialPos: [1.8, 1.8, -3.8] }
  ],
  3: [
    { key: 'melody', name: '🎹 Piano', color: '#ff007f', url: '/Kerning City/Kerning City_piano.mp3', initialPos: [-2.0, 1.6, -2.5] },
    { key: 'drum', name: '🥁 Drums', color: '#ffffff', url: '/Kerning City/Kerning City_drum.mp3', initialPos: [2.0, 1.6, -2.5] },
    { key: 'bass', name: '🎸 Bass', color: '#a855f7', url: '/Kerning City/Kerning City_bass.mp3', initialPos: [-1.2, 1.5, -3.2] }
  ]
};

function LoggerComponent() {
  const mode = useXR((state) => state.mode);
  const session = useXR((state) => state.session);
  
  useEffect(() => {
    console.log("XR Mode:", mode, "Session active:", !!session);
  }, [mode, session]);
  
  return null;
}

function Stars3D({ starColors, onStarMixVolumeChange, isVRActive }) {
  const count = 3000;
  const meshRef = useRef();
  
  const texture = useLoader(THREE.TextureLoader, '/star.png');
  
  const [positions, velocities, originals, sides] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const orig = new Float32Array(count * 3);
    const side = new Uint8Array(count);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = 3.5 + Math.random() * 16.5;
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.acos(2 * Math.random() - 1);
      
      pos[i3] = radius * Math.sin(theta) * Math.cos(phi);
      pos[i3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
      pos[i3 + 2] = radius * Math.cos(theta);
      
      orig[i3] = pos[i3];
      orig[i3 + 1] = pos[i3 + 1];
      orig[i3 + 2] = pos[i3 + 2];
      
      vel[i3] = 0;
      vel[i3 + 1] = 0;
      vel[i3 + 2] = 0;
      
      side[i] = pos[i3] < 0 ? 0 : 1;
    }
    return [pos, vel, orig, side];
  }, []);

  const colors = useMemo(() => {
    const col = new Float32Array(count * 3);
    const leftColor = new THREE.Color(starColors?.left || '#ff007f');
    const rightColor = new THREE.Color(starColors?.right || '#ffffff');
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const color = sides[i] === 0 ? leftColor : rightColor;
      col[i3] = color.r;
      col[i3 + 1] = color.g;
      col[i3 + 2] = color.b;
    }
    return col;
  }, [starColors, sides]);

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.geometry.attributes.color.needsUpdate = true;
    }
  }, [colors]);
  
  const isMouseDown = useRef(false);
  const mouseScreenPos = useRef({ x: 0, y: 0 });
  const prevRayDirs = useRef([new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -1)]);
  const prevMouseRayDir = useRef(new THREE.Vector3(0, 0, -1));
  
  useEffect(() => {
    const onDown = () => { isMouseDown.current = true; };
    const onUp = () => { isMouseDown.current = false; };
    const onMove = (e) => {
      mouseScreenPos.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseScreenPos.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);
  
  useFrame((state, delta) => {
    const geom = meshRef.current.geometry;
    const posAttr = geom.attributes.position;
    
    let pointerRays = [];
    
    const xr = state.gl.xr;

    if (xr && xr.isPresenting) {
      for (let i = 0; i < 2; i++) {
        const ctrl = xr.getController(i);
        if (ctrl && ctrl.visible) {
          const rayOrigin = new THREE.Vector3();
          ctrl.getWorldPosition(rayOrigin);
          
          const worldQuat = new THREE.Quaternion();
          ctrl.getWorldQuaternion(worldQuat);
          const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat).normalize();
          
          // Calculate ray sweep speed
          const prevDir = prevRayDirs.current[i];
          const sweepDist = rayDir.distanceTo(prevDir);
          const sweepSpeed = sweepDist / Math.max(delta, 0.001);
          prevRayDirs.current[i].copy(rayDir);
          
          pointerRays.push({
            origin: rayOrigin,
            dir: rayDir,
            speed: sweepSpeed
          });
        }
      }
    }
    
    // Desktop mouse pointer ray (always active on mouse move or drag)
    const mouseRayOrigin = state.camera.position.clone();
    const mouse3D = new THREE.Vector3(mouseScreenPos.current.x, mouseScreenPos.current.y, 0.5);
    mouse3D.unproject(state.camera);
    const mouseRayDir = mouse3D.sub(state.camera.position).normalize();
    
    const mouseSweepDist = mouseRayDir.distanceTo(prevMouseRayDir.current);
    const mouseSweepSpeed = mouseSweepDist / Math.max(delta, 0.001);
    prevMouseRayDir.current.copy(mouseRayDir);
    
    pointerRays.push({
      origin: mouseRayOrigin,
      dir: mouseRayDir,
      speed: mouseSweepSpeed
    });
    
    // Process pointer rays: affect stars in the path of the pointer ray beam
    pointerRays.forEach(({ origin, dir, speed }) => {
      const oX = origin.x;
      const oY = origin.y;
      const oZ = origin.z;
      
      const dX = dir.x;
      const dY = dir.y;
      const dZ = dir.z;
      
      // Pointer ray beam radius & speed multiplier
      const baseBeamRadius = 2.5;
      const beamRadius = baseBeamRadius + Math.min(speed * 0.4, 2.5);
      const speedMultiplier = 1.0 + Math.min(speed * 0.6, 3.0);

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const sX = posAttr.array[i3];
        const sY = posAttr.array[i3 + 1];
        const sZ = posAttr.array[i3 + 2];
        
        // Vector from ray origin to star particle
        const vX = sX - oX;
        const vY = sY - oY;
        const vZ = sZ - oZ;
        
        // Distance along pointer ray
        const t = vX * dX + vY * dY + vZ * dZ;
        
        // Only affect stars in front along the pointer ray beam (between 0.5m and 35m)
        if (t > 0.5 && t < 35.0) {
          // Point on ray line nearest to star
          const nX = oX + t * dX;
          const nY = oY + t * dY;
          const nZ = oZ + t * dZ;
          
          // Perpendicular vector from ray line to star
          const perpX = sX - nX;
          const perpY = sY - nY;
          const perpZ = sZ - nZ;
          const perpDist = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);
          
          if (perpDist < beamRadius) {
            const forceFactor = 1 - (perpDist / beamRadius);
            
            // Push star outward from the ray axis
            const pushX = perpX / (perpDist || 1);
            const pushY = perpY / (perpDist || 1);
            const pushZ = perpZ / (perpDist || 1);
            
            const forceMagnitude = forceFactor * 0.3 * speedMultiplier;
            
            velocities[i3]     += pushX * forceMagnitude;
            velocities[i3 + 1] += pushY * forceMagnitude;
            velocities[i3 + 2] += pushZ * forceMagnitude;
          }
        }
      }
    });
    
    // Physics update: spring return to original space positions & velocity damping
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      
      const springPower = 0.0003;
      velocities[i3] += (originals[i3] - posAttr.array[i3]) * springPower;
      velocities[i3 + 1] += (originals[i3 + 1] - posAttr.array[i3 + 1]) * springPower;
      velocities[i3 + 2] += (originals[i3 + 2] - posAttr.array[i3 + 2]) * springPower;
      
      posAttr.array[i3] += velocities[i3];
      posAttr.array[i3 + 1] += velocities[i3 + 1];
      posAttr.array[i3 + 2] += velocities[i3 + 2];
      
      velocities[i3] *= 0.95;
      velocities[i3 + 1] *= 0.95;
      velocities[i3 + 2] *= 0.95;
    }
    
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.2} 
        vertexColors={true} 
        sizeAttenuation={true}
        transparent={true}
        opacity={0.8}
        map={texture}
        alphaTest={0.01}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}


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

// 3D Interactive Audio Orb
function InteractiveOrb({ color, initialPos, orbKey, coordsRef, setIsDraggingOrb, analysersRef, draggingOrbsRef }) {
  const meshRef = useRef();
  const waveRef1 = useRef();
  const waveRef2 = useRef();
  const waveRef3 = useRef();
  const waveTimeRef = useRef(0);
  
  const [isDragging, setIsDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { camera, raycaster, gl } = useThree();
  
  // Track dragging distance and active grabbing controller (0, 1, or 'mouse')
  const dragDistanceRef = useRef(2.5);
  const activeControllerRef = useRef(null);
  const isHoveredRef = useRef(false);

  // Sync drag state to parent collision manager
  useEffect(() => {
    if (draggingOrbsRef && draggingOrbsRef.current) {
      draggingOrbsRef.current[orbKey] = isDragging;
    }
  }, [isDragging, orbKey, draggingOrbsRef]);

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
      dragDistanceRef.current += e.deltaY * -0.003;
      dragDistanceRef.current = Math.max(0.5, Math.min(10.0, dragDistanceRef.current));
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [isDragging]);

  const handlePointerDown = (e) => {
    e.stopPropagation();
    if (e.target && typeof e.target.setPointerCapture === 'function' && e.pointerId) {
      try { e.target.setPointerCapture(e.pointerId); } catch(err) {}
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
      const dist = raycaster.ray.origin.distanceTo(meshRef.current.position);
      dragDistanceRef.current = Math.max(0.5, Math.min(10.0, dist));
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
  useFrame((state) => {
    const xr = state.gl.xr;

    // 0. Audio Analyser Pulse Effect
    let currentVol = 0;

    if (meshRef.current && analysersRef && analysersRef.current && analysersRef.current[orbKey]) {
      const analyser = analysersRef.current[orbKey];
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avg = sum / (bufferLength || 1);
      currentVol = Math.pow(avg / 255, 1.2);

      const baseScale = hovered ? 1.25 : 1.0;
      const pulseScale = baseScale + currentVol * 0.95;
      meshRef.current.scale.set(pulseScale, pulseScale, pulseScale);

      if (meshRef.current.material) {
        meshRef.current.material.emissiveIntensity = hovered ? 2.5 : 1.2;
      }
    } else if (meshRef.current) {
      const baseScale = hovered ? 1.25 : 1.0;
      meshRef.current.scale.set(baseScale, baseScale, baseScale);
      if (meshRef.current.material) {
        meshRef.current.material.emissiveIntensity = hovered ? 2.5 : 1.2;
      }
    }

    // Concentric Ripple Wave animation
    const waveSpeed = 0.007 * (1.0 + currentVol * 2.5);
    waveTimeRef.current += waveSpeed;

    const waveRings = [
      { ref: waveRef1, offset: 0.0 },
      { ref: waveRef2, offset: 0.33 },
      { ref: waveRef3, offset: 0.66 }
    ];

    waveRings.forEach(({ ref, offset }) => {
      if (ref.current && ref.current.material) {
        ref.current.quaternion.copy(state.camera.quaternion);
        const rawProgress = (waveTimeRef.current + offset) % 1.0;
        const scaleVal = 1.0 + rawProgress * 3.2;
        ref.current.scale.set(scaleVal, scaleVal, scaleVal);
        const baseOpacity = 0.05 + currentVol * 0.65;
        const opacityVal = Math.max(0, baseOpacity * (1.0 - rawProgress) * Math.sin(rawProgress * Math.PI));
        ref.current.material.opacity = currentVol > 0.02 ? opacityVal : 0;
      }
    });

    // VR Ray Pointer & Proximity Detection, Hover Feedback, and Auto-Grab (60/90fps frame loop)
    if (xr && xr.isPresenting && meshRef.current) {
      const session = (typeof xr.getSession === 'function') ? xr.getSession() : null;
      const orbPos = meshRef.current.position;
      let isAnyCtrlHovering = false;

      for (let i = 0; i < 2; i++) {
        const ctrl = xr.getController(i);
        if (ctrl && ctrl.visible) {
          const rayOrigin = new THREE.Vector3();
          ctrl.getWorldPosition(rayOrigin);

          const worldQuat = new THREE.Quaternion();
          ctrl.getWorldQuaternion(worldQuat);
          const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat).normalize();

          const v = new THREE.Vector3().subVectors(orbPos, rayOrigin);
          const t = v.dot(rayDir);
          const distToCtrl = rayOrigin.distanceTo(orbPos);

          let isTargeted = false;
          let grabDistance = 2.5;

          if (t > 0.1 && t < 15.0) {
            const nearestPointOnRay = rayOrigin.clone().add(rayDir.clone().multiplyScalar(t));
            const perpDist = orbPos.distanceTo(nearestPointOnRay);
            
            // Distance-Adaptive Ray Cone (#1): rayTolerance expands with distance t for easy targeting at any range
            const rayTolerance = Math.max(0.65, t * 0.15 + 0.5);
            if (perpDist < rayTolerance) {
              isTargeted = true;
              grabDistance = Math.max(0.4, t);
            }
          }

          // Physical touch proximity: within 0.6m of controller position
          if (distToCtrl < 0.6) {
            isTargeted = true;
            grabDistance = Math.max(0.3, distToCtrl);
          }

          if (isTargeted) {
            isAnyCtrlHovering = true;

            if (!isDragging) {
              let isButtonPressed = false;
              if (session && session.inputSources) {
                // WebXR Input Source 1:1 Precision Mapping (#2): Match by index or handedness
                const targetSource = session.inputSources.find((src, idx) => idx === i || (i === 0 && src.handedness === 'right') || (i === 1 && src.handedness === 'left'));
                const sourceToUse = targetSource || session.inputSources[i];
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
      // Synchronize mesh & wave ring positions with collision-resolved coordsRef
      if (meshRef.current && coordsRef.current && coordsRef.current[orbKey]) {
        const solvedPos = coordsRef.current[orbKey];
        meshRef.current.position.copy(solvedPos);
        if (waveRef1.current) waveRef1.current.position.copy(solvedPos);
        if (waveRef2.current) waveRef2.current.position.copy(solvedPos);
        if (waveRef3.current) waveRef3.current.position.copy(solvedPos);
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
        const targetSource = session.inputSources.find((src, i) => i === idx || (idx === 0 && src.handedness === 'right') || (idx === 1 && src.handedness === 'left'));
        const sourceToUse = targetSource || session.inputSources[idx];
        if (sourceToUse && sourceToUse.gamepad && sourceToUse.gamepad.buttons) {
          const btn0 = sourceToUse.gamepad.buttons[0];
          const btn1 = sourceToUse.gamepad.buttons[1];
          const pressed0 = btn0 ? (btn0.pressed || btn0.value > 0.15) : false;
          const pressed1 = btn1 ? (btn1.pressed || btn1.value > 0.15) : false;

          if (!pressed0 && !pressed1) {
            setIsDragging(false);
            setIsDraggingOrb(false);
            return;
          }

          // Joystick Y axis adjusts depth distance along pointer ray
          if (sourceToUse.gamepad.axes && Math.abs(sourceToUse.gamepad.axes[1]) > 0.1) {
            dragDistanceRef.current += sourceToUse.gamepad.axes[1] * -0.06;
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

        if (waveRef1.current) waveRef1.current.position.copy(targetPos);
        if (waveRef2.current) waveRef2.current.position.copy(targetPos);
        if (waveRef3.current) waveRef3.current.position.copy(targetPos);
      }
    } else if (meshRef.current) {
      // Desktop Mouse Ray Position Update
      const targetPoint = new THREE.Vector3();
      raycaster.ray.at(dragDistanceRef.current, targetPoint);

      const center = state.camera.position.clone();
      const dirToTarget = new THREE.Vector3().subVectors(targetPoint, center);
      const distToTarget = dirToTarget.length();

      const clampedDist = Math.max(0.5, Math.min(10.0, distToTarget));
      dirToTarget.normalize().multiplyScalar(clampedDist);

      const nextPoint = new THREE.Vector3().addVectors(center, dirToTarget);

      meshRef.current.position.copy(nextPoint);
      coordsRef.current[orbKey].copy(nextPoint);

      if (waveRef1.current) waveRef1.current.position.copy(nextPoint);
      if (waveRef2.current) waveRef2.current.position.copy(nextPoint);
      if (waveRef3.current) waveRef3.current.position.copy(nextPoint);
    }
  });

  return (
    <group>
      {/* Concentric Billboarded Ripple Wave Rings (3 layers with rich thickness) */}
      <mesh ref={waveRef1} position={initialPos}>
        <ringGeometry args={[0.25, 0.28, 48]} />
        <meshBasicMaterial
          color={color}
          transparent={true}
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={waveRef2} position={initialPos}>
        <ringGeometry args={[0.25, 0.28, 48]} />
        <meshBasicMaterial
          color={color}
          transparent={true}
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={waveRef3} position={initialPos}>
        <ringGeometry args={[0.25, 0.28, 48]} />
        <meshBasicMaterial
          color={color}
          transparent={true}
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        ref={meshRef}
        position={initialPos}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
      >
        <sphereGeometry args={[0.25, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>
      {/* Dynamic point light to illuminate surrounding stars */}
      <pointLight position={initialPos} color={color} intensity={hovered ? 4.0 : 2.5} distance={8} decay={1.5} />
    </group>
  );
}

// 3D VR Spatial Audio Experience (다이내믹 멀티트랙 스템 믹서 엔진)
function VRAudioExperience({ starColors, activeSong, leftRate, rightRate, activePreset, isAudioActive, setIsDraggingOrb, onNextSong }) {
  const audioCtxRef = useRef(null);
  const audioElementsRef = useRef({});
  const pannersRef = useRef({});
  const gainsRef = useRef({});
  const analysersRef = useRef({});
  const eqFiltersRef = useRef({ low: null, mid: null, high: null });
  const masterFilterRef = useRef(null);

  // Keyboard 'N' shortcut for fast desktop testing & fallback
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'n' || e.key === 'N') {
        console.log("Keyboard 'N' pressed -> Next Song!");
        if (onNextSong) onNextSong();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onNextSong]);

  // Sync refs to avoid canvas render loop teardown and layout reflow on every frame
  const leftRateRef = useRef(leftRate);
  const rightRateRef = useRef(rightRate);
  const activePresetRef = useRef(activePreset);
  useEffect(() => { leftRateRef.current = leftRate; }, [leftRate]);
  useEffect(() => { rightRateRef.current = rightRate; }, [rightRate]);
  useEffect(() => { activePresetRef.current = activePreset; }, [activePreset]);

  // 활성 곡에 따른 멀티트랙 스템 정보 동적 취득
  const stems = useMemo(() => songStemsMap[activeSong] || songStemsMap[1], [activeSong]);

  // 스템별 3D 좌표를 60fps 추적이 가능한 useRef 좌표계 사전에 동적 적재
  const orbCoordsRef = useRef({});
  useEffect(() => {
    stems.forEach(stem => {
      if (!orbCoordsRef.current[stem.key]) {
        orbCoordsRef.current[stem.key] = new THREE.Vector3(...stem.initialPos);
      }
    });
  }, [stems]);

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
      compressor.connect(ctx.destination);
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
        
        const source = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();
        gain.gain.value = 1.0;

        // Create AnalyserNode for dynamic waveform pulse effect!
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;

        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF'; // Web Audio API HRTF (Binaural 3D Spatial Audio)
        panner.distanceModel = 'inverse';
        panner.refDistance = 1.5; // Decreased from 4.0 so approaching a star makes its sound distinct & clear
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
              audio.play().catch(err => {
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

  const wasAPressedRef = useRef(false);
  const draggingOrbsRef = useRef({});

  // Frame Loop updates: Head/Camera Tracking, 3D Sound Positioning & Sphere Collision
  useFrame((state) => {
    // 0. VR Controller A/X (Primary Button) check
    const xr = state.gl.xr;
    let aPressedThisFrame = false;
    if (xr && xr.isPresenting) {
      const session = xr.getSession();
      if (session) {
        for (const source of session.inputSources) {
          if (source.gamepad) {
            // buttons[0] is A (right) or X (left) or primary trigger in standard maps
            const buttonA = source.gamepad.buttons[0];
            if (buttonA && buttonA.pressed) {
              aPressedThisFrame = true;
            }
          }
        }
      }
    }
    
    if (aPressedThisFrame && !wasAPressedRef.current) {
      console.log("VR Controller A/X button clicked -> Next Song!");
      if (onNextSong) onNextSong();
    }
    wasAPressedRef.current = aPressedThisFrame;

    // 0.5 Sphere Collision & Repulsion: Prevent stars from colliding/merging with each other
    const stemKeys = Object.keys(orbCoordsRef.current);
    const minDistance = 0.75; // 0.75m minimum distance between star centers to prevent overlap

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

    const camera = state.camera;
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const webAudioTime = ctx.currentTime;

    // 1. Sync Audio Listener with VR Camera position and orientation (Using setValueAtTime to prevent WebAudio queue accumulation)
    const listener = ctx.listener;
    if (listener.positionX) {
      listener.positionX.setValueAtTime(camera.position.x, webAudioTime);
      listener.positionY.setValueAtTime(camera.position.y, webAudioTime);
      listener.positionZ.setValueAtTime(camera.position.z, webAudioTime);

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

      listener.forwardX.setValueAtTime(forward.x, webAudioTime);
      listener.forwardY.setValueAtTime(forward.y, webAudioTime);
      listener.forwardZ.setValueAtTime(forward.z, webAudioTime);

      listener.upX.setValueAtTime(up.x, webAudioTime);
      listener.upY.setValueAtTime(up.y, webAudioTime);
      listener.upZ.setValueAtTime(up.z, webAudioTime);
    } else {
      listener.setPosition(camera.position.x, camera.position.y, camera.position.z);
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
      {/* 5개든 6개든 배열 리스트만큼 3D 사운드 오브를 무제한 자동 스폰 */}
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

export function VRScene({ store, starColors, isVRTest, isInVR, isDesktopVR, activeSong, leftRate, rightRate, activePreset, isAudioActive, vrModeType, onNextSong, vrCameraPos, vrCameraRot, onStarMixVolumeChange }) {
  const isVRActive = isInVR || isDesktopVR;
  const [isDraggingOrb, setIsDraggingOrb] = useState(false);

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
      <Canvas>
        <XR store={store}>
          <LoggerComponent />
            <CameraRig vrCameraPos={vrCameraPos} vrCameraRot={vrCameraRot} />
            <color attach="background" args={['#111111']} />
            
            {/* 3D Origin Axes Helper (Red: X, Green: Y, Blue: Z) */}
            <axesHelper args={[6]} />
            {isVRActive && vrModeType === 2 && <ambientLight intensity={0.5} />}
            
            {/* Giant black sphere to block WebXR passthrough - Raycast disabled */}
            <mesh scale={[50, 50, 50]} raycast={() => null}>
              <sphereGeometry args={[1, 32, 32]} />
              <meshBasicMaterial color="#111111" side={THREE.BackSide} />
            </mesh>
            
            <Suspense fallback={<mesh position={[0, 1.6, -2]}><boxGeometry args={[0.2, 0.2, 0.2]} /><meshBasicMaterial color="red" /></mesh>}>
              <Stars3D starColors={starColors} onStarMixVolumeChange={onStarMixVolumeChange} isVRActive={isVRActive} />
            </Suspense>
            
            <ControllerHelpers />
            {isDesktopVR && <OrbitControls enabled={!isDraggingOrb} enableZoom={true} enablePan={false} maxDistance={25} minDistance={1} />}

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
                onNextSong={onNextSong}
              />
            )}
        </XR>
      </Canvas>
    </div>
  );
}
