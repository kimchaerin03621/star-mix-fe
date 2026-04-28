import React, { useState, useRef, useEffect } from 'react';
import { useHandTracking } from './hooks/useHandTracking';
import { Starfield2D } from './components/Experience';
import './index.css';

function StarEditor({ onApply, onCancel, previousTexture, previousColors }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!previousTexture);
  const [isEraser, setIsEraser] = useState(false);
  const [showBrush, setShowBrush] = useState(false);
  const [brushPos, setBrushPos] = useState({ x: -100, y: -100 });
  const [leftColor, setLeftColor] = useState(previousColors?.left || '#ff007f');
  const [rightColor, setRightColor] = useState(previousColors?.right || '#ffffff');
  // ... (rest of the component)

  useEffect(() => {
    initCanvas();
  }, []);

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
            <input type="color" value={leftColor} onChange={(e) => setLeftColor(e.target.value)} />
          </div>
          <div className="color-input-group">
            <label>RIGHT</label>
            <input type="color" value={rightColor} onChange={(e) => setRightColor(e.target.value)} />
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

function App() {
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [isMusicLoading, setIsMusicLoading] = useState(false);
  const [activePreset, setActivePreset] = useState(1);
  const [activeSong, setActiveSong] = useState(1);
  const [songTrigger, setSongTrigger] = useState(0);
  const [leftRate, setLeftRate] = useState(1.0);
  const [rightRate, setRightRate] = useState(1.0);

  // Custom Star States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [customTexture, setCustomTexture] = useState(null);
  const [starColors, setStarColors] = useState({ left: '#ff007f', right: '#ffffff' });

  const handData = useHandTracking(videoRef);

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

  // Handle Finger Snap to cycle songs (Global across all hands)
  const totalSnapCountRef = useRef(0);
  useEffect(() => {
    const currentTotalSnaps = handData.reduce((acc, h) => acc + h.snapCount, 0);
    if (currentTotalSnaps > totalSnapCountRef.current) {
      const nextSong = (activeSong % 3) + 1;
      handleSongChange(nextSong);
      totalSnapCountRef.current = currentTotalSnaps;
    }
  }, [handData, activeSong]);

  const handleSongChange = (id) => {
    setActiveSong(id);
    setSongTrigger(prev => prev + 1);
    setIsMusicLoading(true);
  };

  const startCamera = async () => {
    try {
      setIsAudioInitialized(true);
      setIsMusicLoading(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("웹캠 접근 권한이 필요합니다.");
    }
  };

  const handleApplyCustomStar = (texture, left, right) => {
    setCustomTexture(texture);
    setStarColors({ left, right });
    setIsEditorOpen(false);
  };

  return (
    <div className="app-container">
      <button className="editor-open-btn" onClick={() => setIsEditorOpen(true)}>
        My Star
      </button>

      {isEditorOpen && (
        <StarEditor
          onApply={handleApplyCustomStar}
          onCancel={() => setIsEditorOpen(false)}
          previousTexture={customTexture}
          previousColors={starColors}
        />
      )}

      <div className="ui-overlay">
        <div className="ui-title">STARMix Lab</div>
        <div className="ui-status">
          {isMusicLoading && <div style={{ color: '#ff007f', fontWeight: 'bold' }}>새로운 파동 로딩 중...</div>}
          {!isMusicLoading && (cameraActive ? (handData.length > 0 ? `손 인식 중 (${handData.length}개)` : "손을 기다리는 중...") : "카메라를 켜주세요.")}
        </div>

        {/* Song Selection Buttons */}
        <div className="song-controls">
          <button className={`song-button ${activeSong === 1 ? 'active' : ''}`} onClick={() => handleSongChange(1)}>SONG 1</button>
          <button className={`song-button ${activeSong === 2 ? 'active' : ''}`} onClick={() => handleSongChange(2)}>SONG 2</button>
          <button className={`song-button ${activeSong === 3 ? 'active' : ''}`} onClick={() => handleSongChange(3)}>SONG 3</button>
        </div>

        {/* Preset Toggle Buttons */}
        <div className="preset-controls">
          <button className={`preset-button ${activePreset === 1 ? 'active' : ''}`} onClick={() => setActivePreset(1)}>PRESET 1 (Quadrant EQ)</button>
          <button className={`preset-button ${activePreset === 2 ? 'active' : ''}`} onClick={() => setActivePreset(2)}>PRESET 2 (NDS Style)</button>
        </div>
      </div>

      {/* BPM Sliders */}
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
        <div className="bpm-label">BPM</div>
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
        <div className="bpm-label">BPM</div>
      </div>

      {!cameraActive && (
        <button className="start-button" onClick={startCamera}>
          카메라 시작하기
        </button>
      )}

      <video ref={videoRef} className="webcam-feed" playsInline muted />

      <Starfield2D
        handData={isEditorOpen ? [] : handData}
        isAudioActive={isAudioInitialized}
        onMusicReady={() => setIsMusicLoading(false)}
        activePreset={activePreset}
        activeSong={activeSong}
        songTrigger={songTrigger}
        leftRate={leftRate}
        rightRate={rightRate}
        customTexture={customTexture}
        starColors={starColors}
      />
    </div>
  );
}

export default App;
