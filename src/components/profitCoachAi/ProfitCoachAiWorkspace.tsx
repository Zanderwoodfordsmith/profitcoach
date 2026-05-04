"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Outfit } from "next/font/google";

import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { getBrainGapBannerText } from "@/lib/profitCoachAi/brainHints";
import {
  getDefaultOutputId,
  PROFIT_COACH_OUTPUTS,
  PROFIT_COACH_ROLES,
} from "@/lib/profitCoachAi/registry";
import type { CoachAiContext } from "@/lib/profitCoachAi/types";

import { ProfitCoachAiBrainForm } from "./ProfitCoachAiBrainForm";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

type ChatRow = {
  id: string;
  title: string | null;
  last_output_id: string | null;
  last_role_id: string | null;
  updated_at: string;
};

type MsgRow = { id: string; role: "user" | "assistant"; content: string };

export type ProfitCoachAiTab = "chat" | "brain";

const HISTORY_RAIL_STORAGE_KEY = "profit-coach-ai-history-rail-open";

function ArrowSubmitIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 5l7 7m0 0l-7 7m7-7H3"
      />
    </svg>
  );
}

function formatChatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.floor((now - t) / 1000);
  if (sec < 45) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

type WorkspaceProps = {
  activeTab: ProfitCoachAiTab;
  basePath: string;
};

export function ProfitCoachAiWorkspace({
  activeTab,
  basePath,
}: WorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { impersonatingCoachId } = useImpersonation();
  const prefix = pathname.startsWith("/admin") ? "/admin" : "/coach";
  const compassHref = `${prefix}/signature`;
  const settingsHref = `${prefix}/settings`;
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [outputId, setOutputId] = useState(getDefaultOutputId());
  const [roleId, setRoleId] = useState<string | null>(null);
  const [aiContext, setAiContext] = useState<CoachAiContext>({});

  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [brainFormKey, setBrainFormKey] = useState(0);
  const [brainDraftFromChat, setBrainDraftFromChat] = useState<string | null>(
    null
  );
  const [brainSaving, setBrainSaving] = useState(false);
  const [brainSaveError, setBrainSaveError] = useState<string | null>(null);
  const [brainSaveOk, setBrainSaveOk] = useState(false);

  const [showSaveOffer, setShowSaveOffer] = useState(false);
  const lastUserTurnRef = useRef<string>("");

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [historyRailOpen, setHistoryRailOpen] = useState(true);
  const historyRailHydrated = useRef(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const authHeaders = useCallback(async (): Promise<Record<
    string,
    string
  > | null> => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return null;
    const h: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
    if (impersonatingCoachId) {
      h["x-impersonate-coach-id"] = impersonatingCoachId;
    }
    return h;
  }, [impersonatingCoachId]);

  const loadProfileContext = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/coach/profile", { headers });
    if (!res.ok) return;
    const data = (await res.json()) as { ai_context?: CoachAiContext };
    setAiContext(data.ai_context ?? {});
  }, [authHeaders]);

  const loadChats = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    setLoadingChats(true);
    const res = await fetch("/api/coach/profit-coach-ai/chats", { headers });
    setLoadingChats(false);
    if (!res.ok) return;
    const data = (await res.json()) as { chats: ChatRow[] };
    setChats(data.chats ?? []);
  }, [authHeaders]);

  useEffect(() => {
    void loadChats();
    void loadProfileContext();
  }, [loadChats, loadProfileContext]);

  useEffect(() => {
    if (historyRailHydrated.current) return;
    historyRailHydrated.current = true;
    try {
      const v = localStorage.getItem(HISTORY_RAIL_STORAGE_KEY);
      if (v === "0") setHistoryRailOpen(false);
    } catch {
      /* private mode */
    }
  }, []);

  function persistHistoryRailOpen(next: boolean) {
    try {
      localStorage.setItem(HISTORY_RAIL_STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* noop */
    }
  }

  function toggleHistoryRail() {
    setHistoryRailOpen((open) => {
      const next = !open;
      persistHistoryRailOpen(next);
      return next;
    });
  }

  function expandHistoryRail() {
    setHistoryRailOpen(true);
    persistHistoryRailOpen(true);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const prevTabRef = useRef<ProfitCoachAiTab | null>(null);
  useEffect(() => {
    const prev = prevTabRef.current;
    if (prev === "brain" && activeTab !== "brain") {
      setBrainDraftFromChat(null);
    }
    if (activeTab === "brain" && prev !== "brain") {
      setBrainFormKey((k) => k + 1);
      setBrainSaveOk(false);
    }
    prevTabRef.current = activeTab;
  }, [activeTab]);

  function goToBrainTab(draft: string | null) {
    setBrainDraftFromChat(draft);
    setBrainSaveOk(false);
    router.push(`${basePath}?tab=brain`, { scroll: false });
  }

  async function openChat(chatId: string) {
    setSelectedChatId(chatId);
    setLoadingMessages(true);
    setError(null);
    setShowSaveOffer(false);
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch(`/api/coach/profit-coach-ai/chats/${chatId}`, {
      headers,
    });
    setLoadingMessages(false);
    if (!res.ok) {
      setError("Could not load chat.");
      return;
    }
    const data = (await res.json()) as {
      chat: ChatRow;
      messages: MsgRow[];
    };
    setMessages(
      (data.messages ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }))
    );
    if (data.chat?.last_output_id) setOutputId(data.chat.last_output_id);
    if (data.chat?.last_role_id !== undefined) {
      setRoleId(data.chat.last_role_id);
    }
  }

  async function handleNewChat() {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/coach/profit-coach-ai/chats", {
      method: "POST",
      headers,
    });
    if (!res.ok) return;
    const data = (await res.json()) as { id: string };
    await loadChats();
    setSelectedChatId(data.id);
    setMessages([]);
    setInput("");
    setError(null);
    setShowSaveOffer(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    let chatId = selectedChatId;
    if (!chatId) {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/coach/profit-coach-ai/chats", {
        method: "POST",
        headers,
      });
      if (!res.ok) return;
      const { id: newId } = (await res.json()) as { id: string };
      chatId = newId;
      setSelectedChatId(newId);
      await loadChats();
    }

    await sendWithChatId(chatId!, text);
  }

  async function sendWithChatId(chatId: string, text: string) {
    setInput("");
    setError(null);
    setShowSaveOffer(false);
    lastUserTurnRef.current = text;

    const headers = await authHeaders();
    if (!headers) return;

    const historyForApi = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];

    setMessages((prev) => [
      ...prev,
      { id: `tmp-user-${Date.now()}`, role: "user", content: text },
    ]);
    setStreaming(true);

    try {
      const res = await fetch("/api/coach/profit-coach-ai", {
        method: "POST",
        headers,
        body: JSON.stringify({
          chatId,
          messages: historyForApi,
          outputId,
          roleId,
        }),
      });

      const newHeader = res.headers.get("X-New-Chat-Id");
      if (newHeader) {
        setSelectedChatId(newHeader);
        await loadChats();
      }

      if (!res.ok) {
        const bodyText = await res.text();
        throw new Error(
          bodyText.slice(0, 200) || `Request failed (${res.status})`
        );
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistant = "";
      setMessages((prev) => [
        ...prev,
        { id: `tmp-asst-${Date.now()}`, role: "assistant", content: "" },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, content: assistant };
          }
          return copy;
        });
      }

      await openChat(chatId);
      void loadChats();
      setShowSaveOffer(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setMessages((prev) => {
        if (prev.length >= 2 && prev[prev.length - 1]?.role === "assistant") {
          return prev.slice(0, -2);
        }
        if (prev.length >= 1 && prev[prev.length - 1]?.role === "user") {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setStreaming(false);
    }
  }

  async function saveBrainPatch(patch: CoachAiContext) {
    const headers = await authHeaders();
    if (!headers) return;
    setBrainSaving(true);
    setBrainSaveError(null);
    setBrainSaveOk(false);
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ ai_context: patch }),
    });
    setBrainSaving(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setBrainSaveError(b.error ?? "Save failed.");
      return;
    }
    await loadProfileContext();
    setBrainDraftFromChat(null);
    setBrainSaveOk(true);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const gapBanner = getBrainGapBannerText(outputId, aiContext);

  return (
    <div
      className={`${outfit.variable} flex min-h-[calc(100dvh-8rem)] w-full min-w-0 flex-col gap-0 text-slate-900`}
      style={{ fontFamily: "var(--font-outfit), system-ui, sans-serif" }}
    >
      {activeTab === "chat" ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto py-5">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-3 sm:px-4">
              {gapBanner ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
                  <span className="font-medium">Tip:</span> {gapBanner}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-center gap-2">
                {PROFIT_COACH_OUTPUTS.map((o) => {
                  const dimmed =
                    roleId &&
                    !PROFIT_COACH_ROLES.find((r) => r.id === roleId)?.outputIds.includes(
                      o.id
                    );
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setOutputId(o.id)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        outputId === o.id
                          ? "bg-sky-700 text-white"
                          : dimmed
                            ? "bg-slate-100 text-slate-400 ring-1 ring-slate-200"
                            : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex min-h-[min(28rem,50vh)] flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/90 shadow-lg backdrop-blur-xl">
                {selectedChatId && loadingMessages ? (
                  <p className="p-4 text-center text-sm text-slate-500">
                    Loading messages…
                  </p>
                ) : null}
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                  {messages.length === 0 && !loadingMessages ? (
                    <p className="py-10 text-center text-sm leading-relaxed text-slate-500">
                      Pick a skill above and an optional role below, then type
                      your message. Use the{" "}
                      <button
                        type="button"
                        className="font-medium text-sky-700 underline hover:text-sky-800"
                        onClick={expandHistoryRail}
                      >
                        chats panel
                      </button>{" "}
                      on the right (expand with the chevron if it&apos;s
                      hidden) to open a previous thread.
                    </p>
                  ) : (
                    <div className="mx-auto flex max-w-xl flex-col gap-5">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          {m.role === "user" ? (
                            <div className="max-w-[90%] text-right sm:max-w-[85%]">
                              <p className="text-[15px] leading-relaxed text-slate-700 whitespace-pre-wrap break-words">
                                {m.content}
                              </p>
                            </div>
                          ) : (
                            <div className="max-w-[92%] border-l-2 border-sky-300/70 pl-4 sm:max-w-[88%]">
                              <p className="text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
                                {m.content}
                                {streaming &&
                                m.id === messages[messages.length - 1]?.id ? (
                                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-sky-400 align-middle" />
                                ) : null}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                {showSaveOffer && lastUserTurnRef.current ? (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <p className="mb-2 text-xs font-medium text-slate-600">
                      Save something from your last message to your brain?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          goToBrainTab(lastUserTurnRef.current);
                          setShowSaveOffer(false);
                        }}
                        className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                      >
                        Save to brain
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSaveOffer(false)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Not now
                      </button>
                    </div>
                  </div>
                ) : null}

                <form
                  className="shrink-0 border-t border-slate-100 p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  {error ? (
                    <p className="mb-2 text-sm text-rose-600" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <textarea
                      rows={3}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={onKeyDown}
                      placeholder={
                        PROFIT_COACH_OUTPUTS.find((o) => o.id === outputId)
                          ?.placeholder ?? "Ask the assistant…"
                      }
                      disabled={streaming}
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-400/20 disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={streaming || !input.trim()}
                      className="shrink-0 self-end rounded-xl bg-slate-800 px-4 py-3 text-white hover:bg-slate-700 disabled:opacity-50"
                      aria-label="Send"
                    >
                      {streaming ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <ArrowSubmitIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-center text-xs text-slate-500">
                    Enter to send · Shift+Enter new line
                  </p>
                </form>
              </div>

              <div>
                <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
                  Role (optional)
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PROFIT_COACH_ROLES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRoleId(roleId === r.id ? null : r.id)}
                      className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                        roleId === r.id
                          ? "border-sky-400 bg-sky-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <span className="font-semibold text-slate-900">
                        {r.label}
                      </span>
                      <span className="mt-1 block text-slate-600">
                        {r.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside
            className={`flex shrink-0 flex-col border-t border-slate-200/90 bg-white/95 shadow-[inset_0_1px_0_rgba(15,23,42,0.06)] backdrop-blur-sm transition-[width,max-height] duration-200 ease-out lg:border-l lg:border-t-0 lg:shadow-[inset_1px_0_0_rgba(15,23,42,0.06)] ${
              historyRailOpen
                ? "max-h-[min(42vh,24rem)] w-full lg:max-h-none lg:w-64"
                : "max-h-11 w-full overflow-hidden lg:max-h-none lg:w-11"
            }`}
          >
            <div
              className={`flex shrink-0 items-center gap-2 border-b border-slate-100 px-2 py-2 lg:border-b-0 ${
                historyRailOpen ? "justify-between" : "justify-center lg:min-h-0 lg:flex-1"
              }`}
            >
              {historyRailOpen ? (
                <span className="min-w-0 truncate text-xs font-semibold text-slate-700">
                  Chats
                </span>
              ) : (
                <span className="sr-only">Chats</span>
              )}
              <button
                type="button"
                onClick={toggleHistoryRail}
                title={historyRailOpen ? "Hide chats" : "Show chats"}
                aria-expanded={historyRailOpen}
                aria-controls="profit-coach-ai-chat-list"
                className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:mx-auto"
              >
                {historyRailOpen ? (
                  <ChevronRight className="h-5 w-5" aria-hidden />
                ) : (
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                )}
              </button>
            </div>

            {historyRailOpen ? (
              <div
                id="profit-coach-ai-chat-list"
                className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 lg:pt-0"
              >
                <button
                  type="button"
                  onClick={() => void handleNewChat()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  New chat
                </button>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-1.5">
                  {loadingChats ? (
                    <p className="p-2 text-sm text-slate-500">Loading…</p>
                  ) : chats.length === 0 ? (
                    <p className="p-2 text-sm text-slate-500">No chats yet.</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {chats.map((c) => (
                        <li key={c.id}>
                          {renamingId === c.id ? (
                            <form
                              className="flex gap-1 p-1"
                              onSubmit={async (e) => {
                                e.preventDefault();
                                const headers = await authHeaders();
                                if (!headers) return;
                                await fetch(
                                  `/api/coach/profit-coach-ai/chats/${c.id}`,
                                  {
                                    method: "PATCH",
                                    headers,
                                    body: JSON.stringify({ title: renameValue }),
                                  }
                                );
                                setRenamingId(null);
                                void loadChats();
                              }}
                            >
                              <input
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
                              />
                              <button
                                type="submit"
                                className="shrink-0 rounded bg-sky-600 px-2 text-xs text-white"
                              >
                                OK
                              </button>
                            </form>
                          ) : (
                            <div className="group flex items-center gap-0.5 rounded-lg hover:bg-white">
                              <button
                                type="button"
                                onClick={() => void openChat(c.id)}
                                className={`min-w-0 flex-1 truncate px-2 py-2 text-left text-xs ${
                                  selectedChatId === c.id
                                    ? "font-semibold text-sky-800"
                                    : "text-slate-700"
                                }`}
                              >
                                <span className="block truncate">
                                  {c.title || "Untitled"}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-slate-500">
                                  {formatChatRelativeTime(c.updated_at)}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRenamingId(c.id);
                                  setRenameValue(c.title || "");
                                }}
                                className="shrink-0 p-1 text-slate-400 opacity-100 hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100"
                                aria-label="Rename"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteConfirmId(
                                    deleteConfirmId === c.id ? null : c.id
                                  )
                                }
                                className="shrink-0 p-1 text-slate-400 opacity-100 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"
                                aria-label="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          {deleteConfirmId === c.id ? (
                            <div className="mt-1 flex flex-wrap gap-2 px-1 pb-1">
                              <button
                                type="button"
                                className="text-[10px] font-medium text-rose-600 hover:underline"
                                onClick={async () => {
                                  const headers = await authHeaders();
                                  if (!headers) return;
                                  await fetch(
                                    `/api/coach/profit-coach-ai/chats/${c.id}`,
                                    {
                                      method: "DELETE",
                                      headers,
                                    }
                                  );
                                  setDeleteConfirmId(null);
                                  if (selectedChatId === c.id) {
                                    setSelectedChatId(null);
                                    setMessages([]);
                                  }
                                  void loadChats();
                                }}
                              >
                                Confirm delete
                              </button>
                              <button
                                type="button"
                                className="text-[10px] text-slate-500 hover:underline"
                                onClick={() => setDeleteConfirmId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {activeTab === "brain" ? (
        <div className="min-h-0 flex-1 overflow-y-auto py-5">
          <div className="mx-auto w-full max-w-2xl px-3 pb-8 sm:px-4">
            <h2 className="mb-1 text-lg font-semibold text-slate-900">
              My brain
            </h2>
            <p className="mb-5 text-sm text-slate-600">
              Your private knowledge base for this AI coach.
            </p>
            {brainSaveOk ? (
              <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Saved. This context will be included on your next message.
              </p>
            ) : null}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <ProfitCoachAiBrainForm
                key={brainFormKey}
                compassHref={compassHref}
                settingsHref={settingsHref}
                initialContext={aiContext}
                draftFromChat={brainDraftFromChat}
                saving={brainSaving}
                saveError={brainSaveError}
                onSave={(next) => {
                  void saveBrainPatch(next);
                }}
                variant="page"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
