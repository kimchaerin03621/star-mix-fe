# 🌌 STARMix (Space & Sound DJ Controller)

**STARMix**는 AI 비전 손 추적(MediaPipe Hand Tracking), 2D/3D 입자 물리 시뮬레이션, 그리고 WebXR 및 Web Audio API 기반의 공간 음향(Spatial Audio) 믹싱 기술을 결합한 차세대 가상 DJ 컨트롤러 웹 애플리케이션입니다.

---

## 💡 주요 특징 (Key Features)

### 1. 🌌 2D 웹캠 갤럭시 모드 (`Starfield2D`)
- **실시간 손 추적 입자 시뮬레이션**: 웹캠을 통해 손의 위치와 움직임을 감지하여 1,500개의 입자(별)에 척력(Repulsion), 소용돌이(Vortex), 운동량 전달(Momentum Drag) 등의 물리 효과를 부여합니다.
- **Spectacle Stereo v3 사운드 엔진**: 입자 군집의 무게중심(Centroid) 및 교란도(Displacement)를 계산하여 보컬/드럼 등 음원 트랙의 스테레오 패닝과 부스트 볼륨을 비선형적으로 제어합니다.
- **실험적 오디오 프리셋**:
  - **Quadrant EQ**: 화면 사분면 위치 기반 Low/Mid/High EQ 및 로우패스 필터 믹싱.
  - **NDS Style**: X축(재생 속도), Y축(필터/공명) 제어로 클래식 핸드헬드 기기 감성의 인터랙션 제공.
- **정밀 BPM 제어 & Pitch Lock**: `preservesPitch` 기술을 적용해 음높이 변화 없이 트랙 속도(0.5x ~ 1.5x)를 독립적으로 조절합니다.

### 2. 🎧 2D 공간 음향 모드 (`SpatialExperiment`)
- **HRTF 360도 입체 음향**: 3D 공간을 단순화한 2D 캔버스에서 음원 오브를 손(Tether) 또는 키보드(WASD / 방향키)로 조작하며 Web Audio HRTF Panner를 제어합니다.
- **Z-Sorting & 파동 이펙트**: 중앙의 리스너(Listener) 기준 깊이감 있는 Z-인덱스 렌더링 및 음원 진폭(Amplitude) 연동 시각 파동을 출력합니다.

### 3. 🕶️ 3D Sound Space 모드 (`VRScene`)
- **WebXR / Three.js 3D 공간**: React Three Fiber 및 `@react-three/xr` 기반 3,000개의 3D 별 무리와 3D 오디오 오브를 3D 공간에서 조립하며 믹싱.
- **90fps 헤드셋 리스너 동기화**: VR 헤드셋의 Position과 Quaternion을 Web Audio Listener와 실시간 동기화하여 고개 회전에 따른 완벽한 3D 입체 음향 연출.
- **안전 구역 클램핑 (0.5m ~ 10m)**: 음원 오브가 경계를 벗어나거나 왜곡되는 것을 방지하는 구형 바운더리 인터랙션.

### 4. ✋ 미디어파이프 핸드 트래킹 제어 엔진 (`useHandTracking`)
- **Shoelace 다각형 면적 공식 기반 Fist(주먹/잡기) 감지**: 손의 거리나 크기와 무관하게 정규화된 면적 계산으로 안정적인 잡기 제스처 인식.
- **Zero-Latency 릴리즈**: 2개 이상의 손가락 확장 시 0ms 즉각 잡기 해제.
- **Snap(손가락 튕기기) 제스처**: 엄지-중지 핀치 유지 시간 감지를 통해 트랙 넘기기 제스처 지원.
- **Main Thread 최적화**: 캔버스 렌더링(60/90 FPS)과 비전 감지(30 FPS 스로틀링) 분리 및 GPU/CPU 자동 폴백 지원.

---

## 🛠️ 기술 스택 (Tech Stack)

| 카테고리 | 사용 기술 / 라이브러리 |
|---|---|
| **Core Framework** | React 19, Vite |
| **3D & XR Rendering** | Three.js, `@react-three/fiber`, `@react-three/drei`, `@react-three/xr` |
| **AI Vision** | MediaPipe Hands (`@mediapipe/tasks-vision`) |
| **Audio Engine** | Web Audio API (HRTF PannerNode, BiquadFilterNode, DynamicsCompressor, AnalyserNode) |
| **Icons & Styling** | Lucide React, Custom CSS (Neon Synthwave Theme) |

---

## 📁 프로젝트 구조 (Project Structure)

```text
star-mix-fe/
├── src/
│   ├── components/
│   │   ├── ControllerPanel.jsx     # DJ 컨트롤러 UI 패널
│   │   ├── Experience.jsx          # 2D 입자 시뮬레이션 및 Spectacle Stereo v3 엔진
│   │   ├── OrbitalMainMenu.jsx     # 오비탈 메인 메뉴 UI
│   │   ├── SpatialExperience.jsx   # 2D/pseudo-3D HRTF 공간 음향 캔버스
│   │   ├── SpatialExperiment.jsx   # 공간 음향 실험실 래퍼 (키보드/손 입력 전환)
│   │   └── VRScene.jsx             # WebXR 3D VR 공간 음향 씬
│   ├── hooks/
│   │   └── useHandTracking.js      # MediaPipe 핸드트래킹 및 제스처 인식 훅
│   ├── App.jsx                     # 메인 애플리케이션 및 모드 전환 관리
│   ├── index.css                   # 글로벌 테마 및 애니메이션 스타일
│   └── main.jsx                    # 진입점
├── index.html
├── package.json
└── vite.config.js
```

---

## 🚀 시작하기 (Getting Started)

### 1. 의존성 패키지 설치
```bash
npm install
```

### 2. 개발 서버 실행 (HTTPS)
웹캠 및 WebXR 테스트를 위해 SSL이 적용된 HTTPS 개발 서버가 기본 설정되어 있습니다.
```bash
npm run dev
```

서버가 실행되면 브라우저에서 `https://localhost:5173/` 접속 후 웹캠 권한을 허용합니다.

---

## 🎮 컨트롤 가이드 (Controls Guide)

### 🌌 2D 웹캠 모드
- **마우스 / 손 이동**: 별 입자를 당기거나 흩트리며 스테레오 패닝 조절.
- **주먹 쥐기 (Fist)**: 강력한 입자 인력 및 음향 변조.
- **Snap (손가락 튕기기)**: 다음 곡/트랙 전환.

### 🎧 2D 공간 음향 모드
- **모드 전환**: Hand tracking control / Keyboard control.
- **키보드 조작**:
  - `W / A / S / D`: 왼쪽 음원 오브 이동
  - `방향키 (↑ / ↓ / ← / →)`: 오른쪽 음원 오브 이동

### 🕶️ 3D VR 모드
- **VR 헤드셋 접속 시**: VR 컨트롤러 레이캐스팅으로 오디오 오브 조작.
- **데스크톱 폴백 시**: 마우스 드래그 (`OrbitControls`) 및 마우스 휠을 통한 음원 깊이 조절.


