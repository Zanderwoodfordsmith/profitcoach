"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import type { ActivityItem } from "@/lib/launch/jobActivity";

import { ListPlan } from "./ListPlan";
import { usePractice } from "./PracticeProvider";

type Released = ActivityItem & { imported: { label: string; list: string; count: number | null }[] };
type ListsData = { admin: boolean; released: Released | null; waiting: ActivityItem | null };

/**
 * The Blueprint's Lead lists page (job 248, 21 Nov). Coaches see the lists we
 * built for them: how each one searches LinkedIn and how many people came in,
 * so it can be talked through. BCA also sees Ava's plan before it's imported,
 * to change it ("plan again") or import it.
 */
export function LeadListsPage() {
  const { authHeaders, sample, coachName } = usePractice();
  const [data, setData] = useState<ListsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const first = coachName.split(/\s+/)[0] || "the coach";

  const fetchLists = useCallback(async (): Promise<ListsData | { error: string }> => {
    const headers = await authHeaders();
    const res = await fetch("/api/coach/practice/lists", { headers: headers ?? {} }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as (ListsData & { error?: string }) | null;
    if (!res?.ok || !body) return { error: body?.error ?? "Could not load the lists." };
    return body;
  }, [authHeaders]);

  const load = useCallback(
    () =>
      fetchLists().then((result) => {
        if ("error" in result) setError(result.error);
        else setData(result);
      }),
    [fetchLists]
  );

  useEffect(() => {
    if (sample) return;
    let alive = true;
    void fetchLists().then((result) => {
      if (!alive) return;
      if ("error" in result) setError(result.error);
      else setData(result);
    });
    return () => {
      alive = false;
    };
  }, [fetchLists, sample]);

  async function act(body: Record<string, unknown>, done: string): Promise<boolean> {
    setBusy(true);
    setNote(null);
    const headers = await authHeaders();
    const res = await fetch("/api/admin/launch/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(headers ?? {}) },
      body: JSON.stringify(body),
    }).catch(() => null);
    const json = ((await res?.json().catch(() => null)) ?? null) as { error?: string; throttled?: boolean } | null;
    const err = res?.ok ? null : (json?.error ?? "Something went wrong. Try again.");
    setBusy(false);
    // LinkedIn asked us to slow down part way (23 Nov): say so, rather than look finished.
    setNote(
      err ??
        (json?.throttled
          ? "LinkedIn asked us to slow down part way. Lists it didn't reach keep their last check. Press Check lists again in an hour."
          : done)
    );
    await load();
    return !err;
  }

  if (sample) return <p className="text-read text-[var(--bp-muted)]">Your lists show here once we have built them.</p>;
  if (error) return <p className="text-sm text-rose-700">{error}</p>;
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-sm text-[var(--bp-muted)]">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading the lists…
      </p>
    );
  }

  const { waiting, released } = data;
  const coachId = waiting?.coach_id ?? released?.coach_id ?? null;

  return (
    <div data-tour="blueprint-lists" className="space-y-10">
      {waiting ? (
        <section className="space-y-4">
          <div className="bp-no-print flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-subhead font-semibold text-[var(--bp-ink)]">Ava&apos;s plan</h2>
            <span
              className="rounded-full bg-amber-50 px-2.5 py-0.5 text-ui text-amber-800 ring-1 ring-amber-200"
              title={`Once it's imported, ${first} sees the lists and how many came in.`}
            >
              Not imported · only BCA sees this
            </span>
          </div>
          {note ? (
            <p className="text-ui text-slate-700" role="status">
              {note}
            </p>
          ) : null}
          <ListPlan
            item={waiting}
            busy={busy}
            onReplan={(text) => act({ action: "draft_searches", coachId, text }, "Ava is planning the lists again. They show here when she's done.")}
            onImport={(picks) => act({ action: "import", coachId, id: waiting.id, picks }, "Importing. Each list comes in one at a time.")}
            onEdit={(searchIds, edit) => act({ action: "edit_search", coachId, id: waiting.id, searchIds, ...edit }, "Saved. LinkedIn counted it again and Ava checked 10 people from it.")}
            onSize={() => act({ action: "size_searches", coachId, id: waiting.id }, "Counted and checked. Lists with the most good people are now at the top. A ≈ means BCA's LinkedIn counted it, so it's rough.")}
          />
        </section>
      ) : null}

      {released ? (
        <section className="space-y-4">
          {waiting ? <h2 className="text-subhead font-semibold text-[var(--bp-ink)]">Lists in the Pool</h2> : null}
          <ListPlan item={released} busy={false} readOnly imported={released.imported} />
        </section>
      ) : !waiting ? (
        <p className="text-read text-[var(--bp-muted)]">
          We&apos;re building your lists of owners. They show here once they&apos;re in, with how we found each one on LinkedIn.
        </p>
      ) : null}
    </div>
  );
}
