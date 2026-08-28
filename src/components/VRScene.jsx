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
    { key: 'vocal', name: '🎤 Vocal', color: '#e07a9e', url: '/Bohemian Rhapsody/Bohemian Rhapsody_vocal.mp3', initialPos: [0.0, 1.6, -3.2] },
    { key: 'drum', name: '🥁 Drums', color: '#e6e6e6', url: '/Bohemian Rhapsody/Bohemian Rhapsody_drum.mp3', initialPos: [0.0, 1.6, -6.5] },
    { key: 'bass', name: '🎸 Bass', color: '#d4a843', url: '/Bohemian Rhapsody/Bohemian Rhapsody_bass.mp3', initialPos: [-5.2, 1.6, -4.8] },
    { key: 'piano', name: '🎹 Piano', color: '#58b5b5', url: '/Bohemian Rhapsody/Bohemian Rhapsody_piano.mp3', initialPos: [5.2, 1.6, -4.8] },
    { key: 'guitar1', name: '🎸 Guitar 1', color: '#8d6fb3', url: '/Bohemian Rhapsody/Bohemian Rhapsody_electric guitar1.mp3', initialPos: [-9.2, 1.6, -5.8] },
    { key: 'guitar2', name: '🎸 Guitar 2', color: '#58ab75', url: '/Bohemian Rhapsody/Bohemian Rhapsody_electric guitar2.mp3', initialPos: [9.2, 1.6, -5.8] }
  ],
  2: [
    { key: 'lead_vocal', name: '🎤 Vocal', color: '#e07a9e', url: '/Hype Boy/Hype Boy_vocal.mp3', initialPos: [0.0, 1.6, -3.2] },
    { key: 'drums', name: '🥁 Drums', color: '#e6e6e6', url: '/Hype Boy/Hype Boy_drum.mp3', initialPos: [0.0, 1.6, -6.5] },
    { key: 'bass', name: '🎸 Bass', color: '#599ec7', url: '/Hype Boy/Hype Boy_bass.mp3', initialPos: [-5.2, 1.6, -4.8] },
    { key: 'piano', name: '🎹 Piano', color: '#c99344', url: '/Hype Boy/Hype Boy_piano.mp3', initialPos: [5.2, 1.6, -4.8] }
  ],
  3: [
    { key: 'melody', name: '🎹 Piano', color: '#e07a9e', url: '/Kerning City/Kerning City_piano.mp3', initialPos: [5.2, 1.6, -4.8] },
    { key: 'drum', name: '🥁 Drums', color: '#e6e6e6', url: '/Kerning City/Kerning City_drum.mp3', initialPos: [0.0, 1.6, -6.5] },
    { key: 'bass', name: '🎸 Bass', color: '#9662c4', url: '/Kerning City/Kerning City_bass.mp3', initialPos: [-5.2, 1.6, -4.8] }
  ]
};

// --- 3D COSMIC CONCERT HALL STAGE & INSTRUMENT MODELS ---

// 1. 3D Drum Kit Model (Placed on elevated drum riser back center)
function DrumKitModel({ position = [0, 0.4, -6.5] }) {
  return (
    <group position={position} raycast={() => null}>
      {/* Bass Drum (Kick) */}
      <group position={[0, 0.55, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.65, 32]} />
          <meshStandardMaterial color="#1a1a24" roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Front & Back Drum Hoops */}
        <mesh position={[0, 0, 0.33]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.56, 0.03, 16, 32]} />
          <meshStandardMaterial color="#ff007f" emissive="#ff007f" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, 0, -0.33]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.56, 0.03, 16, 32]} />
          <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={0.6} />
        </mesh>
        {/* Glowing Logo Front Drumhead */}
        <mesh position={[0, 0, 0.33]}>
          <circleGeometry args={[0.54, 32]} />
          <meshStandardMaterial color="#0a0a14" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.34]}>
          <ringGeometry args={[0.2, 0.25, 32]} />
          <meshBasicMaterial color="#00ffcc" />
        </mesh>
      </group>

      {/* Snare Drum & Stand */}
      <group position={[-0.55, 0.5, 0.3]}>
        {/* Stand Leg */}
        <mesh position={[0, -0.25, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.5, 8]} />
          <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Snare Body */}
        <mesh>
          <cylinderGeometry args={[0.3, 0.3, 0.2, 24]} />
          <meshStandardMaterial color="#e6e6e6" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.105, 0]}>
          <circleGeometry args={[0.3, 24]} />
          <meshStandardMaterial color="#ffffff" roughness={0.6} />
        </mesh>
      </group>

      {/* Mounted Tom-Toms */}
      <group position={[-0.3, 1.15, -0.1]} rotation={[0.2, 0, -0.15]}>
        <mesh>
          <cylinderGeometry args={[0.26, 0.26, 0.24, 24]} />
          <meshStandardMaterial color="#222233" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <torusGeometry args={[0.265, 0.015, 12, 24]} />
          <meshStandardMaterial color="#ff007f" emissive="#ff007f" emissiveIntensity={0.5} />
        </mesh>
      </group>
      <group position={[0.3, 1.15, -0.1]} rotation={[0.2, 0, 0.15]}>
        <mesh>
          <cylinderGeometry args={[0.28, 0.28, 0.26, 24]} />
          <meshStandardMaterial color="#222233" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <torusGeometry args={[0.285, 0.015, 12, 24]} />
          <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* Floor Tom */}
      <group position={[0.75, 0.45, 0.2]}>
        <mesh>
          <cylinderGeometry args={[0.36, 0.36, 0.45, 24]} />
          <meshStandardMaterial color="#1a1a24" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* Hi-Hat Cymbal & Stand */}
      <group position={[-0.9, 0.85, 0.4]}>
        {/* Chrome Shaft */}
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 1.1, 8]} />
          <meshStandardMaterial color="#dddddd" metalness={0.95} roughness={0.1} />
        </mesh>
        {/* Top Cymbal */}
        <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.28, 0.04, 32]} />
          <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.2} emissive="#ffaa00" emissiveIntensity={0.2} />
        </mesh>
        {/* Bottom Cymbal */}
        <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.28, 0.04, 32]} />
          <meshStandardMaterial color="#cca000" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Crash Cymbal Left */}
      <group position={[-1.15, 1.25, -0.2]}>
        <mesh position={[0, -0.5, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 1.5, 8]} />
          <meshStandardMaterial color="#dddddd" metalness={0.95} roughness={0.1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2 + 0.15, 0, 0]}>
          <coneGeometry args={[0.42, 0.05, 32]} />
          <meshStandardMaterial color="#ffe066" metalness={0.9} roughness={0.2} emissive="#ffaa00" emissiveIntensity={0.3} />
        </mesh>
      </group>

      {/* Ride Cymbal Right */}
      <group position={[1.15, 1.3, -0.2]}>
        <mesh position={[0, -0.5, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 1.6, 8]} />
          <meshStandardMaterial color="#dddddd" metalness={0.95} roughness={0.1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2 - 0.15, 0, 0]}>
          <coneGeometry args={[0.48, 0.05, 32]} />
          <meshStandardMaterial color="#ffe066" metalness={0.9} roughness={0.2} emissive="#00ffcc" emissiveIntensity={0.3} />
        </mesh>
      </group>

      {/* Drum Stool (Throne) */}
      <group position={[0, 0.45, 0.8]}>
        <mesh position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
          <meshStandardMaterial color="#888888" metalness={0.9} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.26, 0.26, 0.08, 24]} />
          <meshStandardMaterial color="#ff0055" roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

// 2. 3D Piano & Synthesizer Model
function PianoModel({ position = [2.8, 0.2, -4.8], rotation = [0, -0.4, 0] }) {
  return (
    <group position={position} rotation={rotation} raycast={() => null}>
      {/* Keyboard Main Body */}
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[1.8, 0.18, 0.65]} />
        <meshStandardMaterial color="#12121c" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Neon Trim Lines around Body */}
      <mesh position={[0, 0.85, 0.33]}>
        <boxGeometry args={[1.82, 0.03, 0.02]} />
        <meshBasicMaterial color="#58b5b5" />
      </mesh>

      {/* Keyboard Keys (White & Black Key Beds) */}
      <group position={[0, 0.95, 0.18]}>
        <mesh>
          <boxGeometry args={[1.6, 0.02, 0.24]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} />
        </mesh>
        {/* Black Keys Row overlay */}
        <mesh position={[0, 0.02, -0.05]}>
          <boxGeometry args={[1.5, 0.025, 0.12]} />
          <meshStandardMaterial color="#111111" roughness={0.3} />
        </mesh>
      </group>

      {/* Synthesizer Display Screen & Knobs */}
      <group position={[0, 0.98, -0.15]}>
        <mesh rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[0.5, 0.02, 0.18]} />
          <meshBasicMaterial color="#00ffcc" />
        </mesh>
      </group>

      {/* Sleek Metallic X-Stand */}
      <group position={[0, 0.42, 0]}>
        <mesh rotation={[0, 0, 0.4]}>
          <cylinderGeometry args={[0.02, 0.02, 1.1, 12]} />
          <meshStandardMaterial color="#666677" metalness={0.9} />
        </mesh>
        <mesh rotation={[0, 0, -0.4]}>
          <cylinderGeometry args={[0.02, 0.02, 1.1, 12]} />
          <meshStandardMaterial color="#666677" metalness={0.9} />
        </mesh>
      </group>

      {/* Piano Bench Stool */}
      <group position={[0, 0.4, 0.65]}>
        <mesh>
          <boxGeometry args={[0.9, 0.08, 0.38]} />
          <meshStandardMaterial color="#1a1a26" roughness={0.4} />
        </mesh>
        <mesh position={[-0.38, -0.2, -0.14]}>
          <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
          <meshStandardMaterial color="#444" metalness={0.8} />
        </mesh>
        <mesh position={[0.38, -0.2, -0.14]}>
          <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
          <meshStandardMaterial color="#444" metalness={0.8} />
        </mesh>
        <mesh position={[-0.38, -0.2, 0.14]}>
          <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
          <meshStandardMaterial color="#444" metalness={0.8} />
        </mesh>
        <mesh position={[0.38, -0.2, 0.14]}>
          <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
          <meshStandardMaterial color="#444" metalness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

// 3. 3D Vocal Mic & Stand Model
function VocalMicModel({ position = [0, 0.2, -3.2] }) {
  return (
    <group position={position} raycast={() => null}>
      {/* Heavy Base Plate */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.22, 0.25, 0.04, 32]} />
        <meshStandardMaterial color="#1c1c28" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <torusGeometry args={[0.23, 0.015, 12, 32]} />
        <meshBasicMaterial color="#ff007f" />
      </mesh>

      {/* Chrome Vertical Shaft */}
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.015, 0.018, 1.25, 16]} />
        <meshStandardMaterial color="#e0e0e0" metalness={0.95} roughness={0.1} />
      </mesh>

      {/* Boom Joint & Mic Head */}
      <group position={[0, 1.3, 0]}>
        {/* Shock Mount Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.08, 0.01, 12, 24]} />
          <meshStandardMaterial color="#ff007f" metalness={0.7} />
        </mesh>
        {/* Studio Condenser Mic Body */}
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.16, 20]} />
          <meshStandardMaterial color="#222233" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Metallic Mesh Capsule Top */}
        <mesh position={[0, 0.16, 0]}>
          <sphereGeometry args={[0.038, 20, 20]} />
          <meshStandardMaterial color="#dddddd" metalness={0.95} roughness={0.1} emissive="#e07a9e" emissiveIntensity={0.4} />
        </mesh>
        {/* Pop Filter Disc */}
        <mesh position={[0, 0.12, 0.1]} rotation={[0, 0, 0]}>
          <ringGeometry args={[0.06, 0.075, 24]} />
          <meshStandardMaterial color="#111" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

// 4. 3D Bass & Electric Guitar + Amplifier Stack Model
function GuitarAmpModel({ position, rotation = [0, 0, 0], accentColor = "#d4a843", isBass = false }) {
  return (
    <group position={position} rotation={rotation} raycast={() => null}>
      {/* Bass / Guitar Amplifier Cabinet */}
      <group position={[0.6, 0.5, -0.2]}>
        <mesh>
          <boxGeometry args={[0.75, 0.95, 0.45]} />
          <meshStandardMaterial color="#14141e" roughness={0.4} metalness={0.6} />
        </mesh>
        {/* Front Grille Cloth */}
        <mesh position={[0, 0.02, 0.23]}>
          <planeGeometry args={[0.66, 0.72]} />
          <meshStandardMaterial color="#282836" roughness={0.8} />
        </mesh>
        {/* Speaker Cones inside Grille */}
        <mesh position={[-0.16, 0.18, 0.235]}>
          <circleGeometry args={[0.13, 24]} />
          <meshBasicMaterial color="#0a0a0f" />
        </mesh>
        <mesh position={[0.16, 0.18, 0.235]}>
          <circleGeometry args={[0.13, 24]} />
          <meshBasicMaterial color="#0a0a0f" />
        </mesh>
        <mesh position={[-0.16, -0.18, 0.235]}>
          <circleGeometry args={[0.13, 24]} />
          <meshBasicMaterial color="#0a0a0f" />
        </mesh>
        <mesh position={[0.16, -0.18, 0.235]}>
          <circleGeometry args={[0.13, 24]} />
          <meshBasicMaterial color="#0a0a0f" />
        </mesh>
        {/* Control Panel LED Line */}
        <mesh position={[0, 0.42, 0.23]}>
          <planeGeometry args={[0.66, 0.06]} />
          <meshBasicMaterial color={accentColor} />
        </mesh>
      </group>

      {/* Guitar Floor Stand */}
      <group position={[-0.3, 0.25, 0]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.5, 8]} />
          <meshStandardMaterial color="#444" metalness={0.8} />
        </mesh>
        {/* Instrument Body on Stand */}
        <group position={[0, 0.5, 0]} rotation={[0.15, 0.2, -0.1]}>
          {/* Guitar Body */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.34, 0.52, 0.08]} />
            <meshStandardMaterial color={accentColor} metalness={0.5} roughness={0.2} />
          </mesh>
          {/* Pickguard */}
          <mesh position={[0.02, -0.02, 0.042]}>
            <planeGeometry args={[0.22, 0.32]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
          {/* Neck */}
          <mesh position={[0, 0.55, 0]}>
            <boxGeometry args={[0.06, 0.65, 0.04]} />
            <meshStandardMaterial color="#d2b48c" roughness={0.4} />
          </mesh>
          {/* Fretboard */}
          <mesh position={[0, 0.55, 0.022]}>
            <planeGeometry args={[0.055, 0.64]} />
            <meshStandardMaterial color="#2b1d0c" roughness={0.6} />
          </mesh>
          {/* Headstock */}
          <mesh position={[0, 0.92, 0]}>
            <boxGeometry args={[0.09, 0.16, 0.04]} />
            <meshStandardMaterial color={accentColor} metalness={0.5} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// 5. All Stage 3D Instruments Container
function CosmicInstruments() {
  return (
    <group>
      <DrumKitModel position={[0, 0.4, -6.5]} />
      <PianoModel position={[5.2, 0.2, -4.8]} rotation={[0, -0.4, 0]} />
      <VocalMicModel position={[0, 0.2, -3.2]} />
      <GuitarAmpModel position={[-5.2, 0.2, -4.8]} rotation={[0, 0.45, 0]} accentColor="#d4a843" isBass={true} />
      <GuitarAmpModel position={[-9.2, 0.2, -5.8]} rotation={[0, 0.65, 0]} accentColor="#8d6fb3" />
      <GuitarAmpModel position={[9.2, 0.2, -5.8]} rotation={[0, -0.65, 0]} accentColor="#58ab75" />
    </group>
  );
}

// 6. 3D Cosmic Stage Platform Component (Doubled Stage Width)
function CosmicStage() {
  return (
    <group raycast={() => null}>
      {/* Main Stage Floor Platform (Wide Octagonal / Elliptical 2x Stage) */}
      <group position={[0, -0.15, -5.2]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[11.5, 12.2, 0.3, 48]} />
          <meshStandardMaterial color="#0f0f18" roughness={0.4} metalness={0.8} />
        </mesh>
        {/* Stage Edge Neon Glow Rings */}
        <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[11.35, 11.48, 64]} />
          <meshBasicMaterial color="#00ffcc" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[11.15, 11.22, 64]} />
          <meshBasicMaterial color="#ff007f" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Elevated Drum Riser Platform in Back Center */}
      <group position={[0, 0.15, -6.5]}>
        <mesh>
          <cylinderGeometry args={[2.5, 2.7, 0.35, 32]} />
          <meshStandardMaterial color="#161622" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.45, 2.52, 32]} />
          <meshBasicMaterial color="#ff007f" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Holographic Stage Background Arch / Portal (Widened Arch) */}
      <group position={[0, 3.2, -8.2]}>
        <mesh rotation={[0, 0, 0]}>
          <torusGeometry args={[10.5, 0.12, 16, 64, Math.PI]} />
          <meshBasicMaterial color="#00ffcc" />
        </mesh>
        <mesh rotation={[0, 0, 0]}>
          <torusGeometry args={[10.2, 0.06, 16, 64, Math.PI]} />
          <meshBasicMaterial color="#ff007f" />
        </mesh>
      </group>

      {/* Overhead Stage Lighting Beam Spotlights (5 Beam Array across wide stage) */}
      <group position={[-8.5, 5.2, -5.5]}>
        <spotLight color="#ff007f" intensity={4.5} distance={14} angle={0.45} penumbra={0.5} />
      </group>
      <group position={[-4.5, 5.0, -5.5]}>
        <spotLight color="#9900ff" intensity={4.0} distance={13} angle={0.4} penumbra={0.5} />
      </group>
      <group position={[0, 5.5, -4.5]}>
        <spotLight color="#ffffff" intensity={5.5} distance={15} angle={0.5} penumbra={0.6} />
      </group>
      <group position={[4.5, 5.0, -5.5]}>
        <spotLight color="#00ff7f" intensity={4.0} distance={13} angle={0.4} penumbra={0.5} />
      </group>
      <group position={[8.5, 5.2, -5.5]}>
        <spotLight color="#00ffcc" intensity={4.5} distance={14} angle={0.45} penumbra={0.5} />
      </group>
    </group>
  );
}

// 7. Single 3D Auditorium / Concert Hall Chair Component (Interactive Hover & Subtle Ambient Glow)
function ChairModel({ chairId, position, rotation = [0, 0, 0] }) {
  const [hovered, setHovered] = useState(false);

  const handlePointerOver = (e) => {
    e.stopPropagation();
    setHovered(true);
    if (typeof document !== 'undefined') {
      document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerOut = (e) => {
    e.stopPropagation();
    setHovered(false);
    if (typeof document !== 'undefined') {
      document.body.style.cursor = 'auto';
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (window.__sitInChair) {
      window.__sitInChair({ x: position[0], y: position[1], z: position[2] });
    }
  };

  return (
    <group
      position={position}
      rotation={rotation}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Invisible Hitbox Box for 100% Easy Clicking */}
      <mesh visible={false} position={[0, 0.4, 0]}>
        <boxGeometry args={[0.6, 0.8, 0.6]} />
        <meshBasicMaterial />
      </mesh>

      {/* Chair Base Legs */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.42, 0.03, 0.42]} />
        <meshStandardMaterial color={hovered ? "#ff007f" : "#2a2a3c"} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.18, 8]} />
        <meshStandardMaterial color="#444455" metalness={0.9} />
      </mesh>

      {/* Cushioned Seat Pad - Subtle Emissive Ambient Glow */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.46, 0.08, 0.44]} />
        <meshStandardMaterial
          color={hovered ? "#ff007f" : "#2a1538"}
          emissive={hovered ? "#00ffcc" : "#660044"}
          emissiveIntensity={hovered ? 0.9 : 0.25}
          roughness={0.4}
        />
      </mesh>
      {/* Neon Edge Light under Seat Cushion */}
      <mesh position={[0, 0.21, 0.22]}>
        <boxGeometry args={[0.46, 0.015, 0.015]} />
        <meshBasicMaterial color={hovered ? "#00ffcc" : "#ff007f"} />
      </mesh>

      {/* Cushioned Ergonomic Backrest - Subtle Emissive Ambient Glow */}
      <group position={[0, 0.55, -0.18]} rotation={[-0.1, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.45, 0.55, 0.07]} />
          <meshStandardMaterial
            color={hovered ? "#3a0055" : "#1e102d"}
            emissive={hovered ? "#ff007f" : "#440033"}
            emissiveIntensity={hovered ? 0.7 : 0.20}
            roughness={0.5}
          />
        </mesh>
        {/* Headrest Accent Trim */}
        <mesh position={[0, 0.24, 0.038]}>
          <boxGeometry args={[0.3, 0.02, 0.01]} />
          <meshBasicMaterial color={hovered ? "#ffffff" : "#00ffcc"} />
        </mesh>
      </group>

      {/* Ambient Floor Ring under Chair (Subtle Ambient Glow when unhovered, bright cyan when hovered) */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.30, 0.42, 24]} />
        <meshBasicMaterial
          color={hovered ? "#00ffcc" : "#ff007f"}
          transparent={true}
          opacity={hovered ? 0.9 : 0.28}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Twin Armrests */}
      <group position={[-0.25, 0.38, 0]}>
        <mesh>
          <boxGeometry args={[0.05, 0.04, 0.36]} />
          <meshStandardMaterial color={hovered ? "#ff007f" : "#1c1c28"} roughness={0.3} />
        </mesh>
      </group>
      <group position={[0.25, 0.38, 0]}>
        <mesh>
          <boxGeometry args={[0.05, 0.04, 0.36]} />
          <meshStandardMaterial color={hovered ? "#ff007f" : "#1c1c28"} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

// 8. Auditorium / Concert Hall Seating Layout Component (360-Degree Radial Concentric Seating with Distinct Tiered Step Heights)
function ConcertHallSeating() {
  const stageCenter = { x: 0, z: -5.2 };
  const rows = [
    { r: 13.5, count: 24, height: 0.0 },
    { r: 15.2, count: 30, height: 0.65 },
    { r: 16.9, count: 36, height: 1.30 },
    { r: 18.6, count: 42, height: 1.95 },
  ];

  return (
    <group raycast={() => null}>
      {/* 360-Degree Concentric Stepped Floor Risers (Hollow Annular Rings) */}
      {rows.map((row, idx) => (
        <group key={`floor-${idx}`} position={[stageCenter.x, row.height - 0.02, stageCenter.z]}>
          {/* Annular Floor Ring Step Surface */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[row.r - 0.75, row.r + 0.75, 64]} />
            <meshStandardMaterial color="#0c0c14" roughness={0.6} metalness={0.5} side={THREE.DoubleSide} />
          </mesh>
          {/* Outer Edge Glowing LED Strip */}
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[row.r + 0.70, row.r + 0.75, 64]} />
            <meshBasicMaterial color="#00ffcc" side={THREE.DoubleSide} />
          </mesh>
          {/* Inner Edge Glowing LED Strip */}
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[row.r - 0.75, row.r - 0.70, 64]} />
            <meshBasicMaterial color="#ff007f" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* 360-Degree Radial Concentric Rows of Auditorium Chairs */}
      {rows.map((row, rowIdx) => {
        const chairs = [];
        const totalAngle = Math.PI * 2;
        const stepAngle = totalAngle / row.count;

        for (let i = 0; i < row.count; i++) {
          // Leave 4 radial aisles at 0°, 90°, 180°, 270° for walkways
          const aisleIndices = [
            0,
            Math.floor(row.count / 4),
            Math.floor(row.count / 2),
            Math.floor((3 * row.count) / 4)
          ];
          if (aisleIndices.includes(i)) {
            continue;
          }

          const angle = i * stepAngle;
          const x = stageCenter.x + row.r * Math.sin(angle);
          const z = stageCenter.z + row.r * Math.cos(angle);

          // Vector pointing from chair (x, z) to stage center (0, -5.2)
          const dx = stageCenter.x - x;
          const dz = stageCenter.z - z;
          const rotY = Math.atan2(dx, dz);

          chairs.push(
            <ChairModel
              key={`chair-${rowIdx}-${i}`}
              chairId={`chair-${rowIdx}-${i}`}
              position={[x, row.height, z]}
              rotation={[0, rotY, 0]}
            />
          );
        }
        return chairs;
      })}
    </group>
  );
}

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

const starTextureCache = {};

function getMenuStarTexture(colorHex) {
  if (typeof document === 'undefined') return null;
  if (starTextureCache[colorHex]) return starTextureCache[colorHex];

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const centerX = 128;
  const centerY = 128;
  const radius = 128;

  // Compact, crisp volumetric star radial gradient:
  // 0% -> Pure White Core (#ffffff)
  // 18% -> Soft White Center
  // 42% -> Toned-down Pastel Stem Color
  // 68% -> Compact Aura Glow (33% opacity)
  // 88% -> Clean Edge Fade-out (Zero wide blur spread)
  const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  grad.addColorStop(0.0, '#ffffff');
  grad.addColorStop(0.18, 'rgba(255, 255, 255, 0.92)');
  grad.addColorStop(0.42, colorHex);
  grad.addColorStop(0.68, colorHex + '33');
  grad.addColorStop(0.88, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  starTextureCache[colorHex] = texture;
  return texture;
}

// 3D Interactive Audio Orb (Main Menu Volumetric Celestial Star Style)
function InteractiveOrb({ color, initialPos, orbKey, coordsRef, setIsDraggingOrb, analysersRef, draggingOrbsRef }) {
  const meshRef = useRef();
  const auraRef = useRef();
  const waveRef1 = useRef();
  const waveRef2 = useRef();
  const waveRef3 = useRef();
  const waveTimeRef = useRef(0);
  
  const starTexture = useMemo(() => getMenuStarTexture(color), [color]);

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

    // Billboard camera alignment for borderless volumetric light cloud quad
    if (auraRef.current) {
      auraRef.current.quaternion.copy(state.camera.quaternion);
    }

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
    } else if (meshRef.current) {
      const baseScale = hovered ? 1.25 : 1.0;
      meshRef.current.scale.set(baseScale, baseScale, baseScale);
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
            
            // Tight, precise Ray Cone targeting tolerance
            const rayTolerance = Math.max(0.28, t * 0.05 + 0.18);
            if (perpDist < rayTolerance) {
              isTargeted = true;
              grabDistance = Math.max(0.4, t);
            }
          }

          // Physical touch proximity: within 0.3m of controller position
          if (distToCtrl < 0.3) {
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
      {/* Concentric Ripple Wave Rings */}
      <mesh ref={waveRef1} position={initialPos}>
        <ringGeometry args={[0.3, 0.34, 48]} />
        <meshBasicMaterial
          color={color}
          transparent={true}
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={waveRef2} position={initialPos}>
        <ringGeometry args={[0.3, 0.34, 48]} />
        <meshBasicMaterial
          color={color}
          transparent={true}
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={waveRef3} position={initialPos}>
        <ringGeometry args={[0.3, 0.34, 48]} />
        <meshBasicMaterial
          color={color}
          transparent={true}
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Main Interactive Celestial Star Group (Borderless Volumetric Glowing Light Cloud) */}
      <group
        ref={meshRef}
        position={initialPos}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
      >
        {/* Invisible Hit-Test Proxy Sphere for 100% Precise Mouse/Raycast Drag Interaction */}
        <mesh visible={false}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshBasicMaterial />
        </mesh>

        {/* Volumetric Soft-Glow Celestial Star Sprite (Compact Toned-Down Pastel Glow) */}
        {starTexture && (
          <sprite scale={hovered ? [1.45, 1.45, 1.45] : [1.15, 1.15, 1.15]}>
            <spriteMaterial
              map={starTexture}
              transparent={true}
              opacity={hovered ? 0.95 : 0.82}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </sprite>
        )}

        {/* Dynamic point light to illuminate surrounding space stars */}
        <pointLight position={[0, 0, 0]} color={color} intensity={hovered ? 2.0 : 1.2} distance={6} decay={1.5} />
      </group>
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
      {/* 3D Cosmic Concert Hall Environment: Stage Platform & Lighting */}
      <CosmicStage />

      {/* 3D Procedural Musical Instrument Models placed on Stage */}
      <CosmicInstruments />

      {/* 3D Auditorium / Concert Hall Seating Rows */}
      <ConcertHallSeating />

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

// Sleek Custom 3D Axis Indicator (Arrowless, Smooth Gradient Fade-out at Tips)
// X Axis: Vivid Pink (#ff007f)
// Y Axis: Milky Soft Pastel Pink (#ffa4c4)
// Z Axis: Pure White (#ffffff)
function SleekAxes3D({ length = 6.5, segments = 24 }) {
  const xAxisData = useMemo(() => {
    const pos = new Float32Array((segments + 1) * 3);
    const col = new Float32Array((segments + 1) * 3);
    const base = new THREE.Color('#ff007f');

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const i3 = i * 3;
      pos[i3] = length * t;
      pos[i3 + 1] = 0;
      pos[i3 + 2] = 0;

      const fade = Math.pow(1 - t, 1.3);
      col[i3] = base.r * fade;
      col[i3 + 1] = base.g * fade;
      col[i3 + 2] = base.b * fade;
    }
    return { pos, col };
  }, [length, segments]);

  const yAxisData = useMemo(() => {
    const pos = new Float32Array((segments + 1) * 3);
    const col = new Float32Array((segments + 1) * 3);
    const base = new THREE.Color('#ffa4c4');

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const i3 = i * 3;
      pos[i3] = 0;
      pos[i3 + 1] = length * t;
      pos[i3 + 2] = 0;

      const fade = Math.pow(1 - t, 1.3);
      col[i3] = base.r * fade;
      col[i3 + 1] = base.g * fade;
      col[i3 + 2] = base.b * fade;
    }
    return { pos, col };
  }, [length, segments]);

  const zAxisData = useMemo(() => {
    const pos = new Float32Array((segments + 1) * 3);
    const col = new Float32Array((segments + 1) * 3);
    const base = new THREE.Color('#ffffff');

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const i3 = i * 3;
      pos[i3] = 0;
      pos[i3 + 1] = 0;
      pos[i3 + 2] = length * t;

      const fade = Math.pow(1 - t, 1.3);
      col[i3] = base.r * fade;
      col[i3 + 1] = base.g * fade;
      col[i3 + 2] = base.b * fade;
    }
    return { pos, col };
  }, [length, segments]);

  return (
    <group raycast={() => null}>
      {/* Sleek Origin Center Node */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.95} />
      </mesh>

      {/* X Axis - Pink (#ff007f) Smooth Fade-Out Line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={segments + 1}
            array={xAxisData.pos}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={segments + 1}
            array={xAxisData.col}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial vertexColors={true} transparent opacity={0.9} blending={THREE.AdditiveBlending} />
      </line>

      {/* Y Axis - Milky Soft Pastel Pink (#ffa4c4) Smooth Fade-Out Line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={segments + 1}
            array={yAxisData.pos}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={segments + 1}
            array={yAxisData.col}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial vertexColors={true} transparent opacity={0.9} blending={THREE.AdditiveBlending} />
      </line>

      {/* Z Axis - Pure White (#ffffff) Smooth Fade-Out Line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={segments + 1}
            array={zAxisData.pos}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={segments + 1}
            array={zAxisData.col}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial vertexColors={true} transparent opacity={0.9} blending={THREE.AdditiveBlending} />
      </line>
    </group>
  );
}

// --- 170cm PERSON FIRST-PERSON NAVIGATION ENGINE ---
const STANDING_EYE_HEIGHT = 1.65; // 170cm height person standing eye height
const SEATED_EYE_HEIGHT = 1.15;   // 170cm height person sitting eye height

function FirstPersonNavigationManager({ isDesktopVR, isDraggingOrb, onSitStateChange }) {
  const { camera, gl } = useThree();
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const playerPosRef = useRef(new THREE.Vector3(0, STANDING_EYE_HEIGHT, 4.0));
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const isSeatedRef = useRef(false);
  const seatedTargetPosRef = useRef(new THREE.Vector3());

  const isPointerDownRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const walkTimeRef = useRef(0);

  useEffect(() => {
    window.__sitInChair = (chairPos) => {
      isSeatedRef.current = true;
      seatedTargetPosRef.current.set(chairPos.x, chairPos.y + SEATED_EYE_HEIGHT, chairPos.z);
      // Face towards main stage center
      const dir = new THREE.Vector3(0, 1.4, -4.5).sub(seatedTargetPosRef.current).normalize();
      yawRef.current = Math.atan2(-dir.x, -dir.z);
      pitchRef.current = Math.asin(dir.y);
      if (onSitStateChange) onSitStateChange(true);
    };

    window.__standUp = () => {
      if (isSeatedRef.current) {
        isSeatedRef.current = false;
        playerPosRef.current.y = STANDING_EYE_HEIGHT;
        if (onSitStateChange) onSitStateChange(false);
      }
    };

    return () => {
      delete window.__sitInChair;
      delete window.__standUp;
    };
  }, [onSitStateChange]);

  useEffect(() => {
    if (!isDesktopVR) return;

    const handleKeyDown = (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.w = true;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.a = true;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.s = true;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.d = true;

      if (code === 'Space') {
        if (isSeatedRef.current) {
          e.preventDefault();
          window.__standUp();
        }
      }
    };

    const handleKeyUp = (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.w = false;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.a = false;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.s = false;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.d = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isDesktopVR]);

  useEffect(() => {
    if (!isDesktopVR) return;
    const domElement = gl.domElement;

    const handleMouseDown = (e) => {
      if (e.button === 0 && !isDraggingOrb) {
        isPointerDownRef.current = true;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseMove = (e) => {
      if (isPointerDownRef.current && !isDraggingOrb) {
        const dx = e.clientX - lastMousePosRef.current.x;
        const dy = e.clientY - lastMousePosRef.current.y;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };

        const sensitivity = 0.0035;
        yawRef.current -= dx * sensitivity;
        pitchRef.current -= dy * sensitivity;

        const maxPitch = Math.PI / 2.2;
        pitchRef.current = Math.max(-maxPitch, Math.min(maxPitch, pitchRef.current));
      }
    };

    const handleMouseUp = () => {
      isPointerDownRef.current = false;
    };

    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDesktopVR, gl.domElement, isDraggingOrb]);

  useFrame((state, delta) => {
    if (!isDesktopVR) return;

    if (isSeatedRef.current) {
      camera.position.lerp(seatedTargetPosRef.current, Math.min(1.0, delta * 8.0));
      playerPosRef.current.copy(camera.position);
    } else {
      const speed = 3.6 * delta;
      const moveVector = new THREE.Vector3();

      if (keysRef.current.w) moveVector.z -= 1;
      if (keysRef.current.s) moveVector.z += 1;
      if (keysRef.current.a) moveVector.x -= 1;
      if (keysRef.current.d) moveVector.x += 1;

      let headBob = 0;
      if (moveVector.lengthSq() > 0) {
        moveVector.normalize();
        moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);
        playerPosRef.current.addScaledVector(moveVector, speed);

        playerPosRef.current.x = Math.max(-24, Math.min(24, playerPosRef.current.x));
        playerPosRef.current.z = Math.max(-28, Math.min(18, playerPosRef.current.z));

        // Rhythmic human walking gait head-bobbing oscillation
        walkTimeRef.current += delta * 11.0;
        headBob = Math.sin(walkTimeRef.current) * 0.045;
      } else {
        walkTimeRef.current = 0;
      }

      // Calculate dynamic floor step height based on current (x, z) location (+0.65m step risers)
      const stageCenter = { x: 0, z: -5.2 };
      const dx = playerPosRef.current.x - stageCenter.x;
      const dz = playerPosRef.current.z - stageCenter.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      let floorHeight = 0.0;
      if (dist >= 17.75) floorHeight = 1.95;
      else if (dist >= 16.05) floorHeight = 1.30;
      else if (dist >= 14.35) floorHeight = 0.65;
      else floorHeight = 0.0;

      playerPosRef.current.y = floorHeight + STANDING_EYE_HEIGHT + headBob;

      camera.position.lerp(playerPosRef.current, Math.min(1.0, delta * 12.0));
    }

    const lookTarget = new THREE.Vector3(
      camera.position.x + Math.sin(-yawRef.current) * Math.cos(pitchRef.current),
      camera.position.y + Math.sin(pitchRef.current),
      camera.position.z - Math.cos(-yawRef.current) * Math.cos(pitchRef.current)
    );
    camera.lookAt(lookTarget);
  });

  return null;
}

export function VRScene({ store, starColors, isVRTest, isInVR, isDesktopVR, activeSong, leftRate, rightRate, activePreset, isAudioActive, vrModeType, onNextSong, vrCameraPos, vrCameraRot, onStarMixVolumeChange }) {
  const isVRActive = isInVR || isDesktopVR;
  const [isDraggingOrb, setIsDraggingOrb] = useState(false);
  const [isSeated, setIsSeated] = useState(false);

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
      {/* 1인칭 관람 & 착석 안내 HUD Overlay */}
      {isDesktopVR && vrModeType === 2 && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          pointerEvents: 'none',
          background: isSeated ? 'rgba(255, 0, 127, 0.25)' : 'rgba(5, 5, 20, 0.75)',
          border: `1px solid ${isSeated ? '#ff007f' : '#00ffcc'}`,
          boxShadow: `0 0 20px ${isSeated ? 'rgba(255, 0, 127, 0.4)' : 'rgba(0, 255, 204, 0.3)'}`,
          backdropFilter: 'blur(8px)',
          borderRadius: '24px',
          padding: '10px 24px',
          color: '#ffffff',
          fontSize: '13px',
          fontWeight: 'bold',
          letterSpacing: '0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {isSeated ? (
            <>
              <span style={{ color: '#ff007f', fontSize: '15px' }}>🪑</span>
              <span>의자에 착석했습니다 </span>
              <span style={{ color: '#00ffcc', background: 'rgba(0, 255, 204, 0.15)', padding: '2px 8px', borderRadius: '6px' }}>[Spacebar] 자리에서 일어나기</span>
              <span style={{ color: '#aaa' }}>| 마우스 드래그: 시점 둘러보기</span>
            </>
          ) : (
            <>
              <span style={{ color: '#00ffcc', fontSize: '15px' }}>🚶</span>
              <span>공연장 1인칭 보행 (키 170cm 시선)</span>
              <span style={{ color: '#ff007f', background: 'rgba(255, 0, 127, 0.15)', padding: '2px 8px', borderRadius: '6px' }}>[WASD] 자유 이동</span>
              <span style={{ color: '#00ffcc' }}>[마우스 드래그] 시점 변경</span>
              <span style={{ color: '#aaa' }}>| 의자 클릭: 착석</span>
            </>
          )}
        </div>
      )}

      <Canvas>
        <XR store={store}>
          <LoggerComponent />
            <CameraRig vrCameraPos={vrCameraPos} vrCameraRot={vrCameraRot} />
            <color attach="background" args={['#111111']} />
            
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

            {/* 170cm WASD 1인칭 관람 & 마우스 시점 & 의자 착석 컨트롤러 */}
            {isDesktopVR && (
              <FirstPersonNavigationManager
                isDesktopVR={isDesktopVR}
                isDraggingOrb={isDraggingOrb}
                onSitStateChange={setIsSeated}
              />
            )}

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
