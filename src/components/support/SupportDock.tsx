"use client";

import "@/components/practice/document/blueprint.css";
import "@/components/practice/document/blueprint-clean.css";
import "./supportDock.css";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

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
import { supabaseClient } from "@/lib/supabaseClient";

/** The app's own main-button blue, flat (5 Nov: not near-black, no gradient). */
export const BRAND_BUTTON = "bg-[#0c5290] text-white hover:bg-[#0a4578]";

export type DockChat = { kind: "page"; slug: string } | { kind: "chat"; id: string } | { kind: "new" };

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
export function SupportDockProvider({ children }: { children: ReactNode }) {
  const desktop = useMatchesBreakpoint("lg");
  const [chat, setChat] = useState<DockChat | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const go = useDockGo();

  const docked = Boolean(chat && desktop === true);
  useDockedClass(docked);

  const value = useMemo<DockValue>(
    () => ({
      chat,
      docked,
      open: (next, at) => {
        setChat(next);
        setFrom(at ?? null);
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
  const { coachId, coach, threads, setThreads } = useCoachThreads();
  const [statusError, setStatusError] = useState<string | null>(null);
  const isTheCoach = Boolean(coachId && profile?.id === coachId);

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
      title={page ? page.title : thread ? <ChatName key={thread.id} thread={thread} onRenamed={retitle} /> : chat.kind === "new" ? "New chat" : "Chat"}
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
      ) : chat.kind === "new" ? (
        <BcaChat
          key="new"
          thread={null}
          coach={coach}
          coachId={coachId}
          onClose={onClose}
          onChange={(created) => {
            setThreads((current) => [...current, created]);
            setChat({ kind: "chat", id: created.id });
            notifyCoachSupportReadChanged();
            void nameChat(created.id);
          }}
        />
      ) : thread ? (
        <BcaChat
          key={thread.id}
          thread={thread}
          coach={coach}
          coachId={coachId}
          onClose={onClose}
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
 * The page a chat with BCA is about, for its "Open … page" button: the page BCA
 * or the AI linked, else where it was sent from (when that isn't Support).
 */
export function chatLinkFor(
  thread: Pick<ProjectThread, "context_path" | "page_path">,
  href: (path: string) => string
): { to: string; label: string } | null {
  const linked = chatPageFor(thread.context_path);
  if (linked) return { to: linked.path, label: linked.button };
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
