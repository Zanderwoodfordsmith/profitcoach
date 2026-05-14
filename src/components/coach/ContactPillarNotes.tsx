"use client";

const PILLARS: {
  key: "foundation" | "vision" | "velocity" | "value";
  label: string;
}[] = [
  { key: "foundation", label: "Foundation" },
  { key: "vision", label: "Clarify Vision" },
  { key: "velocity", label: "Control Velocity" },
  { key: "value", label: "Create Value" },
];

type Props = {
  pillarNotes: Partial<Record<string, string>>;
  onChange: (next: Partial<Record<string, string>>) => void;
  disabled?: boolean;
};

export function ContactPillarNotes({ pillarNotes, onChange, disabled }: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Session notes by pillar</h3>
      <p className="text-xs text-slate-600">
        Capture what you discussed; saved automatically while you work.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {PILLARS.map(({ key, label }) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-700">{label}</span>
            <textarea
              className="min-h-[72px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 outline-none ring-sky-500 focus:border-sky-300 focus:ring-1 disabled:opacity-60"
              value={pillarNotes[key] ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ [key]: e.target.value })}
              placeholder="Notes for this pillar…"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
