"use client";

import type { ReactNode } from "react";

/** One option on the board: a letter, a name, why it might be right, then the design. */
export function Option({ letter, name, why, children, aside }: { letter: string; name: string; why: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start gap-3">
        <span className="ad-option-label shrink-0">{letter}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[19px] font-bold tracking-[-0.01em] text-[var(--ink)]">{name}</h3>
          <p className="mt-0.5 max-w-[68ch] text-[15px] leading-relaxed text-[var(--slate)]">{why}</p>
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function SectionIntro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-[72ch]">
      <h2 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--ink)]">{title}</h2>
      <div className="mt-2 text-[16px] leading-relaxed text-[var(--slate)]">{children}</div>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="ad-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
