/** Compact Facebook Messenger mark for campaign channel pills. */
export function MessengerGlyph({
  className = "h-3.5 w-3.5",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#0084FF" />
      <path
        fill="#fff"
        d="M12 6.4c-3.2 0-5.7 2.3-5.7 5.2 0 1.64.8 3.1 2.08 4.08V18l1.9-1.05c.53.15 1.1.23 1.72.23 3.2 0 5.7-2.3 5.7-5.2S15.2 6.4 12 6.4zm.56 7.02l-1.46-1.56-2.85 1.56 3.13-3.03 1.5 1.55 2.8-1.55-3.12 3.03z"
      />
    </svg>
  );
}
