"use client";

import { useCallback, useState } from "react";
import { CallsTable } from "@/components/calls/CallsTable";
import type { CallRow } from "@/lib/callRow";
import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  calls: CallRow[];
  loading: boolean;
  error: string | null;
  showCoachColumn?: boolean;
  onRowClick?: (row: CallRow) => void;
  onCallsChange?: (rows: CallRow[]) => void;
  coachFilterOptions?: Array<{ id: string; label: string }>;
  coachFilter?: string | "all";
  onCoachFilterChange?: (coachId: string | "all") => void;
  emptyMessage?: string;
};

export function CallsHub({
  calls,
  loading,
  error,
  showCoachColumn = false,
  onRowClick,
  onCallsChange,
  coachFilterOptions,
  coachFilter,
  onCoachFilterChange,
  emptyMessage,
}: Props) {
  const [statusBusy, setStatusBusy] = useState(false);

  const updateNativeStatus = useCallback(
    async (row: CallRow, status: "booked" | "cancelled" | "completed" | "noshow") => {
      if (row.source !== "native") return;
      setStatusBusy(true);
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setStatusBusy(false);
        return;
      }
      const res = await fetch(
        `/api/coach/bookings/${encodeURIComponent(row.id)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );
      setStatusBusy(false);
      if (!res.ok) return;

      const uiStatus =
        status === "booked"
          ? "confirmed"
          : status === "completed"
            ? "completed"
            : status;

      const next = calls.map((c) =>
        c.id === row.id
          ? {
              ...c,
              status_normalized: uiStatus,
              status_raw: status,
            }
          : c
      );
      onCallsChange?.(next);
    },
    [calls, onCallsChange]
  );

  return (
    <CallsTable
      calls={calls}
      loading={loading}
      error={error}
      showCoachColumn={showCoachColumn}
      onRowClick={onRowClick}
      emptyMessage={emptyMessage}
      coachFilterOptions={coachFilterOptions}
      coachFilter={coachFilter}
      onCoachFilterChange={onCoachFilterChange}
      renderRowActions={(row) =>
        row.source === "native" ? (
          <select
            className="rounded border border-slate-200 px-1.5 py-1 text-xs"
            disabled={statusBusy}
            value={
              row.status_normalized === "confirmed"
                ? "booked"
                : row.status_normalized === "completed"
                  ? "completed"
                  : row.status_normalized
            }
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = e.target.value as
                | "booked"
                | "cancelled"
                | "completed"
                | "noshow";
              void updateNativeStatus(row, v);
            }}
          >
            <option value="booked">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="noshow">No-show</option>
            <option value="cancelled">Cancelled</option>
          </select>
        ) : null
      }
    />
  );
}
