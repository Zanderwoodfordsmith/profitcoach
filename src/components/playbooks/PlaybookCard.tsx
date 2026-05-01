"use client";

import Link from "next/link";

import type { PlaybookSummary } from "@/lib/playbookContentTypes";

export type { PlaybookSummary };

const DESCRIPTION_PLACEHOLDER = "Content coming soon.";

type ScoreVariant = 0 | 1 | 2 | undefined;
type StatusVariant = "locked" | "in_progress" | "implemented";

const CARD_COLORS = {
  red: "#FFD7D8",
  yellow: "#FCF3DC",
  green: "#E8F4E8",
} as const;

const SCORE_STYLES: Record<NonNullable<ScoreVariant>, { bg: string; icon: string; border: string }> = {
  0: { bg: CARD_COLORS.red, icon: "text-red-800", border: "border-red-200" },
  1: { bg: CARD_COLORS.yellow, icon: "text-amber-800", border: "border-amber-200" },
  2: { bg: CARD_COLORS.green, icon: "text-emerald-800", border: "border-emerald-200" },
};

const STATUS_STYLES: Record<StatusVariant, { bg: string; icon: string; border: string }> = {
  locked: { bg: "#f8fafc", icon: "text-slate-600", border: "border-slate-200" },
  in_progress: { bg: CARD_COLORS.yellow, icon: "text-amber-800", border: "border-amber-200" },
  implemented: { bg: CARD_COLORS.green, icon: "text-emerald-800", border: "border-emerald-200" },
};

const DEFAULT_STYLE = {
  bg: "#f8fafc",
  icon: "text-slate-700",
  border: "border-slate-200",
};

function PlaybookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Geometric floral motif - overlapping petal shapes in a circle */}
      <circle cx="24" cy="24" r="6" opacity="0.4" />
      <ellipse cx="36" cy="24" rx="6" ry="10" opacity="0.9" />
      <ellipse cx="30" cy="14" rx="6" ry="10" transform="rotate(-60 30 14)" opacity="0.9" />
      <ellipse cx="18" cy="14" rx="6" ry="10" transform="rotate(60 18 14)" opacity="0.9" />
      <ellipse cx="12" cy="24" rx="6" ry="10" opacity="0.9" />
      <ellipse cx="18" cy="34" rx="6" ry="10" transform="rotate(-60 18 34)" opacity="0.9" />
      <ellipse cx="30" cy="34" rx="6" ry="10" transform="rotate(60 30 34)" opacity="0.9" />
    </svg>
  );
}

type PlaybookCardProps = {
  summary: PlaybookSummary;
  href: string;
  /** Score 0=red, 1=amber, 2=green. Used for client view with assessment. */
  score?: ScoreVariant;
  /** Status for coach view. Overrides score if both provided. */
  status?: StatusVariant;
  /** If true, card appears muted (e.g. locked playbook) */
  locked?: boolean;
};

export function PlaybookCard({
  summary,
  href,
  score,
  status,
  locked = false,
}: PlaybookCardProps) {
  const useStatus = status !== undefined;
  const style = useStatus
    ? STATUS_STYLES[status]
    : score !== undefined
      ? SCORE_STYLES[score]
      : DEFAULT_STYLE;

  const iconClass = locked ? "text-slate-400" : style.icon;
  const hasDescription = Boolean(summary.description?.trim());
  const displayDescription = hasDescription ? summary.description : DESCRIPTION_PLACEHOLDER;

  return (
    <Link
      href={href}
      className={`group flex min-w-0 flex-col rounded-2xl border p-5 pt-8 transition-all duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 ${
        style.border
      } ${locked ? "opacity-80" : ""}`}
      style={{
        background: style.bg,
        aspectRatio: "160/244",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.04)",
      }}
    >
      <div className="relative flex shrink-0 justify-center">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div
            className="absolute inset-0 rounded-full blur-2xl"
            style={{
              background: "radial-gradient(circle at center, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 60%)",
            }}
          />
          <div className="relative z-10">
            <PlaybookIcon className={`h-14 w-14 shrink-0 ${iconClass}`} />
          </div>
        </div>
      </div>
      <div className="mt-auto flex flex-1 flex-col justify-end pb-1 pt-6">
        <h3
          className="text-left text-base font-semibold leading-tight group-hover:text-sky-700"
          style={{ color: "rgba(0,0,0,0.8)" }}
        >
          {summary.name}
        </h3>
        <p
          className={`mt-2 line-clamp-2 min-h-[2.5rem] text-left text-sm leading-relaxed ${
            hasDescription ? "" : "italic"
          }`}
          style={{ color: hasDescription ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.5)" }}
        >
          {displayDescription}
        </p>
        <div className="mt-3 text-left text-xs" style={{ color: "rgba(0,0,0,0.5)" }}>
          {summary.playCount} {summary.playCount === 1 ? "action" : "actions"}
        </div>
      </div>
    </Link>
  );
}
