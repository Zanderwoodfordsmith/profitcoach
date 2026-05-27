type FilterSlidersIconProps = {
  className?: string;
};

/** Two horizontal lines with slider dots — used for filter menus app-wide. */
export function FilterSlidersIcon({ className }: FilterSlidersIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M2 5.25h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle
        cx="10.25"
        cy="5.25"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M2 10.75h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle
        cx="5.75"
        cy="10.75"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
