"use client";

import { ArrowUpDown, ChevronDown, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FeedbackFormCard } from "@/components/feedback/FeedbackFormCard";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";
import { notifyFeedbackCountsChanged } from "@/components/layout/useNewFeedbackCount";
import { supabaseClient } from "@/lib/supabaseClient";

type FeedbackStatus = "new" | "in_review" | "resolved";
type FeedbackType = "bug" | "feature" | "general";
type FeedbackSortField = "date" | "score" | "impact" | "ease";
type FeedbackSortOrder = "desc" | "asc";

type FeedbackRow = {
  id: string;
  created_at: string;
  created_by: string;
  type: FeedbackType;
  title: string | null;
  details: string;
  page_path: string | null;
  user_agent: string | null;
  status: FeedbackStatus;
  importance: number | null;
  ease: number | null;
  author: {
    id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    role: string | null;
  } | null;
};

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "Bug",
  feature: "Feature",
  general: "General",
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  in_review: "In review",
  resolved: "Resolved",
};

const TYPE_STYLES: Record<FeedbackType, string> = {
  bug: "bg-rose-100 text-rose-800 ring-rose-200/80",
  feature: "bg-sky-100 text-sky-800 ring-sky-200/80",
  general: "bg-violet-100 text-violet-800 ring-violet-200/80",
};

const STATUS_ORDER: FeedbackStatus[] = ["new", "in_review", "resolved"];

const STATUS_GROUP_STYLES: Record<FeedbackStatus, string> = {
  new: "bg-amber-50/70",
  in_review: "bg-sky-50/70",
  resolved: "bg-green-50/70",
};

const SCORE_OPTIONS = ["", "1", "2", "3", "4", "5"] as const;

const RATING_STYLES: Record<"" | "1" | "2" | "3" | "4" | "5", string> = {
  "": "bg-slate-100 text-slate-500 ring-slate-200/80",
  "1": "bg-rose-50 text-rose-700 ring-rose-200/80",
  "2": "bg-orange-50 text-orange-800 ring-orange-200/80",
  "3": "bg-amber-50 text-amber-800 ring-amber-200/80",
  "4": "bg-lime-50 text-lime-800 ring-lime-200/80",
  "5": "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
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

function formatFeedbackDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function capitalizeFirstWord(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function feedbackScore(row: FeedbackRow): number | null {
  if (row.importance == null || row.ease == null) return null;
  return row.importance + row.ease;
}

function compareNullableNumbers(
  a: number | null,
  b: number | null
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

function sortFeedbackRows(
  items: FeedbackRow[],
  sortField: FeedbackSortField,
  sortOrder: FeedbackSortOrder
): FeedbackRow[] {
  return [...items].sort((a, b) => {
    let cmp = 0;

    switch (sortField) {
      case "date":
        cmp =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case "score":
        cmp = compareNullableNumbers(feedbackScore(a), feedbackScore(b));
        break;
      case "impact":
        cmp = compareNullableNumbers(a.importance, b.importance);
        break;
      case "ease":
        cmp = compareNullableNumbers(a.ease, b.ease);
        break;
    }

    if (cmp === 0) {
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return sortOrder === "desc" ? -cmp : cmp;
  });
}

function sortOrderOptions(
  sortField: FeedbackSortField
): { value: FeedbackSortOrder; label: string }[] {
  if (sortField === "date") {
    return [
      { value: "desc", label: "Recent first" },
      { value: "asc", label: "Oldest first" },
    ];
  }

  return [
    { value: "desc", label: "Highest first" },
    { value: "asc", label: "Lowest first" },
  ];
}

const STATUS_STYLES: Record<FeedbackStatus, string> = {
  new: "bg-amber-100 text-amber-900 ring-amber-200/80",
  in_review: "bg-sky-100 text-sky-800 ring-sky-200/80",
  resolved: "bg-green-50 text-green-800 ring-green-200/70",
};

function scoreClassName(score: number | null): string {
  if (score == null) return "text-slate-400";
  if (score >= 8) return "font-semibold text-emerald-700";
  if (score >= 5) return "font-semibold text-amber-700";
  return "font-semibold text-slate-600";
}

function pillSelectClassName(base: string): string {
  return `appearance-none rounded-full py-1 pl-3 pr-7 text-xs font-semibold ring-1 ring-inset focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-wait disabled:opacity-50 ${base}`;
}

type PillSelectProps<T extends string> = {
  value: T;
  disabled?: boolean;
  options: readonly T[];
  labels: Record<T, string>;
  styles: Record<T, string>;
  onChange: (value: T) => void;
};

function PillSelect<T extends string>({
  value,
  disabled,
  options,
  labels,
  styles,
  onChange,
}: PillSelectProps<T>) {
  return (
    <div className="relative inline-flex">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className={pillSelectClassName(styles[value])}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-60"
      />
    </div>
  );
}

type ScoreSelectProps = {
  value: number | null;
  disabled?: boolean;
  onChange: (value: number | null) => void;
};

function ScoreSelect({ value, disabled, onChange }: ScoreSelectProps) {
  const styleKey = value == null ? "" : String(value);

  return (
    <div className="relative inline-flex">
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value ? Number(e.target.value) : null)
        }
        className={pillSelectClassName(
          RATING_STYLES[styleKey as keyof typeof RATING_STYLES]
        )}
      >
        <option value="">—</option>
        {SCORE_OPTIONS.slice(1).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-60"
      />
    </div>
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<
    Set<FeedbackStatus>
  >(new Set());
  const [sortField, setSortField] = useState<FeedbackSortField>("score");
  const [sortOrder, setSortOrder] = useState<FeedbackSortOrder>("desc");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [addFeedbackOpen, setAddFeedbackOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  function toggleGroup(status: FeedbackStatus) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

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
        page_path,
        user_agent,
        status,
        importance,
        ease,
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

  useEffect(() => {
    if (!sortMenuOpen) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (sortMenuRef.current?.contains(target)) return;
      setSortMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [sortMenuOpen]);

  const hasActiveSort = sortField !== "score" || sortOrder !== "desc";
  const orderOptions = sortOrderOptions(sortField);

  const groupedRows = useMemo(() => {
    const filtered =
      filterStatus === "all"
        ? rows
        : rows.filter((r) => r.status === filterStatus);

    const statuses =
      filterStatus === "all" ? STATUS_ORDER : [filterStatus];

    return statuses
      .map((status) => ({
        status,
        rows: sortFeedbackRows(
          filtered.filter((r) => r.status === status),
          sortField,
          sortOrder
        ),
      }))
      .filter((group) => group.rows.length > 0);
  }, [filterStatus, rows, sortField, sortOrder]);

  const totalDisplayedRows = groupedRows.reduce(
    (count, group) => count + group.rows.length,
    0
  );

  async function updateRow(
    id: string,
    patch: Partial<Pick<FeedbackRow, "status" | "importance" | "ease">>
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
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
    notifyFeedbackCountsChanged();
  }

  return (
    <div className="mx-auto w-full max-w-6xl pt-1">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
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

        <div ref={sortMenuRef} className="relative">
            <TableToolbarButton
              label="Sort"
              aria-haspopup="true"
              aria-expanded={sortMenuOpen}
              active={sortMenuOpen}
              badge={hasActiveSort ? 1 : null}
              title={hasActiveSort ? "Sort (active)" : "Sort"}
              onClick={() => setSortMenuOpen((open) => !open)}
              icon={
                <ArrowUpDown className="h-5 w-5 text-slate-500" aria-hidden />
              }
            />
            {sortMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-30 mt-1 w-[min(92vw,18rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
              >
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="feedback-sort-field"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Sort by
                    </label>
                    <select
                      id="feedback-sort-field"
                      value={sortField}
                      onChange={(e) =>
                        setSortField(e.target.value as FeedbackSortField)
                      }
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="score">Score</option>
                      <option value="date">Date</option>
                      <option value="impact">Impact</option>
                      <option value="ease">Ease</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="feedback-sort-order"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Order
                    </label>
                    <select
                      id="feedback-sort-order"
                      value={sortOrder}
                      onChange={(e) =>
                        setSortOrder(e.target.value as FeedbackSortOrder)
                      }
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      {orderOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : null}
        </div>

        <button
          type="button"
          onClick={() => setAddFeedbackOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add feedback
        </button>
      </div>

      {addFeedbackOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setAddFeedbackOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Add feedback"
        >
          <div
            className="relative w-full max-w-[38.4rem]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setAddFeedbackOpen(false)}
              className="absolute -right-1 -top-1 z-10 rounded-full border border-slate-200 bg-white p-1 text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
              aria-label="Close add feedback"
            >
              <X className="h-4 w-4" />
            </button>
            <FeedbackFormCard
              onSubmitted={() => {
                void loadFeedback();
                setAddFeedbackOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading feedback...</p>
      ) : totalDisplayedRows === 0 ? (
        <p className="text-sm text-slate-500">No feedback reports yet.</p>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-24 whitespace-nowrap px-4 py-3">Date</th>
                    <th className="w-28 whitespace-nowrap px-4 py-3">Type</th>
                    <th className="w-[38%] px-4 py-3">Title</th>
                    <th className="whitespace-nowrap px-4 py-3">Impact</th>
                    <th className="whitespace-nowrap px-4 py-3">Ease</th>
                    <th className="whitespace-nowrap px-4 py-3">Score</th>
                    <th className="whitespace-nowrap px-4 py-3">Status</th>
                  </tr>
                </thead>
              </table>
            </div>
          </div>

          {groupedRows.map((group) => {
            const collapsed = collapsedGroups.has(group.status);

            return (
              <div
                key={group.status}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <button
                  type="button"
                  aria-expanded={!collapsed}
                  onClick={() => toggleGroup(group.status)}
                  className={`flex w-full items-center gap-2 border-b border-slate-200 px-4 py-2.5 text-left ${STATUS_GROUP_STYLES[group.status]}`}
                >
                  <ChevronDown
                    aria-hidden
                    className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${collapsed ? "-rotate-90" : ""}`}
                  />
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[group.status]}`}
                  >
                    {STATUS_LABELS[group.status]}
                  </span>
                  <span className="text-xs text-slate-500">
                    {group.rows.length}
                  </span>
                </button>

                {!collapsed ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed text-sm">
                      <tbody>
                        {group.rows.map((row) => {
                          const score = feedbackScore(row);
                          const saving = savingId === row.id;
                          const expanded = expandedId === row.id;

                          return (
                            <tr
                              key={row.id}
                              className={`border-t border-slate-100 ${
                                row.status === "resolved"
                                  ? "bg-green-50/50"
                                  : ""
                              }`}
                            >
                              <td className="w-24 whitespace-nowrap px-4 py-3 text-slate-600">
                                {formatFeedbackDate(row.created_at)}
                              </td>
                              <td className="w-28 whitespace-nowrap px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${TYPE_STYLES[row.type]}`}
                                >
                                  {TYPE_LABELS[row.type]}
                                </span>
                              </td>
                              <td className="w-[38%] px-4 py-3 align-top">
                                <p className="text-xs text-slate-500">
                                  {authorName(row)}
                                </p>
                                <p className="mt-0.5 text-sm leading-snug">
                                  <span className="font-medium text-slate-900">
                                    {capitalizeFirstWord(
                                      row.title?.trim() || "(No title)"
                                    )}
                                  </span>
                                  <button
                                    type="button"
                                    aria-expanded={expanded}
                                    aria-label={
                                      expanded
                                        ? "Hide description"
                                        : "Show description"
                                    }
                                    onClick={() =>
                                      setExpandedId((current) =>
                                        current === row.id ? null : row.id
                                      )
                                    }
                                    className="ml-0.5 inline-flex translate-y-px align-top rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                  >
                                    <ChevronDown
                                      aria-hidden
                                      className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                                    />
                                  </button>
                                </p>
                                {expanded ? (
                                  <p className="mt-2 break-words whitespace-pre-wrap text-xs text-slate-500">
                                    {capitalizeFirstWord(row.details)}
                                  </p>
                                ) : null}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <ScoreSelect
                                  value={row.importance}
                                  disabled={saving}
                                  onChange={(importance) =>
                                    void updateRow(row.id, { importance })
                                  }
                                />
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <ScoreSelect
                                  value={row.ease}
                                  disabled={saving}
                                  onChange={(ease) =>
                                    void updateRow(row.id, { ease })
                                  }
                                />
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <span className={scoreClassName(score)}>
                                  {score ?? "—"}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <PillSelect
                                  value={row.status}
                                  disabled={saving}
                                  options={
                                    Object.keys(
                                      STATUS_LABELS
                                    ) as FeedbackStatus[]
                                  }
                                  labels={STATUS_LABELS}
                                  styles={STATUS_STYLES}
                                  onChange={(status) =>
                                    void updateRow(row.id, { status })
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
