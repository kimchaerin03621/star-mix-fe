import React, { useState, useRef, useEffect } from 'react';
import { useHandTracking } from './hooks/useHandTracking';
import { Starfield2D } from './components/Experience';
import './index.css';
import { ControllerPanel } from './components/ControllerPanel';
import { createXRStore } from '@react-three/xr';
import { VRScene } from './components/VRScene';

const xrStore = createXRStore({ 
  offerSession: false
});

const midiValueToRate = (value) => {
  if (value === 0 || value === 63 || value === 64) return 1.0;
  return 0.5 + (value / 127);
};

const DRUM_PADS = [
  { id: 0, note: 36, name: 'Kick', key: '1', color: '#ff007f' },
  { id: 1, note: 37, name: 'Snare', key: '2', color: '#00ffcc' },
  { id: 2, note: 38, name: 'Hi-Hat (Closed)', key: '3', color: '#00ff7f' },
  { id: 3, note: 39, name: 'Hi-Hat (Open)', key: '4', color: '#ffaa00' },
  { id: 4, note: 40, name: 'Clap', key: '5', color: '#9900ff' },
  { id: 5, note: 41, name: 'Tom', key: '6', color: '#ff3399' },
  { id: 6, note: 42, name: 'Crash Cymbal', key: '7', color: '#5ce1e6' },
  { id: 7, note: 43, name: 'Rimshot / Perc', key: '8', color: '#ffffff' },
];

const COSMIC_PADS = [
  { id: 0, note: 36, name: 'Laser Beam ⚡', key: '1', color: '#FFD336' },
  { id: 1, note: 37, name: 'Stardust Rise ✨', key: '2', color: '#D0411A' },
  { id: 2, note: 38, name: 'Cosmic Drop 🌌', key: '3', color: '#4289E7' },
  { id: 3, note: 39, name: 'Sub Bass Boom 💣', key: '4', color: '#C94E58' },
  { id: 4, note: 40, name: 'Hyper Warp 🚀', key: '5', color: '#3D8A4A' },
  { id: 5, note: 41, name: 'Synth Chime 🔔', key: '6', color: '#AA7425' },
  { id: 6, note: 42, name: 'Cyber Sweep 🛰️', key: '7', color: '#00ffcc' },
  { id: 7, note: 43, name: 'Space Siren 🚨', key: '8', color: '#ff007f' },
];

function playCosmicSFX(padIndex, ctx) {
  if (!ctx) return;
  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(2.2, now);
  masterGain.connect(ctx.destination);

  if (padIndex === 0) {
    // Laser Beam ⚡
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.25);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (padIndex === 1) {
    // Stardust Rise ✨
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(2400, now + 0.4);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  } else if (padIndex === 2) {
    // Cosmic Drop 🌌
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.6);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.6);
  } else if (padIndex === 3) {
    // Sub Bass Boom 💣
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.8);
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.8);
  } else if (padIndex === 4) {
    // Hyper Warp 🚀
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    lfo.frequency.setValueAtTime(25, now);
    lfoGain.gain.setValueAtTime(200, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(masterGain);
    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 0.5);
    osc.stop(now + 0.5);
  } else if (padIndex === 5) {
    // Synth Chime 🔔 (Chord)
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      gain.gain.setValueAtTime(0.2, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now + idx * 0.04);
      osc.stop(now + 0.7);
    });
  } else if (padIndex === 6) {
    // Cyber Sweep 🛰️ (Noise filter sweep)
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.5);
    filter.Q.value = 4.0;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    whiteNoise.start(now);
    whiteNoise.stop(now + 0.5);
  } else if (padIndex === 7) {
    // Space Siren 🚨
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
    osc.frequency.linearRampToValueAtTime(600, now + 0.4);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.5);
  }
}

function playSynthDrum(padIndex, ctx) {
  if (!ctx) return;
  const now = ctx.currentTime;
  
  // Master Drum Output Gain (Boosted for punchy balance over background music)
  const masterDrumGain = ctx.createGain();
  masterDrumGain.gain.setValueAtTime(2.5, now);
  masterDrumGain.connect(ctx.destination);
  const dest = masterDrumGain;
  
  if (padIndex === 0) {
    // Punchy Kick Sub & Body
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(0.001, now + 0.18);
    gain.gain.setValueAtTime(1.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.18);
  } else if (padIndex === 1) {
    // Crispy Snare (Tone + Noise)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.14);
    gain.gain.setValueAtTime(1.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.14);

    const bufferSize = ctx.sampleRate * 0.16;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1200;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(1.0, now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(dest);
    noise.start(now);
  } else if (padIndex === 2) {
    // Closed Hi-Hat
    const bufferSize = ctx.sampleRate * 0.06;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(now);
  } else if (padIndex === 3) {
    // Open Hi-Hat
    const bufferSize = ctx.sampleRate * 0.35;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(now);
  } else if (padIndex === 4) {
    // Clap
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1300;
    filter.Q.value = 1.0;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(now);
  } else if (padIndex === 5) {
    // Low Tom
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.22);
    gain.gain.setValueAtTime(1.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.22);
  } else if (padIndex === 6) {
    // Crash Cymbal
    const bufferSize = ctx.sampleRate * 0.9;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 4500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(now);
  } else {
    // Rimshot / Perc
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.05);
    gain.gain.setValueAtTime(1.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.05);
  }
}

function StarEditor({ onApply, onCancel, previousTexture, previousColors }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!previousTexture);
  const [isEraser, setIsEraser] = useState(false);
  const [showBrush, setShowBrush] = useState(false);
  const [brushPos, setBrushPos] = useState({ x: -100, y: -100 });
  const [leftColor, setLeftColor] = useState(previousColors?.left || '#ff007f');
  const [rightColor, setRightColor] = useState(previousColors?.right || '#ffffff');

  const initCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (previousTexture) {
      const img = new Image();
      img.src = previousTexture;
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      setHasDrawn(true);
    } else {
      // Draw Inverted Ghost Guide (Black Star) if no previous work
      const img = new Image();
      img.src = '/star.png';
      img.onload = () => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.width;
        offCanvas.height = img.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(img, 0, 0);

        const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
          data[i + 3] = brightness;
        }
        offCtx.putImageData(imageData, 0, 0);

        ctx.save();
        ctx.globalAlpha = 0.07;
        ctx.drawImage(offCanvas, 50, 50, 200, 200);
        ctx.restore();
      };
      setHasDrawn(false);
    }

    ctx.lineCap = 'round';
    ctx.lineWidth = 15;
  };

  useEffect(() => {
    initCanvas();
  }, []);

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Inverted Ghost Guide (Black Star)
    const img = new Image();
    img.src = '/star.png';
    img.onload = () => {
      // Create an offscreen canvas to invert colors
      const offCanvas = document.createElement('canvas');
      offCanvas.width = img.width;
      offCanvas.height = img.height;
      const offCtx = offCanvas.getContext('2d');
      offCtx.drawImage(img, 0, 0);

      const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = brightness;
      }
      offCtx.putImageData(imageData, 0, 0);

      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.drawImage(offCanvas, 50, 50, 200, 200);
      ctx.restore();
    };

    setHasDrawn(false);
  };

  const startDrawing = (e) => {
    if (!hasDrawn) {
      // Clear ghost guide on first stroke
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(true);
    }
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
  };

  const draw = (e) => {
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    setBrushPos({ x, y });
    setShowBrush(true);

    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.strokeStyle = isEraser ? 'white' : 'black';
    ctx.lineWidth = isEraser ? 30 : 15;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleApply = () => {
    // If nothing was drawn, pass null to revert to default
    onApply(hasDrawn ? canvasRef.current.toDataURL() : null, leftColor, rightColor);
  };

  return (
    <div className="star-editor-modal">
      <div className="editor-content">
        <h2>Design Your Star</h2>
        <p>Sketch your unique pattern on the canvas.</p>

        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            width={300} height={300}
            className="drawing-canvas"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseEnter={() => setShowBrush(true)}
            onMouseLeave={() => {
              stopDrawing();
              setShowBrush(false);
              setBrushPos({ x: -100, y: -100 });
            }}
          />
          {/* Brush Preview Circle */}
          {showBrush && (
            <div className="brush-preview" style={{
              left: brushPos.x,
              top: brushPos.y,
              borderColor: isEraser ? '#666' : '#ff007f'
            }} />
          )}
        </div>

        <div className="tool-controls">
          <button
            className={`tool-btn ${!isEraser ? 'active' : ''}`}
            onClick={() => setIsEraser(false)}
          >
            Brush
          </button>
          <button
            className={`tool-btn ${isEraser ? 'active' : ''}`}
            onClick={() => setIsEraser(true)}
          >
            Eraser
          </button>
          <button className="tool-btn reset" onClick={resetCanvas}>
            Reset
          </button>
        </div>

        <div className="color-controls">
          <div className="color-input-group">
            <label>LEFT</label>
            <div className="star-image-mask-picker">
              <svg width="55" height="55" viewBox="0 0 100 100">
                <defs>
                  <mask id="mask-left">
                    <image href="/star_picker.png" width="100" height="100" preserveAspectRatio="xMidYMid meet" />
                  </mask>
                </defs>
                <rect width="100" height="100" fill={leftColor} mask="url(#mask-left)" />
              </svg>
              <input type="color" value={leftColor} onChange={(e) => setLeftColor(e.target.value)} />
            </div>
          </div>
          <div className="color-input-group">
            <label>RIGHT</label>
            <div className="star-image-mask-picker">
              <svg width="55" height="55" viewBox="0 0 100 100">
                <defs>
                  <mask id="mask-right">
                    <image href="/star_picker.png" width="100" height="100" preserveAspectRatio="xMidYMid meet" />
                  </mask>
                </defs>
                <rect width="100" height="100" fill={rightColor} mask="url(#mask-right)" />
              </svg>
              <input type="color" value={rightColor} onChange={(e) => setRightColor(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="editor-actions">
          <button className="editor-btn cancel" onClick={onCancel}>Cancel</button>
          <button className="editor-btn apply" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  );
}

const SONGS = [
  { id: 1, title: 'Untie', artist: 'UltraViolet' },
  { id: 2, title: 'Hype Boy', artist: 'NewJeans' },
  { id: 3, title: 'Kerning City', artist: 'MapleStory' }
];

function App() {
  const videoRef = useRef(null);
  const [, setSourceCanvas] = useState(null);
  const [isInVR, setIsInVR] = useState(false);
  const [isDesktopVR, setIsDesktopVR] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [isMusicLoading, setIsMusicLoading] = useState(false);
  const [activePreset, setActivePreset] = useState(1);
  const [activeSong, setActiveSong] = useState(1);
  const [songTrigger, setSongTrigger] = useState(0);
  const [leftRate, setLeftRate] = useState(1.0);
  const [rightRate, setRightRate] = useState(1.0);
  const [leftVolume, setLeftVolume] = useState(1.0);
  const [rightVolume, setRightVolume] = useState(1.0);
  const [midiAccess, setMidiAccess] = useState(null);
  const [midiInputs, setMidiInputs] = useState([]);
  const [selectedMidiInputId, setSelectedMidiInputId] = useState(null);
  const [midiStatus, setMidiStatus] = useState('컨트롤러 연결을 시작하세요.');
  const [lastMidiMessage, setLastMidiMessage] = useState(null);
  const [mappingGroup, setMappingGroup] = useState('group1'); // 'group1' | 'group2'

  const [viewMode, setViewMode] = useState('intro'); // Start on minimal pitch-black intro screen!
  const [introHovered, setIntroHovered] = useState(false);
  const isWarping = false;
  const warpProgress = 0;

  // VR Camera Position & Rotation Control (Group 2 Jog Wheel View Angle Navigation)
  const [vrCameraPos, setVrCameraPos] = useState({ x: 0, y: 0, z: 0 });
  const [vrCameraRot, setVrCameraRot] = useState({ yaw: 0, pitch: 0 }); // yaw: 좌우회전, pitch: 위아래회전
  const midiVelocityRef = useRef({ x: 0, y: 0, z: 0 });

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [customTexture, setCustomTexture] = useState(null);
  const [starColors, setStarColors] = useState({ left: '#E09F3E', right: '#FFF3B0' });

  const [soundMode, setSoundMode] = useState('spatial'); // 'stereo' | 'spatial'
  const [vrModeType, setVrModeType] = useState(1); // 1 for VR 1 (Classic), 2 for VR 2 (Spatial)
  const [, setAnalyserNode] = useState(null);

  // Music Player HUD state
  const [songDropdownOpen, setSongDropdownOpen] = useState(false);

  // VR 2 (Spatial Audio Mode) active check: pause 2D background audio in VR 2, resume when exiting VR 2
  const isVR2Active = (isInVR || isDesktopVR) && vrModeType === 2;

  // Dynamic Volume Control & Audio Balancing:
  // - If VR 2 is active or on Intro screen: 0 (muted)
  // - If Main Menu: 0.35 (softer ambience)
  // - If Controller Mode: 0.40 (ducks background music so performance drum pads pop out with punch)
  // - Else (DJ, VR 1, Spatial): 0.75 (balanced headroom for live drum triggers)
  const isAudioPausedInView = isVR2Active || viewMode === 'intro';

  const [audioCtx, setAudioCtx] = useState(null);
  const [audioElements, setAudioElements] = useState(null);
  const audioElementsRef = useRef({ left: null, right: null });
  const currentVolumeRef = useRef(1.0);
  const leftVolumeRef = useRef(1.0);
  const rightVolumeRef = useRef(1.0);

  useEffect(() => {
    leftVolumeRef.current = leftVolume;
    const left = audioElementsRef.current?.left || audioElements?.left;
    if (left) {
      left.volume = Math.max(0, Math.min(1, currentVolumeRef.current * leftVolume));
    }
  }, [leftVolume, audioElements]);

  useEffect(() => {
    rightVolumeRef.current = rightVolume;
    const right = audioElementsRef.current?.right || audioElements?.right;
    if (right) {
      right.volume = Math.max(0, Math.min(1, currentVolumeRef.current * rightVolume));
    }
  }, [rightVolume, audioElements]);

  const targetVolume = isAudioPausedInView 
    ? 0 
    : (viewMode === 'menu' && !isInVR && !isDesktopVR) 
      ? 0.35 
      : (viewMode === 'controller') 
        ? 0.40 
        : 0.75;

  useEffect(() => {
    let animationFrameId;

    const applyVolumes = (baseVol) => {
      const isPaused = isVR2Active || viewMode === 'intro';
      const effectiveVol = isPaused ? 0 : baseVol;
      
      const left = audioElementsRef.current?.left || audioElements?.left;
      const right = audioElementsRef.current?.right || audioElements?.right;

      if (left) {
        left.volume = Math.max(0, Math.min(1, effectiveVol * leftVolumeRef.current));
        if (isPaused && !left.paused) left.pause();
      }
      if (right) {
        right.volume = Math.max(0, Math.min(1, effectiveVol * rightVolumeRef.current));
        if (isPaused && !right.paused) right.pause();
      }
    };

    const updateVolume = () => {
      const current = currentVolumeRef.current;
      const diff = targetVolume - current;

      if (Math.abs(diff) > 0.005) {
        const next = current + diff * 0.1;
        currentVolumeRef.current = next;
        applyVolumes(next);
        animationFrameId = requestAnimationFrame(updateVolume);
      } else {
        currentVolumeRef.current = targetVolume;
        applyVolumes(targetVolume);
      }
    };

    updateVolume();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [targetVolume, audioElements, viewMode, isVR2Active, isInVR, isDesktopVR]);

  useEffect(() => {
    const left = audioElementsRef.current?.left || audioElements?.left;
    const right = audioElementsRef.current?.right || audioElements?.right;

    if (!left || !right) return;

    if (isAudioPausedInView) {
      left.pause();
      right.pause();
      left.volume = 0;
      right.volume = 0;
      currentVolumeRef.current = 0;
    } else {
      if (isAudioInitialized) {
        left.volume = Math.max(0, Math.min(1, currentVolumeRef.current * leftVolumeRef.current));
        right.volume = Math.max(0, Math.min(1, currentVolumeRef.current * rightVolumeRef.current));
        left.play().catch(() => {});
        right.play().catch(() => {});
      }
    }
  }, [isAudioPausedInView, isAudioInitialized, audioElements, targetVolume]);

  const handData = useHandTracking(videoRef, viewMode !== 'menu' && viewMode !== 'intro');

  const unlockIntroExperience = async () => {
    try {
      if (!audioCtx || !isAudioInitialized) {
        await startCamera();
      } else {
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        if (audioElementsRef.current.left) {
          await Promise.allSettled([
            audioElementsRef.current.left.play().catch(() => {}),
            audioElementsRef.current.right.play().catch(() => {}),
          ]);
        }
      }
    } catch (err) {
      console.warn('Failed to unlock intro audio:', err);
    }
  };

  useEffect(() => {
    let wasActive = false;
    const unsub = xrStore.subscribe((state) => {
      const active = !!state.session;
      setIsInVR(active);
      // Only reset audio when a previously-active XR session genuinely ends
      if (wasActive && !active) {
        setIsAudioInitialized(false);
      }
      wasActive = active;
    });
    return unsub;
  }, []);

  // Base BPM Map
  const bpmMap = {
    1: { left: 128, right: 128 },
    2: { left: 128, right: 132 },
    3: { left: 128, right: 128 },
  };
  const currentBpm = bpmMap[activeSong] || bpmMap[1];

  // Reset BPM rates when song changes
  useEffect(() => {
    setLeftRate(1.0);
    setRightRate(1.0);
  }, [activeSong]);

  // Handle Finger Snap (Disabled song cycling since only SONG 1 is active)
  const totalSnapCountRef = useRef(0);
  useEffect(() => {
    const currentTotalSnaps = handData.reduce((acc, h) => acc + h.snapCount, 0);
    if (currentTotalSnaps > totalSnapCountRef.current) {
      totalSnapCountRef.current = currentTotalSnaps;
    }
  }, [handData]);

  const handleSongChange = (id) => {
    setActiveSong(id);
    setSongTrigger(prev => prev + 1);
    setIsMusicLoading(true);

    if (audioElementsRef.current.left) {
      const songMap = {
        1: { vocal: '/Rosewood_vocal_left.mp3', drum: '/Rosewood_drum_right.mp3' },
        2: { vocal: '/Rosewood_vocal_left.mp3', drum: '/Rosewood_drum_right.mp3' },
        3: { vocal: '/Rosewood_vocal_left.mp3', drum: '/Rosewood_drum_right.mp3' },
      };
      const { vocal, drum } = songMap[id] || songMap[1];
      // Safely update sources
      const leftAudio = audioElementsRef.current.left;
      const rightAudio = audioElementsRef.current.right;
      // Pause current playback and reset src to avoid interruption
      leftAudio.pause();
      rightAudio.pause();
      leftAudio.src = '';
      rightAudio.src = '';
      // Assign new sources
      leftAudio.src = vocal;
      rightAudio.src = drum;
      // Load new media
      leftAudio.load();
      rightAudio.load();
      // Attempt playback if context is running and NOT in VR 2 mode
      const isVR2Now = (isInVR || isDesktopVR) && vrModeType === 2;
      if (audioCtx && audioCtx.state !== 'suspended' && !isVR2Now) {
        leftAudio.play().catch(() => {});
        rightAudio.play().catch(() => {});
      }
      setAudioElements({ left: leftAudio, right: rightAudio });
    }
  };

  const refreshMidiInputs = (access) => {
    const nextInputs = Array.from(access.inputs.values()).map((input) => ({
      id: input.id,
      name: input.name || 'Unknown MIDI Input',
      manufacturer: input.manufacturer || '',
    }));

    setMidiInputs(nextInputs);

    if (nextInputs.length === 0) {
      setSelectedMidiInputId(null);
      setMidiStatus('연결된 MIDI 입력 장치가 없어요.');
      return;
    }

    setSelectedMidiInputId((currentId) => {
      if (currentId && nextInputs.some((input) => input.id === currentId)) {
        return currentId;
      }
      return nextInputs[0].id;
    });
  };

  const requestMidiAccess = async () => {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      setMidiStatus('이 브라우저는 Web MIDI를 지원하지 않아요.');
      return;
    }

    try {
      const access = await navigator.requestMIDIAccess();
      setMidiAccess(access);
      setMidiStatus('MIDI 접근 권한을 받았어요. 장치를 선택해보세요.');
      refreshMidiInputs(access);
      access.onstatechange = () => refreshMidiInputs(access);
    } catch (err) {
      console.error('Failed to request MIDI access:', err);
      setMidiStatus('MIDI 접근 권한을 가져오지 못했어요.');
    }
  };

  const handleNextSong = () => {
    setActiveSong((currentSong) => {
      let nextSong = 2;
      if (currentSong === 2) nextSong = 1;
      else if (currentSong === 1) nextSong = 3;
      else if (currentSong === 3) nextSong = 2;

      if (audioElementsRef.current.left) {
        const songMap = {
          1: { vocal: '/Rosewood_vocal_left.mp3', drum: '/Rosewood_drum_right.mp3' },
          2: { vocal: '/00_left.mp3', drum: '/gangnamstyle_right.mp3' },
          3: { vocal: '/Rosewood_vocal_left.mp3', drum: '/Rosewood_drum_right.mp3' },
        };
        const { vocal, drum } = songMap[nextSong];
        audioElementsRef.current.left.src = vocal;
        audioElementsRef.current.right.src = drum;

        setAudioElements({ left: audioElementsRef.current.left, right: audioElementsRef.current.right });
      }
      return nextSong;
    });
    setSongTrigger(prev => prev + 1);
    setIsMusicLoading(true);
  };

  const [activePads, setActivePads] = useState({});

  const handlePadTrigger = (padIndex) => {
    let ctx = audioCtx;
    if (!ctx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtxClass();
      setAudioCtx(ctx);
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (mappingGroup === 'group2') {
      playCosmicSFX(padIndex, ctx);
    } else {
      playSynthDrum(padIndex, ctx);
    }

    setActivePads(prev => ({ ...prev, [padIndex]: true }));
    setTimeout(() => {
      setActivePads(prev => ({ ...prev, [padIndex]: false }));
    }, 160);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['1', '2', '3', '4', '5', '6', '7', '8'].includes(e.key)) {
        const padIdx = parseInt(e.key) - 1;
        handlePadTrigger(padIdx);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [audioCtx, mappingGroup]);

  useEffect(() => {
    if (!midiAccess) return;

    const inputs = Array.from(midiAccess.inputs.values());
    const activeNames = inputs.map(i => i.name).filter(Boolean).join(', ') || '장치';
    setMidiStatus(`LIVE: ${activeNames} 수신 중`);

    const handleMidiMessage = (event) => {
      const [status = 0, data1 = 0, data2 = 0] = event.data || [];
      const messageType = status & 0xf0;
      const channel = (status & 0x0f) + 1;

      let mappedControlTag = 'UNMAPPED';
      let mappedActionDesc = '미매핑 신호 (준비 중)';

      if (mappingGroup === 'group2') {
        // --- GROUP 2: VR NAVIGATION & GAME CONTROLLER PROFILE ---
        if (messageType === 0xb0) {
          // 14-Bit High-Resolution MIDI Knob Decoder for ALL EQ Knobs:
          // EQ High: CC 7 (MSB) + CC 39 (LSB) -> X-axis (Right / Left)
          // EQ Mid:  CC 11 (MSB) + CC 43 (LSB) -> Y-axis (Up / Down)
          // EQ Low:  CC 15 (MSB) + CC 47 (LSB) -> Z-axis (Forward / Backward)
          if (!window.midi14BitState) {
            window.midi14BitState = {
              highMsb: 64, highLsb: 0,
              midMsb: 64, midLsb: 0,
              lowMsb: 64, lowLsb: 0,
            };
          }

          // 1. EQ HIGH (X-axis)
          if (data1 === 7) window.midi14BitState.highMsb = data2;
          else if (data1 === 39) window.midi14BitState.highLsb = data2;

          // 2. EQ MID (Y-axis)
          if (data1 === 11 || data1 === 17 || data1 === 1) window.midi14BitState.midMsb = data2;
          else if (data1 === 43 || data1 === 49) window.midi14BitState.midLsb = data2;

          // 3. EQ LOW (Z-axis)
          if (data1 === 15 || data1 === 18 || data1 === 2) window.midi14BitState.lowMsb = data2;
          else if (data1 === 47 || data1 === 51) window.midi14BitState.lowLsb = data2;

          if (data1 === 7 || data1 === 39) {
            const combinedVal = (window.midi14BitState.highMsb << 7) + window.midi14BitState.highLsb;
            const diff = combinedVal - 8192;
            let vel = 0;
            if (Math.abs(diff) > 200) vel = (diff / 8191) * 0.20;

            midiVelocityRef.current.x = vel;
            mappedControlTag = 'EQ HIGH (14-Bit)';
            mappedActionDesc = vel > 0 ? `X축 오른쪽(Right) 이동 중 (14Bit: ${combinedVal})` : vel < 0 ? `X축 왼쪽(Left) 이동 중 (14Bit: ${combinedVal})` : `X축 정지 (12시 중앙, 14Bit: ${combinedVal})`;
          }
          else if (data1 === 11 || data1 === 17 || data1 === 1 || data1 === 43 || data1 === 49) {
            const combinedVal = (window.midi14BitState.midMsb << 7) + window.midi14BitState.midLsb;
            const diff = combinedVal - 8192;
            let vel = 0;
            if (Math.abs(diff) > 200) vel = (diff / 8191) * 0.20;

            midiVelocityRef.current.y = vel;
            mappedControlTag = 'EQ MID (14-Bit)';
            mappedActionDesc = vel > 0 ? `Y축 위로(Up) 이동 중 (14Bit: ${combinedVal})` : vel < 0 ? `Y축 아래로(Down) 이동 중 (14Bit: ${combinedVal})` : `Y축 정지 (12시 중앙, 14Bit: ${combinedVal})`;
          }
          else if (data1 === 15 || data1 === 18 || data1 === 2 || data1 === 47 || data1 === 51) {
            const combinedVal = (window.midi14BitState.lowMsb << 7) + window.midi14BitState.lowLsb;
            const diff = combinedVal - 8192;
            let vel = 0;
            if (Math.abs(diff) > 200) vel = (diff / 8191) * 0.20;

            midiVelocityRef.current.z = -vel;
            mappedControlTag = 'EQ LOW (14-Bit)';
            mappedActionDesc = vel > 0 ? `Z축 앞으로(Forward) 전진 중 (14Bit: ${combinedVal})` : vel < 0 ? `Z축 뒤로(Backward) 후진 중 (14Bit: ${combinedVal})` : `Z축 정지 (12시 중앙, 14Bit: ${combinedVal})`;
          }
          // Jog Wheel Rotation Handling (CC 33)
          // Left Jog Wheel (Channel 1, CC 33): Yaw (Left / Right Angle Rotation)
          // Right Jog Wheel (Channel 2, CC 33): Pitch (Up / Down Angle Rotation)
          else if (data1 === 33) {
            const stepDelta = data2 > 64 ? (data2 - 64) : (data2 - 64);
            const rotStep = stepDelta * 0.03; // Smooth rotation angle sensitivity

            if (channel === 1) {
              setVrCameraRot(prev => ({ ...prev, yaw: prev.yaw + rotStep }));
              mappedControlTag = 'JOG LEFT (YAW)';
              mappedActionDesc = `시점 좌/우 360도 회전 중 (Delta: ${stepDelta})`;
            } else {
              setVrCameraRot(prev => ({
                ...prev,
                pitch: Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, prev.pitch + rotStep))
              }));
              mappedControlTag = 'JOG RIGHT (PITCH)';
              mappedActionDesc = `시점 위/아래 쳐다보기 중 (Delta: ${stepDelta})`;
            }
          }
          // Ignore unused CC signals (CC 34 etc.)
          else if (data1 === 34) {
            mappedControlTag = 'DISABLED';
            mappedActionDesc = '기능 비활성화됨 (매핑 없음)';
          }
          // Fallback CC
          else {
            mappedControlTag = `CC ${data1}`;
            mappedActionDesc = '미매핑 신호 (대기 중)';
          }
        }

        if (messageType === 0x90 && data2 > 0) {
          // Reset VR Camera View Button (NOTE/CC: 99 ONLY - Master Button)
          if (data1 === 99) {
            setVrCameraPos({ x: 0, y: 0, z: 0 });
            setVrCameraRot({ yaw: 0, pitch: 0 });
            midiVelocityRef.current = { x: 0, y: 0, z: 0 };
            mappedControlTag = 'RESET VIEW 🎯';
            mappedActionDesc = '카메라 시점 및 회전각(0, 0, 0)으로 즉시 초기화!';
          } else if (data1 === 55 || (data1 === 54 && channel === 2)) {
            setActivePreset(2);
            mappedControlTag = 'BTN 2';
            mappedActionDesc = 'PRESET 2 (NDS Style) 전환';
          } else if (data1 === 50 || data1 === 11) {
            setIsEditorOpen(true);
            mappedControlTag = 'BTN 3';
            mappedActionDesc = 'My Star 에디터 모달 열기';
          } else if (data1 === 51 || data1 === 12) {
            setViewMode('menu');
            mappedControlTag = 'BTN 4';
            mappedActionDesc = '메인 선택 메뉴로 이동';
          } else {
            let padIndex = -1;
            if (data1 >= 36 && data1 <= 43) padIndex = data1 - 36;
            else if (data1 >= 48 && data1 <= 55 && data1 !== 54 && data1 !== 55) padIndex = data1 - 48;
            else if (data1 >= 60 && data1 <= 67) padIndex = data1 - 60;
            else if (data1 >= 96 && data1 <= 103) padIndex = data1 - 96;
            else if (data1 >= 0 && data1 <= 7) padIndex = data1;

            if (padIndex >= 0 && padIndex < 8) {
              handlePadTrigger(padIndex);
              mappedControlTag = `PAD ${padIndex + 1}`;
              mappedActionDesc = `코스믹 SFX: ${COSMIC_PADS[padIndex]?.name || 'SFX'}`;
            }
          }
        }
      } else {
        // --- GROUP 1: DJ MIXER & DRUM PERFORMANCE MAPPING PROFILE ---
        if (messageType === 0xb0) {
          if (channel === 7 || channel === 9 || channel === 16 || [63, 31, 53, 15, 29, 30].includes(data1)) {
            const norm = data2 / 127;
            setLeftVolume(Math.cos(norm * (Math.PI / 2)));
            setRightVolume(Math.sin(norm * (Math.PI / 2)));
            mappedControlTag = 'X-FADER';
            mappedActionDesc = `크로스페이더 믹싱 (${Math.round(norm * 100)}%)`;
          } else if ([0, 16, 17, 32, 33, 34, 49, 50, 9, 10, 13, 14].includes(data1)) {
            if (channel === 2) {
              setRightRate(midiValueToRate(data2));
              mappedControlTag = 'KNOB 2';
              mappedActionDesc = `오른쪽 BPM 템포 (${(midiValueToRate(data2)).toFixed(2)}x)`;
            } else {
              setLeftRate(midiValueToRate(data2));
              mappedControlTag = 'KNOB 1';
              mappedActionDesc = `왼쪽 BPM 템포 (${(midiValueToRate(data2)).toFixed(2)}x)`;
            }
          } else if (channel === 2 || [52, 20, 8, 24, 28, 2, 4, 6, 12].includes(data1)) {
            setRightVolume(data2 / 127);
            mappedControlTag = 'FADER 2';
            mappedActionDesc = `오른쪽 채널 2 볼륨 (${Math.round((data2 / 127) * 100)}%)`;
          } else {
            setLeftVolume(data2 / 127);
            mappedControlTag = 'FADER 1';
            mappedActionDesc = `왼쪽 채널 1 볼륨 (${Math.round((data2 / 127) * 100)}%)`;
          }
        }

        if (messageType === 0x90 && data2 > 0) {
          if (data1 === 54 && channel === 1) {
            setLeftVolume(prev => (prev > 0 ? 0 : 1.0));
            mappedControlTag = 'BTN 1';
            mappedActionDesc = '왼쪽 채널 음소거 (Mute Toggle)';
          } else if (data1 === 55 || (data1 === 54 && channel === 2)) {
            setRightVolume(prev => (prev > 0 ? 0 : 1.0));
            mappedControlTag = 'BTN 2';
            mappedActionDesc = '오른쪽 채널 음소거 (Mute Toggle)';
          } else if (data1 === 50 || data1 === 11) {
            setViewMode('dj');
            mappedControlTag = 'BTN 3';
            mappedActionDesc = 'DJ 화면 진입';
          } else if (data1 === 51 || data1 === 12) {
            setViewMode('menu');
            mappedControlTag = 'BTN 4';
            mappedActionDesc = '메인 선택 메뉴로 이동';
          } else {
            let padIndex = -1;
            if (data1 >= 36 && data1 <= 43) padIndex = data1 - 36;
            else if (data1 >= 48 && data1 <= 55 && data1 !== 54 && data1 !== 55) padIndex = data1 - 48;
            else if (data1 >= 60 && data1 <= 67) padIndex = data1 - 60;
            else if (data1 >= 96 && data1 <= 103) padIndex = data1 - 96;
            else if (data1 >= 0 && data1 <= 7) padIndex = data1;

            if (padIndex >= 0 && padIndex < 8) {
              handlePadTrigger(padIndex);
              mappedControlTag = `PAD ${padIndex + 1}`;
              mappedActionDesc = `드럼 연주: ${DRUM_PADS[padIndex]?.name || 'Drum'}`;
            }
          }
        }
      }

      setLastMidiMessage({
        type: messageType === 0x90 ? 'noteon' : messageType === 0x80 ? 'noteoff' : messageType === 0xb0 ? 'controlchange' : 'other',
        channel,
        data1,
        data2,
        controlTag: mappedControlTag,
        actionDesc: mappedActionDesc
      });
    };

    inputs.forEach(input => {
      input.onmidimessage = handleMidiMessage;
    });

    return () => {
      inputs.forEach(input => {
        if (input.onmidimessage === handleMidiMessage) {
          input.onmidimessage = null;
        }
      });
    };
  }, [midiAccess, activeSong, audioCtx, mappingGroup]);

  const startCamera = async () => {
    try {
      const isVR2Active = (isInVR || isDesktopVR) && vrModeType === 2;
      if (audioCtx) {
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        if (audioElementsRef.current.left && !isVR2Active) {
          await Promise.allSettled([
            audioElementsRef.current.left.play().catch(() => {}),
            audioElementsRef.current.right.play().catch(() => {}),
          ]);
        }
      } else {
        setIsAudioInitialized(true);
        setIsMusicLoading(true);

        const songMap = {
          1: { vocal: '/Rosewood_vocal_left.mp3', drum: '/Rosewood_drum_right.mp3' },
          2: { vocal: '/00_left.mp3', drum: '/gangnamstyle_right.mp3' },
          3: { vocal: '/Rosewood_vocal_left.mp3', drum: '/Rosewood_drum_right.mp3' },
        };
        const { vocal, drum } = songMap[activeSong] || songMap[1];

        const leftAudio = new Audio(vocal);
        const rightAudio = new Audio(drum);
        leftAudio.loop = true;
        rightAudio.loop = true;

        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtxClass();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        leftAudio.volume = currentVolumeRef.current;
        rightAudio.volume = currentVolumeRef.current;

        audioElementsRef.current = { left: leftAudio, right: rightAudio };
        setAudioCtx(ctx);
        setAudioElements({ left: leftAudio, right: rightAudio });

        // Direct HTML5 Audio Play (only if not in VR 2 mode)
        if (!isVR2Active) {
          leftAudio.play().catch(e => console.error("Left play error:", e));
          rightAudio.play().catch(e => console.error("Right play error:", e));
        }
      }

      if (!cameraActive) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            setCameraActive(true);
          }
        } catch (camErr) {
          console.warn("Camera access denied or unavailable, audio will still play:", camErr);
        }
      }
    } catch (err) {
      console.error("Audio init failed:", err);
    }
  };



  const handleApplyCustomStar = (texture, left, right) => {
    setCustomTexture(texture);
    setStarColors({ left, right });
    setIsEditorOpen(false);
  };

  const handleEnterVR = async (modeType) => {
    setVrModeType(modeType);
    setViewMode('menu');
    
    // Automatically trigger audio context initialization on user gesture only for VR 2
    if (modeType === 2) {
      setIsAudioInitialized(true);
      setActiveSong(1);
      setSongTrigger(prev => prev + 1);
      setIsMusicLoading(true);
    } else {
      setIsAudioInitialized(false);
    }
    
    let webxrSupported = false;
    
    if (typeof navigator !== 'undefined' && navigator.xr) {
      try {
        webxrSupported = await navigator.xr.isSessionSupported('immersive-vr');
      } catch (err) {
        console.error("WebXR session check error:", err);
      }
    }

    if (webxrSupported) {
      try {
        await xrStore.enterVR();
      } catch (err) {
        console.error("Error entering WebXR session, falling back to desktop 3D:", err);
        setIsDesktopVR(true);
      }
    } else {
      // Fallback: enter 3D Desktop Preview Mode!
      setIsDesktopVR(true);
    }
  };

  const handleBackToMenu = async () => {
    handleEnterVR(2);
  };

  return (
    <div className="app-container">
      {/* Permanent Fixed Top Header (WOOJOO PLAY Title & Action Buttons) */}
      {viewMode !== 'intro' && (
        <header className="global-header">
          <div className="global-header-left">
            {viewMode === 'controller' && (
              <button 
                className="back-arrow-btn" 
                onClick={handleBackToMenu}
                title="Back to 3D Sound Space"
              >
                ←
              </button>
            )}
            <div 
              className="global-header-title"
              onClick={handleBackToMenu}
              title="Go to Main Menu"
            >
              channel
            </div>
          </div>

          <div className="global-header-center">
            <button 
              className={`pill-btn ${soundMode === 'stereo' ? 'active' : ''}`}
              onClick={() => setSoundMode('stereo')}
            >
              Stereo
            </button>
            <button 
              className={`pill-btn ${soundMode === 'spatial' ? 'active' : ''}`}
              onClick={() => setSoundMode('spatial')}
            >
              Spatial
            </button>
          </div>

          <div className="global-header-actions">
            <button className="pill-btn" onClick={() => setIsEditorOpen(true)}>
              Star Edit
            </button>
            <button className="pill-btn" onClick={() => setViewMode('controller')}>
              Control Room
            </button>
          </div>
        </header>
      )}

      {isDesktopVR && (
        <>
          {/* 3D Sound Space Real-time Song Selection HUD */}
          {vrModeType === 2 && (
            <div className="music-player-hud">
              {/* Song Selector Dropdown */}
              <div className="player-top-row">
                <button 
                  className="player-song-toggle"
                  onClick={() => setSongDropdownOpen(!songDropdownOpen)}
                >
                  <span className={`dropdown-arrow ${songDropdownOpen ? 'open' : ''}`}>▼</span>
                  <span className="player-song-title">
                    {SONGS.find(s => s.id === activeSong)?.title}
                  </span>
                  <span className="player-song-artist">
                    - {SONGS.find(s => s.id === activeSong)?.artist}
                  </span>
                </button>

                {songDropdownOpen && (
                  <div className="player-song-dropdown">
                    {SONGS.map(song => (
                      <div
                        key={song.id}
                        className={`dropdown-item ${activeSong === song.id ? 'active' : ''}`}
                        onClick={() => {
                          handleSongChange(song.id);
                          setSongDropdownOpen(false);
                        }}
                      >
                        <span className="item-check">{activeSong === song.id ? '✓' : ''}</span>
                        <span className="item-title">{song.title}</span>
                        <span className="item-artist">{song.artist}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </>
      )}

      {/* Warp Flash overlay for warp speed transition */}
      {isWarping && (
        <div 
          className="warp-flash" 
          style={{ 
            opacity: warpProgress < 0.5 ? (warpProgress * 2) : 2 - (warpProgress * 2) 
          }} 
        />
      )}

      {/* Main DJ HUD (viewMode === 'dj') */}
      {!isInVR && !isDesktopVR && viewMode === 'dj' && (
        <>
          <div className="ui-overlay active-hud">
            <div className="ui-status">
              {isMusicLoading && <div style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>새로운 음원 로딩 중...</div>}
              {!isMusicLoading && (cameraActive ? (handData.length > 0 ? `손 인식 중 (${handData.length}개)` : "손을 기다리는 중...") : "카메라를 켜주세요.")}
            </div>

            {/* Song Selection Buttons */}
            <div className="song-controls">
              <button className={`song-button ${activeSong === 1 ? 'active' : ''}`} onClick={() => handleSongChange(1)}>SONG 1</button>
            </div>

            {/* Preset Toggle Buttons */}
            <div className="preset-controls">
              <button className={`preset-button ${activePreset === 1 ? 'active' : ''}`} onClick={() => setActivePreset(1)}>PRESET 1 (Quadrant EQ)</button>
              <button className={`preset-button ${activePreset === 2 ? 'active' : ''}`} onClick={() => setActivePreset(2)}>PRESET 2 (NDS Style)</button>
            </div>
          </div>

          {/* BPM & Volume Sliders (Channel 1 / Left) */}
          <div className="bpm-slider-container left">
            <div className="bpm-value" style={{ color: starColors.left, textShadow: `0 0 10px ${starColors.left}80` }}>
              {(currentBpm.left * leftRate).toFixed(1)}
            </div>
            <input
              type="range"
              className="vertical-slider"
              style={{ accentColor: starColors.left }}
              min="0.5" max="1.5" step="0.01"
              value={leftRate}
              onChange={(e) => setLeftRate(parseFloat(e.target.value))}
            />
            <div className="bpm-label">BPM 1</div>
          </div>

          <div className="bpm-slider-container left" style={{ left: '120px' }}>
            <div className="bpm-value" style={{ color: starColors.left, textShadow: `0 0 10px ${starColors.left}80` }}>
              {Math.round(leftVolume * 100)}%
            </div>
            <input
              type="range"
              className="vertical-slider"
              style={{ accentColor: starColors.left }}
              min="0" max="1" step="0.01"
              value={leftVolume}
              onChange={(e) => setLeftVolume(parseFloat(e.target.value))}
            />
            <div className="bpm-label">CH 1 VOL</div>
          </div>

          {/* BPM & Volume Sliders (Channel 2 / Right) */}
          <div className="bpm-slider-container right" style={{ right: '120px' }}>
            <div className="bpm-value" style={{ color: starColors.right, textShadow: `0 0 10px ${starColors.right}80` }}>
              {Math.round(rightVolume * 100)}%
            </div>
            <input
              type="range"
              className="vertical-slider"
              style={{ accentColor: starColors.right }}
              min="0" max="1" step="0.01"
              value={rightVolume}
              onChange={(e) => setRightVolume(parseFloat(e.target.value))}
            />
            <div className="bpm-label">CH 2 VOL</div>
          </div>

          <div className="bpm-slider-container right">
            <div className="bpm-value" style={{ color: starColors.right, textShadow: `0 0 10px ${starColors.right}80` }}>
              {(currentBpm.right * rightRate).toFixed(1)}
            </div>
            <input
              type="range"
              className="vertical-slider"
              style={{ accentColor: starColors.right }}
              min="0.5" max="1.5" step="0.01"
              value={rightRate}
              onChange={(e) => setRightRate(parseFloat(e.target.value))}
            />
            <div className="bpm-label">BPM 2</div>
          </div>

          {!cameraActive && (
            <button className="start-button" onClick={startCamera}>
              카메라 시작하기
            </button>
          )}
        </>
      )}

      {/* Pitch-Black Minimal Intro Screen (viewMode === 'intro') */}
      {!isInVR && !isDesktopVR && viewMode === 'intro' && (
        <div className="minimal-intro-overlay">
          <button 
            className="intro-interactive-text"
            onMouseEnter={() => setIntroHovered(true)}
            onMouseLeave={() => setIntroHovered(false)}
            onClick={async () => {
              await unlockIntroExperience();
              handleEnterVR(2);
            }}
          >
            {introHovered ? "YES." : "channel?"}
          </button>
        </div>
      )}

      {/* Main 3D Sound Space Auto Entry Effect */}
      {viewMode === 'menu' && !isInVR && !isDesktopVR && (
        <div style={{ display: 'none' }} />
      )}

      {/* Voice Cloud Placeholder View (viewMode === 'voicecloud') */}
      {!isInVR && !isDesktopVR && viewMode === 'voicecloud' && (
        <div className="voice-cloud-overlay">
          
          <div className="voice-cloud-content">
            <div className="voice-cloud-icon">☁️</div>
            <h1 className="voice-cloud-title">VOICE CLOUD</h1>
            <p className="voice-cloud-subtitle">AI VOICE & CLOUD MIXER (COMING SOON)</p>
            
            <div className="wave-bars">
              <div className="bar b1"></div>
              <div className="bar b2"></div>
              <div className="bar b3"></div>
              <div className="bar b4"></div>
              <div className="bar b5"></div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'controller' && (
        <ControllerPanel
          isSupported={typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess}
          status={midiStatus}
          inputs={midiInputs}
          selectedInputId={selectedMidiInputId}
          onRequestAccess={requestMidiAccess}
          onSelectInput={setSelectedMidiInputId}
          lastMidiMessage={lastMidiMessage}
          leftRate={leftRate}
          rightRate={rightRate}
          leftVolume={leftVolume}
          rightVolume={rightVolume}
          drumPads={mappingGroup === 'group2' ? COSMIC_PADS : DRUM_PADS}
          activePads={activePads}
          onTriggerPad={handlePadTrigger}
          onOpenDj={() => setViewMode('dj')}
          mappingGroup={mappingGroup}
          onSelectMappingGroup={setMappingGroup}
        />
      )}

      {isEditorOpen && (
        <StarEditor
          onApply={handleApplyCustomStar}
          onCancel={() => setIsEditorOpen(false)}
          previousTexture={customTexture}
          previousColors={starColors}
        />
      )}

      {!isInVR && !isDesktopVR && (
        <Starfield2D
          isWhiteOnly={true}
          handData={(isEditorOpen || viewMode === 'menu') ? [] : handData}
          isAudioActive={isAudioInitialized}
          audioCtx={audioCtx}
          audioElements={audioElements}
          onMusicReady={() => setIsMusicLoading(false)}
          activePreset={activePreset}
          activeSong={activeSong}
          songTrigger={songTrigger}
          leftRate={leftRate}
          rightRate={rightRate}
          leftVolume={leftVolume}
          rightVolume={rightVolume}
          customTexture={customTexture}
          starColors={starColors}
          onCanvasReady={setSourceCanvas}
          onMixingProgress={null}
          isWarping={isWarping}
          warpProgress={warpProgress}
          onAnalyserReady={setAnalyserNode}
        />
      )}

      <VRScene
        store={xrStore}
        starColors={starColors}
        soundMode={soundMode}
        isInVR={isInVR}
        isDesktopVR={isDesktopVR}
        activeSong={activeSong}
        leftRate={leftRate}
        rightRate={rightRate}
        activePreset={activePreset}
        isAudioActive={isAudioInitialized && vrModeType === 2}
        vrModeType={vrModeType}
        onNextSong={handleNextSong}
        vrCameraPos={vrCameraPos}
        vrCameraRot={vrCameraRot}
      />



      {/* Webcam element is always mounted at the bottom of the DOM to render on top of the absolute canvas */}
      <video 
        ref={videoRef} 
        className={`webcam-feed ${['intro', 'dj'].includes(viewMode) ? 'visible' : 'hidden-feed'}`} 
        playsInline 
        muted 
      />
    </div>
  );
}

export default App;










