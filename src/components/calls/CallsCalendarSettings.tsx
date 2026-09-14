"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  MoreVertical,
  Pencil,
  Share,
  Trash2,
} from "lucide-react";
import { CallsCalendarEditor } from "@/components/calls/CallsCalendarEditor";
import { WeeklyHoursEditor } from "@/components/booking/WeeklyHoursEditor";
import type { AvailabilityRuleRow } from "@/lib/booking/computeBookingSlots";
import type { CoachCalendarRow } from "@/lib/booking/coachCalendars";
import { DEFAULT_WEEKDAY_AVAILABILITY } from "@/lib/booking/computeBookingSlots";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

function CalendarToggle({
  on,
  disabled,
  busy,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Turn calendar off" : "Turn calendar on"}
      disabled={disabled || busy}
      onClick={onChange}
      className={`relative h-6 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 focus-visible:ring-offset-2 disabled:opacity-40 ${
        on ? "bg-emerald-700" : "bg-slate-200"
      }`}
    >
      {on ? (
        <span
          className="pointer-events-none absolute top-1/2 left-[6px] -translate-y-1/2 text-[10px] font-bold tracking-wide text-white"
          aria-hidden
        >
          On
        </span>
      ) : null}
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          on ? "translate-x-6" : ""
        }`}
      />
    </button>
  );
}

function CalendarRowMenu({
  open,
  onOpenChange,
  onEdit,
  onDelete,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null
  );

  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        onOpenChange(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    function onReposition() {
      const next = buttonRef.current?.getBoundingClientRect();
      if (next) {
        setMenuPos({
          top: next.bottom + 4,
          right: window.innerWidth - next.right,
        });
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="relative flex justify-end">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Calendar actions"
        disabled={busy}
        onClick={() => onOpenChange(!open)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600/40 focus-visible:ring-offset-2"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {open && menuPos ? (
        <div
          id={menuId}
          role="menu"
          style={{ top: menuPos.top, right: menuPos.right }}
          className="fixed z-50 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              onOpenChange(false);
              onEdit();
            }}
          >
            <Pencil className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-40"
            onClick={() => {
              onOpenChange(false);
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-400" aria-hidden />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  appOrigin: string;
  callsBasePath: "/coach/calls" | "/admin/calls";
  /**
   * Admin support-call setup: load/save calendars for this host slug
   * (zander / pam). Omit for the signed-in user.
   */
  forSlug?: string | null;
  /** When set, only these calendar slugs are shown (e.g. `["support"]`). */
  calendarSlugFilter?: string[] | null;
  /** Hide the shared weekly hours editor (when parent owns that UI). */
  hideHours?: boolean;
  /** Hide the booking calendars list (when parent owns that UI). */
  hideCalendars?: boolean;
  /** Hide the reminder sequence editor. */
  hideReminders?: boolean;
  /** Override weekly hours card title. */
  hoursTitle?: string;
  /** Override weekly hours card hint. */
  hoursHint?: string;
  /** Open this calendar as its own editor screen. */
  selectedCalendarSlug?: string | null;
  /** Right-column content above weekly hours (e.g. integrations). */
  sidebarTop?: ReactNode;
  /** Right-column content below weekly hours (e.g. calendar provider). */
  sidebarBottom?: ReactNode;
};

export function CallsCalendarSettings({
  appOrigin,
  callsBasePath,
  forSlug = null,
  calendarSlugFilter = null,
  hideHours = false,
  hideCalendars = false,
  hideReminders = false,
  hoursTitle = "Weekly hours",
  hoursHint,
  selectedCalendarSlug = null,
  sidebarTop = null,
  sidebarBottom = null,
}: Props) {
  const router = useRouter();
  const { impersonatingCoachId } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("Europe/London");
  const [rules, setRules] = useState<AvailabilityRuleRow[]>([]);
  const [calendars, setCalendars] = useState<CoachCalendarRow[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const authHeaders = useCallback(
    () => getCoachAuthHeaders(impersonatingCoachId),
    [impersonatingCoachId]
  );

  const settingsListHref = `${callsBasePath}?tab=settings`;

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    const qs =
      forSlug && forSlug.trim()
        ? `?forSlug=${encodeURIComponent(forSlug.trim())}`
        : "";
    const res = await fetch(`/api/coach/calendars${qs}`, { headers });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      slug?: string;
      timezone?: string;
      rules?: AvailabilityRuleRow[];
      calendars?: CoachCalendarRow[];
    };
    if (!res.ok) {
      setError(body.error ?? "Could not load calendars.");
      setLoading(false);
      return;
    }
    setSlug(body.slug ?? null);
    setTimezone(body.timezone ?? "Europe/London");
    setRules(
      body.rules && body.rules.length > 0
        ? body.rules
        : DEFAULT_WEEKDAY_AVAILABILITY.map((r) => ({ ...r }))
    );
    const all = body.calendars ?? [];
    const filter = calendarSlugFilter?.map((s) => s.trim().toLowerCase()) ?? null;
    setCalendars(
      filter && filter.length > 0
        ? all.filter((c) => filter.includes(c.slug.toLowerCase()))
        : all
    );

    setLoading(false);
  }, [authHeaders, forSlug, calendarSlugFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveShared() {
    setSaving(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }
    const res = await fetch("/api/coach/calendars", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        timezone,
        rules,
        ...(forSlug?.trim() ? { forSlug: forSlug.trim() } : {}),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Save failed.");
      return;
    }
    void load();
  }

  async function patchCalendar(id: string, patch: Partial<CoachCalendarRow>) {
    setBusy(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setBusy(false);
      setError("Not signed in.");
      return;
    }
    const res = await fetch(`/api/coach/calendars/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        ...patch,
        ...(forSlug?.trim() ? { forSlug: forSlug.trim() } : {}),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not update calendar.");
      void load();
      return;
    }
    const body = (await res.json()) as { calendar?: CoachCalendarRow };
    if (body.calendar) {
      setCalendars((prev) =>
        prev.map((c) => (c.id === id ? body.calendar! : c))
      );
    } else {
      void load();
    }
  }

  function bookUrl(calendarSlug: string) {
    if (!slug) return null;
    const path =
      slug === "zander" && calendarSlug === "discovery"
        ? "/zander"
        : `/book/${encodeURIComponent(slug)}/${encodeURIComponent(calendarSlug)}`;
    return `${appOrigin.replace(/\/$/, "")}${path}`;
  }

  async function copyLink(calendarSlug: string) {
    const url = bookUrl(calendarSlug);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(calendarSlug);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }

  async function toggleEnabled(cal: CoachCalendarRow) {
    const next = !cal.is_enabled;
    setCalendars((prev) =>
      prev.map((c) =>
        c.id === cal.id
          ? { ...c, is_enabled: next, is_public: next ? true : c.is_public }
          : c
      )
    );
    await patchCalendar(cal.id, {
      is_enabled: next,
      ...(next ? { is_public: true } : {}),
    });
  }

  async function createCalendar() {
    const name = newName.trim();
    if (!name) {
      setError("Name the calendar first.");
      return;
    }
    setBusy(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setBusy(false);
      setError("Not signed in.");
      return;
    }
    const res = await fetch("/api/coach/calendars", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name,
        ...(forSlug?.trim() ? { forSlug: forSlug.trim() } : {}),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      calendar?: CoachCalendarRow;
    };
    setBusy(false);
    if (!res.ok || !body.calendar) {
      setError(body.error ?? "Could not create calendar.");
      return;
    }
    setCalendars((prev) =>
      prev.some((c) => c.id === body.calendar!.id)
        ? prev
        : [...prev, body.calendar!]
    );
    setShowCreate(false);
    setNewName("");
    router.push(
      `${settingsListHref}&calendar=${encodeURIComponent(body.calendar.slug)}`
    );
  }

  async function deleteCalendar(cal: CoachCalendarRow) {
    const extra =
      cal.slug === "discovery"
        ? " This is the calendar used after a BOSS Score."
        : "";
    const ok = window.confirm(
      `Delete “${cal.name}”?${extra} Existing bookings keep their times.`
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setBusy(false);
      setError("Not signed in.");
      return;
    }
    const qs = forSlug?.trim()
      ? `?forSlug=${encodeURIComponent(forSlug.trim())}`
      : "";
    const res = await fetch(
      `/api/coach/calendars/${encodeURIComponent(cal.id)}${qs}`,
      { method: "DELETE", headers }
    );
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not delete calendar.");
      return;
    }
    setCalendars((prev) => prev.filter((c) => c.id !== cal.id));
    setMenuOpenId(null);
  }

  function openEditor(calendarSlug: string) {
    router.push(
      `${settingsListHref}&calendar=${encodeURIComponent(calendarSlug)}`
    );
  }

  const selectedSlug = selectedCalendarSlug?.trim().toLowerCase() || null;
  const editing =
    !hideCalendars && selectedSlug
      ? calendars.find((c) => c.slug.toLowerCase() === selectedSlug) ?? null
      : null;
  const activeDays = rules.length;

  if (loading) {
    return <p className="text-sm text-slate-600">Loading calendars…</p>;
  }

  if (selectedSlug && !hideCalendars) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {editing ? (
          <CallsCalendarEditor
            calendar={editing}
            onChange={(next) =>
              setCalendars((prev) =>
                prev.map((c) => (c.id === next.id ? next : c))
              )
            }
            onSave={() =>
              void patchCalendar(editing.id, {
                name: editing.name,
                meeting_duration_minutes: editing.meeting_duration_minutes,
                min_notice_hours: editing.min_notice_hours,
                buffer_minutes: editing.buffer_minutes,
                booking_window_days: editing.booking_window_days,
                is_enabled: editing.is_enabled,
                is_public: editing.is_public,
                location_mode: editing.location_mode,
                location_phone: editing.location_phone,
                location_custom: editing.location_custom,
                reminder_sequence: editing.reminder_sequence,
              })
            }
            saving={busy}
            backHref={settingsListHref}
            bookUrl={bookUrl(editing.slug)}
            copied={copied === editing.slug}
            onCopyLink={() => void copyLink(editing.slug)}
            hideReminders={hideReminders}
          />
        ) : (
          <div className="space-y-2">
            <Link
              href={settingsListHref}
              scroll={false}
              className="text-sm font-medium text-sky-700 hover:underline"
            >
              Back to booking calendars
            </Link>
            <p className="text-sm text-slate-600">That calendar was not found.</p>
          </div>
        )}
      </div>
    );
  }

  const showSidebar = Boolean(sidebarTop || sidebarBottom || !hideHours);

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div
        className={
          !hideCalendars && showSidebar
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start"
            : "space-y-6"
        }
      >
        {!hideCalendars ? (
          <section className="min-w-0 rounded-xl border border-slate-200/80 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Booking calendars
              </h2>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setShowCreate((open) => !open);
                  setError(null);
                }}
                className="text-xs font-semibold text-sky-700 hover:text-sky-800 disabled:opacity-50"
              >
                New calendar
              </button>
            </div>

            {showCreate ? (
              <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Strategy call"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-600/20"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void createCalendar();
                    if (e.key === "Escape") setShowCreate(false);
                  }}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createCalendar()}
                  className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Create"}
                </button>
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                    <th scope="col" className="w-14 px-4 py-3 font-semibold">
                      <span className="sr-only">On or off</span>
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Calendar
                    </th>
                    <th
                      scope="col"
                      className="w-24 px-3 py-3 font-semibold"
                    >
                      Duration
                    </th>
                    <th scope="col" className="w-10 px-1 py-3 font-semibold">
                      <span className="sr-only">Share link</span>
                    </th>
                    <th scope="col" className="w-10 px-2 py-3 font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {calendars.map((cal) => (
                    <tr
                      key={cal.id}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3.5 align-middle">
                        <CalendarToggle
                          on={cal.is_enabled}
                          busy={busy}
                          onChange={() => void toggleEnabled(cal)}
                        />
                      </td>
                      <td className="min-w-0 px-3 py-3.5 align-middle">
                        <button
                          type="button"
                          onClick={() => openEditor(cal.slug)}
                          className="truncate text-sm font-semibold text-slate-900 hover:text-sky-700"
                        >
                          {cal.name}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 align-middle text-sm text-slate-600">
                        {cal.meeting_duration_minutes} min
                      </td>
                      <td className="px-1 py-3.5 align-middle">
                        <button
                          type="button"
                          aria-label={
                            copied === cal.slug
                              ? "Booking link copied"
                              : "Copy booking link"
                          }
                          onClick={() => void copyLink(cal.slug)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        >
                          {copied === cal.slug ? (
                            <Check className="h-4 w-4 text-emerald-700" aria-hidden />
                          ) : (
                            <Share className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                      </td>
                      <td className="px-2 py-3.5 align-middle">
                        <CalendarRowMenu
                          open={menuOpenId === cal.id}
                          onOpenChange={(open) =>
                            setMenuOpenId(open ? cal.id : null)
                          }
                          busy={busy}
                          onEdit={() => openEditor(cal.slug)}
                          onDelete={() => void deleteCalendar(cal)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {showSidebar ? (
          <aside className="space-y-4 lg:sticky lg:top-20">
            {sidebarTop}
            {!hideHours ? (
              <WeeklyHoursEditor
                title={hoursTitle}
                hint={
                  hoursHint ??
                  `Shared across all calendars · ${activeDays} day${
                    activeDays === 1 ? "" : "s"
                  } open`
                }
                timezone={timezone}
                onTimezoneChange={setTimezone}
                rules={rules}
                onRulesChange={setRules}
                onSave={() => void saveShared()}
                saving={saving}
              />
            ) : null}
            {sidebarBottom}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
