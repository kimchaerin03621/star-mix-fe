// A simple line drawing of a hand: which fingers are up, and where the thumb is ('in', 'up', 'out').
const FINGERS = [
  { key: 'index', x: 24, top: 22 },
  { key: 'middle', x: 37, top: 14 },
  { key: 'ring', x: 50, top: 22 },
  { key: 'pinky', x: 63, top: 32 },
];
const FINGER_WIDTH = 11;
const PALM_TOP = 62;

export function HandPose({ pose, size = 124 }) {
  return (
    <svg
      width={size}
      height={size * 1.0}
      viewBox="-16 4 112 112"
      fill="rgba(255,255,255,0.08)"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinejoin="round"
      aria-hidden="true"
      className="tutorial-hand"
    >
      {/* the palm */}
      <rect x="22" y={PALM_TOP} width="55" height="46" rx="15" />
      {/* the four fingers: up as long capsules, folded as short knuckles */}
      {FINGERS.map(({ key, x, top }) => (pose[key]
        ? <rect key={key} x={x} y={top} width={FINGER_WIDTH} height={PALM_TOP + 12 - top} rx={FINGER_WIDTH / 2} />
        : <rect key={key} x={x} y={PALM_TOP - 6} width={FINGER_WIDTH} height="16" rx={FINGER_WIDTH / 2} />))}
      {/* the thumb */}
      {pose.thumb === 'up' && <rect x="13" y="44" width={FINGER_WIDTH + 1} height="56" rx={FINGER_WIDTH / 2} transform="rotate(-8 19 100)" />}
      {pose.thumb === 'out' && <rect x="-12" y="84" width="46" height={FINGER_WIDTH + 1} rx={FINGER_WIDTH / 2} transform="rotate(10 24 90)" />}
      {pose.thumb === 'in' && <rect x="30" y="80" width="34" height={FINGER_WIDTH} rx={FINGER_WIDTH / 2} />}
    </svg>
  );
}
