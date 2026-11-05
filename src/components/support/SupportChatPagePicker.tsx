"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { fieldClass } from "@/components/ui/Field";
import { CHAT_PAGES, chatPageFor } from "@/lib/support/chatPages";
import { supabaseClient } from "@/lib/supabaseClient";

const GROUPS = ["My Blueprint", "Settings", "The app"] as const;

async function authHeader(): Promise<Record<string, string> | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : null;
}

/**
 * BCA links a Support chat to the page it's about (5 Nov), so the coach gets
 * an "Open … page" button beside it. The AI suggests pages; BCA decides. Many
 * chats need none.
 */
/** `stacked`: the caller labels it above (Support V2's narrow column), so no side label or indent. */
export function SupportChatPagePicker({
  reportId,
  value,
  stacked = false,
}: {
  reportId: string;
  value: string | null;
  stacked?: boolean;
}) {
  const indent = stacked ? "" : "pl-[4.75rem]";
  const [path, setPath] = useState<string | null>(value);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const headers = await authHeader();
      if (!headers) return;
      const res = await fetch(`/api/admin/support/chat-page?report_id=${encodeURIComponent(reportId)}`, { headers }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as { suggestions?: string[] } | null;
      if (live) setSuggestions(data?.suggestions ?? []);
    })();
    return () => {
      live = false;
    };
  }, [reportId]);

  async function save(next: string | null) {
    const before = path;
    setPath(next);
    setSaving(true);
    setError(null);
    const headers = await authHeader();
    const res = headers
      ? await fetch("/api/admin/support/chat-page", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ report_id: reportId, path: next }),
        }).catch(() => null)
      : null;
    setSaving(false);
    if (!res?.ok) {
      setPath(before);
      setError("Couldn't save that. Try again.");
    }
  }

  const linked = chatPageFor(path);
  const offered = (suggestions ?? []).filter((s) => s !== path).map(chatPageFor).filter(Boolean);

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-3">
        <span className={stacked ? "sr-only" : "w-16 shrink-0 text-xs font-medium text-slate-600"}>Page</span>
        <select
          value={path ?? ""}
          disabled={saving}
          onChange={(e) => void save(e.target.value || null)}
          className={fieldClass("select", "small", "min-w-0 flex-1")}
        >
          <option value="">No page</option>
          {GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {CHAT_PAGES.filter((p) => p.group === group).map((p) => (
                <option key={p.path} value={p.path}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {suggestions === null ? (
        <p className={`${indent} text-xs text-slate-400`}>Looking for the right page…</p>
      ) : offered.length ? (
        <div className={`flex flex-wrap items-center gap-1.5 ${indent}`}>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Sparkles className="h-3 w-3" aria-hidden />
            Suggested
          </span>
          {offered.map((p) => (
            <button
              key={p!.path}
              type="button"
              disabled={saving}
              onClick={() => void save(p!.path)}
              className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50"
            >
              {p!.name}
            </button>
          ))}
        </div>
      ) : null}
      <p className={`${indent} text-xs text-slate-500`}>
        {error ?? (linked ? `The coach sees "← ${linked.button}" by the chat.` : "No page button for the coach.")}
      </p>
    </div>
  );
}
