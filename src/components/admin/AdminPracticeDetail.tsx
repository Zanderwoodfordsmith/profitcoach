"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { PracticeBrief } from "@/components/practice/PracticeBrief";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { emptyDecision } from "@/lib/practiceKnowledge/decisionDefaults";
import type {
  DecisionRecordPayload,
  DecisionRecordRow,
  IntakeSessionRow,
  PracticeKnowledgeRow,
  PracticeReportPayload,
  PracticeStatus,
} from "@/lib/practiceKnowledge/types";

type Detail = {
  knowledge: PracticeKnowledgeRow;
  session: IntakeSessionRow | null;
  decision: DecisionRecordRow | null;
  profile: {
    id: string;
    full_name: string | null;
    slug: string | null;
    coach_business_name: string | null;
  } | null;
};

const STATUSES: PracticeStatus[] = [
  "capturing",
  "extracted",
  "coach_reviewed",
  "admin_reviewed",
  "decision_recorded",
  "ready_to_build",
  "building",
];

export function AdminPracticeDetail({ coachId }: { coachId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [decision, setDecision] = useState<DecisionRecordPayload>(emptyDecision());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function headers() {
    return getCoachAuthHeaders();
  }

  async function reload() {
    const h = await headers();
    if (!h) {
      setError("Not signed in.");
      return;
    }
    const res = await fetch(`/api/admin/practice/${coachId}`, { headers: h });
    const body = (await res.json().catch(() => null)) as
      | (Detail & { error?: string })
      | null;
    if (!res.ok || !body?.knowledge) {
      setError(body?.error || "Could not load this coach.");
      return;
    }
    setDetail(body);
    setDecision(body.decision?.payload ?? emptyDecision());
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachId]);

  async function patch(body: Record<string, unknown>) {
    const h = await headers();
    if (!h) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/practice/${coachId}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as
      | { knowledge?: PracticeKnowledgeRow; error?: string }
      | null;
    setBusy(false);
    if (!res.ok || !data?.knowledge) {
      setError(data?.error || "Could not update.");
      return;
    }
    setDetail((prev) => (prev ? { ...prev, knowledge: data.knowledge! } : prev));
  }

  async function generateReport() {
    const h = await headers();
    if (!h) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/practice/${coachId}/report`, {
      method: "POST",
      headers: h,
    });
    const data = (await res.json().catch(() => null)) as {
      report?: PracticeReportPayload;
      generated_at?: string;
      knowledge?: PracticeKnowledgeRow;
      error?: string;
    } | null;
    setBusy(false);
    if (!res.ok || !data?.knowledge) {
      setError(data?.error || "Could not write the report.");
      return;
    }
    setDetail((prev) => (prev ? { ...prev, knowledge: data.knowledge! } : prev));
  }

  async function saveDecision(lock: boolean) {
    const h = await headers();
    if (!h) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/practice/${coachId}/decision`, {
      method: "PUT",
      headers: h,
      body: JSON.stringify({
        payload: decision,
        lock,
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      decision?: DecisionRecordRow;
      error?: string;
    } | null;
    setBusy(false);
    if (!res.ok || !data?.decision) {
      setError(data?.error || "Could not save the Decision Record.");
      return;
    }
    setDetail((prev) => (prev ? { ...prev, decision: data.decision! } : prev));
    setDecision(data.decision.payload);
    if (lock) await reload();
  }

  const knowledge = detail?.knowledge;
  const name = detail?.profile?.full_name || "Coach";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/admin/blueprint/records" className="text-xs font-medium text-sky-600">
          ← Coach records
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">{name}</h2>
          <button
            type="button"
            onClick={() => {
              try {
                window.sessionStorage.setItem("blueprint-preview-coach", coachId);
              } catch {
                // The picker on the next page still works without it.
              }
              window.location.assign("/admin/blueprint/coach/blueprint");
            }}
            className="rounded-full bg-[#051e36] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#0c5290]"
          >
            Open their blueprint
          </button>
        </div>
        <p className="text-sm text-slate-600">
          The same brief the coach sees. Lock the Decision Record after the call.
        </p>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!knowledge ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <label className="text-sm text-slate-600">
              Status{" "}
              <select
                className="ml-2 rounded-lg border border-slate-200 px-2 py-1"
                value={knowledge.status}
                disabled={busy}
                onChange={(e) => void patch({ status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-sm text-slate-500">
              {knowledge.completeness_score}% complete
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void patch({ status: "admin_reviewed", admin_reviewed: true, sync_brain: true })}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium"
            >
              Mark reviewed
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void generateReport()}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium"
            >
              {busy ? "Writing…" : "Write recommendation"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void patch({ status: "ready_to_build", sync_brain: true })}
              className="rounded-lg bg-[#0c5290] px-3 py-1.5 text-sm font-semibold text-white"
            >
              Ready to build
            </button>
            {detail?.profile?.slug ? (
              <Link
                href={`/admin/coaches/${detail.profile.slug}?tab=practice`}
                className="text-sm text-sky-700"
              >
                Coach record
              </Link>
            ) : null}
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-8">
            <PracticeBrief
              readOnly
              payload={knowledge.payload}
              report={knowledge.report_payload}
              turns={detail?.session?.turns ?? []}
              question={null}
              interviewDone
              busy={busy}
              error={null}
              ttsOn={false}
              comments={knowledge.payload.review.report_comments?.value ?? ""}
              onPatch={() => {}}
              onCommit={() => {}}
              onStart={() => {}}
              onReply={() => {}}
              onSpeak={() => {}}
              onTranscribe={async () => null}
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold">Decision Record</h2>
            <p className="text-sm text-slate-600">
              Lock this after the call. It is the source of truth for LinkedIn,
              campaigns, follow-ups and nurture.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["target_market", "Target market"],
                  ["buyer", "Buyer"],
                  ["problem", "Problem"],
                  ["offer", "Offer"],
                  ["price", "Price"],
                  ["delivery_model", "Delivery model"],
                  ["geography", "Geography"],
                  ["campaign_angle", "Campaign angle"],
                  ["prospect_criteria", "Prospect criteria"],
                  ["launch_date", "Launch date"],
                  ["next_milestone", "Next milestone"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm">
                  <span className="font-medium text-slate-700">{label}</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={decision[key]}
                    onChange={(e) =>
                      setDecision((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Customer responsibilities</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={decision.customer_responsibilities}
                onChange={(e) =>
                  setDecision((prev) => ({
                    ...prev,
                    customer_responsibilities: e.target.value,
                  }))
                }
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveDecision(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium"
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveDecision(true)}
                className="rounded-lg bg-[#0c5290] px-3 py-2 text-sm font-semibold text-white"
              >
                Lock Decision Record
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
