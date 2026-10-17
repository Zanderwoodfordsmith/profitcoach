"use client";

import { useEffect, useState } from "react";

type Ava = { id: string; suggestion: string | null; reason: string | null; draft: string | null; autopilotText: string | null };

/** Ava's suggestion for the open conversation, with a one-tap "Use draft". */
export function AvaDraftBar({
  conversationId,
  getHeaders,
  onUseDraft,
}: {
  conversationId: string;
  getHeaders: () => Promise<Record<string, string> | null>;
  onUseDraft: (text: string) => void;
}) {
  const [ava, setAva] = useState<{ forId: string; data: Ava } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await getHeaders();
      if (!headers || cancelled) return;
      const res = await fetch(`/api/messaging/conversations/${encodeURIComponent(conversationId)}/ava`, { headers });
      const body = (await res.json().catch(() => null)) as { ava?: Ava | null } | null;
      if (cancelled) return;
      setAva(res.ok && body?.ava ? { forId: conversationId, data: body.ava } : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, getHeaders]);

  const current = ava && ava.forId === conversationId ? ava.data : null;
  if (!current || (!current.draft && !current.autopilotText)) return null;

  const mark = async (action: "used" | "dismissed") => {
    const headers = await getHeaders();
    if (!headers) return;
    await fetch(`/api/messaging/conversations/${encodeURIComponent(conversationId)}/ava`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ id: current.id, action }),
    }).catch(() => null);
  };

  if (current.autopilotText) {
    return (
      <div className="shrink-0 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-slate-700">
        <span className="font-semibold text-sky-800">Ava is replying for you</span> in about a minute. To stop it, cancel the
        scheduled message below.
      </div>
    );
  }

  return (
    <div className="shrink-0 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-semibold text-sky-800">Ava:</span> {current.suggestion}
          {current.reason ? <span className="text-slate-500"> · {current.reason}</span> : null}
        </span>
        <span className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onUseDraft(current.draft ?? "");
              void mark("used");
              setAva(null);
            }}
            className="rounded-md bg-sky-700 px-2.5 py-1 font-medium text-white hover:bg-sky-600"
          >
            Use draft
          </button>
          <button
            type="button"
            onClick={() => {
              void mark("dismissed");
              setAva(null);
            }}
            className="rounded-md px-2 py-1 text-slate-500 hover:text-slate-800"
          >
            Dismiss
          </button>
        </span>
      </div>
    </div>
  );
}
