"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { ProfileSectionCard } from "@/components/settings/ProfileFormLayout";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  isConnectableProvider,
  normalizeUnipileProvider,
  providerLabel,
  type UnipileConnectProvider,
} from "@/lib/unipile/providers";

type AccountRow = {
  id: string;
  provider: string;
  status: string;
  display_name: string | null;
  last_synced_at: string | null;
};

function authHeaders(impersonatingCoachId: string | null) {
  return async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    if (impersonatingCoachId) {
      headers["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return headers;
  };
}

function accountHealth(status: string): "ok" | "connecting" | "error" {
  const s = status.toUpperCase();
  if (s === "OK") return "ok";
  if (s === "CONNECTING") return "connecting";
  return "error";
}

function pickPrimary(rows: AccountRow[]): AccountRow | undefined {
  return (
    rows.find((row) => accountHealth(row.status) === "ok") ??
    rows.find((row) => accountHealth(row.status) === "connecting") ??
    rows[0]
  );
}

type IntegrationGroupItem =
  | { kind: "account"; provider: UnipileConnectProvider }
  | { kind: "zoom"; title: string }
  | { kind: "soon"; id: string; title: string };

const INTEGRATION_GROUPS: {
  id: string;
  title: string;
  info: string;
  items: IntegrationGroupItem[];
}[] = [
  {
    id: "email",
    title: "Email and calendars",
    info: "Inbox, booking emails, busy times, and meeting links.",
    items: [
      { kind: "account", provider: "GOOGLE" },
      { kind: "account", provider: "OUTLOOK" },
    ],
  },
  {
    id: "calls",
    title: "Call links",
    info: "Video links on bookings.",
    items: [{ kind: "zoom", title: "Zoom" }],
  },
  {
    id: "social",
    title: "Social media",
    info: "These channels land in Conversations. LinkedIn, Instagram, and Messenger also power Campaigns.",
    items: [
      { kind: "account", provider: "LINKEDIN" },
      { kind: "account", provider: "WHATSAPP" },
      { kind: "account", provider: "INSTAGRAM" },
      { kind: "account", provider: "MESSENGER" },
    ],
  },
];

function rowTitle(provider: UnipileConnectProvider): string {
  if (provider === "GOOGLE") return "Google";
  if (provider === "MESSENGER") return "Facebook";
  return providerLabel(provider);
}

const LINKEDIN_SIGN_IN_SECURITY_URL =
  "https://www.linkedin.com/mypreferences/d/change-password";

const LINKEDIN_CONNECT_TIP = (
  <>
    If you usually sign into LinkedIn with Google or Outlook: keep using that
    same email (e.g. your Gmail), but set a LinkedIn password and use that
    password here — not your Google or Outlook password. Add one in{" "}
    <a
      href={LINKEDIN_SIGN_IN_SECURITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
    >
      LinkedIn Sign in &amp; security
    </a>
    . If you never had a LinkedIn password, use Forgot password on LinkedIn’s
    sign-in page with that same email.
  </>
);

function SectionInfoTip({
  label,
  text,
  wide = false,
}: {
  label: string;
  text: ReactNode;
  wide?: boolean;
}) {
  const panelId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node)) return;
      const panel = document.getElementById(panelId);
      if (panel?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, panelId]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="-m-0.5 rounded-full p-0.5 text-slate-400 outline-none ring-sky-500/50 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 aria-expanded:bg-slate-100 aria-expanded:text-slate-600"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${label} info`}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </button>
      {open ? (
        <div
          id={panelId}
          role="tooltip"
          className={`absolute left-0 top-full z-20 mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 shadow-lg ${
            wide ? "w-72" : "w-52"
          }`}
        >
          {text}
        </div>
      ) : null}
    </>
  );
}

type IntegrationRowProps = {
  title: string;
  subtitle?: string | null;
  info?: ReactNode;
  status: ReactNode;
  last?: boolean;
};

function IntegrationRow({
  title,
  subtitle,
  info,
  status,
  last = false,
}: IntegrationRowProps) {
  return (
    <div
      className={`relative grid grid-cols-[minmax(0,1fr)_8.25rem] items-center gap-x-2 py-2 ${
        last ? "" : "border-b border-slate-50"
      }`}
    >
      <div className="min-w-0 pr-2">
        <div className="flex items-center gap-1">
          <p className="text-sm font-semibold leading-snug text-slate-900">
            {title}
          </p>
          {info ? (
            <SectionInfoTip label={title} text={info} wide />
          ) : null}
        </div>
        {subtitle ? (
          <p className="truncate text-[11px] leading-snug text-slate-500">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div>{status}</div>
    </div>
  );
}

function ConnectedStatusButton({
  open,
  onOpenChange,
  onDisconnect,
  busy,
  label,
  className,
  statusText = "Connected",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisconnect: () => void;
  busy: boolean;
  label: string;
  className: string;
  statusText?: string;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      onOpenChange(false);
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
    <div ref={rootRef} className="w-full">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${label} ${statusText.toLowerCase()}. Open to disconnect`}
        disabled={busy}
        onClick={() => onOpenChange(!open)}
        className={`${className} hover:bg-emerald-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30`}
      >
        {statusText}
      </button>
      {open && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              style={{ top: menuPos.top, right: menuPos.right }}
              className="fixed z-50 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
            >
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                onClick={() => {
                  onOpenChange(false);
                  onDisconnect();
                }}
              >
                <Unplug className="h-3.5 w-3.5 text-rose-400" aria-hidden />
                Disconnect
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

/** Profile Settings right rail — channel + calendar connect status. */
export function IntegrationsSettingsTab() {
  const { impersonatingCoachId } = useImpersonation();
  const getHeaders = authHeaders(impersonatingCoachId);
  const [configured, setConfigured] = useState(true);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [menuAccountId, setMenuAccountId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [justConnected, setJustConnected] =
    useState<UnipileConnectProvider | null>(null);
  const [zoom, setZoom] = useState<{
    configured: boolean;
    connected: boolean;
    email: string | null;
  } | null>(null);
  const [zoomJustConnected, setZoomJustConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getHeaders();
      const [channelsRes, zoomRes] = await Promise.all([
        fetch("/api/coach/integrations/accounts", { headers }),
        fetch("/api/coach/zoom", { headers }),
      ]);
      const channelsBody = await channelsRes.json().catch(() => ({}));
      if (!channelsRes.ok) {
        throw new Error(channelsBody.error || "Could not load integrations.");
      }
      setConfigured(Boolean(channelsBody.configured));
      setAccounts(channelsBody.accounts ?? []);
      const zoomBody = (await zoomRes.json().catch(() => ({}))) as {
        configured?: boolean;
        connected?: boolean;
        email?: string | null;
      };
      if (zoomRes.ok) {
        setZoom({
          configured: zoomBody.configured !== false,
          connected: Boolean(zoomBody.connected),
          email: zoomBody.email ?? null,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [impersonatingCoachId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const googleFlag = params.get("google_calendar");
    const zoomFlag = params.get("zoom");
    if (!connected && !googleFlag && !zoomFlag) return;

    if (connected === "failed") {
      setError("Connection failed. Try again.");
    } else if (connected) {
      const provider = normalizeUnipileProvider(connected);
      if (isConnectableProvider(provider)) setJustConnected(provider);
      void (async () => {
        const headers = await getHeaders();
        await fetch("/api/coach/integrations/accounts", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "sync" }),
        });
        await load();
      })();
    }

    if (googleFlag === "connected") {
      setJustConnected("GOOGLE");
      void load();
    } else if (googleFlag) {
      setError(`Google connect issue: ${googleFlag.replace(/_/g, " ")}`);
    }

    if (zoomFlag === "connected") {
      setZoomJustConnected(true);
      void load();
    } else if (zoomFlag) {
      setError(`Zoom connect issue: ${zoomFlag.replace(/_/g, " ")}`);
    }

    params.delete("connected");
    params.delete("google_calendar");
    params.delete("zoom");
    if (!params.get("tab")) params.set("tab", "profile");
    const next = `${window.location.pathname}?${params.toString()}`.replace(
      /\?$/,
      ""
    );
    window.history.replaceState({}, "", next);
  }, [getHeaders, load]);

  async function connect(provider: UnipileConnectProvider) {
    setBusy(provider);
    setError(null);
    setMessage(null);
    try {
      const headers = await getHeaders();
      const res = await fetch("/api/coach/integrations/accounts", {
        method: "POST",
        headers,
        body: JSON.stringify({ provider }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not start connect.");
      if (!body.url) throw new Error("No connect URL returned.");
      window.location.href = body.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed.");
      setBusy(null);
    }
  }

  async function connectZoom() {
    setBusy("zoom");
    setError(null);
    setMessage(null);
    try {
      const headers = await getHeaders();
      const res = await fetch("/api/coach/zoom/connect?returnTo=settings", {
        headers,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not start Zoom connect.");
      if (!body.url) throw new Error("No connect URL returned.");
      window.location.href = body.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed.");
      setBusy(null);
    }
  }

  async function disconnectZoom() {
    const ok = window.confirm(
      "Disconnect Zoom? New bookings will not get a Zoom link."
    );
    if (!ok) return;
    setBusy("zoom");
    setError(null);
    setMenuAccountId(null);
    try {
      const headers = await getHeaders();
      const res = await fetch("/api/coach/zoom", {
        method: "DELETE",
        headers,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Disconnect failed.");
      setZoom({
        configured: zoom?.configured !== false,
        connected: false,
        email: null,
      });
      setZoomJustConnected(false);
      setMessage("Disconnected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(
    accountId: string,
    provider: UnipileConnectProvider
  ) {
    const title = rowTitle(provider);
    const ok = window.confirm(
      provider === "GOOGLE"
        ? "Disconnect Google? This also disconnects Gmail from Conversations, booking emails, and calendar."
        : provider === "OUTLOOK"
          ? "Disconnect Outlook? This also disconnects Outlook mail from Conversations, booking emails, and calendar."
          : `Disconnect ${title}?`
    );
    if (!ok) return;

    setBusy(accountId);
    setError(null);
    setMenuAccountId(null);
    try {
      const headers = await getHeaders();
      const res = await fetch("/api/coach/integrations/accounts", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "disconnect", account_id: accountId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Disconnect failed.");
      setAccounts(body.accounts ?? []);
      setMessage("Disconnected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed.");
    } finally {
      setBusy(null);
    }
  }

  async function syncAll() {
    setBusy("sync");
    setError(null);
    try {
      const headers = await getHeaders();
      const res = await fetch("/api/coach/integrations/accounts", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "sync" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Sync failed.");
      setAccounts(body.accounts ?? []);
      await load();
      setMessage("Accounts refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setBusy(null);
    }
  }

  const byProvider = new Map<string, AccountRow[]>();
  for (const group of INTEGRATION_GROUPS) {
    for (const item of group.items) {
      if (item.kind === "account") byProvider.set(item.provider, []);
    }
  }
  for (const a of accounts) {
    const key = (a.provider || "").toUpperCase();
    const list = byProvider.get(key) ?? [];
    list.push(a);
    byProvider.set(key, list);
  }

  const statusBoxClass =
    "inline-flex h-7 w-full items-center justify-center rounded-md px-2 text-xs font-medium";
  const connectButtonClass = `${statusBoxClass} border border-slate-200 bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50`;
  const connectedClass = `${statusBoxClass} bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200`;
  const connectingClass = `${statusBoxClass} bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200`;
  const comingSoonClass = `${statusBoxClass} bg-slate-50 text-[11px] text-slate-400 ring-1 ring-inset ring-slate-200`;

  return (
    <ProfileSectionCard
      title="Integrations"
      action={
        <button
          type="button"
          disabled={busy === "sync" || loading}
          onClick={() => void syncAll()}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
        >
          {busy === "sync" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      }
    >
      {!configured ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Unipile is not configured on this environment yet.
        </p>
      ) : null}

      {message ? (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {message}
        </p>
      ) : null}
      {error ? <p className="mb-3 text-xs text-rose-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="space-y-5">
          {INTEGRATION_GROUPS.map((group) => (
            <div key={group.id}>
              <div className="relative mb-0.5 flex items-center gap-1 border-b border-slate-200 pb-1.5">
                <p className="text-xs font-semibold text-slate-600">
                  {group.title}
                </p>
                <SectionInfoTip label={group.title} text={group.info} />
              </div>
              {group.items.map((item, index) => {
                const last = index === group.items.length - 1;
                if (item.kind === "soon") {
                  return (
                    <IntegrationRow
                      key={item.id}
                      title={item.title}
                      last={last}
                      status={
                        <span className={comingSoonClass}>Coming soon</span>
                      }
                    />
                  );
                }

                if (item.kind === "zoom") {
                  const zoomConnected = Boolean(zoom?.connected || zoomJustConnected);
                  const zoomConfigured = zoom?.configured !== false;
                  return (
                    <IntegrationRow
                      key="zoom"
                      title={item.title}
                      subtitle={zoom?.email}
                      last={last}
                      status={
                        busy === "zoom" ? (
                          <span className={connectingClass} aria-live="polite">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                          </span>
                        ) : zoomConnected ? (
                          <ConnectedStatusButton
                            open={menuAccountId === "zoom"}
                            onOpenChange={(open) =>
                              setMenuAccountId(open ? "zoom" : null)
                            }
                            busy={busy === "zoom"}
                            label="Zoom"
                            className={connectedClass}
                            statusText={
                              zoomJustConnected ? "Connected now" : "Connected"
                            }
                            onDisconnect={() => void disconnectZoom()}
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={Boolean(busy) || !zoomConfigured}
                            onClick={() => void connectZoom()}
                            className={connectButtonClass}
                          >
                            {busy === "zoom" ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : null}
                            Connect
                          </button>
                        )
                      }
                    />
                  );
                }

                const provider = item.provider;
                const rows = byProvider.get(provider) ?? [];
                const primary = pickPrimary(rows);
                const justNow = justConnected === provider;
                const health = primary ? accountHealth(primary.status) : null;
                const connectedLabel = justNow ? "Connected now" : "Connected";
                return (
                  <IntegrationRow
                    key={provider}
                    title={rowTitle(provider)}
                    subtitle={primary?.display_name}
                    info={
                      provider === "LINKEDIN" ? LINKEDIN_CONNECT_TIP : null
                    }
                    last={last}
                    status={
                      primary && busy === primary.id ? (
                        <span className={connectingClass} aria-live="polite">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                        </span>
                      ) : primary && (health === "ok" || justNow) ? (
                        <ConnectedStatusButton
                          open={menuAccountId === primary.id}
                          onOpenChange={(open) =>
                            setMenuAccountId(open ? primary.id : null)
                          }
                          busy={busy === primary.id}
                          label={rowTitle(provider)}
                          className={connectedClass}
                          statusText={connectedLabel}
                          onDisconnect={() =>
                            void disconnect(primary.id, provider)
                          }
                        />
                      ) : justNow ? (
                        <span className={connectedClass} aria-live="polite">
                          Connected now
                        </span>
                      ) : health === "connecting" ? (
                        <span className={connectingClass}>Connecting…</span>
                      ) : (
                        <button
                          type="button"
                          disabled={Boolean(busy) || !configured}
                          onClick={() => void connect(provider)}
                          className={connectButtonClass}
                        >
                          {busy === provider ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : null}
                          Connect
                        </button>
                      )
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </ProfileSectionCard>
  );
}
