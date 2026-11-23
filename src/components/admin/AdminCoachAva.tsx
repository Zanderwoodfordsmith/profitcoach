"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";

import { AvaPage } from "@/components/ava/AvaPage";
import { setAvaPageContext, setAvaPageHandlers, useAvaTurns } from "@/components/ava/avaPageLink";
import type { ChainState, ToCheckItem } from "@/lib/launch/avaAuto";
import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

type SourceRow = { id: string; label: string; title: string; called_at: string | null };

const DOT: Record<ChainState["state"], string> = {
  released: "bg-emerald-400",
  check: "bg-amber-400",
  next: "bg-sky-400",
  waiting: "bg-slate-400",
};

/** The Blueprint page a launch item is checked on (same rule as Launches → To check). */
function checkPage(jobKey: string): string {
  // Lead lists have their own Blueprint page since 21 Nov (job 248).
  if (jobKey === "lead-list") return "lists";
  return jobKey.startsWith("page:") ? jobKey.slice(5) : "market";
}

/**
 * The coach page's Ava tab (20 Nov): full-width Ava that only works on this
 * coach, their chats on the left, and on the right what's handing over: the
 * launch chain, anything else waiting, and the sources she reads. Admin only.
 */
export function AdminCoachAva({ coachId, coachSlug, coachName }: { coachId: string; coachSlug: string; coachName: string }) {
  const first = coachName.trim().split(/\s+/)[0] || "this coach";

  // Tell Ava whose page this is: she works on this coach and lists only their chats.
  useEffect(() => {
    setAvaPageContext({
      screenPath: `/admin/coaches/${coachSlug}?tab=ava`,
      coach: { id: coachId, name: coachName },
      bcaWork: false,
      bcaChatsOnly: true,
      starters: [
        { key: "next", primary: true, label: `What should we do next for ${first}?`, prompt: `What should we do next for ${first}? Look at their launch and what's waiting.` },
        { key: "check", label: `Go through ${first}'s blueprint with me`, prompt: `Let's go through ${first}'s blueprint together and check it's right.` },
        { key: "sources", label: `What have we learned from ${first}'s sources?`, prompt: `Read ${first}'s sources (call notes, voice notes) and tell me what's most useful for their blueprint and content.` },
      ],
      greeting: `Working on ${coachName}`,
      intro: `Everything here is about ${first}. Nothing reaches ${first} until you press Save or Send.`,
    });
    return () => {
      setAvaPageContext(null);
      setAvaPageHandlers({});
    };
  }, [coachId, coachSlug, coachName, first]);

  return (
    <div className="h-[calc(100dvh-11.5rem)] min-h-[32rem] overflow-hidden rounded-lg">
      <AvaPage
        embedded
        chatsLabel={`${first}'s chats`}
        aside={<HandingOver coachId={coachId} coachSlug={coachSlug} first={first} />}
      />
    </div>
  );
}

function HandingOver({ coachId, coachSlug, first }: { coachId: string; coachSlug: string; first: string }) {
  const turns = useAvaTurns();
  const [chain, setChain] = useState<ChainState[] | null>(null);
  const [items, setItems] = useState<ToCheckItem[]>([]);
  const [sources, setSources] = useState<SourceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const token = await getValidSupabaseAccessToken();
    if (!token) return null;
    const headers = { Authorization: `Bearer ${token}` };
    return Promise.all([
      fetch(`/api/admin/launch/to-check?coach=${encodeURIComponent(coachId)}`, { headers }).then((r) => r.json()).catch(() => null),
      fetch(`/api/admin/coaches/${encodeURIComponent(coachSlug)}/sources`, { headers }).then((r) => r.json()).catch(() => null),
    ]);
  }, [coachId, coachSlug]);

  // Again after each of Ava's turns: she may have drafted or released something.
  useEffect(() => {
    let live = true;
    void fetchAll().then((result) => {
      if (!live || !result) return;
      const [check, src] = result;
      setError(!check || check.error ? (check?.error ?? "Couldn't load what's waiting.") : null);
      setChain((check?.chains?.[coachId] as ChainState[] | undefined) ?? []);
      setItems((check?.items as ToCheckItem[] | undefined) ?? []);
      setSources((src?.sources as SourceRow[] | undefined) ?? []);
    });
    return () => {
      live = false;
    };
  }, [fetchAll, coachId, turns]);

  const base = `/admin/coaches/${encodeURIComponent(coachSlug)}`;
  const checkHref = (page: string) => `${base}?tab=blueprint&doc=${encodeURIComponent(page)}&panel=activity`;
  const others = items.filter((item) => !chain?.some((step) => step.itemId === item.id));
  const waiting = (chain?.filter((s) => s.state === "check").length ?? 0) + others.length;

  return (
    <div className="space-y-6 px-4 py-4 text-sm">
      <section>
        <h2 className="flex items-baseline justify-between gap-2 text-[0.9375rem] font-semibold">
          Handing over
          {chain ? <span className="text-xs font-normal text-[var(--ava-muted)]">{waiting ? `${waiting} to check` : "Nothing to check"}</span> : null}
        </h2>
        {chain === null ? (
          <p className="mt-3 flex items-center gap-2 text-[var(--ava-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading
          </p>
        ) : (
          <>
            {error ? <p className="mt-2 text-rose-300">{error}</p> : null}
            {chain.length ? (
              <ol className="mt-2 space-y-0.5">
                {chain.map((step) => {
                  const row = (
                    <>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[step.state]}`} aria-hidden />
                      <span className={`min-w-0 flex-1 truncate ${step.state === "released" ? "text-[var(--ava-muted)]" : "font-medium"}`}>{step.label}</span>
                      {step.state === "check" ? <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ava-muted)]" aria-hidden /> : null}
                    </>
                  );
                  return (
                    <li key={step.id} title={step.note}>
                      {step.state === "check" ? (
                        <Link href={checkHref(checkPage(step.scope))} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-white/10">
                          {row}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2.5 px-2 py-1.5">{row}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : null}
            {others.length ? (
              <>
                <p className="mt-3 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--ava-muted)]">Also waiting</p>
                <ul className="mt-1 space-y-0.5">
                  {others.map((item) => (
                    <li key={item.id}>
                      <Link href={checkHref(checkPage(item.job_key))} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-white/10">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{item.what}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ava-muted)]" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {!chain.length && !others.length && !error ? (
              <p className="mt-2 text-[var(--ava-muted)]">Nothing from Ava waiting for {first}.</p>
            ) : null}
          </>
        )}
      </section>

      <section>
        <h2 className="flex items-baseline justify-between gap-2 text-[0.9375rem] font-semibold">
          Sources
          <Link href={`${base}?tab=sources`} className="text-xs font-normal text-[var(--ava-muted)] hover:text-[var(--ava-ink)]">
            Add or manage
          </Link>
        </h2>
        {sources === null ? null : sources.length ? (
          <ul className="mt-2 space-y-0.5">
            {sources.map((s) => (
              <li key={s.id}>
                <Link href={`${base}?tab=sources`} className="block rounded-md px-2 py-1.5 hover:bg-white/10">
                  <span className="block truncate font-medium">{s.title || s.label}</span>
                  <span className="block truncate text-xs text-[var(--ava-muted)]">
                    {s.label}
                    {s.called_at ? ` · ${new Date(s.called_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[var(--ava-muted)]">No sources yet.</p>
        )}
      </section>
    </div>
  );
}
