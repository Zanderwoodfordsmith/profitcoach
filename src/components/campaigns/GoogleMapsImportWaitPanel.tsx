"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import {
  formatGoogleMapsApproxDuration,
  googleMapsImportProgressPercent,
} from "@/lib/googleMaps/cost";

const WAIT_BEATS = [
  "Scanning Google Maps for matching businesses…",
  "Opening each listing for details…",
  "Pulling phones, websites, and emails…",
  "Looking for people to message on LinkedIn…",
  "You can leave this page — the import keeps running.",
] as const;

type Props = {
  progressCount: number;
  targetCount: number;
  startedAt: string | null;
  phase?: "scraping" | "finalizing";
  peopleFound?: number;
  listName?: string | null;
  compact?: boolean;
};

export function GoogleMapsImportWaitPanel({
  progressCount,
  targetCount,
  startedAt,
  phase = "scraping",
  peopleFound = 0,
  listName,
  compact = false,
}: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [beatIndex, setBeatIndex] = useState(0);
  const startedAtMs = startedAt ? Date.parse(startedAt) : Date.now();
  const safeStarted = Number.isFinite(startedAtMs) ? startedAtMs : Date.now();

  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setBeatIndex((i) => (i + 1) % WAIT_BEATS.length);
    }, 4500);
    return () => window.clearInterval(tick);
  }, []);

  const pct = googleMapsImportProgressPercent({
    progressCount,
    targetCount,
    startedAtMs: safeStarted,
    nowMs,
    phase,
  });
  const eta = formatGoogleMapsApproxDuration(targetCount);
  const headline =
    phase === "finalizing"
      ? "Saving into your pool…"
      : progressCount > 0
        ? "Finding businesses…"
        : "Starting Google Maps search…";

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-orange-50/40 to-sky-50 px-4 py-4"
          : "mx-auto max-w-md rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-orange-50/50 to-sky-50 px-5 py-6 shadow-sm"
      }
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <MapPin className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Loader2
              className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-700"
              aria-hidden
            />
            <p className="text-sm font-semibold text-amber-950">{headline}</p>
          </div>
          {listName ? (
            <p className="mt-0.5 truncate text-xs text-amber-900/70">
              {listName}
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-snug text-amber-950/80 transition-opacity duration-500">
            {phase === "finalizing"
              ? "Almost done — writing businesses into your pool and list."
              : WAIT_BEATS[beatIndex]}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-amber-900/80">
          <span className="tabular-nums">
            {phase === "finalizing"
              ? `${Math.max(progressCount, 0).toLocaleString()} found · saving`
              : targetCount > 0
                ? `${progressCount.toLocaleString()} / ${targetCount.toLocaleString()} businesses`
                : `${progressCount.toLocaleString()} found`}
          </span>
          <span className="shrink-0">{eta}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-amber-200/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-sky-600 transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-amber-900/65">
          <span>{pct}% complete</span>
          {peopleFound > 0 ? (
            <span>
              {peopleFound.toLocaleString()}{" "}
              {peopleFound === 1 ? "person" : "people"} with LinkedIn so far
            </span>
          ) : progressCount > 0 ? (
            <span>Still hunting for people on LinkedIn…</span>
          ) : (
            <span>First results usually appear after ~30–60 seconds</span>
          )}
        </div>
      </div>
    </div>
  );
}
