export function GestureHint({ lines }) {
  return (
    <div
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
      {lines.map((line) => <span key={line}>{line}</span>)}
    </div>
  );
}
