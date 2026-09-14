"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeaderUnderlineTabs } from "@/components/layout/PageHeaderUnderlineTabs";
import { BookCallFromListModal } from "@/components/calls/BookCallFromListModal";
import { BookProspectModal } from "@/components/prospects/BookProspectModal";
import { CallsTable } from "@/components/calls/CallsTable";
import type { ProspectRow } from "@/lib/prospectRow";
import { CallsWeekView } from "@/components/calls/CallsWeekView";
import { CallsCalendarSettings } from "@/components/calls/CallsCalendarSettings";
import { CallsManageView } from "@/components/calls/CallsManageView";
import { GoogleCalendarBookingCard } from "@/components/booking/GoogleCalendarBookingCard";
import { BookingCalendarProviderCard } from "@/components/settings/BookingCalendarProviderCard";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { CallRow } from "@/lib/callRow";
import type {
  CalendarFilterItem,
  CalendarViewType,
} from "@/lib/calls/calendarView";
import type { CoachCalendarRow } from "@/lib/booking/coachCalendars";
import {
  callStatusClass,
  formatCallWhen,
  getCallDisplayName,
  getCallStatusLabel,
} from "@/lib/callStatusUi";
import { supabaseClient } from "@/lib/supabaseClient";
import { defaultCommunityCalendarTimezone } from "@/lib/communityCalendarTimezones";

type HubTab = "calendar" | "list" | "settings";

function parseCallsHubTab(raw: string | null): HubTab {
  if (raw === "settings" || raw === "calendars") return "settings";
  if (raw === "list") return "list";
  return "calendar";
}

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

export function CallsHub({
  calls,
  loading,
  error,
  showCoachColumn = false,
  appOrigin,
  callsBasePath,
  onRowClick,
  onCallsChange,
  coachFilterOptions,
  coachFilter,
  onCoachFilterChange,
  emptyMessage,
}: Props) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { impersonatingCoachId } = useImpersonation();
  const onAdminPath = pathname.startsWith("/admin");
  const [isAdminUser, setIsAdminUser] = useState(onAdminPath);
  const tab = parseCallsHubTab(searchParams.get("tab"));
  const selectedCalendarSlug = searchParams.get("calendar")?.trim() || null;
  const calendarEditorOpen = tab === "settings" && Boolean(selectedCalendarSlug);
  const [manageOpen, setManageOpen] = useState(true);
  const [viewType, setViewType] = useState<CalendarViewType>("all");
  const [selectedCalendars, setSelectedCalendars] = useState<Set<string>>(
    () => new Set()
  );
  const [bookingCalendars, setBookingCalendars] = useState<CoachCalendarRow[]>(
    []
  );
  const [calendarsLoading, setCalendarsLoading] = useState(true);
  const [detail, setDetail] = useState<CallRow | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [bookProspect, setBookProspect] = useState<ProspectRow | null>(null);

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
    let cancelled = false;
    setCalendarsLoading(true);
    void (async () => {
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) {
        if (!cancelled) setCalendarsLoading(false);
        return;
      }
      const res = await fetch("/api/coach/calendars", { headers });
      const body = (await res.json().catch(() => ({}))) as {
        calendars?: CoachCalendarRow[];
      };
      if (cancelled) return;
      setBookingCalendars(res.ok && Array.isArray(body.calendars) ? body.calendars : []);
      setCalendarsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId]);

  function setTab(next: HubTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("calendar");
    if (next === "calendar") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const calendarFilters = useMemo<CalendarFilterItem[]>(() => {
    const byName = new Map<string, CalendarFilterItem>();
    const booking = [...bookingCalendars].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    );
    for (const cal of booking) {
      const name = cal.name.trim();
      if (!name) continue;
      byName.set(name, { name, enabled: cal.is_enabled });
    }
    for (const row of calls) {
      const name = row.calendar_name?.trim() || row.title?.trim();
      if (!name || byName.has(name)) continue;
      byName.set(name, { name, enabled: true });
    }
    return Array.from(byName.values());
  }, [bookingCalendars, calls]);

  const offeredCalendarNames = useRef(new Set<string>());
  useEffect(() => {
    const toSelect: string[] = [];
    for (const item of calendarFilters) {
      if (offeredCalendarNames.current.has(item.name)) continue;
      offeredCalendarNames.current.add(item.name);
      if (item.enabled) toSelect.push(item.name);
    }
    if (toSelect.length === 0) return;
    setSelectedCalendars((prev) => {
      const next = new Set(prev);
      for (const name of toSelect) next.add(name);
      return next;
    });
  }, [calendarFilters]);

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
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) {
        setStatusBusy(false);
        return;
      }
      const res = await fetch(
        `/api/coach/bookings/${encodeURIComponent(row.id)}`,
        {
          method: "PATCH",
          headers,
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
    [calls, impersonatingCoachId, onCallsChange]
  );

  const openCallDetail = useCallback(
    async (row: CallRow) => {
      setDetail(row);
      if (row.source !== "native") return;
      const headers = await getCoachAuthHeaders(impersonatingCoachId);
      if (!headers) return;
      try {
        const res = await fetch(`/api/coach/bookings/${row.id}`, { headers });
        const body = (await res.json().catch(() => ({}))) as {
          booking?: {
            zoom_recording_url?: string | null;
            zoom_transcript_text?: string | null;
          };
        };
        if (!res.ok || !body.booking) return;
        setDetail((current) =>
          current?.id === row.id
            ? {
                ...current,
                zoom_recording_url:
                  body.booking?.zoom_recording_url ?? current.zoom_recording_url,
                zoom_transcript_text:
                  body.booking?.zoom_transcript_text ??
                  current.zoom_transcript_text,
              }
            : current
        );
      } catch {
        /* keep the row we already have */
      }
    },
    [impersonatingCoachId]
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

  const tabItems = [
    {
      kind: "button" as const,
      id: "calendar",
      label: "Calendar",
      active: tab === "calendar",
      onClick: () => setTab("calendar"),
    },
    {
      kind: "button" as const,
      id: "list",
      label: "Call list",
      active: tab === "list",
      onClick: () => setTab("list"),
    },
    {
      kind: "button" as const,
      id: "settings",
      label: "Settings",
      active: tab === "settings",
      onClick: () => setTab("settings"),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="border-b border-slate-200">
        <PageHeaderUnderlineTabs
          placement="content"
          ariaLabel="Calls sections"
          items={tabItems}
        />
      </div>

      {tab === "calendar" ? (
        <div className="flex flex-col gap-4">
          {!manageOpen ? (
            <button
              type="button"
              className="self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm lg:hidden"
              onClick={() => setManageOpen(true)}
            >
              Manage view
            </button>
          ) : null}
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
                viewType={viewType}
                settingsHref={`${callsBasePath}?tab=settings`}
                onSelectCall={(row) => {
                  void openCallDetail(row);
                }}
              />
            )}
          </div>
          <CallsManageView
            open={manageOpen}
            onClose={() => setManageOpen(false)}
            calendars={calendarFilters}
            calendarsLoading={calendarsLoading}
            settingsHref={`${callsBasePath}?tab=settings`}
            selectedCalendars={selectedCalendars}
            onToggleCalendar={toggleCalendar}
            viewType={viewType}
            onViewTypeChange={setViewType}
            showCoachFilter={Boolean(
              showCoachColumn && coachFilterOptions && onCoachFilterChange
            )}
            coachFilterOptions={coachFilterOptions}
            coachFilter={coachFilter}
            onCoachFilterChange={onCoachFilterChange}
          />
          </div>
        </div>
      ) : null}

      {tab === "list" ? (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setBookPickerOpen(true)}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Book a call
            </button>
          </div>
          {callList}
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="flex w-full min-w-0 flex-col gap-4">
          {!calendarEditorOpen && onAdminPath && !impersonatingCoachId ? (
            <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              These are{" "}
              <span className="font-medium text-slate-800">
                your personal booking calendars
              </span>{" "}
              (same system coaches use). Team support-call pages are managed
              under{" "}
              <a
                href="/admin/support?tab=settings"
                className="font-medium text-sky-700 hover:underline"
              >
                Support → Settings
              </a>
              .
            </p>
          ) : null}
          <CallsCalendarSettings
            appOrigin={appOrigin}
            callsBasePath={callsBasePath}
            selectedCalendarSlug={selectedCalendarSlug}
            sidebarTop={
              calendarEditorOpen ? null : (
                <Suspense
                  fallback={
                    <section className="rounded-xl border border-slate-200/80 bg-white p-4">
                      <p className="text-sm text-slate-600">
                        Loading integrations…
                      </p>
                    </section>
                  }
                >
                  <GoogleCalendarBookingCard
                    returnTo={`${callsBasePath}?tab=settings`}
                  />
                </Suspense>
              )
            }
            sidebarBottom={
              calendarEditorOpen ? null : (
                <BookingCalendarProviderCard compact />
              )
            }
          />
        </div>
      ) : null}

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
                Join meeting
              </a>
            ) : null}
            {detail.zoom_recording_url ? (
              <a
                href={detail.zoom_recording_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-sm font-semibold text-sky-700 hover:underline"
              >
                Watch recording
              </a>
            ) : null}
            {detail.zoom_transcript_text ? (
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                {detail.zoom_transcript_text}
              </pre>
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

      <BookCallFromListModal
        open={bookPickerOpen}
        onClose={() => setBookPickerOpen(false)}
        onPick={(prospect) => {
          setBookPickerOpen(false);
          setBookProspect(prospect);
        }}
      />
      <BookProspectModal
        prospect={bookProspect}
        onClose={() => setBookProspect(null)}
        onBooked={(row, nextCall) => {
          const added: CallRow = {
            id: `${row.id}:${nextCall.start_time}`,
            contact_id: row.id,
            coach_id: row.coach_id ?? null,
            coach_name: row.coach_name ?? null,
            coach_business_name: row.coach_business_name ?? null,
            prospect_name: row.full_name,
            prospect_email: row.email,
            prospect_phone: row.phone,
            business_name: row.business_name,
            calendar_name: nextCall.calendar_name,
            calendar_id: null,
            calendar_slug: null,
            title: nextCall.title,
            status_normalized: nextCall.status_normalized || "confirmed",
            status_raw: "booked",
            start_time: nextCall.start_time,
            end_time: null,
            match_status: "matched",
            source: "native",
            meeting_join_url: null,
            zoom_recording_url: null,
            zoom_transcript_text: null,
          };
          onCallsChange?.([added, ...calls]);
          setBookProspect(null);
        }}
      />
    </div>
  );
}
