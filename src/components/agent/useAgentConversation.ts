"use client";

import { useCallback, useState } from "react";

import type { AgentActionView, AgentCoach, AgentDisplayItem, AgentStreamEvent } from "@/lib/agent/types";

/**
 * One conversation with Ava: sending, streaming the reply, confirm cards, and
 * opening a past chat. Shared by the app-wide AI panel and the Blueprint.
 */

export type AgentChatSummary = { id: string; title: string; updated_at: string; by?: "you" | "coach" | "bca" };

export function useAgentConversation({
  authHeaders,
  screenPath,
  defaultCoach,
  onWrote,
}: {
  authHeaders: () => Promise<Record<string, string> | null>;
  screenPath: string | null;
  defaultCoach: AgentCoach | null;
  /** Something changed in the app (a tool wrote, or a card was confirmed). */
  onWrote?: () => void;
}) {
  const [items, setItems] = useState<AgentDisplayItem[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [coach, setCoach] = useState<AgentCoach | null>(defaultCoach);
  const [title, setTitle] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((event: AgentStreamEvent) => {
    switch (event.type) {
      case "chat":
        setChatId(event.chatId);
        setCoach(event.coach);
        return;
      case "coach":
        setCoach(event.coach);
        return;
      case "title":
        setTitle(event.title);
        return;
      case "error":
        setError(event.message);
        return;
      case "done":
        return;
    }
    setItems((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      switch (event.type) {
        case "text":
          if (last?.type === "assistant") next[next.length - 1] = { ...last, text: last.text + event.delta };
          else next.push({ type: "assistant", text: event.delta });
          return next;
        case "tool_start":
          next.push({ type: "tool", id: event.id, name: event.name, label: event.label, ok: null });
          return next;
        case "tool_end":
          return next.map((item) =>
            item.type === "tool" && item.id === event.id
              ? { ...item, ok: event.ok, ...(event.ok && event.note ? { note: event.note } : {}) }
              : item
          );
        case "capability":
          next.push({ type: "capability", id: event.id, title: event.title });
          return next;
        case "action":
          next.push({ type: "action", action: event.action });
          return next;
        case "link":
          next.push({ type: "link", link: event.link });
          return next;
      }
      return next;
    });
  }, []);

  const runTurn = useCallback(
    async (body: { message?: string; actionId?: string }, currentChatId: string | null) => {
      setError(null);
      setStreaming(true);
      let wrote = false;
      try {
        const headers = await authHeaders();
        if (!headers) {
          setError("Please sign in again.");
          return;
        }
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers,
          body: JSON.stringify({ ...body, chatId: currentChatId, screenPath }),
        });
        if (!res.ok || !res.body) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          setError(payload.error || "Something went wrong. Try again.");
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline = buffer.indexOf("\n");
          while (newline >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            newline = buffer.indexOf("\n");
            if (!line) continue;
            try {
              const event = JSON.parse(line) as AgentStreamEvent;
              if (event.type === "tool_end" && event.ok) wrote = true;
              apply(event);
            } catch {
              // Ignore a malformed line rather than dropping the turn.
            }
          }
        }
      } catch {
        setError("Connection dropped. Try again.");
      } finally {
        setStreaming(false);
        if (wrote) onWrote?.();
      }
    },
    [apply, authHeaders, onWrote, screenPath]
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming || readOnly) return false;
      setItems((prev) => [...prev, { type: "user", text: trimmed }]);
      void runTurn({ message: trimmed }, chatId);
      return true;
    },
    [chatId, readOnly, runTurn, streaming]
  );

  const decide = useCallback(
    async (action: AgentActionView, decision: "confirm" | "cancel") => {
      if (deciding || streaming) return;
      setDeciding(action.id);
      setError(null);
      const update = (next: AgentActionView) =>
        setItems((prev) =>
          prev.map((item) => (item.type === "action" && item.action.id === next.id ? { ...item, action: next } : item))
        );
      try {
        if (decision === "confirm") update({ ...action, status: "running" });
        const headers = await authHeaders();
        if (!headers) {
          setError("Please sign in again.");
          update(action);
          return;
        }
        const res = await fetch(`/api/agent/actions/${action.id}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ decision }),
        });
        const body = (await res.json().catch(() => ({}))) as { action?: AgentActionView; error?: string };
        if (!res.ok || !body.action) {
          setError(body.error || "Could not do that. Try again.");
          update(action);
          return;
        }
        update(body.action);
        if (decision === "confirm") onWrote?.();
        // Let Ava carry on from the result.
        await runTurn({ actionId: body.action.id }, chatId);
      } finally {
        setDeciding(null);
      }
    },
    [authHeaders, chatId, deciding, onWrote, runTurn, streaming]
  );

  const openChat = useCallback(
    async (id: string) => {
      const headers = await authHeaders();
      if (!headers) return false;
      const res = await fetch(`/api/agent/chats/${id}`, { headers });
      if (!res.ok) {
        setError("Could not open that conversation.");
        return false;
      }
      const body = (await res.json()) as {
        chat: { id: string; title?: string; coach: AgentCoach | null; readOnly?: boolean };
        items: AgentDisplayItem[];
      };
      setChatId(body.chat.id);
      setCoach(body.chat.coach);
      setTitle(body.chat.title ?? null);
      setReadOnly(Boolean(body.chat.readOnly));
      setItems(body.items);
      setError(null);
      return true;
    },
    [authHeaders]
  );

  const newChat = useCallback(() => {
    setItems([]);
    setChatId(null);
    setTitle(null);
    setReadOnly(false);
    setCoach(null);
    setError(null);
  }, []);

  // Before the first reply, the chat is about the default coach.
  const shownCoach = chatId ? coach : defaultCoach;
  return { items, chatId, coach: shownCoach, title, readOnly, streaming, deciding, error, send, decide, openChat, newChat };
}
