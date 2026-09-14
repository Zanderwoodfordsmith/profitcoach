/** Compact Instagram mark for campaign channel pills. */
export function InstagramGlyph({
  className = "h-3.5 w-3.5",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#E1306C" />
      <rect
        x="7"
        y="7"
        width="10"
        height="10"
        rx="3"
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.4" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="15.2" cy="8.8" r="0.8" fill="#fff" />
    </svg>
  );
}
