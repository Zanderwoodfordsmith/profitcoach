import type { FunnelStatus } from "@/lib/funnelCompute";

const STYLES: Record<FunnelStatus, { label: string; className: string }> = {
  green: {
    label: "On track",
    className: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  },
  yellow: {
    label: "Needs work",
    className: "bg-amber-50 text-amber-900 ring-amber-200",
  },
  red: {
    label: "Constraint",
    className: "bg-rose-50 text-rose-900 ring-rose-200",
  },
  na: {
    label: "N/A",
    className: "bg-zinc-50 text-zinc-800 ring-zinc-200",
  },
};

export function StatusBadge({ status }: { status: FunnelStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        s.className,
      ].join(" ")}
      aria-label={`Status: ${s.label}`}
    >
      {s.label}
    </span>
  );
}

