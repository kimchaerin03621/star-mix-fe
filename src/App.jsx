import React, { useRef, useState } from 'react';
import { Starfield2D } from './components/Experience';
import { useHandTracking } from './hooks/useHandTracking';
import './index.css';

function App() {
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [isMusicLoading, setIsMusicLoading] = useState(false);
  const handData = useHandTracking(videoRef);

  const startCamera = async () => {
    try {
      // Explicitly allow audio context to resume on user gesture
      setIsAudioInitialized(true);
      setIsMusicLoading(true);

      // Auto-dismiss loading after 10 seconds even if music fails
      setTimeout(() => {
        setIsMusicLoading(false);
      }, 10000);

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
        <div className="ui-title">STARMix 2D</div>
        <div className="ui-status">
          {isMusicLoading && <div style={{ color: '#ff007f', fontWeight: 'bold' }}>웅장한 우주 음악 로딩 중...</div>}
          {!isMusicLoading && (cameraActive ? (handData ? "손 인식 중..." : "손을 기다리는 중...") : "카메라를 켜주세요.")}
        </div>
      </div>

      {!cameraActive && (
        <button className="start-button" onClick={startCamera}>
          카메라 시작하기
        </button>
      )}

      <video ref={videoRef} className="webcam-feed" playsInline muted />

      {/* 2D Canvas Rendering */}
      <Starfield2D
        handData={handData}
        isAudioActive={isAudioInitialized}
        onMusicReady={() => setIsMusicLoading(false)}
      />
    </div>
  );
}

export default App;
