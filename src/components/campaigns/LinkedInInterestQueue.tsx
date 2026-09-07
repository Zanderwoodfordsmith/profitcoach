"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";

type QueueLead = {
  id: string;
  campaign_id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  status: string;
  interest_outcome: string | null;
  interest_note: string | null;
  linkedin_url: string | null;
};

type ReplySnippet = {
  id: string;
  group?: string;
  when: string;
  channel?: string;
  body: string;
  emailBody?: string;
};

type ReplySnippetGroup = {
  id: string;
  label: string;
  description: string;
  snippets: ReplySnippet[];
};

async function authHeaders(): Promise<HeadersInit | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

/**
 * North-star queue: interested replies → assessment → call offer.
 */
export function LinkedInInterestQueue() {
  const pathname = usePathname() ?? "";
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const [leads, setLeads] = useState<QueueLead[]>([]);
  const [assessmentUrl, setAssessmentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snippetGroups, setSnippetGroups] = useState<ReplySnippetGroup[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const [qRes, pRes] = await Promise.all([
        fetch("/api/coach/linkedin-outreach/interest", { headers }),
        fetch("/api/coach/linkedin-outreach/interest?view=playbooks", {
          headers,
        }),
      ]);
      const qBody = await qRes.json().catch(() => ({}));
      const pBody = await pRes.json().catch(() => ({}));
      if (!qRes.ok) throw new Error(qBody.error || "Could not load queue.");
      setLeads(qBody.queue ?? []);
      setAssessmentUrl(qBody.assessment_url ?? null);
      const groups = (pBody.reply_snippet_groups ?? []) as ReplySnippetGroup[];
      if (groups.length) {
        setSnippetGroups(groups);
      } else {
        const flat = (pBody.reply_snippets ?? []) as ReplySnippet[];
        setSnippetGroups(
          flat.length
            ? [
                {
                  id: "all",
                  label: "Reply playbook snippets",
                  description: "",
                  snippets: flat,
                },
              ]
            : []
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function mark(
    leadId: string,
    payload: Record<string, unknown>
  ) {
    setBusyId(leadId);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/coach/linkedin-outreach/interest", {
        method: "POST",
        headers,
        body: JSON.stringify({ lead_id: leadId, ...payload }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Update failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  function fillSnippet(body: string, lead: QueueLead) {
    return body
      .replace(/\{\{first_name\}\}/gi, lead.first_name || "there")
      .replace(/\{\{assessment_url\}\}/gi, assessmentUrl || "[scorecard link]")
      .replace(/\{\{review_name\}\}/gi, "Business Clarity Review")
      .replace(/\{\{their_reply\}\}/gi, lead.interest_note || "your note")
      .replace(/\{\{company\}\}/gi, lead.company || "business")
      .replace(/\{\{coach_name\}\}/gi, "me");
  }

  /** Prefer groups relevant to where the lead is in the funnel. */
  function groupsForLead(lead: QueueLead): ReplySnippetGroup[] {
    const outcome = lead.interest_outcome;
    const status = lead.status;
    const prefer = new Set<string>();
    if (
      status === "replied" ||
      outcome === "positive" ||
      outcome === "soft" ||
      status === "interested"
    ) {
      prefer.add("interest");
      prefer.add("response_types");
      prefer.add("follow_up");
      prefer.add("scorecard");
    }
    if (outcome === "negative") {
      prefer.add("response_types");
      prefer.add("nurture_engage");
    }
    if (
      status === "assessment_sent" ||
      status === "assessment_done" ||
      status === "call_offered"
    ) {
      prefer.add("scorecard");
      prefer.add("interest");
      prefer.add("follow_up");
    }
    if (!prefer.size) return snippetGroups;
    const ranked = [
      ...snippetGroups.filter((g) => prefer.has(g.id)),
      ...snippetGroups.filter((g) => !prefer.has(g.id)),
    ];
    return ranked;
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Interest queue
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            North star: interested reply → BOSS score → then call. Log outcomes
            here; don&apos;t pitch the calendar first.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {loading && !leads.length ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : leads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No replies logged yet. When someone replies in Conversations, mark them
          interested here (or from the campaign lead list).
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {leads.map((lead) => {
            const name =
              [lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
              "Lead";
            return (
              <li key={lead.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`${prefix}/campaigns/${lead.campaign_id}`}
                      className="text-sm font-semibold text-slate-900 hover:underline"
                    >
                      {name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {lead.company || "—"} · {lead.status}
                      {lead.interest_outcome
                        ? ` · ${lead.interest_outcome}`
                        : ""}
                    </p>
                    {lead.interest_note ? (
                      <p className="mt-1 text-xs text-slate-600">
                        {lead.interest_note}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.status === "replied" || !lead.interest_outcome ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === lead.id}
                          onClick={() =>
                            void mark(lead.id, { outcome: "positive" })
                          }
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Interested
                        </button>
                        <button
                          type="button"
                          disabled={busyId === lead.id}
                          onClick={() =>
                            void mark(lead.id, { outcome: "soft" })
                          }
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-50 disabled:opacity-50"
                        >
                          Soft yes
                        </button>
                        <button
                          type="button"
                          disabled={busyId === lead.id}
                          onClick={() =>
                            void mark(lead.id, { outcome: "negative" })
                          }
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Not now
                        </button>
                      </>
                    ) : null}
                    {(lead.status === "interested" ||
                      lead.interest_outcome === "positive" ||
                      lead.interest_outcome === "soft") &&
                    lead.status !== "assessment_sent" &&
                    lead.status !== "assessment_done" &&
                    lead.status !== "call_offered" ? (
                      <button
                        type="button"
                        disabled={busyId === lead.id}
                        onClick={() =>
                          void mark(lead.id, {
                            action: "funnel",
                            status: "assessment_sent",
                          })
                        }
                        className="rounded-lg bg-[#0c5290] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0a457a] disabled:opacity-50"
                      >
                        Sent scorecard
                      </button>
                    ) : null}
                    {lead.status === "assessment_sent" ? (
                      <button
                        type="button"
                        disabled={busyId === lead.id}
                        onClick={() =>
                          void mark(lead.id, {
                            action: "funnel",
                            status: "assessment_done",
                          })
                        }
                        className="rounded-lg bg-[#0c5290] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0a457a] disabled:opacity-50"
                      >
                        Took scorecard
                      </button>
                    ) : null}
                    {(lead.status === "assessment_done" ||
                      lead.status === "interested") && (
                      <button
                        type="button"
                        disabled={busyId === lead.id}
                        onClick={() =>
                          void mark(lead.id, {
                            action: "funnel",
                            status: "call_offered",
                          })
                        }
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        Offered call
                      </button>
                    )}
                    {assessmentUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          void navigator.clipboard.writeText(assessmentUrl)
                        }
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-50"
                      >
                        Copy scorecard link
                      </button>
                    ) : null}
                  </div>
                </div>
                {snippetGroups.length &&
                (lead.status === "interested" ||
                  lead.status === "replied" ||
                  lead.interest_outcome) ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-medium text-slate-500">
                      How to reply — playbook snippets
                    </summary>
                    <div className="mt-2 space-y-3">
                      {groupsForLead(lead).map((group) => (
                        <div key={group.id}>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {group.label}
                          </p>
                          {group.description ? (
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {group.description}
                            </p>
                          ) : null}
                          <ul className="mt-1.5 space-y-1.5">
                            {group.snippets.map((s) => {
                              const filled = fillSnippet(s.body, lead);
                              const channelHint =
                                s.channel && s.channel !== "any"
                                  ? ` · ${s.channel}`
                                  : s.emailBody
                                    ? " · DM length"
                                    : "";
                              return (
                                <li key={s.id}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void navigator.clipboard.writeText(filled)
                                    }
                                    className="w-full rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-left text-[11px] text-slate-700 hover:bg-slate-100"
                                  >
                                    <span className="font-semibold text-slate-800">
                                      {s.when}
                                      <span className="font-normal text-slate-400">
                                        {channelHint}
                                      </span>
                                    </span>
                                    <span className="mt-0.5 block line-clamp-2 text-slate-500">
                                      {filled}
                                    </span>
                                  </button>
                                  {s.emailBody ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void navigator.clipboard.writeText(
                                          fillSnippet(s.emailBody!, lead)
                                        )
                                      }
                                      className="mt-1 w-full rounded-lg border border-dashed border-slate-200 px-2.5 py-1 text-left text-[10px] text-slate-500 hover:bg-slate-50"
                                    >
                                      Copy email version (longer)
                                    </button>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
