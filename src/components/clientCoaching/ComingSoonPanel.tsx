"use client";

type Props = {
  title: string;
  description: string;
};

export function ComingSoonPanel({ title, description }: Props) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white px-6 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
        Coming next
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
        {description}
      </p>
    </section>
  );
}
