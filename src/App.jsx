import React, { useState, useRef, useEffect } from 'react';
import { useHandTracking } from './hooks/useHandTracking';
import { Starfield2D } from './components/Experience';
import './index.css';

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

  return (
    <div className="app-container">
      <div className="ui-overlay">
        <div className="ui-title">STARMix Lab</div>
        <div className="ui-status">
          {isMusicLoading && <div style={{ color: '#ff007f', fontWeight: 'bold' }}>새로운 파동 로딩 중...</div>}
          {!isMusicLoading && (cameraActive ? (handData ? "손 인식 중..." : "손을 기다리는 중...") : "카메라를 켜주세요.")}
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
        <div className="bpm-value">{(currentBpm.left * leftRate).toFixed(1)}</div>
        <input
          type="range"
          className="vertical-slider"
          min="0.5" max="1.5" step="0.01"
          value={leftRate}
          onChange={(e) => setLeftRate(parseFloat(e.target.value))}
        />
        <div className="bpm-label">BPM</div>
      </div>

      <div className="bpm-slider-container right">
        <div className="bpm-value">{(currentBpm.right * rightRate).toFixed(1)}</div>
        <input
          type="range"
          className="vertical-slider"
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
        handData={handData}
        isAudioActive={isAudioInitialized}
        onMusicReady={() => setIsMusicLoading(false)}
        activePreset={activePreset}
        activeSong={activeSong}
        songTrigger={songTrigger}
        leftRate={leftRate}
        rightRate={rightRate}
      />
    </div>
  );
}

export default App;
