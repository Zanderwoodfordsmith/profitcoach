"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  CircleHelp,
  Columns3,
  LayoutList,
  MessageSquare,
} from "lucide-react";

import {
  BLUEPRINT_GROUPS,
  sectionKey,
  type BlueprintLink,
} from "@/lib/practiceKnowledge/blueprint";
import {
  PAGE_STATUS_COPY,
  PAGE_STATUS_ORDER,
  pageStatus,
  type PageStatusId,
} from "@/lib/practiceKnowledge/pageStatus";
import { commentPage } from "@/lib/practiceKnowledge/pageChat";

import { useSectionComments } from "./comments/SectionCommentsContext";
import { CoverVideo } from "./document/DocumentParts";
import { PageIcon } from "./pageIcons";
import { PracticeSteps } from "./PracticeSteps";
import { COACH_LOOK, StageCircle } from "./StageCircle";
import { PageStatusPill, StatusSteps } from "./StatusGuide";
import { usePractice } from "./PracticeProvider";
import { BlueprintChecklist } from "./BlueprintChecklist";
import { Modal } from "@/components/ui/Modal";

/** A page's chat: how many messages (its sections' old threads too), and how many are unread. */
function chatOnPage(
  page: BlueprintLink,
  threads: Record<string, { unread: number; total: number }> | undefined,
): { total: number; unread: number } {
  const out = { total: 0, unread: 0 };
  for (const [key, thread] of Object.entries(threads ?? {})) {
    if (
      commentPage(key) === page.slug ||
      page.sections.some((s) => sectionKey(page, s) === key)
    ) {
      out.total += thread.total;
      out.unread += thread.unread;
    }
  }
  return out;
}

const VIEW_KEY = "blueprint-home-view";
type HomeView = "list" | "board";

/** List (the Blueprint as it was) or Board (a card per page, by status): Pam's switch, 3 Nov. */
function useHomeView(): [HomeView, (next: HomeView) => void] {
  const [view, setView] = useState<HomeView>("list");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage after hydration
      if (window.localStorage.getItem(VIEW_KEY) === "board") setView("board");
    } catch {
      // Storage blocked: the list.
    }
  }, []);
  return [
    view,
    (next) => {
      setView(next);
      try {
        window.localStorage.setItem(VIEW_KEY, next);
      } catch {
        // Not remembered; the switch still works for this visit.
      }
    },
  ];
}

function ViewSwitch({
  view,
  onChange,
}: {
  view: HomeView;
  onChange: (next: HomeView) => void;
}) {
  return (
    <div
      className="bp-no-print inline-flex shrink-0 rounded-full bg-slate-100 p-0.5"
      role="group"
      aria-label="Show the Blueprint as"
    >
      {(
        [
          ["list", "List", LayoutList],
          ["board", "Board", Columns3],
        ] as const
      ).map(([key, label, Icon]) => (
        <button
          key={key}
          type="button"
          aria-pressed={view === key}
          onClick={() => onChange(key)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
            view === key
              ? "bg-[#0c5290] text-white shadow-[0_1px_2px_rgba(12,82,144,0.25)]"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

/** The blueprint's landing page: where each page stands, and what is waiting on you. */
export function BlueprintHome() {
  const { knowledge, payload, href, stayOnPage, viewer } = usePractice();
  const comments = useSectionComments();
  const [view, setView] = useHomeView();
  if (!knowledge || !payload) return null;
  const row = { ...knowledge, payload };
  const groups = BLUEPRINT_GROUPS.map((group) => ({
    ...group,
    pages: group.pages.filter((page) => page.slug !== "command"),
  })).filter((group) => group.pages.length > 0);
  const yours = groups.filter((group) => group.yours);
  const later = groups.filter((group) => !group.yours);

  // Until the coach has answered their own cards, everything BCA builds sits back:
  // still there and still clickable, just quieter, so the next job is obvious.
  const yoursAnswered = yours.every((group) =>
    group.pages.every((page) => pageStatus(page, row) !== "needs_you"),
  );
  const quiet = viewer === "coach" && !yoursAnswered;
  const switches = (
    <div className="flex flex-wrap items-center gap-3">
      <ViewSwitch view={view} onChange={setView} />
    </div>
  );

  // Every page as a card, in the column for where it stands. A page with nothing to
  // track (the LinkedIn profile has its own editor) sits with BCA's work.
  const allPages = groups.flatMap((group) => group.pages);
  const columns = PAGE_STATUS_ORDER.map((id) => ({
    id,
    pages: allPages.filter((page) => (pageStatus(page, row) ?? "bca") === id),
  }));
  const boardGrid = (
    <div
      className="mt-5 grid grid-cols-1 gap-2.5 @xl:grid-cols-2 @5xl:flex"
      aria-label="Your Blueprint by status"
    >
      {columns.map((column) => (
        <BoardColumn key={column.id} id={column.id}>
          {column.pages.map((page) => (
            <li key={page.slug}>
              <Link
                href={href(page.href)}
                scroll={stayOnPage ? false : undefined}
                className="group block rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-slate-300"
              >
                {/* Title (no icon: the cards are narrow), the line about the page underneath. */}
                <span className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-slate-900">
                    {page.title}
                  </span>
                  <ChatMark chat={chatOnPage(page, comments?.threads)} />
                </span>
                <span className="mt-1 block text-[13px] leading-[1.125rem] text-slate-500 line-clamp-2">
                  {page.short ?? page.summary}
                </span>
              </Link>
            </li>
          ))}
        </BoardColumn>
      ))}
    </div>
  );

  // Like the pages: left-aligned, rows on hairlines.
  const renderCleanGroup = (group: (typeof groups)[number]) => (
    <section key={group.label}>
      <h2 className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-slate-900">
        {group.label}
      </h2>
      <ul className="mt-2 border-t border-slate-200">
        {group.pages.map((page) => {
          const status = pageStatus(page, row);
          return (
            <li key={page.slug} className="border-b border-slate-200">
              <Link
                href={href(page.href)}
                scroll={stayOnPage ? false : undefined}
                className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-slate-50"
              >
                <PageIcon
                  slug={page.slug}
                  className="h-[18px] w-[18px] shrink-0 text-slate-400 group-hover:text-[#0c5290]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold leading-6 text-slate-900">
                    {page.title}
                  </span>
                  <span className="block text-[0.9375rem] leading-6 line-clamp-2 text-slate-500">
                    {page.short ?? page.summary}
                  </span>
                </span>
                {/* Chat and status are two lenses, so each gets its own column. */}
                <span className="flex w-14 shrink-0 justify-center">
                  <ChatMark chat={chatOnPage(page, comments?.threads)} />
                </span>
                <span className="-mr-1 flex w-28 shrink-0 items-center justify-end">
                  {status ? <PageStatusPill status={status} /> : null}
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
  const board = view === "board";
  return (
    <article className="w-full pt-8 pb-24">
      {/* The same box as every other page (51rem with its padding), in List and Board, so nothing jumps when you switch. */}
      <div className="max-w-[51rem] px-6 md:px-10 lg:px-14">
        <header className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="flex items-center gap-2">
              <h1 className="text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#0f172a] md:text-[2rem]">
                Your Blueprint
              </h1>
              <HowItWorks columns={columns} />
            </div>
            {switches}
          </div>
          <p className="mt-2.5 max-w-[62ch] text-[1.0625rem] leading-[1.55] text-[#475569]">
            You bring the story, the proof and the voice. We turn it into your
            market, your messages and your offer, ready to launch.
          </p>
        </header>

        {/* What the coach does to get going (5 Nov: picked over the "we build for you" strip). */}
        <BlueprintChecklist />

        {board ? null : (
          <>
            <nav aria-label="Contents" className="mt-8 min-w-0 space-y-10">
              {yours.map(renderCleanGroup)}
              {later.length ? (
                <div>
                  <div className={`space-y-10${quiet ? " bp-home-quiet" : ""}`}>
                    {later.map(renderCleanGroup)}
                  </div>
                </div>
              ) : null}
            </nav>
          </>
        )}
      </div>
      {/* The Board keeps the full width: its columns need the room. */}
      {board ? <div className="px-6 md:px-10 lg:px-14">{boardGrid}</div> : null}
    </article>
  );
}

/** On the title line: the video, where you are, and your pages by status, in a pop-up (was a sidebar, 4 Nov). */
function HowItWorks({
  columns,
}: {
  columns: { id: PageStatusId; pages: BlueprintLink[] }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How your Blueprint works"
        title="How it works"
        className="bp-no-print shrink-0 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0c5290] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8fd4]"
      >
        <CircleHelp className="h-5 w-5" aria-hidden />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="How your Blueprint works"
        titleId="blueprint-how-it-works-title"
        subtitle="Three steps to launch, and what each page's status means."
        maxWidthClassName="max-w-5xl"
        glass
      >
        {/* A step or the video can open Ava or another page: close this first. */}
        <div
          className="max-h-[78vh] overflow-y-auto px-10 pb-10 pt-6"
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest("a, nav button"))
              setOpen(false);
          }}
        >
          <h3 className="text-caption font-semibold uppercase tracking-[0.08em] text-slate-500">
            Where you are
          </h3>
          <div className="mt-4">
            <PracticeSteps />
          </div>
          <div className="mt-9 grid gap-10 border-t border-slate-900/10 pt-8 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <h3 className="text-caption font-semibold uppercase tracking-[0.08em] text-slate-500">
                Why we build it for you
              </h3>
              <div className="mt-4">
                <CoverVideo tone="light" poster />
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="text-caption font-semibold uppercase tracking-[0.08em] text-slate-500">
                How status works
              </h3>
              <div className="mt-4">
                <StatusSteps
                  counts={Object.fromEntries(
                    columns.map((column) => [column.id, column.pages.length]),
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** A page's chat on its row, as on the old Jobs list: "2 new" while unread, else how many messages. */
function ChatMark({ chat }: { chat: { total: number; unread: number } }) {
  if (chat.unread > 0) {
    return (
      <span
        className="inline-flex shrink-0 items-center rounded-full bg-sky-600 px-2 py-0.5 text-xs font-semibold tabular-nums text-white"
        title={`${chat.unread} new of ${chat.total}`}
      >
        {chat.unread} new
      </span>
    );
  }
  if (chat.total <= 0) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-sm tabular-nums text-slate-500"
      title={`${chat.total} message${chat.total === 1 ? "" : "s"} in this page's chat`}
    >
      <MessageSquare className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">
        {chat.total} message{chat.total === 1 ? "" : "s"}.
      </span>
      <span aria-hidden>{chat.total}</span>
    </span>
  );
}

/** One status on the Board: its name, how many pages, then their cards. */
function BoardColumn({
  id,
  children,
}: {
  id: PageStatusId;
  children: React.ReactNode[];
}) {
  const copy = PAGE_STATUS_COPY[id];
  // Needs you, while empty, folds to a thin strip: kept for when we need something
  // from the coach again, without a whole empty column (Zander, 5 Nov).
  if (id === "needs_you" && !children.length) {
    return (
      <section
        aria-label={`${copy.label}: nothing`}
        title={`${copy.label}: nothing needs you right now`}
        className="flex items-center gap-2 rounded-xl bg-slate-100/80 px-3 py-2 text-sm font-semibold text-slate-500 @5xl:w-11 @5xl:flex-none @5xl:flex-col @5xl:px-0 @5xl:py-3"
      >
        <StageCircle look={COACH_LOOK[id]} />
        <span className="@5xl:[writing-mode:vertical-rl]">{copy.label}</span>
        <span className="font-normal tabular-nums text-slate-400">0</span>
      </section>
    );
  }
  return (
    <section
      aria-label={copy.label}
      className="min-w-0 rounded-xl bg-slate-100/80 p-2 @5xl:flex-1 @5xl:basis-0"
    >
      <h2
        className="flex items-center gap-2 px-1 pb-2 pt-0.5 text-sm font-semibold text-slate-800"
        title={copy.title}
      >
        <StageCircle look={COACH_LOOK[id]} />
        {copy.label}
        <span className="font-normal tabular-nums text-slate-400">
          {children.length}
        </span>
      </h2>
      {children.length ? (
        <ul className="space-y-1.5">{children}</ul>
      ) : (
        <p className="px-1 pb-1 text-[13px] text-slate-400">Nothing here.</p>
      )}
    </section>
  );
}
