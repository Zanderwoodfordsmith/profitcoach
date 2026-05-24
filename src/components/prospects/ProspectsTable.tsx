"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  Columns3,
  GripVertical,
  Loader2,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";
import { TableToolbarAddButton } from "@/components/table/TableToolbarAddButton";
import { TableCsvExportButton } from "@/components/table/TableCsvExportButton";
import { exportProspectsToCsv } from "@/lib/exportProspectsCsv";
import {
  formatProspectLastAssessed,
  formatProspectNextCallWhen,
  getProspectNextCallName,
  getProspectNextCallStatusLabel,
  type ProspectNextCall,
} from "@/lib/prospectNextCall";
import type { ProspectRow } from "@/lib/prospectRow";
import { ProspectLeadSubtitle } from "@/components/prospects/ProspectLeadSubtitle";
import { ProspectContactEditModal } from "@/components/prospects/ProspectContactEditModal";
import { ProspectNextActionCell } from "@/components/prospects/ProspectNextActionCell";
import { ProspectStatusCell } from "@/components/prospects/ProspectStatusCell";
import { formatProspectLabel, formatProspectPersonName } from "@/lib/prospectDisplayFormat";
import { PROSPECT_STATUS_OPTIONS } from "@/lib/prospectStatus";
import type { ProspectFieldPatch } from "@/lib/prospects/updateProspectFields";

export type { ProspectRow };

type AssessmentFilter = "all" | "assessed" | "not_assessed";
type NextCallFilter = "all" | "has_call" | "no_call";
type NextCallStatusFilter = "all" | "booked" | "confirmed" | "other";
type ProspectStatusFilter = "all" | import("@/lib/prospectStatus").ProspectStatusValue;
type ProspectSortField = "name" | "last_assessed" | "last_score" | "next_call";
type ProspectSortOrder =
  | "asc"
  | "desc"
  | "missing_first"
  | "no_call_last";

type ProspectColumnKey =
  | "business"
  | "email"
  | "phone"
  | "type"
  | "coach"
  | "actions"
  | "last_score"
  | "last_assessed"
  | "revenue"
  | "team_size"
  | "years_in_business"
  | "outcome"
  | "obstacles"
  | "preferred_support"
  | "boss_level"
  | "next_call"
  | "next_action"
  | "status";

type ProspectColumnVisibility = Record<ProspectColumnKey, boolean>;

type CoachFilterOption = {
  id: string;
  label: string;
};

type Props = {
  prospects: ProspectRow[];
  loading: boolean;
  error: string | null;
  showCoachColumn?: boolean;
  showTypeColumn?: boolean;
  onRowClick?: (id: string) => void;
  emptyMessage?: string;
  /** Renders actions cell per row (e.g. "View as client" button). Stops row click propagation. */
  renderRowActions?: (row: ProspectRow) => React.ReactNode;
  /** When set, adds coach filter to the toolbar (e.g. admin prospects). */
  coachFilterOptions?: CoachFilterOption[];
  /** Controlled coach filter — when omitted, filter state is internal. */
  coachFilter?: string | "all";
  onCoachFilterChange?: (coachId: string | "all") => void;
  /** When set, shows a delete button on the right of each row. */
  onDelete?: (row: ProspectRow) => void | Promise<void>;
  deletingId?: string | null;
  /** Persists column visibility and order to localStorage. */
  settingsStorageKey?: string;
  /** Enables inline editing for title, business, and next action. */
  editable?: boolean;
  onUpdateProspect?: (
    row: ProspectRow,
    patch: ProspectFieldPatch
  ) => Promise<void>;
  /** When set, shows an Add button in the table toolbar (after search, before Filters). */
  onAddClick?: () => void;
  addActive?: boolean;
  addLabel?: string;
};

const PROSPECTS_TABLE_SETTINGS_STORAGE_KEY = "prospects-table-settings-v4";

const COLUMN_OPTIONS: Array<{ key: ProspectColumnKey; label: string }> = [
  { key: "business", label: "Business" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "type", label: "Type" },
  { key: "coach", label: "Coach" },
  { key: "actions", label: "Actions" },
  { key: "status", label: "Status" },
  { key: "last_score", label: "Last score" },
  { key: "last_assessed", label: "Last assessed" },
  { key: "revenue", label: "Revenue" },
  { key: "team_size", label: "Team size" },
  { key: "years_in_business", label: "Years in business" },
  { key: "outcome", label: "Outcome" },
  { key: "obstacles", label: "Obstacles" },
  { key: "preferred_support", label: "Preferred support" },
  { key: "boss_level", label: "BOSS level" },
  { key: "next_call", label: "Next call" },
  { key: "next_action", label: "Next action" },
];

const DEFAULT_COLUMN_VISIBILITY: ProspectColumnVisibility = {
  business: false,
  email: true,
  phone: true,
  type: true,
  coach: true,
  actions: false,
  status: true,
  last_score: true,
  last_assessed: true,
  revenue: false,
  team_size: false,
  years_in_business: false,
  outcome: false,
  obstacles: false,
  preferred_support: false,
  boss_level: false,
  next_call: true,
  next_action: true,
};

const DEFAULT_COLUMN_ORDER: ProspectColumnKey[] = COLUMN_OPTIONS.map(
  (option) => option.key
);

type PersistedProspectTableSettings = {
  columnVisibility: ProspectColumnVisibility;
  columnOrder: ProspectColumnKey[];
};

function parsePersistedProspectTableSettings(
  raw: string
): PersistedProspectTableSettings | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedProspectTableSettings>;
    if (!parsed.columnVisibility || !parsed.columnOrder) return null;
    const validKeys = new Set<ProspectColumnKey>(
      COLUMN_OPTIONS.map((option) => option.key)
    );
    const columnVisibility = { ...DEFAULT_COLUMN_VISIBILITY };
    for (const key of validKeys) {
      if (typeof parsed.columnVisibility[key] === "boolean") {
        columnVisibility[key] = parsed.columnVisibility[key] as boolean;
      }
    }
    const seen = new Set<ProspectColumnKey>();
    const columnOrder: ProspectColumnKey[] = [];
    for (const key of parsed.columnOrder) {
      if (validKeys.has(key) && !seen.has(key)) {
        columnOrder.push(key);
        seen.add(key);
      }
    }
    for (const key of DEFAULT_COLUMN_ORDER) {
      if (!seen.has(key)) columnOrder.push(key);
    }
    return { columnVisibility, columnOrder };
  } catch {
    return null;
  }
}

function nextCallStatusClass(status: string | null | undefined): string {
  switch (status) {
    case "confirmed":
      return "bg-emerald-50 text-emerald-700";
    case "booked":
      return "bg-sky-50 text-sky-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function ProspectNextCallCell({ next }: { next: ProspectNextCall | null | undefined }) {
  if (!next?.start_time) {
    return <span className="text-slate-400">—</span>;
  }

  const when = formatProspectNextCallWhen(next);
  if (!when) {
    return <span className="text-slate-400">—</span>;
  }

  const callName = getProspectNextCallName(next);
  const statusLabel = getProspectNextCallStatusLabel(next.status_normalized);

  return (
    <div className="flex min-w-[9rem] flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium text-slate-800" title={callName}>
          {callName}
        </span>
        <span
          className={`inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none ${nextCallStatusClass(next.status_normalized)}`}
        >
          {statusLabel}
        </span>
      </div>
      <span className="text-sm text-slate-500">{when}</span>
    </div>
  );
}

export function ProspectsTable({
  prospects,
  loading,
  error,
  showCoachColumn = false,
  showTypeColumn = true,
  onRowClick,
  emptyMessage = "No prospects found for this selection.",
  renderRowActions,
  coachFilterOptions,
  coachFilter: controlledCoachFilter,
  onCoachFilterChange,
  onDelete,
  deletingId = null,
  settingsStorageKey = PROSPECTS_TABLE_SETTINGS_STORAGE_KEY,
  editable = false,
  onUpdateProspect,
  onAddClick,
  addActive = false,
  addLabel,
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [assessmentFilter, setAssessmentFilter] =
    useState<AssessmentFilter>("all");
  const [nextCallFilter, setNextCallFilter] = useState<NextCallFilter>("all");
  const [nextCallStatusFilter, setNextCallStatusFilter] =
    useState<NextCallStatusFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ProspectStatusFilter>("all");
  const [internalCoachFilter, setInternalCoachFilter] = useState<
    string | "all"
  >("all");
  const [sortField, setSortField] = useState<ProspectSortField>("name");
  const [sortOrder, setSortOrder] = useState<ProspectSortOrder>("asc");
  const [columnVisibility, setColumnVisibility] =
    useState<ProspectColumnVisibility>(DEFAULT_COLUMN_VISIBILITY);
  const [columnOrder, setColumnOrder] =
    useState<ProspectColumnKey[]>(DEFAULT_COLUMN_ORDER);
  const [draggingColumnKey, setDraggingColumnKey] =
    useState<ProspectColumnKey | null>(null);
  const [hasLoadedPersistedSettings, setHasLoadedPersistedSettings] =
    useState(false);
  const [filtersMenuOpen, setFiltersMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [savingFieldById, setSavingFieldById] = useState<
    Record<string, "next_action" | "status" | "contact" | null>
  >({});
  const [editModalProspect, setEditModalProspect] = useState<ProspectRow | null>(
    null
  );

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(settingsStorageKey);
    if (raw) {
      const parsed = parsePersistedProspectTableSettings(raw);
      if (parsed) {
        setColumnVisibility(parsed.columnVisibility);
        setColumnOrder(parsed.columnOrder);
      }
    }
    setHasLoadedPersistedSettings(true);
  }, [settingsStorageKey]);

  useEffect(() => {
    if (!hasLoadedPersistedSettings || typeof window === "undefined") return;
    const payload: PersistedProspectTableSettings = {
      columnVisibility,
      columnOrder,
    };
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(payload));
  }, [
    hasLoadedPersistedSettings,
    settingsStorageKey,
    columnVisibility,
    columnOrder,
  ]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (assessmentFilter !== "all") count += 1;
    if (nextCallFilter !== "all") count += 1;
    if (nextCallStatusFilter !== "all") count += 1;
    if (statusFilter !== "all") count += 1;
    if (showCoachFilter && coachFilter !== "all") count += 1;
    return count;
  }, [
    assessmentFilter,
    nextCallFilter,
    nextCallStatusFilter,
    statusFilter,
    showCoachFilter,
    coachFilter,
  ]);

  const hasActiveSort = sortField !== "name" || sortOrder !== "asc";

  const columnMenuOptions = useMemo(
    () =>
      COLUMN_OPTIONS.filter((option) => {
        if (option.key === "type" && !showTypeColumn) return false;
        if (option.key === "coach" && !showCoachColumn) return false;
        if (option.key === "actions" && !renderRowActions) return false;
        return true;
      }),
    [showTypeColumn, showCoachColumn, renderRowActions]
  );

  const applicableColumnKeys = useMemo(
    () => new Set(columnMenuOptions.map((option) => option.key)),
    [columnMenuOptions]
  );

  const shownColumnOptions = useMemo(
    () =>
      columnOrder
        .filter(
          (key) => applicableColumnKeys.has(key) && columnVisibility[key]
        )
        .map(
          (key) => columnMenuOptions.find((option) => option.key === key)!
        ),
    [columnOrder, applicableColumnKeys, columnVisibility, columnMenuOptions]
  );

  const hiddenColumnOptions = useMemo(
    () =>
      columnOrder
        .filter(
          (key) => applicableColumnKeys.has(key) && !columnVisibility[key]
        )
        .map(
          (key) => columnMenuOptions.find((option) => option.key === key)!
        ),
    [columnOrder, applicableColumnKeys, columnVisibility, columnMenuOptions]
  );

  const visibleColumns = useMemo(
    () => shownColumnOptions,
    [shownColumnOptions]
  );

  function moveColumnInOrder(
    draggedKey: ProspectColumnKey,
    targetKey: ProspectColumnKey
  ) {
    if (draggedKey === targetKey) return;
    setColumnOrder((prev) => {
      const from = prev.indexOf(draggedKey);
      const to = prev.indexOf(targetKey);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  const filteredProspects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return prospects.filter((p) => {
      if (term) {
        const haystack = [
          p.full_name,
          p.job_title,
          p.business_name,
          p.email,
          p.phone,
          p.next_action?.text,
          p.status.label,
          p.coach_name,
          p.coach_business_name,
          p.revenue,
          p.team_size,
          p.years_in_business,
          p.outcome,
          p.obstacles,
          p.preferred_support,
          p.boss_level,
          getProspectNextCallName(p.next_call),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (assessmentFilter === "assessed" && !p.last_completed_at) {
        return false;
      }
      if (assessmentFilter === "not_assessed" && p.last_completed_at) {
        return false;
      }

      if (nextCallFilter === "has_call" && !p.next_call?.start_time) {
        return false;
      }
      if (nextCallFilter === "no_call" && p.next_call?.start_time) {
        return false;
      }

      if (
        nextCallStatusFilter !== "all" &&
        p.next_call?.status_normalized !== nextCallStatusFilter
      ) {
        return false;
      }

      if (statusFilter !== "all" && p.status.value !== statusFilter) {
        return false;
      }

      if (
        showCoachFilter &&
        coachFilter !== "all" &&
        p.coach_id !== coachFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    prospects,
    searchTerm,
    assessmentFilter,
    nextCallFilter,
    nextCallStatusFilter,
    statusFilter,
    showCoachFilter,
    coachFilter,
  ]);

  const sortedProspects = useMemo(() => {
    const rows = [...filteredProspects];

    rows.sort((a, b) => {
      if (sortField === "name") {
        const cmp = a.full_name.localeCompare(b.full_name, undefined, {
          sensitivity: "base",
        });
        return sortOrder === "desc" ? -cmp : cmp;
      }

      if (sortField === "last_score") {
        const aScore = a.last_score;
        const bScore = b.last_score;
        if (aScore == null && bScore == null) return 0;
        if (aScore == null) return sortOrder === "missing_first" ? -1 : 1;
        if (bScore == null) return sortOrder === "missing_first" ? 1 : -1;
        return sortOrder === "asc" ? aScore - bScore : bScore - aScore;
      }

      if (sortField === "last_assessed") {
        const aTime = a.last_completed_at
          ? new Date(a.last_completed_at).getTime()
          : null;
        const bTime = b.last_completed_at
          ? new Date(b.last_completed_at).getTime()
          : null;
        if (aTime == null && bTime == null) return 0;
        if (aTime == null) return sortOrder === "missing_first" ? -1 : 1;
        if (bTime == null) return sortOrder === "missing_first" ? 1 : -1;
        return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
      }

      const aTime = a.next_call?.start_time
        ? new Date(a.next_call.start_time).getTime()
        : null;
      const bTime = b.next_call?.start_time
        ? new Date(b.next_call.start_time).getTime()
        : null;
      if (aTime == null && bTime == null) return 0;
      if (aTime == null) return sortOrder === "no_call_last" ? 1 : -1;
      if (bTime == null) return sortOrder === "no_call_last" ? -1 : 1;
      return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
    });

    return rows;
  }, [filteredProspects, sortField, sortOrder]);

  const colCount = 1 + visibleColumns.length + (onDelete ? 1 : 0);

  const sortOrderOptions = useMemo(() => {
    if (sortField === "name") {
      return [
        { value: "asc" as const, label: "A → Z" },
        { value: "desc" as const, label: "Z → A" },
      ];
    }
    if (sortField === "last_score") {
      return [
        { value: "desc" as const, label: "Highest first" },
        { value: "asc" as const, label: "Lowest first" },
        { value: "missing_first" as const, label: "No score first" },
      ];
    }
    if (sortField === "last_assessed") {
      return [
        { value: "desc" as const, label: "Most recent first" },
        { value: "asc" as const, label: "Oldest first" },
        { value: "missing_first" as const, label: "Not assessed first" },
      ];
    }
    return [
      { value: "asc" as const, label: "Soonest first" },
      { value: "desc" as const, label: "Latest first" },
      { value: "no_call_last" as const, label: "No call last" },
    ];
  }, [sortField]);

  useEffect(() => {
    const valid = new Set(sortOrderOptions.map((option) => option.value));
    if (!valid.has(sortOrder)) {
      setSortOrder(sortOrderOptions[0]?.value ?? "asc");
    }
  }, [sortField, sortOrder, sortOrderOptions]);

  function openContactEdit(prospect: ProspectRow) {
    if (!editable || !onUpdateProspect) return;
    setEditModalProspect(prospect);
  }

  function renderEditableContactValue(
    prospect: ProspectRow,
    value: string | null | undefined,
    emptyLabel = "—"
  ) {
    const display = value?.trim() || emptyLabel;
    if (!editable || !onUpdateProspect) {
      return (
        <span className="text-sm text-slate-700">{display}</span>
      );
    }
    return (
      <button
        type="button"
        data-row-action
        onClick={(e) => {
          e.stopPropagation();
          openContactEdit(prospect);
        }}
        className="text-left text-sm text-slate-700 hover:text-sky-700"
        title="Edit contact details"
      >
        {display}
      </button>
    );
  }

  function renderOptionalText(value: string | null | undefined) {
    return value ? (
      <span className="text-sm text-slate-700">{value}</span>
    ) : (
      "—"
    );
  }

  function renderColumnCell(key: ProspectColumnKey, p: ProspectRow) {
    switch (key) {
      case "business":
        return renderEditableContactValue(
          p,
          formatProspectLabel(p.business_name),
          "—"
        );
      case "email":
        return renderEditableContactValue(p, p.email);
      case "phone":
        return renderEditableContactValue(p, p.phone);
      case "type":
        return <span className="text-sm text-slate-700">{p.type}</span>;
      case "coach":
        return (
          <span className="text-sm text-slate-700">
            {p.coach_name ?? p.coach_business_name ?? "Unknown coach"}
          </span>
        );
      case "actions":
        return renderRowActions?.(p) ?? null;
      case "status":
        return (
          <ProspectStatusCell
            row={p}
            editable={editable && Boolean(onUpdateProspect)}
            saving={savingFieldById[p.id] === "status"}
            onSave={async (prospect_status) => {
              if (!onUpdateProspect) return;
              setSavingFieldById((prev) => ({ ...prev, [p.id]: "status" }));
              try {
                await onUpdateProspect(p, { prospect_status });
              } finally {
                setSavingFieldById((prev) => ({ ...prev, [p.id]: null }));
              }
            }}
          />
        );
      case "last_score":
        return p.last_score != null ? `${p.last_score}` : "—";
      case "last_assessed":
        return (
          <span className="text-sm text-slate-500">
            {formatProspectLastAssessed(p.last_completed_at)}
          </span>
        );
      case "revenue":
        return renderOptionalText(p.revenue);
      case "team_size":
        return renderOptionalText(p.team_size);
      case "years_in_business":
        return renderOptionalText(p.years_in_business);
      case "outcome":
        return renderOptionalText(p.outcome);
      case "obstacles":
        return renderOptionalText(p.obstacles);
      case "preferred_support":
        return renderOptionalText(p.preferred_support);
      case "boss_level":
        return renderOptionalText(p.boss_level);
      case "next_call":
        return <ProspectNextCallCell next={p.next_call} />;
      case "next_action":
        return (
          <ProspectNextActionCell
            nextAction={p.next_action}
            editable={editable && Boolean(onUpdateProspect)}
            saving={savingFieldById[p.id] === "next_action"}
            onSave={async (values) => {
              if (!onUpdateProspect) return;
              setSavingFieldById((prev) => ({ ...prev, [p.id]: "next_action" }));
              try {
                await onUpdateProspect(p, { next_action: values });
              } finally {
                setSavingFieldById((prev) => ({ ...prev, [p.id]: null }));
              }
            }}
          />
        );
      default:
        return null;
    }
  }

  function renderColumnHeader(key: ProspectColumnKey) {
    switch (key) {
      case "last_score":
        return "Last score";
      case "last_assessed":
        return "Last assessed";
      case "next_call":
        return "Next call";
      case "next_action":
        return "Next action";
      default:
        return COLUMN_OPTIONS.find((option) => option.key === key)?.label ?? key;
    }
  }

  const visibleTableKeys = useMemo(
    () => visibleColumns.map((column) => column.key),
    [visibleColumns]
  );

  const applicableTableKeys = useMemo(
    () => columnMenuOptions.map((option) => option.key),
    [columnMenuOptions]
  );

  function buildExportInput(mode: "shown" | "all") {
    return {
      mode,
      visibleTableKeys,
      applicableTableKeys,
      columnOrder,
    };
  }

  function handleExportCsv(mode: "shown" | "all") {
    exportProspectsToCsv(sortedProspects, buildExportInput(mode));
  }

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
              placeholder="Search prospects"
              className="block w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {onAddClick ? (
            <TableToolbarAddButton
              onClick={onAddClick}
              active={addActive}
              label={addLabel}
            />
          ) : null}

          <div ref={filtersMenuRef} className="relative">
            <TableToolbarButton
              label="Filters"
              aria-haspopup="true"
              aria-expanded={filtersMenuOpen}
              active={filtersMenuOpen}
              badge={activeFilterCount > 0 ? activeFilterCount : null}
              onClick={() => {
                setFiltersMenuOpen((open) => !open);
                setSortMenuOpen(false);
                setColumnsMenuOpen(false);
              }}
              icon={
                <SlidersHorizontal
                  className="h-5 w-5 text-slate-500"
                  aria-hidden
                />
              }
            />
            {filtersMenuOpen ? (
              <div
                role="menu"
                className="absolute left-0 z-[90] mt-1 w-[min(92vw,20rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
              >
                <div className="space-y-3">
                  {showCoachFilter ? (
                    <div>
                      <label
                        htmlFor="prospect-coach-filter"
                        className="mb-1 block text-xs font-medium text-slate-600"
                      >
                        Coach
                      </label>
                      <select
                        id="prospect-coach-filter"
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
                      htmlFor="prospect-assessment-filter"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Assessment
                    </label>
                    <select
                      id="prospect-assessment-filter"
                      value={assessmentFilter}
                      onChange={(e) =>
                        setAssessmentFilter(e.target.value as AssessmentFilter)
                      }
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="all">All</option>
                      <option value="assessed">Assessed</option>
                      <option value="not_assessed">Not assessed</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="prospect-next-call-filter"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Next call
                    </label>
                    <select
                      id="prospect-next-call-filter"
                      value={nextCallFilter}
                      onChange={(e) =>
                        setNextCallFilter(e.target.value as NextCallFilter)
                      }
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="all">All</option>
                      <option value="has_call">Has upcoming call</option>
                      <option value="no_call">No upcoming call</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="prospect-call-status-filter"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Call status
                    </label>
                    <select
                      id="prospect-call-status-filter"
                      value={nextCallStatusFilter}
                      onChange={(e) =>
                        setNextCallStatusFilter(
                          e.target.value as NextCallStatusFilter
                        )
                      }
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="all">All</option>
                      <option value="booked">Booked</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="other">Scheduled</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="prospect-status-filter"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Status
                    </label>
                    <select
                      id="prospect-status-filter"
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(e.target.value as ProspectStatusFilter)
                      }
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="all">All</option>
                      {PROSPECT_STATUS_OPTIONS.map((option) => (
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

          <div ref={sortMenuRef} className="relative">
            <TableToolbarButton
              label="Sort"
              aria-haspopup="true"
              aria-expanded={sortMenuOpen}
              active={sortMenuOpen}
              badge={hasActiveSort ? 1 : null}
              title={hasActiveSort ? "Sort (active)" : "Sort"}
              onClick={() => {
                setSortMenuOpen((open) => !open);
                setFiltersMenuOpen(false);
                setColumnsMenuOpen(false);
              }}
              icon={
                <ArrowUpDown className="h-5 w-5 text-slate-500" aria-hidden />
              }
            />
            {sortMenuOpen ? (
              <div
                role="menu"
                className="absolute left-0 z-[90] mt-1 w-[min(92vw,18rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
              >
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="prospect-sort-field"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Sort by
                    </label>
                    <select
                      id="prospect-sort-field"
                      value={sortField}
                      onChange={(e) =>
                        setSortField(e.target.value as ProspectSortField)
                      }
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="name">Name</option>
                      <option value="last_assessed">Last assessed</option>
                      <option value="last_score">Last score</option>
                      <option value="next_call">Next call</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="prospect-sort-order"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Order
                    </label>
                    <select
                      id="prospect-sort-order"
                      value={sortOrder}
                      onChange={(e) =>
                        setSortOrder(e.target.value as ProspectSortOrder)
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
            <TableToolbarButton
              label="Columns"
              aria-haspopup="true"
              aria-expanded={columnsMenuOpen}
              active={columnsMenuOpen}
              onClick={() => {
                setColumnsMenuOpen((open) => !open);
                setFiltersMenuOpen(false);
                setSortMenuOpen(false);
              }}
              icon={
                <Columns3 className="h-5 w-5 text-slate-500" aria-hidden />
              }
            />
            {columnsMenuOpen ? (
              <div
                role="menu"
                className="absolute left-0 z-[90] mt-1 max-h-[min(24rem,70vh)] w-[min(100vw-2rem,18rem)] overflow-y-auto rounded-md border border-slate-200 bg-white py-2 shadow-lg"
              >
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Shown
                </p>
                <ul className="space-y-0.5 px-2">
                  {shownColumnOptions.map(({ key, label }) => (
                    <li
                      key={key}
                      role="none"
                      draggable
                      onDragStart={(e) => {
                        setDraggingColumnKey(key);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", key);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const droppedKey =
                          (e.dataTransfer.getData(
                            "text/plain"
                          ) as ProspectColumnKey) || draggingColumnKey;
                        if (droppedKey) moveColumnInOrder(droppedKey, key);
                        setDraggingColumnKey(null);
                      }}
                      onDragEnd={() => setDraggingColumnKey(null)}
                      className={`rounded ${draggingColumnKey === key ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                        <GripVertical
                          className="h-3.5 w-3.5 text-slate-400"
                          aria-hidden
                        />
                        <input
                          type="checkbox"
                          checked={columnVisibility[key]}
                          onChange={(e) =>
                            setColumnVisibility((prev) => ({
                              ...prev,
                              [key]: e.target.checked,
                            }))
                          }
                          className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span>{label}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="my-2 border-t border-slate-200" />
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Hidden
                </p>
                <ul className="space-y-0.5 px-2">
                  {hiddenColumnOptions.map(({ key, label }) => (
                    <li
                      key={key}
                      role="none"
                      draggable
                      onDragStart={(e) => {
                        setDraggingColumnKey(key);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", key);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const droppedKey =
                          (e.dataTransfer.getData(
                            "text/plain"
                          ) as ProspectColumnKey) || draggingColumnKey;
                        if (droppedKey) moveColumnInOrder(droppedKey, key);
                        setDraggingColumnKey(null);
                      }}
                      onDragEnd={() => setDraggingColumnKey(null)}
                      className={`rounded ${draggingColumnKey === key ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                        <GripVertical
                          className="h-3.5 w-3.5 text-slate-400"
                          aria-hidden
                        />
                        <input
                          type="checkbox"
                          checked={columnVisibility[key]}
                          onChange={(e) =>
                            setColumnVisibility((prev) => ({
                              ...prev,
                              [key]: e.target.checked,
                            }))
                          }
                          className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span>{label}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <TableCsvExportButton
            disabled={loading || sortedProspects.length === 0}
            onExportShown={() => handleExportCsv("shown")}
            onExportAll={() => handleExportCsv("all")}
          />

          {!loading && prospects.length > 0 ? (
            <span className="ml-auto text-xs text-slate-500">
              {sortedProspects.length === prospects.length
                ? `${prospects.length} prospect${prospects.length === 1 ? "" : "s"}`
                : `${sortedProspects.length} of ${prospects.length}`}
            </span>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        {!loading && sortedProspects.length === 0 && !error ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            {emptyMessage}
          </p>
        ) : (
          <table className="min-w-full text-left text-base">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-sm uppercase tracking-wide text-slate-500 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-left">Lead</th>
                {visibleColumns.map((column) => (
                  <th key={column.key} className="px-4 py-3 text-left">
                    {renderColumnHeader(column.key)}
                  </th>
                ))}
                {onDelete ? (
                  <th
                    className="sticky right-0 z-20 bg-slate-50 px-2 py-3 text-center"
                    aria-label="Delete"
                  />
                ) : null}
              </tr>
            </thead>
            <tbody>
              {sortedProspects.map((p) => (
                <tr
                  key={p.id}
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
                          onRowClick(p.id);
                        }
                      : undefined
                  }
                  role={onRowClick ? "button" : undefined}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div className="min-w-[10rem]">
                      {editable && onUpdateProspect ? (
                        <button
                          type="button"
                          data-row-action
                          onClick={(e) => {
                            e.stopPropagation();
                            openContactEdit(p);
                          }}
                          className="text-left hover:text-sky-700"
                          title="Edit contact details"
                        >
                          {formatProspectPersonName(p.full_name) || p.full_name}
                        </button>
                      ) : (
                        <span>
                          {formatProspectPersonName(p.full_name) || p.full_name}
                        </span>
                      )}
                      <ProspectLeadSubtitle
                        jobTitle={p.job_title}
                        businessName={p.business_name}
                        editable={editable && Boolean(onUpdateProspect)}
                        onEdit={() => openContactEdit(p)}
                      />
                    </div>
                  </td>
                  {visibleColumns.map((column) => (
                    <td
                      key={column.key}
                      className="px-4 py-3 text-slate-700"
                      {...(column.key === "actions"
                        ? {
                            "data-row-action": true,
                            onClick: (e: React.MouseEvent) =>
                              e.stopPropagation(),
                          }
                        : {})}
                    >
                      {renderColumnCell(column.key, p)}
                    </td>
                  ))}
                  {onDelete ? (
                    <td
                      className="sticky right-0 z-10 bg-white px-2 py-3 text-center align-middle group-hover:bg-slate-50"
                      data-row-action
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => void onDelete(p)}
                        disabled={deletingId === p.id}
                        title={
                          deletingId === p.id
                            ? "Deleting prospect…"
                            : `Delete ${p.full_name}`
                        }
                        aria-label={
                          deletingId === p.id
                            ? "Deleting prospect"
                            : `Delete ${p.full_name}`
                        }
                        className="inline-flex rounded p-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {loading ? (
                <tr>
                  <td
                    colSpan={colCount}
                    className="px-4 py-3 text-sm text-slate-600"
                  >
                    Loading…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      <ProspectContactEditModal
        prospect={editModalProspect}
        saving={
          editModalProspect
            ? savingFieldById[editModalProspect.id] === "contact"
            : false
        }
        onClose={() => setEditModalProspect(null)}
        onSave={async (patch) => {
          if (!editModalProspect || !onUpdateProspect) return;
          setSavingFieldById((prev) => ({
            ...prev,
            [editModalProspect.id]: "contact",
          }));
          try {
            await onUpdateProspect(editModalProspect, patch);
          } finally {
            setSavingFieldById((prev) => ({
              ...prev,
              [editModalProspect.id]: null,
            }));
          }
        }}
      />
    </div>
  );
}
