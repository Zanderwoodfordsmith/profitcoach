"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Outfit } from "next/font/google";
import ReactMarkdown from "react-markdown";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabaseClient } from "@/lib/supabaseClient";
import { useImpersonation } from "@/contexts/ImpersonationContext";

type ChatListItem = {
  id: string;
  title: string | null;
  section_context: unknown;
  folder_id: string | null;
  is_favourite: boolean;
  favourite_sort_order: number | null;
  created_at: string;
  updated_at: string;
};

type FolderListItem = {
  id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const DROP_ID_UNCATEGORIZED = "uncategorized";
function dropIdFolder(folderId: string) {
  return `folder-${folderId}`;
}
function parseFolderDropId(overId: string): string | null {
  if (overId === DROP_ID_UNCATEGORIZED) return null;
  if (overId.startsWith("folder-")) return overId.slice(7);
  return null;
}

function GripVerticalIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-slate-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function DroppableZone({
  id,
  children,
  className = "",
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={isOver ? `rounded-lg ring-1 ring-sky-300 ring-inset ${className}` : className}>
      {children}
    </div>
  );
}

function ChatRowDraggable({
  chat,
  children,
}: {
  chat: ChatListItem;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: chat.id,
    data: { type: "chat" as const, chatId: chat.id, folderId: chat.folder_id },
  });
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-1 ${isDragging ? "opacity-0" : ""}`}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab rounded p-0.5 text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
        aria-label="Drag to move"
        {...listeners}
        {...attributes}
      >
        <GripVerticalIcon />
      </button>
      {children}
    </div>
  );
}

function FavouriteSortableRow({
  chat,
  children,
}: {
  chat: ChatListItem;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chat.id,
  });
  const style = transform
    ? { transform: CSS.Transform.toString(transform), transition }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 ${isDragging ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab rounded p-0.5 text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...listeners}
        {...attributes}
      >
        <GripVerticalIcon />
      </button>
      {children}
    </div>
  );
}

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

/** Section context when opening from Insights "Get coaching" - must match API / coachAi.SectionContext */
type PendingSectionContext = {
  tab: "levels" | "pillars" | "areas";
  levelIdx?: number;
  pillarIdx?: number;
  areaIdx?: number;
  insightTitle: string;
  insightBody: string;
  priorityPlaybooks?: { ref: string; name: string; status: number }[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

function formatChatTitle(chat: ChatListItem): string {
  if (chat.title) return chat.title;
  const d = new Date(chat.updated_at);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const COACH_SECTION_STORAGE_KEY = "coachSectionContext";

const THINKING_PHRASES: { main: string; sub: string }[] = [
  {
    main: "Enriching content.",
    sub: "Excellent insight—pressing your context, running it through proven systems and engineering advice that transforms businesses, not just sounds good.",
  },
  {
    main: "Patience pays compound interest.",
    sub: "Your tailored strategy is loading.",
  },
  {
    main: "Synthesising information. Real value requires real analysis.",
    sub: "Surface level is for amateurs. Preparing pro insights.",
  },
  {
    main: "Dissecting your situation, leveraging hard-won experience.",
    sub: "Preparing guidance that actually produces ROI.",
  },
];

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName(fullName: string | null): string {
  if (!fullName || !fullName.trim()) return "there";
  const parts = fullName.trim().split(/\s+/);
  return parts[0];
}

export default function ClientAICoachPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { impersonatingContactId } = useImpersonation();
  const [contactName, setContactName] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSectionContext, setPendingSectionContext] = useState<PendingSectionContext | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [thinkingPhraseIndex, setThinkingPhraseIndex] = useState(0);
  const [chatIdToDelete, setChatIdToDelete] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderListItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["uncategorized"]));
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [folderIdToDelete, setFolderIdToDelete] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [moveChatMenuChatId, setMoveChatMenuChatId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"all" | "favourites">("all");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLanding = selectedChatId === null && messages.length === 0;

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const active = event.active;
    const over = event.over;
    setActiveDragId(null);
    if (sidebarTab === "all" && over && active.data.current) {
      const chatId = String(active.id);
      const currentFolderId =
        (active.data.current as { folderId?: string | null }).folderId ?? null;
      const targetFolderId = parseFolderDropId(String(over.id));
      if ((currentFolderId ?? null) !== (targetFolderId ?? null)) {
        moveChatToFolder(chatId, targetFolderId);
      }
      return;
    }
    if (sidebarTab === "favourites" && over && over.id !== active.id) {
      const favouritedChats = chats
        .filter((c) => c.is_favourite)
        .sort((a, b) => (a.favourite_sort_order ?? 0) - (b.favourite_sort_order ?? 0));
      const oldIndex = favouritedChats.findIndex((c) => c.id === active.id);
      const newIndex = favouritedChats.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(favouritedChats, oldIndex, newIndex);
      setChats((prev) =>
        prev.map((c) => {
          const i = newOrder.findIndex((x) => x.id === c.id);
          if (i === -1) return c;
          return { ...c, favourite_sort_order: i };
        })
      );
      reorderFavourites(newOrder);
    }
  }

  function handleDragCancel() {
    setActiveDragId(null);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (searchParams.get("from") !== "insight") return;
    try {
      const raw = sessionStorage.getItem(COACH_SECTION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PendingSectionContext;
        if (parsed && typeof parsed.insightTitle === "string" && typeof parsed.insightBody === "string") {
          setPendingSectionContext(parsed);
        }
        sessionStorage.removeItem(COACH_SECTION_STORAGE_KEY);
      }
      router.replace("/client/ai-coach", { scroll: false });
    } catch {
      // ignore
    }
  }, [searchParams, router]);

  useEffect(() => {
    let cancelled = false;
    async function loadContact() {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) return;
      const headers: Record<string, string> = { Authorization: `Bearer ${session.access_token}` };
      if (impersonatingContactId) headers["x-impersonate-contact-id"] = impersonatingContactId;
      const res = await fetch("/api/client/me", { headers });
      if (cancelled || !res.ok) return;
      const data = (await res.json()) as { contact?: { full_name?: string | null } };
      setContactName(data.contact?.full_name ?? null);
    }
    void loadContact();
    return () => { cancelled = true; };
  }, [impersonatingContactId]);

  const fetchChats = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingContactId) {
      headers["x-impersonate-contact-id"] = impersonatingContactId;
    }
    const res = await fetch("/api/client/coach-chats", { headers });
    if (!res.ok) return;
    const data = (await res.json()) as { chats?: ChatListItem[] };
    const list = (data.chats ?? []).map((c) => ({
      ...c,
      is_favourite: c.is_favourite ?? false,
      favourite_sort_order: c.favourite_sort_order ?? null,
    }));
    setChats(list);
  }, [impersonatingContactId]);

  const fetchFolders = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingContactId) {
      headers["x-impersonate-contact-id"] = impersonatingContactId;
    }
    const res = await fetch("/api/client/coach-chat-folders", { headers });
    if (!res.ok) return;
    const data = (await res.json()) as { folders?: FolderListItem[] };
    setFolders(data.folders ?? []);
  }, [impersonatingContactId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingChats(true);
      setLoadingFolders(true);
      await Promise.all([fetchChats(), fetchFolders()]);
      if (!cancelled) {
        setLoadingChats(false);
        setLoadingFolders(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchChats, fetchFolders]);

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingMessages(true);
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) {
        setLoadingMessages(false);
        return;
      }
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (impersonatingContactId) {
        headers["x-impersonate-contact-id"] = impersonatingContactId;
      }
      const res = await fetch(`/api/client/coach-chats/${selectedChatId}`, { headers });
      if (cancelled) return;
      if (!res.ok) {
        setMessages([]);
        setLoadingMessages(false);
        return;
      }
      const data = (await res.json()) as { messages?: ChatMessage[] };
      setMessages(data.messages ?? []);
      setLoadingMessages(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedChatId, impersonatingContactId]);

  useEffect(() => {
    if (!sending) return;
    const interval = setInterval(() => {
      setThinkingPhraseIndex((i) => (i + 1) % THINKING_PHRASES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [sending]);

  async function saveChatTitle(chatId: string, newTitle: string) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingContactId) headers["x-impersonate-contact-id"] = impersonatingContactId;
    const res = await fetch(`/api/client/coach-chats/${chatId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ title: newTitle.trim() || null }),
    });
    if (!res.ok) return;
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title: newTitle.trim() || null } : c))
    );
    setEditingChatId(null);
    setEditingTitle("");
  }

  async function deleteChat(chatId: string) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingContactId) headers["x-impersonate-contact-id"] = impersonatingContactId;
    setDeletingChatId(chatId);
    setChatIdToDelete(null);
    const res = await fetch(`/api/client/coach-chats/${chatId}`, { method: "DELETE", headers });
    setDeletingChatId(null);
    if (!res.ok) return;
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (selectedChatId === chatId) {
      setSelectedChatId(null);
      setMessages([]);
    }
  }

  async function createFolder(parentId: string | null) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingContactId) headers["x-impersonate-contact-id"] = impersonatingContactId;
    setCreatingFolder(true);
    const res = await fetch("/api/client/coach-chat-folders", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "New folder", parent_id: parentId }),
    });
    setCreatingFolder(false);
    if (!res.ok) return;
    const data = (await res.json()) as FolderListItem;
    setFolders((prev) => [...prev, data]);
    setEditingFolderId(data.id);
    setEditingFolderName("New folder");
    if (parentId) setExpandedSections((prev) => new Set(prev).add(parentId));
  }

  async function saveFolderName(folderId: string, newName: string) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingContactId) headers["x-impersonate-contact-id"] = impersonatingContactId;
    const res = await fetch(`/api/client/coach-chat-folders/${folderId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: newName.trim() || "New folder" }),
    });
    if (!res.ok) return;
    const name = newName.trim() || "New folder";
    setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, name } : f)));
    setEditingFolderId(null);
    setEditingFolderName("");
  }

  async function deleteFolder(folderId: string) {
    const folder = folders.find((f) => f.id === folderId);
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingContactId) headers["x-impersonate-contact-id"] = impersonatingContactId;
    const res = await fetch(`/api/client/coach-chat-folders/${folderId}`, { method: "DELETE", headers });
    setFolderIdToDelete(null);
    if (!res.ok) return;
    const newFolderId = folder?.parent_id ?? null;
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setChats((prev) =>
      prev.map((c) => (c.folder_id === folderId ? { ...c, folder_id: newFolderId } : c))
    );
  }

  async function moveChatToFolder(chatId: string, folderId: string | null) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingContactId) headers["x-impersonate-contact-id"] = impersonatingContactId;
    const res = await fetch(`/api/client/coach-chats/${chatId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ folder_id: folderId }),
    });
    setMoveChatMenuChatId(null);
    if (!res.ok) return;
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, folder_id: folderId } : c))
    );
  }

  async function reorderFavourites(orderedChats: ChatListItem[]) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingContactId) headers["x-impersonate-contact-id"] = impersonatingContactId;
    await Promise.all(
      orderedChats.map((c, index) =>
        fetch(`/api/client/coach-chats/${c.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ favourite_sort_order: index }),
        })
      )
    );
  }

  async function toggleFavourite(chatId: string) {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) return;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingContactId) headers["x-impersonate-contact-id"] = impersonatingContactId;
    const nextFav = !chat.is_favourite;
    const res = await fetch(`/api/client/coach-chats/${chatId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ is_favourite: nextFav }),
    });
    if (!res.ok) return;
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              is_favourite: nextFav,
              favourite_sort_order: nextFav ? (c.favourite_sort_order ?? 0) : null,
            }
          : c
      )
    );
  }

  const topFolders = folders.filter((f) => !f.parent_id);
  const getSubfolders = (parentId: string) => folders.filter((f) => f.parent_id === parentId);
  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session?.access_token) {
      router.replace("/login");
      return;
    }

    setSending(true);
    setError(null);
    setInput("");
    setThinkingPhraseIndex(0);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
    if (impersonatingContactId) {
      headers["x-impersonate-contact-id"] = impersonatingContactId;
    }

    const body: { chatId?: string; message: string; sectionContext?: PendingSectionContext } = {
      chatId: selectedChatId ?? undefined,
      message: text,
    };
    if (pendingSectionContext) {
      body.sectionContext = pendingSectionContext;
    }

    const res = await fetch("/api/client/coach-chat", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as {
      chatId?: string;
      userMessage?: { role: string; content: string };
      assistantMessage?: { role: string; content: string };
      error?: string;
    };

    setSending(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      setInput(text);
      return;
    }

    if (pendingSectionContext) {
      setPendingSectionContext(null);
    }

    if (data.chatId && !selectedChatId) {
      setChats((prev) => {
        const next = [
          {
            id: data.chatId!,
            title: null,
            section_context: null,
            folder_id: null,
            is_favourite: false,
            favourite_sort_order: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          ...prev,
        ];
        return next;
      });
      setSelectedChatId(data.chatId);
    }

    setMessages((prev) => [
      ...prev,
      { id: "", role: "user" as const, content: data.userMessage!.content, created_at: "" },
      {
        id: "",
        role: "assistant" as const,
        content: data.assistantMessage!.content,
        created_at: "",
      },
    ]);
  }

  const firstName = getFirstName(contactName);
  const timeGreeting = getTimeGreeting();

  return (
    <div
      className={`relative flex min-h-[calc(100vh-6rem)] w-full flex-col ${outfit.variable}`}
      style={{ fontFamily: "var(--font-outfit), sans-serif" }}
    >
      {isLanding ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-sky-50/40 to-slate-100/90 px-6"
          style={{ backgroundImage: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(14,165,233,0.08), transparent)" }}
        >
          {/* Floating collapsible menu - top left */}
          <div className="absolute left-6 top-6 z-10">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`flex items-center gap-2.5 rounded-xl border border-white/60 bg-white/80 px-4 py-2.5 shadow-lg shadow-slate-200/60 backdrop-blur-xl transition hover:bg-white/90 ${
                sidebarOpen ? "rounded-br-none rounded-bl-xl" : ""
              }`}
              aria-expanded={sidebarOpen}
              aria-label={sidebarOpen ? "Close chats and folders" : "Open chats and folders"}
            >
              <svg className="h-5 w-5 shrink-0 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-[15px] font-medium text-slate-700">Folders & Chats</span>
              <svg
                className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${sidebarOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Main content: text outside box + single large input */}
          <div className="flex w-full max-w-4xl flex-col items-center gap-8">
            <div className="text-center">
              <p className="text-[17px] text-slate-600">{timeGreeting}, {firstName}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                How can I help you with?
              </h1>
              {pendingSectionContext && (
                <p className="mt-3 text-[15px] text-slate-500">
                  Coaching about: <strong className="text-slate-700">{pendingSectionContext.insightTitle}</strong>
                </p>
              )}
            </div>

            <form
              className="w-full"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <div className="flex gap-3 rounded-2xl border border-white/70 bg-white/80 p-3 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask me anything…"
                  rows={5}
                  className="min-h-[140px] min-w-0 flex-1 resize-none rounded-xl border-0 bg-transparent px-5 py-4 text-[16px] text-slate-900 placeholder-slate-400 outline-none focus:ring-0"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="shrink-0 self-end rounded-xl bg-sky-600 px-5 py-3 text-[15px] font-semibold text-white shadow-md shadow-sky-500/25 transition hover:bg-sky-700 disabled:opacity-50 disabled:hover:bg-sky-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </form>
            {error && <p className="text-center text-sm text-rose-600">{error}</p>}
          </div>
        </div>
      ) : null}

      {isLanding && sidebarOpen && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-20 bg-black/20 backdrop-blur-[2px]"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed left-[calc(16rem+1.5rem)] top-16 z-30 flex max-h-[calc(100vh-5rem)] w-72 flex-col overflow-hidden rounded-2xl rounded-tl-none border border-white/60 bg-white/95 p-3.5 shadow-2xl shadow-slate-300/50 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => {
                setSelectedChatId(null);
                setMessages([]);
                setSidebarOpen(false);
              }}
              className="mb-2 w-full rounded-xl bg-slate-800 px-3 py-2.5 text-[15px] font-medium text-white hover:bg-slate-700 transition-colors"
            >
              New chat
            </button>
            <button
              type="button"
              onClick={() => createFolder(null)}
              disabled={creatingFolder}
              className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-[15px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              New folder
            </button>
            <div className="mb-2 flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setSidebarTab("all")}
                className={`flex-1 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  sidebarTab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("favourites")}
                className={`flex-1 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  sidebarTab === "favourites" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Favourites
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto space-y-0.5 pr-1">
              {loadingChats || loadingFolders ? (
                <p className="text-[15px] text-slate-500">Loading…</p>
              ) : sidebarTab === "all" ? (
                <>
                  <button
                    type="button"
                    onClick={() => toggleSection("uncategorized")}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[14px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <svg className={`h-4 w-4 shrink-0 transition-transform ${expandedSections.has("uncategorized") ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    Uncategorized
                  </button>
                  {expandedSections.has("uncategorized") && (
                    <ul className="ml-4 space-y-0.5 border-l border-slate-100 pl-2">
                      {chats.filter((c) => !c.folder_id).length === 0 ? (
                        <li className="text-[13px] text-slate-400 py-1">No chats</li>
                      ) : (
                        chats.filter((c) => !c.folder_id)
                          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                          .map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => { setSelectedChatId(c.id); setSidebarOpen(false); }}
                                className="w-full rounded-lg px-2 py-1.5 text-left text-[14px] text-slate-700 hover:bg-slate-100"
                              >
                                {formatChatTitle(c)}
                              </button>
                            </li>
                          ))
                      )}
                    </ul>
                  )}
                  {topFolders.map((folder) => {
                    const subfolders = getSubfolders(folder.id);
                    const directChats = chats.filter((c) => c.folder_id === folder.id);
                    const expanded = expandedSections.has(folder.id);
                    return (
                      <div key={folder.id} className="mt-0.5">
                        <button
                          type="button"
                          onClick={() => toggleSection(folder.id)}
                          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[14px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <svg className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          {folder.name}
                        </button>
                        {expanded && (
                          <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-100 pl-2">
                            {directChats
                              .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                              .map((c) => (
                                <li key={c.id}>
                                  <button
                                    type="button"
                                    onClick={() => { setSelectedChatId(c.id); setSidebarOpen(false); }}
                                    className="w-full rounded-lg px-2 py-1.5 text-left text-[14px] text-slate-700 hover:bg-slate-100"
                                  >
                                    {formatChatTitle(c)}
                                  </button>
                                </li>
                              ))}
                            {subfolders.map((sub) => {
                              const subChats = chats.filter((c) => c.folder_id === sub.id);
                              const subExpanded = expandedSections.has(sub.id);
                              return (
                                <div key={sub.id} className="mt-0.5">
                                  <button type="button" onClick={() => toggleSection(sub.id)} className="flex w-full items-center gap-1 rounded-lg px-1.5 py-1 text-left text-[13px] font-medium text-slate-600 hover:bg-slate-50">
                                    <svg className={`h-3.5 w-3.5 shrink-0 transition-transform ${subExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                    {sub.name}
                                  </button>
                                  {subExpanded && subChats.length > 0 && (
                                    <ul className="ml-3 space-y-0.5 pl-1.5">
                                      {subChats.map((c) => (
                                        <li key={c.id}>
                                          <button type="button" onClick={() => { setSelectedChatId(c.id); setSidebarOpen(false); }} className="w-full rounded px-1.5 py-1 text-left text-[13px] text-slate-600 hover:bg-slate-50">
                                            {formatChatTitle(c)}
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </>
              ) : (
                (() => {
                  const favouritedChats = chats.filter((c) => c.is_favourite).sort((a, b) => (a.favourite_sort_order ?? 0) - (b.favourite_sort_order ?? 0));
                  if (favouritedChats.length === 0) {
                    return <p className="py-3 text-center text-[14px] text-slate-500">No favourites. Star chats from the All tab.</p>;
                  }
                  return (
                    <ul className="space-y-0.5">
                      {favouritedChats.map((c) => (
                        <li key={c.id}>
                          <button type="button" onClick={() => { setSelectedChatId(c.id); setSidebarOpen(false); }} className="w-full rounded-lg px-2 py-1.5 text-left text-[14px] text-slate-700 hover:bg-slate-100">
                            {formatChatTitle(c)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  );
                })()
              )}
            </div>
          </div>
        </>
      )}

      {!isLanding && (
      <div className="flex min-h-[calc(100vh-6rem)] w-full gap-5 p-5">
        <aside className="w-64 shrink-0 overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-lg backdrop-blur-xl flex flex-col">
          <button
            type="button"
            onClick={() => {
              setSelectedChatId(null);
              setMessages([]);
            }}
            className="mb-2 w-full rounded-xl bg-slate-800 px-3 py-2.5 text-[15px] font-medium text-white hover:bg-slate-700 transition-colors"
          >
            New chat
          </button>
          <button
            type="button"
            onClick={() => createFolder(null)}
            disabled={creatingFolder}
            className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-[15px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            New folder
          </button>
          {loadingChats || loadingFolders ? (
            <p className="text-[15px] text-slate-500">Loading…</p>
          ) : chats.length === 0 && folders.length === 0 ? (
            <p className="text-[15px] text-slate-500">No conversations yet.</p>
          ) : (
            <>
              <DndContext
                sensors={dndSensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
              <div className="mb-2 flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setSidebarTab("all")}
                  className={`flex-1 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                    sidebarTab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab("favourites")}
                  className={`flex-1 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                    sidebarTab === "favourites" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Favourites
                </button>
              </div>
              <div className="min-h-0 overflow-y-auto space-y-1">
                {sidebarTab === "all" && (
                  <>
              {/* Uncategorized */}
              <DroppableZone id={DROP_ID_UNCATEGORIZED}>
              <section className="rounded-lg">
                <button
                  type="button"
                  onClick={() => toggleSection("uncategorized")}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[14px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  <svg
                    className={`h-4 w-4 shrink-0 transition-transform ${expandedSections.has("uncategorized") ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  Uncategorized
                </button>
                {expandedSections.has("uncategorized") && (
                  <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-100 pl-2">
                    {chats.filter((c) => !c.folder_id).length === 0 ? (
                      <li className="text-[13px] text-slate-400 py-1">No chats</li>
                    ) : (
                      chats
                        .filter((c) => !c.folder_id)
                        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                        .map((c) => (
                          <li key={c.id} className="group relative flex items-center gap-1 rounded-lg">
                            <ChatRowDraggable chat={c}>
                            {editingChatId === c.id ? (
                              <div className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-sky-300 bg-white px-2 py-1.5">
                                <input
                                  type="text"
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      saveChatTitle(c.id, editingTitle);
                                    }
                                    if (e.key === "Escape") {
                                      setEditingChatId(null);
                                      setEditingTitle("");
                                    }
                                  }}
                                  onBlur={() => saveChatTitle(c.id, editingTitle)}
                                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                                  placeholder="Chat name"
                                  autoFocus
                                />
                                <button type="button" onClick={() => saveChatTitle(c.id, editingTitle)} className="shrink-0 rounded p-0.5 text-sky-600 hover:bg-sky-100" aria-label="Save">
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setSelectedChatId(c.id)}
                                  className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-[14px] ${
                                    selectedChatId === c.id ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  {formatChatTitle(c)}
                                </button>
                                <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); toggleFavourite(c.id); }}
                                    className={`rounded p-1 hover:bg-slate-100 ${c.is_favourite ? "text-amber-500" : "text-slate-400 hover:text-amber-500"}`}
                                    aria-label={c.is_favourite ? "Unfavourite" : "Favourite"}
                                  >
                                    {c.is_favourite ? (
                                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                    ) : (
                                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMoveChatMenuChatId(moveChatMenuChatId === c.id ? null : c.id);
                                    }}
                                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                    aria-label="Move to"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingChatId(c.id);
                                      setEditingTitle(c.title ?? formatChatTitle(c));
                                    }}
                                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                    aria-label="Edit name"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setChatIdToDelete(c.id);
                                    }}
                                    disabled={deletingChatId === c.id}
                                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-50"
                                    aria-label="Delete"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                                {moveChatMenuChatId === c.id && (
                                  <div className="absolute left-0 top-full z-20 mt-0.5 min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                                    <button
                                      type="button"
                                      onClick={() => moveChatToFolder(c.id, null)}
                                      className="block w-full px-3 py-1.5 text-left text-[14px] text-slate-700 hover:bg-slate-50"
                                    >
                                      Uncategorized
                                    </button>
                                    {topFolders.map((f) => (
                                      <div key={f.id}>
                                        <button
                                          type="button"
                                          onClick={() => moveChatToFolder(c.id, f.id)}
                                          className="block w-full px-3 py-1.5 text-left text-[14px] text-slate-700 hover:bg-slate-50"
                                        >
                                          {f.name}
                                        </button>
                                        {getSubfolders(f.id).map((sub) => (
                                          <button
                                            key={sub.id}
                                            type="button"
                                            onClick={() => moveChatToFolder(c.id, sub.id)}
                                            className="block w-full pl-6 pr-3 py-1.5 text-left text-[14px] text-slate-700 hover:bg-slate-50"
                                          >
                                            {sub.name}
                                          </button>
                                        ))}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                            </ChatRowDraggable>
                          </li>
                        ))
                    )}
                  </ul>
                )}
              </section>
              </DroppableZone>
              {/* Folders */}
              {topFolders.map((folder) => {
                const subfolders = getSubfolders(folder.id);
                const directChats = chats.filter((c) => c.folder_id === folder.id);
                const expanded = expandedSections.has(folder.id);
                return (
                  <section key={folder.id} className="rounded-lg">
                    <DroppableZone id={dropIdFolder(folder.id)}>
                    <div className="flex items-center gap-0.5 rounded-lg group/folder">
                      <button
                        type="button"
                        onClick={() => toggleSection(folder.id)}
                        className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-50"
                      >
                        <svg
                          className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      {editingFolderId === folder.id ? (
                        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-sky-300 bg-white px-2 py-1">
                          <input
                            type="text"
                            value={editingFolderName}
                            onChange={(e) => setEditingFolderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveFolderName(folder.id, editingFolderName);
                              }
                              if (e.key === "Escape") {
                                setEditingFolderId(null);
                                setEditingFolderName("");
                              }
                            }}
                            onBlur={() => saveFolderName(folder.id, editingFolderName)}
                            className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                            autoFocus
                          />
                          <button type="button" onClick={() => saveFolderName(folder.id, editingFolderName)} className="shrink-0 rounded p-0.5 text-sky-600 hover:bg-sky-100" aria-label="Save">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleSection(folder.id)}
                            className="min-w-0 flex-1 rounded-lg px-1.5 py-1.5 text-left text-[14px] font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {folder.name}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFolderId(folder.id);
                              setEditingFolderName(folder.name);
                            }}
                            className="shrink-0 rounded p-1 text-slate-400 opacity-0 hover:bg-slate-100 hover:text-slate-600 group-hover/folder:opacity-100"
                            aria-label="Rename folder"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolderIdToDelete(folder.id);
                            }}
                            className="shrink-0 rounded p-1 text-slate-400 opacity-0 hover:bg-slate-100 hover:text-rose-600 group-hover/folder:opacity-100"
                            aria-label="Delete folder"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                    </DroppableZone>
                    {expanded && (
                      <div className="ml-4 mt-0.5 border-l border-slate-100 pl-2 space-y-1">
                        <button
                          type="button"
                          onClick={() => createFolder(folder.id)}
                          disabled={creatingFolder}
                          className="text-[13px] text-slate-500 hover:text-slate-700"
                        >
                          + Subfolder
                        </button>
                        {directChats
                          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                          .map((c) => (
                            <div key={c.id} className="group relative flex items-center gap-1 rounded-lg">
                              <ChatRowDraggable chat={c}>
                              {editingChatId === c.id ? (
                                <div className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-sky-300 bg-white px-2 py-1.5">
                                  <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") { e.preventDefault(); saveChatTitle(c.id, editingTitle); }
                                      if (e.key === "Escape") { setEditingChatId(null); setEditingTitle(""); }
                                    }}
                                    onBlur={() => saveChatTitle(c.id, editingTitle)}
                                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                                    placeholder="Chat name"
                                    autoFocus
                                  />
                                  <button type="button" onClick={() => saveChatTitle(c.id, editingTitle)} className="shrink-0 rounded p-0.5 text-sky-600 hover:bg-sky-100" aria-label="Save">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                  </button>
                                </div>
                              ) : (
                                <>
                              <button
                                type="button"
                                onClick={() => setSelectedChatId(c.id)}
                                className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-[14px] ${
                                  selectedChatId === c.id ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {formatChatTitle(c)}
                              </button>
                              <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
                                <button type="button" onClick={(e) => { e.stopPropagation(); toggleFavourite(c.id); }} className={`rounded p-1 hover:bg-slate-100 ${c.is_favourite ? "text-amber-500" : "text-slate-400 hover:text-amber-500"}`} aria-label={c.is_favourite ? "Unfavourite" : "Favourite"}>
                                  {c.is_favourite ? <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg> : <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
                                </button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setMoveChatMenuChatId(moveChatMenuChatId === c.id ? null : c.id); }} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Move to">
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                  </svg>
                                </button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setEditingChatId(c.id); setEditingTitle(c.title ?? formatChatTitle(c)); }} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Edit">
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setChatIdToDelete(c.id); }} disabled={deletingChatId === c.id} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-50" aria-label="Delete">
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                              {moveChatMenuChatId === c.id && (
                                <div className="absolute left-0 top-full z-20 mt-0.5 min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                                  <button type="button" onClick={() => moveChatToFolder(c.id, null)} className="block w-full px-3 py-1.5 text-left text-[14px] text-slate-700 hover:bg-slate-50">Uncategorized</button>
                                  {topFolders.map((f) => (
                                    <div key={f.id}>
                                      <button type="button" onClick={() => moveChatToFolder(c.id, f.id)} className="block w-full px-3 py-1.5 text-left text-[14px] text-slate-700 hover:bg-slate-50">{f.name}</button>
                                      {getSubfolders(f.id).map((sub) => (
                                        <button key={sub.id} type="button" onClick={() => moveChatToFolder(c.id, sub.id)} className="block w-full pl-6 pr-3 py-1.5 text-left text-[14px] text-slate-700 hover:bg-slate-50">{sub.name}</button>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              )}
                              </>
                              )}
                              </ChatRowDraggable>
                            </div>
                          ))}
                        {subfolders.map((sub) => {
                          const subChats = chats.filter((c) => c.folder_id === sub.id);
                          const subExpanded = expandedSections.has(sub.id);
                          return (
                            <div key={sub.id} className="mt-1">
                              <DroppableZone id={dropIdFolder(sub.id)}>
                              <div className="flex items-center gap-0.5 group/sub">
                                <button type="button" onClick={() => toggleSection(sub.id)} className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-50">
                                  <svg className={`h-3.5 w-3.5 transition-transform ${subExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                                {editingFolderId === sub.id ? (
                                  <div className="flex min-w-0 flex-1 items-center gap-1 rounded border border-sky-300 bg-white px-1.5 py-0.5">
                                    <input
                                      type="text"
                                      value={editingFolderName}
                                      onChange={(e) => setEditingFolderName(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveFolderName(sub.id, editingFolderName); } if (e.key === "Escape") { setEditingFolderId(null); setEditingFolderName(""); } }}
                                      onBlur={() => saveFolderName(sub.id, editingFolderName)}
                                      className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                                      autoFocus
                                    />
                                    <button type="button" onClick={() => saveFolderName(sub.id, editingFolderName)} className="shrink-0 rounded p-0.5 text-sky-600 hover:bg-sky-100" aria-label="Save">
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button type="button" onClick={() => toggleSection(sub.id)} className="min-w-0 flex-1 rounded px-1.5 py-1 text-left text-[13px] text-slate-600 hover:bg-slate-50">
                                      {sub.name}
                                    </button>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditingFolderId(sub.id); setEditingFolderName(sub.name); }} className="shrink-0 rounded p-0.5 text-slate-400 opacity-0 hover:bg-slate-100 group-hover/sub:opacity-100" aria-label="Rename">
                                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setFolderIdToDelete(sub.id); }} className="shrink-0 rounded p-0.5 text-slate-400 opacity-0 hover:bg-slate-100 hover:text-rose-600 group-hover/sub:opacity-100" aria-label="Delete folder">
                                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </>
                                )}
                              </div>
                              </DroppableZone>
                              {subExpanded && (
                                <ul className="ml-4 mt-0.5 border-l border-slate-100 pl-1.5 space-y-0.5">
                                  {subChats.length === 0 ? (
                                    <li className="text-[12px] text-slate-400 py-0.5">No chats</li>
                                  ) : (
                                    subChats
                                      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                                      .map((c) => (
                                        <li key={c.id} className="group relative flex items-center gap-1 rounded">
                                          <ChatRowDraggable chat={c}>
                                          {editingChatId === c.id ? (
                                            <div className="flex min-w-0 flex-1 items-center gap-1 rounded border border-sky-300 bg-white px-1.5 py-0.5">
                                              <input
                                                type="text"
                                                value={editingTitle}
                                                onChange={(e) => setEditingTitle(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveChatTitle(c.id, editingTitle); } if (e.key === "Escape") { setEditingChatId(null); setEditingTitle(""); } }}
                                                onBlur={() => saveChatTitle(c.id, editingTitle)}
                                                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                                                autoFocus
                                              />
                                              <button type="button" onClick={() => saveChatTitle(c.id, editingTitle)} className="shrink-0 rounded p-0.5 text-sky-600 hover:bg-sky-100" aria-label="Save">
                                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                              </button>
                                            </div>
                                          ) : (
                                            <>
                                          <button type="button" onClick={() => setSelectedChatId(c.id)} className={`min-w-0 flex-1 rounded px-1.5 py-1 text-left text-[13px] ${selectedChatId === c.id ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}>
                                            {formatChatTitle(c)}
                                          </button>
                                          <button type="button" onClick={(e) => { e.stopPropagation(); toggleFavourite(c.id); }} className={`rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-slate-100 ${c.is_favourite ? "text-amber-500" : "text-slate-400 hover:text-amber-500"}`} aria-label={c.is_favourite ? "Unfavourite" : "Favourite"}>
                                            {c.is_favourite ? <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg> : <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
                                          </button>
                                          <button type="button" onClick={(e) => { e.stopPropagation(); setMoveChatMenuChatId(moveChatMenuChatId === c.id ? null : c.id); }} className="rounded p-0.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100" aria-label="Move to">
                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                          </button>
                                          <button type="button" onClick={(e) => { e.stopPropagation(); setEditingChatId(c.id); setEditingTitle(c.title ?? formatChatTitle(c)); }} className="rounded p-0.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100" aria-label="Edit">
                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                          </button>
                                          <button type="button" onClick={(e) => { e.stopPropagation(); setChatIdToDelete(c.id); }} disabled={deletingChatId === c.id} className="rounded p-0.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-50" aria-label="Delete">
                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                          </button>
                                          {moveChatMenuChatId === c.id && (
                                            <div className="absolute left-0 top-full z-20 mt-0.5 min-w-[120px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                                              <button type="button" onClick={() => moveChatToFolder(c.id, null)} className="block w-full px-3 py-1 text-left text-[13px] text-slate-700 hover:bg-slate-50">Uncategorized</button>
                                              {topFolders.map((f) => (
                                                <div key={f.id}>
                                                  <button type="button" onClick={() => moveChatToFolder(c.id, f.id)} className="block w-full px-3 py-1 text-left text-[13px] text-slate-700 hover:bg-slate-50">{f.name}</button>
                                                  {getSubfolders(f.id).map((s) => (
                                                    <button key={s.id} type="button" onClick={() => moveChatToFolder(c.id, s.id)} className="block w-full pl-5 pr-3 py-1 text-left text-[13px] text-slate-700 hover:bg-slate-50">{s.name}</button>
                                                  ))}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                            </>
                                          )}
                                          </ChatRowDraggable>
                                        </li>
                                      ))
                                  )}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
                  </>
                )}
                {sidebarTab === "favourites" && (
                  <section className="rounded-lg">
                    {(() => {
                      const favouritedChats = chats
                        .filter((c) => c.is_favourite)
                        .sort((a, b) => (a.favourite_sort_order ?? 0) - (b.favourite_sort_order ?? 0));
                      if (favouritedChats.length === 0) {
                        return (
                          <p className="py-3 text-center text-[14px] text-slate-500">
                            No favourites.
                            <span className="mt-1 block text-[13px]">Star chats from the All tab.</span>
                          </p>
                        );
                      }
                      return (
                        <SortableContext items={favouritedChats.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                        <ul className="space-y-0.5">
                          {favouritedChats.map((c) => (
                            <li key={c.id} className="group relative flex items-center gap-1 rounded-lg">
                              <FavouriteSortableRow chat={c}>
                              {editingChatId === c.id ? (
                                <div className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-sky-300 bg-white px-2 py-1.5">
                                  <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        saveChatTitle(c.id, editingTitle);
                                      }
                                      if (e.key === "Escape") {
                                        setEditingChatId(null);
                                        setEditingTitle("");
                                      }
                                    }}
                                    onBlur={() => saveChatTitle(c.id, editingTitle)}
                                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                                    placeholder="Chat name"
                                    autoFocus
                                  />
                                  <button type="button" onClick={() => saveChatTitle(c.id, editingTitle)} className="shrink-0 rounded p-0.5 text-sky-600 hover:bg-sky-100" aria-label="Save">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); toggleFavourite(c.id); }}
                                    className="shrink-0 rounded p-1 text-amber-500 hover:bg-amber-50"
                                    aria-label="Unfavourite"
                                  >
                                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedChatId(c.id)}
                                    className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-[14px] ${
                                      selectedChatId === c.id ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50"
                                    }`}
                                  >
                                    {formatChatTitle(c)}
                                  </button>
                                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setMoveChatMenuChatId(moveChatMenuChatId === c.id ? null : c.id); }} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Move to">
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                    </button>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditingChatId(c.id); setEditingTitle(c.title ?? formatChatTitle(c)); }} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Edit name">
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setChatIdToDelete(c.id); }} disabled={deletingChatId === c.id} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-50" aria-label="Delete">
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </div>
                                  {moveChatMenuChatId === c.id && (
                                    <div className="absolute left-0 top-full z-20 mt-0.5 min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                                      <button type="button" onClick={() => moveChatToFolder(c.id, null)} className="block w-full px-3 py-1.5 text-left text-[14px] text-slate-700 hover:bg-slate-50">Uncategorized</button>
                                      {topFolders.map((f) => (
                                        <div key={f.id}>
                                          <button type="button" onClick={() => moveChatToFolder(c.id, f.id)} className="block w-full px-3 py-1.5 text-left text-[14px] text-slate-700 hover:bg-slate-50">{f.name}</button>
                                          {getSubfolders(f.id).map((sub) => (
                                            <button key={sub.id} type="button" onClick={() => moveChatToFolder(c.id, sub.id)} className="block w-full pl-6 pr-3 py-1.5 text-left text-[14px] text-slate-700 hover:bg-slate-50">{sub.name}</button>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                              </FavouriteSortableRow>
                            </li>
                          ))}
                        </ul>
                        </SortableContext>
                      );
                    })()}
                  </section>
                )}
              </div>
              <DragOverlay>
                {activeDragId ? (() => {
                  const chat = chats.find((c) => c.id === activeDragId);
                  if (!chat) return null;
                  return (
                    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-lg">
                      <GripVerticalIcon />
                      <span className="text-[14px] text-slate-700">{formatChatTitle(chat)}</span>
                    </div>
                  );
                })() : null}
              </DragOverlay>
              </DndContext>
          </>
          )}
        </aside>

        {chatIdToDelete && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setChatIdToDelete(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-chat-title"
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="delete-chat-title" className="text-lg font-semibold text-slate-900">
                Delete conversation?
              </h2>
              <p className="mt-2 text-[15px] text-slate-600">
                This can&apos;t be undone.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setChatIdToDelete(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-[15px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => chatIdToDelete && deleteChat(chatIdToDelete)}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-[15px] font-medium text-white hover:bg-rose-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {folderIdToDelete && (() => {
          const folder = folders.find((f) => f.id === folderIdToDelete);
          const parentName = folder?.parent_id ? folders.find((f) => f.id === folder?.parent_id)?.name : null;
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={() => setFolderIdToDelete(null)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-folder-title"
            >
              <div
                className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="delete-folder-title" className="text-lg font-semibold text-slate-900">
                  Remove folder{folder ? ` "${folder.name}"` : ""}?
                </h2>
                <p className="mt-2 text-[15px] text-slate-600">
                  Chats inside will move to {parentName ? `"${parentName}"` : "Uncategorized"}.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setFolderIdToDelete(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-[15px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => folderIdToDelete && deleteFolder(folderIdToDelete)}
                    className="rounded-xl bg-rose-600 px-4 py-2 text-[15px] font-medium text-white hover:bg-rose-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        <div
          className={`min-w-0 flex-1 flex flex-col rounded-2xl border border-white/60 bg-white/80 shadow-lg backdrop-blur-xl ${outfit.variable}`}
          style={{ fontFamily: "var(--font-outfit), sans-serif" }}
        >
          {(selectedChatId !== null || messages.length > 0) && (
            <>
              <header className="shrink-0 border-b border-slate-200/60 px-6 py-4">
                <p className="text-[15px] font-medium text-slate-700">
                  <span className="bg-gradient-to-r from-sky-600 to-sky-500 bg-clip-text font-semibold text-transparent">
                    {timeGreeting}, {firstName}.
                  </span>{" "}
                  Continue the conversation below.
                </p>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-8">
                {loadingMessages ? (
                  <p className="text-base text-slate-500">Loading…</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id || m.content.slice(0, 20)}
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {m.role === "user" ? (
                        <div className="max-w-[80%] text-right">
                          <p className="text-[15px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                            {m.content}
                          </p>
                          <div className="mt-1.5 h-px w-full max-w-[120px] ml-auto bg-slate-200/80" />
                        </div>
                      ) : (
                        <div className="max-w-[85%] border-l-2 border-sky-300/70 pl-4 pr-1">
                          <div className="markdown-reply text-[15px] leading-[1.65] text-slate-800">
                            <ReactMarkdown
                              components={{
                                h1: ({ children }) => (
                                  <h1 className="mb-2 mt-4 text-lg font-bold text-slate-900 first:mt-0">{children}</h1>
                                ),
                                h2: ({ children }) => (
                                  <h2 className="mb-1.5 mt-4 text-base font-bold text-slate-900 first:mt-0">{children}</h2>
                                ),
                                h3: ({ children }) => (
                                  <h3 className="mb-1 mt-3 text-[15px] font-semibold text-slate-900 first:mt-0">{children}</h3>
                                ),
                                p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                                ul: ({ children }) => (
                                  <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
                                ),
                                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                strong: ({ children }) => (
                                  <strong className="font-semibold text-slate-900">{children}</strong>
                                ),
                                em: ({ children }) => <em className="italic">{children}</em>,
                              }}
                            >
                              {m.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
                {sending && (
                  <div className="flex justify-start">
                    <div className="flex max-w-[85%] flex-col gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50/60 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-5 w-5 shrink-0 rounded-full border-2 border-sky-300/80 border-t-sky-500 animate-spin"
                          aria-hidden
                        />
                        <p className="text-[15px] font-medium text-slate-700">
                          {THINKING_PHRASES[thinkingPhraseIndex].main}
                        </p>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-500">
                        {THINKING_PHRASES[thinkingPhraseIndex].sub}
                      </p>
                      <div className="h-0.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full animate-pulse rounded-full bg-sky-400/70"
                          style={{ width: "40%" }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <p className="px-6 text-sm text-rose-600">{error}</p>
              )}

              <form
                className="border-t border-slate-100 p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <div className="flex gap-3">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type your message…"
                    rows={2}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-[15px] text-slate-900 placeholder-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    className="shrink-0 self-end rounded-xl bg-slate-800 px-5 py-3 text-[15px] font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    Send
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
