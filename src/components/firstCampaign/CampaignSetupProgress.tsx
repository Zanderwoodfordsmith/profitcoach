"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";

export type ProgressStageStatus = "pending" | "active" | "done" | "error";

export type ProgressStage = {
  id: string;
  label: string;
  status: ProgressStageStatus;
  /** 0–100 while active */
  progress: number;
};

export type ProgressSection = {
  id: string;
  title: string;
  stages: ProgressStage[];
};

export type ProgressStageDef = {
  id: string;
  label: string;
  minMs: number;
  /** Optional real work — bar waits for both minMs and this promise */
  work?: () => Promise<unknown>;
};

export type ProgressSectionDef = {
  id: string;
  title: string;
  stages: ProgressStageDef[];
};

export function stagesFromDefs(defs: ProgressStageDef[]): ProgressStage[] {
  return defs.map((d) => ({
    id: d.id,
    label: d.label,
    status: "pending" as const,
    progress: 0,
  }));
}

export function sectionsFromDefs(defs: ProgressSectionDef[]): ProgressSection[] {
  return defs.map((s) => ({
    id: s.id,
    title: s.title,
    stages: stagesFromDefs(s.stages),
  }));
}

export function flattenSectionStages(sections: ProgressSection[]): ProgressStage[] {
  return sections.flatMap((s) => s.stages);
}

export function CampaignSetupProgress({
  title = "Setting up your campaign",
  subtitle = "This usually takes under a minute.",
  stages,
  sections,
}: {
  title?: string;
  subtitle?: string;
  /** Flat list (LinkedIn-style). Ignored if `sections` is provided. */
  stages?: ProgressStage[];
  /** Grouped list with section headers (Avatar-style). */
  sections?: ProgressSection[];
}) {
  const resolvedSections: ProgressSection[] =
    sections && sections.length > 0
      ? sections
      : stages && stages.length > 0
        ? [{ id: "main", title: "", stages }]
        : [];

  const allStages = flattenSectionStages(resolvedSections);
  const doneCount = allStages.filter((s) => s.status === "done").length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 text-center">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
          {doneCount} of {allStages.length} complete
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {resolvedSections.map((section) => (
          <div key={section.id}>
            {section.title ? (
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {section.title}
              </p>
            ) : null}
            <ul className="flex flex-col gap-3.5">
              {section.stages.map((stage) => (
                <li key={stage.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2.5">
                    <StageIcon status={stage.status} />
                    <span
                      className={`text-sm font-medium ${
                        stage.status === "pending"
                          ? "text-slate-400"
                          : stage.status === "error"
                            ? "text-rose-700"
                            : stage.status === "done"
                              ? "text-slate-700"
                              : "text-slate-900"
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                  <div className="ml-8 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                        stage.status === "done"
                          ? "bg-emerald-500"
                          : stage.status === "error"
                            ? "bg-rose-400"
                            : stage.status === "active"
                              ? "bg-sky-500"
                              : "bg-transparent"
                      }`}
                      style={{
                        width: `${
                          stage.status === "done" || stage.status === "error"
                            ? 100
                            : stage.status === "active"
                              ? Math.max(6, Math.min(100, stage.progress))
                              : 0
                        }%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageIcon({ status }: { status: ProgressStageStatus }) {
  if (status === "done") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
        !
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50" />
  );
}

/** Animate a single stage’s bar while an optional promise runs. Resolves when both finish. */
export async function runProgressStage(opts: {
  minMs: number;
  work?: Promise<unknown>;
  onProgress: (pct: number) => void;
  signal?: { cancelled: boolean };
}): Promise<void> {
  const started = performance.now();
  let workDone = !opts.work;
  let workError: unknown = null;

  const workPromise = opts.work
    ? opts.work.then(
        () => {
          workDone = true;
        },
        (err) => {
          workDone = true;
          workError = err;
        }
      )
    : Promise.resolve();

  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (opts.signal?.cancelled) {
        resolve();
        return;
      }
      const elapsed = performance.now() - started;
      const timePct = Math.min(1, elapsed / opts.minMs);
      const display = workDone ? 100 : Math.min(92, 8 + timePct * 84);
      opts.onProgress(display);

      if (workDone && elapsed >= opts.minMs) {
        opts.onProgress(100);
        if (workError) reject(workError);
        else resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    void workPromise;
    requestAnimationFrame(tick);
  });
}

/** Hook: run a flat or sectioned progress sequence with optional real work per stage. */
export function useCampaignProgressRunner() {
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<ProgressStage[]>([]);
  const [sections, setSections] = useState<ProgressSection[] | null>(null);
  const cancelRef = useRef({ cancelled: false });

  useEffect(() => {
    return () => {
      cancelRef.current.cancelled = true;
    };
  }, []);

  const patchFlat = useCallback(
    (index: number, patch: Partial<Pick<ProgressStage, "status" | "progress">>) => {
      setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    },
    []
  );

  const patchSectioned = useCallback(
    (
      sectionIndex: number,
      stageIndex: number,
      patch: Partial<Pick<ProgressStage, "status" | "progress">>
    ) => {
      setSections((prev) => {
        if (!prev) return prev;
        return prev.map((sec, si) =>
          si !== sectionIndex
            ? sec
            : {
                ...sec,
                stages: sec.stages.map((st, sti) =>
                  sti === stageIndex ? { ...st, ...patch } : st
                ),
              }
        );
      });
    },
    []
  );

  const runFlat = useCallback(
    async (defs: ProgressStageDef[]) => {
      cancelRef.current = { cancelled: false };
      setSections(null);
      setStages(stagesFromDefs(defs));
      setRunning(true);
      try {
        for (let i = 0; i < defs.length; i++) {
          if (cancelRef.current.cancelled) break;
          const def = defs[i];
          patchFlat(i, { status: "active", progress: 0 });
          try {
            await runProgressStage({
              minMs: def.minMs,
              work: def.work?.(),
              signal: cancelRef.current,
              onProgress: (pct) => patchFlat(i, { progress: pct }),
            });
            patchFlat(i, { status: "done", progress: 100 });
          } catch (err) {
            patchFlat(i, { status: "error", progress: 100 });
            throw err;
          }
        }
      } finally {
        setRunning(false);
      }
    },
    [patchFlat]
  );

  const runSectioned = useCallback(
    async (defs: ProgressSectionDef[]) => {
      cancelRef.current = { cancelled: false };
      setStages([]);
      setSections(sectionsFromDefs(defs));
      setRunning(true);
      try {
        for (let si = 0; si < defs.length; si++) {
          const section = defs[si];
          for (let sti = 0; sti < section.stages.length; sti++) {
            if (cancelRef.current.cancelled) break;
            const def = section.stages[sti];
            patchSectioned(si, sti, { status: "active", progress: 0 });
            try {
              await runProgressStage({
                minMs: def.minMs,
                work: def.work?.(),
                signal: cancelRef.current,
                onProgress: (pct) =>
                  patchSectioned(si, sti, { progress: pct }),
              });
              patchSectioned(si, sti, { status: "done", progress: 100 });
            } catch (err) {
              patchSectioned(si, sti, { status: "error", progress: 100 });
              throw err;
            }
          }
        }
      } finally {
        setRunning(false);
      }
    },
    [patchSectioned]
  );

  return {
    running,
    stages,
    sections,
    runFlat,
    runSectioned,
  };
}
