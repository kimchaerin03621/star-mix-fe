import { HornsPaths } from './HornsIcon';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function UnmixProgress({ progress, label }) {
  if (progress <= 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        pointerEvents: 'none',
        zIndex: 60,
        color: '#fff',
      }}
    >
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={RADIUS} fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
        <circle
          cx="70"
          cy="70"
          r={RADIUS}
          fill="none"
          stroke="#ff5c9d"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          transform="rotate(-90 70 70)"
        />
        <svg x="40" y="40" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <HornsPaths />
        </svg>
      </svg>
      <span style={{ fontSize: 16, letterSpacing: '0.08em' }}>{label}</span>
    </div>
  );
}
