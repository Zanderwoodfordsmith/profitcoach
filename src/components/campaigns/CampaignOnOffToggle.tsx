"use client";

/** On/off switch used on the campaigns table and the pool “Add to campaign” menu. */
export function CampaignOnOffToggle({
  on,
  disabled,
  busy,
  onChange,
  size = "md",
  ariaLabel,
}: {
  on: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: () => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const compact = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={
        ariaLabel ?? (on ? "Turn campaign off" : "Turn campaign on")
      }
      disabled={disabled || busy}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`relative shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40 ${
        compact ? "h-5 w-10" : "h-6 w-12"
      } ${
        on
          ? "bg-emerald-700 focus-visible:ring-emerald-700/40"
          : "bg-rose-800 focus-visible:ring-rose-800/40"
      }`}
    >
      <span
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 font-bold tracking-wide text-white ${
          compact ? "text-[9px]" : "text-[10px]"
        } ${
          on
            ? compact
              ? "left-[5px]"
              : "left-[6px]"
            : compact
              ? "right-[5px]"
              : "right-[6px]"
        }`}
        aria-hidden
      >
        {on ? "On" : "Off"}
      </span>
      <span
        className={`absolute left-0.5 rounded-full bg-white shadow transition ${
          compact ? "top-0.5 h-4 w-4" : "top-0.5 h-5 w-5"
        } ${on ? (compact ? "translate-x-5" : "translate-x-6") : ""}`}
      />
    </button>
  );
}
