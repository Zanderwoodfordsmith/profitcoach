"use client";

import "@/components/ava/ava.css";
import "@/components/practice/document/blueprint.css";
import "@/components/practice/document/blueprint-clean.css";
import "./supportDock.css";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, Check, ChevronDown, MessageSquare, X } from "lucide-react";

import { JobStatusCircle } from "@/components/jobs/jobParts";

import { previewCoachNext } from "@/components/admin/BlueprintCoachPreview";
import { useMatchesBreakpoint } from "@/hooks/useBreakpoint";
import { BLUEPRINT_PAGES } from "@/lib/practiceKnowledge/blueprint";
import { chatPageFor } from "@/lib/support/chatPages";
import { SUPPORT_STATUS_ADMIN_LABELS, SUPPORT_STATUS_JOB, type SupportTicketStatus } from "@/lib/support/tickets";

import { BRAND_BUTTON, ContextLink, SupportDockContext, contextPath, useDockGo, useDockedClass, type DockValue } from "./SupportDock";

const SUPPORT_PATH = "/admin/support";

/** What the chat is about, as BCA opens it: the coach's Blueprint page here, anything else as the coach in a new tab. */
export type AdminChatLink = { to: string; label: string; newTab: boolean };

/** One ticket's chat, drawn by the Support page (its thread keeps every admin tool). */
export type AdminDockEntry = {
  id: string;
  title: string;
  status: SupportTicketStatus;
  link: AdminChatLink | null;
  onStatus: (status: SupportTicketStatus) => void | Promise<void>;
  thread: ReactNode;
};

type AdminDockValue = {
  entry: AdminDockEntry | null;
  /** Opens a ticket's chat on the right, or refreshes the one open. */
  show: (entry: AdminDockEntry) => void;
  close: () => void;
  /** Goes to a page with the chat docked beside it (or back to Support). */
  go: (to: string) => void;
};

const AdminDockContext = createContext<AdminDockValue | null>(null);

/** Null outside admin. */
export function useAdminSupportDock(): AdminDockValue | null {
  return useContext(AdminDockContext);
}

/**
 * The page a ticket is about, for the chat's "Open … page" pill: the page BCA
 * or the AI linked, else where the coach wrote it from. Blueprint pages open
 * in admin's Blueprint for that coach, beside the chat; other coach pages open
 * as the coach in a new tab, as "Their inbox" does.
 */
export function adminChatLinkFor(row: {
  created_by: string | null;
  context_path?: string | null;
  page_path: string | null;
}): AdminChatLink | null {
  if (!row.created_by) return null;
  const linked = chatPageFor(row.context_path);
  const path = linked?.path ?? contextPath(row.page_path);
  if (!path) return null;
  const [bare, query] = path.split("?");
  const blueprint = BLUEPRINT_PAGES.find((p) => p.href === bare);
  const label = linked?.button ?? (blueprint ? `Open ${blueprint.title} page` : "Open that page");
  const coach = encodeURIComponent(row.created_by);
  if (bare === "/coach/blueprint" || bare.startsWith("/coach/blueprint/")) {
    const rest = bare.slice("/coach/blueprint".length);
    return { to: `/admin/blueprint/coach${rest}?coach=${coach}`, label, newTab: false };
  }
  return { to: `${bare}?${query ? `${query}&` : ""}impersonate=${coach}`, label, newTab: true };
}

/** The first two parts of a path, e.g. /admin/blueprint: the chat stays while BCA moves around in there. */
function zoneOf(path: string): string {
  return path.split("?")[0].split("/").slice(0, 3).join("/");
}

/**
 * Admin Support V2 (5 Nov): a ticket's chat docked on the right, drawn like the
 * coach's own chat. It stays while BCA opens the coach's Blueprint page it's
 * about, and "Back to Support" brings back the list. Leaving any other way
 * closes it.
 */
export function AdminSupportDockProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const desktop = useMatchesBreakpoint("lg");
  const [entry, setEntry] = useState<AdminDockEntry | null>(null);
  // Status changed from the chat's header, held while the Support page isn't there to redraw it.
  const [held, setHeld] = useState<{ id: string; status: SupportTicketStatus } | null>(null);
  // Where "Open … page" went (e.g. /admin/blueprint): the chat stays while BCA moves around in there.
  const [zone, setZone] = useState<string | null>(null);
  const navigate = useDockGo();

  const close = useCallback(() => {
    setEntry(null);
    setHeld(null);
    setZone(null);
  }, []);

  // Somewhere other than Support or the page the chat opened: the chat closes.
  const [seenPath, setSeenPath] = useState(pathname);
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    if (entry && !pathname.startsWith(SUPPORT_PATH) && !(zone && pathname.startsWith(zone))) close();
  }

  const show = useCallback((next: AdminDockEntry) => {
    setEntry(next);
    setHeld(null);
  }, []);

  const go = useCallback(
    (to: string) => {
      setZone(to.startsWith(SUPPORT_PATH) ? null : zoneOf(to));
      const coach = to.startsWith("/admin/blueprint/coach") ? new URL(to, window.location.origin).searchParams.get("coach") : null;
      if (coach) previewCoachNext(coach);
      navigate(to);
    },
    [navigate]
  );

  // On Support the chat sits in the middle of the page; it docks here beside the page it's about.
  const docked = Boolean(entry && desktop === true && !pathname.startsWith(SUPPORT_PATH));
  useDockedClass(docked);

  const admin = useMemo<AdminDockValue>(() => ({ entry, show, close, go }), [entry, show, close, go]);
  // The coach dock's context too, so the Blueprint leaves its column free and opens no second chat.
  const shared = useMemo<DockValue>(
    () => ({
      chat: entry ? { kind: "chat", id: entry.id } : null,
      docked,
      open: () => {},
      close,
      go,
    }),
    [entry, docked, close, go]
  );

  const status = held && entry && held.id === entry.id ? held.status : entry?.status;

  return (
    <AdminDockContext.Provider value={admin}>
      <SupportDockContext.Provider value={shared}>
        {children}
        {docked && entry && status ? (
          <aside
            aria-label="Chat"
            className="support-dock bp-doc bp-clean-side bp-chat-side fixed bottom-0 right-0 z-[45] flex flex-col border-l"
          >
            <AdminChatPanel
              key={entry.id}
              title={entry.title}
              status={status}
              onStatus={(next) => {
                setHeld({ id: entry.id, status: next });
                void entry.onStatus(next);
              }}
              link={<ContextLink label="Back to Support" onClick={() => go(SUPPORT_PATH)} />}
              onClose={close}
            >
              {entry.thread}
            </AdminChatPanel>
          </aside>
        ) : null}
      </SupportDockContext.Provider>
    </AdminDockContext.Provider>
  );
}

/** The pill beside the chat's title: the page it's about, here (Blueprint) or as the coach in a new tab. */
export function AdminChatLinkPill({ link, onOpen }: { link: AdminChatLink; onOpen: () => void }) {
  if (!link.newTab) return <ContextLink label={link.label} onClick={onOpen} />;
  return (
    <a
      href={link.to}
      target="_blank"
      rel="noopener noreferrer"
      title="Opens as the coach, in a new tab"
      className={`inline-flex min-w-0 shrink items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${BRAND_BUTTON}`}
    >
      <span className="truncate">{link.label}</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
    </a>
  );
}

/**
 * A ticket's chat as the coach's panel draws it: title, the page pill, the
 * status menu, then the thread. Needs a `bp-doc bp-clean-side bp-chat-side` parent.
 */
export function AdminChatPanel({
  title,
  status,
  onStatus,
  link,
  onClose,
  children,
}: {
  title: string;
  status: SupportTicketStatus;
  onStatus: (status: SupportTicketStatus) => void;
  link: ReactNode;
  onClose?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="bp-side-panel ava-ui relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="bp-side-head relative z-[2] flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <MessageSquare className="h-4 w-4 shrink-0 text-[var(--ava-muted)]" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-[var(--ava-ink)]" title={title}>
          {title}
        </p>
        {link}
        <TicketStatusMenu status={status} onStatus={onStatus} />
        {onClose ? (
          <button
            type="button"
            aria-label="Close chat"
            title="Close"
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--ava-muted)] hover:bg-white/60 hover:text-[var(--ava-ink)]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/** The ticket's status as the jobs mark it (12 Nov): circle and word, a menu of all five. */
function TicketStatusMenu({
  status,
  onStatus,
}: {
  status: SupportTicketStatus;
  onStatus: (status: SupportTicketStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-label="Ticket status"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-[var(--ava-ink)] hover:bg-white/60"
      >
        <JobStatusCircle status={SUPPORT_STATUS_JOB[status]} audience="admin" />
        {SUPPORT_STATUS_ADMIN_LABELS[status]}
        <ChevronDown className="h-3.5 w-3.5 text-[var(--ava-muted)]" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-max min-w-[10rem] rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10"
        >
          {(Object.keys(SUPPORT_STATUS_ADMIN_LABELS) as SupportTicketStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                if (s !== status) onStatus(s);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-100"
            >
              <JobStatusCircle status={SUPPORT_STATUS_JOB[s]} audience="admin" />
              <span className="flex-1 whitespace-nowrap">{SUPPORT_STATUS_ADMIN_LABELS[s]}</span>
              {s === status ? <Check className="h-3.5 w-3.5 text-slate-500" strokeWidth={2.5} aria-hidden /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
