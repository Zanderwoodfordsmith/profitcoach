"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  Plug,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { ProfileSectionCard } from "@/components/settings/ProfileFormLayout";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  providerLabel,
  UNIPILE_CONNECT_PROVIDERS,
  type UnipileConnectProvider,
} from "@/lib/unipile/providers";

type AccountRow = {
  id: string;
  provider: string;
  status: string;
  display_name: string | null;
  last_synced_at: string | null;
};

type GoogleStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
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

function statusTone(status: string) {
  const s = status.toUpperCase();
  if (s === "OK") return "text-emerald-700 bg-emerald-50 ring-emerald-200";
  if (s === "CONNECTING") return "text-sky-700 bg-sky-50 ring-sky-200";
  if (s === "CREDENTIALS" || s === "ERROR")
    return "text-rose-700 bg-rose-50 ring-rose-200";
  return "text-slate-600 bg-slate-50 ring-slate-200";
}

const PROVIDER_BLURBS: Record<UnipileConnectProvider, string> = {
  LINKEDIN: "Campaigns, Content, Conversations",
  WHATSAPP: "Chats in Conversations",
  INSTAGRAM: "DMs in Conversations",
  MESSENGER: "Messenger in Conversations",
  GOOGLE: "Gmail in Conversations",
  OUTLOOK: "Outlook in Conversations",
};

type IntegrationRowProps = {
  title: string;
  subtitle: string;
  statusLabel?: string | null;
  statusClassName?: string;
  action: ReactNode;
  last?: boolean;
};

function IntegrationRow({
  title,
  subtitle,
  statusLabel,
  statusClassName,
  action,
  last = false,
}: IntegrationRowProps) {
  return (
    <div
      className={`flex items-start justify-between gap-3 py-3.5 ${
        last ? "" : "border-b border-slate-50"
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {statusLabel ? (
            <span
              className={`rounded-full px-1.5 py-px text-[10px] font-semibold ring-1 ring-inset ${
                statusClassName ??
                "bg-slate-50 text-slate-500 ring-slate-200"
              }`}
            >
              {statusLabel}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p>
      </div>
      <div className="shrink-0 pt-0.5">{action}</div>
    </div>
  );
}

/** Profile Settings right rail — channel + calendar connect status. */
export function IntegrationsSettingsTab() {
  const pathname = usePathname();
  const { impersonatingCoachId } = useImpersonation();
  const getHeaders = authHeaders(impersonatingCoachId);
  const [configured, setConfigured] = useState(true);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calendarSettingsHref = pathname.startsWith("/admin")
    ? "/admin/account?tab=calendar"
    : "/coach/settings?tab=calendar";
  const profileReturnTo = pathname.startsWith("/admin")
    ? "/admin/account?tab=profile"
    : "/coach/settings?tab=profile";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getHeaders();
      const [channelsRes, googleRes] = await Promise.all([
        fetch("/api/coach/integrations/accounts", { headers }),
        fetch("/api/coach/google-calendar", { headers }),
      ]);
      const channelsBody = await channelsRes.json().catch(() => ({}));
      if (!channelsRes.ok) {
        throw new Error(channelsBody.error || "Could not load integrations.");
      }
      setConfigured(Boolean(channelsBody.configured));
      setAccounts(channelsBody.accounts ?? []);

      if (googleRes.ok) {
        const googleBody = (await googleRes.json().catch(() => ({}))) as GoogleStatus;
        setGoogle({
          configured: Boolean(googleBody.configured),
          connected: Boolean(googleBody.connected),
          email: googleBody.email ?? null,
        });
      } else {
        setGoogle(null);
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
    if (!connected && !googleFlag) return;

    if (connected === "failed") {
      setError("Connection failed. Try again.");
    } else if (connected) {
      setMessage(`${providerLabel(connected)} connected.`);
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
      setMessage("Google Calendar connected.");
      void load();
    } else if (googleFlag) {
      setError(`Google connect issue: ${googleFlag.replace(/_/g, " ")}`);
    }

    params.delete("connected");
    params.delete("google_calendar");
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

  async function connectGoogle() {
    setBusy("google-calendar");
    setError(null);
    setMessage(null);
    try {
      const headers = await getHeaders();
      const res = await fetch(
        `/api/coach/google-calendar/connect?returnTo=${encodeURIComponent(profileReturnTo)}`,
        { headers }
      );
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.url) {
        throw new Error(body.error || "Could not start Google connect.");
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed.");
      setBusy(null);
    }
  }

  async function disconnect(accountId: string) {
    setBusy(accountId);
    setError(null);
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
  for (const p of UNIPILE_CONNECT_PROVIDERS) byProvider.set(p, []);
  for (const a of accounts) {
    const key = (a.provider || "").toUpperCase();
    const list = byProvider.get(key) ?? [];
    list.push(a);
    byProvider.set(key, list);
  }

  const connectButtonClass =
    "inline-flex items-center gap-1 rounded-md bg-[#0c5290] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0a457a] disabled:opacity-50";
  const secondaryButtonClass =
    "inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

  return (
    <ProfileSectionCard
      title="Integrations"
      description="Connect channels and calendar for Conversations and booking."
    >
      <div className="mb-1 flex items-center justify-end">
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
      </div>

      {!configured ? (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Unipile is not configured on this environment yet.
        </p>
      ) : null}

      {message ? (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {message}
        </p>
      ) : null}
      {error ? <p className="mb-2 text-xs text-rose-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      ) : (
        <div>
          <IntegrationRow
            title="Google Calendar"
            subtitle={
              google?.connected
                ? google.email || "Connected for booking"
                : "Busy times and Meet links for bookings"
            }
            statusLabel={google?.connected ? "Connected" : null}
            statusClassName="text-emerald-700 bg-emerald-50 ring-emerald-200"
            action={
              google?.connected ? (
                <Link href={calendarSettingsHref} className={secondaryButtonClass}>
                  Manage
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={
                    Boolean(busy) || google?.configured === false
                  }
                  onClick={() => void connectGoogle()}
                  className={connectButtonClass}
                >
                  {busy === "google-calendar" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plug className="h-3 w-3" />
                  )}
                  Connect
                </button>
              )
            }
          />

          {UNIPILE_CONNECT_PROVIDERS.map((provider, index) => {
            const rows = byProvider.get(provider) ?? [];
            const primary = rows[0];
            const last = index === UNIPILE_CONNECT_PROVIDERS.length - 1;
            return (
              <IntegrationRow
                key={provider}
                title={providerLabel(provider)}
                subtitle={
                  primary?.display_name
                    ? primary.display_name
                    : PROVIDER_BLURBS[provider]
                }
                statusLabel={primary ? primary.status : null}
                statusClassName={
                  primary ? statusTone(primary.status) : undefined
                }
                last={last}
                action={
                  primary ? (
                    <button
                      type="button"
                      disabled={busy === primary.id}
                      onClick={() => void disconnect(primary.id)}
                      className={secondaryButtonClass}
                    >
                      {busy === primary.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Unplug className="h-3 w-3" />
                      )}
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={Boolean(busy) || !configured}
                      onClick={() => void connect(provider)}
                      className={connectButtonClass}
                    >
                      {busy === provider ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plug className="h-3 w-3" />
                      )}
                      Connect
                    </button>
                  )
                }
              />
            );
          })}
        </div>
      )}
    </ProfileSectionCard>
  );
}
