"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { practiceHeaders, type PracticeCoachId } from "@/lib/practiceKnowledge/practiceApi";
import {
  summariseThreads,
  type CommentPerson,
  type CommentReaderSide,
  type CommentReads,
  type SectionComment,
  type ThreadSummary,
} from "@/lib/practiceKnowledge/sectionCommentTypes";

/** How often an open Blueprint checks for new comments. */
const POLL_MS = 60_000;

type SectionCommentsValue = {
  /** Which side this viewer writes as. Null until loaded. */
  side: CommentReaderSide | null;
  /** The signed-in person, so a comment can tell "yours" from another BCA admin's. */
  viewerId: string | null;
  /** Coach and BCA people a comment can be assigned to. */
  people: CommentPerson[];
  comments: SectionComment[];
  threads: Record<string, ThreadSummary>;
  /** The section whose thread is open. One at a time. */
  openKey: string | null;
  /** The comments panel is showing: one section's thread, or the list of all of them. */
  panelOpen: boolean;
  /** A thread to scroll its section into view for (from a link or the list). */
  linkedKey: string | null;
  clearLinked: () => void;
  /** From a section's own icon: open its thread, or close the panel if it is already open. */
  toggle: (key: string) => void;
  /** From the list: open a thread and bring its section into view. */
  open: (key: string) => void;
  /** The conversations on the page you are reading. */
  openList: () => void;
  close: () => void;
  post: (key: string, body: string) => Promise<string | null>;
  edit: (id: string, body: string) => Promise<string | null>;
  remove: (id: string) => Promise<string | null>;
  assign: (id: string, assigneeId: string | null) => Promise<string | null>;
};

const SectionCommentsContext = createContext<SectionCommentsValue | null>(null);

/** Counts every comment in a thread as read while it is open. */
const OPEN_THREAD_READ_AT = "9999-12-31T23:59:59.999Z";

type CommentsLoad = {
  side: CommentReaderSide;
  viewer_id: string;
  comments: SectionComment[];
  reads: CommentReads;
  people: CommentPerson[];
};

async function call<T>(coachId: PracticeCoachId, path: string, init?: { method: string; body: unknown }): Promise<T | null> {
  const headers = await practiceHeaders(coachId);
  if (!headers) return null;
  try {
    const res = await fetch(path, {
      method: init?.method ?? "GET",
      headers,
      body: init ? JSON.stringify(init.body) : undefined,
    });
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
    return data;
  } catch (err) {
    if (init) throw err;
    return null;
  }
}

/** Comment threads for the Blueprint being shown. Off in the empty preview. */
export function SectionCommentsProvider({
  coachId,
  enabled,
  children,
}: {
  coachId: PracticeCoachId;
  enabled: boolean;
  children: ReactNode;
}) {
  // A link can name a thread to open (?thread=page:id). Threads only draw once comments load, so this never differs from the server render.
  const linkedFromUrl = () =>
    enabled && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("thread") : null;
  const [side, setSide] = useState<CommentReaderSide | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [people, setPeople] = useState<CommentPerson[]>([]);
  const [comments, setComments] = useState<SectionComment[]>([]);
  const [reads, setReads] = useState<CommentReads>({});
  const [openKey, setOpenKey] = useState<string | null>(linkedFromUrl);
  const [linkedKey, setLinkedKey] = useState<string | null>(linkedFromUrl);
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const refresh = () => {
      void call<CommentsLoad>(coachId, "/api/coach/practice/comments").then((data) => {
        if (!live || !data) return;
        setSide(data.side);
        setViewerId(data.viewer_id);
        setPeople(data.people ?? []);
        setComments(data.comments);
        setReads(data.reads);
      });
    };
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [coachId, enabled]);

  const threads = useMemo(() => {
    if (!side) return {};
    return summariseThreads(comments, side, openKey ? { ...reads, [openKey]: OPEN_THREAD_READ_AT } : reads);
  }, [comments, openKey, reads, side]);

  // Tell the server when an open thread has something new in it. Closing it records the read here too.
  const openUnread = useMemo(() => {
    if (!side || !openKey) return 0;
    return summariseThreads(
      comments.filter((c) => c.section_key === openKey),
      side,
      reads
    )[openKey]?.unread ?? 0;
  }, [comments, openKey, reads, side]);
  useEffect(() => {
    if (!enabled || !openKey || openUnread === 0) return;
    void call<{ read_at: string }>(coachId, "/api/coach/practice/comments/read", {
      method: "POST",
      body: { section_key: openKey },
    }).catch(() => undefined);
  }, [coachId, enabled, openKey, openUnread]);

  const readNow = useCallback((key: string | null) => {
    if (key) setReads((prev) => ({ ...prev, [key]: new Date().toISOString() }));
  }, []);

  const post = useCallback(
    async (key: string, body: string): Promise<string | null> => {
      try {
        const data = await call<{ comment: SectionComment }>(coachId, "/api/coach/practice/comments", {
          method: "POST",
          body: { section_key: key, body },
        });
        if (!data) return "Not signed in.";
        setComments((prev) => [...prev, data.comment]);
        setReads((prev) => ({ ...prev, [key]: data.comment.created_at }));
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : "Could not send.";
      }
    },
    [coachId]
  );

  const replace = useCallback((comment: SectionComment) => {
    setComments((prev) => prev.map((item) => (item.id === comment.id ? comment : item)));
  }, []);

  const edit = useCallback(
    async (id: string, body: string): Promise<string | null> => {
      try {
        const data = await call<{ comment: SectionComment }>(coachId, "/api/coach/practice/comments", {
          method: "PATCH",
          body: { id, body },
        });
        if (!data) return "Not signed in.";
        replace(data.comment);
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : "Could not save.";
      }
    },
    [coachId, replace]
  );

  const remove = useCallback(
    async (id: string): Promise<string | null> => {
      try {
        const data = await call<{ ok: boolean }>(coachId, "/api/coach/practice/comments", {
          method: "DELETE",
          body: { id },
        });
        if (!data) return "Not signed in.";
        setComments((prev) => prev.filter((item) => item.id !== id));
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : "Could not delete.";
      }
    },
    [coachId]
  );

  const assign = useCallback(
    async (id: string, assigneeId: string | null): Promise<string | null> => {
      try {
        const data = await call<{ comment: SectionComment }>(coachId, "/api/coach/practice/comments", {
          method: "PATCH",
          body: { id, assignee_id: assigneeId },
        });
        if (!data) return "Not signed in.";
        replace(data.comment);
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : "Could not assign.";
      }
    },
    [coachId, replace]
  );

  const value = useMemo<SectionCommentsValue>(
    () => ({
      side,
      viewerId,
      people,
      comments,
      threads,
      openKey,
      panelOpen: listOpen || Boolean(openKey),
      linkedKey,
      clearLinked: () => setLinkedKey(null),
      toggle: (key) => {
        readNow(openKey);
        const closing = openKey === key;
        setOpenKey(closing ? null : key);
        setListOpen(!closing);
      },
      open: (key) => {
        readNow(openKey);
        setOpenKey(key);
        setLinkedKey(key);
        setListOpen(true);
      },
      openList: () => {
        readNow(openKey);
        setOpenKey(null);
        setListOpen(true);
      },
      close: () => {
        readNow(openKey);
        setOpenKey(null);
        setListOpen(false);
      },
      post,
      edit,
      remove,
      assign,
    }),
    [assign, comments, edit, linkedKey, listOpen, openKey, people, post, readNow, remove, side, threads, viewerId]
  );

  if (!enabled) return <>{children}</>;
  return <SectionCommentsContext.Provider value={value}>{children}</SectionCommentsContext.Provider>;
}

/** Null when comments are off, for example in the empty preview. */
export function useSectionComments(): SectionCommentsValue | null {
  return useContext(SectionCommentsContext);
}
