"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

type CalendarItem = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
  owned?: boolean;
};

type CalendarStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  outreach_account_id?: string | null;
  unipile_account_id?: string | null;
  calendars: CalendarItem[];
  busy_calendar_ids: string[];
  event_calendar_id: string;
  is_booking_source?: boolean;
  calendar_error?: string | null;
  is_self?: boolean;
  can_manage?: boolean;
};

function OutlookMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="28"
      height="28"
      aria-hidden
    >
      <rect width="24" height="24" rx="4" fill="#0A5BC4" />
      <path
        fill="#fff"
        d="M6.2 6.4h5.1c2.2 0 3.6 1.2 3.6 3.1 0 1.2-.6 2.1-1.7 2.6 1.4.4 2.2 1.5 2.2 3 0 2.2-1.6 3.5-4.1 3.5H6.2V6.4zm2.4 4.7h2.3c1 0 1.6-.5 1.6-1.3s-.6-1.3-1.6-1.3H8.6v2.6zm0 4.8h2.6c1.2 0 1.9-.5 1.9-1.5s-.7-1.4-1.9-1.4H8.6v2.9z"
      />
    </svg>
  );
}

function GoogleCalendarMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="28"
      height="28"
      aria-hidden
    >
      <path fill="#fff" d="M4 4h16v16H4z" />
      <path
        fill="#1a73e8"
        d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"
      />
      <path fill="#ea4335" d="M5 4h2v2H5zm12 0h2v2h-2z" />
      <text
        x="12"
        y="18.5"
        textAnchor="middle"
        fill="#1a73e8"
        fontSize="9"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
      >
        31
      </text>
    </svg>
  );
}

function ZoomMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="28"
      height="28"
      aria-hidden
    >
      <rect width="24" height="24" rx="4" fill="#2D8CFF" />
      <path
        fill="#fff"
        d="M6.2 8.2h7.1c.7 0 1.3.6 1.3 1.3v5c0 .7-.6 1.3-1.3 1.3H6.2c-.7 0-1.3-.6-1.3-1.3v-5c0-.7.6-1.3 1.3-1.3zm9.2 2 3.1-1.6c.4-.2.8.1.8.5v6.2c0 .4-.4.7-.8.5l-3.1-1.6v-4z"
      />
    </svg>
  );
}

function IntegrationRow({
  mark,
  title,
  subtitle,
  action,
  children,
}: {
  mark: ReactNode;
  title: string;
  subtitle: string;
  action: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="shrink-0">{mark}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="truncate text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      {children}
    </div>
  );
}

function CalendarPrefsPanel({
  status,
  busyIds,
  eventCalendarId,
  saving,
  onEventCalendarId,
  onToggleBusy,
  onSave,
  onDisconnect,
  disconnectLabel,
}: {
  status: CalendarStatus;
  busyIds: string[];
  eventCalendarId: string;
  saving: boolean;
  onEventCalendarId: (id: string) => void;
  onToggleBusy: (id: string) => void;
  onSave: () => void;
  onDisconnect: () => void;
  disconnectLabel: string;
}) {
  const [busyOpen, setBusyOpen] = useState(false);
  const writableCalendars = useMemo(
    () =>
      (status.calendars ?? []).filter(
        (c) =>
          c.owned !== false &&
          (c.accessRole === "owner" ||
            c.accessRole === "writer" ||
            c.primary)
      ),
    [status.calendars]
  );
  const busyLabel = useMemo(() => {
    const selected = (status.calendars ?? []).filter((c) =>
      busyIds.includes(c.id)
    );
    if (selected.length === 0) return "None selected";
    if (selected.length === 1) return selected[0]?.summary ?? "1 calendar";
    return `${selected.length} calendars`;
  }, [busyIds, status.calendars]);

  return (
    <div className="space-y-4 border-t border-slate-100 px-4 py-4">
      {status.calendar_error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {status.calendar_error}
        </p>
      ) : null}
      {status.is_booking_source ? (
        <p className="text-xs font-medium text-teal-700">
          Used for booking slots and meeting invites
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          Save preferences to use this account for booking.
        </p>
      )}
      <label className="block text-sm">
        <span className="font-medium text-slate-700">
          Calendar for new bookings
        </span>
        <select
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={eventCalendarId}
          onChange={(e) => onEventCalendarId(e.target.value)}
          disabled={!writableCalendars.length}
        >
          {writableCalendars.map((cal) => (
            <option key={cal.id} value={cal.id}>
              {cal.summary}
              {cal.primary ? " (primary)" : ""}
            </option>
          ))}
        </select>
      </label>
      <div>
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left"
          onClick={() => setBusyOpen((open) => !open)}
          aria-expanded={busyOpen}
        >
          {busyOpen ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800">
              Calendars that block availability
            </p>
            <p className="truncate text-xs text-slate-500">{busyLabel}</p>
          </div>
        </button>
        {busyOpen ? (
          <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
            {(status.calendars ?? []).map((cal) => (
              <li key={cal.id}>
                <label className="flex items-start gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600"
                    checked={busyIds.includes(cal.id)}
                    onChange={() => onToggleBusy(cal.id)}
                  />
                  <span className="min-w-0 break-words">
                    {cal.summary}
                    {cal.primary ? (
                      <span className="ml-1 text-xs text-slate-400">
                        (primary)
                      </span>
                    ) : null}
                    {cal.owned === false ? (
                      <span className="ml-1 text-xs text-slate-400">
                        (shared)
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving || busyIds.length === 0 || !status.calendars.length}
          onClick={onSave}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onDisconnect}
          className="text-sm font-medium text-rose-700/90 hover:text-rose-800 disabled:opacity-60"
        >
          {disconnectLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Calls → Settings integrations: Unipile Google, Unipile Outlook, Zoom.
 */
export function GoogleCalendarBookingCard({
  forSlug = null,
  returnTo: returnToProp = null,
  compact = false,
}: {
  /** Admin support-call setup: show status for this host. Connect only works for self. */
  forSlug?: string | null;
  /** After connect, return here instead of the default settings calendar tab. */
  returnTo?: string | null;
  /** Google-only card for support-call settings. */
  compact?: boolean;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { impersonatingCoachId } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState<
    "google" | "outlook" | "zoom" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [outlook, setOutlook] = useState<CalendarStatus | null>(null);
  const [zoom, setZoom] = useState<{
    configured: boolean;
    connected: boolean;
    email: string | null;
    is_self?: boolean;
    can_manage?: boolean;
  } | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [eventCalendarId, setEventCalendarId] = useState("");
  const [googleOpen, setGoogleOpen] = useState(false);
  const [outlookOpen, setOutlookOpen] = useState(false);
  const [prefsProvider, setPrefsProvider] = useState<"GOOGLE" | "OUTLOOK">(
    "GOOGLE"
  );

  const authHeaders = useCallback(
    () => getCoachAuthHeaders(impersonatingCoachId),
    [impersonatingCoachId]
  );

  const loadProvider = useCallback(
    async (provider: "GOOGLE" | "OUTLOOK") => {
      const headers = await authHeaders();
      if (!headers) {
        setError("Not signed in.");
        setLoading(false);
        return;
      }
      const params = new URLSearchParams({ provider });
      if (forSlug && forSlug.trim()) params.set("forSlug", forSlug.trim());
      const res = await fetch(
        `/api/coach/google-calendar?${params.toString()}`,
        { headers }
      );
      const body = (await res.json().catch(() => ({}))) as CalendarStatus & {
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "Could not load calendar status.");
        setLoading(false);
        return;
      }
      if (provider === "GOOGLE") {
        setStatus(body);
        if (prefsProvider !== "OUTLOOK") {
          setBusyIds(body.busy_calendar_ids ?? []);
          setEventCalendarId(body.event_calendar_id || "");
        }
      } else {
        setOutlook(body);
        if (prefsProvider === "OUTLOOK") {
          setBusyIds(body.busy_calendar_ids ?? []);
          setEventCalendarId(body.event_calendar_id || "");
        }
      }
    },
    [authHeaders, forSlug, prefsProvider]
  );

  const load = useCallback(async () => {
    await loadProvider("GOOGLE");
    if (!compact) {
      await loadProvider("OUTLOOK");
      const headers = await authHeaders();
      if (headers) {
        const res = await fetch("/api/coach/zoom", { headers });
        const body = (await res.json().catch(() => ({}))) as {
          configured?: boolean;
          connected?: boolean;
          email?: string | null;
          is_self?: boolean;
          can_manage?: boolean;
          error?: string;
        };
        if (res.ok) {
          setZoom({
            configured: body.configured !== false,
            connected: Boolean(body.connected),
            email: body.email ?? null,
            is_self: body.is_self,
            can_manage: body.can_manage,
          });
        }
      }
    }
    setLoading(false);
  }, [compact, loadProvider, authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const googleFlag = searchParams.get("google_calendar");
    const connectedFlag = searchParams.get("connected");
    const zoomFlag = searchParams.get("zoom");
    if (!googleFlag && !connectedFlag && !zoomFlag) return;

    if (googleFlag === "connected" || connectedFlag === "GOOGLE") {
      setBanner("Google connected for mail, busy times, and Meet links.");
      void (async () => {
        const headers = await authHeaders();
        if (headers) {
          await fetch("/api/coach/integrations/accounts", {
            method: "POST",
            headers,
            body: JSON.stringify({ action: "sync" }),
          });
        }
        await load();
      })();
    } else if (googleFlag) {
      setBanner(`Google connect issue: ${googleFlag.replace(/_/g, " ")}`);
    }

    if (connectedFlag === "OUTLOOK") {
      setBanner("Outlook connected for mail, busy times, and Teams links.");
      void (async () => {
        const headers = await authHeaders();
        if (headers) {
          await fetch("/api/coach/integrations/accounts", {
            method: "POST",
            headers,
            body: JSON.stringify({ action: "sync" }),
          });
        }
        await load();
      })();
    } else if (connectedFlag === "failed") {
      setBanner("Connect did not finish. Try again.");
    }

    if (zoomFlag === "connected") {
      setBanner("Zoom connected. Bookings can create a unique meeting link.");
      void load();
    } else if (zoomFlag) {
      setBanner(`Zoom connect issue: ${zoomFlag.replace(/_/g, " ")}`);
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("google_calendar");
    next.delete("connected");
    next.delete("zoom");
    if (!next.get("tab") && !pathname.includes("/support")) {
      next.set("tab", "settings");
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, pathname, router, load, authHeaders]);

  function connectReturnTo(): "calls" | "support" | "settings" {
    const dest = returnToProp?.trim() || "";
    if (dest.includes("/support") || pathname.includes("/support")) {
      return "support";
    }
    if (dest.includes("/calls") || pathname.includes("/calls")) return "calls";
    return "calls";
  }

  async function connectProvider(provider: "GOOGLE" | "OUTLOOK") {
    setConnecting(provider === "GOOGLE" ? "google" : "outlook");
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setConnecting(null);
      setError("Not signed in.");
      return;
    }
    try {
      const res = await fetch("/api/coach/integrations/accounts", {
        method: "POST",
        headers,
        body: JSON.stringify({
          provider,
          returnTo: connectReturnTo(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.url) {
        throw new Error(body.error || `Could not start ${provider} connect.`);
      }
      window.location.href = body.url;
    } catch (err) {
      setConnecting(null);
      setError(
        err instanceof Error ? err.message : `Could not connect ${provider}.`
      );
    }
  }

  async function connectZoom() {
    setConnecting("zoom");
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setConnecting(null);
      setError("Not signed in.");
      return;
    }
    try {
      const res = await fetch(
        `/api/coach/zoom/connect?returnTo=${connectReturnTo()}`,
        { headers }
      );
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.url) {
        throw new Error(body.error || "Could not start Zoom connect.");
      }
      window.location.href = body.url;
    } catch (err) {
      setConnecting(null);
      setError(err instanceof Error ? err.message : "Could not connect Zoom.");
    }
  }

  async function disconnectZoom() {
    if (!window.confirm("Disconnect Zoom? New bookings will not get a Zoom link.")) {
      return;
    }
    setSaving(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }
    const res = await fetch("/api/coach/zoom", { method: "DELETE", headers });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(body.error || "Could not disconnect Zoom.");
      return;
    }
    setBanner("Zoom disconnected.");
    void load();
  }

  async function disconnectProvider(provider: "GOOGLE" | "OUTLOOK") {
    const message =
      provider === "GOOGLE"
        ? "Disconnect Google? This also disconnects Gmail from Conversations and booking emails."
        : "Disconnect Outlook? This also disconnects Outlook mail from Conversations and booking emails.";
    if (!window.confirm(message)) return;
    setSaving(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }
    const res = await fetch(
      `/api/coach/google-calendar?provider=${provider}`,
      { method: "DELETE", headers }
    );
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(
        body.error ||
          `Could not disconnect ${provider === "GOOGLE" ? "Google" : "Outlook"}.`
      );
      return;
    }
    setBanner(
      provider === "GOOGLE" ? "Google disconnected." : "Outlook disconnected."
    );
    setGoogleOpen(false);
    setOutlookOpen(false);
    void load();
  }

  async function saveCalendars() {
    setSaving(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }
    const res = await fetch("/api/coach/google-calendar", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        provider: prefsProvider,
        busy_calendar_ids: busyIds,
        event_calendar_id: eventCalendarId,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
    };
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save calendar choices.");
      return;
    }
    setBanner("Calendar preferences saved.");
    void load();
  }

  function openPrefs(provider: "GOOGLE" | "OUTLOOK") {
    const source = provider === "GOOGLE" ? status : outlook;
    setPrefsProvider(provider);
    setBusyIds(source?.busy_calendar_ids ?? []);
    setEventCalendarId(source?.event_calendar_id || "");
    if (provider === "GOOGLE") {
      setGoogleOpen((open) => !open);
      setOutlookOpen(false);
    } else {
      setOutlookOpen((open) => !open);
      setGoogleOpen(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200/80 bg-white p-4">
        <p className="text-sm text-slate-600">Loading integrations…</p>
      </section>
    );
  }

  const connected = Boolean(status?.connected);
  const canManage = status?.can_manage ?? status?.is_self !== false;
  const configured = status?.configured !== false;
  const showGooglePrefs =
    connected && canManage && (compact || googleOpen) && prefsProvider === "GOOGLE";
  const outlookConnected = Boolean(outlook?.connected);
  const outlookCanManage = outlook?.can_manage ?? outlook?.is_self !== false;
  const showOutlookPrefs =
    outlookConnected &&
    outlookCanManage &&
    outlookOpen &&
    prefsProvider === "OUTLOOK";

  function googleSubtitle() {
    if (!connected) return "Mail, busy times, and Meet links";
    if (status?.calendar_error) return status.calendar_error;
    if (status?.is_booking_source) {
      return status.email ? `${status.email} · used for bookings` : "Used for bookings";
    }
    return status?.email || "Connected";
  }

  function outlookSubtitle() {
    if (!outlookConnected) return "Mail, busy times, and Teams links";
    if (outlook?.calendar_error) return outlook.calendar_error;
    if (outlook?.is_booking_source) {
      return outlook.email
        ? `${outlook.email} · used for bookings`
        : "Used for bookings";
    }
    return outlook?.email || "Connected";
  }

  const googleNeedsReconnect = Boolean(connected && status?.calendar_error);
  const googleAction = connected ? (
    compact || !canManage ? (
      <span className="text-sm font-medium text-teal-700">Connected</span>
    ) : googleNeedsReconnect ? (
      <button
        type="button"
        disabled={saving}
        onClick={() => void disconnectProvider("GOOGLE")}
        className="text-sm font-medium text-rose-700 hover:text-rose-800 disabled:opacity-60"
      >
        {saving ? "Disconnecting…" : "Disconnect"}
      </button>
    ) : (
      <button
        type="button"
        onClick={() => openPrefs("GOOGLE")}
        className="text-sm font-medium text-sky-700 hover:text-sky-800"
        aria-expanded={googleOpen}
      >
        {googleOpen ? "Close" : "Manage"}
      </button>
    )
  ) : canManage ? (
    <button
      type="button"
      disabled={connecting !== null || !configured}
      onClick={() => void connectProvider("GOOGLE")}
      className="text-sm font-medium text-teal-700 hover:text-teal-800 disabled:opacity-60"
    >
      {connecting === "google" ? "Opening…" : "Connect"}
    </button>
  ) : (
    <span className="text-xs text-slate-400">View only</span>
  );

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">
          {compact ? "Google Calendar" : "Integrations"}
        </h2>
      </div>

      {banner ? (
        <p className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {banner}
        </p>
      ) : null}
      {error ? (
        <p className="border-b border-rose-100 px-4 py-2 text-sm text-rose-600">
          {error}
        </p>
      ) : null}
      {!configured ? (
        <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Unipile isn&apos;t configured on this environment yet.
        </p>
      ) : null}

      <div className="divide-y divide-slate-100">
        <IntegrationRow
          mark={<GoogleCalendarMark className="h-7 w-7" />}
          title="Google"
          subtitle={googleSubtitle()}
          action={googleAction}
        >
          {showGooglePrefs && status ? (
            <CalendarPrefsPanel
              status={status}
              busyIds={busyIds}
              eventCalendarId={eventCalendarId}
              saving={saving}
              onEventCalendarId={setEventCalendarId}
              onToggleBusy={(id) =>
                setBusyIds((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                )
              }
              onSave={() => void saveCalendars()}
              onDisconnect={() => void disconnectProvider("GOOGLE")}
              disconnectLabel="Disconnect"
            />
          ) : null}
        </IntegrationRow>

        {!compact ? (
          <IntegrationRow
            mark={<OutlookMark className="h-7 w-7" />}
            title="Outlook"
            subtitle={outlookSubtitle()}
            action={
              outlookConnected ? (
                outlookCanManage ? (
                  outlook?.calendar_error ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void disconnectProvider("OUTLOOK")}
                      className="text-sm font-medium text-rose-700 hover:text-rose-800 disabled:opacity-60"
                    >
                      {saving ? "Disconnecting…" : "Disconnect"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openPrefs("OUTLOOK")}
                      className="text-sm font-medium text-sky-700 hover:text-sky-800"
                      aria-expanded={outlookOpen}
                    >
                      {outlookOpen ? "Close" : "Manage"}
                    </button>
                  )
                ) : (
                  <span className="text-sm font-medium text-teal-700">
                    Connected
                  </span>
                )
              ) : outlookCanManage ? (
                <button
                  type="button"
                  disabled={connecting !== null || !configured}
                  onClick={() => void connectProvider("OUTLOOK")}
                  className="text-sm font-medium text-teal-700 hover:text-teal-800 disabled:opacity-60"
                >
                  {connecting === "outlook" ? "Opening…" : "Connect"}
                </button>
              ) : (
                <span className="text-xs text-slate-400">View only</span>
              )
            }
          >
            {showOutlookPrefs && outlook ? (
              <CalendarPrefsPanel
                status={outlook}
                busyIds={busyIds}
                eventCalendarId={eventCalendarId}
                saving={saving}
                onEventCalendarId={setEventCalendarId}
                onToggleBusy={(id) =>
                  setBusyIds((prev) =>
                    prev.includes(id)
                      ? prev.filter((x) => x !== id)
                      : [...prev, id]
                  )
                }
                onSave={() => void saveCalendars()}
                onDisconnect={() => void disconnectProvider("OUTLOOK")}
                disconnectLabel="Disconnect"
              />
            ) : null}
          </IntegrationRow>
        ) : null}

        {!compact ? (
          <IntegrationRow
            mark={<ZoomMark className="h-7 w-7" />}
            title="Zoom"
            subtitle={
              zoom?.connected
                ? zoom.email
                  ? `${zoom.email} · unique meeting per booking`
                  : "Unique meeting per booking"
                : zoom?.configured === false
                  ? "Zoom OAuth is not configured yet"
                  : "Unique meeting link on each booking"
            }
            action={
              zoom?.connected ? (
                (zoom.can_manage ?? zoom.is_self !== false) ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void disconnectZoom()}
                    className="text-sm font-medium text-rose-700 hover:text-rose-800 disabled:opacity-60"
                  >
                    {saving ? "Disconnecting…" : "Disconnect"}
                  </button>
                ) : (
                  <span className="text-sm font-medium text-teal-700">
                    Connected
                  </span>
                )
              ) : (zoom?.can_manage ?? true) ? (
                <button
                  type="button"
                  disabled={connecting !== null || zoom?.configured === false}
                  onClick={() => void connectZoom()}
                  className="text-sm font-medium text-teal-700 hover:text-teal-800 disabled:opacity-60"
                >
                  {connecting === "zoom" ? "Opening…" : "Connect"}
                </button>
              ) : (
                <span className="text-xs text-slate-400">View only</span>
              )
            }
          />
        ) : null}
      </div>
    </section>
  );
}
