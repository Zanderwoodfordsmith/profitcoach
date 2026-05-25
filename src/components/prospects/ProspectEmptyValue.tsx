export const PROSPECT_EMPTY_CHAR = "—";

export function ProspectEmptyValue({ className = "" }: { className?: string }) {
  return (
    <span
      className={`text-xs text-slate-300 ${className}`.trim()}
      aria-hidden
    >
      {PROSPECT_EMPTY_CHAR}
    </span>
  );
}
