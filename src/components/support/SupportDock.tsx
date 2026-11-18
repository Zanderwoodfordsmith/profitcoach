"use client";

import "@/components/practice/document/blueprint.css";
import "@/components/practice/document/blueprint-clean.css";
import "./supportDock.css";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { useCoachThreads, type ProjectThread } from "@/components/jobs/useCoachThreads";
import { notifyCoachSupportReadChanged } from "@/components/layout/useNewFeedbackCount";
import { useDashboardProfile } from "@/components/layout/useDashboardProfile";
import { BcaChat, ChatName } from "@/components/practice/BlueprintInbox";
import { commentsCall, useSectionComments } from "@/components/practice/comments/SectionCommentsContext";
import { PracticeProvider, usePractice } from "@/components/practice/PracticeProvider";
import { SidePanel } from "@/components/practice/SidePanel";
import { useMatchesBreakpoint } from "@/hooks/useBreakpoint";
import { BLUEPRINT_PAGES, blueprintPage } from "@/lib/practiceKnowledge/blueprint";
import { pageChatKey } from "@/lib/practiceKnowledge/pageChat";
import { chatPageFor } from "@/lib/support/chatPages";
import { readScreenContext, useScreenContext } from "@/lib/support/screenContext";
import { formatSupportRelativeCompact, type SupportTicketAuthor } from "@/lib/support/tickets";

import { cardClass } from "@/components/ui/Card";

import { supabaseClient } from "@/lib/supabaseClient";

/** The app's own main-button blue, flat (5 Nov: not near-black, no gradient). */
export const BRAND_BUTTON = "bg-[#0c5290] text-white hover:bg-[#0a4578]";

/**
 * `list`: the coach's chats, with "New chat about <this page>" at the top (18 Nov,
 * job 228). `auto` (from the top-bar icon) opens the open chat about `about` if
 * there is one, else a new chat about it. `about` is the page a new chat is about.
 */
export type DockChat =
  | { kind: "page"; slug: string }
  | { kind: "chat"; id: string }
  | { kind: "new"; about?: string }
  | { kind: "list"; about?: string; auto?: boolean };

export type DockValue = {
  chat: DockChat | null;
  /** True while the chat shows as the right-hand column (wide screens). */
  docked: boolean;
  /** Opens a chat in the column. `from` is where the coach opened it, for "Back to Support". */
  open: (chat: DockChat, from?: string) => void;
  close: () => void;
  /** Goes to another page with the chat held still beside it. */
  go: (to: string) => void;
};

const DockContext = createContext<DockValue | null>(null);

/** Admin Support V2 gives the same context, so the Blueprint makes room for BCA's docked chat too. */
export const SupportDockContext = DockContext;

/** Null outside the coach app (and admin Support V2). */
export function useSupportDock(): DockValue | null {
  return useContext(DockContext);
}

let hosts = 0;

/**
 * A page that leaves a column free for the docked chat, as the Blueprint does
 * for its own chat, so the top bar stays full width. Other pages make room by
 * moving everything over.
 */
export function useHostSupportDock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    hosts += 1;
    const root = document.documentElement;
    root.classList.add("support-dock-hosted");
    return () => {
      hosts -= 1;
      if (hosts === 0) root.classList.remove("support-dock-hosted");
    };
  }, [active]);
}

/** Support gives its right column (welcome, then chat) the room the list doesn't need. Other pages keep Blueprint-chat width. */
export function useWideSupportColumn(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.classList.add("support-dock-wide");
    return () => root.classList.remove("support-dock-wide");
  }, [active]);
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> };
};

/** Marks the page while a chat is docked, so the app makes room for it. */
export function useDockedClass(docked: boolean) {
  useEffect(() => {
    document.documentElement.classList.toggle("support-docked", docked);
    return () => document.documentElement.classList.remove("support-docked");
  }, [docked]);
}

/** Goes to another page with the docked chat held still: the page fades in from behind it. */
export function useDockGo() {
  const router = useRouter();
  const pathname = usePathname();
  const arrived = useRef<(() => void) | null>(null);

  // The page has changed: let the fade in start once it has drawn.
  useEffect(() => {
    const done = arrived.current;
    if (!done) return;
    arrived.current = null;
    requestAnimationFrame(() => requestAnimationFrame(done));
  }, [pathname]);

  return useCallback(
    (to: string) => {
      const doc = document as ViewTransitionDocument;
      const samePage = to.split("?")[0] === window.location.pathname;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (samePage || still || !doc.startViewTransition) {
        router.push(to);
        return;
      }
      const root = document.documentElement;
      root.classList.add("support-dock-nav");
      const transition = doc.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            arrived.current = resolve;
            // Never hold the screen if the page is slow.
            window.setTimeout(resolve, 1200);
            router.push(to);
          })
      );
      void transition.finished.finally(() => root.classList.remove("support-dock-nav"));
    },
    [router]
  );
}

/**
 * Support's docked chat (Zander, 5 Nov): opened from Support, a chat stays on
 * the right while the coach opens the page it's about, so they can read BCA's
 * answer beside the real thing. The page fades in from behind the chat.
 */
export function SupportDockProvider({
  children,
  othersOpen = false,
  onOpen,
}: {
  children: ReactNode;
  /** Ava's panel is open: the chat makes way (one panel on the right at a time). */
  othersOpen?: boolean;
  /** A chat opened: Ava's panel closes. */
  onOpen?: () => void;
}) {
  const desktop = useMatchesBreakpoint("lg");
  const [chat, setChat] = useState<DockChat | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const go = useDockGo();
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  });
  useEffect(() => {
    if (!othersOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Ava opened: the chat steps aside
    setChat(null);
    setFrom(null);
  }, [othersOpen]);

  const pathname = usePathname();
  const [seenPath, setSeenPath] = useState(pathname);
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    if (pathname.startsWith("/coach/support") && chat && (chat.kind === "list" || chat.kind === "new")) {
      setChat(null);
      setFrom(null);
    }
  }

  const docked = Boolean(chat && desktop === true);
  useDockedClass(docked);

  const value = useMemo<DockValue>(
    () => ({
      chat,
      docked,
      open: (next, at) => {
        setChat(next);
        setFrom(at ?? null);
        onOpenRef.current?.();
      },
      close: () => {
        setChat(null);
        setFrom(null);
      },
      go,
    }),
    [chat, docked, go]
  );

  return (
    <DockContext.Provider value={value}>
      {children}
      {docked && chat ? (
        <aside
          aria-label="Chat"
          className="support-dock bp-doc bp-clean-side bp-chat-side fixed bottom-0 right-0 z-[45] flex flex-col border-l border-slate-200 bg-white"
        >
          <PracticeProvider>
            <DockedChat chat={chat} from={from} setChat={setChat} onClose={value.close} go={go} />
          </PracticeProvider>
        </aside>
      ) : null}
    </DockContext.Provider>
  );
}

function DockedChat({
  chat,
  from,
  setChat,
  onClose,
  go,
}: {
  chat: DockChat;
  from: string | null;
  setChat: (chat: DockChat) => void;
  onClose: () => void;
  go: (to: string) => void;
}) {
  const pathname = usePathname();
  const { href, coachId: practiceCoachId } = usePractice();
  const comments = useSectionComments();
  const { profile } = useDashboardProfile();
  const { coachId, coach, threads, setThreads, loading } = useCoachThreads();
  const [statusError, setStatusError] = useState<string | null>(null);
  const isTheCoach = Boolean(coachId && profile?.id === coachId);
  // BCA viewing as the coach writes to them as BCA (18 Nov, job 228).
  const asBca = Boolean(coachId && profile && !isTheCoach && profile.role === "admin");
  // Until it's sent, an empty chat is about whatever is on screen: the page, its tab, the prospect open.
  const fresh = chat.kind === "list" || chat.kind === "new";
  const screen = useScreenContext(fresh);
  const here = () => readScreenContext().path;

  // They move on before sending: it's about the new thing now (its open chat, or still this empty one).
  const seenPath = useRef(screen.path);
  useEffect(() => {
    if (seenPath.current === screen.path) return;
    seenPath.current = screen.path;
    if (!fresh) return;
    // Straight from the loaded chats, so the box (and anything typed) stays put when there's no match.
    const match = openChatAbout(threads, screen.path);
    if (match) setChat({ kind: "chat", id: match.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when what's on screen changes
  }, [screen.path]);

  // From the top-bar icon: straight into the open chat about what's on screen, if there is one.
  const auto = chat.kind === "list" && chat.auto;
  useEffect(() => {
    if (!auto || loading || !coachId) return;
    const match = openChatAbout(threads, screen.path);
    setChat(match ? { kind: "chat", id: match.id } : { kind: "new" });
  }, [auto, loading, coachId, threads, setChat, screen.path]);

  // A page's chat opens through the comments, which marks it read as it closes.
  const openChat = comments?.openChat;
  const closeComments = useRef(comments?.close);
  useEffect(() => {
    closeComments.current = comments?.close;
  });
  const slug = chat.kind === "page" ? chat.slug : null;
  useEffect(() => {
    if (slug) openChat?.(slug);
    return () => closeComments.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page chat; openChat changes with every comment
  }, [slug]);

  const page = slug ? blueprintPage(slug) : null;
  const thread = chat.kind === "chat" ? threads.find((t) => t.id === chat.id) ?? null : null;

  // What the chat is about: its Blueprint page, the page BCA or the AI linked, or where it was sent from.
  const link = page ? { to: `${href(page.href)}?panel=chat`, label: `Open ${page.title} page` } : thread ? chatLinkFor(thread, href) : null;
  const onTarget = Boolean(link && pathname === link.to.split("?")[0]);
  // One spot by the X: open the page the chat is about, or once there, go back to Support.
  const headerLink =
    link && !onTarget ? (
      <ContextLink label={link.label} onClick={() => go(link.to)} />
    ) : from && pathname !== from ? (
      <ContextLink label="Back to Support" onClick={() => go(from)} />
    ) : null;

  function retitle(id: string, title: string) {
    setThreads((current) => current.map((t) => (t.id === id ? { ...t, title } : t)));
  }

  async function nameChat(id: string) {
    try {
      const data = await commentsCall<{ title: string | null }>(practiceCoachId, "/api/coach/support/chat-title", {
        method: "POST",
        body: { report_id: id },
      });
      if (data?.title) retitle(id, data.title);
      const linked = (data as { context_path?: string | null } | null)?.context_path ?? null;
      if (linked) setThreads((current) => current.map((t) => (t.id === id ? { ...t, context_path: linked } : t)));
    } catch {
      // Keeps its opening words.
    }
  }

  async function markDone(t: ProjectThread, done: boolean) {
    setStatusError(null);
    const next = done ? "resolved" : "open";
    const { error } = await supabaseClient.rpc("member_set_support_ticket_status", { p_report_id: t.id, p_status: next });
    if (error) {
      setStatusError("Couldn't change it. Try again.");
      return;
    }
    setThreads((current) => current.map((row) => (row.id === t.id ? { ...row, status: next } : row)));
    notifyCoachSupportReadChanged();
  }

  return (
    <SidePanel
      mode="comments"
      sectionKey={page ? pageChatKey(page.slug) : null}
      page={page}
      onClose={onClose}
      title={
        chat.kind === "list" || chat.kind === "new" ? (
          // Says what it's about until it's sent; then the chat's own name.
          screen.name
            ? `About ${screen.name}`
            : asBca
              ? `Chat with ${coach?.first_name?.trim() || "the coach"}`
              : "Chat with BCA"
        ) : (
          <span className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              aria-label="Your chats"
              title="Your chats"
              onClick={() => setChat({ kind: "new", about: here() })}
              className="-ml-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--ava-muted)] hover:bg-white/60 hover:text-[var(--ava-ink)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="min-w-0 truncate">
              {page ? page.title : thread ? <ChatName key={thread.id} thread={thread} onRenamed={retitle} /> : "Chat"}
            </span>
          </span>
        )
      }
      action={
        <>
          {headerLink}
          {thread && isTheCoach ? (
            <button
              type="button"
              onClick={() => void markDone(thread, thread.status !== "resolved")}
              title={statusError ?? undefined}
              className="shrink-0 rounded-md px-1.5 py-1 text-xs font-medium text-[var(--ava-muted)] hover:bg-white/60 hover:text-[var(--ava-ink)]"
            >
              {thread.status === "resolved" ? "Reopen" : "Mark done"}
            </button>
          ) : null}
        </>
      }
    >
      {chat.kind === "page" ? null : !coachId ? (
        <p className="px-4 py-6 text-sm text-slate-500">Opening…</p>
      ) : auto ? (
        <p className="px-4 py-6 text-sm text-slate-500">Opening…</p>
      ) : chat.kind === "list" || chat.kind === "new" ? (
        <BcaChat
          key="new"
          thread={null}
          coach={coach}
          coachId={coachId}
          onClose={onClose}
          asBca={asBca}
          about={screen.path}
          aboutName={screen.name}
          welcome={
            <ChatWelcome
              threads={threads}
              name={screen.name}
              asBca={asBca}
              coach={coach}
              onOpen={(id) => setChat({ kind: "chat", id })}
            />
          }
          onChange={(created) => {
            setThreads((current) => [...current, created]);
            setChat({ kind: "chat", id: created.id });
            notifyCoachSupportReadChanged();
            // BCA titles its own chat ("About Campaigns"); a coach's is named from their words.
            if (!asBca) void nameChat(created.id);
          }}
        />
      ) : thread ? (
        <BcaChat
          key={thread.id}
          thread={thread}
          coach={coach}
          coachId={coachId}
          onClose={onClose}
          asBca={asBca}
          onChange={(next) => {
            setThreads((current) => current.map((t) => (t.id === next.id ? next : t)));
            notifyCoachSupportReadChanged();
          }}
        />
      ) : (
        <p className="px-4 py-6 text-sm text-slate-500">Opening…</p>
      )}
    </SidePanel>
  );
}

/**
 * What an empty chat about this page shows above the box (18 Nov, job 228):
 * hello, one line, and the other open chats folded underneath.
 */
/** The newest open chat about a page (its link, or where it was written when it has no link). */
function openChatAbout(threads: ProjectThread[], about: string): ProjectThread | null {
  const bare = about.split("?")[0];
  return (
    [...threads]
      .reverse()
      .find(
        (t) =>
          t.status !== "resolved" &&
          (t.context_path === about || (!t.context_path && !about.includes("?") && t.page_path === bare))
      ) ?? null
  );
}

const OPEN_CHATS_KEY = "support-panel-open-chats";

function ChatWelcome({
  threads,
  name,
  asBca,
  coach,
  onOpen,
}: {
  threads: ProjectThread[];
  name: string | null;
  asBca: boolean;
  coach: SupportTicketAuthor | null;
  onOpen: (id: string) => void;
}) {
  const lastAt = (t: ProjectThread) => t.replies[t.replies.length - 1]?.created_at ?? t.created_at;
  const sorted = [...threads].sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
  const open = sorted.filter((t) => t.status !== "resolved");
  const coachName = coach?.first_name?.trim() || null;
  // Folded by default; the panel remembers if they open it.
  const [openShown, setOpenShown] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved choice once
      setOpenShown(window.localStorage.getItem(OPEN_CHATS_KEY) === "1");
    } catch {
      /* noop */
    }
  }, []);

  // Open chats as the welcome's cards, folded under one line like Support's Done (18 Nov).
  const cards = open.length ? (
    <div className="mt-10 text-left">
      <button
        type="button"
        aria-expanded={openShown}
        onClick={() => {
          const next = !openShown;
          setOpenShown(next);
          try {
            window.localStorage.setItem(OPEN_CHATS_KEY, next ? "1" : "0");
          } catch {
            /* noop */
          }
        }}
        className="flex w-full items-center gap-2 border-b border-slate-200 pb-3 text-left"
      >
        <span className="text-sm font-semibold text-slate-900">{asBca ? `Open chats with ${coachName || "them"}` : "Your open chats"}</span>
        <span className="text-sm text-slate-400">{open.length}</span>
        <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${openShown ? "rotate-90" : ""}`} aria-hidden />
      </button>
      {openShown ? (
        <ul className="mt-3 space-y-3">
          {open.map((t) => {
            const last = t.replies[t.replies.length - 1];
            return (
              <li key={t.id}>
                <button type="button" onClick={() => onOpen(t.id)} className={cardClass("soft", "block w-full p-3 text-left hover:bg-white")}>
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{t.title?.trim() || "Chat"}</span>
                    <span className="shrink-0 text-xs text-slate-500">{formatSupportRelativeCompact(lastAt(t))}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-slate-600">{(last?.body ?? t.details ?? "").replace(/\s+/g, " ")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  ) : null;

  // Small and calm (18 Nov): a heading, one line, the open chats; the box below starts the chat.
  return (
        <div className="mx-auto w-full max-w-sm px-2 text-center">
          {asBca ? (
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xl font-semibold text-slate-600">
              {coach?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coach.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (coachName ?? "?").slice(0, 1)
              )}
            </span>
          ) : null}
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
            {asBca ? (coachName ? `Message ${coachName}` : "Message the coach") : coachName ? `Hi, ${coachName}` : "Hi"}
          </h2>
          <p className="mt-2 text-base leading-snug text-slate-600">
            {asBca
              ? `About ${name ?? "this page"}.`
              : name
                ? `How can we help with ${name}?`
                : "How can we help?"}
          </p>
          {!asBca ? <p className="mt-3 text-sm text-slate-500">We reply within 2 business days.</p> : null}
          {cards}
        </div>
  );
}

/**
 * The page a chat with BCA is about, for its "Open … page" button: the page BCA
 * or the AI linked, else where it was sent from (when that isn't Support).
 */
export function chatLinkFor(
  thread: Pick<ProjectThread, "context_path" | "page_path">,
  href: (path: string) => string
): { to: string; label: string } | null {
  const linked = chatPageFor(thread.context_path);
  if (linked) return { to: linked.path, label: linked.button };
  if (thread.context_path?.startsWith("/coach/")) return { to: thread.context_path, label: "Open that page" };
  const sentFrom = contextPath(thread.page_path ?? null);
  if (!sentFrom) return null;
  const blueprint = BLUEPRINT_PAGES.find((p) => href(p.href) === sentFrom);
  return { to: sentFrom, label: blueprint ? `Open ${blueprint.title} page` : "Open that page" };
}

/** Where a chat was written, when that's somewhere worth going back to (not Support itself). */
export function contextPath(path: string | null): string | null {
  if (!path || !path.startsWith("/coach/")) return null;
  if (path.startsWith("/coach/support")) return null;
  return path;
}

/**
 * Beside the chat's X: open the page the chat is about (the arrow points left,
 * where it opens), or Back to Support. One clear blue pill, always in the same spot.
 */
export function ContextLink({ label, onClick, href }: { label: string; onClick?: () => void; href?: string }) {
  const className = `inline-flex min-w-0 shrink items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${BRAND_BUTTON}`;
  const inner = (
    <>
      <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  ) : (
    <Link href={href ?? "#"} className={className}>
      {inner}
    </Link>
  );
}
