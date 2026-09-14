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
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock,
  Inbox,
  Magnet,
  MessageCircle,
  Phone,
  RotateCcw,
  Send,
  StickyNote,
  Tags,
  XCircle,
} from "lucide-react";
import { BookProspectModal } from "@/components/prospects/BookProspectModal";
import { ProspectTagChip } from "@/components/prospects/ProspectTagChip";
import { ProspectTagsPopover } from "@/components/prospects/ProspectTagsPopover";
import { normalizeProspectTag } from "@/lib/prospects/tags";
import {
  buildPipelineBoard,
  columnDealValue,
  formatPipelineMoney,
  pipelineCardPillLabel,
  pipelineColumnForProspect,
  pipelineDropStatus,
  type PipelineBoardColumn,
} from "@/lib/pipelineBoard";
import {
  setCollapsed,
  type PipelineCardFields,
  type PipelineLayout,
} from "@/lib/pipelineLayout";
import {
  formatProspectNextCallChip,
  type ProspectNextCall,
} from "@/lib/prospectNextCall";
import { formatProspectPersonName } from "@/lib/prospectDisplayFormat";
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
};

const DRAG_TYPE = "application/x-pipeline-prospect-id";

function cardScore(row: ProspectRow): string | null {
  if (row.boss_score_premium != null) return String(Math.round(row.boss_score_premium));
  if (row.boss_score != null) return String(Math.round(row.boss_score));
  return null;
}

function sameDrop(a: DropTarget | null, b: DropTarget): boolean {
  if (!a) return false;
  return a.columnId === b.columnId && a.sectionId === b.sectionId;
}

function dealsLabel(count: number): string {
  return `${count} ${count === 1 ? "Deal" : "Deals"}`;
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
    if (tagPickerId) {
      setTagPickerId(null);
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

  async function moveProspect(
    row: ProspectRow,
    columnId: string,
    sectionId?: string
  ) {
    if (!onUpdateProspect) return;
    const currentColumn = pipelineColumnForProspect(row, layout);
    if (!sectionId && currentColumn === columnId) return;
    const nextStatus = pipelineDropStatus(columnId, sectionId);
    if (row.status.value === nextStatus) return;
    setError(null);
    setSavingId(row.id);
    try {
      await onUpdateProspect(row, { prospect_status: nextStatus });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update pipeline status."
      );
    } finally {
      setSavingId(null);
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
        const row = prospects.find((p) => p.id === id);
        if (row) void moveProspect(row, target.columnId, target.sectionId);
        setDraggingId(null);
      },
    };
  }

  const cardHandlers = {
    onDragStart: (id: string) => {
      setDidDrag(true);
      setTagPickerId(null);
      setDraggingId(id);
    },
    onDragEnd: () => {
      setDraggingId(null);
      setDropTarget(null);
      window.setTimeout(() => setDidDrag(false), 0);
    },
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {loading && prospects.length === 0 ? (
        <p className="text-sm text-slate-500">Loading pipeline…</p>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
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
                avgDeal={layout.avgDealAmount}
                cardFields={layout.cardFields}
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
              />
            )
          )}
        </div>
      )}

      <BookProspectModal
        prospect={bookingProspect}
        onClose={() => setBookingProspect(null)}
        onBooked={(row, nextCall) => {
          onProspectBooked?.(row, nextCall);
        }}
      />
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
      aria-label={`Show ${col.label} column, ${dealsLabel(col.prospects.length)}`}
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
      <span className="text-[11px] font-medium tabular-nums text-slate-400">
        {col.prospects.length}
      </span>
    </button>
  );
}

function PipelineColumn({
  col,
  avgDeal,
  cardFields,
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
}: {
  col: PipelineBoardColumn;
  avgDeal: number;
  cardFields: PipelineCardFields;
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
}) {
  const colDrop: DropTarget = { columnId: col.id };
  const colActive = sameDrop(dropTarget, colDrop);
  const value = columnDealValue(col.prospects.length, avgDeal);
  const CollapseIcon = col.id === "closed" ? ChevronRight : ChevronLeft;

  return (
    <div
      className={`flex h-full min-h-0 w-[300px] shrink-0 flex-col rounded-xl bg-slate-100 ${
        colActive ? "ring-2 ring-sky-400" : ""
      }`}
      {...bindDrop(colDrop)}
    >
      <div className="px-2 pt-2">
        <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${col.dotClass}`} aria-hidden />
          <h3 className="min-w-0 truncate text-sm font-semibold text-slate-900">
            {col.label}
          </h3>
          <span className="shrink-0 text-xs tabular-nums text-slate-400">
            {dealsLabel(col.prospects.length)}
          </span>
          <span
            className="ml-auto shrink-0 text-sm font-medium tabular-nums text-slate-500"
            title={`${dealsLabel(col.prospects.length)} × ${formatPipelineMoney(avgDeal)} avg`}
          >
            {formatPipelineMoney(value)}
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
              return (
                <div
                  key={section.id}
                  className={`flex flex-col gap-2 rounded-lg p-1 ${
                    sectionActive ? "bg-sky-100/80" : ""
                  }`}
                  {...bindDrop(sectionDrop)}
                >
                  <p className="flex items-center gap-1.5 px-1.5 pt-1 text-sm font-semibold text-slate-800">
                    {Icon ? (
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${sectionIconClass(section.id)}`}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    ) : null}
                    {section.label}
                    <span className="ml-0.5 text-xs font-medium tabular-nums text-slate-500">
                      {section.prospects.length}
                    </span>
                  </p>
                  {section.prospects.map((row) => (
                    <PipelineCard
                      key={row.id}
                      row={row}
                      fields={cardFields}
                      dragging={draggingId === row.id}
                      saving={savingId === row.id}
                      draggable={draggable && tagPickerId !== row.id}
                      isAdmin={isAdmin}
                      canBook={col.id !== "closed"}
                      tagCatalog={tagCatalog}
                      tagsOpen={tagPickerId === row.id}
                      tagSaving={tagSavingId === row.id}
                      onToggleTags={() => onToggleTags(row)}
                      onCloseTags={onCloseTags}
                      onSaveTags={
                        onSaveTags
                          ? (tags) => onSaveTags(row, tags)
                          : undefined
                      }
                      onDragStart={() => cardHandlers.onDragStart(row.id)}
                      onDragEnd={cardHandlers.onDragEnd}
                      onClick={() => onCardClick(row)}
                      onBook={() => onBook(row)}
                    />
                  ))}
                </div>
              );
            })
          : col.prospects.length === 0
            ? (
                <p className="px-2 py-8 text-center text-xs text-slate-400">
                  Drop prospects here
                </p>
              )
            : col.prospects.map((row) => (
                <PipelineCard
                  key={row.id}
                  row={row}
                  fields={cardFields}
                  dragging={draggingId === row.id}
                  saving={savingId === row.id}
                  draggable={draggable && tagPickerId !== row.id}
                  isAdmin={isAdmin}
                  canBook={col.id !== "closed"}
                  tagCatalog={tagCatalog}
                  tagsOpen={tagPickerId === row.id}
                  tagSaving={tagSavingId === row.id}
                  onToggleTags={() => onToggleTags(row)}
                  onCloseTags={onCloseTags}
                  onSaveTags={
                    onSaveTags ? (tags) => onSaveTags(row, tags) : undefined
                  }
                  onDragStart={() => cardHandlers.onDragStart(row.id)}
                  onDragEnd={cardHandlers.onDragEnd}
                  onClick={() => onCardClick(row)}
                  onBook={() => onBook(row)}
                />
              ))}
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
      className={`relative inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-sky-700 ${
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
  dragging,
  saving,
  draggable,
  isAdmin,
  canBook,
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
}: {
  row: ProspectRow;
  fields: PipelineCardFields;
  dragging: boolean;
  saving: boolean;
  draggable: boolean;
  isAdmin: boolean;
  canBook: boolean;
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
}) {
  const name = formatProspectPersonName(row.full_name) || row.full_name;
  const company = row.business_name?.trim() || row.job_title?.trim() || "";
  const score = cardScore(row);
  const pill = pipelineCardPillLabel(row);
  const workspaceHref = prospectWorkspacePath(row.id, { admin: isAdmin });
  const callsHref = isAdmin ? "/admin/calls" : "/coach/calls";
  const telHref = phoneToTelHref(row.phone);
  const appointment = formatProspectNextCallChip(row.next_call);
  const tagCount = row.tags?.length ?? 0;
  const hasNotes = Boolean(row.next_action?.text?.trim());
  const showFooter = fields.actions || fields.appointment;

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
      className={`w-full rounded-xl border border-slate-200/80 bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:shadow-[0_6px_14px_rgba(15,23,42,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
        dragging ? "opacity-50" : ""
      } ${saving ? "pointer-events-none opacity-70" : ""} ${
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold leading-snug text-slate-900">
          {name}
        </p>
        {fields.pill ? (
          <span
            className={`mt-0.5 inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${prospectStatusBadgeClass(row.status.value)}`}
          >
            {pill}
          </span>
        ) : null}
      </div>
      {fields.company && company ? (
        <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{company}</p>
      ) : null}
      {fields.score && score ? (
        <p className="mt-2 text-xs font-medium tabular-nums text-slate-700">
          BOSS {score}
        </p>
      ) : null}
      {tagCount > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {(row.tags ?? []).slice(0, 3).map((tag) => (
            <ProspectTagChip
              key={tag}
              tag={tag}
              title={onSaveTags ? "Edit tags" : tag}
              onClick={onSaveTags ? onToggleTags : undefined}
            />
          ))}
          {tagCount > 3 ? (
            <span className="self-center text-[10px] font-medium tabular-nums text-slate-400">
              +{tagCount - 3}
            </span>
          ) : null}
        </div>
      ) : null}
      {showFooter ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          {fields.actions ? (
            <div className="flex items-center">
              <CardAction
                href={telHref ?? workspaceHref}
                title={telHref ? "Call" : "Add a phone number"}
                muted={!telHref}
              >
                <Phone className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </CardAction>
              <CardAction href={workspaceHref} title="Conversations">
                <MessageCircle className="h-4 w-4" strokeWidth={1.75} aria-hidden />
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
                    className={`relative inline-flex h-7 w-7 items-center justify-center rounded-md transition ${
                      tagsOpen
                        ? "bg-sky-50 text-sky-700"
                        : `text-slate-400 hover:bg-slate-100 hover:text-sky-700 ${
                            tagCount === 0 ? "opacity-35 hover:opacity-80" : ""
                          }`
                    }`}
                  >
                    <Tags className="h-4 w-4" strokeWidth={1.75} aria-hidden />
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
                  <Tags className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </CardAction>
              )}
              <CardAction
                href={workspaceHref}
                title={hasNotes ? "Follow-up note" : "Notes"}
                muted={!hasNotes}
              >
                <StickyNote className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </CardAction>
            </div>
          ) : (
            <span />
          )}
          {fields.appointment ? (
            appointment ? (
              <a
                href={callsHref}
                title={row.next_call?.title || "Upcoming call"}
                onClick={stopCardAction}
                onPointerDown={stopCardAction}
                className="inline-flex max-w-[11rem] shrink-0 items-center gap-1 truncate rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 hover:bg-sky-100"
              >
                <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="truncate">{appointment}</span>
              </a>
            ) : canBook ? (
              <button
                type="button"
                title="Book a call"
                onClick={(e) => {
                  stopCardAction(e);
                  onBook?.();
                }}
                onPointerDown={stopCardAction}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-400 hover:border-sky-300 hover:text-sky-700"
              >
                <CalendarPlus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                Book
              </button>
            ) : null
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
