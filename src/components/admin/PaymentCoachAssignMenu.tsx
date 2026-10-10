"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { formatDateDisplay } from "@/lib/formatDateDisplay";
import { formatPersonName } from "@/lib/formatPersonName";
import {
  paymentCoachAssignName,
  sortPaymentCoachesForAssign,
  type PaymentCoachAssignSort,
} from "@/lib/paymentCoachAssignSort";

export type PaymentCoachAssignMenuCoach = {
  id: string;
  slug: string;
  full_name: string | null;
  joined_at: string | null;
};

type Props = {
  coaches: PaymentCoachAssignMenuCoach[];
  selectedCoachId: string | null;
  open: boolean;
  disabled?: boolean;
  sort: PaymentCoachAssignSort;
  onSortChange: (sort: PaymentCoachAssignSort) => void;
  onOpenChange: (open: boolean) => void;
  onSelect: (coachId: string | null) => void;
  ariaLabel: string;
  variant: "unassigned" | "change";
};

function formatJoinDate(value: string | null): string | null {
  if (!value) return null;
  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return formatDateDisplay(date);
}

const PANEL_WIDTH = 288;

export function PaymentCoachAssignMenu({
  coaches,
  selectedCoachId,
  open,
  disabled = false,
  sort,
  onSortChange,
  onOpenChange,
  onSelect,
  ariaLabel,
  variant,
}: Props) {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [panelStyle, setPanelStyle] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const sortedCoaches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? coaches.filter((coach) =>
          paymentCoachAssignName(coach, formatPersonName)
            .toLowerCase()
            .includes(needle)
        )
      : coaches;
    return sortPaymentCoachesForAssign(filtered, sort, formatPersonName);
  }, [coaches, query, sort]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setPanelStyle(null);
      return;
    }

    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 8;
      const width = Math.min(PANEL_WIDTH, window.innerWidth - margin * 2);
      let left = rect.left;
      if (left + width > window.innerWidth - margin) {
        left = window.innerWidth - margin - width;
      }
      left = Math.max(margin, left);

      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        160,
        Math.min(360, (openUp ? spaceAbove : spaceBelow) - 4)
      );
      setPanelStyle(
        openUp
          ? {
              bottom: window.innerHeight - rect.top + 4,
              left,
              width,
              maxHeight,
            }
          : {
              top: rect.bottom + 4,
              left,
              width,
              maxHeight,
            }
      );
    };

    place();
    const focusId = window.setTimeout(() => searchRef.current?.focus(), 20);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.clearTimeout(focusId);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      onOpenChange(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const panel =
    open && panelStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={ariaLabel}
            style={{
              top: panelStyle.top,
              bottom: panelStyle.bottom,
              left: panelStyle.left,
              width: panelStyle.width,
              maxHeight: panelStyle.maxHeight,
            }}
            className="fixed z-[220] flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            <div className="shrink-0 border-b border-slate-100 p-2">
              <div
                className="grid grid-cols-2 border-b border-slate-200"
                role="tablist"
                aria-label="Coach list order"
              >
                {(
                  [
                    ["az", "A–Z"],
                    ["joined", "Join date"],
                  ] as const
                ).map(([value, label]) => {
                  const selected = sort === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => onSortChange(value)}
                      className={`border-b-2 px-2 py-1.5 text-xs font-semibold ${
                        selected
                          ? "border-[#0c5290] text-[#0c5290]"
                          : "border-transparent text-slate-800 hover:text-[#0c5290]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search coaches"
                aria-label="Search coaches"
                className="mt-2 block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0c5290] focus:ring-1 focus:ring-[#0c5290]"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              <button
                type="button"
                onClick={() => onSelect(null)}
                className={`flex w-full items-center bg-white px-3 py-1.5 text-left text-sm hover:text-[#0c5290] ${
                  selectedCoachId
                    ? "font-normal text-slate-900"
                    : "font-semibold text-[#0c5290]"
                }`}
              >
                Unassigned
              </button>
              {sortedCoaches.length === 0 ? (
                <p className="bg-white px-3 py-2 text-sm text-slate-900">No coaches match.</p>
              ) : (
                sortedCoaches.map((coach) => {
                  const name = paymentCoachAssignName(coach, formatPersonName);
                  const joinDate = formatJoinDate(coach.joined_at);
                  const selected = coach.id === selectedCoachId;
                  return (
                    <button
                      key={coach.id}
                      type="button"
                      onClick={() => onSelect(coach.id)}
                      className="group flex w-full items-baseline justify-between gap-3 bg-white px-3 py-1.5 text-left text-sm"
                    >
                      <span
                        className={`min-w-0 truncate group-hover:text-[#0c5290] ${
                          selected ? "font-semibold text-[#0c5290]" : "text-slate-900"
                        }`}
                      >
                        {name}
                      </span>
                      {joinDate ? (
                        <span className="shrink-0 text-xs font-normal text-slate-600 group-hover:text-[#0c5290]">
                          {joinDate}
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel}
        title={variant === "change" ? "Change coach" : "Assign coach"}
        onClick={() => onOpenChange(!open)}
        className={
          variant === "unassigned"
            ? "inline-flex items-center gap-0.5 rounded text-sm text-slate-400 hover:text-slate-600 disabled:cursor-wait disabled:opacity-60"
            : "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
        }
      >
        {variant === "unassigned" ? <span>Unassigned</span> : null}
        <span
          className={
            variant === "unassigned"
              ? "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-slate-100"
              : "inline-flex h-5 w-5 items-center justify-center"
          }
        >
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden />
        </span>
      </button>
      {panel}
    </>
  );
}
