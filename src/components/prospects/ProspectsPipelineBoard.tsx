"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import {
  buildPipelineBoard,
  COLUMN_DROP_STATUS,
  pipelineColumnForProspect,
  prospectCallTypeLabel,
  type PipelineColumnId,
} from "@/lib/pipelineBoard";
import {
  formatProspectNextCallWhen,
  getProspectNextCallName,
} from "@/lib/prospectNextCall";
import { formatProspectPersonName } from "@/lib/prospectDisplayFormat";
import type { ProspectRow } from "@/lib/prospectRow";
import { prospectWorkspacePath } from "@/lib/prospects/loadEnrichedProspect";
import type { ProspectFieldPatch } from "@/lib/prospects/updateProspectFields";

type CoachFilterOption = {
  id: string;
  label: string;
};

type Props = {
  prospects: ProspectRow[];
  loading?: boolean;
  /** Quiet filter only — never shown on cards. */
  showCoachFilter?: boolean;
  coachFilterOptions?: CoachFilterOption[];
  onCardClick?: (row: ProspectRow) => void;
  onUpdateProspect?: (
    row: ProspectRow,
    patch: ProspectFieldPatch
  ) => void | Promise<void>;
};

const DRAG_TYPE = "application/x-pipeline-prospect-id";

export function ProspectsPipelineBoard({
  prospects,
  loading = false,
  showCoachFilter = false,
  coachFilterOptions = [],
  onCardClick,
  onUpdateProspect,
}: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const [coachFilter, setCoachFilter] = useState<string>("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [didDrag, setDidDrag] = useState(false);
  const [dropTarget, setDropTarget] = useState<PipelineColumnId | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!showCoachFilter || !coachFilter) return prospects;
    return prospects.filter((p) => p.coach_id === coachFilter);
  }, [prospects, showCoachFilter, coachFilter]);

  const columns = useMemo(
    () => buildPipelineBoard(filtered),
    [filtered]
  );

  function openProspect(row: ProspectRow) {
    if (didDrag) {
      setDidDrag(false);
      return;
    }
    if (onCardClick) {
      onCardClick(row);
      return;
    }
    router.push(prospectWorkspacePath(row.id, { admin: isAdmin }));
  }

  async function moveToColumn(row: ProspectRow, columnId: PipelineColumnId) {
    if (!onUpdateProspect) return;
    if (pipelineColumnForProspect(row) === columnId) return;
    const nextStatus = COLUMN_DROP_STATUS[columnId];
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {showCoachFilter && coachFilterOptions.length > 0 ? (
        <div className="flex justify-end">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <span className="text-slate-500">Coach</span>
            <select
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 shadow-sm"
              value={coachFilter}
              onChange={(e) => setCoachFilter(e.target.value)}
            >
              <option value="">All coaches</option>
              {coachFilterOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {loading && filtered.length === 0 ? (
        <p className="text-sm text-slate-600">Loading pipeline…</p>
      ) : (
        <div className="flex min-h-[calc(100dvh-11.5rem)] gap-3 overflow-x-auto pb-1">
          {columns.map((col) => {
            const isDrop = dropTarget === col.id;
            return (
              <div
                key={col.id}
                className={`flex w-[260px] shrink-0 flex-col rounded-2xl ${col.tint} ${
                  isDrop ? "ring-2 ring-sky-400 ring-offset-1" : ""
                }`}
                onDragOver={(e) => {
                  if (!onUpdateProspect) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropTarget(col.id);
                }}
                onDragLeave={() => {
                  setDropTarget((cur) => (cur === col.id ? null : cur));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropTarget(null);
                  const id =
                    e.dataTransfer.getData(DRAG_TYPE) ||
                    e.dataTransfer.getData("text/plain");
                  const row = filtered.find((p) => p.id === id);
                  if (row) void moveToColumn(row, col.id);
                  setDraggingId(null);
                }}
              >
                <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {col.label}
                  </h3>
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-slate-600 tabular-nums shadow-sm">
                    {col.prospects.length}
                  </span>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
                  {col.sections
                    ? col.sections.map((section) => (
                        <div key={section.id} className="flex flex-col gap-1.5">
                          <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {section.label}
                            <span className="ml-1 font-medium tabular-nums text-slate-400">
                              {section.prospects.length}
                            </span>
                          </p>
                          {section.prospects.length === 0 ? (
                            <p className="px-1 pb-1 text-xs text-slate-400">
                              None
                            </p>
                          ) : (
                            section.prospects.map((row) => (
                              <PipelineCard
                                key={row.id}
                                row={row}
                                dragging={draggingId === row.id}
                                saving={savingId === row.id}
                                draggable={Boolean(onUpdateProspect)}
                                onDragStart={() => {
                                  setDidDrag(true);
                                  setDraggingId(row.id);
                                }}
                                onDragEnd={() => {
                                  setDraggingId(null);
                                  setDropTarget(null);
                                  window.setTimeout(() => setDidDrag(false), 0);
                                }}
                                onClick={() => openProspect(row)}
                              />
                            ))
                          )}
                        </div>
                      ))
                    : col.prospects.length === 0
                      ? (
                          <p className="px-1 py-6 text-center text-xs text-slate-400">
                            No prospects
                          </p>
                        )
                      : col.prospects.map((row) => (
                          <PipelineCard
                            key={row.id}
                            row={row}
                            dragging={draggingId === row.id}
                            saving={savingId === row.id}
                            draggable={Boolean(onUpdateProspect)}
                            onDragStart={() => {
                              setDidDrag(true);
                              setDraggingId(row.id);
                            }}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setDropTarget(null);
                              window.setTimeout(() => setDidDrag(false), 0);
                            }}
                            onClick={() => openProspect(row)}
                          />
                        ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PipelineCard({
  row,
  dragging,
  saving,
  draggable,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  row: ProspectRow;
  dragging: boolean;
  saving: boolean;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick?: () => void;
}) {
  const callType = prospectCallTypeLabel(row);
  const nextWhen = formatProspectNextCallWhen(row.next_call);
  const nextName = getProspectNextCallName(row.next_call);

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, row.id);
        e.dataTransfer.setData("text/plain", row.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`w-full rounded-xl border border-slate-200/90 bg-white p-3 text-left shadow-sm transition hover:border-sky-300 hover:shadow ${
        dragging ? "opacity-50" : ""
      } ${saving ? "pointer-events-none opacity-70" : ""} ${
        draggable
          ? "cursor-grab active:cursor-grabbing"
          : "cursor-pointer"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-slate-900">
          {formatProspectPersonName(row.full_name) || row.full_name}
        </p>
      </div>
      {row.business_name?.trim() ? (
        <p className="mt-1 text-xs text-slate-600 line-clamp-1">
          {row.business_name.trim()}
        </p>
      ) : null}
      {(callType || nextWhen || nextName) && (
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          {[callType, nextWhen || nextName].filter(Boolean).join(" · ")}
        </p>
      )}
    </button>
  );
}
