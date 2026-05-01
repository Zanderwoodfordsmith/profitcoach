import type { ReactNode } from "react";

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="relative inline-flex group">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs leading-5 text-zinc-700 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

