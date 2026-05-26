"use client";

import { useEffect, useRef, useState } from "react";
import {
  PROSPECT_STATUS_OPTIONS,
  prospectStatusBadgeClass,
  resolveAutoProspectStatus,
  type ProspectStatusDisplay,
  type ProspectStatusValue,
} from "@/lib/prospectStatus";
import type { ProspectRow } from "@/lib/prospectRow";

type Props = {
  row: ProspectRow;
  editable?: boolean;
  saving?: boolean;
  onSave: (prospect_status: string | null) => void | Promise<void>;
};

export function ProspectStatusCell({
  row,
  editable = false,
  saving = false,
  onSave,
}: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function renderBadge(status: ProspectStatusDisplay) {
    return (
      <span
        className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium leading-none ${prospectStatusBadgeClass(status.value)}`}
      >
        {status.label}
      </span>
    );
  }

  async function chooseStatus(value: ProspectStatusValue | "auto") {
    setOpen(false);
    if (value === "auto") {
      await onSave(null);
      return;
    }
    await onSave(value);
  }

  if (!editable) {
    return renderBadge(row.status);
  }

  const autoValue = resolveAutoProspectStatus({
    prospect_status: null,
    last_completed_at: row.last_assessed_at,
    next_call: row.next_call,
    last_past_call_status: undefined,
    next_action: row.next_action,
  });

  return (
    <div ref={menuRef} className="relative" data-row-action>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="rounded outline-none focus:ring-2 focus:ring-sky-500"
        title={row.status.isAuto ? "Auto status — click to override" : "Click to change status"}
      >
        {renderBadge(row.status)}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-[100] mt-1 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {!row.status.isAuto ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50"
              onClick={() => void chooseStatus("auto")}
            >
              Use auto ({PROSPECT_STATUS_OPTIONS.find((o) => o.value === autoValue)?.label})
            </button>
          ) : null}
          {PROSPECT_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50 ${row.status.value === option.value && !row.status.isAuto ? "bg-sky-50 font-medium text-sky-800" : "text-slate-700"}`}
              onClick={() => void chooseStatus(option.value)}
            >
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${prospectStatusBadgeClass(option.value)}`}
              >
                {option.label}
              </span>
            </button>
          ))}
          {saving ? (
            <p className="px-3 py-1 text-[10px] text-slate-400">Saving…</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
