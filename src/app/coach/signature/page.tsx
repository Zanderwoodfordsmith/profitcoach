"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { StickyPageHeader } from "@/components/layout";
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
      className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-left outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
      aria-label={`${moduleLabel}: ${scoreAriaLabel(value ?? null)}. Tap to change.`}
    >
      <span
        className={`h-6 w-6 rounded-full ${visual}`}
        aria-hidden
      />
    </button>
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
      if (roleBody.role === "admin" && !impersonatingCoachId) {
        router.replace("/admin");
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
      <StickyPageHeader
        title="Signature snapshot"
        description="Tap the circle beside each line to score. The model updates as you go."
      />

      {error ? (
        <p className="mb-3 mt-3 text-left text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mb-0 mt-[40px] flex w-full justify-center">
        <SignaturePetalDiagram scores={scores} onScoreChange={setModuleScore} />
      </div>

      <div className="w-full divide-y divide-slate-200/90 border-y border-slate-200/80 bg-white/80 -mt-1 sm:-mt-2">
        <div className="divide-y divide-slate-100">
          {SIGNATURE_MODEL_V2.pillars.map((pillar) => (
            <div key={pillar.id} className="divide-y divide-slate-100">
              <div className="bg-slate-50/60 px-5 py-3.5 sm:px-6">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {pillar.title}
                </p>
              </div>
              {pillar.modules.map((m) => {
                const v = scores[m.id];
                return (
                  <div
                    key={m.id}
                    className="flex gap-4 px-4 py-5 sm:gap-5 sm:px-6"
                  >
                    <ScoreCycleDot
                      value={v}
                      onChange={(val) => setModuleScore(m.id, val)}
                      moduleLabel={m.diagramTitle}
                    />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-base leading-[1.55] text-slate-800 sm:text-[17px]">
                        <span className="font-semibold text-slate-900">
                          {m.diagramTitle}
                        </span>
                        <span className="text-slate-300"> · </span>
                        {m.question}
                      </p>
                      <p className="mt-1.5 font-mono text-xs text-slate-400">
                        {m.code}
                      </p>
                    </div>
                    <HintPopover
                      hint={m.onrampHint}
                      rowKey={m.id}
                      openKey={hintRow}
                      onToggle={setHintRow}
                    />
                  </div>
                );
              })}
            </div>
          ))}

          <div className="divide-y divide-slate-100">
            <div className="bg-slate-50/60 px-5 py-3.5 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Centre — Income, Impact, Freedom
              </p>
              <p className="mt-1.5 text-sm leading-snug text-slate-500">
                Where Connect, Enrol and Deliver overlap.
              </p>
            </div>
            {SIGNATURE_LIFESTYLE_LENSES.map((row) => {
              const v = scores[row.moduleId];
              return (
                <div
                  key={row.moduleId}
                  className="flex gap-4 px-4 py-5 sm:gap-5 sm:px-6"
                >
                  <ScoreCycleDot
                    value={v}
                    onChange={(val) => setModuleScore(row.moduleId, val)}
                    moduleLabel={row.lensLabel}
                  />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-base leading-[1.55] text-slate-800 sm:text-[17px]">
                      <span className="font-semibold text-slate-900">
                        {row.lensLabel}
                      </span>
                      <span className="text-slate-300"> · </span>
                      {row.question}
                    </p>
                    <p className="mt-1.5 font-mono text-xs text-slate-400">
                      {row.code}
                    </p>
                  </div>
                  <HintPopover
                    hint={row.onrampHint}
                    rowKey={row.moduleId}
                    openKey={hintRow}
                    onToggle={setHintRow}
                  />
                </div>
              );
            })}
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
