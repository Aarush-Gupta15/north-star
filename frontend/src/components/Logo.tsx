export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M16 2 5 6.5V15c0 7 4.6 11.6 11 14.8C22.4 26.6 27 22 27 15V6.5L16 2Z"
        fill="url(#g)"
        stroke="#6366f1"
        strokeWidth="1.2"
      />
      <path d="M11 16.2 14.5 19.7 21 12.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="g" x1="5" y1="2" x2="27" y2="29.8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" stopOpacity="0.35" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0.08" />
        </linearGradient>
      </defs>
    </svg>
  );
}
