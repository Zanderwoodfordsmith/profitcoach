type LinkedInSolidIconProps = {
  className?: string;
};

/** Official LinkedIn mark — opaque blue squircle, white “in”. */
export function LinkedInSolidIcon({ className }: LinkedInSolidIconProps) {
  return (
    <span
      aria-hidden
      className={`block shrink-0 overflow-hidden rounded-[22%] bg-[#0A66C2] ${className ?? ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, sized by caller */}
      <img
        src="/icons/linkedin.png"
        alt=""
        draggable={false}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
