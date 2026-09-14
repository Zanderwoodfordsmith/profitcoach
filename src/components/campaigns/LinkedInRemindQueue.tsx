"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  ActivityTableHeader,
  ActivityTableRow,
  shortStepLabel,
} from "@/components/campaigns/CampaignActivityRows";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import {
  demoPreviewRemindQueue,
  isDemoPreviewId,
} from "@/lib/campaigns/demoPreview";
import type { LeadStatusIcon, LeadStatusTone } from "@/lib/unipile/campaignLeadActivity";

type RemindItem = {
  job_id: string;
  campaign_id: string;
  campaign_name: string;
  lead_id: string;
  scheduled_for: string;
  preview_body: string;
  draft_body: string | null;
  fallback_at: string | null;
  state: "upcoming" | "due" | "overdue";
  step_type?: string;
  call_wait?: boolean;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  linkedin_url: string | null;
};

async function authHeaders(): Promise<Record<string, string> | null> {
  return getCoachAuthHeaders();
}

function leadName(item: RemindItem) {
  return (
    [item.first_name, item.last_name].filter(Boolean).join(" ") ||
    item.linkedin_url ||
    "Unknown"
  );
}

function relativeDue(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const mins = Math.round(ms / 60000);
  if (Math.abs(mins) < 60) {
    if (mins >= 0) return `in ${mins}m`;
    return `${Math.abs(mins)}m overdue`;
  }
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) {
    if (hours >= 0) return `in ${hours}h`;
    return `${Math.abs(hours)}h overdue`;
  }
  const days = Math.round(hours / 24);
  if (days >= 0) return `in ${days}d`;
  return `${Math.abs(days)}d overdue`;
}

/**
 * Coach-send queue: planned message steps that need a human send.
 * Inbox stays for replies — this is the proactive work queue.
 */
export function LinkedInRemindQueue({
  hideWhenEmpty = false,
  preview = false,
  embedded = false,
}: {
  hideWhenEmpty?: boolean;
  preview?: boolean;
  /** Compact list for the campaigns activity pane (no outer card). */
  embedded?: boolean;
}) {
  const [items, setItems] = useState<RemindItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    const stale = () => signal?.cancelled;
    if (preview) {
      const dummy = demoPreviewRemindQueue();
      if (stale()) return;
      setItems(dummy.queue);
      setError(null);
      setLoading(false);
      return;
    }
    setItems([]);
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/linkedin-outreach/remind", {
        headers,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not load due queue.");
      if (stale()) return;
      setItems(body.queue ?? []);
    } catch (err) {
      if (stale()) return;
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      if (!stale()) setLoading(false);
    }
  }, [preview]);

  useEffect(() => {
    const signal = { cancelled: false };
    void load(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [load]);

  async function act(
    jobId: string,
    action: "send" | "skip" | "snooze" | "complete",
    extra?: { body?: string; hours?: number }
  ) {
    if (preview || isDemoPreviewId(jobId)) return;
    setBusyId(jobId);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Sign in required.");
      const res = await fetch("/api/coach/linkedin-outreach/remind", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action,
          job_id: jobId,
          body: extra?.body,
          hours: extra?.hours,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Action failed.");
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  const actionable = items.filter((i) => i.state !== "upcoming");
  const upcoming = items.filter((i) => i.state === "upcoming");

  if (loading && items.length === 0) {
    if (hideWhenEmpty && !embedded) return null;
    if (embedded) {
      return (
        <div className="flex flex-1 items-center justify-center px-5 py-10 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      );
    }
    return (
      <section className="rounded-2xl border border-slate-200/90 bg-white px-5 py-8 text-center text-sm text-slate-500 shadow-sm shadow-slate-200/40">
        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        <p className="mt-2">Loading…</p>
      </section>
    );
  }

  if (
    hideWhenEmpty &&
    !embedded &&
    actionable.length === 0 &&
    upcoming.length === 0
  ) {
    return null;
  }

  const dueRows = [...actionable, ...upcoming];

  if (embedded) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {error ? (
          <div className="border-b border-rose-100 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
            {error}
          </div>
        ) : null}
        {dueRows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-800">Nothing due</p>
            <p className="mt-1 text-xs text-slate-500">
              Remind-me messages and calls will list here.
            </p>
          </div>
        ) : (
          <>
            <ActivityTableHeader />
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {dueRows.map((item) => {
                const open = editingId === item.job_id;
                const busy = busyId === item.job_id;
                const isCall = item.step_type === "call";
                const status =
                  item.state === "overdue"
                    ? {
                        tone: "rose" as LeadStatusTone,
                        icon: "failed" as LeadStatusIcon,
                        label: "Overdue",
                      }
                    : item.state === "upcoming"
                      ? {
                          tone: "slate" as LeadStatusTone,
                          icon: "pending" as LeadStatusIcon,
                          label: "Later",
                        }
                      : {
                          tone: "amber" as LeadStatusTone,
                          icon: "needsYou" as LeadStatusIcon,
                          label: "Due",
                        };
                return (
                  <ActivityTableRow
                    key={item.job_id}
                    name={leadName(item)}
                    status={status}
                    next={shortStepLabel(item.step_type || "message")}
                    open={open}
                    onToggle={() => {
                      setEditingId(open ? null : item.job_id);
                      setDraft(item.draft_body || item.preview_body);
                    }}
                  >
                    <p className="text-xs text-slate-500">
                      {item.campaign_name}
                      {item.company ? ` · ${item.company}` : ""}
                      {" · "}
                      {relativeDue(item.scheduled_for)}
                    </p>
                    {isCall ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busy || preview}
                          onClick={() => void act(item.job_id, "complete")}
                          className="rounded-lg bg-[#0c5290] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0a457a] disabled:opacity-50"
                        >
                          {busy ? "Saving…" : "Mark as called"}
                        </button>
                        <button
                          type="button"
                          disabled={busy || preview}
                          onClick={() => void act(item.job_id, "snooze", { hours: 24 })}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Snooze
                        </button>
                        <button
                          type="button"
                          disabled={busy || preview}
                          onClick={() => {
                            if (
                              !window.confirm(
                                item.call_wait
                                  ? "Skip this call and continue the sequence?"
                                  : "Dismiss this call reminder?"
                              )
                            )
                              return;
                            void act(item.job_id, "skip");
                          }}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        >
                          Skip
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={
                            open
                              ? draft
                              : item.draft_body || item.preview_body
                          }
                          onChange={(e) => setDraft(e.target.value)}
                          rows={4}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={
                              busy ||
                              preview ||
                              isDemoPreviewId(item.job_id) ||
                              !draft.trim()
                            }
                            onClick={() =>
                              void act(item.job_id, "send", { body: draft })
                            }
                            className="rounded-lg bg-[#0c5290] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0a457a] disabled:opacity-50"
                          >
                            {busy ? "Sending…" : "Send"}
                          </button>
                          <button
                            type="button"
                            disabled={busy || preview}
                            onClick={() =>
                              void act(item.job_id, "snooze", { hours: 24 })
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Snooze
                          </button>
                          <button
                            type="button"
                            disabled={busy || preview}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  "Skip this message and continue the sequence?"
                                )
                              )
                                return;
                              void act(item.job_id, "skip");
                            }}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    )}
                  </ActivityTableRow>
                );
              })}
            </ul>
          </>
        )}
      </div>
    );
  }

  return null;
}
