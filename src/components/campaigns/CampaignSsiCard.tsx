"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, CircleHelp } from "lucide-react";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { DEMO_PREVIEW_SSI } from "@/lib/campaigns/demoPreview";
import { BOSS_PRO_RING_TRACK } from "@/lib/bossProDialGradients";

type SsiPillar = {
  id: string;
  label: string;
  score: number;
  max: number;
};

type SsiResponse = {
  available?: boolean;
  reason?: "not_connected" | "unavailable";
  message?: string;
  score?: number;
  industry_top?: number | null;
  network_top?: number | null;
  pillars?: SsiPillar[];
};

const PILLAR_META: Record<string, { color: string; info: string }> = {
  brand: {
    color: "#E65901",
    info: "Complete your profile with the customer in mind. Become a thought-leader by publishing meaningful posts.",
  },
  people: {
    color: "#827AE7",
    info: "Identify better prospects in less time using efficient search and research tools.",
  },
  engagement: {
    color: "#0A7885",
    info: "Discover and share conversation-worthy updates to create and grow relationships.",
  },
  relationships: {
    color: "#0591CD",
    info: "Strengthen your network by finding and establishing trust with decision makers.",
  },
};

function PillarInfoButton({ label, text }: { label: string; text: string }) {
  const panelId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(event: MouseEvent) {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="-m-0.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40 aria-expanded:bg-slate-100 aria-expanded:text-slate-600"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${label} info`}
      >
        <CircleHelp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </button>
      {open ? (
        <span
          id={panelId}
          role="tooltip"
          className="absolute right-full top-1/2 z-30 mr-1.5 w-52 -translate-y-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-relaxed text-slate-600 shadow-lg"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

function SsiSpeedDial({
  score,
  compact = false,
}: {
  score: number | null;
  compact?: boolean;
}) {
  const cx = 120;
  const cy = 126;
  const r = 92;
  const stroke = 14;
  const pct = score == null ? 0 : Math.min(1, Math.max(0, score / 100));
  const track = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const length = Math.PI * r;
  const filled = `${pct * length} ${length}`;
  const label = score == null ? "—" : String(Math.round(score));

  return (
    <div
      className={`relative ${compact ? "w-[9.25rem]" : "mx-auto w-[13.5rem]"}`}
      role="img"
      aria-label={
        score == null
          ? "Social Selling Index unavailable"
          : `Social Selling Index ${Math.round(score)} of 100`
      }
    >
      <svg viewBox="0 0 240 148" className="h-auto w-full">
        <path
          d={track}
          fill="none"
          stroke={BOSS_PRO_RING_TRACK}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {pct > 0 ? (
          <path
            d={track}
            fill="none"
            stroke="#0c5290"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={filled}
          />
        ) : null}
      </svg>
      <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
        <p
          className={`font-semibold leading-none tabular-nums tracking-tight text-slate-900 ${
            compact ? "text-[1.7rem]" : "text-[2.35rem]"
          }`}
        >
          {label}
        </p>
        <p className="mt-1 text-[11px] font-medium text-slate-500">of 100</p>
      </div>
    </div>
  );
}

function SsiPillarBars({ pillars }: { pillars: SsiPillar[] }) {
  return (
    <ul className="space-y-3.5">
      {pillars.map((pillar) => {
        const max = pillar.max > 0 ? pillar.max : 25;
        const width = Math.min(100, Math.max(0, (pillar.score / max) * 100));
        const meta = PILLAR_META[pillar.id];
        const color = meta?.color ?? "#0591CD";
        return (
          <li key={pillar.id}>
            <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
              <p className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900">
                {pillar.score}
              </p>
              <p className="min-w-0 truncate text-[13px] text-slate-600">
                {pillar.label}
              </p>
              {meta?.info ? (
                <PillarInfoButton label={pillar.label} text={meta.info} />
              ) : null}
            </div>
            <div className="h-2.5 overflow-hidden rounded-sm bg-[#e1e8ee]">
              <div
                className="h-full rounded-sm"
                style={{ width: `${width}%`, background: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CampaignSsiCard({
  preview = false,
  linkedInConnected = false,
}: {
  preview?: boolean;
  linkedInConnected?: boolean;
}) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [ssi, setSsi] = useState<SsiResponse | null>(
    preview ? DEMO_PREVIEW_SSI : null
  );

  useEffect(() => {
    if (preview) {
      setSsi(DEMO_PREVIEW_SSI);
      return;
    }
    if (!linkedInConnected) {
      setSsi({ available: false, reason: "not_connected" });
      return;
    }
    let cancelled = false;
    void (async () => {
      const headers = await getCoachAuthHeaders();
      if (!headers || cancelled) return;
      const res = await fetch("/api/coach/linkedin-outreach/ssi", { headers });
      const body = (await res.json().catch(() => ({}))) as SsiResponse;
      if (cancelled) return;
      if (!res.ok) {
        setSsi({
          available: false,
          reason: "unavailable",
          message: "Couldn't load SSI right now.",
        });
        return;
      }
      setSsi(body);
    })();
    return () => {
      cancelled = true;
    };
  }, [preview, linkedInConnected]);

  if (!preview && !linkedInConnected) return null;
  if (!preview && ssi?.reason === "not_connected") return null;

  const loading = !preview && ssi == null;
  const unavailable = ssi?.reason === "unavailable";
  const score = typeof ssi?.score === "number" ? ssi.score : null;
  const pillars = (ssi?.pillars ?? []).filter(
    (p) => typeof p.score === "number" && p.max > 0
  );
  const canBreakdown = pillars.length > 0 && !unavailable && !loading;

  return (
    <section className="relative z-10 shrink-0 overflow-visible rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40">
      <div className="flex items-center gap-4 py-3 pl-4 pr-5">
        <div className="min-w-0 flex-1">
          <h2 className="min-w-0 truncate text-base font-semibold tracking-tight text-slate-900">
            Social Selling Index
          </h2>
          {canBreakdown ? (
            <button
              type="button"
              aria-expanded={breakdownOpen}
              onClick={() => setBreakdownOpen((open) => !open)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#0c5290] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
            >
              Breakdown
              <ChevronDown
                className={`h-3.5 w-3.5 transition ${
                  breakdownOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            </button>
          ) : (
            <p className="mt-2 text-[11px] text-slate-500">LinkedIn score</p>
          )}
        </div>
        {loading ? (
          <div className="h-[5.5rem] w-[9.25rem] rounded-t-full bg-slate-100" aria-hidden />
        ) : unavailable ? (
          <p className="max-w-[10rem] text-right text-xs text-slate-500">
            {ssi?.message || "Couldn't load SSI right now."}
          </p>
        ) : (
          <SsiSpeedDial score={score} compact />
        )}
      </div>

      {breakdownOpen && canBreakdown ? (
        <div className="border-t border-slate-100 px-4 py-3.5">
          <SsiPillarBars pillars={pillars} />
        </div>
      ) : null}
    </section>
  );
}
