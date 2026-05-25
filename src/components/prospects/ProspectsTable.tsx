"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  ExternalLink,
  GripVertical,
  Loader2,
  ListTodo,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";
import { TableToolbarAddButton } from "@/components/table/TableToolbarAddButton";
import { TableCsvExportButton, type CsvExportScope } from "@/components/table/TableCsvExportButton";
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
import { ProspectEmptyValue } from "@/components/prospects/ProspectEmptyValue";
import { ProspectStatusCell } from "@/components/prospects/ProspectStatusCell";
import { formatProspectLabel, formatProspectPersonName } from "@/lib/prospectDisplayFormat";
import { PROSPECT_STATUS_OPTIONS } from "@/lib/prospectStatus";
import type { ProspectFieldPatch } from "@/lib/prospects/updateProspectFields";
import { formatPhoneDisplay, phoneToTelHref } from "@/lib/formatPhoneDisplay";
import { getProspectCrmContactUrl } from "@/lib/ghlContactWebhook";
import { paginationItems } from "@/lib/communityPagination";

export type { ProspectRow };

type AssessmentFilter = "all" | "assessed" | "not_assessed";
type NextCallFilter = "all" | "has_call" | "no_call";
type NextCallStatusFilter = "all" | "booked" | "confirmed" | "other";
type ProspectStatusFilter = "all" | import("@/lib/prospectStatus").ProspectStatusValue;
type ProspectSortField =
  | "name"
  | "created_at"
  | "last_assessed"
  | "last_score"
  | "next_call";
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
  | "created_at"
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
  onDelete?: (
    row: ProspectRow,
    options?: { skipConfirm?: boolean }
  ) => void | Promise<void>;
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
  /** Height of sticky page header above this table (e.g. StickyPageHeader). */
  stickyTopOffset?: number;
};

const PROSPECTS_TABLE_SETTINGS_STORAGE_KEY = "prospects-table-settings-v5";
const PROSPECTS_PAGE_SIZE = 50;
const TABLE_SECTION_PADDING = "px-5 sm:px-6";
const TABLE_CHECKBOX_PADDING = "pl-5 pr-2 sm:pl-6";
const TABLE_CELL_Y = "py-2";
const TABLE_CELL_X = "px-4";
const TABLE_COACH_CELL = "whitespace-nowrap";
const TABLE_NEXT_ACTION_CELL = "whitespace-nowrap";
const TABLE_STATUS_CELL = "whitespace-nowrap";
const TABLE_EMAIL_CELL = "pl-4 pr-6 min-w-0";
const TABLE_PHONE_CELL = "whitespace-nowrap";

const TABLE_CHECKBOX_COL_WIDTH = 72;
const TABLE_LEAD_COL_WIDTH = 180;
const TABLE_PHONE_COL_WIDTH = 168;
const TABLE_EMAIL_COL_WIDTH = 220;
const TABLE_EMAIL_COL_WIDTH_EXPANDED = 320;
const TABLE_CRM_COL_WIDTH = 72;

const TABLE_CRM_HEADER_RAIL = `${TABLE_CELL_Y} ${TABLE_CELL_X} shrink-0 border-l border-slate-200 bg-slate-50 whitespace-nowrap text-left`;
const TABLE_CRM_BODY_RAIL = `${TABLE_CELL_Y} ${TABLE_CELL_X} shrink-0 border-l border-slate-200`;

function getProspectColumnWidth(
  key: ProspectColumnKey,
  emailExpanded = false
): number {
  switch (key) {
    case "phone":
      return TABLE_PHONE_COL_WIDTH;
    case "email":
      return emailExpanded
        ? TABLE_EMAIL_COL_WIDTH_EXPANDED
        : TABLE_EMAIL_COL_WIDTH;
    case "status":
      return 112;
    case "coach":
      return 176;
    case "next_action":
      return 256;
    case "next_call":
      return 240;
    case "last_score":
      return 88;
    case "last_assessed":
    case "created_at":
      return 120;
    case "type":
      return 96;
    case "business":
      return 160;
    case "actions":
      return 120;
    default:
      return 140;
  }
}

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
  { key: "created_at", label: "Date created" },
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
  created_at: true,
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
    return <ProspectEmptyValue />;
  }

  const when = formatProspectNextCallWhen(next);
  if (!when) {
    return <ProspectEmptyValue />;
  }

  const callName = getProspectNextCallName(next);
  const statusLabel = getProspectNextCallStatusLabel(next.status_normalized);

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span
        className={`inline-flex w-fit shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none ${nextCallStatusClass(next.status_normalized)}`}
      >
        {statusLabel}
      </span>
      <span className="font-medium text-slate-800" title={callName}>
        {callName}
      </span>
      <span className="text-sm text-slate-500">{when}</span>
    </div>
  );
}

function ProspectCrmLinkCell({ row }: { row: ProspectRow }) {
  const url = getProspectCrmContactUrl(row);
  if (!url) {
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center text-slate-300"
        title="Not linked to CRM yet"
      >
        <ExternalLink className="h-4 w-4" aria-hidden />
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      data-row-action
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sky-600 hover:bg-sky-50 hover:text-sky-800"
      title="Open in CRM"
      aria-label={`Open ${row.full_name} in CRM`}
    >
      <ExternalLink className="h-4 w-4" aria-hidden />
    </a>
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
  stickyTopOffset = 0,
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [emailColumnExpanded, setEmailColumnExpanded] = useState(false);
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
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkNextActionOpen, setBulkNextActionOpen] = useState(false);
  const [bulkNextActionText, setBulkNextActionText] = useState("");
  const [bulkNextActionDue, setBulkNextActionDue] = useState("");
  const [bulkNextActionSaving, setBulkNextActionSaving] = useState(false);
  const [bulkNextActionError, setBulkNextActionError] = useState<string | null>(
    null
  );
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [rowDeleteError, setRowDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProspectRow[] | null>(
    null
  );

  const filtersMenuRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
  const selectAllHeaderRef = useRef<HTMLInputElement | null>(null);
  const bulkNextActionRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const lastSelectionAnchorIdRef = useRef<string | null>(null);
  const selectionShiftKeyRef = useRef(false);
  const [tableScrollLeft, setTableScrollLeft] = useState(0);

  const coachFilter = controlledCoachFilter ?? internalCoachFilter;
  const setCoachFilter = onCoachFilterChange ?? setInternalCoachFilter;

  const showCoachFilter = Boolean(
    coachFilterOptions && coachFilterOptions.length > 0
  );

  useEffect(() => {
    if (!filtersMenuOpen && !sortMenuOpen && !columnsMenuOpen && !bulkNextActionOpen) {
      return;
    }
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (filtersMenuRef.current?.contains(target)) return;
      if (sortMenuRef.current?.contains(target)) return;
      if (columnsMenuRef.current?.contains(target)) return;
      if (bulkNextActionRef.current?.contains(target)) return;
      setFiltersMenuOpen(false);
      setSortMenuOpen(false);
      setColumnsMenuOpen(false);
      setBulkNextActionOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [filtersMenuOpen, sortMenuOpen, columnsMenuOpen, bulkNextActionOpen]);

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

      if (sortField === "created_at") {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : null;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : null;
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

  const totalPages = Math.max(
    1,
    Math.ceil(sortedProspects.length / PROSPECTS_PAGE_SIZE)
  );

  const paginatedProspects = useMemo(() => {
    const start = (page - 1) * PROSPECTS_PAGE_SIZE;
    return sortedProspects.slice(start, start + PROSPECTS_PAGE_SIZE);
  }, [sortedProspects, page]);

  const pageNumbers = useMemo(
    () => paginationItems(page, totalPages),
    [page, totalPages]
  );

  const paginationRangeLabel =
    sortedProspects.length === 0
      ? "0 prospects"
      : `${(page - 1) * PROSPECTS_PAGE_SIZE + 1}-${Math.min(
          page * PROSPECTS_PAGE_SIZE,
          sortedProspects.length
        )} of ${sortedProspects.length}`;

  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    assessmentFilter,
    nextCallFilter,
    nextCallStatusFilter,
    statusFilter,
    coachFilter,
    sortField,
    sortOrder,
  ]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const prospectIdSet = useMemo(
    () => new Set(prospects.map((p) => p.id)),
    [prospects]
  );

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = prev.filter((id) => prospectIdSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [prospectIdSet]);

  const pageIds = useMemo(
    () => paginatedProspects.map((p) => p.id),
    [paginatedProspects]
  );

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedOnPageCount = useMemo(
    () => pageIds.filter((id) => selectedIdSet.has(id)).length,
    [pageIds, selectedIdSet]
  );

  const allPageSelected =
    pageIds.length > 0 && selectedOnPageCount === pageIds.length;
  const somePageSelected =
    selectedOnPageCount > 0 && selectedOnPageCount < pageIds.length;

  const selectedProspects = useMemo(() => {
    const byId = new Map(prospects.map((p) => [p.id, p]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((row): row is ProspectRow => Boolean(row));
  }, [prospects, selectedIds]);

  const selectedCount = selectedProspects.length;
  const allMatchingSelected =
    sortedProspects.length > 0 && selectedCount === sortedProspects.length;

  useEffect(() => {
    const input = selectAllHeaderRef.current;
    if (input) {
      input.indeterminate = somePageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  useEffect(() => {
    if (selectedCount === 0) {
      setBulkNextActionOpen(false);
    }
  }, [selectedCount]);

  function handleProspectSelectionClick(id: string, shiftKey: boolean) {
    const orderedIds = sortedProspects.map((p) => p.id);

    if (shiftKey && lastSelectionAnchorIdRef.current) {
      const anchorIdx = orderedIds.indexOf(lastSelectionAnchorIdRef.current);
      const currentIdx = orderedIds.indexOf(id);
      if (anchorIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(anchorIdx, currentIdx);
        const end = Math.max(anchorIdx, currentIdx);
        const rangeIds = orderedIds.slice(start, end + 1);
        setSelectedIds((prev) => [...new Set([...prev, ...rangeIds])]);
        lastSelectionAnchorIdRef.current = id;
        return;
      }
    }

    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    lastSelectionAnchorIdRef.current = id;
  }

  function togglePageSelection() {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
  }

  function selectAllMatchingProspects() {
    setSelectedIds(sortedProspects.map((p) => p.id));
  }

  function clearSelection() {
    setSelectedIds([]);
    lastSelectionAnchorIdRef.current = null;
  }

  function requestBulkDelete() {
    if (selectedIds.length === 0) return;

    const rowsToDelete = selectedProspects;
    if (rowsToDelete.length === 0) {
      setBulkDeleteError("Unable to delete the selected prospects.");
      return;
    }

    setRowDeleteError(null);
    setBulkDeleteError(null);
    setPendingDelete(rowsToDelete);
  }

  async function executePendingDelete() {
    if (!onDelete || !pendingDelete?.length) return;

    const rowsToDelete = pendingDelete;
    setPendingDelete(null);
    setBulkDeleteError(null);
    setRowDeleteError(null);
    setBulkDeleting(true);

    const deletedIds: string[] = [];
    let lastError: string | null = null;

    try {
      for (const row of rowsToDelete) {
        try {
          await onDelete(row, { skipConfirm: true });
          deletedIds.push(row.id);
        } catch (err: unknown) {
          lastError =
            err instanceof Error ? err.message : "Unable to delete prospect.";
          break;
        }
      }

      if (deletedIds.length > 0) {
        setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
        if (deletedIds.length === rowsToDelete.length) {
          lastSelectionAnchorIdRef.current = null;
        }
      }

      if (lastError) {
        if (rowsToDelete.length === 1) {
          setRowDeleteError(lastError);
        } else {
          setBulkDeleteError(lastError);
        }
      }
    } finally {
      setBulkDeleting(false);
    }
  }

  function openBulkNextAction() {
    setBulkNextActionError(null);
    setBulkNextActionOpen((open) => !open);
  }

  async function handleBulkNextAction(e: React.FormEvent) {
    e.preventDefault();
    if (!onUpdateProspect || selectedProspects.length === 0 || bulkNextActionSaving) {
      return;
    }

    const text = bulkNextActionText.trim();
    if (!text) {
      setBulkNextActionError("Enter a next action.");
      return;
    }

    const due_at = bulkNextActionDue.trim() || null;
    setBulkNextActionError(null);
    setBulkNextActionSaving(true);
    try {
      for (const row of selectedProspects) {
        await onUpdateProspect(row, { next_action: { text, due_at } });
      }
      setBulkNextActionOpen(false);
      setBulkNextActionText("");
      setBulkNextActionDue("");
    } catch (err: unknown) {
      setBulkNextActionError(
        err instanceof Error ? err.message : "Unable to update next actions."
      );
    } finally {
      setBulkNextActionSaving(false);
    }
  }

  const scrollableColCount = 2 + visibleColumns.length;
  const colCount = scrollableColCount;

  const scrollableTableMinWidth = useMemo(
    () =>
      TABLE_CHECKBOX_COL_WIDTH +
      TABLE_LEAD_COL_WIDTH +
      visibleColumns.reduce(
        (sum, column) =>
          sum + getProspectColumnWidth(column.key, emailColumnExpanded),
        0
      ),
    [visibleColumns, emailColumnExpanded]
  );

  const tableMinWidth = scrollableTableMinWidth;

  function renderTableColGroup() {
    return (
      <colgroup>
        <col style={{ width: TABLE_CHECKBOX_COL_WIDTH }} />
        <col style={{ width: TABLE_LEAD_COL_WIDTH }} />
        {visibleColumns.map((column) => (
          <col
            key={column.key}
            style={{
              width: getProspectColumnWidth(column.key, emailColumnExpanded),
            }}
          />
        ))}
      </colgroup>
    );
  }

  const prospectsTableClassName =
    "w-full table-fixed border-separate border-spacing-0 text-left text-base";
  const prospectsTableStyle = { minWidth: tableMinWidth };

  useEffect(() => {
    setTableScrollLeft(0);
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollLeft = 0;
    }
  }, [visibleColumns, tableMinWidth]);

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
    if (sortField === "created_at") {
      return [
        { value: "desc" as const, label: "Newest first" },
        { value: "asc" as const, label: "Oldest first" },
        { value: "missing_first" as const, label: "Missing date first" },
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
    { truncate = true }: { truncate?: boolean } = {}
  ) {
    const trimmed = value?.trim();
    const textClass = truncate
      ? "block min-w-0 truncate text-sm text-slate-700"
      : "block min-w-0 break-all text-sm text-slate-700";
    const buttonClass = truncate
      ? "block w-full min-w-0 truncate text-left text-sm text-slate-700 hover:text-sky-700"
      : "block w-full min-w-0 break-all text-left text-sm text-slate-700 hover:text-sky-700";
    if (!trimmed) {
      if (!editable || !onUpdateProspect) {
        return <ProspectEmptyValue />;
      }
      return (
        <button
          type="button"
          data-row-action
          onClick={(e) => {
            e.stopPropagation();
            openContactEdit(prospect);
          }}
          className="text-left hover:text-sky-700"
          title="Edit contact details"
        >
          <ProspectEmptyValue />
        </button>
      );
    }

    if (!editable || !onUpdateProspect) {
      return <span className={textClass}>{trimmed}</span>;
    }
    return (
      <button
        type="button"
        data-row-action
        onClick={(e) => {
          e.stopPropagation();
          openContactEdit(prospect);
        }}
        className={buttonClass}
        title="Edit contact details"
      >
        {trimmed}
      </button>
    );
  }

  function renderPhoneCell(prospect: ProspectRow) {
    const raw = prospect.phone?.trim();
    if (!raw) {
      if (editable && onUpdateProspect) {
        return (
          <button
            type="button"
            data-row-action
            onClick={(e) => {
              e.stopPropagation();
              openContactEdit(prospect);
            }}
            className="text-left hover:text-sky-700"
            title="Edit contact details"
          >
            <ProspectEmptyValue />
          </button>
        );
      }
      return <ProspectEmptyValue />;
    }

    const formatted = formatPhoneDisplay(raw) ?? raw;
    const telHref = phoneToTelHref(raw);
    if (!telHref) {
      return <span className="text-sm text-slate-700">{formatted}</span>;
    }

    return (
      <a
        href={telHref}
        data-row-action
        onClick={(e) => e.stopPropagation()}
        className="block min-w-0 truncate text-sm text-sky-600 hover:text-sky-800 hover:underline"
        title={`Call ${formatted}`}
      >
        {formatted}
      </a>
    );
  }

  function renderOptionalText(value: string | null | undefined) {
    return value ? (
      <span className="text-sm text-slate-700">{value}</span>
    ) : (
      <ProspectEmptyValue />
    );
  }

  function renderColumnCell(key: ProspectColumnKey, p: ProspectRow) {
    switch (key) {
      case "business":
        return renderEditableContactValue(
          p,
          formatProspectLabel(p.business_name)
        );
      case "email":
        return emailColumnExpanded ? (
          renderEditableContactValue(p, p.email, { truncate: false })
        ) : (
          <div className="min-w-0 truncate" title={p.email ?? undefined}>
            {renderEditableContactValue(p, p.email)}
          </div>
        );
      case "phone":
        return renderPhoneCell(p);
      case "type":
        return <span className="text-sm text-slate-700">{p.type}</span>;
      case "coach":
        return (
          <span className="block text-sm text-slate-700 whitespace-nowrap">
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
        return p.last_score != null ? (
          `${p.last_score}`
        ) : (
          <ProspectEmptyValue />
        );
      case "last_assessed":
        return p.last_completed_at ? (
          <span className="text-sm text-slate-500">
            {formatProspectLastAssessed(p.last_completed_at)}
          </span>
        ) : (
          <ProspectEmptyValue />
        );
      case "created_at":
        return p.created_at ? (
          <span className="whitespace-nowrap text-sm text-slate-500">
            {formatProspectLastAssessed(p.created_at)}
          </span>
        ) : (
          <ProspectEmptyValue />
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
      case "email":
        return (
          <span className="inline-flex items-center gap-1 normal-case tracking-normal">
            <span>Email</span>
            <button
              type="button"
              data-row-action
              onClick={(e) => {
                e.stopPropagation();
                setEmailColumnExpanded((expanded) => !expanded);
              }}
              className="inline-flex rounded p-0.5 text-slate-400 hover:bg-slate-200/80 hover:text-slate-600"
              title={
                emailColumnExpanded
                  ? "Collapse email column"
                  : "Expand email column"
              }
              aria-label={
                emailColumnExpanded
                  ? "Collapse email column"
                  : "Expand email column"
              }
              aria-pressed={emailColumnExpanded}
            >
              {emailColumnExpanded ? (
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
          </span>
        );
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

  function handleExportCsv(mode: "shown" | "all", scope: CsvExportScope) {
    const rows =
      scope === "selected" && selectedCount > 0
        ? selectedProspects
        : sortedProspects;
    exportProspectsToCsv(rows, buildExportInput(mode));
  }

  function renderColumnHeaderCellClass(key: ProspectColumnKey): string {
    const base = `${TABLE_CELL_Y} text-left`;
    if (key === "email") {
      return `${base} ${TABLE_EMAIL_CELL}`;
    }
    if (key === "phone") {
      return `${base} ${TABLE_CELL_X} ${TABLE_PHONE_CELL}`;
    }
    if (key === "coach") {
      return `${base} ${TABLE_CELL_X} ${TABLE_COACH_CELL}`;
    }
    if (key === "next_action") {
      return `${base} ${TABLE_CELL_X} ${TABLE_NEXT_ACTION_CELL}`;
    }
    if (key === "status") {
      return `${base} ${TABLE_CELL_X} ${TABLE_STATUS_CELL}`;
    }
    return `${base} ${TABLE_CELL_X}`;
  }

  function renderColumnBodyCellClass(key: ProspectColumnKey): string {
    const base = `${TABLE_CELL_Y} text-slate-700`;
    if (key === "email") {
      return `${base} ${TABLE_EMAIL_CELL}`;
    }
    if (key === "phone") {
      return `${base} ${TABLE_CELL_X} ${TABLE_PHONE_CELL}`;
    }
    if (key === "coach") {
      return `${base} ${TABLE_CELL_X} ${TABLE_COACH_CELL}`;
    }
    if (key === "next_action") {
      return `${base} ${TABLE_CELL_X} ${TABLE_NEXT_ACTION_CELL}`;
    }
    if (key === "status") {
      return `${base} ${TABLE_CELL_X} ${TABLE_STATUS_CELL}`;
    }
    return `${base} ${TABLE_CELL_X}`;
  }

  const showProspectsTable =
    loading || sortedProspects.length > 0 || Boolean(error);

  function renderProspectsTableHead() {
    return (
      <thead className="border-b border-slate-200 bg-slate-50 text-sm uppercase tracking-wide text-slate-500">
        <tr>
          <th
            className={`${TABLE_CELL_Y} text-center ${TABLE_CHECKBOX_PADDING}`}
          >
            <input
              ref={selectAllHeaderRef}
              type="checkbox"
              checked={allPageSelected}
              onChange={togglePageSelection}
              disabled={paginatedProspects.length === 0}
              aria-label="Select all prospects on this page"
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
            />
          </th>
          <th
            className={`${TABLE_CELL_X} ${TABLE_CELL_Y} text-left`}
          >
            Lead
          </th>
          {visibleColumns.map((column) => (
            <th
              key={column.key}
              className={renderColumnHeaderCellClass(column.key)}
            >
              {renderColumnHeader(column.key)}
            </th>
          ))}
        </tr>
      </thead>
    );
  }

  function renderProspectCrmRailRow(
    p: ProspectRow,
    options: { isSelected: boolean }
  ) {
    const { isSelected } = options;
    return (
      <div
        key={p.id}
        className={`${TABLE_CRM_BODY_RAIL} flex items-center border-t border-slate-100 hover:bg-slate-50${
          isSelected ? " bg-sky-50/70" : " bg-white"
        }`}
        style={{ width: TABLE_CRM_COL_WIDTH, minHeight: "2.75rem" }}
        data-row-action
        onClick={(e) => e.stopPropagation()}
      >
        <ProspectCrmLinkCell row={p} />
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        className="sticky z-20 bg-white shadow-sm"
        style={{ top: stickyTopOffset }}
      >
      <div className={`border-b border-slate-100 py-3 ${TABLE_SECTION_PADDING}`}>
        {(rowDeleteError || (error && !loading)) ? (
          <p className="mb-2 text-sm text-rose-600">
            {rowDeleteError ?? error}
          </p>
        ) : null}
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
                      <option value="created_at">Date created</option>
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
            selectedCount={selectedCount}
            totalMatchingCount={sortedProspects.length}
            onExportShown={(scope) => handleExportCsv("shown", scope)}
            onExportAll={(scope) => handleExportCsv("all", scope)}
          />

          {!loading && prospects.length > 0 ? (
            <span className="ml-auto text-xs text-slate-500">
              {selectedCount > 0
                ? `${selectedCount} selected`
                : sortedProspects.length === prospects.length
                  ? `${prospects.length} prospect${prospects.length === 1 ? "" : "s"}`
                  : `${sortedProspects.length} of ${prospects.length}`}
            </span>
          ) : null}
        </div>
      </div>

      {selectedCount > 0 ? (
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-sky-100 bg-sky-50 py-2 text-sm ${TABLE_SECTION_PADDING}`}>
          <span className="font-medium text-sky-900">
            {selectedCount} selected
          </span>
          {bulkDeleteError ? (
            <span className="text-rose-600">{bulkDeleteError}</span>
          ) : null}
          {allPageSelected && !allMatchingSelected ? (
            <button
              type="button"
              onClick={selectAllMatchingProspects}
              className="font-medium text-sky-700 hover:text-sky-900"
            >
              Select all {sortedProspects.length} matching prospects
            </button>
          ) : null}
          <button
            type="button"
            onClick={clearSelection}
            className="text-slate-600 hover:text-slate-900"
          >
            Clear selection
          </button>
          {editable && onUpdateProspect ? (
            <div ref={bulkNextActionRef} className="relative">
              <button
                type="button"
                onClick={openBulkNextAction}
                className="inline-flex items-center gap-1.5 font-medium text-sky-700 hover:text-sky-900"
              >
                <ListTodo className="h-4 w-4" aria-hidden />
                Set next action
              </button>
              {bulkNextActionOpen ? (
                <form
                  onSubmit={(e) => void handleBulkNextAction(e)}
                  className="absolute left-0 top-full z-[90] mt-1 w-[min(92vw,18rem)] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
                >
                  <p className="mb-2 text-xs font-medium text-slate-600">
                    Apply to {selectedCount} prospect
                    {selectedCount === 1 ? "" : "s"}
                  </p>
                  <label className="mb-2 block">
                    <span className="mb-1 block text-xs text-slate-500">
                      Next action
                    </span>
                    <input
                      type="text"
                      value={bulkNextActionText}
                      onChange={(e) => {
                        setBulkNextActionText(e.target.value);
                        setBulkNextActionError(null);
                      }}
                      placeholder="e.g. Follow up on assessment"
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                      autoFocus
                    />
                  </label>
                  <label className="mb-3 block">
                    <span className="mb-1 block text-xs text-slate-500">
                      Due date (optional)
                    </span>
                    <input
                      type="date"
                      value={bulkNextActionDue}
                      onChange={(e) => setBulkNextActionDue(e.target.value)}
                      className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                  </label>
                  {bulkNextActionError ? (
                    <p className="mb-2 text-xs text-rose-600">
                      {bulkNextActionError}
                    </p>
                  ) : null}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkNextActionOpen(false)}
                      className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={bulkNextActionSaving}
                      className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {bulkNextActionSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : null}
                      Apply
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={requestBulkDelete}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-1.5 font-medium text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
              Delete selected
            </button>
          ) : null}
        </div>
      ) : null}
      {showProspectsTable ? (
        <div className="flex border-b border-slate-200 bg-slate-50">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div style={{ transform: `translateX(-${tableScrollLeft}px)` }}>
              <table
                className={prospectsTableClassName}
                style={prospectsTableStyle}
              >
                {renderTableColGroup()}
                {renderProspectsTableHead()}
              </table>
            </div>
          </div>
          <div
            className={TABLE_CRM_HEADER_RAIL}
            style={{ width: TABLE_CRM_COL_WIDTH }}
          >
            CRM
          </div>
        </div>
      ) : null}
      </div>

      <div className="flex min-w-0">
        <div
          ref={bodyScrollRef}
          className="min-w-0 flex-1 overflow-x-auto"
          onScroll={(e) => setTableScrollLeft(e.currentTarget.scrollLeft)}
        >
          {!showProspectsTable ? (
            <p className={`py-8 text-center text-sm text-slate-500 ${TABLE_SECTION_PADDING}`}>
              {emptyMessage}
            </p>
          ) : (
            <table className={prospectsTableClassName} style={prospectsTableStyle}>
              {renderTableColGroup()}
              <tbody>
              {paginatedProspects.map((p) => {
                const isSelected = selectedIdSet.has(p.id);
                return (
                <tr
                  key={p.id}
                  className={
                    onRowClick
                      ? `group cursor-pointer border-t border-slate-100 hover:bg-slate-50${isSelected ? " bg-sky-50/70" : ""}`
                      : `group border-t border-slate-100 hover:bg-slate-50${isSelected ? " bg-sky-50/70" : ""}`
                  }
                  onClick={
                    onRowClick
                      ? (e) => {
                          if (
                            (e.target as HTMLElement).closest(
                              "[data-row-action], button, a, input, select, textarea, label"
                            )
                          ) {
                            return;
                          }
                          onRowClick(p.id);
                        }
                      : undefined
                  }
                >
                  <td
                    className={`${TABLE_CELL_Y} text-center align-middle ${TABLE_CHECKBOX_PADDING}`}
                    data-row-action
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        selectionShiftKeyRef.current = e.shiftKey;
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectionShiftKeyRef.current = e.shiftKey;
                      }}
                      onChange={(e) => {
                        e.stopPropagation();
                        setBulkDeleteError(null);
                        const shiftKey =
                          "shiftKey" in e.nativeEvent
                            ? Boolean((e.nativeEvent as MouseEvent).shiftKey)
                            : selectionShiftKeyRef.current;
                        handleProspectSelectionClick(p.id, shiftKey);
                      }}
                      aria-label={`Select ${p.full_name}`}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                  </td>
                  <td className={`${TABLE_CELL_X} ${TABLE_CELL_Y} font-medium text-slate-900`}>
                    <div className="min-w-0">
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
                      className={renderColumnBodyCellClass(column.key)}
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
                </tr>
              );
              })}
              {loading ? (
                <tr>
                  <td
                    colSpan={colCount}
                    className={`${TABLE_CELL_X} ${TABLE_CELL_Y} text-sm text-slate-600`}
                  >
                    Loading…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          )}
        </div>
        {showProspectsTable ? (
          <div
            className="shrink-0 bg-white"
            style={{ width: TABLE_CRM_COL_WIDTH }}
          >
            {paginatedProspects.map((p) =>
              renderProspectCrmRailRow(p, {
                isSelected: selectedIdSet.has(p.id),
              })
            )}
            {loading ? (
              <div
                className={`${TABLE_CRM_BODY_RAIL} border-t border-slate-100 bg-white text-sm text-slate-600`}
                style={{ width: TABLE_CRM_COL_WIDTH, minHeight: "2.75rem" }}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {!loading && sortedProspects.length > PROSPECTS_PAGE_SIZE ? (
        <nav
          className={`flex flex-col gap-3 border-t border-slate-100 py-3 sm:flex-row sm:items-center sm:justify-between ${TABLE_SECTION_PADDING}`}
          aria-label="Prospects pagination"
        >
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-0.5 rounded-md px-1 py-1 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              Previous
            </button>
            <div className="flex flex-wrap items-center gap-1 pl-1">
              {pageNumbers.map((item, idx) =>
                item === "ellipsis" ? (
                  <span
                    key={`e-${idx}`}
                    className="px-1.5 text-sm text-slate-500"
                    aria-hidden
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-medium ${
                      item === page
                        ? "bg-sky-100 text-sky-800"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    aria-current={item === page ? "page" : undefined}
                  >
                    {item}
                  </button>
                )
              )}
            </div>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-0.5 rounded-md px-1 py-1 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
            </button>
          </div>
          <p className="text-sm text-slate-500 sm:text-right">
            {paginationRangeLabel}
          </p>
        </nav>
      ) : null}

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

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4"
          role="presentation"
          onClick={() => setPendingDelete(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="prospect-delete-dialog-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="prospect-delete-dialog-title"
              className="text-lg font-semibold text-slate-900"
            >
              Delete prospect{pendingDelete.length === 1 ? "" : "s"}?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {pendingDelete.length === 1 ? (
                <>
                  Delete <span className="font-medium">{pendingDelete[0].full_name}</span>? This
                  cannot be undone.
                </>
              ) : (
                <>
                  Delete {pendingDelete.length} selected prospects? This cannot be undone.
                </>
              )}
            </p>
            {pendingDelete.length > 1 ? (
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm text-slate-500">
                {pendingDelete.map((row) => (
                  <li key={row.id}>
                    {row.full_name}
                    {row.email ? ` · ${row.email}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void executePendingDelete()}
                disabled={bulkDeleting}
                className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
