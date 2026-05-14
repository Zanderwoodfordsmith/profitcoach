"use client";

import Image from "next/image";
import Link from "next/link";

import { LEVELS } from "@/lib/bossData";
import type { PlaybookSummary } from "@/lib/playbookContentTypes";

export type { PlaybookSummary };

const DESCRIPTION_PLACEHOLDER = "What this playbook covers and why it matters—a concise overview so you know before you dive in.";

type ScoreVariant = 0 | 1 | 2 | undefined;
type StatusVariant = "locked" | "in_progress" | "implemented";

/** Soft hero bands per BOSS area — same palette language as the blog index hero. */
const AREA_HERO_GRADIENTS: readonly string[] = [
  "linear-gradient(145deg, rgb(252 231 243) 0%, rgb(233 213 255) 42%, rgb(224 242 254) 100%)",
  "linear-gradient(145deg, rgb(219 234 254) 0%, rgb(207 250 254) 48%, rgb(254 249 195) 100%)",
  "linear-gradient(145deg, rgb(254 215 170) 0%, rgb(253 230 224) 45%, rgb(224 242 254) 100%)",
  "linear-gradient(145deg, rgb(204 251 241) 0%, rgb(221 214 254) 50%, rgb(254 202 202) 100%)",
  "linear-gradient(145deg, rgb(207 250 254) 0%, rgb(224 231 255) 48%, rgb(243 232 255) 100%)",
  "linear-gradient(145deg, rgb(186 230 253) 0%, rgb(221 214 254) 45%, rgb(254 240 240) 100%)",
  "linear-gradient(145deg, rgb(165 243 252) 0%, rgb(191 219 254) 48%, rgb(251 207 232) 100%)",
  "linear-gradient(145deg, rgb(199 210 254) 0%, rgb(207 250 254) 42%, rgb(233 213 255) 100%)",
  "linear-gradient(145deg, rgb(153 246 228) 0%, rgb(224 231 255) 48%, rgb(254 202 202) 100%)",
  "linear-gradient(145deg, rgb(228 230 255) 0%, rgb(254 215 170) 46%, rgb(224 242 254) 100%)",
];

const SCORE_BAR: Record<NonNullable<ScoreVariant>, string> = {
  0: "bg-rose-400/90",
  1: "bg-amber-400/90",
  2: "bg-emerald-400/90",
};

const STATUS_LABEL: Record<StatusVariant, string> = {
  locked: "Locked",
  in_progress: "In progress",
  implemented: "Implemented",
};

type PlaybookCardProps = {
  summary: PlaybookSummary;
  href: string;
  score?: ScoreVariant;
  status?: StatusVariant;
  locked?: boolean;
};

export function areaHeroGradient(areaId: number): string {
  const safe = Math.max(0, Math.min(AREA_HERO_GRADIENTS.length - 1, areaId));
  return AREA_HERO_GRADIENTS[safe] ?? AREA_HERO_GRADIENTS[0]!;
}

export function PlaybookCard({
  summary,
  href,
  score,
  status,
  locked = false,
}: PlaybookCardProps) {
  const useStatus = status !== undefined;
  const heroGradient = areaHeroGradient(summary.area);
  const hasDescription = Boolean(summary.description?.trim());
  const displayDescription = hasDescription ? summary.description : DESCRIPTION_PLACEHOLDER;

  const levelName = LEVELS.find((l) => l.id === summary.level)?.name ?? `Level ${summary.level}`;
  const metaLine = `Level ${summary.level} · ${levelName}`;

  const cover = summary.coverImageUrl?.trim();

  return (
    <Link
      href={href}
      className={`group flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-white text-left shadow-[0_2px_14px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-slate-300/90 hover:shadow-[0_18px_44px_-16px_rgba(12,82,144,0.38)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290] focus-visible:ring-offset-2 ${
        locked ? "opacity-[0.92]" : ""
      }`}
    >
      <div className="relative">
        {cover ? (
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
            {cover.startsWith("http://") || cover.startsWith("https://") ? (
              // Covers may come from external CDNs not configured in next.config images.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={summary.name}
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <Image
                src={cover}
                alt={summary.name}
                fill
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 18vw"
              />
            )}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/35 via-transparent to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent"
              aria-hidden
            />
          </div>
        ) : (
          <div
            className="relative aspect-[16/10] w-full overflow-hidden"
            style={{
              background: heroGradient,
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/45 via-transparent to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/25 blur-2xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-10 left-1/4 h-28 w-52 rounded-full bg-[#0c5290]/10 blur-3xl"
              aria-hidden
            />
          </div>
        )}

        {(locked || useStatus) && (
          <div className="absolute right-3 top-3 flex flex-wrap items-center justify-end gap-1.5">
            {locked ? (
              <span className="rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
                Locked
              </span>
            ) : null}
            {useStatus ? (
              <span className="rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
                {STATUS_LABEL[status]}
              </span>
            ) : null}
          </div>
        )}

        {score !== undefined && !useStatus ? (
          <div className={`h-1 w-full ${SCORE_BAR[score]}`} aria-hidden />
        ) : (
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-slate-200/80 to-transparent" aria-hidden />
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0c5290] sm:text-[11px]">
          {metaLine}
        </p>
        <h3 className="mt-2.5 font-semibold leading-snug tracking-[-0.02em] text-slate-900 transition-colors group-hover:text-[#0c5290] sm:text-[1.125rem]">
          {summary.name}
        </h3>
        <p
          className={`mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600 ${
            hasDescription ? "" : "italic text-slate-500"
          }`}
        >
          {displayDescription}
        </p>
        <p className="mt-auto pt-5 text-sm font-semibold text-slate-900">
          Open playbook{" "}
          <span
            className="inline-block transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden
          >
            →
          </span>
        </p>
        <p className="mt-2 text-xs text-slate-400">
          {summary.playCount} {summary.playCount === 1 ? "action" : "actions"} inside
        </p>
      </div>
    </Link>
  );
}
