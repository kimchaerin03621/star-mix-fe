# 🌌 WOOJOO PLAY: DESIGN SYSTEM & UI SPECIFICATION (DESIGN.md)

본 문서는 **WOOJOO PLAY (STARMix)** 프로젝트의 시각적 일관성과 완성도를 보장하기 위한 **공식 디자인 시스템 명세서**입니다.

---

> [!CAUTION]
> ### 🚨 [CRITICAL RULE] 규칙 미정의 수치 사용 엄격 금지 (Strict Token Enforcement)
> 1. **본 디자인 시스템(`DESIGN.md`)에 명시되지 않은 임의의 색상, 폰트 크기, 패딩, 마진, 테두리 수치의 사용을 절대 금지합니다.**
> 2. CSS 및 Inline Style 작성 시 하드코딩된 아비트러리 수치(예: `font-size: 13px`, `margin: 17px`, `color: #fa318b` 등)는 사용할 수 없으며, **반드시 본 문서에 정의된 표준 CSS 변수(`var(--token-name)`)만 사용**해야 합니다.
> 3. 새로운 스타일 수치가 필요한 경우 본 명세서를 먼저 개정한 후 코드에 반영해야 합니다.

---

## 1. 🎨 비주얼 아이덴티티 및 메인 컨셉 (Visual Concept)

* **핵심 타겟 룩앤필**: 심우주(Deep Space)의 암흑 배경 위에 피어나는 핑크-시안 네온 가시광선과 볼륨메트릭 빛 구름(Volumetric Light Cloud).
* **오비탈 인터페이스 (Orbital System)**: 캡처 화면과 같이 사선 타원 궤도(-12° Tilt Ellipse) 위에 떠 있는 4개의 천체 노드가 3D 입체감과 심도를 가지며 회전하는 유기적 우주 공간.

---

## 2. 💎 디자인 토큰 명세 (Design Tokens)

### 2.1 색상 시스템 (Color Palette)

| 토큰 이름 | 표준 값 | 용도 / 적용 대상 |
|---|---|---|
| `--color-primary` | `#ff007f` | 메인 네온 핑크 (버튼 강조, 포커스, 핑크 입자) |
| `--color-primary-hover` | `#ff3399` | 핑크 요소 호버 상태 |
| `--color-primary-soft` | `#f8c8dc` | 파스텔 핑크 (오비탈 오르브 1, 3 노드 및 파동) |
| `--color-secondary` | `#00ffcc` | 메인 네온 시안 (3D Sound Space, HUD 텍스트) |
| `--color-secondary-hover` | `#5ce1e6` | 시안 요소 호버 상태 |
| `--color-white` | `#ffffff` | 순백색 (화이트 입자, 코어 라이트, 메인 타이틀) |
| `--bg-space-black` | `#000000` | 캔버스 및 앱 최하단 무한 암흑 배경 |
| `--bg-surface-dark` | `#050814` | 모달 및 팝업 카드의 기본 다크 배경 |
| `--bg-glass-panel` | `rgba(10, 14, 24, 0.75)` | 블러 처리된 글래스모피즘 HUD/컨트롤 패널 |
| `--text-primary` | `#ffffff` | 100% 가독 강조 (타이틀, 라벨 메인 텍스트) |
| `--text-secondary` | `rgba(255, 255, 255, 0.75)` | 75% 일반 본문 및 정보 텍스트 |
| `--text-muted` | `rgba(255, 255, 255, 0.45)` | 45% 오비탈 서브타이틀, 보조 설명 |
| `--color-error` | `#ff3b30` | 에러 및 경고 상태 표시 |
| `--color-success` | `#00ff7f` | 성공 및 활성 상태 표시 |

---

### 2.2 서체 및 타이포그래피 스케일 (Typography System)

#### 폰트 패밀리 (Font Family)
* **메인 UI / Body**: `'Pretendard Variable', Pretendard, 'Noto Sans KR', sans-serif`
* **헤더 / 디지털 HUD**: `'Share Tech Mono', 'Courier New', monospace`
* **디스플레이 타이틀**: `'Orbitron', 'Chakra Petch', sans-serif`

#### 타입 스케일 (7-Stage Type Scale)
> 🚨 명시된 7가지 크기 이외의 `font-size` 사용 금지

| 토큰 이름 | 표준 수치 (px / rem) | 적용 가이드 |
|---|---|---|
| `--font-xs` | `0.75rem` (12px) | 슬라이더 라벨, 뱃지, 태그 수치 |
| `--font-sm` | `0.875rem` (14px) | 오비탈 노드 서브타이틀(`orbit-desc`), 카테고리 본문 |
| `--font-base` | `1.0rem` (16px) | 메인 오비탈 라벨(`orbit-label`), 기본 버튼, 본문 |
| `--font-lg` | `1.25rem` (20px) | 소타이틀, 필 버튼(`pill-btn`), 모달 헤더 |
| `--font-xl` | `1.5rem` (24px) | 상단 글로벌 헤더 로고(`WOOJOO PLAY`), 섹션 타이틀 |
| `--font-2xl` | `2.25rem` (36px) | 모달 대타이틀, 컨트롤러 타이틀 |
| `--font-display` | `3.5rem` (56px) | 메인 인트로 및 디스플레이 타이틀 |

---

### 2.3 간격 및 여백 시스템 (Spacing System - 8pt/4pt Grid)
> 🚨 아래의 6가지 간격 토큰 수치로만 `gap`, `padding`, `margin` 설정 가능

| 토큰 이름 | 규격 수치 | 사용 예시 |
|---|---|---|
| `--space-2xs` | `4px` | 미세 간격 (아이콘과 텍스트 사이) |
| `--space-xs` | `8px` | 버튼 내부 요소 간격, 태그 gap |
| `--space-sm` | `12px` | 입력 폼 gap, 모달 내부 요소 gap |
| `--space-md` | `16px` | 카드 패딩, 글로벌 헤더 가로 요소 gap |
| `--space-lg` | `24px` | 패널 내부 여백, 오비탈 라벨 top margin |
| `--space-xl` | `36px` | 글로벌 헤더 상단/좌우 여백, 섹션 간 여백 |

---

### 2.4 모서리 및 그래픽 효과 (Shape & Elevation)

#### 모서리 둥글기 (Border Radius)
* `--radius-sm`: `8px` (입력 폼, 툴팁)
* `--radius-md`: `16px` (카드, 버튼, 컴포넌트 컨테이너)
* `--radius-lg`: `24px` (글래스모피즘 모달, 메인 팝업)
* `--radius-full`: `9999px` (알약형 버튼 `pill-btn`, 원형 천체 오르브)

#### 빛 효과 및 효과음 (Glow & Glassmorphism)
* **글로벌 헤더 타이틀 섀도우**: `text-shadow: 0 0 12px rgba(255, 255, 255, 0.4)`
* **오비탈 오르브 서라운드 글로우**: `box-shadow: 0 0 50px var(--color-primary), 0 0 90px rgba(248, 200, 220, 0.6)`
* **알약 버튼 호버 글로우**: `box-shadow: 0 0 20px rgba(255, 92, 157, 0.7), 0 0 35px rgba(248, 200, 220, 0.4)`
* **글래스모피즘 백드롭 블러**: `backdrop-filter: blur(12px)` ~ `blur(25px)`

---

## 3. 🖥️ 메인 뷰 UI 컴포넌트 명세 (Main Stage Spec)

### 3.1 상단 고정 글로벌 헤더 (Global Header)
* **위치**: `position: fixed; top: 0; left: 0; right: 0; height: 80px; padding: 0 var(--space-xl)`
* **좌측 로고 (`WOOJOO PLAY`)**:
  * Font: `'Share Tech Mono'`, Size: `--font-xl` (`1.5rem`), Color: `--color-white`
  * Letter-spacing: `0.2em`, Text-transform: `uppercase`
  * Hover: `text-shadow: 0 0 20px rgba(255, 92, 157, 0.8), 0 0 35px #ffffff`
* **우측 액션 버튼 (`Star Edit`, `Control Room`)**:
  * Shape: Pill (`border-radius: var(--radius-full)`)
  * Size: `padding: var(--space-xs) var(--space-lg)` (`8px 24px`), Font: `--font-sm` (`0.88rem`)
  * Style: `background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.7)`

### 3.2 사선 궤도 스테이지 (Tilted Orbit Stage)
* **궤도 타원 트랙 (Ellipse Track)**:
  * RX: `380px`, RY: `120px`, Tilt: `-12deg`
  * Stroke: `rgba(255, 255, 255, 0.65)`, Stroke-width: `1.5px`
* **4개 오비탈 노드 구성**:
  1. `Sound Mixer` (설명: `좌우 음성 섞어보기` / Color: `#f8c8dc`)
  2. `Star Mixer` (설명: `은하수 탐험하기` / Color: `#ffffff`)
  3. `3D Sound Space` (설명: `3D 입체 공간에서 소리 조립하기` / Color: `#f8c8dc`)
  4. `Voice Cloud` (설명: `녹음해서 쌓아보기` / Color: `#ffffff`)
* **노드 라이트 오르브 (Volumetric Light Orb)**:
  * Outer Cloud: `width: 110px; height: 110px; filter: blur(14px); mix-blend-mode: screen`
  * Core Sphere: `width: 80px; height: 80px; filter: blur(6px)`
  * Hover: `scale(1.25)`, `filter: blur(4px) drop-shadow(...)`
* **노드 타이틀 & 서브타이틀**:
  * Label: `--font-base` (`1.05rem`), `--color-white`, `text-shadow: 0 0 10px rgba(255, 255, 255, 0.6)`
  * Desc: `--font-sm` (`0.8rem`), `--text-secondary`, `margin-top: 5px`

---

## 4. 💻 CSS 변수 구현 (`src/index.css` 규격)

```css
:root {
  /* Colors */
  --color-primary: #ff007f;
  --color-primary-hover: #ff3399;
  --color-primary-soft: #f8c8dc;
  --color-secondary: #00ffcc;
  --color-secondary-hover: #5ce1e6;
  --color-white: #ffffff;
  
  --bg-space-black: #000000;
  --bg-surface-dark: #050814;
  --bg-glass-panel: rgba(10, 14, 24, 0.75);
  
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.75);
  --text-muted: rgba(255, 255, 255, 0.45);
  --text-disabled: rgba(255, 255, 255, 0.20);
  
  --color-error: #ff3b30;
  --color-success: #00ff7f;

  /* Typography Scale */
  --font-xs: 0.75rem;
  --font-sm: 0.875rem;
  --font-base: 1.0rem;
  --font-lg: 1.25rem;
  --font-xl: 1.5rem;
  --font-2xl: 2.25rem;
  --font-display: 3.5rem;

  /* Spacing Scale */
  --space-2xs: 4px;
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 36px;

  /* Border Radius Scale */
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-full: 9999px;
}
```
