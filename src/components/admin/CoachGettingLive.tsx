"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Hourglass, Layers, LifeBuoy, Linkedin, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { WorkshopActivityPanel } from "@/components/BossGrid/WorkshopActivityPanel";
import { badgeClass, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import type { GettingLiveComment, GettingLiveData, GettingLiveRow, GettingLiveUpdate, WaitsOn } from "@/lib/gettingLive";
import { GETTING_LIVE_GROUPS, GETTING_LIVE_STEPS, stepGroupLabel } from "@/lib/gettingLiveSteps";
import type { WorkshopComment } from "@/lib/playbookSessionNotes";
import { COACH_DRAFTS } from "@/app/admin/plan/drafts";
import { CoachDrafts } from "@/components/admin/CoachDrafts";

/**
 * A coach's admin page → Getting live tab: their steps from paying to a first
 * client (in three groups), and a comment thread on the right, like a roadmap
 * job popup. The list of everyone is Coaches → Getting live.
 */

export const WAITS_TONE: Record<WaitsOn, BadgeTone> = { coach: "amber", bca: "blue" };
export const WAITS_LABEL: Record<WaitsOn, string> = { coach: "Coach", bca: "BCA" };

export function daysAgo(iso: string | null): string {
  if (!iso) return "–";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? "today" : `${d}d ago`;
}

/** Admin calls as the admin, never as a coach being viewed. */
export async function gettingLiveAdminHeaders(): Promise<Record<string, string> | null> {
  const headers = await getCoachAuthHeaders(null);
  if (!headers) return null;
  delete headers["x-impersonate-coach-id"];
  return headers;
}

/** Comments in the shape the BOSS Pro comments panel uses, and back. */
function toPanelComments(comments: GettingLiveComment[]): WorkshopComment[] {
  return comments.map((c) => ({
    id: c.id,
    author: "coach",
    authorName: c.by_name ?? "Admin",
    text: c.body,
    createdAt: c.at,
    editedAt: c.edited_at ?? undefined,
    replies: c.replies.map((r) => ({ id: r.id, author: "coach", authorName: r.by_name ?? "Admin", text: r.body, createdAt: r.at })),
  }));
}

function fromPanelComments(comments: WorkshopComment[]): GettingLiveComment[] {
  return comments.map((c) => ({
    id: c.id,
    by: null,
    by_name: c.authorName ?? null,
    at: c.createdAt,
    body: c.text,
    edited_at: c.editedAt ?? null,
    replies: c.replies.map((r) => ({ id: r.id, by: null, by_name: r.authorName ?? null, at: r.createdAt, body: r.text })),
  }));
}

/** One label and value under the coach's header, laid out like a roadmap job's Properties row. */
function PropRow({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-3 text-sm">
      <dt className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className="min-w-0 text-slate-800">{children}</dd>
    </div>
  );
}

export function CoachGettingLive({ coachId }: { coachId: string }) {
  const [data, setData] = useState<GettingLiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState<WorkshopComment[]>([]);
  const [commentsCollapsed, setCommentsCollapsed] = useState(false);
  // Everyone on the list, in list order, for Previous and Next.
  const [order, setOrder] = useState<{ slug: string; name: string }[]>([]);
  const draftsRef = useRef<HTMLDivElement>(null);
  const from = useSearchParams().get("from") ?? "getting-live";

  const load = useCallback(async () => {
    const headers = await gettingLiveAdminHeaders();
    if (!headers) return;
    const res = await fetch(`/api/admin/getting-live?coach_id=${encodeURIComponent(coachId)}`, { headers });
    const body = (await res.json().catch(() => null)) as (GettingLiveData & { error?: string }) | null;
    if (!res.ok || !body?.rows) {
      setError(body?.error ?? "Could not load Getting live.");
      return;
    }
    setError(null);
    setData(body);
    setComments(toPanelComments(body.rows.find((r) => r.coach_id === coachId)?.comments ?? []));
  }, [coachId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const headers = await gettingLiveAdminHeaders();
      if (!headers) return;
      const res = await fetch("/api/admin/getting-live", { headers });
      const body = (await res.json().catch(() => null)) as GettingLiveData | null;
      if (res.ok && body?.rows) setOrder(body.rows.flatMap((r) => (r.slug ? [{ slug: r.slug, name: r.name }] : [])));
    })();
  }, []);

  const save = async (update: Omit<GettingLiveUpdate, "coach_id">) => {
    const headers = await gettingLiveAdminHeaders();
    if (!headers) return;
    setBusy(true);
    const res = await fetch("/api/admin/getting-live", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ coach_id: coachId, ...update }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not save that.");
    }
    await load();
    setBusy(false);
  };

  if (error && !data) return <p className="text-sm text-rose-700">{error}</p>;
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking where this coach is…
      </p>
    );
  }

  const row: GettingLiveRow | undefined = data.rows.find((r) => r.coach_id === coachId);
  if (!row) {
    return (
      <div className={cardClass("plain", "space-y-3 p-5")}>
        <p className="text-sm text-slate-700">
          Not on the Getting live list. Everyone who first paid in the last 90 days is on it; add anyone else by hand.
        </p>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <button
          type="button"
          disabled={!data.storage || busy}
          onClick={() => void save({ add: true })}
          className={buttonClass("main", "small")}
        >
          Add to Getting live
        </button>
      </div>
    );
  }

  const drafts = row.slug ? COACH_DRAFTS[row.slug] : undefined;

  return (
    <div
      className={cardClass(
        "plain",
        "flex flex-col overflow-hidden lg:h-[calc(100dvh-11.5rem)] lg:min-h-[32rem] lg:flex-row"
      )}
    >
      {/* Main */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 pb-8 pt-6 md:px-8">
        <CoachSwitcher order={order} slug={row.slug} from={from} />
        <p className="text-sm text-slate-700">{row.next_action}</p>
        {drafts ? (
          <button
            type="button"
            onClick={() => draftsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className={buttonClass("main", "small", "mt-3")}
          >
            Drafts to check: LinkedIn and messages
          </button>
        ) : null}

        <dl className="mt-4 grid gap-x-10 gap-y-1 sm:grid-cols-2">
          <PropRow icon={Hourglass} label="Waits on">
            {row.waits_on ? <span className={badgeClass(WAITS_TONE[row.waits_on])}>{WAITS_LABEL[row.waits_on]}</span> : "Nobody"}
          </PropRow>
          <PropRow icon={Layers} label="Stage">
            {stepGroupLabel(row.current)}
          </PropRow>
          <PropRow icon={CalendarDays} label="Joined">
            {row.joined_at ? new Date(row.joined_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–"}
          </PropRow>
          <PropRow icon={Clock} label="Last in app">
            {daysAgo(row.last_active_at)}
          </PropRow>
          <PropRow icon={Linkedin} label="LinkedIn">
            {row.linkedin_connected ? "Connected" : <span className="text-rose-700">Not connected</span>}
          </PropRow>
          <PropRow icon={LifeBuoy} label="Tickets">
            {row.open_tickets ? (
              <Link href="/admin/support" className="font-medium text-[#0c5290] hover:underline">
                {row.open_tickets} open
              </Link>
            ) : (
              "None open"
            )}
          </PropRow>
        </dl>

        <div className="mt-6 border-t border-slate-200" role="presentation" />

        {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
        {!data.storage ? (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            You can see the steps, but ticking by hand needs the database table first.
          </p>
        ) : null}
        {!data.comments_storage ? (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Comments are read-only until the database change for comments is applied.
          </p>
        ) : null}

        <div className="mt-5 space-y-5">
          {GETTING_LIVE_GROUPS.map((group) => (
            <section key={group.key}>
              <h3 className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-slate-500">{group.label}</h3>
              <ol className="space-y-1">
                {row.steps
                  .filter((step) => GETTING_LIVE_STEPS.find((s) => s.key === step.key)?.group === group.key)
                  .map((step) => {
                    const isCurrent = step.key === row.current;
                    return (
                      <li key={step.key}>
                        <label
                          className={`flex items-start gap-3 rounded-md px-2 py-1.5 ${isCurrent ? "bg-slate-100" : ""} ${
                            step.source === "app" || !data.storage ? "cursor-default" : "cursor-pointer hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-slate-900"
                            checked={step.done}
                            disabled={step.source === "app" || !data.storage || busy}
                            onChange={(e) => void save({ tick: { step: step.key, on: e.target.checked } })}
                          />
                          <span className="min-w-0">
                            <span className={`text-sm ${step.done ? "text-slate-500" : "font-medium text-slate-900"}`}>{step.label}</span>
                            {step.source === "app" ? <span className="ml-2 text-xs text-slate-400">from the app</span> : null}
                            {step.detail ? <span className="block text-xs text-slate-500">{step.detail}</span> : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))}
        </div>

        {drafts ? (
          <div ref={draftsRef} className="mt-10 scroll-mt-4 border-t border-slate-200 pt-8">
            <CoachDrafts d={drafts} />
          </div>
        ) : null}

        <div className="mt-8">
          <button
            type="button"
            disabled={!data.storage || busy}
            onClick={() => void save({ hidden: true })}
            className={buttonClass("quiet", "small")}
          >
            Take off the list
          </button>
        </div>
      </div>

      {/* Comments: the same panel as a roadmap job popup */}
      <WorkshopActivityPanel
        activity={[]}
        comments={comments}
        editable={data.comments_storage}
        defaultAuthor="coach"
        defaultAuthorName="You"
        onCommentsChange={(next) => {
          setComments(next);
          void save({ comments: fromPanelComments(next) });
        }}
        onActivityAppend={() => {}}
        collapsed={commentsCollapsed}
        onCollapsedChange={setCommentsCollapsed}
        allowManage
        emptyText="No comments yet."
      />
    </div>
  );
}

/** Previous and Next through the Getting live list, so Zander can go coach to coach. */
function CoachSwitcher({ order, slug, from }: { order: { slug: string; name: string }[]; slug: string | null; from: string }) {
  const i = slug ? order.findIndex((o) => o.slug === slug) : -1;
  if (i < 0 || order.length < 2) return null;
  const prev = order[(i - 1 + order.length) % order.length];
  const next = order[(i + 1) % order.length];
  const href = (s: string) => `/admin/coaches/${encodeURIComponent(s)}?tab=getting-live&from=${encodeURIComponent(from)}`;
  return (
    <nav aria-label="Other coaches" className="mb-4 flex items-center justify-between gap-3 text-sm">
      <Link href={href(prev.slug)} className="inline-flex min-w-0 items-center gap-1 text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{prev.name}</span>
      </Link>
      <span className="shrink-0 tabular-nums text-slate-400">
        {i + 1} of {order.length}
      </span>
      <Link href={href(next.slug)} className="inline-flex min-w-0 items-center gap-1 text-slate-600 hover:text-slate-900">
        <span className="truncate">{next.name}</span>
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
      </Link>
    </nav>
  );
}
