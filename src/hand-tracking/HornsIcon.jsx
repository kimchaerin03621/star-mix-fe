// The "horns" hand (index and little finger up), drawn as thin lines to match the rest of the
// screen. Takes its color from the text around it; `size` is in pixels.
export function HornsPaths() {
  return (
    <>
      <path d="M6.5 12.5V4.8a1.5 1.5 0 0 1 3 0V10" />
      <path d="M9.5 10a1.6 1.6 0 0 1 3.2 0" />
      <path d="M12.7 10a1.6 1.6 0 0 1 3.2 0" />
      <path d="M15.9 10V6.8a1.5 1.5 0 0 1 3 0V15.5c0 3.2-2.4 5.5-5.6 5.5H11c-2.6 0-4.5-1.9-4.5-4.4V13" />
      <path d="M6.5 15.4 4.3 13.2a1.2 1.2 0 0 1 1.7-1.7l.5.5" />
    </>
  );
}

export function HornsIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none' }}
    >
      <HornsPaths />
    </svg>
  );
}
