"use client";

import { Link2, Loader2, Mail, Unplug } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type MailboxAccount = {
  id: string;
  provider: string;
  status: string;
  display_name: string | null;
  unipile_account_id: string;
  last_synced_at: string | null;
};

export function SupportMailboxConnect() {
  const [configured, setConfigured] = useState(true);
  const [account, setAccount] = useState<MailboxAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const authHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
  }, []);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) {
      setLoading(false);
      return;
    }
    const res = await fetch("/api/admin/support/mailbox", { headers });
    const body = (await res.json().catch(() => ({}))) as {
      configured?: boolean;
      account?: MailboxAccount | null;
      error?: string;
    };
    if (!res.ok) {
      setError(body.error || "Could not load mailbox.");
      setLoading(false);
      return;
    }
    setConfigured(body.configured !== false);
    setAccount(body.account ?? null);
    setError(null);
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    void load();
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const mailbox = params.get("mailbox");
    if (mailbox === "connected") {
      setNote("Support mailbox connected.");
      params.delete("mailbox");
      const next = `${window.location.pathname}${
        params.toString() ? `?${params}` : ""
      }`;
      window.history.replaceState({}, "", next);
      void (async () => {
        const headers = await authHeaders();
        if (headers) {
          await fetch("/api/admin/support/mailbox", {
            method: "POST",
            headers,
            body: JSON.stringify({ action: "claim" }),
          }).catch(() => null);
        }
        await load();
      })();
    } else if (mailbox === "failed") {
      setError("Mailbox connection failed. Try again.");
      params.delete("mailbox");
      const next = `${window.location.pathname}${
        params.toString() ? `?${params}` : ""
      }`;
      window.history.replaceState({}, "", next);
    }
  }, [load]);

  async function connect(reconnect = false) {
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/admin/support/mailbox", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: reconnect ? "reconnect" : "connect",
          provider: "GOOGLE",
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.url) {
        setError(body.error || "Could not start connect.");
        return;
      }
      window.location.href = body.url;
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (
      !window.confirm(
        "Disconnect the support mailbox? Inbound emails and reply notifications will stop."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/admin/support/mailbox", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "disconnect" }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error || "Could not disconnect.");
        return;
      }
      setAccount(null);
      setNote("Support mailbox disconnected.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Mailbox…
      </div>
    );
  }

  const needsReconnect =
    account &&
    account.status !== "OK" &&
    account.status !== "CONNECTING";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {account ? (
        <>
          <span
            className={`inline-flex max-w-[14rem] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              needsReconnect
                ? "border-amber-200 bg-amber-50 text-amber-950"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
            title={account.display_name || account.unipile_account_id}
          >
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {account.display_name || "Support Gmail"}
            </span>
            <span
              className={`shrink-0 ${
                needsReconnect ? "text-amber-800/80" : "text-emerald-700/80"
              }`}
            >
              · {account.status}
            </span>
          </span>
          {needsReconnect ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void connect(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              {busy ? "Opening…" : "Reconnect"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void disconnect()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Unplug className="h-3.5 w-3.5" aria-hidden />
            Disconnect
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={busy || !configured}
          onClick={() => void connect(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          title={
            configured
              ? "Connect support@ Gmail via Unipile — used for inbound tickets and reply emails"
              : "Unipile is not configured"
          }
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          {busy ? "Connecting…" : "Connect support email"}
        </button>
      )}
      {note ? (
        <span className="text-[11px] text-emerald-700">{note}</span>
      ) : null}
      {error ? <span className="text-[11px] text-rose-700">{error}</span> : null}
    </div>
  );
}
