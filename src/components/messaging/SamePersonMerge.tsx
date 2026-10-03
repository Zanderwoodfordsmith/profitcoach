"use client";

import { useEffect, useState } from "react";
import { formatPhoneDisplay } from "@/lib/formatPhoneDisplay";

type Match = {
  contactId: string | null;
  conversationId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  channel: string | null;
  businessName: string | null;
};

type Props = {
  conversationId: string;
  authHeaders: () => Promise<Record<string, string> | null>;
  onMerged: () => void;
};

function channelLabel(channel: string | null): string | null {
  if (!channel) return null;
  if (channel === "linkedin") return "LinkedIn";
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

export function SamePersonMerge({
  conversationId,
  authHeaders,
  onMerged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [mergingKey, setMergingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setMatches([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = await authHeaders();
        if (!headers) return;
        const params = new URLSearchParams({ q, conversationId });
        const res = await fetch(
          `/api/messaging/conversations/same-person?${params}`,
          { headers }
        );
        const body = (await res.json().catch(() => ({}))) as {
          matches?: Match[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error || "Could not search.");
          setMatches([]);
          return;
        }
        setMatches(body.matches ?? []);
      } catch {
        if (!cancelled) setError("Could not search.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [authHeaders, conversationId, open, query]);

  const merge = async (match: Match) => {
    const key = `${match.contactId || ""}:${match.conversationId || ""}`;
    setMergingKey(key);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/messaging/conversations/same-person", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          contactId: match.contactId,
          otherConversationId: match.conversationId,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error || "Could not merge those threads.");
        return;
      }
      setOpen(false);
      setQuery("");
      setMatches([]);
      onMerged();
    } catch {
      setError("Could not merge those threads.");
    } finally {
      setMergingKey(null);
    }
  };

  return (
    <div className="mt-3">
      {open ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <label className="block text-xs font-medium text-slate-700">
            Same person as
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or email"
              autoFocus
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <p className="mt-1.5 text-xs leading-snug text-slate-500">
            Join this thread with their other channel, such as email and
            LinkedIn, so they show as one conversation.
          </p>
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          {loading ? (
            <p className="mt-2 text-xs text-slate-500">Searching…</p>
          ) : null}
          {query.trim().length >= 2 && !loading && matches.length === 0 && !error ? (
            <p className="mt-2 text-xs text-slate-500">No other person matches.</p>
          ) : null}
          <ul className="mt-2 space-y-1.5">
            {matches.map((match) => {
              const key = `${match.contactId || ""}:${match.conversationId || ""}`;
              const detail = [
                channelLabel(match.channel),
                match.businessName,
                match.email,
                match.phone ? formatPhoneDisplay(match.phone) : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={key}>
                  <button
                    type="button"
                    disabled={mergingKey === key}
                    onClick={() => void merge(match)}
                    className="flex w-full items-start justify-between gap-2 rounded-md bg-white px-2.5 py-2 text-left hover:bg-sky-50 disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {match.name || match.email || "Unnamed"}
                      </span>
                      {detail ? (
                        <span className="block truncate text-xs text-slate-500">
                          {detail}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-sky-800">
                      {mergingKey === key ? "Merging…" : "Merge"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-sky-800 hover:text-sky-950"
        >
          Same person as another thread
        </button>
      )}
    </div>
  );
}
