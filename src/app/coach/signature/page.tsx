"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SignaturePetalDiagram } from "@/components/signature/SignaturePetalDiagram";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import {
  normalizeScores,
  SIGNATURE_LIFESTYLE_LENSES,
  SIGNATURE_MODEL_V2,
  type SignatureModuleId,
  type SignatureScore,
} from "@/lib/signatureModelV2";
import { supabaseClient } from "@/lib/supabaseClient";

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

function nextScore(current: SignatureScore): SignatureScore {
  const order: SignatureScore[] = [null, "red", "yellow", "green"];
  const i = order.indexOf(current);
  return order[(i + 1) % order.length];
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

function ScoreCycleDot({
  value,
  onChange,
  moduleLabel,
}: {
  value: SignatureScore;
  onChange: (v: SignatureScore) => void;
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
      onClick={() => onChange(nextScore(value ?? null))}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-left outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
      aria-label={`${moduleLabel}: ${scoreAriaLabel(value ?? null)}. Tap to change.`}
    >
      <span
        className={`h-6 w-6 rounded-full ${visual}`}
        aria-hidden
      />
    </button>
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
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
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
    async function init() {
      setLoading(true);
      setError(null);
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
      };
      if (!roleRes.ok || !roleBody.role) {
        setError("Unable to load your profile.");
        setLoading(false);
        return;
      }
      if (roleBody.role !== "coach" && roleBody.role !== "admin") {
        router.replace("/login");
        return;
      }

      const headers = await authHeaders();
      if (!headers) {
        setError("Not signed in.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/coach/signature-scores", { headers });
      const body = (await res.json().catch(() => ({}))) as {
        scores?: Record<string, SignatureScore>;
        error?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setError(body.error ?? "Could not load scores.");
        setLoading(false);
        return;
      }
      setScores(normalizeScores(body.scores ?? {}));
      setLoading(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [router, impersonatingCoachId, authHeaders]);

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

  if (loading) {
    return (
      <p className="text-sm tracking-wide text-slate-500">Loading…</p>
    );
  }

  return (
    <div className="relative w-full pb-20">
      {error ? (
        <p className="mb-3 mt-3 text-left text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-0 mt-[40px] flex w-full justify-center">
          <SignaturePetalDiagram
            scores={scores}
            onScoreChange={setModuleScore}
          />
        </div>

        <div className="-mt-1 w-full sm:-mt-2">
          <div className="mt-4 flex items-center justify-end">
            <CompassScoringInfoPopover />
          </div>
          <div className="divide-y divide-slate-200/90 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm">
              <div className="divide-y divide-slate-100">
                {SIGNATURE_MODEL_V2.pillars.map((pillar) => (
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
                            <ScoreCycleDot
                              value={v}
                              onChange={(val) => setModuleScore(m.id, val)}
                              moduleLabel={m.diagramTitle}
                            />
                          </div>
                          <p className="col-start-2 row-start-1 min-w-0 text-pretty text-base font-semibold leading-snug text-slate-900 sm:text-[17px]">
                            {m.diagramTitle}
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
                ))}

                <div className="divide-y divide-slate-100">
                  <div
                    id="compass-section-centre"
                    className="scroll-mt-28 bg-slate-50/60 px-4 py-3 sm:px-5"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Centre — Income, Impact, Freedom
                    </p>
                    <p className="mt-1 text-sm leading-snug text-slate-500">
                      Where Connect, Enrol and Deliver overlap.
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
                          <ScoreCycleDot
                            value={v}
                            onChange={(val) =>
                              setModuleScore(row.moduleId, val)
                            }
                            moduleLabel={row.lensLabel}
                          />
                        </div>
                        <p className="col-start-2 row-start-1 min-w-0 text-pretty text-base font-semibold leading-snug text-slate-900 sm:text-[17px]">
                          {row.lensLabel}
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
