"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import type {
  MirrorConversation,
  MirrorMessage,
} from "@/lib/linkedinMessaging/fetchInbox";

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function LinkedInMirrorInbox() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [scrapedAt, setScrapedAt] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [conversations, setConversations] = useState<MirrorConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () =>
      conversations.find((c) => c.id === selectedId) ?? conversations[0] ?? null,
    [conversations, selectedId]
  );

  const authHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    setHint(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError("Sign in again, then retry.");
        return;
      }
      const res = await fetch("/api/admin/linkedin-inbox", { headers });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        conversations?: MirrorConversation[];
        scrapedAt?: string | null;
        source?: string | null;
        warning?: string | null;
        hint?: string;
        empty?: boolean;
      };
      if (!res.ok) {
        setError(body.error || `Request failed (${res.status}).`);
        setConversations([]);
        return;
      }
      const list = Array.isArray(body.conversations) ? body.conversations : [];
      setConversations(list);
      setSelectedId(list[0]?.id ?? null);
      setScrapedAt(body.scrapedAt ?? null);
      setSource(body.source ?? null);
      setWarning(body.warning ?? null);
      if (body.empty || !list.length) {
        setHint(
          body.hint ||
            "No snapshot yet. In the Chrome extension side panel, click Sync LI Inbox while logged into LinkedIn."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Loading…" : "Reload snapshot"}
        </button>
        {scrapedAt ? (
          <span className="text-xs text-slate-500">
            Synced {formatWhen(scrapedAt)}
            {source ? ` · ${source}` : ""}
          </span>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <strong className="text-slate-800">How to refresh:</strong> Reload the
        extension → open the side panel on LinkedIn →{" "}
        <strong>Sync LI Inbox</strong>. That scrapes from your browser IP (not
        our server). Then hit Reload snapshot here. Server cookie paste will
        keep getting 401s.
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {hint ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {hint}
        </div>
      ) : null}
      {warning ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {warning}
        </div>
      ) : null}

      <div className="grid min-h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-200 md:border-b-0 md:border-r">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Conversations
          </div>
          <ul className="max-h-[520px] overflow-y-auto">
            {conversations.length === 0 && !loading ? (
              <li className="px-3 py-6 text-sm text-slate-500">
                No conversations in the last sync.
              </li>
            ) : null}
            {conversations.map((c) => {
              const active = selected?.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full border-b border-slate-50 px-3 py-3 text-left transition ${
                      active ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                  >
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {c.title}
                    </p>
                    {c.subtitle ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                        {c.subtitle}
                      </p>
                    ) : null}
                    {c.lastActivityAt ? (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatWhen(c.lastActivityAt)}
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="flex min-h-[420px] flex-col">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">
              {selected?.title || "Select a conversation"}
            </p>
            {selected?.participants[0]?.headline ? (
              <p className="text-xs text-slate-500">
                {selected.participants[0].headline}
              </p>
            ) : null}
            {selected?.participants[0]?.profileUrl ? (
              <a
                href={selected.participants[0].profileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-sky-700 hover:underline"
              >
                Open LinkedIn profile →
              </a>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-slate-50 px-4 py-4">
            {!selected ? (
              <p className="text-sm text-slate-500">Nothing selected.</p>
            ) : selected.messages.length === 0 ? (
              <p className="text-sm text-slate-500">No messages in this thread.</p>
            ) : (
              selected.messages.map((m: MirrorMessage) => (
                <div
                  key={m.id}
                  className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                      m.fromMe
                        ? "bg-sky-700 text-white"
                        : "bg-white text-slate-800 ring-1 ring-slate-200"
                    }`}
                  >
                    {!m.fromMe ? (
                      <p className="mb-1 text-[11px] font-semibold text-slate-500">
                        {m.fromName}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {m.sentAt ? (
                      <p
                        className={`mt-1 text-[10px] ${
                          m.fromMe ? "text-sky-100/90" : "text-slate-400"
                        }`}
                      >
                        {formatWhen(m.sentAt)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
