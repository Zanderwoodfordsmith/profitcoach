"use client";

import { Link2, Loader2, Unplug } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { supabaseClient } from "@/lib/supabaseClient";

type Line = { status: string; phone: string | null; last_synced_at: string | null };

/**
 * Link your own WhatsApp to Support. Only chats with a coach's profile
 * number come in; everything else stays on your phone.
 */
export function SupportWhatsAppConnect({
  onStatus,
}: {
  /** True when your linked WhatsApp needs relinking. Not linked at all is fine. */
  onStatus?: (needsAttention: boolean) => void;
} = {}) {
  const [configured, setConfigured] = useState(true);
  const [line, setLine] = useState<Line | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const headers = useCallback(async () => {
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
    const h = await headers();
    if (!h) {
      setLoading(false);
      return;
    }
    const res = await fetch("/api/admin/support/whatsapp", { headers: h }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as {
      configured?: boolean;
      line?: Line | null;
      sync?: { chats: number; messages: number } | null;
      error?: string;
    };
    if (!res?.ok) {
      setError(body?.error || "Could not load WhatsApp.");
    } else {
      setConfigured(body.configured !== false);
      setLine(body.line ?? null);
      if (body.sync?.messages) {
        setNote(`${body.sync.messages} new WhatsApp message${body.sync.messages === 1 ? "" : "s"} from coaches.`);
      }
    }
    setLoading(false);
  }, [headers]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("whatsapp");
    if (result) {
      params.delete("whatsapp");
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${params.toString() ? `?${params}` : ""}`
      );
    }
    if (result === "failed") setError("WhatsApp did not link. Try again.");
    void (async () => {
      if (result === "connected") {
        setNote("WhatsApp linked. Bringing in the last two weeks of coach chats…");
        const h = await headers();
        if (h) {
          await fetch("/api/admin/support/whatsapp", {
            method: "POST",
            headers: h,
            body: JSON.stringify({ action: "claim" }),
          }).catch(() => null);
        }
      }
      await load();
    })();
  }, [headers, load]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const h = await headers();
      if (!h) return;
      const res = await fetch("/api/admin/support/whatsapp", {
        method: "POST",
        headers: h,
        body: JSON.stringify({ action: "connect" }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setError(body.error || "Could not start linking.");
        return;
      }
      window.location.href = body.url;
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Unlink your WhatsApp from Support? Coach chats stop coming in, and you can't send on WhatsApp from the app.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const h = await headers();
      if (!h) return;
      const res = await fetch("/api/admin/support/whatsapp", {
        method: "POST",
        headers: h,
        body: JSON.stringify({ action: "disconnect" }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error || "Could not unlink.");
        return;
      }
      setLine(null);
      setNote("WhatsApp unlinked.");
    } finally {
      setBusy(false);
    }
  }

  const needsRelink = !!line && line.status !== "OK" && line.status !== "CONNECTING";
  useEffect(() => {
    if (!loading) onStatus?.(needsRelink);
  }, [loading, needsRelink, onStatus]);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        WhatsApp…
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {line ? (
        <>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              needsRelink
                ? "border-amber-200 bg-amber-50 text-amber-950"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
            title="Only chats with a coach's profile number come into Support"
          >
            <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" />
            {line.phone ? `+${line.phone}` : "Your WhatsApp"}
            <span className={needsRelink ? "text-amber-800/80" : "text-emerald-700/80"}>
              · {needsRelink ? "needs relinking" : "linked"}
            </span>
          </span>
          {needsRelink ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void connect()}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              {busy ? "Opening…" : "Relink"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void disconnect()}
            className={buttonClass("second", "small")}
            aria-label="Unlink my WhatsApp"
            title="Unlink my WhatsApp"
          >
            <Unplug className="h-3.5 w-3.5" aria-hidden />
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={busy || !configured}
          onClick={() => void connect()}
          className={buttonClass("second", "small")}
          title="Only chats with a coach's profile number come in. Everything else stays on your phone."
        >
          <WhatsAppIcon className="h-3.5 w-3.5" />
          {busy ? "Opening…" : "Link my WhatsApp"}
        </button>
      )}
      {note ? <span className="text-caption text-emerald-700">{note}</span> : null}
      {error ? <span className="text-caption text-rose-700">{error}</span> : null}
    </div>
  );
}
