// The first-visit tutorial: one step at a time, each a translucent explanation that is closed with
// "확인", then the visitor tries it and the next step comes once they succeed.
//
// A hand is described by which fingers are up: thumb is 'in' (folded), 'up' or 'out' (sideways, the
// L shape). `mouse` is the same move with the mouse, `hint` the one line shown while they try it.

export const FIST = { thumb: 'in', index: false, middle: false, ring: false, pinky: false };

export const TUTORIAL_STEPS = [
  {
    id: 'grab',
    title: '사운드 잡아 옮기기',
    lines: ['손바닥을 펴서 사운드 위에 올리면 사운드가 커져요.', '주먹을 쥐면 사운드를 잡고, 주먹을 움직이는 대로 따라옵니다.'],
    mouse: '마우스: 사운드를 누른 채 끌기',
    hint: '주먹을 쥐어 사운드를 잡고 옮겨 보세요',
    hands: [{ label: '주먹', pose: FIST }],
  },
  {
    id: 'push',
    title: '사운드 멀리 보내기',
    lines: ['사운드를 잡은 채, 반대 손의 검지를 펴 보세요.', '사운드가 멀어지고, 소리도 작고 먹먹해집니다.'],
    mouse: '마우스: 사운드를 누른 채 휠을 위로',
    hint: '사운드를 잡고, 반대 손 검지를 펴 보세요',
    hands: [
      { label: '잡은 손', pose: FIST },
      { label: '반대 손', pose: { ...FIST, index: true } },
    ],
  },
  {
    id: 'pull',
    title: '사운드 가까이 당기기',
    lines: ['사운드를 잡은 채, 반대 손의 엄지를 펴 보세요.', '사운드가 다가오고, 소리도 커지고 또렷해집니다.'],
    mouse: '마우스: 사운드를 누른 채 휠을 아래로',
    hint: '사운드를 잡고, 반대 손 엄지를 펴 보세요',
    hands: [
      { label: '잡은 손', pose: FIST },
      { label: '반대 손', pose: { ...FIST, thumb: 'up' } },
    ],
  },
  {
    id: 'orbit',
    title: '둘러보기',
    lines: ['엄지, 검지, 중지 세 손가락을 펴고 손을 움직여 보세요.', '공간 안에서 고개를 돌리듯 주위를 둘러볼 수 있어요.'],
    mouse: '마우스: 빈 곳을 누른 채 끌기',
    hint: '세 손가락을 펴고 손을 움직여 보세요',
    hands: [{ label: '세 손가락', pose: { thumb: 'up', index: true, middle: true, ring: false, pinky: false } }],
  },
  {
    id: 'zoom',
    title: '가까이 보기, 멀리 보기',
    lines: ['엄지와 검지로 L자를 만들고 벌렸다 오므려 보세요.', '벌릴수록 가까이, 오므릴수록 멀리 보입니다.'],
    mouse: '마우스: 휠 돌리기',
    hint: '엄지와 검지를 벌렸다 오므려 보세요',
    hands: [{ label: 'L자', pose: { thumb: 'out', index: true, middle: false, ring: false, pinky: false } }],
  },
];

// Timing and how much counts as "did it" (meters, radians, and the log of the zoom ratio).
export const TUTORIAL = {
  ACTIVE_WINDOW_MS: 3500, // the visitor counts as using it if they moved a hand or the mouse this recently
  START_DELAY_MS: 1400, // wait this long after they start before the first explanation
  SUCCESS_MS: 1600, // how long the "잘했어요" shows
  NEXT_DELAY_MS: 500, // then this long before the next explanation
  FINALE_MS: 3500, // the closing line
  MOVE_TO_GRAB: 0.5, // step 1: the sound was carried this far
  DEPTH_CHANGE: 1.0, // steps 2 and 3: the held sound went this much farther / nearer
  TURN_RADIANS: 0.45, // step 4: the view turned this much in total (about 26 degrees)
  ZOOM_LOG: 0.5, // step 5: the view zoomed by this much in total (a factor of about 1.6)
};
