"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Loader2, Pause, X } from "lucide-react";

import { buttonClass } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { NUDGE_RULES, NUDGE_SECTION, NUDGE_TEMPLATES, nudgeSection } from "@/lib/ava/nudgeRules";
import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { sectionByKey } from "@/lib/practiceKnowledge/blueprint";

type View = "queued" | "approved" | "rejected";
type Action = "approve" | "reject" | "save" | "snooze";

type Nudge = {
  id: string;
  coach_id: string;
  coach_name: string;
  coach_slug: string;
  scan_date: string;
  level: "red" | "amber" | "green";
  stuck_at: string;
  next_step: string | null;
  body: string;
  status: "queued" | "approved" | "rejected" | "posted" | "skipped";
  decided_at: string | null;
  posted_at: string | null;
  note: string | null;
};

const VIEW_LABEL: Record<View, string> = { queued: "To approve", approved: "Approved", rejected: "Rejected" };

const LEVEL_DOT: Record<Nudge["level"], string> = {
  red: "bg-rose-500",
  amber: "bg-amber-400",
  green: "bg-emerald-500",
};

const STATUS_LABEL: Record<Nudge["status"], string> = {
  queued: "Waiting",
  approved: "Approved, posts within the hour",
  rejected: "Rejected",
  posted: "Posted",
  skipped: "Dropped",
};

async function adminHeaders(): Promise<Record<string, string> | null> {
  const headers = await getCoachAuthHeaders(null);
  if (!headers) return null;
  delete headers["x-impersonate-coach-id"];
  return headers;
}

function day(ymd: string) {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Where a nudge lands: the chat on one of the coach's Blueprint pages, and the admin link to that page. */
function destination(row: Nudge) {
  const ref = sectionByKey(nudgeSection(row.stuck_at));
  if (!ref) return null;
  return {
    label: ref.page.title,
    section: ref.section.title,
    href: `/admin/blueprint/coach/${ref.page.slug}?coach=${encodeURIComponent(row.coach_id)}`,
  };
}

/**
 * Admin → Ava → Nudges: each morning Ava drafts a nudge for every stuck coach.
 * BCA edits, approves or rejects; nothing reaches a coach until approved. One
 * compact row per nudge (5 Nov), with where it will post.
 */
export function AvaNudgeQueue() {
  const [view, setView] = useState<View>("queued");
  const [rows, setRows] = useState<Nudge[]>([]);
  const [counts, setCounts] = useState<Partial<Record<View, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const headers = await adminHeaders();
      if (cancelled) return;
      if (!headers) {
        setError("Sign in again to load nudges.");
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/admin/ava/nudges?view=${view}`, { headers });
      const body = (await res.json().catch(() => null)) as { rows?: Nudge[]; counts?: Record<View, number>; error?: string } | null;
      if (cancelled) return;
      if (!res.ok || !body?.rows) setError(body?.error ?? "Could not load nudges.");
      else {
        setError(null);
        setRows(body.rows);
        setCounts(body.counts ?? {});
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [view, reload]);

  const decide = async (row: Nudge, action: Action, text: string, days?: number) => {
    const headers = await adminHeaders();
    if (!headers) return false;
    const res = await fetch("/api/admin/ava/nudges", { method: "PATCH", headers, body: JSON.stringify({ id: row.id, action, body: text, days }) });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not save.");
      return false;
    }
    setError(null);
    if (action === "save") {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, body: text } : r)));
    } else {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      const to: View = action === "approve" ? "approved" : "rejected";
      if (action === "snooze") setScanNote(`${row.coach_name || "Coach"}: nudges paused for ${days} days.`);
      setCounts((c) => ({ ...c, queued: Math.max(0, (c.queued ?? 1) - 1), [to]: (c[to] ?? 0) + 1 }));
    }
    return true;
  };

  const scan = async () => {
    setScanning(true);
    setScanNote(null);
    const headers = await adminHeaders();
    if (headers) {
      const res = await fetch("/api/admin/ava/nudges", { method: "POST", headers });
      const body = (await res.json().catch(() => null)) as { stuck?: number; queued?: number; kept?: number; skipped?: number; error?: string } | null;
      if (!res.ok) setError(body?.error ?? "Scan failed.");
      else setScanNote(`${body?.stuck ?? 0} coaches stuck: ${body?.queued ?? 0} new, ${body?.kept ?? 0} still waiting, ${body?.skipped ?? 0} dropped.`);
      setReload((n) => n + 1);
    }
    setScanning(false);
  };

  return (
    <div className="w-full max-w-[90rem] px-4 pb-16 pt-6 md:px-6">
      <p className="max-w-3xl text-sm leading-6 text-slate-600">
        Every morning Ava drafts a nudge for each coach who is stuck. Edit it, then approve or reject. Nothing reaches a
        coach until you approve it. Approved nudges post in the chat on the Blueprint page shown, signed as Ava. They
        aren&apos;t emailed, so the coach sees them next time they open the app.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              if (v === view) return;
              setLoading(true);
              setView(v);
            }}
            aria-pressed={view === v}
            className={`rounded-full px-3 py-1 text-sm ${view === v ? "bg-slate-900 font-medium text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
          >
            {VIEW_LABEL[v]}
            {counts[v] != null ? <span className="ml-1.5 tabular-nums opacity-70">{counts[v]}</span> : null}
          </button>
        ))}
        <button type="button" onClick={() => setRulesOpen(true)} className={buttonClass("quiet", "small", "ml-auto")}>
          How nudges work
        </button>
        <button type="button" onClick={() => void scan()} disabled={scanning} className={buttonClass("second", "small")}>
          {scanning ? "Checking coaches…" : "Check coaches now"}
        </button>
      </div>
      {scanNote ? <p className="mt-3 text-sm text-slate-600">{scanNote}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="mt-5 text-sm text-slate-500">Loading nudges…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">
          {view === "queued" ? "Nothing waiting. New nudges arrive each morning." : "None yet."}
        </p>
      ) : null}

      <Modal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title="How nudges work"
        subtitle="The rules Ava follows. They come from the code, so this is what actually happens."
        maxWidthClassName="max-w-6xl"
        overlayClassName="z-[100]"
      >
        <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto px-5 pb-6 pt-4">
          <NudgeRules />
        </div>
      </Modal>

      {rows.length ? (
        <div className="mt-4 overflow-clip rounded-xl border border-slate-200 bg-white">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[13rem]" />
              <col />
              <col className="w-[10.5rem]" />
              <col className="w-[7.5rem]" />
              <col className="w-[8rem]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                <th scope="col" className="px-4 py-2.5 font-medium">Coach</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Message from Ava</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Posts in</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Drafted</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  {view === "queued" ? "Approve" : "Status"}
                </th>
              </tr>
            </thead>
            {groupByReason(rows).map((group) => (
              <tbody key={group.reason}>
                <tr>
                  <th scope="colgroup" colSpan={5} className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-left">
                    <span className="text-[0.8125rem] font-semibold text-slate-800">{group.reason}</span>
                    <span className="ml-2 text-xs font-normal tabular-nums text-slate-500">{group.rows.length}</span>
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <NudgeRow key={row.id} row={row} onDecide={decide} />
                ))}
              </tbody>
            ))}
          </table>
        </div>
      ) : null}
    </div>
  );
}

/** Rows grouped by why the coach is stuck, in the order a coach moves through them. */
function groupByReason(rows: Nudge[]) {
  const order = Object.keys(NUDGE_SECTION);
  const groups = new Map<string, Nudge[]>();
  for (const row of rows) groups.set(row.stuck_at, [...(groups.get(row.stuck_at) ?? []), row]);
  const rank = (reason: string) => (order.includes(reason) ? order.indexOf(reason) : order.length);
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b)).map(([reason, list]) => ({ reason, rows: list }));
}

function NudgeRow({
  row,
  onDecide,
}: {
  row: Nudge;
  onDecide: (row: Nudge, action: Action, text: string, days?: number) => Promise<boolean>;
}) {
  const [text, setText] = useState(row.body);
  const [saving, setSaving] = useState<null | Action>(null);
  const editable = row.status === "queued" || row.status === "approved";
  const changed = text.trim() !== row.body.trim();
  const goes = destination(row);
  const name = row.coach_name || row.coach_slug || "Coach";

  const run = async (action: Action, days?: number) => {
    setSaving(action);
    await onDecide(row, action, text, days);
    setSaving(null);
  };

  const cell = "border-b border-slate-100 px-4 py-2.5 align-top";
  return (
    <tr className="group/row hover:bg-slate-50/60">
      <td className={cell}>
        <div className="flex items-center gap-2 pt-1">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT[row.level]}`}
            title={row.level === "red" ? "Red: stuck" : row.level === "amber" ? "Amber: slowing down" : "Green"}
            aria-hidden
          />
          <Link href={`/admin/coaches/${row.coach_slug}`} className="truncate font-medium text-slate-900 hover:underline" title={row.next_step ? `Coach health says: ${row.next_step}` : undefined}>
            {name}
          </Link>
        </div>
      </td>
      <td className={cell}>
        {editable ? (
          <textarea
            id={`nudge-${row.id}`}
            aria-label={`Nudge for ${name}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="-mx-2 block w-[calc(100%+1rem)] resize-none rounded-md border border-transparent bg-transparent px-2 py-1 text-sm leading-6 text-slate-800 [field-sizing:content] hover:border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none"
          />
        ) : (
          <p className="whitespace-pre-wrap py-1 text-sm leading-6 text-slate-700">{row.body}</p>
        )}
      </td>
      <td className={cell}>
        {goes ? (
          <Link
            href={goes.href}
            title={`${goes.label}, beside ${goes.section}`}
            className="inline-flex max-w-full items-center gap-1 pt-1 text-slate-600 hover:text-slate-900"
          >
            <span className="truncate">{goes.label}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          </Link>
        ) : null}
      </td>
      <td className={`${cell} whitespace-nowrap pt-3.5 tabular-nums text-slate-500`}>{day(row.scan_date)}</td>
      <td className={`${cell} text-right`}>
        {row.status === "queued" ? (
          <div className="flex items-center justify-end gap-0.5">
            <PauseMenu name={name} disabled={saving != null} onPause={(days) => void run("snooze", days)} />
            <button
              type="button"
              disabled={saving != null}
              onClick={() => void run("reject")}
              aria-label={`Reject nudge for ${name}`}
              title="Reject"
              className="flex h-8 w-8 items-center justify-center rounded-full text-rose-600 hover:bg-rose-50 disabled:opacity-40"
            >
              {saving === "reject" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <X className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />}
            </button>
            <button
              type="button"
              disabled={saving != null || !text.trim()}
              onClick={() => void run("approve")}
              aria-label={changed ? `Approve nudge for ${name} with your edits` : `Approve nudge for ${name}`}
              title={changed ? "Approve with your edits" : "Approve"}
              className={`flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-40 ${
                changed ? "bg-emerald-600 text-white hover:bg-emerald-700" : "text-emerald-600 hover:bg-emerald-50"
              }`}
            >
              {saving === "approve" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />}
            </button>
          </div>
        ) : row.status === "approved" && changed ? (
          <button type="button" disabled={saving != null} onClick={() => void run("save")} className={buttonClass("main", "small")}>
            {saving === "save" ? "Saving…" : "Save edits"}
          </button>
        ) : (
          <span className="inline-block pt-1 text-xs text-slate-500" title={row.status === "skipped" && row.note ? row.note : undefined}>
            {STATUS_LABEL[row.status]}
          </span>
        )}
      </td>
    </tr>
  );
}

/** Pause one coach's nudges for a week, two weeks or a month. */
function PauseMenu({ name, disabled, onPause }: { name: string; disabled: boolean; onPause: (days: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Pause ${name}'s nudges`}
        title="Pause this coach's nudges"
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
      >
        <Pause className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div className="absolute right-0 top-9 z-20 w-40 rounded-lg border border-slate-200 bg-white p-1 text-left shadow-lg">
          <p className="px-2.5 pb-1 pt-1.5 text-xs text-slate-500">Pause nudges for</p>
          {[
            [7, "1 week"],
            [14, "2 weeks"],
            [30, "1 month"],
          ].map(([days, label]) => (
            <button
              key={days}
              type="button"
              onClick={() => {
                setOpen(false);
                onPause(days as number);
              }}
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** "How nudges work": who counts as stuck, what Ava says, where it posts, and the limits. */
function NudgeRules() {
  const example = { first: "Sam", invites_7d: 12, accept: "8%", interested: 4 };
  const h = "text-sm font-semibold text-slate-900";
  const li = "text-sm leading-6 text-slate-700";
  return (
    <div className="space-y-6">
      <section>
        <h3 className={h}>When Ava drafts one</h3>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
          <li className={li}>Every morning at 6am, Ava checks every coach&apos;s health.</li>
          <li className={li}>A coach marked red or amber gets one draft. Green coaches, and coaches whose nudges are paused, get none.</li>
          <li className={li}>Nothing reaches a coach until someone at BCA approves it here.</li>
        </ul>
      </section>

      <section>
        <h3 className={h}>Who counts as stuck</h3>
        <p className="mt-1 text-sm text-slate-600">
          Checked in this order. A coach gets the first one that fits, so each coach only ever has one reason.
        </p>
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th scope="col" className="w-[13rem] px-3 py-2 font-medium">Reason</th>
                <th scope="col" className="px-3 py-2 font-medium">When</th>
                <th scope="col" className="w-[9rem] px-3 py-2 font-medium">Posts in</th>
                <th scope="col" className="w-[22rem] px-3 py-2 font-medium">Ava says (for a coach called Sam)</th>
              </tr>
            </thead>
            <tbody>
              {NUDGE_RULES.map((rule) => (
                <tr key={rule.reason} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2 font-medium text-slate-900">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT[rule.level]}`} aria-hidden />
                      {rule.reason}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{rule.when}</td>
                  <td className="px-3 py-2 text-slate-700">{sectionByKey(nudgeSection(rule.reason))?.page.title ?? "About You"}</td>
                  <td className="px-3 py-2 text-slate-600">{NUDGE_TEMPLATES[rule.reason]?.(example)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h3 className={h}>While a draft waits</h3>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            <li className={li}>Still stuck on the same thing: the same draft keeps waiting. No new one each day.</li>
            <li className={li}>Moved on, or now stuck on something else: the old draft is dropped, and a new one is drafted if needed.</li>
            <li className={li}>Nudges paused for that coach: the draft is dropped.</li>
          </ul>
        </section>
        <section>
          <h3 className={h}>Once you approve it</h3>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            <li className={li}>Ava checks every hour and posts it in the chat on the page shown, signed as Ava.</li>
            <li className={li}>She holds it for later if the coach has paused nudges, it&apos;s their quiet hours, or they had one in the last 24 hours.</li>
            <li className={li}>It isn&apos;t emailed. The coach sees it next time they open the app, in that page&apos;s chat and their Inbox.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
