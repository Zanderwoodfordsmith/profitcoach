"use client";

type Props = {
  value: number;
  label: string;
};

/** Same outer height as ClassroomCardCta (`h-6`). */
const TRACK =
  "relative box-border h-6 w-full rounded-full border border-slate-300/50 bg-slate-200/90";

export function ClassroomCardProgress({ value, label }: Props) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const labelOutside = safeValue < 10;

  return (
    <div>
      <div className="sr-only">{label}</div>
      <div className={TRACK}>
        <div
          className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
          style={{ width: `${safeValue}%` }}
          role="progressbar"
          aria-valuenow={safeValue}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
        <span
          className={`pointer-events-none absolute top-1/2 z-10 text-[11px] font-semibold leading-none tabular-nums ${
            labelOutside ? "text-slate-500" : "text-white"
          }`}
          style={
            labelOutside
              ? { left: `calc(${safeValue}% + 0.35rem)`, transform: "translateY(-50%)" }
              : { left: `calc(${safeValue}% - 0.35rem)`, transform: "translate(-100%, -50%)" }
          }
        >
          {safeValue}%
        </span>
      </div>
    </div>
  );
}
