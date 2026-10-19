"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";
import type { DeckCard, Introducer, NetworkRating, NetworkSummary } from "@/lib/referrals/network";
import { NetworkPhoto, NetworkSwipe } from "@/components/referrals/NetworkSwipe";

type Payload = { summary: NetworkSummary; deck: DeckCard[]; introducers: Introducer[] };

const TOP_UP_BELOW = 10;
const API = "/api/admin/referrals";

async function adminHeaders(): Promise<Record<string, string> | null> {
  const token = await getValidSupabaseAccessToken();
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : null;
}

const LEAD_STATUS: Record<string, string> = {
  queued: "Not contacted yet",
  invited: "Invite sent",
  connected: "Connected",
  in_sequence: "In the sequence",
  replied: "Replied",
  interested: "Interested",
  call_offered: "Call offered",
  completed: "Sequence finished",
  paused: "Paused",
  skipped: "Skipped",
  failed: "Invite failed",
};

function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}

/** Plain ask the coach can send on WhatsApp or LinkedIn. */
function askText(introducer: Introducer): string {
  const lines = introducer.people.map((p) => `- ${p.name}${p.headline ? `, ${p.headline}` : ""}`);
  return [
    `Hi ${firstName(introducer.name)}, I noticed you're connected to a few people I'm hoping to reach:`,
    "",
    ...lines,
    "",
    "Do you know any of them well enough to pass on a note from me? Happy to return the favour.",
  ].join("\n");
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Admin only for now (Tools and links → Referrals). Rates and reads one coach's network. */
export function ReferralsHub({ coachId, coachName }: { coachId: string; coachName: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [deck, setDeck] = useState<DeckCard[]>([]);
  const [history, setHistory] = useState<Array<{ card: DeckCard; rating: NetworkRating }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const rated = useRef(new Set<string>());
  const toppingUp = useRef(false);

  const apply = useCallback((body: Payload) => {
    rated.current.clear();
    setData(body);
    setDeck(body.deck);
    setHistory([]);
  }, []);

  const load = useCallback(async () => {
    const headers = await adminHeaders();
    if (!headers) {
      setError("Sign in again to load Referrals.");
      return;
    }
    const res = await fetch(`${API}?coachId=${coachId}`, { headers });
    const body = (await res.json().catch(() => null)) as (Payload & { error?: string }) | null;
    if (!res.ok || !body?.summary) setError(body?.error ?? "Could not load Referrals.");
    else apply(body);
  }, [coachId, apply]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await adminHeaders();
      if (!headers || cancelled) return;
      const res = await fetch(`${API}?coachId=${coachId}`, { headers });
      const body = (await res.json().catch(() => null)) as (Payload & { error?: string }) | null;
      if (cancelled) return;
      if (!res.ok || !body?.summary) setError(body?.error ?? "Could not load Referrals.");
      else apply(body);
    })();
    return () => {
      cancelled = true;
    };
  }, [coachId, apply]);

  const topUp = async () => {
    if (toppingUp.current) return;
    toppingUp.current = true;
    try {
      const headers = await adminHeaders();
      if (!headers) return;
      const res = await fetch(`${API}?coachId=${coachId}&only=deck`, { headers });
      const body = (await res.json().catch(() => null)) as { deck?: DeckCard[] } | null;
      if (!res.ok || !body?.deck) return;
      setDeck((current) => {
        const seen = new Set(current.map((c) => c.publicIdentifier));
        return [
          ...current,
          ...body.deck!.filter((c) => !seen.has(c.publicIdentifier) && !rated.current.has(c.publicIdentifier)),
        ];
      });
    } finally {
      toppingUp.current = false;
    }
  };

  const save = async (publicIdentifier: string, rating: NetworkRating | null) => {
    const headers = await adminHeaders();
    if (!headers) return false;
    const res = await fetch(API, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ coachId, publicIdentifier, rating }),
    });
    return res.ok;
  };

  const bump = (rating: NetworkRating, by: number) =>
    setData((d) =>
      d
        ? { ...d, summary: { ...d.summary, unrated: d.summary.unrated - by, [rating]: d.summary[rating] + by } }
        : d
    );

  const rate = async (rating: NetworkRating) => {
    const card = deck[0];
    if (!card) return;
    rated.current.add(card.publicIdentifier);
    setDeck((d) => d.filter((c) => c.publicIdentifier !== card.publicIdentifier));
    setHistory((h) => [...h.slice(-49), { card, rating }]);
    bump(rating, 1);
    if (deck.length - 1 < TOP_UP_BELOW) void topUp();

    if (!(await save(card.publicIdentifier, rating))) {
      rated.current.delete(card.publicIdentifier);
      setDeck((d) => [card, ...d]);
      setHistory((h) => h.filter((x) => x.card.publicIdentifier !== card.publicIdentifier));
      bump(rating, -1);
      setError("Could not save that one. Try again.");
    }
  };

  const undo = async () => {
    const last = history[history.length - 1];
    if (!last) return;
    rated.current.delete(last.card.publicIdentifier);
    setHistory((h) => h.slice(0, -1));
    setDeck((d) => [last.card, ...d.filter((c) => c.publicIdentifier !== last.card.publicIdentifier)]);
    bump(last.rating, -1);
    if (!(await save(last.card.publicIdentifier, null))) setError("Could not undo that one.");
  };

  const sync = async () => {
    setSyncing(true);
    setError(null);
    const headers = await adminHeaders();
    if (!headers) {
      setSyncing(false);
      return;
    }
    const res = await fetch(`${API}/sync`, { method: "POST", headers, body: JSON.stringify({ coachId }) });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) setError(body?.error ?? "Could not read the LinkedIn connections.");
    else await load();
    setSyncing(false);
  };

  const copyAsk = async (introducer: Introducer) => {
    try {
      await navigator.clipboard.writeText(askText(introducer));
      setCopied(introducer.coachId);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  const s = data?.summary;
  const rateable = s ? s.known + s.unknown + s.unrated : 0;
  const done = s ? s.known + s.unknown : 0;

  return (
    <div className="space-y-12">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{coachName}&apos;s network</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Rate only your own network. Mark the people who would recognise your name. When one of them is on another member&apos;s prospect list,
              that member can ask you for an introduction. Only people you mark True are ever shown to anyone, and
              nobody sees your full network.
            </p>
          </div>
          {s && s.total > 0 ? (
            <div className="text-right text-xs text-slate-500">
              <p>
                {s.total.toLocaleString("en-GB")} connections
                {s.syncedAt ? `, read ${shortDate(s.syncedAt)}` : ""}
              </p>
              <button
                type="button"
                onClick={sync}
                disabled={syncing}
                className="mt-1 font-medium text-sky-700 hover:underline disabled:opacity-50"
              >
                {syncing ? "Reading LinkedIn…" : "Read again"}
              </button>
            </div>
          ) : null}
        </div>

        {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}

        {!data ? (
          error ? null : <p className="mt-8 text-sm text-slate-500">Loading the network…</p>
        ) : s && s.total === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-700">
            <p>{coachName}&apos;s network isn&apos;t loaded.</p>
            <p className="mt-2 text-slate-500">
              {s.linkedinConnected
                ? "Ask them first. Then load it with scripts/sync-coach-network.ts. It only reads their connections list; nothing is posted or sent."
                : "They haven't connected LinkedIn yet."}
            </p>
          </div>
        ) : (
          <div className="mt-8">
            {s ? (
              <div className="mx-auto mb-6 max-w-md">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>
                    <span className="font-semibold text-slate-800">{s.known.toLocaleString("en-GB")}</span> True,{" "}
                    {s.unknown.toLocaleString("en-GB")} don&apos;t know
                  </span>
                  <span>{s.unrated.toLocaleString("en-GB")} to go</span>
                </div>
                <div className="mt-2 h-1 rounded bg-slate-100">
                  <div
                    className="h-1 rounded bg-gradient-to-r from-[#0c5290] to-[#1a8fd4]"
                    style={{ width: `${rateable ? Math.min(100, (100 * done) / rateable) : 0}%` }}
                  />
                </div>
              </div>
            ) : null}
            {deck.length > 0 ? (
              <NetworkSwipe
                card={deck[0]}
                nextCard={deck[1] ?? null}
                canUndo={history.length > 0}
                onRate={(r) => void rate(r)}
                onUndo={() => void undo()}
              />
            ) : (
              <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-700">
                {s && s.unrated > 0 ? (
                  "Loading the next people…"
                ) : (
                  <>
                    You&apos;ve been through everyone. {s?.known.toLocaleString("en-GB")} people would recognise your name.
                    {history.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => void undo()}
                        className="mt-3 block w-full text-xs font-medium text-slate-500 hover:text-slate-800"
                      >
                        Undo the last one
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Members who can introduce {firstName(coachName)}</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          People on {firstName(coachName)}&apos;s campaign lists that another member knows. An introduction from someone they know lands very
          differently from a cold invite.
        </p>
        {data && data.introducers.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No matches yet. As members mark the people they know, anyone on these campaign lists shows up here with who
            can introduce them.
          </p>
        ) : null}
        <div className="mt-4 space-y-3">
          {data?.introducers.map((intro) => (
            <details key={intro.coachId} className="group rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                <NetworkPhoto name={intro.name} url={intro.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{intro.name}</span>
                  <span className="block text-xs text-slate-500">
                    Knows {intro.people.length} {intro.people.length === 1 ? "person" : "people"} on these campaign lists
                  </span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    void copyAsk(intro);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {copied === intro.coachId ? "Copied" : "Copy ask"}
                </button>
                <span className="text-slate-400 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden>
                  ›
                </span>
              </summary>
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {intro.people.map((p) => (
                  <li key={p.publicIdentifier} className="flex items-center gap-3 px-4 py-2.5">
                    <NetworkPhoto name={p.name} url={p.photoUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <a
                        href={p.profileUrl ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm font-medium text-slate-900 hover:underline"
                      >
                        {p.name}
                      </a>
                      {p.headline ? <span className="block truncate text-xs text-slate-500">{p.headline}</span> : null}
                    </span>
                    {p.leadStatus ? (
                      <span className="shrink-0 text-xs text-slate-500">{LEAD_STATUS[p.leadStatus] ?? p.leadStatus}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
