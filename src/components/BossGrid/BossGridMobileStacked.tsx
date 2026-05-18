"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { AREAS, LEVELS, PLAYBOOKS } from "@/lib/bossData";
import type { AnswersMap } from "@/lib/bossScores";

const PILLARS: {
  key: "foundation" | "vision" | "velocity" | "value";
  name: string;
  color: string;
}[] = [
  { key: "foundation", name: "Foundation", color: "#A855F7" },
  { key: "vision", name: "Clarify Vision", color: "#3B82F6" },
  { key: "velocity", name: "Control Velocity", color: "#0EA5E9" },
  { key: "value", name: "Create Value", color: "#14B8A6" },
];

const SCORE_LABELS: Record<0 | 1 | 2, string> = {
  0: "Needs attention",
  1: "Building",
  2: "On track",
};

const SCORE_STYLES: Record<"unscored" | 0 | 1 | 2, string> = {
  unscored: "border-dashed border-slate-200 bg-slate-50 text-slate-400",
  0: "border-rose-200 bg-rose-50/80 text-rose-900",
  1: "border-amber-200 bg-amber-50/80 text-amber-950",
  2: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
};

function levelName(levelId: number): string {
  return LEVELS.find((l) => l.id === levelId)?.name ?? `Level ${levelId}`;
}

export type BossGridMobileStackedProps = {
  answers: AnswersMap;
  interactive?: boolean;
  onScoreChange?: (ref: string, score: 0 | 1 | 2) => void;
  playbookLinkBase?: string;
};

export function BossGridMobileStacked({
  answers,
  interactive = false,
  onScoreChange,
  playbookLinkBase,
}: BossGridMobileStackedProps) {
  const router = useRouter();
  const [openPillars, setOpenPillars] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PILLARS.map((p) => [p.key, true]))
  );

  const togglePillar = (key: string) => {
    setOpenPillars((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-3 lg:hidden" role="list" aria-label="BOSS playbooks by pillar">
      {PILLARS.map((pillar) => {
        const pillarPlaybooks = PLAYBOOKS.filter((p) => {
          const area = AREAS.find((a) => a.id === p.area);
          return area?.pillar === pillar.key;
        });
        const open = openPillars[pillar.key] ?? true;

        return (
          <section
            key={pillar.key}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => togglePillar(pillar.key)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              aria-expanded={open}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-1 w-6 shrink-0 rounded-full"
                  style={{ backgroundColor: pillar.color }}
                  aria-hidden
                />
                <span className="text-sm font-bold uppercase tracking-wide text-slate-900">
                  {pillar.name}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {pillarPlaybooks.length} playbooks
                </span>
              </span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {open ? (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {pillarPlaybooks.map((playbook) => {
                  const score = answers[playbook.ref] as 0 | 1 | 2 | undefined;
                  const scoreKey = score ?? "unscored";
                  const area = AREAS.find((a) => a.id === playbook.area);
                  const canScore = interactive && Boolean(onScoreChange);
                  const canLink = Boolean(playbookLinkBase);

                  const inner = (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          L{playbook.level} · {levelName(playbook.level)}
                          {area ? ` · ${area.name}` : ""}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-900">
                          {playbook.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Ref {playbook.ref}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${SCORE_STYLES[scoreKey]}`}
                      >
                        {score === undefined ? "Not scored" : SCORE_LABELS[score]}
                      </span>
                    </>
                  );

                  if (canLink && !canScore) {
                    return (
                      <li key={playbook.ref}>
                        <Link
                          href={`${playbookLinkBase}/${playbook.ref}`}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"
                        >
                          {inner}
                        </Link>
                      </li>
                    );
                  }

                  return (
                    <li key={playbook.ref}>
                      <button
                        type="button"
                        disabled={!canScore && !canLink}
                        onClick={() => {
                          if (canScore && onScoreChange) {
                            const next = (((score ?? 0) + 1) % 3) as 0 | 1 | 2;
                            onScoreChange(playbook.ref, next);
                          } else if (canLink && playbookLinkBase) {
                            router.push(`${playbookLinkBase}/${playbook.ref}`);
                          }
                        }}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        {inner}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
