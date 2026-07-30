import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

type Props = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
};

/** Featured Start Here card for the simplified hub overview row. */
export function SimplifiedStartHereBanner({
  href,
  eyebrow,
  title,
  description,
}: Props) {
  return (
    <Link
      href={href}
      className="group relative flex h-full overflow-hidden rounded-3xl border border-[#0c5290]/15 bg-gradient-to-br from-[#0c5290] via-[#0a6bb5] to-[#1483c8] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 20%, rgba(255,255,255,0.35), transparent 42%), radial-gradient(circle at 88% 70%, rgba(255,255,255,0.18), transparent 45%)",
        }}
        aria-hidden
      />
      <div className="relative flex w-full flex-col gap-5 p-6">
        <div className="min-w-0">
          {eyebrow.trim() ? (
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/85">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {eyebrow}
            </p>
          ) : null}
          <h2
            className={`${eyebrow.trim() ? "mt-2" : ""} text-2xl font-semibold tracking-tight text-white`}
          >
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/85">
            {description}
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-4">
          <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-medium text-white/85 ring-1 ring-white/15">
            Begin with onboarding and your first actions
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#0c5290] shadow-sm transition group-hover:bg-sky-50">
            Open
            <ArrowRight
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </div>
    </Link>
  );
}
