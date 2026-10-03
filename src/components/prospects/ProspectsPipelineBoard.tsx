"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  Ban,
  Calendar,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock,
  Inbox,
  Magnet,
  MessageCircle,
  MoreHorizontal,
  Phone,
  RotateCcw,
  Send,
  StickyNote,
  Tags,
  Trash2,
  XCircle,
} from "lucide-react";
import { BookProspectModal } from "@/components/prospects/BookProspectModal";
import { DeleteProspectsDialog } from "@/components/prospects/DeleteProspectsDialog";
import { ProspectTagsPopover } from "@/components/prospects/ProspectTagsPopover";
import { normalizeProspectTag } from "@/lib/prospects/tags";
import {
  buildPipelineBoard,
  pipelineCardPillLabel,
  pipelineColumnForProspect,
  pipelineDropStatus,
  type PipelineBoardColumn,
} from "@/lib/pipelineBoard";
import {
  sectionCollapseKey,
  setCollapsed,
  setSectionCollapsed,
  type PipelineCardFields,
  type PipelineLayout,
} from "@/lib/pipelineLayout";
import { canonicalizeProspectStatus } from "@/lib/prospectStatus";
import {
  formatProspectNextCallChip,
  type ProspectNextCall,
} from "@/lib/prospectNextCall";
import { pipelineCardIdentity } from "@/lib/prospectDisplayFormat";
import { phoneToTelHref } from "@/lib/formatPhoneDisplay";
import { prospectStatusBadgeClass } from "@/lib/prospectStatus";
import { prospectWorkspacePath } from "@/lib/prospects/loadEnrichedProspect";
import type { ProspectFieldPatch } from "@/lib/prospects/updateProspectFields";
import type { ProspectRow } from "@/lib/prospectRow";

type DropTarget = {
  columnId: string;
  sectionId?: string;
};

type Props = {
  prospects: ProspectRow[];
  loading?: boolean;
  layout: PipelineLayout;
  onLayoutChange: (layout: PipelineLayout) => void;
  onCardClick?: (row: ProspectRow) => void;
  onUpdateProspect?: (
    row: ProspectRow,
    patch: ProspectFieldPatch
  ) => void | Promise<void>;
  onProspectBooked?: (row: ProspectRow, nextCall: ProspectNextCall) => void;
  onDelete?: (
    row: ProspectRow,
    options?: { skipConfirm?: boolean }
  ) => void | Promise<void>;
  onMoveToPool?: (rows: ProspectRow[]) => Promise<void>;
  deletingId?: string | null;
};

const DRAG_TYPE = "application/x-pipeline-prospect-id";

function sameDrop(a: DropTarget | null, b: DropTarget): boolean {
  if (!a) return false;
  return a.columnId === b.columnId && a.sectionId === b.sectionId;
}

function peopleLabel(count: number): string {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

function sectionIcon(sectionId: string) {
  switch (sectionId) {
    case "rebook":
      return RotateCcw;
    case "upcoming":
      return Calendar;
    case "won":
      return CheckCircle2;
    case "abandoned":
      return Ban;
    case "lost":
      return XCircle;
    case "lead_magnet":
      return Magnet;
    case "expressed":
      return MessageCircle;
    case "not_started":
      return Inbox;
    case "in_outreach":
      return Send;
    case "overdue":
      return AlertCircle;
    case "this_week":
      return CalendarDays;
    case "this_month":
      return CalendarRange;
    case "later":
      return Clock;
    case "no_date":
      return CircleDashed;
    default:
      return null;
  }
}

function sectionIconClass(sectionId: string): string {
  switch (sectionId) {
    case "won":
      return "text-emerald-600";
    case "abandoned":
      return "text-amber-500";
    case "lost":
      return "text-rose-500";
    case "rebook":
      return "text-orange-500";
    case "upcoming":
      return "text-sky-600";
    case "overdue":
      return "text-rose-500";
    case "in_outreach":
      return "text-violet-500";
    default:
      return "text-slate-400";
  }
}

export function ProspectsPipelineBoard({
  prospects,
  loading = false,
  layout,
  onLayoutChange,
  onCardClick,
  onUpdateProspect,
  onProspectBooked,
  onDelete,
  onMoveToPool,
  deletingId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [didDrag, setDidDrag] = useState(false);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookingProspect, setBookingProspect] = useState<ProspectRow | null>(
    null
  );
  const [tagPickerId, setTagPickerId] = useState<string | null>(null);
  const [tagSavingId, setTagSavingId] = useState<string | null>(null);
  const [cardMenuId, setCardMenuId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProspectRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [movingToPool, setMovingToPool] = useState(false);

  const tagCatalog = useMemo(() => {
    const seen = new Set<string>();
    const catalog: string[] = [];
    for (const row of prospects) {
      for (const item of row.tags ?? []) {
        const tag = normalizeProspectTag(item);
        if (!tag) continue;
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        catalog.push(tag);
      }
    }
    return catalog.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [prospects]);

  const columns = useMemo(
    () => buildPipelineBoard(prospects, { layout }),
    [prospects, layout]
  );

  function openProspect(row: ProspectRow) {
    if (didDrag) {
      setDidDrag(false);
      return;
    }
    if (tagPickerId || cardMenuId) {
      setTagPickerId(null);
      setCardMenuId(null);
      return;
    }
    if (onCardClick) {
      onCardClick(row);
      return;
    }
    router.push(prospectWorkspacePath(row.id, { admin: isAdmin }));
  }

  async function saveProspectTags(row: ProspectRow, tags: string[]) {
    if (!onUpdateProspect) return;
    setTagSavingId(row.id);
    try {
      await onUpdateProspect(row, { tags });
    } finally {
      setTagSavingId((cur) => (cur === row.id ? null : cur));
    }
  }

  async function moveProspects(
    rows: ProspectRow[],
    columnId: string,
    sectionId?: string
  ) {
    if (!onUpdateProspect || rows.length === 0) return;
    const nextStatus = pipelineDropStatus(columnId, sectionId);
    const pending = rows.filter(
      (row) => canonicalizeProspectStatus(row.prospect_status) !== nextStatus
    );
    if (pending.length === 0) return;
    setError(null);
    setSavingId(pending[0]?.id ?? null);
    try {
      for (let i = 0; i < pending.length; i += 8) {
        const chunk = pending.slice(i, i + 8);
        await Promise.all(
          chunk.map((row) => onUpdateProspect(row, { prospect_status: nextStatus }))
        );
      }
      const moved = new Set(pending.map((row) => row.id));
      setSelectedIds((cur) => cur.filter((id) => !moved.has(id)));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update pipeline status."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function moveSelectedToPool(rows: ProspectRow[]) {
    if (!onMoveToPool || rows.length === 0 || movingToPool) return;
    setError(null);
    setMovingToPool(true);
    try {
      await onMoveToPool(rows);
      const moved = new Set(rows.map((row) => row.id));
      setSelectedIds((cur) => cur.filter((id) => !moved.has(id)));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to move prospects to Pool."
      );
    } finally {
      setMovingToPool(false);
    }
  }

  function bindDrop(target: DropTarget) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!onUpdateProspect) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        setDropTarget(target);
      },
      onDragLeave: () => {
        setDropTarget((cur) => (sameDrop(cur, target) ? null : cur));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget(null);
        const id =
          e.dataTransfer.getData(DRAG_TYPE) ||
          e.dataTransfer.getData("text/plain");
        const dragged = prospects.find((p) => p.id === id);
        if (dragged) {
          const group =
            selectedIds.includes(dragged.id)
              ? prospects.filter((row) => selectedIds.includes(row.id))
              : [dragged];
          void moveProspects(group, target.columnId, target.sectionId);
        }
        setDraggingId(null);
      },
    };
  }

  const cardHandlers = {
    onDragStart: (id: string) => {
      setDidDrag(true);
      setTagPickerId(null);
      setCardMenuId(null);
      setDraggingId(id);
    },
    onDragEnd: () => {
      setDraggingId(null);
      setDropTarget(null);
      window.setTimeout(() => setDidDrag(false), 0);
    },
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {loading && prospects.length === 0 ? (
        <p className="text-sm text-slate-500">Loading pipeline…</p>
      ) : (
        <div className="-mr-4 min-h-0 min-w-0 flex-1 overflow-x-auto overscroll-x-contain pb-2 md:-mr-[60px]">
          <div className="flex h-full w-max gap-3 pr-4">
          {columns.map((col) =>
            col.collapsible && layout.collapsedIds.includes(col.id) ? (
              <CollapsedRail
                key={col.id}
                col={col}
                dropTarget={dropTarget}
                bindDrop={bindDrop}
                onExpand={() => onLayoutChange(setCollapsed(layout, col.id, false))}
              />
            ) : (
              <PipelineColumn
                key={col.id}
                col={col}
                cardFields={layout.cardFields}
                collapsedSectionIds={layout.collapsedSectionIds ?? []}
                onToggleSection={(sectionId) =>
                  onLayoutChange(
                    setSectionCollapsed(
                      layout,
                      col.id,
                      sectionId,
                      !layout.collapsedSectionIds.includes(
                        sectionCollapseKey(col.id, sectionId)
                      )
                    )
                  )
                }
                selectedIds={selectedIds}
                onToggleSelected={(id) =>
                  setSelectedIds((cur) =>
                    cur.includes(id) ? cur.filter((item) => item !== id) : [...cur, id]
                  )
                }
                onToggleSelectAll={(ids, on) =>
                  setSelectedIds((cur) => {
                    const next = new Set(cur);
                    for (const id of ids) {
                      if (on) next.add(id);
                      else next.delete(id);
                    }
                    return [...next];
                  })
                }
                onMoveToPool={
                  onMoveToPool
                    ? (rows) => void moveSelectedToPool(rows)
                    : undefined
                }
                movingToPool={movingToPool}
                onCollapse={
                  col.collapsible
                    ? () =>
                        onLayoutChange(setCollapsed(layout, col.id, true))
                    : undefined
                }
                dropTarget={dropTarget}
                bindDrop={bindDrop}
                draggingId={draggingId}
                savingId={savingId}
                draggable={Boolean(onUpdateProspect)}
                isAdmin={isAdmin}
                onCardClick={openProspect}
                onBook={(row) => {
                  setTagPickerId(null);
                  setCardMenuId(null);
                  setBookingProspect(row);
                }}
                cardHandlers={cardHandlers}
                tagCatalog={tagCatalog}
                tagPickerId={tagPickerId}
                tagSavingId={tagSavingId}
                onToggleTags={(row) =>
                  setTagPickerId((cur) => (cur === row.id ? null : row.id))
                }
                onCloseTags={() => setTagPickerId(null)}
                onSaveTags={onUpdateProspect ? saveProspectTags : undefined}
                cardMenuId={cardMenuId}
                onToggleMenu={
                  onDelete
                    ? (row) =>
                        setCardMenuId((cur) => (cur === row.id ? null : row.id))
                    : undefined
                }
                onDelete={
                  onDelete
                    ? (row) => {
                        setCardMenuId(null);
                        setDeleteError(null);
                        setPendingDelete(row);
                      }
                    : undefined
                }
                deletingId={deletingId}
              />
            )
          )}
          </div>
        </div>
      )}

      <BookProspectModal
        prospect={bookingProspect}
        onClose={() => setBookingProspect(null)}
        onBooked={(row, nextCall) => {
          onProspectBooked?.(row, nextCall);
        }}
      />

      {pendingDelete ? (
        <DeleteProspectsDialog
          rows={[pendingDelete]}
          busy={deleteBusy}
          error={deleteError}
          onCancel={() => {
            if (deleteBusy) return;
            setPendingDelete(null);
            setDeleteError(null);
          }}
          onConfirm={() => {
            if (!onDelete || !pendingDelete) return;
            setDeleteBusy(true);
            setDeleteError(null);
            void Promise.resolve(onDelete(pendingDelete, { skipConfirm: true }))
              .then(() => {
                setPendingDelete(null);
              })
              .catch((err: unknown) => {
                setDeleteError(
                  err instanceof Error
                    ? err.message
                    : "Unable to delete prospect."
                );
              })
              .finally(() => {
                setDeleteBusy(false);
              });
          }}
        />
      ) : null}
    </div>
  );
}

function CollapsedRail({
  col,
  dropTarget,
  bindDrop,
  onExpand,
}: {
  col: PipelineBoardColumn;
  dropTarget: DropTarget | null;
  bindDrop: (target: DropTarget) => {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
  };
  onExpand: () => void;
}) {
  const drop: DropTarget = { columnId: col.id };
  const active = sameDrop(dropTarget, drop);
  const ExpandIcon = ChevronRight;
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-expanded={false}
      aria-label={`Show ${col.label} column, ${peopleLabel(col.prospects.length)}`}
      title={`Show ${col.label}`}
      className={`flex h-full min-h-0 w-11 shrink-0 flex-col items-center gap-3 rounded-xl bg-slate-100 py-4 text-slate-500 transition hover:bg-slate-200/80 ${
        active ? "ring-2 ring-sky-400" : ""
      }`}
      {...bindDrop(drop)}
    >
      <ExpandIcon className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} aria-hidden />
      <span className={`h-2.5 w-2.5 rounded-full ${col.dotClass}`} aria-hidden />
      <span
        className="text-xs font-semibold tracking-wide text-slate-600"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {col.label}
      </span>
      <span className="text-[11px] font-medium tabular-nums text-slate-600">
        {col.prospects.length}
      </span>
    </button>
  );
}

function PipelineColumn({
  col,
  cardFields,
  collapsedSectionIds,
  onToggleSection,
  selectedIds,
  onToggleSelected,
  onToggleSelectAll,
  onMoveToPool,
  movingToPool,
  onCollapse,
  dropTarget,
  bindDrop,
  draggingId,
  savingId,
  draggable,
  isAdmin,
  onCardClick,
  onBook,
  cardHandlers,
  tagCatalog,
  tagPickerId,
  tagSavingId,
  onToggleTags,
  onCloseTags,
  onSaveTags,
  cardMenuId,
  onToggleMenu,
  onDelete,
  deletingId,
}: {
  col: PipelineBoardColumn;
  cardFields: PipelineCardFields;
  collapsedSectionIds: string[];
  onToggleSection: (sectionId: string) => void;
  selectedIds: string[];
  onToggleSelected: (id: string) => void;
  onToggleSelectAll: (ids: string[], on: boolean) => void;
  onMoveToPool?: (rows: ProspectRow[]) => void;
  movingToPool: boolean;
  onCollapse?: () => void;
  dropTarget: DropTarget | null;
  bindDrop: (target: DropTarget) => {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
  };
  draggingId: string | null;
  savingId: string | null;
  draggable: boolean;
  isAdmin: boolean;
  onCardClick: (row: ProspectRow) => void;
  onBook: (row: ProspectRow) => void;
  cardHandlers: {
    onDragStart: (id: string) => void;
    onDragEnd: () => void;
  };
  tagCatalog: string[];
  tagPickerId: string | null;
  tagSavingId: string | null;
  onToggleTags: (row: ProspectRow) => void;
  onCloseTags: () => void;
  onSaveTags?: (row: ProspectRow, tags: string[]) => Promise<void>;
  cardMenuId: string | null;
  onToggleMenu?: (row: ProspectRow) => void;
  onDelete?: (row: ProspectRow) => void;
  deletingId?: string | null;
}) {
  const colDrop: DropTarget = { columnId: col.id };
  const colActive = sameDrop(dropTarget, colDrop);
  const CollapseIcon = ChevronLeft;
  const selectable = col.id === "to_sort";
  const columnIds = col.prospects.map((row) => row.id);
  const selectedInColumn = columnIds.filter((id) => selectedIds.includes(id));
  const allSelected = columnIds.length > 0 && selectedInColumn.length === columnIds.length;

  function renderCard(row: ProspectRow) {
    return (
      <PipelineCard
        key={row.id}
        row={row}
        fields={cardFields}
        selectable={selectable}
        selected={selectedIds.includes(row.id)}
        onToggleSelected={() => onToggleSelected(row.id)}
        dragging={draggingId === row.id}
        saving={savingId === row.id}
        draggable={
          draggable && tagPickerId !== row.id && cardMenuId !== row.id
        }
        isAdmin={isAdmin}
        canBook={col.id !== "closed"}
        showPill={Boolean(cardFields.pill) && col.id !== "to_sort"}
        tagCatalog={tagCatalog}
        tagsOpen={tagPickerId === row.id}
        tagSaving={tagSavingId === row.id}
        onToggleTags={() => onToggleTags(row)}
        onCloseTags={onCloseTags}
        onSaveTags={onSaveTags ? (tags) => onSaveTags(row, tags) : undefined}
        onDragStart={() => cardHandlers.onDragStart(row.id)}
        onDragEnd={cardHandlers.onDragEnd}
        onClick={() => onCardClick(row)}
        onBook={() => onBook(row)}
        menuOpen={cardMenuId === row.id}
        onToggleMenu={onToggleMenu ? () => onToggleMenu(row) : undefined}
        onDelete={onDelete ? () => onDelete(row) : undefined}
        deleting={deletingId === row.id}
      />
    );
  }

  return (
    <div
      className={`flex h-full min-h-0 w-[220px] shrink-0 flex-col rounded-xl bg-slate-100 ${
        colActive ? "ring-2 ring-sky-400" : ""
      }`}
      {...bindDrop(colDrop)}
    >
      <div className="px-2 pt-2">
        <div className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${col.dotClass}`} aria-hidden />
          <h3 className="min-w-0 truncate text-sm font-semibold text-slate-900">
            {col.label}
          </h3>
          <span
            className="ml-auto shrink-0 text-xs font-medium tabular-nums text-slate-600"
            title={peopleLabel(col.prospects.length)}
          >
            {col.prospects.length}
          </span>
          {onCollapse ? (
            <button
              type="button"
              aria-label={`Minimise ${col.label} column`}
              title={`Minimise ${col.label}`}
              onClick={onCollapse}
              className="rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <CollapseIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
        </div>
        {selectable ? (
          <div className="mt-2 space-y-2 px-1">
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={columnIds.length === 0 || movingToPool}
                onChange={(e) => onToggleSelectAll(columnIds, e.target.checked)}
                aria-label={`Select all in ${col.label}`}
                className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>
                {selectedInColumn.length
                  ? `${selectedInColumn.length} selected`
                  : "Select"}
              </span>
            </label>
            {selectedInColumn.length > 0 && onMoveToPool ? (
              <button
                type="button"
                disabled={movingToPool}
                onClick={() =>
                  onMoveToPool(
                    col.prospects.filter((row) => selectedIds.includes(row.id))
                  )
                }
                className="w-full rounded-md bg-slate-900 px-2 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {movingToPool
                  ? "Moving…"
                  : `Move ${selectedInColumn.length} to pool`}
              </button>
            ) : col.prospects.length > 0 ? (
              <p className="text-[11px] leading-snug text-slate-500">
                Tick people, then Move to pool. Or drag a card into a column.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3 pt-2">
        {col.sections
          ? col.sections.map((section) => {
              const Icon = sectionIcon(section.id);
              const sectionDrop: DropTarget = {
                columnId: col.id,
                sectionId: section.id,
              };
              const sectionActive = sameDrop(dropTarget, sectionDrop);
              const collapsed = collapsedSectionIds.includes(
                sectionCollapseKey(col.id, section.id)
              );
              const SectionChevron = collapsed ? ChevronRight : ChevronDown;
              return (
                <div
                  key={section.id}
                  className={`flex flex-col gap-1.5 rounded-lg p-1 ${
                    sectionActive ? "bg-sky-100/80" : ""
                  }`}
                  {...bindDrop(sectionDrop)}
                >
                  <button
                    type="button"
                    aria-expanded={!collapsed}
                    onClick={() => onToggleSection(section.id)}
                    className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm font-semibold text-slate-800 hover:bg-white/70"
                  >
                    {Icon ? (
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${sectionIconClass(section.id)}`}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    ) : null}
                    <span className="min-w-0 truncate">{section.label}</span>
                    <span className="ml-auto text-xs font-medium tabular-nums text-slate-600">
                      {section.prospects.length}
                    </span>
                    <SectionChevron
                      className="h-3.5 w-3.5 shrink-0 text-slate-400"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </button>
                  {collapsed ? null : section.prospects.map((row) => renderCard(row))}
                </div>
              );
            })
          : col.prospects.length === 0
            ? (
                <p className="px-2 py-8 text-center text-xs text-slate-400">
                  Drop prospects here
                </p>
              )
            : col.prospects.map((row) => renderCard(row))}
      </div>
    </div>
  );
}

function stopCardAction(e: React.MouseEvent | React.PointerEvent) {
  e.stopPropagation();
}

function CardAction({
  href,
  title,
  muted,
  badge,
  children,
}: {
  href: string;
  title: string;
  muted?: boolean;
  badge?: number | string | null;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      title={title}
      onClick={stopCardAction}
      onPointerDown={stopCardAction}
      className={`relative inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-sky-700 ${
        muted ? "opacity-35 hover:opacity-80" : ""
      }`}
    >
      {children}
      {badge != null && badge !== 0 ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-sky-600 px-0.5 text-[9px] font-semibold leading-none text-white">
          {badge}
        </span>
      ) : null}
    </a>
  );
}

function PipelineCard({
  row,
  fields,
  selectable = false,
  selected = false,
  onToggleSelected,
  dragging,
  saving,
  draggable,
  isAdmin,
  canBook,
  showPill = false,
  tagCatalog,
  tagsOpen,
  tagSaving,
  onToggleTags,
  onCloseTags,
  onSaveTags,
  onDragStart,
  onDragEnd,
  onClick,
  onBook,
  menuOpen,
  onToggleMenu,
  onDelete,
  deleting,
}: {
  row: ProspectRow;
  fields: PipelineCardFields;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
  dragging: boolean;
  saving: boolean;
  draggable: boolean;
  isAdmin: boolean;
  canBook: boolean;
  showPill?: boolean;
  tagCatalog: string[];
  tagsOpen: boolean;
  tagSaving: boolean;
  onToggleTags: () => void;
  onCloseTags: () => void;
  onSaveTags?: (tags: string[]) => Promise<void>;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick?: () => void;
  onBook?: () => void;
  menuOpen?: boolean;
  onToggleMenu?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const identity = pipelineCardIdentity(row);
  const name = identity.title;
  const pill = pipelineCardPillLabel(row);
  const workspaceHref = prospectWorkspacePath(row.id, { admin: isAdmin });
  const callsHref = isAdmin ? "/admin/calls" : "/coach/calls";
  const telHref = phoneToTelHref(row.phone);
  const appointment = fields.appointment
    ? formatProspectNextCallChip(row.next_call)
    : null;
  const tagCount = row.tags?.length ?? 0;
  const hasNotes = Boolean(row.next_action?.text?.trim());

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, row.id);
        e.dataTransfer.setData("text/plain", row.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`w-full rounded-lg border bg-white px-2 py-1.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:shadow-[0_4px_10px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
        selected ? "border-sky-300 bg-sky-50/60" : "border-slate-200/80"
      } ${dragging ? "opacity-50" : ""} ${
        saving || deleting ? "pointer-events-none opacity-70" : ""
      } ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
    >
      <div className="flex items-center gap-1.5">
        {selectable ? (
          <input
            type="checkbox"
            checked={selected}
            aria-label={`Select ${name}`}
            onClick={stopCardAction}
            onPointerDown={stopCardAction}
            onChange={() => onToggleSelected?.()}
            className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
        ) : null}
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
          {name}
        </p>
        <div className="flex shrink-0 items-center gap-0.5">
          {showPill ? (
            <span
              className={`mt-0.5 inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${prospectStatusBadgeClass(row.status.value)}`}
            >
              {pill}
            </span>
          ) : null}
          {onToggleMenu ? (
            <div className="relative">
              <button
                type="button"
                title="Prospect actions"
                aria-label={`Actions for ${name}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={(e) => {
                  stopCardAction(e);
                  onToggleMenu();
                }}
                onPointerDown={stopCardAction}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition ${
                  menuOpen
                    ? "bg-slate-100 text-slate-700"
                    : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                }`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-[100] mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                  onClick={stopCardAction}
                  onPointerDown={stopCardAction}
                >
                  {onDelete ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50"
                      onClick={onDelete}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {identity.detail ? (
        <p
          className={`mt-0.5 truncate text-[11px] text-slate-600 ${
            selectable ? "pl-5" : ""
          }`}
        >
          {identity.detail}
        </p>
      ) : null}
      {appointment ? (
        <p
          className={`mt-0.5 truncate text-[11px] font-medium text-sky-700 ${
            selectable ? "pl-5" : ""
          }`}
        >
          {appointment}
        </p>
      ) : null}
      {fields.actions ? (
        <div className="mt-1 flex items-center">
              <CardAction
                href={telHref ?? workspaceHref}
                title={telHref ? "Call" : "Add a phone number"}
                muted={!telHref}
              >
                <Phone className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              </CardAction>
              <CardAction href={workspaceHref} title="Conversations">
                <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              </CardAction>
              {onSaveTags ? (
                <ProspectTagsPopover
                  open={tagsOpen}
                  tags={row.tags ?? []}
                  catalog={tagCatalog}
                  saving={tagSaving}
                  onClose={onCloseTags}
                  onChange={onSaveTags}
                >
                  <button
                    type="button"
                    title={
                      tagCount
                        ? `${tagCount} tag${tagCount === 1 ? "" : "s"}`
                        : "Tags"
                    }
                    aria-label={
                      tagCount
                        ? `${tagCount} tag${tagCount === 1 ? "" : "s"}`
                        : "Tags"
                    }
                    aria-expanded={tagsOpen}
                    onClick={(e) => {
                      stopCardAction(e);
                      onToggleTags();
                    }}
                    onPointerDown={stopCardAction}
                    className={`relative inline-flex h-6 w-6 items-center justify-center rounded-md transition ${
                      tagsOpen
                        ? "bg-sky-50 text-sky-700"
                        : `text-slate-400 hover:bg-slate-100 hover:text-sky-700 ${
                            tagCount === 0 ? "opacity-35 hover:opacity-80" : ""
                          }`
                    }`}
                  >
                    <Tags className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    {tagCount > 0 ? (
                      <span className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-sky-600 px-0.5 text-[9px] font-semibold leading-none text-white">
                        {tagCount}
                      </span>
                    ) : null}
                  </button>
                </ProspectTagsPopover>
              ) : (
                <CardAction
                  href={workspaceHref}
                  title={
                    tagCount
                      ? `${tagCount} tag${tagCount === 1 ? "" : "s"}`
                      : "Tags"
                  }
                  muted={tagCount === 0}
                  badge={tagCount > 0 ? tagCount : null}
                >
                  <Tags className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                </CardAction>
              )}
              <CardAction
                href={workspaceHref}
                title={hasNotes ? "Follow-up note" : "Notes"}
                muted={!hasNotes}
              >
                <StickyNote className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              </CardAction>
              {canBook ? (
                appointment ? (
                  <CardAction
                    href={callsHref}
                    title={row.next_call?.title || appointment}
                  >
                    <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  </CardAction>
                ) : (
                  <button
                    type="button"
                    title="Book a call"
                    onClick={(e) => {
                      stopCardAction(e);
                      onBook?.();
                    }}
                    onPointerDown={stopCardAction}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 opacity-35 transition hover:bg-slate-100 hover:text-sky-700 hover:opacity-80"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  </button>
                )
              ) : null}
            </div>
          ) : null}
    </div>
  );
}
