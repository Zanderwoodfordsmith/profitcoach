"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { devPerfEnd, devPerfStart } from "@/lib/devPerf";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  SIGNATURE_MODULE_IDS,
  normalizeScores,
  SIGNATURE_LIFESTYLE_LENSES,
  SIGNATURE_MODEL_V2,
  type SignatureModuleId,
  type SignatureScore,
} from "@/lib/signatureModelV2";
import { supabaseClient } from "@/lib/supabaseClient";

const SignaturePetalDiagram = dynamic(
  () =>
    import("@/components/signature/SignaturePetalDiagram").then(
      (m) => m.SignaturePetalDiagram
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="mx-auto flex min-h-[320px] w-full max-w-xl items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/80 text-sm text-slate-500"
        aria-hidden
      >
        Loading diagram…
      </div>
    ),
  }
);

const SCORE_DOT = {
  red: "bg-[#e06b6b] ring-1 ring-[#e06b6b]/40",
  yellow: "bg-[#e6c25a] ring-1 ring-[#e6c25a]/50",
  green: "bg-[#6bb37a] ring-1 ring-[#6bb37a]/40",
  empty: "border-2 border-slate-300 bg-white",
} as const;

function scoreAriaLabel(value: SignatureScore): string {
  if (value === "red") return "Needs attention";
  if (value === "yellow") return "Building";
  if (value === "green") return "On track";
  return "Not yet";
}

function IconInfo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
    </svg>
  );
}

function ScorePickerDot({
  value,
  onOpenPicker,
  moduleLabel,
}: {
  value: SignatureScore;
  onOpenPicker: (anchor: { x: number; y: number }) => void;
  moduleLabel: string;
}) {
  const visual =
    value === "red"
      ? SCORE_DOT.red
      : value === "yellow"
        ? SCORE_DOT.yellow
        : value === "green"
          ? SCORE_DOT.green
          : SCORE_DOT.empty;

  return (
    <button
      type="button"
      onClick={(e) =>
        onOpenPicker({ x: e.clientX, y: e.clientY })
      }
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-left outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
      aria-label={`${moduleLabel}: ${scoreAriaLabel(value ?? null)}. Tap to choose a color.`}
    >
      <span
        className={`h-6 w-6 rounded-full ${visual}`}
        aria-hidden
      />
    </button>
  );
}

type ScorePickerState = {
  moduleId: SignatureModuleId;
  moduleLabel: string;
  x: number;
  y: number;
} | null;

function ScoreQuickPicker({
  picker,
  currentValue,
  onSelect,
  onClose,
}: {
  picker: ScorePickerState;
  currentValue: SignatureScore;
  onSelect: (v: SignatureScore) => void;
  onClose: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!picker) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      onClose();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [picker, onClose]);

  if (!picker) return null;

  const options = [
    { value: "red", visual: SCORE_DOT.red, phrase: "Needs attention" },
    { value: "yellow", visual: SCORE_DOT.yellow, phrase: "Building" },
    { value: "green", visual: SCORE_DOT.green, phrase: "On track" },
  ] as const;

  const viewportWidth =
    typeof window === "undefined" ? 1024 : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined" ? 768 : window.innerHeight;
  const left = Math.max(12, Math.min(picker.x - 130, viewportWidth - 272));
  const top = Math.max(12, Math.min(picker.y + 10, viewportHeight - 210));

  return (
    <div
      ref={wrapRef}
      className="fixed z-50 w-[260px] rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-xl"
      style={{ left, top }}
      role="dialog"
      aria-label={`Set score for ${picker.moduleLabel}`}
    >
      <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
        Choose status
      </p>
      <div className="space-y-1">
        {options.map((option) => {
          const selected = currentValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition ${
                selected
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className={`h-4 w-4 shrink-0 rounded-full ${option.visual}`} />
              <span className="font-semibold capitalize">{option.value}</span>
              <span className="text-slate-500">{option.phrase}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 border-t border-slate-200 pt-2">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`w-full rounded-lg px-2 py-2 text-left text-sm transition ${
            currentValue === null
              ? "bg-slate-100 text-slate-900"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
          }`}
        >
          Clear selection
        </button>
      </div>
    </div>
  );
}

function CompassScoringInfoPopover() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const legend = [
    { visual: SCORE_DOT.empty, label: "Not yet" },
    { visual: SCORE_DOT.red, label: "Needs attention" },
    { visual: SCORE_DOT.yellow, label: "Building" },
    { visual: SCORE_DOT.green, label: "On track" },
  ] as const;

  const jumps = [
    { href: "#compass-pillar-reach", label: "Connect" },
    { href: "#compass-pillar-enrol", label: "Enroll" },
    { href: "#compass-pillar-deliver", label: "Deliver" },
    { href: "#compass-section-centre", label: "Centre" },
  ] as const;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        aria-expanded={open}
        aria-label="How scoring works"
      >
        <IconInfo className="h-4 w-4" />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-20 mt-1 w-[17.5rem] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-600 shadow-lg"
          role="tooltip"
        >
          <p className="leading-snug text-slate-700">
            Tap the circle beside each line to score — it cycles through the
            states.
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
            States
          </p>
          <ul className="mt-2 space-y-2">
            {legend.map(({ visual, label }) => (
              <li
                key={label}
                className="flex items-center gap-2.5 text-sm text-slate-700"
              >
                <span
                  className={`h-4 w-4 shrink-0 rounded-full ${visual}`}
                  aria-hidden
                />
                {label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
            Jump to section
          </p>
          <ul className="mt-2 space-y-1">
            {jumps.map(({ href, label }) => (
              <li key={href}>
                <a
                  href={href}
                  className="font-medium text-sky-700 underline-offset-2 hover:text-sky-600 hover:underline"
                  onClick={() => setOpen(false)}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function IconDotsHorizontal({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="6" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18" cy="12" r="1.8" />
    </svg>
  );
}

function CompassActionsMenu({
  onClearAll,
  hideOuterModules,
  onToggleOuterModules,
}: {
  onClearAll: () => void;
  hideOuterModules: boolean;
  onToggleOuterModules: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        aria-expanded={open}
        aria-label="Compass actions"
      >
        <IconDotsHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-40 rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onToggleOuterModules();
              setOpen(false);
            }}
            className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
          >
            {hideOuterModules ? "Show outer modules" : "Hide outer modules"}
          </button>
          <button
            type="button"
            onClick={() => {
              onClearAll();
              setOpen(false);
            }}
            className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-rose-700 transition hover:bg-rose-50"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

function HintPopover({
  hint,
  rowKey,
  openKey,
  onToggle,
}: {
  hint: string;
  rowKey: string;
  openKey: string | null;
  onToggle: (key: string | null) => void;
}) {
  const open = openKey === rowKey;
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      onToggle(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onToggle]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => onToggle(open ? null : rowKey)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        aria-expanded={open}
        aria-label="Hint after on-ramp"
      >
        <IconInfo className="h-4 w-4" />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-20 mt-1 w-[17.5rem] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-600 shadow-lg"
          role="tooltip"
        >
          <span className="font-medium text-slate-800">After on-ramp · </span>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export default function CoachSignaturePage() {
  const router = useRouter();
  const pathname = usePathname();
  const clientsHref = pathname?.startsWith("/admin") ? "/admin/clients" : "/coach/clients";
  const { impersonatingCoachId } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hintRow, setHintRow] = useState<string | null>(null);
  const [scorePicker, setScorePicker] = useState<ScorePickerState>(null);
  const [hideOuterModules, setHideOuterModules] = useState(false);
  const [scores, setScores] = useState<
    Record<SignatureModuleId, SignatureScore>
  >(() => normalizeScores({}));

  const authHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    const h: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingCoachId) {
      h["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return h;
  }, [impersonatingCoachId]);

  useEffect(() => {
    let cancelled = false;
    const perfMark = devPerfStart();
    async function init() {
      setLoading(true);
      setError(null);
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const user = session?.user;
      const token = session?.access_token;
      if (!user || !token) {
        router.replace("/login");
        setLoading(false);
        return;
      }
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }

      const [roleRes, scoreRes] = await Promise.all([
        fetch("/api/profile-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        }),
        fetch("/api/coach/signature-scores", { headers }),
      ]);

      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
      };
      if (cancelled) return;
      if (!roleRes.ok || !roleBody.role) {
        setError("Unable to load your profile.");
        setLoading(false);
        return;
      }
      if (roleBody.role !== "coach" && roleBody.role !== "admin") {
        router.replace("/login");
        setLoading(false);
        return;
      }

      const scoreBody = (await scoreRes.json().catch(() => ({}))) as {
        scores?: Record<string, SignatureScore>;
        error?: string;
      };
      if (cancelled) return;
      if (!scoreRes.ok) {
        setError(scoreBody.error ?? "Could not load scores.");
        setLoading(false);
        return;
      }
      setScores(normalizeScores(scoreBody.scores ?? {}));
      setLoading(false);
    }
    void init().finally(() => {
      if (!cancelled) devPerfEnd("compass:init", perfMark);
    });
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingCoachId]);

  const persistPatch = useCallback(
    async (patch: Partial<Record<SignatureModuleId, SignatureScore>>) => {
      const headers = await authHeaders();
      if (!headers) return;
      setError(null);
      const res = await fetch("/api/coach/signature-scores", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ scores: patch }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        scores?: Record<string, SignatureScore>;
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Could not save.");
        return;
      }
      if (body.scores) {
        setScores(normalizeScores(body.scores));
      }
    },
    [authHeaders]
  );

  const setModuleScore = useCallback(
    (moduleId: SignatureModuleId, value: SignatureScore) => {
      setScores((prev) => ({ ...prev, [moduleId]: value }));
      void persistPatch({ [moduleId]: value });
    },
    [persistPatch]
  );

  const clearAllScores = useCallback(() => {
    const cleared = normalizeScores({});
    setScores(cleared);
    const patch = Object.fromEntries(
      SIGNATURE_MODULE_IDS.map((id) => [id, null])
    ) as Partial<Record<SignatureModuleId, SignatureScore>>;
    void persistPatch(patch);
  }, [persistPatch]);

  const openScorePicker = useCallback(
    (
      moduleId: SignatureModuleId,
      moduleLabel: string,
      anchor: { x: number; y: number }
    ) => {
      setScorePicker({ moduleId, moduleLabel, x: anchor.x, y: anchor.y });
    },
    []
  );

  if (loading) {
    return (
      <p className="text-sm tracking-wide text-slate-500">Loading…</p>
    );
  }

  return (
    <div className="relative w-full pb-8">
      {error ? (
        <p className="mb-3 mt-3 text-left text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mx-auto w-full max-w-4xl origin-top scale-[1.05]">
        <div className="mb-1 mt-2 flex w-full justify-end pr-1">
          <CompassActionsMenu
            onClearAll={clearAllScores}
            hideOuterModules={hideOuterModules}
            onToggleOuterModules={() =>
              setHideOuterModules((prev) => !prev)
            }
          />
        </div>
        <div className="mb-0 mt-5 flex w-full justify-center">
          <SignaturePetalDiagram
            scores={scores}
            onScoreChange={setModuleScore}
            hideOuterModules={hideOuterModules}
            onScorePickRequest={(moduleId, anchor) => {
              const module =
                SIGNATURE_MODEL_V2.pillars
                  .flatMap((pillar) => pillar.modules)
                  .find((m) => m.id === moduleId)?.diagramTitle ??
                SIGNATURE_LIFESTYLE_LENSES.find((l) => l.moduleId === moduleId)
                  ?.lensLabel ??
                "Compass module";
              openScorePicker(moduleId, module, anchor);
            }}
          />
        </div>

        <div className="-mt-5 mx-auto w-[90%] sm:-mt-6">
          <div className="mt-2 flex items-center justify-end">
            <CompassScoringInfoPopover />
          </div>
          <div className="divide-y divide-slate-200/90 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm">
              <div className="divide-y divide-slate-100">
                {!hideOuterModules
                  ? SIGNATURE_MODEL_V2.pillars.map((pillar) => (
                      <div key={pillar.id} className="divide-y divide-slate-100">
                        <div
                          id={`compass-pillar-${pillar.id}`}
                          className="scroll-mt-28 bg-slate-50/60 px-4 py-3 sm:px-5"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            {pillar.title}
                          </p>
                        </div>
                        {pillar.modules.map((m) => {
                          const v = scores[m.id];
                          return (
                            <div
                              key={m.id}
                              className="grid grid-cols-[2.75rem_1fr] grid-rows-[auto_auto] items-center gap-x-2 gap-y-1.5 px-3 py-3.5 sm:grid-cols-[2.75rem_minmax(7rem,11rem)_minmax(0,1fr)] sm:grid-rows-1 sm:gap-x-3 sm:px-4"
                            >
                              <div className="row-span-2 flex justify-center self-center sm:row-span-1">
                                <ScorePickerDot
                                  value={v}
                                  onOpenPicker={(anchor) =>
                                    openScorePicker(m.id, m.diagramTitle, anchor)
                                  }
                                  moduleLabel={m.diagramTitle}
                                />
                              </div>
                              <p className="col-start-2 row-start-1 min-w-0 text-pretty text-base font-semibold leading-snug text-slate-900 sm:text-[17px]">
                                <button
                                  type="button"
                                  className="text-left underline-offset-2 hover:underline"
                                  onClick={(e) =>
                                    openScorePicker(m.id, m.diagramTitle, {
                                      x: e.clientX,
                                      y: e.clientY,
                                    })
                                  }
                                >
                                  {m.diagramTitle}
                                </button>
                              </p>
                              <div className="col-start-2 row-start-2 flex min-w-0 items-start gap-1.5 sm:col-start-3 sm:row-start-1">
                                <p className="min-w-0 flex-1 text-pretty text-base leading-snug text-slate-800 sm:text-[17px] sm:leading-[1.5]">
                                  {m.question}
                                </p>
                                <HintPopover
                                  hint={m.onrampHint}
                                  rowKey={m.id}
                                  openKey={hintRow}
                                  onToggle={setHintRow}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  : null}

                <div className="divide-y divide-slate-100">
                  <div
                    id="compass-section-centre"
                    className="scroll-mt-28 bg-slate-50/60 px-4 py-3 sm:px-5"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Lifestyle
                    </p>
                  </div>
                  {SIGNATURE_LIFESTYLE_LENSES.map((row) => {
                    const v = scores[row.moduleId];
                    return (
                      <div
                        key={row.moduleId}
                        className="grid grid-cols-[2.75rem_1fr] grid-rows-[auto_auto] items-center gap-x-2 gap-y-1.5 px-3 py-3.5 sm:grid-cols-[2.75rem_minmax(7rem,11rem)_minmax(0,1fr)] sm:grid-rows-1 sm:gap-x-3 sm:px-4"
                      >
                        <div className="row-span-2 flex justify-center self-center sm:row-span-1">
                          <ScorePickerDot
                            value={v}
                            onOpenPicker={(anchor) =>
                              openScorePicker(
                                row.moduleId,
                                row.lensLabel,
                                anchor
                              )
                            }
                            moduleLabel={row.lensLabel}
                          />
                        </div>
                        <p className="col-start-2 row-start-1 min-w-0 text-pretty text-base font-semibold leading-snug text-slate-900 sm:text-[17px]">
                          <button
                            type="button"
                            className="text-left underline-offset-2 hover:underline"
                            onClick={(e) =>
                              openScorePicker(row.moduleId, row.lensLabel, {
                                x: e.clientX,
                                y: e.clientY,
                              })
                            }
                          >
                            {row.lensLabel}
                          </button>
                        </p>
                        <div className="col-start-2 row-start-2 flex min-w-0 items-start gap-1.5 sm:col-start-3 sm:row-start-1">
                          <p className="min-w-0 flex-1 text-pretty text-base leading-snug text-slate-800 sm:text-[17px] sm:leading-[1.5]">
                            {row.question}
                          </p>
                          <HintPopover
                            hint={row.onrampHint}
                            rowKey={row.moduleId}
                            openKey={hintRow}
                            onToggle={setHintRow}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
        </div>
      </div>

      <ScoreQuickPicker
        picker={scorePicker}
        currentValue={scorePicker ? scores[scorePicker.moduleId] : null}
        onSelect={(value) => {
          if (!scorePicker) return;
          setModuleScore(scorePicker.moduleId, value);
          setScorePicker(null);
        }}
        onClose={() => setScorePicker(null)}
      />

      <Link
        href={clientsHref}
        className="fixed bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg ring-1 ring-sky-700/20 transition hover:bg-sky-500"
        aria-label="Open clients"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </Link>
    </div>
  );
}
