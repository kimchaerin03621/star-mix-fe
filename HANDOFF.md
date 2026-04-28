# 🚀 STARMix: Evolution Handoff Document

이 문서는 프로젝트의 원본 3D 엔진 안정화 작업(Rollback)과 그 이후에 추가된 실험적 DJ 컨트롤러 기능들을 통합한 최종 핸드오프 문서입니다.

---

## 1. 프로젝트 개요
- **프로젝트 명**: STARMix (DJ Controller for Space & Sound)
- **핵심 컨셉**: 웹캠 기반의 손 추적을 통해 은하계 입자들을 조작하고, 실시간 프리셋과 BPM 조절을 통해 입체 음향을 믹싱하는 차세대 가상 DJ 인터페이스.
- **현재 상태**: XR/VR 안정화 롤백 이후, 2D/3D 하이브리드 최적화를 통해 60FPS의 안정적인 퍼포먼스와 고도화된 음향 제어 기능을 확보함.

## 2. 핵심 기술 스택
- **Frontend**: React 19, Vite
- **Rendering**: Canvas 2D / Three.js (최적화 버전)
- **AI Vision**: MediaPipe (Hands)
- **Audio Engine**: Web Audio API (PannerNode, BiquadFilterNode, 타임 스트레칭)

## 3. 주요 구현 기능 (통합)

### 🌌 엔진 안정성 및 시뮬레이션 (Core)
- **NaN Guard**: 롤백을 통해 WebGL 충돌 및 블랙 스크린 현상을 원천 차단.
- **동적 입자 물리**: 1,500개의 입자에 적용된 척력, 소용돌이, 스프링 복원력.
- **하이퍼 스테레오**: 별 무리의 무게 중심(Centroid)을 계산하여 실시간으로 패닝과 가중치 볼륨을 조절하는 Spectacle Stereo v3 엔진.

### 🎧 실험적 오디오 프리셋 (New)
- **PRESET 1 (Quadrant EQ)**: 화면 사분면 위치에 따라 Low/Mid/High EQ와 로우패스 필터를 직관적으로 믹싱.
- **PRESET 2 (NDS Style)**: X축(재생 속도), Y축(필터 및 공명)을 활용한 클래식 휴대용 게임기 스타일의 음색 제어.

### 🎚️ 정밀 BPM 제어 시스템 (New)
- **Dual BPM Sliders**: 마우스를 이용해 왼쪽/오른쪽 음원의 속도를 개별 조절 (0.5x ~ 1.5x).
- **Pitch Lock**: `preservesPitch` 기술을 적용하여 속도 변화에도 음높이가 일정하게 유지됨.
- **BPM Sync**: 곡 변경 시 자동으로 BPM을 초기화하며, 실시간으로 변화된 BPM 수치를 시각화.

### 🎵 스마트 곡 전환 시스템 (New)
- **Song 1, 2, 3**: 개별 버튼을 통한 즉각적인 곡 교체.
- **Restart Logic**: 이미 선택된 곡이라도 클릭 시 처음부터 다시 시작하는 트리거 로직 구현.

## 4. 핵심 파일 안내
- `src/App.jsx`: 메인 UI 레이어, 곡/프리셋 상태 관리 및 BPM 슬라이더 로직.
- `src/components/Experience.jsx`: 시각적 입자 시뮬레이션 및 오디오 엔진(EQ, 필터, 재생 속도) 핵심 로직.
- `src/hooks/useHandTracking.js`: MediaPipe 설정 및 안정적인 손 인식 데이터 스트림 관리.
- `src/index.css`: 네온 핑크 테마의 디자인 시스템 및 별 모양 커스텀 슬라이더 스타일.

## 5. 향후 과제
- **멀티 핸드 재도입**: 안정성이 확보된 현재 엔진에 양손 독립 제어 로직을 다시 최적화하여 이식.
- **제스처 확장**: 주먹(Fist) 등 특정 손동작을 활용한 오디오 뮤트(Mute) 또는 특수 효과 트리거.

---
**Last Updated**: 2026-04-22
**Status**: Stable & Feature-Rich (High-Performance DJ Controller)
