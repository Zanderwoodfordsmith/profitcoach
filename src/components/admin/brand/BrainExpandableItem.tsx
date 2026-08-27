"use client";

type BrainExpandableItemProps = {
  id: string;
  open: boolean;
  onToggle: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
};

export function BrainExpandableItem({
  open,
  onToggle,
  title,
  subtitle,
  badges,
  trailing,
  children,
}: BrainExpandableItemProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{title}</span>
          {subtitle ? (
            <span className="mt-0.5 block text-xs leading-snug text-slate-500">
              {subtitle}
            </span>
          ) : null}
        </span>
        {badges ? (
          <span className="flex flex-wrap items-center gap-1.5">{badges}</span>
        ) : null}
        {trailing}
        <span className="text-xs text-slate-400">{open ? "Hide" : "Open"}</span>
      </button>
      {open ? (
        <div className="border-t border-slate-200 px-4 py-4">{children}</div>
      ) : null}
    </div>
  );
}
