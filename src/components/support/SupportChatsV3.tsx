"use client";

import "@/components/practice/document/blueprint.css";
import "@/components/practice/document/blueprint-clean.css";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, MessageSquare, Plus } from "lucide-react";

import type { ProjectThread } from "@/components/jobs/useCoachThreads";
import { notifyCoachSupportReadChanged } from "@/components/layout/useNewFeedbackCount";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { BcaChat, ChatName, Row, chatTitle, lastReplyLine, pageChatLine } from "@/components/practice/BlueprintInbox";
import { commentsCall, useSectionComments } from "@/components/practice/comments/SectionCommentsContext";
import { PageIcon } from "@/components/practice/pageIcons";
import { COACH_LOOK, StageCircle } from "@/components/practice/StageCircle";
import { PracticeProvider, usePractice } from "@/components/practice/PracticeProvider";
import { SidePanel } from "@/components/practice/SidePanel";
import { useBlueprintInbox, type InboxItem, type InboxQuestion } from "@/components/practice/useBlueprintInbox";
import { useMatchesBreakpoint } from "@/hooks/useBreakpoint";
import { blueprintPage } from "@/lib/practiceKnowledge/blueprint";
import { pageChatKey } from "@/lib/practiceKnowledge/pageChat";
import { ticketHasUnreadStaffReply } from "@/lib/support/tickets";
import { supabaseClient } from "@/lib/supabaseClient";

import { BRAND_BUTTON, ContextLink, chatLinkFor, useHostSupportDock, useSupportDock, useWideSupportColumn } from "./SupportDock";

import { SupportWelcome } from "./SupportWelcome";

const COMMUNITY_HREF = "/coach/community?compose=1";

type Open = { kind: "page"; slug: string } | { kind: "chat"; id: string } | { kind: "new" } | null;

/**
 * Support (chats look 3, picked 5 Nov). The main area is the list, as wide as the Blueprint
 * Inbox: Needs you, Open, Done folded away (Blueprint circles), each chat once. The right
 * column holds the welcome until a chat opens there, page chats included, so
 * the coach never leaves Support; "Open page" takes them to what it's about.
 */
export function SupportChatsV3({ startNew = false }: { startNew?: boolean }) {
  return (
    <div className="bp-doc h-full min-h-0">
      <PracticeProvider>
        <SupportChatsBody startNew={startNew} />
      </PracticeProvider>
    </div>
  );
}

/** `startNew`: the Help centre's "Start a chat" lands here with ?new=1 and the new chat open. */
function SupportChatsBody({ startNew }: { startNew: boolean }) {
  const { href, coachId: practiceCoachId } = usePractice();
  const comments = useSectionComments();
  const { profile } = useDashboardProfile();
  const { items, questions, threads, setThreads, coach, coachId, loading } = useBlueprintInbox({ asCoach: true });
  const [localOpen, setLocalOpen] = useState<Open>(null);
  // The open chat keeps its place while it's read, instead of jumping to another group.
  const [held, setHeld] = useState<{ item: InboxItem; index: number } | null>(null);
  const [resolvedOpen, setResolvedOpen] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const desktop = useMatchesBreakpoint("lg");
  // Wide screens open chats in the docked column, which stays while the coach opens the page it's about.
  const dock = useSupportDock();
  const docking = desktop === true && Boolean(dock);
  const open: Open = docking ? (dock?.chat ?? null) : localOpen;
  useHostSupportDock(docking && Boolean(open));
  useWideSupportColumn(desktop === true);
  // Only the coach closes their own chat (as on the current page); BCA viewing as them can't.
  const isTheCoach = Boolean(coachId && profile?.id === coachId);
  const firstName = coach?.first_name?.trim() || null;

  // A page's chat opens through the comments, which also marks it read on the way out.
  const openChat = comments?.openChat;
  const closeComments = useRef(comments?.close);
  useEffect(() => {
    closeComments.current = comments?.close;
  });
  const chatSlug = !docking && open?.kind === "page" ? open.slug : null;
  useEffect(() => {
    if (chatSlug) openChat?.(chatSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per chat; openChat changes with every comment
  }, [chatSlug]);
  useEffect(() => () => closeComments.current?.(), []);

  function show(next: Open, from?: InboxItem) {
    setStatusError(null);
    setHeld(from ? { item: from, index: Math.max(0, items.findIndex((i) => i.key === from.key)) } : null);
    if (docking && dock) {
      if (next) dock.open(next, "/coach/support");
      else dock.close();
      return;
    }
    if (open?.kind === "page" && !(next?.kind === "page" && next.slug === open.slug)) closeComments.current?.();
    setLocalOpen(next);
  }

  const startedNew = useRef(false);
  useEffect(() => {
    if (!startNew || loading || startedNew.current || desktop === null) return;
    startedNew.current = true;
    show({ kind: "new" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the list has loaded
  }, [startNew, loading, desktop]);

  async function openBcaChat(id: string, from?: InboxItem) {
    show({ kind: "chat", id }, from);
    const thread = threads.find((t) => t.id === id);
    if (!thread || !coachId || !ticketHasUnreadStaffReply(thread, thread.replies, coachId)) return;
    // BCA looking as the coach leaves it unread for the coach.
    if (!isTheCoach) return;
    const { error } = await supabaseClient.rpc("mark_support_ticket_read", { p_report_id: id });
    if (error) return;
    const readAt = new Date().toISOString();
    setThreads((current) => current.map((t) => (t.id === id ? { ...t, coach_last_read_at: readAt } : t)));
    notifyCoachSupportReadChanged();
  }

  function retitle(id: string, title: string) {
    setThreads((current) => current.map((t) => (t.id === id ? { ...t, title } : t)));
  }

  /** A new chat shows its opening words at once; the AI's short name follows a moment later. */
  async function nameChat(id: string) {
    try {
      const data = await commentsCall<{ title: string | null; context_path?: string | null }>(practiceCoachId, "/api/coach/support/chat-title", {
        method: "POST",
        body: { report_id: id },
      });
      if (data?.title) retitle(id, data.title);
      const linked = data?.context_path ?? null;
      if (linked) setThreads((current) => current.map((t) => (t.id === id ? { ...t, context_path: linked } : t)));
    } catch {
      // Keeps its opening words.
    }
  }

  async function markResolved(thread: ProjectThread, done: boolean) {
    setStatusError(null);
    const next = done ? "resolved" : "open";
    const { error } = await supabaseClient.rpc("member_set_support_ticket_status", {
      p_report_id: thread.id,
      p_status: next,
    });
    if (error) {
      setStatusError("Couldn't change it. Try again.");
      return;
    }
    setThreads((current) => current.map((t) => (t.id === thread.id ? { ...t, status: next } : t)));
    notifyCoachSupportReadChanged();
  }

  // Groups: each chat once. The held one stays in Needs you while it's open.
  const needsYou = items.filter((item) => item.key !== held?.item.key);
  if (held && open) {
    const fresh = items.find((item) => item.key === held.item.key) ?? { ...held.item, unread: 0 };
    needsYou.splice(Math.min(held.index, needsYou.length), 0, fresh);
  }
  const inNeedsYou = new Set(needsYou.flatMap((item) => (item.kind === "question" ? [item.thread.id] : [])));
  const openChats = questions.filter((q) => !inNeedsYou.has(q.thread.id) && q.thread.status !== "resolved");
  const resolved = questions.filter((q) => !inNeedsYou.has(q.thread.id) && q.thread.status === "resolved");

  const page = open?.kind === "page" ? blueprintPage(open.slug) : null;
  const chat = open?.kind === "chat" ? threads.find((t) => t.id === open.id) ?? null : null;
  const chatLink = chat ? chatLinkFor(chat, href) : null;
  const isOpen = (key: string) =>
    (open?.kind === "page" && key === `page:${open.slug}`) || (open?.kind === "chat" && key === open.id);


  const panel = open ? (
    <SidePanel
      mode="comments"
      sectionKey={page ? pageChatKey(page.slug) : null}
      page={page}
      onClose={() => show(null)}
      title={page ? page.title : chat ? <ChatName key={chat.id} thread={chat} onRenamed={retitle} /> : "New chat"}
      action={
        page ? (
          <ContextLink href={`${href(page.href)}?panel=chat`} label={`Open ${page.title} page`} />
        ) : chat ? (
          <>
            {chatLink ? <ContextLink href={chatLink.to} label={chatLink.label} /> : null}
            {isTheCoach ? (
              <button
                type="button"
                onClick={() => void markResolved(chat, chat.status !== "resolved")}
                title={statusError ?? undefined}
                className="shrink-0 rounded-md px-1.5 py-1 text-xs font-medium text-[var(--ava-muted)] hover:bg-white/60 hover:text-[var(--ava-ink)]"
              >
                {chat.status === "resolved" ? "Reopen" : "Mark done"}
              </button>
            ) : null}
          </>
        ) : null
      }
    >
      {open.kind === "page" ? null : !coachId ? (
        <p className="px-4 py-6 text-sm text-slate-500">Opening…</p>
      ) : open.kind === "new" ? (
        <BcaChat
          key="new"
          thread={null}
          coach={coach}
          coachId={coachId}
          onClose={() => show(null)}
          onChange={(thread) => {
            setThreads((current) => [...current, thread]);
            setLocalOpen({ kind: "chat", id: thread.id });
            notifyCoachSupportReadChanged();
            void nameChat(thread.id);
          }}
        />
      ) : chat ? (
        <BcaChat
          key={chat.id}
          thread={chat}
          coach={coach}
          coachId={coachId}
          onClose={() => show(null)}
          onChange={(next) => setThreads((current) => current.map((t) => (t.id === next.id ? next : t)))}
        />
      ) : (
        <p className="px-4 py-6 text-sm text-slate-500">Opening…</p>
      )}
    </SidePanel>
  ) : null;

  const chatRow = (q: InboxQuestion) => (
    <Row
      key={q.thread.id}
      onOpen={() => void openBcaChat(q.thread.id)}
      selected={isOpen(q.thread.id)}
      icon={<MessageSquare className="h-4 w-4 text-slate-400" />}
      title={chatTitle(q.thread)}
      line={lastReplyLine(q.thread.replies, coachId) ?? q.thread.details}
      unread={q.unread}
      count={q.count}
      at={q.at}
      muted={q.thread.status === "resolved"}
    />
  );

  // The current Support's welcome, word for word (Zander loved it), in the right column.
  const welcome = (
    <SupportWelcome
      firstName={firstName}
      communityHref={COMMUNITY_HREF}
      onNewChat={() => show({ kind: "new" })}
    />
  );

  return (
    <div className="flex h-full min-h-0 w-full bg-white">
      <div className="min-w-0 flex-1 overflow-y-auto">
        {/* Roomy padding; the top bar's title takes the same inset on this look, so "Support" lines up with "Your chats". */}
        <div className="w-full max-w-[51rem] px-4 pt-8 pb-24 md:px-10 lg:px-14">
          {/* Phones have no right column: the welcome sits above the list. */}
          <div className="mb-10 lg:hidden">{welcome}</div>

          <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0 flex-1 basis-72">
              <h1 className="text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#0f172a] md:text-[2rem]">Your chats</h1>
              <p className="mt-2.5 max-w-[56ch] text-[1.0625rem] leading-[1.55] text-[#475569]">
                Everything you and BCA are talking about. Open one to read it on the right.
              </p>
            </div>
            <button
              type="button"
              onClick={() => show({ kind: "new" })}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ${BRAND_BUTTON}`}
            >
              <Plus className="h-4 w-4" aria-hidden />
              New chat
            </button>
          </header>

          {loading ? <p className="mt-10 text-[0.9375rem] text-slate-500">Checking your messages…</p> : null}

          {!loading ? (
            <Group id="support-needs-you" label="Needs you" look={COACH_LOOK.needs_you} count={needsYou.length}>
              {needsYou.length === 0 ? (
                <p className="py-4 text-[0.9375rem] text-slate-600">Nothing waiting for you.</p>
              ) : (
                <ul>
                  {needsYou.map((item) =>
                    item.kind === "page" ? (
                      <Row
                        key={item.key}
                        onOpen={() => show({ kind: "page", slug: item.page.slug }, item)}
                        selected={isOpen(item.key)}
                        icon={<PageIcon slug={item.page.slug} className="h-5 w-5 text-slate-400" />}
                        title={item.page.title}
                        line={pageChatLine(item.last)}
                        unread={item.unread}
                        at={item.at}
                        strong
                      />
                    ) : (
                      <Row
                        key={item.key}
                        onOpen={() => void openBcaChat(item.thread.id, item)}
                        selected={isOpen(item.thread.id)}
                        icon={<MessageSquare className="h-4 w-4 text-slate-400" />}
                        title={chatTitle(item.thread)}
                        line={lastReplyLine(item.thread.replies, coachId) ?? "We've asked you something back"}
                        unread={item.unread}
                        at={item.at}
                        strong
                      />
                    )
                  )}
                </ul>
              )}
            </Group>
          ) : null}

          {/* Only Open or Done now (5 Nov): an open chat isn't anyone's "to do" until someone has the last word. */}
          {!loading && openChats.length ? (
            <Group id="support-open" label="Open" look={COACH_LOOK.bca} count={openChats.length}>
              <ul>{openChats.map(chatRow)}</ul>
            </Group>
          ) : null}

          {!loading && resolved.length ? (
            <Group
              id="support-resolved"
              label="Done"
              look={COACH_LOOK.done}
              count={resolved.length}
              folded={!resolvedOpen}
              onFold={() => setResolvedOpen((v) => !v)}
            >
              <ul>{resolved.map(chatRow)}</ul>
            </Group>
          ) : null}
        </div>
      </div>

      {/* Right: the welcome until a chat opens. The chat itself is the docked column, laid over this spot. */}
      {desktop === true && !(docking ? open : panel) ? (
        <aside
          aria-label="Welcome"
          className="bp-clean-side bp-chat-side flex h-full min-h-0 shrink-0 flex-col border-l px-6"
          style={{ width: "var(--support-dock-w)" }}
        >
          {welcome}
        </aside>
      ) : null}
      {/* Room for the docked chat, under the top bar. */}
      {docking && open ? <div aria-hidden className="shrink-0" style={{ width: "var(--support-dock-w)" }} /> : null}
      {desktop === true && !docking && panel ? (
        <aside aria-label="Chat" className="bp-clean-side bp-chat-side flex h-full min-h-0 w-[28rem] shrink-0 flex-col border-l border-slate-200">
          {panel}
        </aside>
      ) : null}
      {panel && desktop === false ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[#051e36]/35 lg:hidden">
          <div className="bp-clean-side bp-chat-side h-[85dvh] overflow-hidden rounded-t-3xl shadow-[0_-20px_50px_-20px_rgba(5,30,54,0.6)]">
            {panel}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** One group in the list, headed like the Blueprint Inbox, with the Blueprint's status circle. Done folds away. */
function Group({
  id,
  label,
  look,
  count,
  folded = false,
  onFold,
  children,
}: {
  id: string;
  label: string;
  /** The Blueprint's status circle for this group, so the two read the same. */
  look: (typeof COACH_LOOK)[keyof typeof COACH_LOOK];
  count: number;
  folded?: boolean;
  onFold?: () => void;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="border-b border-slate-200 pb-2 text-[1.0625rem] font-semibold tracking-[-0.01em] text-slate-900">
        {onFold ? (
          <button type="button" aria-expanded={!folded} onClick={onFold} className="flex items-center gap-1.5 hover:text-slate-700">
            <StageCircle look={look} className="h-4 w-4" />
            {label}
            <span className="text-sm font-normal tabular-nums text-slate-400">{count}</span>
            {/* The chevron after the label, so the circle lines up with the groups above (Zander, 5 Nov). */}
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${folded ? "-rotate-90" : ""}`} aria-hidden />
          </button>
        ) : (
          <span className="flex items-center gap-2">
            <StageCircle look={look} className="h-4 w-4" />
            {label}
            {count ? <span className="text-sm font-normal tabular-nums text-slate-400">{count}</span> : null}
          </span>
        )}
      </h2>
      {folded ? null : children}
    </section>
  );
}
