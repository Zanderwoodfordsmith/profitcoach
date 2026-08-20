"use client";

import {
  ChevronDown,
  LayoutGrid,
  Plus,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StickyPageHeader } from "@/components/layout";
import { notifySupportCountsChanged } from "@/components/layout/useNewFeedbackCount";
import { AdminTicketReplies } from "@/components/support/AdminTicketReplies";
import {
  DEFAULT_SUPPORT_ASSIGNEE_ID,
  assigneeDisplayName,
  smartListLabel,
  type SupportAssignee,
  type SupportSmartList,
} from "@/lib/support/assignees";
import {
  SUPPORT_SOURCE_LABELS,
  SUPPORT_STATUS_ADMIN_LABELS,
  SUPPORT_TYPE_LABELS,
  authorDisplayName,
  formatSupportTicketId,
  normalizeSupportTicketType,
  supportTicketScore,
  type SupportTicketSource,
  type SupportTicketStatus,
  type SupportTicketType,
} from "@/lib/support/tickets";
import { supabaseClient } from "@/lib/supabaseClient";

type AdminTicketRow = {
  id: string;
  created_at: string;
  created_by: string | null;
  ticket_number: number;
  type: SupportTicketType;
  title: string | null;
  details: string;
  page_path: string | null;
  status: SupportTicketStatus;
  source: SupportTicketSource;
  assigned_to: string | null;
  community_post_id: string | null;
  contact_email: string | null;
  submitter_name: string | null;
  importance: number | null;
  ease: number | null;
  author: SupportAssignee | null;
  assignee: SupportAssignee | null;
};

type CoachOption = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

const TYPE_STYLES: Record<SupportTicketType, string> = {
  question: "bg-violet-100 text-violet-800 ring-violet-200/80",
  bug: "bg-rose-100 text-rose-800 ring-rose-200/80",
  idea: "bg-sky-100 text-sky-800 ring-sky-200/80",
};

const STATUS_STYLES: Record<SupportTicketStatus, string> = {
  new: "bg-amber-100 text-amber-900 ring-amber-200/80",
  in_review: "bg-sky-100 text-sky-800 ring-sky-200/80",
  resolved: "bg-green-50 text-green-800 ring-green-200/70",
};

const SMART_LISTS: SupportSmartList[] = [
  "zander",
  "pam",
  "all_open",
  "from_lessons",
  "ideas",
];

function normalizeProfile(
  row: SupportAssignee | SupportAssignee[] | null
): SupportAssignee | null {
  if (!row) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
}

function ticketAuthorLabel(row: AdminTicketRow): string {
  if (row.author) return authorDisplayName(row.author);
  if (row.submitter_name?.trim()) return row.submitter_name.trim();
  if (row.contact_email?.trim()) return row.contact_email.trim();
  return "Unknown";
}

export function AdminSupportPage() {
  const [rows, setRows] = useState<AdminTicketRow[]>([]);
  const [assignees, setAssignees] = useState<SupportAssignee[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [pamAssigneeId, setPamAssigneeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [smartList, setSmartList] = useState<SupportSmartList>("zander");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createCoachId, setCreateCoachId] = useState("");
  const [createType, setCreateType] = useState<SupportTicketType>("question");
  const [createTitle, setCreateTitle] = useState("");
  const [createDetails, setCreateDetails] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    setAdminUserId(user?.id ?? null);

    const { data: adminProfiles } = await supabaseClient
      .from("profiles")
      .select("id, full_name, first_name, last_name")
      .eq("role", "admin")
      .order("first_name", { ascending: true });

    const admins = (adminProfiles ?? []) as SupportAssignee[];
    setAssignees(admins);
    const pam = admins.find(
      (a) => (a.first_name ?? "").toLowerCase() === "pam"
    );
    setPamAssigneeId(pam?.id ?? null);

    const { data: coachProfiles } = await supabaseClient
      .from("profiles")
      .select("id, full_name, first_name, last_name")
      .in("role", ["coach", "admin"])
      .order("full_name", { ascending: true })
      .limit(500);
    setCoaches((coachProfiles ?? []) as CoachOption[]);
  }, []);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabaseClient
      .from("community_feedback_reports")
      .select(
        `
        id,
        created_at,
        created_by,
        ticket_number,
        type,
        title,
        details,
        page_path,
        status,
        source,
        assigned_to,
        community_post_id,
        contact_email,
        submitter_name,
        importance,
        ease,
        author:profiles!created_by ( id, full_name, first_name, last_name, role ),
        assignee:profiles!assigned_to ( id, full_name, first_name, last_name, role )
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
      Omit<AdminTicketRow, "type" | "author" | "assignee"> & {
        type: string;
        author: SupportAssignee | SupportAssignee[] | null;
        assignee: SupportAssignee | SupportAssignee[] | null;
      }
    >).map((row) => ({
      ...row,
      type: normalizeSupportTicketType(row.type),
      author: normalizeProfile(row.author),
      assignee: normalizeProfile(row.assignee),
    }));
    setRows(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMeta();
    void loadTickets();
  }, [loadMeta, loadTickets]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      switch (smartList) {
        case "zander":
          return (
            row.assigned_to === DEFAULT_SUPPORT_ASSIGNEE_ID &&
            row.status !== "resolved"
          );
        case "pam":
          return (
            pamAssigneeId != null &&
            row.assigned_to === pamAssigneeId &&
            row.status !== "resolved"
          );
        case "all_open":
          return row.status !== "resolved";
        case "from_lessons":
          return row.source === "lesson_private";
        case "ideas":
          return row.type === "idea";
        default:
          return true;
      }
    });
  }, [rows, smartList, pamAssigneeId]);

  async function updateRow(
    id: string,
    patch: Partial<
      Pick<
        AdminTicketRow,
        "status" | "importance" | "ease" | "assigned_to" | "type"
      >
    >
  ) {
    setSavingId(id);
    setError(null);
    const { error: updateError } = await supabaseClient
      .from("community_feedback_reports")
      .update(patch)
      .eq("id", id);
    setSavingId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (patch.assigned_to !== undefined) {
          next.assignee =
            assignees.find((a) => a.id === patch.assigned_to) ?? null;
        }
        return next;
      })
    );
    notifySupportCountsChanged();
  }

  async function deleteRow(row: AdminTicketRow) {
    const label = row.title?.trim() || formatSupportTicketId(row.ticket_number);
    if (!window.confirm(`Delete "${label}"? This can't be undone.`)) return;
    setSavingId(row.id);
    const { error: deleteError } = await supabaseClient
      .from("community_feedback_reports")
      .delete()
      .eq("id", row.id);
    setSavingId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    notifySupportCountsChanged();
  }

  async function submitCreateOnBehalf() {
    if (!createCoachId || !createTitle.trim() || !createDetails.trim()) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      const { data, error: insertError } = await supabaseClient
        .from("community_feedback_reports")
        .insert({
          created_by: createCoachId,
          created_by_admin: adminUserId,
          type: createType,
          title: createTitle.trim(),
          details: createDetails.trim(),
          source: "admin_created",
          assigned_to: DEFAULT_SUPPORT_ASSIGNEE_ID,
          status: "new",
        })
        .select(
          `
          id,
          created_at,
          created_by,
          ticket_number,
          type,
          title,
          details,
          page_path,
          status,
          source,
          assigned_to,
          community_post_id,
          contact_email,
          submitter_name,
          importance,
          ease,
          author:profiles!created_by ( id, full_name, first_name, last_name, role ),
          assignee:profiles!assigned_to ( id, full_name, first_name, last_name, role )
        `
        )
        .single();

      if (insertError) throw insertError;

      const created: AdminTicketRow = {
        ...(data as Omit<AdminTicketRow, "type" | "author" | "assignee"> & {
          type: string;
        }),
        type: normalizeSupportTicketType(
          (data as { type: string }).type
        ),
        author: normalizeProfile(
          (data as { author: SupportAssignee | SupportAssignee[] | null })
            .author
        ),
        assignee: normalizeProfile(
          (data as { assignee: SupportAssignee | SupportAssignee[] | null })
            .assignee
        ),
      };
      setRows((prev) => [created, ...prev]);
      setCreateOpen(false);
      setCreateCoachId("");
      setCreateTitle("");
      setCreateDetails("");
      setCreateType("question");
      notifySupportCountsChanged();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not create ticket."
      );
    } finally {
      setCreateBusy(false);
    }
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
        <button
          type="button"
          onClick={() => setViewMode("table")}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
            viewMode === "table"
              ? "bg-sky-700 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Table2 className="h-3.5 w-3.5" aria-hidden />
          Table
        </button>
        <button
          type="button"
          onClick={() => setViewMode("cards")}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
            viewMode === "cards"
              ? "bg-sky-700 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
          Cards
        </button>
      </div>
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-800"
      >
        <Plus className="h-4 w-4" aria-hidden />
        New ticket
      </button>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <StickyPageHeader title="Support" actions={headerActions} />

      <div className="mt-4 flex flex-wrap gap-2">
        {SMART_LISTS.map((list) => (
          <button
            key={list}
            type="button"
            onClick={() => setSmartList(list)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              smartList === list
                ? "bg-sky-700 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {smartListLabel(list)}
          </button>
        ))}
      </div>

      {createOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create support ticket"
          onClick={() => !createBusy && setCreateOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Create ticket for coach
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Coach
                </label>
                <select
                  value={createCoachId}
                  onChange={(e) => setCreateCoachId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select coach…</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {assigneeDisplayName(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Type
                </label>
                <select
                  value={createType}
                  onChange={(e) =>
                    setCreateType(e.target.value as SupportTicketType)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {(Object.keys(SUPPORT_TYPE_LABELS) as SupportTicketType[]).map(
                    (t) => (
                      <option key={t} value={t}>
                        {SUPPORT_TYPE_LABELS[t]}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Subject
                </label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Details
                </label>
                <textarea
                  rows={4}
                  value={createDetails}
                  onChange={(e) => setCreateDetails(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              {createError ? (
                <p className="text-sm text-rose-600">{createError}</p>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    createBusy ||
                    !createCoachId ||
                    !createTitle.trim() ||
                    !createDetails.trim()
                  }
                  onClick={() => void submitCreateOnBehalf()}
                  className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  {createBusy ? "Creating…" : "Create ticket"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading support tickets…</p>
      ) : filteredRows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No tickets in {smartListLabel(smartList).toLowerCase()}.
        </p>
      ) : viewMode === "cards" ? (
        <ul className="mt-6 space-y-4">
          {filteredRows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">
                    {formatSupportTicketId(row.ticket_number)} ·{" "}
                    {ticketAuthorLabel(row)}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">
                    {row.title?.trim() || "(No subject)"}
                  </h3>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[row.status]}`}
                >
                  {SUPPORT_STATUS_ADMIN_LABELS[row.status]}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                {row.details}
              </p>
              <AdminTicketReplies
                reportId={row.id}
                reportStatus={row.status}
                onStatusTouched={() => {
                  void loadTickets();
                  notifySupportCountsChanged();
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Coach</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const expanded = expandedId === row.id;
                  const score = supportTicketScore(row);
                  const saving = savingId === row.id;
                  return (
                    <tr key={row.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {row.title?.trim() || "(No subject)"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatSupportTicketId(row.ticket_number)}
                        </p>
                        <button
                          type="button"
                          className="mt-1 text-xs font-medium text-sky-700 hover:underline"
                          onClick={() =>
                            setExpandedId((c) => (c === row.id ? null : row.id))
                          }
                        >
                          {expanded ? "Hide thread" : "View thread"}
                        </button>
                        {row.page_path ? (
                          <p className="mt-1 text-xs text-slate-400">
                            {row.source === "lesson_private" ? (
                              <Link
                                href={`${row.page_path}${row.page_path.includes("?") ? "&" : "?"}tab=qa`}
                                className="text-sky-700 hover:underline"
                              >
                                Open lesson
                              </Link>
                            ) : (
                              row.page_path
                            )}
                          </p>
                        ) : null}
                        {expanded ? (
                          <div className="mt-3 max-w-xl">
                            <p className="whitespace-pre-wrap text-xs text-slate-600">
                              {row.details}
                            </p>
                            <AdminTicketReplies
                              reportId={row.id}
                              reportStatus={row.status}
                              onStatusTouched={() => {
                                void loadTickets();
                                notifySupportCountsChanged();
                              }}
                            />
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {ticketAuthorLabel(row)}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.type}
                          disabled={saving}
                          onChange={(e) =>
                            void updateRow(row.id, {
                              type: e.target.value as SupportTicketType,
                            })
                          }
                          className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${TYPE_STYLES[row.type]}`}
                        >
                          {(Object.keys(SUPPORT_TYPE_LABELS) as SupportTicketType[]).map(
                            (t) => (
                              <option key={t} value={t}>
                                {SUPPORT_TYPE_LABELS[t]}
                              </option>
                            )
                          )}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {SUPPORT_SOURCE_LABELS[row.source] ?? row.source}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.assigned_to ?? ""}
                          disabled={saving}
                          onChange={(e) =>
                            void updateRow(row.id, {
                              assigned_to: e.target.value || null,
                            })
                          }
                          className="max-w-[8rem] rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        >
                          <option value="">Unassigned</option>
                          {assignees.map((a) => (
                            <option key={a.id} value={a.id}>
                              {assigneeDisplayName(a)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.status}
                          disabled={saving}
                          onChange={(e) =>
                            void updateRow(row.id, {
                              status: e.target.value as SupportTicketStatus,
                            })
                          }
                          className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[row.status]}`}
                        >
                          {(
                            Object.keys(
                              SUPPORT_STATUS_ADMIN_LABELS
                            ) as SupportTicketStatus[]
                          ).map((s) => (
                            <option key={s} value={s}>
                              {SUPPORT_STATUS_ADMIN_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.type === "idea" ? (
                          <span>{score ?? "—"}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void deleteRow(row)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Delete ticket"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
