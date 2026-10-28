"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { ProspectTableAvatar } from "@/components/prospects/ProspectTableAvatar";
import { cardClass } from "@/components/ui/Card";
import { badgeClass, type BadgeTone } from "@/components/ui/Badge";
import { fieldClass } from "@/components/ui/Field";
import { formatShortDate } from "@/lib/formatShortDate";
import {
  MAGNET_STAGE_LABEL,
  MAGNET_STAGES,
  type MagnetAudiencePerson,
  type MagnetStage,
} from "@/lib/leadMagnets/audienceTypes";
import {
  formatProspectLabel,
  formatProspectPersonName,
} from "@/lib/prospectDisplayFormat";

const STAGE_TONE: Record<MagnetStage, BadgeTone> = {
  opted_in: "grey",
  started: "blue",
  completed: "green",
};

type StageFilter = MagnetStage | "all";

type Props = {
  people: MagnetAudiencePerson[];
  loading: boolean;
  stage: StageFilter;
  onStageChange: (stage: StageFilter) => void;
  prospectHref: (contactId: string) => string | null;
};

function personName(person: MagnetAudiencePerson): string {
  return (
    formatProspectPersonName(person.full_name) ||
    person.email ||
    "Unknown"
  );
}

function progressPercent(person: MagnetAudiencePerson): number {
  if (!person.progress_step || !person.progress_total) return 0;
  return Math.min(100, Math.round((person.progress_step / person.progress_total) * 100));
}

function ScoreCell({ person }: { person: MagnetAudiencePerson }) {
  if (person.score != null) {
    return (
      <span className="text-sm font-semibold tabular-nums text-slate-900">
        {Math.round(person.score)}
      </span>
    );
  }

  if (person.progress_step != null && person.progress_total != null) {
    const pct = progressPercent(person);
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"
          aria-hidden
        >
          <span
            className="block h-full rounded-full bg-[#2b8fd6]"
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="text-xs tabular-nums text-slate-600">
          {person.progress_step} of {person.progress_total}
        </span>
      </span>
    );
  }

  return (
    <span className="text-sm text-slate-400">
      {person.stage === "started" ? "Started" : "Not started"}
    </span>
  );
}

export function LeadMagnetPeople({
  people,
  loading,
  stage,
  onStageChange,
  prospectHref,
}: Props) {
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const next: Record<MagnetStage, number> = {
      opted_in: 0,
      started: 0,
      completed: 0,
    };
    for (const person of people) next[person.stage] += 1;
    return next;
  }, [people]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return people.filter((person) => {
      if (stage !== "all" && person.stage !== stage) return false;
      if (!needle) return true;
      const haystack = [person.full_name, person.email, person.business_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [people, query, stage]);

  const chips: Array<{ id: StageFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: people.length },
    ...MAGNET_STAGES.map((id) => ({
      id,
      label: MAGNET_STAGE_LABEL[id],
      count: counts[id],
    })),
  ];

  return (
    <div className={cardClass("plain", "overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Stage">
          {chips.map((chip) => {
            const active = stage === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onStageChange(chip.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  active
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {chip.label}
                <span className={active ? "text-slate-300" : "text-slate-400"}>
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
        <label className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <span className="sr-only">Search people</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or email"
            className={fieldClass("input", "small", "pl-8")}
          />
        </label>
      </div>

      {loading ? (
        <p className="px-4 py-16 text-center text-sm text-slate-500">
          Loading people…
        </p>
      ) : visible.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-slate-500">
          {people.length === 0
            ? "No one has opted in during this range."
            : "No one matches this filter."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[40rem]">
            <div className="grid grid-cols-[minmax(0,1.6fr)_8.5rem_12rem_6.5rem] border-b border-slate-100 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              <span>Person</span>
              <span>Stage</span>
              <span>Score</span>
              <span className="text-right">When</span>
            </div>
            <ul>
              {visible.map((person) => {
                const href = prospectHref(person.id);
                const name = personName(person);
                const business = formatProspectLabel(person.business_name);
                const detail = [business, person.email].filter(Boolean).join(" · ");
                const body = (
                  <>
                    <span className="flex min-w-0 items-center gap-3">
                      <ProspectTableAvatar name={name} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900">
                          {name}
                        </span>
                        {detail ? (
                          <span className="block truncate text-xs text-slate-500">
                            {detail}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span>
                      <span
                        className={badgeClass(STAGE_TONE[person.stage])}
                      >
                        {MAGNET_STAGE_LABEL[person.stage]}
                      </span>
                    </span>
                    <ScoreCell person={person} />
                    <span className="text-right text-slate-500 tabular-nums">
                      {person.at ? formatShortDate(person.at) : "—"}
                    </span>
                  </>
                );
                const rowClass =
                  "grid grid-cols-[minmax(0,1.6fr)_8.5rem_12rem_6.5rem] items-center border-b border-slate-50 px-4 py-2.5 text-sm";

                return (
                  <li key={person.id}>
                    {href ? (
                      <Link href={href} className={`${rowClass} hover:bg-slate-50/80`}>
                        {body}
                      </Link>
                    ) : (
                      <div className={rowClass}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
