"use client";

import { MetaDropdown, ScoreBars, ScoreChoice } from "./roadmapUi";

/** The pill row under a project's name (its page, the New project sheet, the New job composer), like Linear's. */

/** A property in the pill row: icon and value in a quiet rounded outline. */
export function PropertyPill({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-sm transition hover:border-slate-300 ${
        muted ? "text-slate-500" : "text-slate-800"
      }`}
    >
      {children}
    </span>
  );
}

export function ScorePillDropdown({
  label,
  icon: Icon,
  value,
  names,
  onChange,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number | null;
  names: Record<number, string>;
  onChange: (value: number | null) => void;
}) {
  return (
    <MetaDropdown
      bare
      display={
        <PropertyPill muted={!value}>
          <Icon className="h-3.5 w-3.5 text-slate-400" />
          {label}
          <ScoreBars value={value} label={label} names={names} />
        </PropertyPill>
      }
      options={[5, 4, 3, 2, 1].map((n) => ({
        key: String(n),
        selected: value === n,
        onSelect: () => onChange(n),
        node: <ScoreChoice value={n} label={label} names={names} />,
      }))}
      onClear={value ? () => onChange(null) : undefined}
    />
  );
}
