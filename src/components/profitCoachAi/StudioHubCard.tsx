import Link from "next/link";

type Props = {
  href?: string;
  /** When set, renders a button instead of a link (e.g. in-panel skill pick). */
  onSelect?: () => void;
  /** Called before following `href` (e.g. close the AI panel overlay). */
  onNavigate?: () => void;
  eyebrow: string;
  eyebrowClassName?: string;
  title: string;
  description: string;
  accentClassName: string;
  ctaLabel?: string;
};

export function StudioHubCard({
  href,
  onSelect,
  onNavigate,
  eyebrow,
  eyebrowClassName = "text-sky-700",
  title,
  description,
  accentClassName,
  ctaLabel = "Open",
}: Props) {
  const shellClass =
    "group flex h-full w-full flex-col overflow-hidden rounded-xl border border-white/80 bg-white/35 text-left shadow-[0_16px_44px_rgba(15,23,42,0.14),0_3px_10px_rgba(15,23,42,0.06)] backdrop-blur-xl ring-1 ring-inset ring-white/55 transition duration-300 hover:bg-white/45 hover:shadow-[0_28px_56px_rgba(15,23,42,0.24),0_8px_18px_rgba(15,23,42,0.1),0_0_0_1px_rgba(12,82,144,0.12),0_0_22px_rgba(12,82,144,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400";

  const inner = (
    <>
      <div className={`relative aspect-[16/9] overflow-hidden ${accentClassName}`}>
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 20%, rgba(255,255,255,0.35), transparent 42%), radial-gradient(circle at 88% 70%, rgba(255,255,255,0.18), transparent 45%)",
          }}
          aria-hidden
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${eyebrowClassName}`}
        >
          {eyebrow}
        </p>
        <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600">
          {description}
        </p>
        <p className="mt-auto pt-4 text-sm font-medium text-sky-800 group-hover:text-sky-950">
          {ctaLabel}
          <span aria-hidden className="ml-1 inline-block transition group-hover:translate-x-0.5">
            →
          </span>
        </p>
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} className={shellClass}>
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={href ?? "#"}
      className={shellClass}
      onClick={() => onNavigate?.()}
    >
      {inner}
    </Link>
  );
}
