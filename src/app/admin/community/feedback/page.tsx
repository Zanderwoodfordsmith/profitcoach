"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type FeedbackStatus = "new" | "in_review" | "resolved";
type FeedbackType = "bug" | "feature" | "general";

type FeedbackRow = {
  id: string;
  created_at: string;
  created_by: string;
  type: FeedbackType;
  title: string | null;
  details: string;
  contact_email: string | null;
  page_path: string | null;
  user_agent: string | null;
  status: FeedbackStatus;
  author: {
    id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    role: string | null;
  } | null;
};

function authorName(row: FeedbackRow): string {
  const a = row.author;
  if (!a) return "Unknown";
  return (
    a.full_name?.trim() ||
    [a.first_name, a.last_name].filter(Boolean).join(" ").trim() ||
    "Unknown"
  );
}

export default function AdminCommunityFeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | FeedbackStatus>(
    "all"
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabaseClient
      .from("community_feedback_reports")
      .select(
        `
        id,
        created_at,
        created_by,
        type,
        title,
        details,
        contact_email,
        page_path,
        user_agent,
        status,
        author:profiles!created_by ( id, full_name, first_name, last_name, role )
      `
      )
      .order("created_at", { ascending: false });

    if (queryError) {
      setRows([]);
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const mapped = ((data ?? []) as Array<
      Omit<FeedbackRow, "author"> & {
        author:
          | FeedbackRow["author"]
          | FeedbackRow["author"][]
          | null;
      }
    >).map((r) => ({
      ...r,
      author: Array.isArray(r.author) ? (r.author[0] ?? null) : r.author,
    }));
    setRows(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  const displayedRows = useMemo(() => {
    if (filterStatus === "all") return rows;
    return rows.filter((r) => r.status === filterStatus);
  }, [filterStatus, rows]);

  async function updateStatus(id: string, status: FeedbackStatus) {
    setSavingId(id);
    setError(null);
    const { error: updateError } = await supabaseClient
      .from("community_feedback_reports")
      .update({ status })
      .eq("id", id);
    setSavingId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <div className="mx-auto w-full max-w-5xl pt-5 lg:pt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Feedback inbox</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(
                e.target.value as "all" | "new" | "in_review" | "resolved"
              )
            }
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="in_review">In review</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {error ? (
        <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading feedback...</p>
      ) : displayedRows.length === 0 ? (
        <p className="text-sm text-slate-500">No feedback reports yet.</p>
      ) : (
        <ul className="space-y-3 pb-6">
          {displayedRows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                      {row.type}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {row.title?.trim() || "(No title)"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                    {row.details}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>
                      By: <span className="font-medium">{authorName(row)}</span>
                    </span>
                    {row.contact_email ? (
                      <span>
                        Contact:{" "}
                        <span className="font-medium">{row.contact_email}</span>
                      </span>
                    ) : null}
                    {row.page_path ? (
                      <span className="truncate">
                        Page: <span className="font-medium">{row.page_path}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </label>
                  <select
                    value={row.status}
                    disabled={savingId === row.id}
                    onChange={(e) =>
                      void updateStatus(row.id, e.target.value as FeedbackStatus)
                    }
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
                  >
                    <option value="new">New</option>
                    <option value="in_review">In review</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
