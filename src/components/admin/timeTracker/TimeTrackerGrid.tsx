"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { TimeTrackerBlock, TimeTrackerSettings } from "@/lib/timeTracker/types";
import {
  formatMinutes,
  slotStarts,
  toDateKey,
  weekdayLabel,
  formatDateShort,
  isTodayKey,
} from "@/lib/timeTracker/time";
import { ratingTileClasses, ratingDotClasses } from "@/lib/timeTracker/rating";

const SLOT_PX = 20;
const TIME_COL_PX = 64;
// Pointer must move at least this many pixels before a block press counts as a
// drag; anything smaller is treated as a click and opens the editor.
const DRAG_THRESHOLD_PX = 5;

type CreateDragState = {
  dayKey: string;
  columnEl: HTMLElement;
  anchorIdx: number;
  lo: number;
  hi: number;
};

type BlockDragMode = "move" | "resize-top" | "resize-bottom";

type BlockDragState = {
  blockId: string;
  dayKey: string;
  columnEl: HTMLElement;
  mode: BlockDragMode;
  pointerAnchorIdx: number;
  startClientY: number;
  origLo: number;
  origHi: number; // exclusive
  lo: number;
  hi: number; // exclusive
  pointerMoved: boolean;
};

type DayRange = { id: string; lo: number; hi: number };

type TimeTrackerGridProps = {
  settings: TimeTrackerSettings;
  weekDates: Date[];
  blocks: TimeTrackerBlock[];
  editable: boolean;
  onCreate: (dayKey: string, startMin: number, endMin: number) => void;
  onMoveResize: (block: TimeTrackerBlock, startMin: number, endMin: number) => void;
  onOpenBlock: (block: TimeTrackerBlock) => void;
};

export function TimeTrackerGrid({
  settings,
  weekDates,
  blocks,
  editable,
  onCreate,
  onMoveResize,
  onOpenBlock,
}: TimeTrackerGridProps) {
  const slots = useMemo(() => slotStarts(settings), [settings]);
  const slotCount = slots.length;
  const slotMinutes = settings.slotMinutes;
  const columnHeight = slotCount * SLOT_PX;
  const windowStart = slots[0] ?? 0;

  const [drag, setDrag] = useState<CreateDragState | null>(null);
  const dragRef = useRef<CreateDragState | null>(null);
  const [blockDrag, setBlockDrag] = useState<BlockDragState | null>(null);
  const blockDragRef = useRef<BlockDragState | null>(null);

  const blocksByDay = useMemo(() => {
    const map = new Map<string, TimeTrackerBlock[]>();
    for (const b of blocks) {
      const list = map.get(b.dayDate) ?? [];
      list.push(b);
      map.set(b.dayDate, list);
    }
    return map;
  }, [blocks]);

  const slotRange = useCallback(
    (b: TimeTrackerBlock) => ({
      lo: Math.max(0, Math.round((b.startMin - windowStart) / slotMinutes)),
      hi: Math.min(slotCount, Math.round((b.endMin - windowStart) / slotMinutes)),
    }),
    [slotCount, slotMinutes, windowStart]
  );

  // Per-day list of occupied slot ranges (used for overlap checks).
  const dayRanges = useMemo(() => {
    const map = new Map<string, DayRange[]>();
    for (const [dayKey, list] of blocksByDay) {
      map.set(
        dayKey,
        list.map((b) => ({ id: b.id, ...slotRange(b) }))
      );
    }
    return map;
  }, [blocksByDay, slotRange]);

  // Occupied slot flags per day, used to keep new blocks from overlapping.
  const occupiedByDay = useMemo(() => {
    const map = new Map<string, boolean[]>();
    for (const [dayKey, ranges] of dayRanges) {
      const flags = new Array<boolean>(slotCount).fill(false);
      for (const r of ranges) {
        for (let i = r.lo; i < r.hi; i += 1) flags[i] = true;
      }
      map.set(dayKey, flags);
    }
    return map;
  }, [dayRanges, slotCount]);

  const rangeIsFree = useCallback(
    (dayKey: string, lo: number, hi: number, excludeId: string) => {
      if (lo < 0 || hi > slotCount || hi <= lo) return false;
      const ranges = dayRanges.get(dayKey) ?? [];
      for (const r of ranges) {
        if (r.id === excludeId) continue;
        if (lo < r.hi && hi > r.lo) return false;
      }
      return true;
    },
    [dayRanges, slotCount]
  );

  const idxFromPointer = useCallback(
    (columnEl: HTMLElement, clientY: number) => {
      const rect = columnEl.getBoundingClientRect();
      const raw = Math.floor((clientY - rect.top) / SLOT_PX);
      return Math.max(0, Math.min(slotCount - 1, raw));
    },
    [slotCount]
  );

  // ----- Create-drag (drag on empty area to make a new block) -----

  const clampFree = useCallback(
    (dayKey: string, anchor: number, target: number): { lo: number; hi: number } => {
      const occupied = occupiedByDay.get(dayKey);
      let lo = Math.min(anchor, target);
      let hi = Math.max(anchor, target);
      if (!occupied) return { lo, hi };
      while (lo < anchor && occupied[lo]) lo += 1;
      while (hi > anchor && occupied[hi]) hi -= 1;
      for (let i = anchor; i >= lo; i -= 1) {
        if (occupied[i]) {
          lo = i + 1;
          break;
        }
      }
      for (let i = anchor; i <= hi; i += 1) {
        if (occupied[i]) {
          hi = i - 1;
          break;
        }
      }
      return { lo, hi };
    },
    [occupiedByDay]
  );

  const endCreateDrag = useCallback(() => {
    const current = dragRef.current;
    setDrag(null);
    dragRef.current = null;
    if (!current) return;
    const startMin = windowStart + current.lo * slotMinutes;
    const endMin = windowStart + (current.hi + 1) * slotMinutes;
    if (endMin > startMin) onCreate(current.dayKey, startMin, endMin);
  }, [onCreate, slotMinutes, windowStart]);

  const handleColumnPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, dayKey: string) => {
      if (!editable || e.button !== 0) return;
      const columnEl = e.currentTarget;
      const anchor = idxFromPointer(columnEl, e.clientY);
      if (occupiedByDay.get(dayKey)?.[anchor]) return;
      const { lo, hi } = clampFree(dayKey, anchor, anchor);
      const next: CreateDragState = { dayKey, columnEl, anchorIdx: anchor, lo, hi };
      setDrag(next);
      dragRef.current = next;

      const onMove = (ev: PointerEvent) => {
        const cur = dragRef.current;
        if (!cur) return;
        const target = idxFromPointer(cur.columnEl, ev.clientY);
        const range = clampFree(cur.dayKey, cur.anchorIdx, target);
        const updated = { ...cur, lo: range.lo, hi: range.hi };
        dragRef.current = updated;
        setDrag(updated);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        endCreateDrag();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [clampFree, editable, endCreateDrag, idxFromPointer, occupiedByDay]
  );

  // ----- Block move / resize -----

  const endBlockDrag = useCallback(() => {
    const cur = blockDragRef.current;
    setBlockDrag(null);
    blockDragRef.current = null;
    if (!cur) return;
    const block = blocks.find((b) => b.id === cur.blockId);
    if (!block) return;
    if (!cur.pointerMoved) {
      onOpenBlock(block);
      return;
    }
    const startMin = windowStart + cur.lo * slotMinutes;
    const endMin = windowStart + cur.hi * slotMinutes;
    if (startMin !== block.startMin || endMin !== block.endMin) {
      onMoveResize(block, startMin, endMin);
    }
  }, [blocks, onMoveResize, onOpenBlock, slotMinutes, windowStart]);

  const startBlockDrag = useCallback(
    (
      e: React.PointerEvent<HTMLElement>,
      block: TimeTrackerBlock,
      mode: BlockDragMode
    ) => {
      e.stopPropagation();
      if (!editable || e.button !== 0) {
        if (!editable) onOpenBlock(block);
        return;
      }
      const columnEl = e.currentTarget.closest("[data-day-column]") as HTMLElement | null;
      if (!columnEl) return;
      const { lo, hi } = slotRange(block);
      const pointerAnchorIdx = idxFromPointer(columnEl, e.clientY);
      const next: BlockDragState = {
        blockId: block.id,
        dayKey: block.dayDate,
        columnEl,
        mode,
        pointerAnchorIdx,
        startClientY: e.clientY,
        origLo: lo,
        origHi: hi,
        lo,
        hi,
        pointerMoved: false,
      };
      setBlockDrag(next);
      blockDragRef.current = next;

      const onMove = (ev: PointerEvent) => {
        const c = blockDragRef.current;
        if (!c) return;
        // Treat tiny movements as a click (so editing a block is reliable).
        const pointerMoved =
          c.pointerMoved ||
          Math.abs(ev.clientY - c.startClientY) > DRAG_THRESHOLD_PX;
        if (!pointerMoved) return;
        const target = idxFromPointer(c.columnEl, ev.clientY);
        let nextLo = c.lo;
        let nextHi = c.hi;

        if (c.mode === "move") {
          let delta = target - c.pointerAnchorIdx;
          const span = c.origHi - c.origLo;
          let candLo = c.origLo + delta;
          if (candLo < 0) delta -= candLo;
          let candHi = c.origLo + delta + span;
          if (candHi > slotCount) delta -= candHi - slotCount;
          candLo = c.origLo + delta;
          candHi = candLo + span;
          if (rangeIsFree(c.dayKey, candLo, candHi, c.blockId)) {
            nextLo = candLo;
            nextHi = candHi;
          }
        } else if (c.mode === "resize-top") {
          const candLo = Math.min(target, c.origHi - 1);
          if (rangeIsFree(c.dayKey, candLo, c.origHi, c.blockId)) {
            nextLo = candLo;
            nextHi = c.origHi;
          }
        } else {
          const candHi = Math.max(target + 1, c.origLo + 1);
          if (rangeIsFree(c.dayKey, c.origLo, candHi, c.blockId)) {
            nextLo = c.origLo;
            nextHi = candHi;
          }
        }

        const updated = { ...c, lo: nextLo, hi: nextHi, pointerMoved };
        blockDragRef.current = updated;
        setBlockDrag(updated);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        endBlockDrag();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [editable, endBlockDrag, idxFromPointer, onOpenBlock, rangeIsFree, slotCount, slotRange]
  );

  return (
    <div className="max-h-[calc(100vh-12rem)] overflow-auto rounded-xl border border-slate-200 bg-white">
      <div className="min-w-[760px]">
        {/* Header row: weekday + date */}
        <div
          className="sticky top-0 z-20 flex border-b border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.06)]"
          style={{ paddingLeft: TIME_COL_PX }}
        >
          {weekDates.map((date) => {
            const key = toDateKey(date);
            const today = isTodayKey(key);
            return (
              <div
                key={key}
                className={`flex-1 border-l border-slate-100 px-2 py-2 text-center ${
                  today ? "bg-sky-50" : ""
                }`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    today ? "text-sky-700" : "text-slate-500"
                  }`}
                >
                  {weekdayLabel(weekDates.indexOf(date))}
                </p>
                <p
                  className={`text-sm font-semibold ${
                    today ? "text-sky-700" : "text-slate-800"
                  }`}
                >
                  {formatDateShort(date)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Body: time axis + day columns */}
        <div className="flex">
          {/* Time axis */}
          <div className="relative shrink-0" style={{ width: TIME_COL_PX, height: columnHeight }}>
            {slots.map((min, idx) => {
              const onHour = min % 60 === 0;
              if (!onHour && slotMinutes < 60 && min % 30 !== 0) return null;
              return (
                <div
                  key={min}
                  className={`absolute right-1 -translate-y-1/2 text-[10px] font-medium ${
                    onHour ? "text-slate-500" : "text-slate-300"
                  }`}
                  style={{ top: idx * SLOT_PX }}
                >
                  {formatMinutes(min)}
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {weekDates.map((date) => {
            const dayKey = toDateKey(date);
            const dayBlocks = blocksByDay.get(dayKey) ?? [];
            const today = isTodayKey(dayKey);
            const showDrag = drag && drag.dayKey === dayKey;
            return (
              <div
                key={dayKey}
                data-day-column
                className={`relative flex-1 border-l border-slate-100 ${
                  today ? "bg-sky-50/40" : ""
                } ${editable ? "cursor-pointer" : ""}`}
                style={{ height: columnHeight }}
                onPointerDown={(e) => handleColumnPointerDown(e, dayKey)}
              >
                {/* Slot gridlines */}
                {slots.map((min, idx) => (
                  <div
                    key={min}
                    className={`absolute left-0 right-0 ${
                      min % 60 === 0 ? "border-t border-slate-200" : "border-t border-slate-100"
                    }`}
                    style={{ top: idx * SLOT_PX, height: SLOT_PX }}
                  />
                ))}

                {/* Create-drag preview */}
                {showDrag && (
                  <div
                    className="pointer-events-none absolute left-0.5 right-0.5 z-10 rounded-md border-2 border-dashed border-sky-400 bg-sky-200/40"
                    style={{
                      top: drag!.lo * SLOT_PX + 1,
                      height: (drag!.hi - drag!.lo + 1) * SLOT_PX - 2,
                    }}
                  />
                )}

                {/* Blocks */}
                {dayBlocks.map((block) => {
                  const dragging = blockDrag?.blockId === block.id;
                  const lo = dragging ? blockDrag!.lo : slotRange(block).lo;
                  const hi = dragging ? blockDrag!.hi : slotRange(block).hi;
                  const top = lo * SLOT_PX;
                  const height = (hi - lo) * SLOT_PX;
                  const startMin = windowStart + lo * slotMinutes;
                  const endMin = windowStart + hi * slotMinutes;
                  return (
                    <div
                      key={block.id}
                      onPointerDown={(e) => startBlockDrag(e, block, "move")}
                      className={`group absolute left-0.5 right-0.5 z-10 overflow-hidden rounded-md border px-1.5 py-1 text-left transition ${ratingTileClasses(
                        block.rating
                      )} ${editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${
                        dragging ? "z-30 shadow-lg ring-2 ring-sky-400" : ""
                      }`}
                      style={{ top: top + 1, height: Math.max(SLOT_PX - 2, height - 2) }}
                    >
                      {/* Resize handle: top */}
                      {editable && (
                        <div
                          onPointerDown={(e) => startBlockDrag(e, block, "resize-top")}
                          className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize"
                        />
                      )}

                      <span className="pointer-events-none flex items-center gap-1">
                        <span
                          className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${ratingDotClasses(
                            block.rating
                          )}`}
                        />
                        <span className="truncate text-[11px] font-semibold leading-tight">
                          {block.title || "Untitled"}
                        </span>
                      </span>
                      {height >= SLOT_PX * 2 && (
                        <span className="pointer-events-none mt-0.5 block truncate text-[10px] opacity-70">
                          {formatMinutes(startMin)} – {formatMinutes(endMin)}
                        </span>
                      )}
                      {block.category && height >= SLOT_PX * 3 && (
                        <span className="pointer-events-none mt-0.5 block truncate text-[10px] font-medium opacity-80">
                          {block.category}
                        </span>
                      )}

                      {/* Resize handle: bottom */}
                      {editable && (
                        <div
                          onPointerDown={(e) => startBlockDrag(e, block, "resize-bottom")}
                          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
