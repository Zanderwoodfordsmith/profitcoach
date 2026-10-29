"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  FileSpreadsheet,
  Globe,
  MapPin,
  Search,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { cardClass } from "@/components/ui/Card";
import type { PoolImportMode } from "@/components/campaigns/poolImportOptions";
import { getStoredImpersonatingCoachId } from "@/lib/coachAuthHeaders";
import { loadPractice } from "@/lib/practiceKnowledge/practiceApi";
import { listValue } from "@/lib/practiceKnowledge/sourced";

/** Where the Add people modal opens, and what it fills in. */
export type PoolImportPreset = {
  mode?: PoolImportMode;
  mapsTerms?: string[];
  salesNavSource?: "first";
};

const TILES: Array<{
  title: string;
  body: string;
  icon: typeof Search;
  preset: PoolImportPreset;
}> = [
  {
    title: "Add one person",
    body: "A name, plus an email, phone or LinkedIn.",
    icon: UserPlus,
    preset: { mode: "one" },
  },
  {
    title: "Your connections",
    body: "People you already know on LinkedIn, at the right size of business.",
    icon: Users,
    preset: { mode: "search", salesNavSource: "first" },
  },
  {
    title: "Sales Navigator",
    body: "We build the search from your Blueprint, or paste your own.",
    icon: Search,
    preset: { mode: "search" },
  },
  {
    title: "Google Maps",
    body: "Search a trade in a town or country. We find the person to contact.",
    icon: MapPin,
    preset: { mode: "maps" },
  },
  {
    title: "Google Search",
    body: "The same, from Google results.",
    icon: Globe,
    preset: { mode: "google" },
  },
  {
    title: "Upload CSV",
    body: "Bring a spreadsheet. We match the columns.",
    icon: FileSpreadsheet,
    preset: { mode: "csv" },
  },
];

type BlueprintStart = { firstName: string | null; industries: string[] };

// One Blueprint read per coach per page visit, shared by the empty state and
// the modal, so the suggestions don't pop in a second time.
let blueprintStart: { key: string; promise: Promise<BlueprintStart> } | null = null;

function loadBlueprintStart(): Promise<BlueprintStart> {
  const key = getStoredImpersonatingCoachId() ?? "self";
  if (blueprintStart?.key === key) return blueprintStart.promise;
  const promise = loadPractice().then((res): BlueprintStart => {
    if (!res.ok || !res.data) return { firstName: null, industries: [] };
    const market = res.data.knowledge.payload.market;
    const seen = new Set<string>();
    const industries: string[] = [];
    for (const value of [
      ...listValue(market?.industries_credibility),
      ...listValue(market?.industries_access),
      ...listValue(market?.industries_understand),
    ]) {
      const lower = value.toLowerCase();
      if (seen.has(lower) || value.length > 40) continue;
      seen.add(lower);
      industries.push(value);
    }
    return {
      firstName: res.data.coach_name?.trim().split(/\s+/)[0] || null,
      industries: industries.slice(0, 4),
    };
  });
  blueprintStart = { key, promise };
  return promise;
}

/**
 * The coach's first name, and industries from the Blueprint (strongest first)
 * for one-click Maps searches. Undefined while loading.
 */
export function useBlueprintStart(): BlueprintStart | undefined {
  const [start, setStart] = useState<BlueprintStart>();
  useEffect(() => {
    let cancelled = false;
    void loadBlueprintStart().then((value) => {
      if (!cancelled) setStart(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return start;
}

/** Blueprint Maps searches, then the six ways to add people. */
export function PoolImportPicker({
  onPick,
  leadingOption,
}: {
  onPick: (preset: PoolImportPreset) => void;
  /** Extra row above the tiles. */
  leadingOption?: { title: string; body: string; onSelect: () => void };
}) {
  const industries = useBlueprintStart()?.industries ?? [];

  return (
    <div className="space-y-4">
      {industries.length > 0 ? (
        <section className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-white p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0c5290]">
            <Sparkles className="h-4 w-4" aria-hidden />
            From your Blueprint
          </div>
          <p className="mt-1.5 text-base font-semibold text-slate-900">
            Find businesses you know on Google Maps
          </p>
          <p className="mt-0.5 text-sm leading-snug text-slate-600">
            One click fills in the search. You pick the area and how many.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {industries.map((industry) => (
              <button
                key={industry}
                type="button"
                onClick={() => onPick({ mode: "maps", mapsTerms: [industry] })}
                className="group inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white py-2 pr-3 pl-3.5 text-sm font-medium text-[#0c5290] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#0c5290] hover:bg-[#0c5290] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
              >
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                {industry}
                <ArrowRight
                  className="h-3.5 w-3.5 shrink-0 opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
                  aria-hidden
                />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {leadingOption ? (
        <button
          type="button"
          onClick={leadingOption.onSelect}
          className={cardClass(
            "raised",
            "group flex w-full items-center gap-4 p-4 text-left transition hover:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
          )}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#0c5290] transition-colors group-hover:bg-[#0c5290] group-hover:text-white">
            <Users className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-slate-900">
              {leadingOption.title}
            </span>
            <span className="mt-0.5 block text-sm leading-snug text-slate-600">
              {leadingOption.body}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        </button>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.title}
              type="button"
              onClick={() => onPick(tile.preset)}
              className={cardClass(
                "raised",
                "group flex flex-col items-start gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_32px_-14px_rgba(12,82,144,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
              )}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-[#0c5290] transition-colors group-hover:bg-[#0c5290] group-hover:text-white">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block text-base font-semibold text-slate-900">
                  {tile.title}
                </span>
                <span className="mt-1 block text-sm leading-snug text-slate-600">
                  {tile.body}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
