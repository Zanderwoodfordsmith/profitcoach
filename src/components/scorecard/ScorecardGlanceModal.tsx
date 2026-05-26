"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { BossScorecardResults } from "@/components/scorecard/BossScorecardResults";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { formatProspectLabel } from "@/lib/prospectDisplayFormat";
import type { ScorecardResultPayload } from "@/lib/bossScorecardScores";
import { formatProspectLastAssessed } from "@/lib/prospectNextCall";
import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  contactId: string | null;
  onClose: () => void;
};

type ScorecardContactSummary = {
  full_name: string;
  job_title: string | null;
  business_name: string | null;
  email: string | null;
};

function authHeaders(
  token: string,
  impersonatingCoachId: string | null
): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (impersonatingCoachId) {
    h["x-impersonate-coach-id"] = impersonatingCoachId;
  }
  return h;
}

function formatContactSubtitle(contact: ScorecardContactSummary): string | null {
  const parts = [
    formatProspectLabel(contact.job_title),
    formatProspectLabel(contact.business_name),
    contact.email?.trim() || null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function ScorecardGlanceModal({ contactId, onClose }: Props) {
  const { impersonatingCoachId } = useImpersonation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachSlug, setCoachSlug] = useState("");
  const [contact, setContact] = useState<ScorecardContactSummary | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [result, setResult] = useState<ScorecardResultPayload | null>(null);

  const loadReport = useCallback(async () => {
    if (!contactId) return;

    setLoading(true);
    setError(null);
    setContact(null);
    setCompletedAt(null);
    setResult(null);

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/coach/contacts/${contactId}/scorecard-report`, {
      headers: authHeaders(token, impersonatingCoachId),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      coach_slug?: string;
      completed_at?: string;
      contact?: ScorecardContactSummary;
      result?: ScorecardResultPayload;
    };

    if (!res.ok) {
      setError(json.error ?? "Could not load BOSS Score.");
      setLoading(false);
      return;
    }

    setCoachSlug(json.coach_slug ?? "");
    setContact(json.contact ?? null);
    setCompletedAt(json.completed_at ?? null);
    setResult(json.result ?? null);
    setLoading(false);
  }, [contactId, impersonatingCoachId]);

  useEffect(() => {
    if (!contactId) return;
    void loadReport();
  }, [contactId, loadReport]);

  useEffect(() => {
    if (!contactId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [contactId, onClose]);

  if (!contactId) return null;

  const contactSubtitle = contact ? formatContactSubtitle(contact) : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scorecard-glance-title"
      onClick={onClose}
    >
      <div
        className="relative my-4 w-full max-w-5xl rounded-2xl bg-[#f8fbff] shadow-2xl ring-1 ring-slate-900/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                BOSS Score
              </p>
              {loading ? (
                <p
                  id="scorecard-glance-title"
                  className="mt-1 text-base font-semibold text-slate-900"
                >
                  Loading…
                </p>
              ) : contact ? (
                <>
                  <h2
                    id="scorecard-glance-title"
                    className="mt-1 truncate text-lg font-semibold text-slate-900 sm:text-xl"
                  >
                    {contact.full_name}
                  </h2>
                  {contactSubtitle ? (
                    <p className="mt-0.5 truncate text-sm text-slate-600">
                      {contactSubtitle}
                    </p>
                  ) : null}
                  {completedAt ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Completed {formatProspectLastAssessed(completedAt)}
                    </p>
                  ) : null}
                </>
              ) : (
                <p
                  id="scorecard-glance-title"
                  className="mt-1 text-base font-semibold text-slate-900"
                >
                  Area scorecard results
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Loading BOSS Score…
            </div>
          ) : null}
          {error ? (
            <p className="py-8 text-center text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}
          {result ? (
            <BossScorecardResults
              result={result}
              coachSlug={coachSlug}
              coachGlance
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
