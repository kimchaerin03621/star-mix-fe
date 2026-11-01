import { HornsIcon } from './HornsIcon';

// Each line is a string, or { text, horns: true } to put the horns hand icon in front of it.
export function GestureHint({ lines }) {
  return (
    <div
      className="gesture-hint"
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 72,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        letterSpacing: '0.06em',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {lines.map((line) => {
        const { text, horns } = typeof line === 'string' ? { text: line } : line;
        return (
          <span key={text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {horns && <HornsIcon size={22} />}
            {text}
          </span>
        );
      })}
    </div>
  );
}
