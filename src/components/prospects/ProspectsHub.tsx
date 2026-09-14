"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { CoachesSaveViewButton } from "@/components/admin/CoachesSaveViewButton";
import { DataTableColumnsMenu } from "@/components/table/DataTableColumnsMenu";
import { ImportProspectsModal } from "@/components/prospects/ImportProspectsModal";
import { PipelineCustomizePanel } from "@/components/prospects/PipelineCustomizePanel";
import { ProspectsPipelineBoard } from "@/components/prospects/ProspectsPipelineBoard";
import {
  ProspectsPipelineToolbar,
  type ProspectsToolbarMenu,
} from "@/components/prospects/ProspectsPipelineToolbar";
import { ProspectsTable } from "@/components/prospects/ProspectsTable";
import { ProspectsTableViewBar } from "@/components/prospects/ProspectsTableViewBar";
import { ProspectsViewSwitcher } from "@/components/prospects/ProspectsViewSwitcher";
import {
  moveKeyInOrder,
  partitionOrderedColumns,
} from "@/hooks/usePersistedColumnSettings";
import { useProspectsView } from "@/hooks/useProspectsView";
import { useProspectTableViews } from "@/hooks/useProspectTableViews";
import type { CsvExportScope } from "@/components/table/TableCsvExportButton";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { exportProspectsToCsv } from "@/lib/exportProspectsCsv";
import {
  defaultProspectGrouping,
  groupProspectRows,
  PROSPECT_GROUP_FIELDS,
  type ProspectGroupField,
  type ProspectGroupOrder,
  type PersistedProspectGrouping,
} from "@/lib/prospects/prospectGrouping";
import {
  CARD_FIELD_OPTIONS,
  defaultPipelineLayout,
  loadPipelineLayout,
  savePipelineLayout,
  setCardField,
  type PipelineLayout,
} from "@/lib/pipelineLayout";
import type { ProspectFieldPatch } from "@/lib/prospects/updateProspectFields";
import type { ProspectNextCall } from "@/lib/prospectNextCall";
import {
  DEFAULT_PROSPECT_COLUMN_ORDER,
  DEFAULT_PROSPECT_COLUMN_VISIBILITY,
  PROSPECTS_TABLE_COLUMN_OPTIONS,
  type ProspectColumnKey,
  type ProspectColumnVisibility,
} from "@/lib/prospects/prospectTableColumns";
import {
  isDefaultProspectTableViewName,
  normalizeProspectTableViewSettings,
  type ProspectListSortField,
  type ProspectListSortOrder,
  type ProspectTableViewSettings,
  type ProspectTableViewSurface,
} from "@/lib/prospects/prospectTableViews";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  DEFAULT_PROSPECT_TAGS,
  mergeProspectTagCatalog,
  sortProspectTagCatalog,
} from "@/lib/prospects/tagAppearance";
import {
  humanizeProspectStatus,
  PROSPECT_STATUS_OPTIONS,
} from "@/lib/prospectStatus";
import type { ProspectRow } from "@/lib/prospectRow";

type CoachFilterOption = {
  id: string;
  label: string;
};

type Props = {
  prospects: ProspectRow[];
  loading: boolean;
  error: string | null;
  surface?: ProspectTableViewSurface;
  stickyTopOffset?: number;
  showCoachColumn?: boolean;
  coachFilterOptions?: CoachFilterOption[];
  onAddClick: () => void;
  addActive?: boolean;
  onProspectClick: (row: ProspectRow) => void;
  onUpdateProspect: (
    row: ProspectRow,
    patch: ProspectFieldPatch
  ) => Promise<void>;
  onProspectBooked?: (row: ProspectRow, nextCall: ProspectNextCall) => void;
  onDelete: (
    row: ProspectRow,
    options?: { skipConfirm?: boolean }
  ) => void | Promise<void>;
  deletingId?: string | null;
  coachSlug?: string | null;
  coachSlugByCoachId?: Record<string, string>;
  onVisibleIdsChange?: (ids: string[]) => void;
  scoresEnriching?: boolean;
  emptyMessage?: string;
  importUrl: string;
  importRequiresCoach?: boolean;
  onImportedProspects: (rows: ProspectRow[]) => void;
};

function compareProspects(
  a: ProspectRow,
  b: ProspectRow,
  field: ProspectListSortField,
  order: ProspectListSortOrder
): number {
  const dir = order === "asc" ? 1 : -1;
  const text = (value: string | null | undefined) =>
    value?.trim().toLowerCase() ?? "";
  const time = (value: string | null | undefined) => {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  let result = 0;
  switch (field) {
    case "company":
      result = text(a.business_name).localeCompare(text(b.business_name));
      break;
    case "created_at":
      result = time(a.created_at) - time(b.created_at);
      break;
    case "last_assessed":
      result = time(a.last_assessed_at) - time(b.last_assessed_at);
      break;
    case "boss_score":
      result =
        (a.boss_score_premium ?? a.boss_score ?? 0) -
        (b.boss_score_premium ?? a.boss_score ?? 0);
      break;
    case "next_call":
      result = time(a.next_call?.start_time) - time(b.next_call?.start_time);
      break;
    default:
      result = a.full_name.localeCompare(b.full_name, undefined, {
        sensitivity: "base",
      });
  }
  return result * dir;
}

const DROPDOWN =
  "absolute left-0 z-[90] mt-1 w-56 rounded-md border border-slate-200 bg-white p-3 shadow-lg";

export function ProspectsHub({
  prospects,
  loading,
  error,
  surface = "coach",
  stickyTopOffset = 0,
  showCoachColumn = false,
  coachFilterOptions,
  onAddClick,
  addActive = false,
  onProspectClick,
  onUpdateProspect,
  onProspectBooked,
  onDelete,
  deletingId,
  coachSlug,
  coachSlugByCoachId,
  onVisibleIdsChange,
  scoresEnriching,
  emptyMessage,
  importUrl,
  importRequiresCoach = false,
  onImportedProspects,
}: Props) {
  const { view, setView } = useProspectsView();
  const [query, setQuery] = useState("");
  const [coachFilter, setCoachFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [assessedFilter, setAssessedFilter] = useState<
    "all" | "assessed" | "not_assessed"
  >("all");
  const [callFilter, setCallFilter] = useState<"all" | "has_call" | "no_call">(
    "all"
  );
  const [sortField, setSortField] = useState<ProspectListSortField>("name");
  const [sortOrder, setSortOrder] = useState<ProspectListSortOrder>("asc");
  const [menu, setMenu] = useState<ProspectsToolbarMenu>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [layout, setLayout] = useState<PipelineLayout>(defaultPipelineLayout);
  const [grouping, setGrouping] = useState<PersistedProspectGrouping>(
    defaultProspectGrouping()
  );
  const [columnVisibility, setColumnVisibility] =
    useState<ProspectColumnVisibility>(DEFAULT_PROSPECT_COLUMN_VISIBILITY);
  const [columnOrder, setColumnOrder] = useState<ProspectColumnKey[]>([
    ...DEFAULT_PROSPECT_COLUMN_ORDER,
  ]);
  const [draggingColumnKey, setDraggingColumnKey] =
    useState<ProspectColumnKey | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLayout(loadPipelineLayout());
  }, []);

  useEffect(() => {
    if (!menu) return;
    function handlePointerDown(e: MouseEvent) {
      if (toolbarRef.current?.contains(e.target as Node)) return;
      setMenu(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menu]);

  function updateLayout(next: PipelineLayout) {
    setLayout(next);
    savePipelineLayout(next);
  }

  function updateGrouping(next: PersistedProspectGrouping) {
    setGrouping(next);
  }

  const setColumnVisible = useCallback(
    (key: ProspectColumnKey, visible: boolean) => {
      setColumnVisibility((prev) => ({ ...prev, [key]: visible }));
    },
    []
  );

  const moveColumnInOrder = useCallback(
    (draggedKey: ProspectColumnKey, targetKey: ProspectColumnKey) => {
      setColumnOrder((prev) => moveKeyInOrder(prev, draggedKey, targetKey));
    },
    []
  );

  const getAuthHeaders = useCallback(async () => {
    if (surface === "admin") {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) return null;
      return {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      };
    }
    return getCoachAuthHeaders();
  }, [surface]);

  const applyViewSettings = useCallback((settings: ProspectTableViewSettings) => {
    const next = normalizeProspectTableViewSettings(settings);
    setStatusFilter(next.statusFilter);
    setTagFilter(next.tagFilter);
    setCoachFilter(next.coachFilter);
    setAssessedFilter(next.assessedFilter);
    setCallFilter(next.callFilter);
    setSortField(next.sortField);
    setSortOrder(next.sortOrder);
    setGrouping(next.grouping);
    setColumnVisibility(next.columnVisibility);
    setColumnOrder(next.columnOrder);
  }, []);

  const currentViewSettings = useMemo(
    (): ProspectTableViewSettings =>
      normalizeProspectTableViewSettings({
        statusFilter,
        tagFilter,
        coachFilter,
        assessedFilter,
        callFilter,
        sortField,
        sortOrder,
        grouping,
        columnVisibility,
        columnOrder,
      }),
    [
      assessedFilter,
      callFilter,
      coachFilter,
      columnOrder,
      columnVisibility,
      grouping,
      sortField,
      sortOrder,
      statusFilter,
      tagFilter,
    ]
  );

  const tableViews = useProspectTableViews({
    surface,
    currentSettings: currentViewSettings,
    onApplySettings: applyViewSettings,
    getAuthHeaders,
    ready: true,
  });

  const groupField: ProspectGroupField | null =
    grouping.field === "coach" && !showCoachColumn ? null : grouping.field;

  const columnMenuOptions = useMemo(
    () =>
      PROSPECTS_TABLE_COLUMN_OPTIONS.filter((option) => {
        if (option.key === "coach" && !showCoachColumn) return false;
        return option.key !== "actions";
      }),
    [showCoachColumn]
  );

  const { shown: shownColumnOptions, hidden: hiddenColumnOptions } = useMemo(
    () =>
      partitionOrderedColumns(
        columnOrder,
        columnVisibility,
        columnMenuOptions
      ),
    [columnOrder, columnVisibility, columnMenuOptions]
  );

  const statusOptions = useMemo(() => {
    const seen = new Set<string>(
      PROSPECT_STATUS_OPTIONS.map((option) => option.value)
    );
    const extras = [
      ...new Set(
        prospects
          .map((row) => row.status.value)
          .filter((value): value is string => Boolean(value) && !seen.has(value))
      ),
    ].map((value) => ({ value, label: humanizeProspectStatus(value) }));
    return [...PROSPECT_STATUS_OPTIONS, ...extras];
  }, [prospects]);

  const tagOptions = useMemo(
    () =>
      sortProspectTagCatalog(
        mergeProspectTagCatalog(
          DEFAULT_PROSPECT_TAGS,
          prospects.flatMap((row) => row.tags ?? [])
        ),
        []
      ),
    [prospects]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tagKey = tagFilter.toLowerCase();
    const rows = prospects.filter((p) => {
      if (statusFilter !== "all" && p.status.value !== statusFilter) {
        return false;
      }
      if (tagFilter === "none" && (p.tags?.length ?? 0) > 0) return false;
      if (
        tagFilter !== "all" &&
        tagFilter !== "none" &&
        !(p.tags ?? []).some((tag) => tag.toLowerCase() === tagKey)
      ) {
        return false;
      }
      if (showCoachColumn && coachFilter && p.coach_id !== coachFilter) {
        return false;
      }
      if (assessedFilter === "assessed" && !p.last_assessed_at) return false;
      if (assessedFilter === "not_assessed" && p.last_assessed_at) return false;
      if (callFilter === "has_call" && !p.next_call?.start_time) return false;
      if (callFilter === "no_call" && p.next_call?.start_time) return false;
      if (!q) return true;
      const hay = [p.full_name, p.business_name, p.job_title, p.email, p.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    return rows
      .slice()
      .sort((a, b) => compareProspects(a, b, sortField, sortOrder));
  }, [
    prospects,
    statusFilter,
    tagFilter,
    showCoachColumn,
    coachFilter,
    assessedFilter,
    callFilter,
    query,
    sortField,
    sortOrder,
  ]);

  const groupSections = useMemo(() => {
    if (!groupField) return null;
    return groupProspectRows(
      filtered,
      groupField,
      grouping.order,
      grouping.manualOrder[groupField] ?? []
    );
  }, [filtered, groupField, grouping.order, grouping.manualOrder]);

  const filterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (tagFilter !== "all" ? 1 : 0) +
    (coachFilter ? 1 : 0) +
    (assessedFilter !== "all" ? 1 : 0) +
    (callFilter !== "all" ? 1 : 0);
  const sortActive = sortField !== "name" || sortOrder !== "asc";

  function handleExport(mode: "shown" | "all", _scope: CsvExportScope) {
    exportProspectsToCsv(filtered, {
      mode,
      visibleTableKeys: shownColumnOptions.map((option) => option.key),
      applicableTableKeys: columnMenuOptions.map((option) => option.key),
      columnOrder,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div
        ref={toolbarRef}
        className="sticky z-20 shrink-0 pb-3"
        style={{ top: stickyTopOffset }}
      >
        <ProspectsPipelineToolbar
            search={query}
            onSearchChange={setQuery}
            menu={menu}
            onMenuChange={setMenu}
            filterCount={filterCount}
            filterMenu={
              <div role="menu" className={DROPDOWN}>
                <label className="block text-xs font-medium text-slate-600">
                  Status
                  <select
                    className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-3 block text-xs font-medium text-slate-600">
                  Tags
                  <select
                    className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="none">No tags</option>
                    {tagOptions.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
                {showCoachColumn && (coachFilterOptions?.length ?? 0) > 0 ? (
                  <label className="mt-3 block text-xs font-medium text-slate-600">
                    Coach
                    <select
                      className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      value={coachFilter}
                      onChange={(e) => setCoachFilter(e.target.value)}
                    >
                      <option value="">All coaches</option>
                      {coachFilterOptions?.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="mt-3 block text-xs font-medium text-slate-600">
                  Assessment
                  <select
                    className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={assessedFilter}
                    onChange={(e) =>
                      setAssessedFilter(e.target.value as typeof assessedFilter)
                    }
                  >
                    <option value="all">All</option>
                    <option value="assessed">Assessed</option>
                    <option value="not_assessed">Not assessed</option>
                  </select>
                </label>
                <label className="mt-3 block text-xs font-medium text-slate-600">
                  Next call
                  <select
                    className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={callFilter}
                    onChange={(e) =>
                      setCallFilter(e.target.value as typeof callFilter)
                    }
                  >
                    <option value="all">All</option>
                    <option value="has_call">Has upcoming call</option>
                    <option value="no_call">No upcoming call</option>
                  </select>
                </label>
              </div>
            }
            sortActive={sortActive}
            sortMenu={
              <div role="menu" className={DROPDOWN}>
                <label className="block text-xs font-medium text-slate-600">
                  Sort by
                  <select
                    className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as ProspectListSortField)}
                  >
                    <option value="name">Name</option>
                    <option value="company">Company</option>
                    <option value="created_at">Date created</option>
                    <option value="last_assessed">Last assessed</option>
                    <option value="boss_score">BOSS score</option>
                    <option value="next_call">Next call</option>
                  </select>
                </label>
                <label className="mt-3 block text-xs font-medium text-slate-600">
                  Order
                  <select
                    className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as ProspectListSortOrder)}
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </label>
              </div>
            }
            groupActive={Boolean(groupField)}
            groupMenu={
              view === "list" ? (
                <div
                  role="menu"
                  className="absolute left-0 z-[90] mt-1 w-56 rounded-md border border-slate-200 bg-white py-2 shadow-lg"
                >
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Group by
                  </p>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() =>
                      updateGrouping({ ...grouping, field: null })
                    }
                  >
                    None
                    {!groupField ? (
                      <Check className="h-3.5 w-3.5 text-sky-600" aria-hidden />
                    ) : null}
                  </button>
                  {PROSPECT_GROUP_FIELDS.filter(
                    (option) => !option.coachOnly || showCoachColumn
                  ).map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() =>
                        updateGrouping({ ...grouping, field: option.key })
                      }
                    >
                      {option.label}
                      {groupField === option.key ? (
                        <Check
                          className="h-3.5 w-3.5 text-sky-600"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  ))}
                  <div className="my-2 border-t border-slate-200" />
                  <label className="block px-3 pb-1 text-xs font-medium text-slate-600">
                    Group order
                    <select
                      className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      value={grouping.order}
                      disabled={!groupField}
                      onChange={(e) =>
                        updateGrouping({
                          ...grouping,
                          order: e.target.value as ProspectGroupOrder,
                        })
                      }
                    >
                      <option value="asc">A → Z</option>
                      <option value="desc">Z → A</option>
                      <option value="manual">Manual</option>
                    </select>
                  </label>
                  {groupField ? (
                    <p className="px-3 pt-2 text-[11px] leading-snug text-slate-500">
                      Drag group headers in the list to set a manual order.
                    </p>
                  ) : null}
                </div>
              ) : undefined
            }
            fieldsLabel={view === "board" ? "Cards" : "Columns"}
            fieldsMenu={
              view === "board" ? (
                <div
                  role="menu"
                  className="absolute left-0 z-[90] mt-1 w-52 rounded-md border border-slate-200 bg-white py-2 shadow-lg"
                >
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Show on cards
                  </p>
                  {CARD_FIELD_OPTIONS.map((option) => (
                    <label
                      key={option.key}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={layout.cardFields[option.key]}
                        onChange={(e) =>
                          updateLayout(
                            setCardField(layout, option.key, e.target.checked)
                          )
                        }
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      {option.label}
                    </label>
                  ))}
                  <div className="my-2 border-t border-slate-200" />
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setMenu(null);
                      setCustomizeOpen(true);
                    }}
                  >
                    Customize pipeline
                  </button>
                </div>
              ) : (
                <DataTableColumnsMenu
                  open
                  hideTrigger
                  onToggle={() => setMenu(null)}
                  menuRef={columnsMenuRef}
                  shownOptions={shownColumnOptions}
                  hiddenOptions={hiddenColumnOptions}
                  columnVisibility={columnVisibility}
                  onVisibilityChange={setColumnVisible}
                  onMoveColumn={moveColumnInOrder}
                  draggingColumnKey={draggingColumnKey}
                  onDraggingColumnKeyChange={setDraggingColumnKey}
                  align="left"
                  label="Columns"
                />
              )
            }
            exportDisabled={loading || filtered.length === 0}
            exportMatchingCount={filtered.length}
            onExportShown={(scope) => handleExport("shown", scope)}
            onExportAll={(scope) => handleExport("all", scope)}
            onImport={() => setImportOpen(true)}
            end={
              <>
                <ProspectsViewSwitcher view={view} onChange={setView} />
                <button
                  type="button"
                  onClick={onAddClick}
                  aria-pressed={addActive}
                  className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-white transition ${
                    addActive ? "bg-sky-800" : "bg-sky-600 hover:bg-sky-700"
                  }`}
                >
                  <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  Add prospect
                </button>
              </>
            }
          />
      </div>

      {view === "board" ? (
        <ProspectsPipelineBoard
          prospects={filtered}
          loading={loading}
          layout={layout}
          onLayoutChange={updateLayout}
          onCardClick={onProspectClick}
          onUpdateProspect={onUpdateProspect}
          onProspectBooked={onProspectBooked}
        />
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-end justify-between gap-3 border-b border-slate-200 bg-white px-4 pt-3">
            <ProspectsTableViewBar
              views={tableViews.views}
              activeViewId={tableViews.activeViewId}
              onSwitchView={(viewId) => {
                void tableViews.switchView(viewId);
              }}
              onAddView={(name) => {
                void tableViews.addViewFromCurrent(name);
              }}
              onRenameView={(viewId, name) => {
                void tableViews.renameView(viewId, name);
              }}
              onDeleteView={(viewId) => {
                void tableViews.deleteView(viewId);
              }}
              onReorderViews={(orderedViewIds) => {
                void tableViews.reorderViews(orderedViewIds);
              }}
            />
            <div className="shrink-0 pb-2">
              <CoachesSaveViewButton
                isDirty={tableViews.isDirty}
                autosave={tableViews.autosave}
                canEditActiveView={tableViews.canEditActiveView}
                activeViewIsAll={Boolean(
                  tableViews.activeView &&
                    isDefaultProspectTableViewName(tableViews.activeView.name)
                )}
                canUpdateAllView={tableViews.canUpdateAllView}
                activeViewIsPrivate={false}
                error={tableViews.error}
                onSave={() => {
                  void tableViews.saveView();
                }}
                onUpdateAll={() => {
                  void tableViews.updateAllView();
                }}
                onToggleAutosave={() => {
                  void tableViews.toggleAutosave();
                }}
                onSaveAsNew={(name) => {
                  void tableViews.saveAsNewView(name);
                }}
                onRevert={tableViews.revertChanges}
              />
            </div>
          </div>
        <ProspectsTable
          prospects={filtered}
          loading={loading}
          error={null}
          stickyTopOffset={stickyTopOffset}
          showCoachColumn={showCoachColumn}
          hideToolbar
          columnVisibility={columnVisibility}
          columnOrder={columnOrder}
          onColumnVisibilityChange={setColumnVisible}
          onMoveColumn={moveColumnInOrder}
          onRowClick={(id) => {
            const row = prospects.find((p) => p.id === id);
            if (row) onProspectClick(row);
          }}
          editable
          onUpdateProspect={onUpdateProspect}
          onDelete={onDelete}
          deletingId={deletingId}
          coachSlug={coachSlug}
          coachSlugByCoachId={coachSlugByCoachId}
          onVisibleIdsChange={onVisibleIdsChange}
          scoresEnriching={scoresEnriching}
          emptyMessage={emptyMessage}
          groupSections={groupSections ?? undefined}
          groupDraggable={Boolean(groupField)}
          onMoveGroup={
            groupField
              ? (fromKey, toKey) => {
                  const keys = (groupSections ?? []).map((section) => section.key);
                  updateGrouping({
                    ...grouping,
                    order: "manual",
                    manualOrder: {
                      ...grouping.manualOrder,
                      [groupField]: moveKeyInOrder(keys, fromKey, toKey),
                    },
                  });
                }
              : undefined
          }
        />
        </div>
      )}

      <PipelineCustomizePanel
        open={customizeOpen}
        layout={layout}
        onChange={updateLayout}
        onClose={() => setCustomizeOpen(false)}
      />

      <ImportProspectsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        coachOptions={coachFilterOptions}
        requireCoach={importRequiresCoach}
        importUrl={importUrl}
        onImported={onImportedProspects}
      />
    </div>
  );
}
