"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { usePathname } from "next/navigation";
import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";
import { CallsTable } from "@/components/calls/CallsTable";
import { CallsWeekView } from "@/components/calls/CallsWeekView";
import type { CallRow } from "@/lib/callRow";
import {
  callStatusClass,
  formatCallWhen,
  getCallDisplayName,
  getCallStatusLabel,
} from "@/lib/callStatusUi";
import { supabaseClient } from "@/lib/supabaseClient";
import { defaultCommunityCalendarTimezone } from "@/lib/communityCalendarTimezones";

type HubTab = "calendar" | "list";

type Props = {
  calls: CallRow[];
  loading: boolean;
  error: string | null;
  showCoachColumn?: boolean;
  appOrigin: string;
  callsBasePath: "/coach/calls" | "/admin/calls";
  onRowClick?: (row: CallRow) => void;
  onCallsChange?: (rows: CallRow[]) => void;
  coachFilterOptions?: Array<{ id: string; label: string }>;
  coachFilter?: string | "all";
  onCoachFilterChange?: (coachId: string | "all") => void;
  emptyMessage?: string;
};

function previewTabLabel(label: string): ReactNode {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Lock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      <span className="sr-only">(admin preview — not released to coaches)</span>
    </span>
  );
}

export function CallsHub({
  calls,
  loading,
  error,
  showCoachColumn = false,
  appOrigin: _appOrigin,
  callsBasePath: _callsBasePath,
  onRowClick,
  onCallsChange,
  coachFilterOptions,
  coachFilter,
  onCoachFilterChange,
  emptyMessage,
}: Props) {
  const pathname = usePathname() ?? "";
  const onAdminPath = pathname.startsWith("/admin");
  const [isAdminUser, setIsAdminUser] = useState(onAdminPath);
  const [tab, setTab] = useState<HubTab>("list");
  const [manageOpen, setManageOpen] = useState(true);
  const [selectedCalendars, setSelectedCalendars] = useState<Set<string>>(
    () => new Set()
  );
  const [detail, setDetail] = useState<CallRow | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => {
    if (onAdminPath) {
      setIsAdminUser(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user || cancelled) return;
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as {
        role?: string;
      };
      if (!cancelled) {
        setIsAdminUser(roleBody.role === "admin");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onAdminPath]);

  useEffect(() => {
    if (!isAdminUser && tab === "calendar") {
      setTab("list");
    }
  }, [isAdminUser, tab]);

  const calendarNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of calls) {
      const n = c.calendar_name?.trim() || c.title?.trim();
      if (n) names.add(n);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [calls]);

  useEffect(() => {
    if (selectedCalendars.size === 0 && calendarNames.length > 0) {
      setSelectedCalendars(new Set(calendarNames));
    }
  }, [calendarNames, selectedCalendars.size]);

  const timezone = defaultCommunityCalendarTimezone();

  const selectedCoachIds = useMemo(() => {
    if (!showCoachColumn) return null;
    if (!coachFilter || coachFilter === "all") return null;
    return new Set([coachFilter]);
  }, [showCoachColumn, coachFilter]);

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
      setDetail((d) =>
        d?.id === row.id
          ? { ...d, status_normalized: uiStatus, status_raw: status }
          : d
      );
    },
    [calls, onCallsChange]
  );

  function toggleCalendar(name: string) {
    setSelectedCalendars((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const listFiltered = useMemo(() => {
    if (!isAdminUser || selectedCalendars.size === 0) return calls;
    return calls.filter((c) => {
      const n = c.calendar_name ?? c.title ?? "";
      return selectedCalendars.has(n);
    });
  }, [calls, selectedCalendars, isAdminUser]);

  const callList = (
    <CallsTable
      calls={listFiltered}
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

  if (!isAdminUser) {
    return callList;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeaderUnderlineTabs
        ariaLabel="Calls sections"
        items={[
          {
            kind: "button",
            id: "list",
            label: "Call list",
            active: tab === "list",
            onClick: () => setTab("list"),
          },
          {
            kind: "button",
            id: "calendar",
            label: previewTabLabel("Calendar view"),
            active: tab === "calendar",
            onClick: () => setTab("calendar"),
            variant: "subtle",
          },
        ]}
      />

      {tab === "calendar" ? (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="min-w-0 flex-1">
            {loading ? (
              <p className="text-sm text-slate-600">Loading…</p>
            ) : (
              <CallsWeekView
                calls={calls}
                timezone={timezone}
                selectedCalendarNames={selectedCalendars}
                selectedCoachIds={selectedCoachIds}
                onSelectCall={(row) => {
                  setDetail(row);
                }}
              />
            )}
          </div>
          <aside
            className={`w-full shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:w-64 ${
              manageOpen ? "" : "hidden lg:block"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Manage view
              </h3>
              <button
                type="button"
                className="text-xs text-slate-500 lg:hidden"
                onClick={() => setManageOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">
              Calendars
            </p>
            <ul className="mt-2 space-y-2">
              {calendarNames.map((name) => (
                <li key={name}>
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-sky-600"
                      checked={selectedCalendars.has(name)}
                      onChange={() => toggleCalendar(name)}
                    />
                    <span className="truncate">{name}</span>
                  </label>
                </li>
              ))}
              {calendarNames.length === 0 ? (
                <li className="text-xs text-slate-400">No calendars yet</li>
              ) : null}
            </ul>
            {showCoachColumn && coachFilterOptions && onCoachFilterChange ? (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Coaches
                </p>
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  value={coachFilter ?? "all"}
                  onChange={(e) =>
                    onCoachFilterChange(
                      e.target.value === "all" ? "all" : e.target.value
                    )
                  }
                >
                  <option value="all">All coaches</option>
                  {coachFilterOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="mt-4 space-y-1 text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> Confirmed
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />{" "}
                Completed
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> No-show
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Cancelled
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {tab === "list" ? callList : null}

      {detail ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">
              {getCallDisplayName(detail)}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{detail.prospect_name}</p>
            <p className="mt-3 text-sm text-slate-700">
              {formatCallWhen(detail.start_time) ?? "—"}
            </p>
            <p className="mt-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${callStatusClass(
                  detail.status_normalized
                )}`}
              >
                {getCallStatusLabel(detail.status_normalized)}
              </span>
            </p>
            {detail.meeting_join_url ? (
              <a
                href={detail.meeting_join_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm font-semibold text-sky-700 hover:underline"
              >
                Join Google Meet
              </a>
            ) : null}
            {detail.prospect_email ? (
              <p className="mt-2 text-sm text-slate-600">{detail.prospect_email}</p>
            ) : null}
            {detail.source === "native" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {(
                  [
                    ["booked", "Confirmed"],
                    ["completed", "Completed"],
                    ["noshow", "No-show"],
                    ["cancelled", "Cancelled"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={statusBusy}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    onClick={() => void updateNativeStatus(detail, value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              className="mt-5 w-full rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white"
              onClick={() => {
                onRowClick?.(detail);
                setDetail(null);
              }}
            >
              {detail.contact_id ? "Open contact" : "Close"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
