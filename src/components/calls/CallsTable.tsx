"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  Columns3,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { CallRow } from "@/lib/callRow";
import {
  callStatusClass,
  formatCallWhen,
  getCallDisplayName,
  getCallStatusLabel,
  isUpcomingCall,
} from "@/lib/prospectNextCall";

export type { CallRow };

type TimingFilter = "all" | "upcoming" | "past";
type StatusFilter =
  | "all"
  | "booked"
  | "confirmed"
  | "cancelled"
  | "showed"
  | "noshow"
  | "other";
type MatchFilter = "all" | "matched" | "unmatched_contact" | "unmatched_coach";
type CallSortField = "prospect" | "start_time" | "status";
type CallSortOrder = "asc" | "desc" | "missing_first";

type CallColumnKey =
  | "call"
  | "business"
  | "email"
  | "phone"
  | "status"
  | "coach"
  | "match"
  | "actions";

type CallColumnVisibility = Record<CallColumnKey, boolean>;

type CoachFilterOption = {
  id: string;
  label: string;
};

type Props = {
  calls: CallRow[];
  loading: boolean;
  error: string | null;
  showCoachColumn?: boolean;
  onRowClick?: (row: CallRow) => void;
  emptyMessage?: string;
  renderRowActions?: (row: CallRow) => React.ReactNode;
  coachFilterOptions?: CoachFilterOption[];
  coachFilter?: string | "all";
  onCoachFilterChange?: (coachId: string | "all") => void;
};

const DEFAULT_COLUMN_VISIBILITY: CallColumnVisibility = {
  call: true,
  business: true,
  email: true,
  phone: false,
  status: true,
  coach: true,
  match: false,
  actions: true,
};

const COLUMN_OPTIONS: Array<{ key: CallColumnKey; label: string }> = [
  { key: "call", label: "When" },
  { key: "business", label: "Business" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "status", label: "Status" },
  { key: "coach", label: "Coach" },
  { key: "match", label: "Match" },
  { key: "actions", label: "Actions" },
];

function matchStatusLabel(status: string): string {
  switch (status) {
    case "matched":
      return "Matched";
    case "unmatched_contact":
      return "No contact";
    case "unmatched_coach":
      return "No coach";
    default:
      return status.replace(/_/g, " ");
  }
}

function CallWhenCell({ row }: { row: CallRow }) {
  const when = formatCallWhen(row.start_time);
  const callName = getCallDisplayName(row);

  if (!when) {
    return (
      <div className="flex min-w-[9rem] flex-col gap-0.5">
        <span className="font-medium text-slate-800">{callName}</span>
        <span className="text-xs text-slate-400">No time set</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-[9rem] flex-col gap-0.5">
      <span className="font-medium text-slate-800" title={callName}>
        {callName}
      </span>
      <span className="text-xs text-slate-500">{when}</span>
    </div>
  );
}

export function CallsTable({
  calls,
  loading,
  error,
  showCoachColumn = false,
  onRowClick,
  emptyMessage = "No calls found for this selection.",
  renderRowActions,
  coachFilterOptions,
  coachFilter: controlledCoachFilter,
  onCoachFilterChange,
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [timingFilter, setTimingFilter] = useState<TimingFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [internalCoachFilter, setInternalCoachFilter] = useState<
    string | "all"
  >("all");
  const [sortField, setSortField] = useState<CallSortField>("start_time");
  const [sortOrder, setSortOrder] = useState<CallSortOrder>("desc");
  const [columnVisibility, setColumnVisibility] =
    useState<CallColumnVisibility>(DEFAULT_COLUMN_VISIBILITY);
  const [filtersMenuOpen, setFiltersMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);

  const filtersMenuRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);

  const coachFilter = controlledCoachFilter ?? internalCoachFilter;
  const setCoachFilter = onCoachFilterChange ?? setInternalCoachFilter;
  const showCoachFilter = Boolean(
    coachFilterOptions && coachFilterOptions.length > 0
  );

  useEffect(() => {
    if (!filtersMenuOpen && !sortMenuOpen && !columnsMenuOpen) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (filtersMenuRef.current?.contains(target)) return;
      if (sortMenuRef.current?.contains(target)) return;
      if (columnsMenuRef.current?.contains(target)) return;
      setFiltersMenuOpen(false);
      setSortMenuOpen(false);
      setColumnsMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [filtersMenuOpen, sortMenuOpen, columnsMenuOpen]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (timingFilter !== "all") count += 1;
    if (statusFilter !== "all") count += 1;
    if (matchFilter !== "all") count += 1;
    if (showCoachFilter && coachFilter !== "all") count += 1;
    return count;
  }, [timingFilter, statusFilter, matchFilter, showCoachFilter, coachFilter]);

  const hasActiveSort =
    sortField !== "start_time" || sortOrder !== "desc";

  const visibleColumns = useMemo(() => {
    const cols = new Set<CallColumnKey>(COLUMN_OPTIONS.map((option) => option.key));
    if (!showCoachColumn) cols.delete("coach");
    if (!renderRowActions) cols.delete("actions");
    return COLUMN_OPTIONS.filter(
      (option) => cols.has(option.key) && columnVisibility[option.key]
    );
  }, [showCoachColumn, renderRowActions, columnVisibility]);

  const filteredCalls = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return calls.filter((row) => {
      if (term) {
        const haystack = [
          row.prospect_name,
          row.business_name,
          row.prospect_email,
          row.prospect_phone,
          row.title,
          row.calendar_name,
          row.coach_name,
          row.coach_business_name,
          getCallStatusLabel(row.status_normalized),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (timingFilter === "upcoming") {
        if (!isUpcomingCall(row.start_time, row.status_normalized)) {
          return false;
        }
      }
      if (timingFilter === "past") {
        if (isUpcomingCall(row.start_time, row.status_normalized)) {
          return false;
        }
      }

      if (
        statusFilter !== "all" &&
        row.status_normalized !== statusFilter
      ) {
        return false;
      }

      if (matchFilter !== "all" && row.match_status !== matchFilter) {
        return false;
      }

      if (
        showCoachFilter &&
        coachFilter !== "all" &&
        row.coach_id !== coachFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    calls,
    searchTerm,
    timingFilter,
    statusFilter,
    matchFilter,
    showCoachFilter,
    coachFilter,
  ]);

  const sortedCalls = useMemo(() => {
    const rows = [...filteredCalls];

    rows.sort((a, b) => {
      if (sortField === "prospect") {
        const cmp = a.prospect_name.localeCompare(b.prospect_name, undefined, {
          sensitivity: "base",
        });
        return sortOrder === "asc" ? cmp : -cmp;
      }

      if (sortField === "status") {
        const cmp = getCallStatusLabel(a.status_normalized).localeCompare(
          getCallStatusLabel(b.status_normalized),
          undefined,
          { sensitivity: "base" }
        );
        return sortOrder === "asc" ? cmp : -cmp;
      }

      const aTime = a.start_time ? new Date(a.start_time).getTime() : null;
      const bTime = b.start_time ? new Date(b.start_time).getTime() : null;
      if (aTime == null && bTime == null) return 0;
      if (aTime == null) return sortOrder === "missing_first" ? -1 : 1;
      if (bTime == null) return sortOrder === "missing_first" ? 1 : -1;
      return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
    });

    return rows;
  }, [filteredCalls, sortField, sortOrder]);

  const sortOrderOptions = useMemo(() => {
    if (sortField === "prospect" || sortField === "status") {
      return [
        { value: "asc" as const, label: "A → Z" },
        { value: "desc" as const, label: "Z → A" },
      ];
    }
    return [
      { value: "desc" as const, label: "Latest first" },
      { value: "asc" as const, label: "Earliest first" },
      { value: "missing_first" as const, label: "No time first" },
    ];
  }, [sortField]);

  useEffect(() => {
    const valid = new Set(sortOrderOptions.map((option) => option.value));
    if (!valid.has(sortOrder)) {
      setSortOrder(sortOrderOptions[0]?.value ?? "desc");
    }
  }, [sortField, sortOrder, sortOrderOptions]);

  function renderColumnCell(key: CallColumnKey, row: CallRow) {
    switch (key) {
      case "call":
        return <CallWhenCell row={row} />;
      case "business":
        return row.business_name ?? "—";
      case "email":
        return (
          <span className="text-xs text-slate-500">
            {row.prospect_email ?? "—"}
          </span>
        );
      case "phone":
        return (
          <span className="text-xs text-slate-700">
            {row.prospect_phone ?? "—"}
          </span>
        );
      case "status":
        return (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ${callStatusClass(row.status_normalized)}`}
          >
            {getCallStatusLabel(row.status_normalized)}
          </span>
        );
      case "coach":
        return (
          <span className="text-xs text-slate-700">
            {row.coach_name ?? row.coach_business_name ?? "Unknown coach"}
          </span>
        );
      case "match":
        return (
          <span className="text-xs text-slate-600">
            {matchStatusLabel(row.match_status)}
          </span>
        );
      case "actions":
        return renderRowActions?.(row) ?? null;
      default:
        return null;
    }
  }

  const columnMenuOptions = COLUMN_OPTIONS.filter((option) => {
    if (option.key === "coach" && !showCoachColumn) return false;
    if (option.key === "actions" && !renderRowActions) return false;
    return true;
  });

  return (
    <div
      className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm"
      style={{ maxHeight: "calc(100vh - 14rem)" }}
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search calls"
              className="block w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div ref={filtersMenuRef} className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={filtersMenuOpen}
              onClick={() => {
                setFiltersMenuOpen((open) => !open);
                setSortMenuOpen(false);
                setColumnsMenuOpen(false);
              }}
              title="Filters"
              className={`relative inline-flex items-center rounded-md p-2 text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus:ring-2 focus:ring-sky-500 ${filtersMenuOpen ? "bg-slate-100 text-slate-900" : ""}`}
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden />
              {activeFilterCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold leading-none text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            {filtersMenuOpen ? (
              <div
                role="menu"
                className="absolute left-0 z-[90] mt-1 w-[min(92vw,20rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
              >
                <div className="space-y-3">
                  {showCoachFilter ? (
                    <div>
                      <label
                        htmlFor="call-coach-filter"
                        className="mb-1 block text-xs font-medium text-slate-600"
                      >
                        Coach
                      </label>
                      <select
                        id="call-coach-filter"
                        value={coachFilter}
                        onChange={(e) =>
                          setCoachFilter(
                            (e.target.value || "all") as string | "all"
                          )
                        }
                        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="all">All coaches</option>
                        {coachFilterOptions?.map((coach) => (
                          <option key={coach.id} value={coach.id}>
                            {coach.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div>
                    <label
                      htmlFor="call-timing-filter"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Timing
                    </label>
                    <select
                      id="call-timing-filter"
                      value={timingFilter}
                      onChange={(e) =>
                        setTimingFilter(e.target.value as TimingFilter)
                      }
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="all">All</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="past">Past</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="call-status-filter"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Status
                    </label>
                    <select
                      id="call-status-filter"
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(e.target.value as StatusFilter)
                      }
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="all">All</option>
                      <option value="booked">Booked</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="showed">Showed</option>
                      <option value="noshow">No show</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="call-match-filter"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Match
                    </label>
                    <select
                      id="call-match-filter"
                      value={matchFilter}
                      onChange={(e) =>
                        setMatchFilter(e.target.value as MatchFilter)
                      }
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="all">All</option>
                      <option value="matched">Matched</option>
                      <option value="unmatched_contact">No contact</option>
                      <option value="unmatched_coach">No coach</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div ref={sortMenuRef} className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={sortMenuOpen}
              onClick={() => {
                setSortMenuOpen((open) => !open);
                setFiltersMenuOpen(false);
                setColumnsMenuOpen(false);
              }}
              title={hasActiveSort ? "Sort (active)" : "Sort"}
              className={`relative inline-flex items-center rounded-md p-2 text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus:ring-2 focus:ring-sky-500 ${sortMenuOpen ? "bg-slate-100 text-slate-900" : ""}`}
            >
              <ArrowUpDown className="h-4 w-4 text-slate-500" aria-hidden />
              {hasActiveSort ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold leading-none text-white">
                  1
                </span>
              ) : null}
            </button>
            {sortMenuOpen ? (
              <div
                role="menu"
                className="absolute left-0 z-[90] mt-1 w-[min(92vw,18rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
              >
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="call-sort-field"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Sort by
                    </label>
                    <select
                      id="call-sort-field"
                      value={sortField}
                      onChange={(e) =>
                        setSortField(e.target.value as CallSortField)
                      }
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="start_time">Call time</option>
                      <option value="prospect">Prospect</option>
                      <option value="status">Status</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="call-sort-order"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Order
                    </label>
                    <select
                      id="call-sort-order"
                      value={sortOrder}
                      onChange={(e) =>
                        setSortOrder(e.target.value as CallSortOrder)
                      }
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      {sortOrderOptions.map((option) => (
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

          <div ref={columnsMenuRef} className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={columnsMenuOpen}
              onClick={() => {
                setColumnsMenuOpen((open) => !open);
                setFiltersMenuOpen(false);
                setSortMenuOpen(false);
              }}
              title="Columns"
              className={`inline-flex items-center rounded-md p-2 text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus:ring-2 focus:ring-sky-500 ${columnsMenuOpen ? "bg-slate-100 text-slate-900" : ""}`}
            >
              <Columns3 className="h-4 w-4 text-slate-500" aria-hidden />
            </button>
            {columnsMenuOpen ? (
              <div
                role="menu"
                className="absolute left-0 z-[90] mt-1 w-[min(92vw,16rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
              >
                <p className="mb-2 text-xs font-medium text-slate-600">
                  Show columns
                </p>
                <div className="space-y-2">
                  {columnMenuOptions.map((option) => (
                    <label
                      key={option.key}
                      className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={columnVisibility[option.key]}
                        onChange={(e) =>
                          setColumnVisibility((prev) => ({
                            ...prev,
                            [option.key]: e.target.checked,
                          }))
                        }
                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {!loading && calls.length > 0 ? (
            <span className="ml-auto text-xs text-slate-500">
              {sortedCalls.length === calls.length
                ? `${calls.length} call${calls.length === 1 ? "" : "s"}`
                : `${sortedCalls.length} of ${calls.length}`}
            </span>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        {!loading && sortedCalls.length === 0 && !error ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            {emptyMessage}
          </p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-left">Prospect</th>
                {visibleColumns.map((column) => (
                  <th key={column.key} className="px-4 py-3 text-left">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCalls.map((row) => (
                <tr
                  key={row.id}
                  className={
                    onRowClick
                      ? "group cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                      : "group border-t border-slate-100 hover:bg-slate-50"
                  }
                  onClick={
                    onRowClick
                      ? (e) => {
                          if (
                            (e.target as HTMLElement).closest(
                              "[data-row-action]"
                            )
                          ) {
                            return;
                          }
                          onRowClick(row);
                        }
                      : undefined
                  }
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {row.prospect_name}
                  </td>
                  {visibleColumns.map((column) => (
                    <td key={column.key} className="px-4 py-3">
                      <div data-row-action={column.key === "actions" ? "" : undefined}>
                        {renderColumnCell(column.key, row)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
