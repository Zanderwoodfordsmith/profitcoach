"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, MessagesSquare, Search, Sparkles, ThumbsDown, X } from "lucide-react";

import { commentWhen } from "@/components/practice/comments/SectionCommentsUI";
import { buttonClass } from "@/components/ui/Button";
import {
  FIX_LABEL,
  pageLabel,
  type ChatWho,
  type DigestItem,
  type ReviewChatRow,
  type ReviewDigest,
} from "@/lib/ava/chatReviewLabels";

import { AvaChatReader } from "./AvaChatReader";
import { AvaSplit, AvaTable, EmptyRow, ROW, type Column } from "./AvaList";
import { adminHeaders } from "./avaAdminHeaders";
import type { ChatsVersion } from "./AvaChatsVersionSwitch";

/**
 * Admin → Ava → Chats (job 225): every chat anyone has had with Ava, to see
 * how coaches use the app and whether Ava answers well. Read a chat, mark
 * each reply Good or Off, and let the AI read the rest and list the top
 * things to fix. How often the AI agrees with your marks says how far to
 * trust it.
 */

type ListBody = {
  chats: ReviewChatRow[];
  digest: ReviewDigest | null;
  agreement: { compared: number; agreed: number };
};

const COLUMNS: Column[] = [
  { key: "chat", label: "Chat" },
  { key: "coach", label: "Coach", width: "12rem" },
  { key: "page", label: "Page", width: "9.5rem" },
  { key: "msgs", label: "Messages", width: "5.5rem" },
  { key: "ai", label: "AI", width: "4.5rem" },
  { key: "you", label: "You", width: "5rem" },
  { key: "when", label: "Last message", width: "7.5rem" },
];

/** BCA's own chats: who on the team, and which coach it was about. */
const BCA_COLUMNS: Column[] = COLUMNS.map((c) => (c.key === "coach" ? { ...c, label: "Coach · who asked" } : c));

const WHO: { key: ChatWho; label: string }[] = [
  { key: "coach", label: "Coaches" },
  { key: "bca", label: "BCA" },
  { key: "test", label: "Tests" },
];

type Show = "all" | "unmarked" | "one" | "cancelled" | "thumbs" | "ai_off";

const SHOW: { key: Show; label: string; test: (r: ReviewChatRow) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "unmarked", label: "Not marked", test: (r) => r.bca.good + r.bca.off === 0 },
  { key: "one", label: "One message", test: (r) => r.turns <= 1 },
  { key: "cancelled", label: "Card cancelled", test: (r) => r.actions.cancelled > 0 },
  { key: "thumbs", label: "Thumbs down", test: (r) => r.coachThumbs.off > 0 },
  { key: "ai_off", label: "AI says off", test: (r) => r.review?.verdict === "off" },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function AvaChatsTab({
  openId,
  onOpen,
  layout,
}: {
  openId: string | null;
  onOpen: (id: string | null) => void;
  /** Table (16 Nov) or the first list layout, until Zander picks (top-bar switch). */
  layout: ChatsVersion;
}) {
  const [data, setData] = useState<ListBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [who, setWho] = useState<ChatWho>("coach");
  const [show, setShow] = useState<Show>("all");
  const [coachId, setCoachId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<{ title: string; ids: Set<string> } | null>(null);
  const [running, setRunning] = useState(false);
  const [runNote, setRunNote] = useState<string | null>(null);
  const [fixOpen, setFixOpen] = useState(false);

  const load = useCallback(async () => {
    const headers = await adminHeaders();
    if (!headers) return setError("Sign in again to load Ava's chats.");
    const res = await fetch("/api/admin/ava/chats", { headers }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as (ListBody & { error?: string }) | null;
    if (!res?.ok || !body?.chats) return setError(body?.error ?? "Could not load Ava's chats.");
    setError(null);
    setData(body);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const chats = useMemo(() => data?.chats ?? [], [data]);

  // A chat opened from a link (or the things to fix) shows its own group.
  useEffect(() => {
    const open = openId ? chats.find((c) => c.id === openId) : null;
    if (open && open.who !== who) setWho(open.who);
    // Only when the chat or the list changes, not when the person switches group.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, chats]);

  const inGroup = useMemo(() => chats.filter((c) => c.who === who), [chats, who]);
  const coaches = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; chats: number }>();
    for (const c of inGroup) {
      if (!c.coach) continue;
      const row = seen.get(c.coach.id) ?? { id: c.coach.id, name: c.coach.name, chats: 0 };
      row.chats += 1;
      seen.set(c.coach.id, row);
    }
    return [...seen.values()].sort((a, b) => b.chats - a.chats || a.name.localeCompare(b.name));
  }, [inGroup]);

  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inGroup.filter(
      (c) =>
        (!coachId || c.coach?.id === coachId) &&
        (!only || only.ids.has(c.id)) &&
        (!q || `${c.title} ${c.coach?.name ?? ""} ${c.person.name} ${c.skills.join(" ")}`.toLowerCase().includes(q))
    );
  }, [inGroup, coachId, only, query]);

  const showTest = SHOW.find((s) => s.key === show)!.test;
  const rows = useMemo(() => base.filter(showTest), [base, showTest]);
  const marked = useMemo(() => chats.filter((c) => c.who === "coach" && c.bca.good + c.bca.off > 0).length, [chats]);

  const openIndex = openId ? rows.findIndex((r) => r.id === openId) : -1;
  const next = openIndex >= 0 && openIndex < rows.length - 1 ? rows[openIndex + 1]! : null;

  async function runReview() {
    setRunning(true);
    setRunNote(null);
    const headers = await adminHeaders();
    const res = headers ? await fetch("/api/admin/ava/chats/review", { method: "POST", headers, body: "{}" }).catch(() => null) : null;
    const body = (await res?.json().catch(() => null)) as {
      reviewed?: number;
      failed?: number;
      left?: number;
      digest?: boolean;
      costUsd?: number;
      error?: string;
    } | null;
    setRunning(false);
    if (!res?.ok || !body) return setRunNote(body?.error ?? "The review didn't finish. Try again.");
    const parts: string[] = [];
    parts.push(body.reviewed ? `Read ${body.reviewed} ${body.reviewed === 1 ? "chat" : "chats"}` : "No new chats to read");
    if (body.failed) parts.push(`${body.failed} failed`);
    if (body.left) parts.push(`${body.left} still to read, press again`);
    if (body.digest) parts.push("things to fix updated");
    setRunNote(`${parts.join(", ")}.${body.costUsd ? ` Cost $${body.costUsd.toFixed(2)}.` : ""}`);
    if (body.digest) {
      setFixOpen(true);
      onOpen(null);
    }
    await load();
  }

  const agreement = data?.agreement;
  const digest = data?.digest && data.digest.items.length ? data.digest : null;

  const showChats = (item: DigestItem) => {
    setOnly({ title: item.title, ids: new Set(item.chatIds) });
    setShow("all");
    setCoachId("");
    setWho("coach");
    onOpen(item.chatIds[0]!);
  };

  // ---- Shared pieces: both layouts use the same filters. ----

  const whoToggle = (
    <div className="inline-flex h-8 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white" role="group" aria-label="Whose chats">
      {WHO.map((w, i) => (
        <span key={w.key} className="flex">
          {i > 0 ? <span className="w-px self-stretch bg-slate-200" aria-hidden /> : null}
          <button
            type="button"
            aria-pressed={who === w.key}
            onClick={() => {
              setWho(w.key);
              setCoachId("");
            }}
            className={`px-3 text-sm transition ${
              who === w.key ? "bg-sky-600 font-medium text-white" : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {w.label}
          </button>
        </span>
      ))}
    </div>
  );

  const coachSelect = (className: string) => (
    <select
      value={coachId}
      onChange={(e) => setCoachId(e.target.value)}
      aria-label="Coach"
      className={`h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none ${className}`}
    >
      <option value="">Every coach</option>
      {coaches.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} ({c.chats})
        </option>
      ))}
    </select>
  );

  const searchBox = (className: string) => (
    <label className={`relative block ${className}`}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search titles, names, skills"
        className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
      />
    </label>
  );

  const showChips = (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
      {SHOW.map((s) => {
        const count = base.filter(s.test).length;
        return (
          <button
            key={s.key}
            type="button"
            aria-pressed={show === s.key}
            onClick={() => setShow(s.key)}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
              show === s.key ? "border-sky-600 bg-sky-600 font-medium text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {s.label} <span className="tabular-nums opacity-75">{count}</span>
          </button>
        );
      })}
    </div>
  );

  const onlyChip = only ? (
    <p className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-sky-50 px-2.5 py-1.5 text-xs text-sky-900">
      <span className="min-w-0 truncate">
        Chats for: <span className="font-medium">{only.title}</span>
      </span>
      <button type="button" onClick={() => setOnly(null)} className="shrink-0 rounded p-0.5 hover:bg-sky-100" aria-label="Show every chat">
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </p>
  ) : null;

  /** How far to trust the AI: your marks against its reads. */
  const trustLine = data ? (
    <p className="text-xs text-slate-500">
      You&apos;ve marked <span className="font-semibold text-slate-700">{marked}</span>
      {agreement && agreement.compared > 0 ? (
        <>
          {" "}· AI agrees with you on <span className="font-semibold text-slate-700">{agreement.agreed}</span> of {agreement.compared}
        </>
      ) : (
        <> · mark a few to see how often the AI agrees with you</>
      )}
    </p>
  ) : null;

  const reviewButton = (
    <button type="button" onClick={() => void runReview()} disabled={running} className={buttonClass("second", "small", "shrink-0")}>
      {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
      {running ? "Reading chats…" : "Review new chats"}
    </button>
  );

  // ---- List: chats down the left, the chat or the things to fix on the right. ----

  if (layout === "list") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-2.5 md:px-6">
          {trustLine}
          <div className="ml-auto flex items-center gap-3">
            {runNote ? <p className="text-xs text-slate-500">{runNote}</p> : null}
            {openId && digest ? (
              <button type="button" onClick={() => onOpen(null)} className={buttonClass("quiet", "small")}>
                Things to fix
              </button>
            ) : null}
            {reviewButton}
          </div>
        </div>
        {error ? <p className="px-6 py-4 text-sm text-rose-700">{error}</p> : null}
        <div className="flex min-h-0 flex-1">
          <aside
            className={`min-h-0 w-full shrink-0 flex-col border-r border-slate-200 md:flex md:w-[22rem] lg:w-[24rem] ${openId ? "hidden" : "flex"}`}
            aria-label="Ava's chats"
          >
            <div className="space-y-2.5 border-b border-slate-200 p-3">
              <div className="flex items-center gap-2">
                {whoToggle}
                {coachSelect("min-w-0 flex-1")}
              </div>
              {searchBox("w-full")}
              {showChips}
              {onlyChip}
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {!data && !error ? (
                <li className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading chats…
                </li>
              ) : null}
              {data && rows.length === 0 ? <li className="px-4 py-6 text-sm text-slate-500">No chats here.</li> : null}
              {rows.map((row) => (
                <ChatListRow key={row.id} row={row} active={row.id === openId} onOpen={() => onOpen(row.id)} />
              ))}
            </ul>
          </aside>
          <main className={`min-h-0 min-w-0 flex-1 overflow-y-auto bg-slate-50/40 ${openId ? "block" : "hidden md:block"}`}>
            {openId ? (
              <AvaChatReader
                key={openId}
                chatId={openId}
                onBack={() => onOpen(null)}
                onNext={next ? () => onOpen(next.id) : null}
                onChanged={() => void load()}
              />
            ) : digest ? (
              <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 md:px-8">
                <h2 className="text-lg font-semibold text-slate-900">Things to fix</h2>
                <ThingsToFix digest={digest} onShow={showChats} />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500">
                <MessagesSquare className="h-6 w-6 text-slate-300" aria-hidden />
                <p>Pick a chat to read it and mark Ava&apos;s replies.</p>
                <p className="max-w-sm text-slate-400">Press Review new chats and the AI reads them and lists the top things to fix here.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // ---- Table: one chat open shows the chats down the side, the chat on the right. ----

  if (openId) {
    return (
      <AvaSplit
        sections={[
          {
            id: "chats",
            label: only ? `Chats for: ${only.title}` : WHO.find((w) => w.key === who)!.label,
            items: rows.map((r) => ({
              id: r.id,
              label: r.title,
              note: (r.coach?.name ?? r.person.name).split(/\s+/)[0],
              current: r.id === openId,
              onOpen: () => onOpen(r.id),
            })),
          },
        ]}
        back={{ label: "All chats", onClick: () => onOpen(null) }}
      >
        <AvaChatReader key={openId} chatId={openId} onNext={next ? () => onOpen(next.id) : null} onChanged={() => void load()} />
      </AvaSplit>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="w-full px-5 pb-10 pt-4 md:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {whoToggle}
          {coachSelect("w-full sm:w-52")}
          {searchBox("w-full sm:w-64")}
          <div className="flex items-center gap-2 sm:ml-auto">
            {runNote ? <p className="text-xs text-slate-500">{runNote}</p> : null}
            {digest ? (
              <button
                type="button"
                aria-expanded={fixOpen}
                onClick={() => setFixOpen((v) => !v)}
                className={buttonClass("second", "small", "shrink-0")}
              >
                Things to fix
                <span className="tabular-nums opacity-75">{digest.items.length}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${fixOpen ? "rotate-180" : ""}`} aria-hidden />
              </button>
            ) : null}
            {reviewButton}
          </div>
        </div>

        {fixOpen && digest ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 pt-3">
            <ThingsToFix digest={digest} onShow={showChats} />
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {showChips}
          {onlyChip}
          <div className="sm:ml-auto">{trustLine}</div>
        </div>

        <div className="mt-2">
          <AvaTable columns={who === "bca" ? BCA_COLUMNS : COLUMNS}>
            <tbody>
              {!data && !error ? (
                <EmptyRow span={COLUMNS.length}>
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading chats…
                  </span>
                </EmptyRow>
              ) : null}
              {data && rows.length === 0 ? <EmptyRow span={COLUMNS.length}>No chats here.</EmptyRow> : null}
              {rows.map((row) => (
                <ChatRow key={row.id} row={row} onOpen={() => onOpen(row.id)} />
              ))}
            </tbody>
          </AvaTable>
        </div>
      </div>
    </div>
  );
}

/** The AI's top things to fix this week, biggest first. Each opens the chats behind it. */
function ThingsToFix({ digest, onShow }: { digest: ReviewDigest; onShow: (item: DigestItem) => void }) {
  return (
    <>
      <p className="text-sm text-slate-500">
        The AI&apos;s read of {digest.chats} {digest.chats === 1 ? "chat" : "chats"} from the last week, with your notes, written{" "}
        {commentWhen(digest.createdAt)}.
      </p>
      <ol className="mt-2 divide-y divide-slate-200">
        {digest.items.map((item, i) => (
          <li key={i} className="flex gap-3 py-3">
            <span className="w-4 shrink-0 text-sm font-semibold leading-6 tabular-nums text-slate-400">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="max-w-4xl text-sm font-medium leading-6 text-slate-900">{item.title}</p>
              <p className="mt-0.5 max-w-4xl text-sm leading-6 text-slate-600">{item.why}</p>
              <div className="mt-1.5 flex items-center gap-3">
                {item.fixKind ? (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">{FIX_LABEL[item.fixKind]}</span>
                ) : null}
                {item.chatIds.length ? (
                  <button type="button" onClick={() => onShow(item)} className="text-xs font-semibold text-[#0c5290] hover:underline">
                    Read the {item.chatIds.length} {item.chatIds.length === 1 ? "chat" : "chats"}
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

/** The first layout's row: a stacked card in the left list. */
function ChatListRow({ row, active, onOpen }: { row: ReviewChatRow; active: boolean; onOpen: () => void }) {
  const name = row.coach?.name ?? row.person.name;
  const page = pageLabel(row.firstPage);
  const marked = row.bca.good + row.bca.off > 0;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "true" : undefined}
        className={`flex w-full gap-3 border-b border-slate-100 px-3.5 py-3 text-left transition ${active ? "bg-sky-50" : "hover:bg-slate-50"}`}
      >
        <Avatar row={row} name={name} size="h-8 w-8 text-xs" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
              {name}
              {row.who === "bca" ? <span className="font-normal text-slate-500"> · {row.person.name.split(/\s+/)[0]}</span> : null}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-slate-400">{commentWhen(row.updatedAt)}</span>
          </span>
          <span className="mt-0.5 block truncate text-sm text-slate-700">{row.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
            {page ? <span className="max-w-[10rem] truncate">{page}</span> : null}
            {page ? <span aria-hidden>·</span> : null}
            <span className="tabular-nums">
              {row.turns} {row.turns === 1 ? "msg" : "msgs"}
            </span>
            {row.actions.cancelled ? <span className="rounded bg-amber-50 px-1.5 text-amber-800">{row.actions.cancelled} cancelled</span> : null}
            {row.coachThumbs.off ? (
              <span className="flex items-center gap-0.5 rounded bg-rose-50 px-1.5 text-rose-700">
                <ThumbsDown className="h-3 w-3" aria-hidden />
                {row.coachThumbs.off}
              </span>
            ) : null}
            {row.review ? (
              <span
                className={`rounded px-1.5 ${row.review.verdict === "off" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`}
                title={row.review.stale ? "The AI read it before the latest messages" : "The AI's read"}
              >
                AI: {row.review.verdict === "off" ? "off" : "good"}
                {row.review.stale ? "*" : ""}
              </span>
            ) : null}
            {marked ? (
              <span className={`rounded px-1.5 font-medium text-white ${row.bca.off ? "bg-rose-600" : "bg-emerald-600"}`}>
                You: {row.bca.off ? `${row.bca.off} off` : "good"}
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}

function Avatar({ row, name, size }: { row: ReviewChatRow; name: string; size: string }) {
  return row.coach?.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={row.coach.avatarUrl} alt="" className={`${size} mt-0.5 shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} mt-0.5 flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600`}>
      {initials(name)}
    </span>
  );
}

function ChatRow({ row, onOpen }: { row: ReviewChatRow; onOpen: () => void }) {
  const name = row.coach?.name ?? row.person.name;
  const page = pageLabel(row.firstPage);
  const marked = row.bca.good + row.bca.off > 0;
  return (
    <tr onClick={onOpen} className={ROW}>
      <td className="py-2.5 pl-[1.625rem] pr-4">
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="min-w-0 truncate text-left font-medium text-slate-900 hover:text-[#0c5290]"
            title={row.title}
          >
            {row.title}
          </button>
          {row.coachThumbs.off ? (
            <span className="flex shrink-0 items-center gap-0.5 text-xs text-rose-700" title="Coach gave a thumbs down">
              <ThumbsDown className="h-3 w-3" aria-hidden />
              {row.coachThumbs.off}
            </span>
          ) : null}
          {row.actions.cancelled ? (
            <span className="shrink-0 whitespace-nowrap rounded bg-amber-50 px-1.5 text-xs text-amber-800">
              {row.actions.cancelled} cancelled
            </span>
          ) : null}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className="flex items-center gap-2">
          <Avatar row={row} name={name} size="h-6 w-6 text-[10px] !mt-0" />
          <span className="min-w-0 truncate text-slate-700">
            {name}
            {row.who === "bca" ? <span className="text-slate-400"> · {row.person.name.split(/\s+/)[0]}</span> : null}
          </span>
        </span>
      </td>
      <td className="truncate px-3 py-2.5 text-slate-600" title={page ?? undefined}>
        {page ?? <span className="text-slate-300">–</span>}
      </td>
      <td className="px-3 py-2.5 tabular-nums text-slate-600">{row.turns}</td>
      <td className="px-3 py-2.5">
        {row.review ? (
          <span
            className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
              row.review.verdict === "off" ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"
            }`}
            title={row.review.stale ? "The AI read it before the latest messages" : "The AI's read"}
          >
            {row.review.verdict === "off" ? "Off" : "Good"}
            {row.review.stale ? "*" : ""}
          </span>
        ) : (
          <span className="text-slate-300">–</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {marked ? (
          <span
            className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold text-white ${
              row.bca.off ? "bg-rose-600" : "bg-emerald-600"
            }`}
          >
            {row.bca.off ? `${row.bca.off} off` : "Good"}
          </span>
        ) : (
          <span className="text-slate-300">–</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{commentWhen(row.updatedAt)}</td>
    </tr>
  );
}
