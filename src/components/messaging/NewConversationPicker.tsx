"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Plus, Search, UserPlus, X } from "lucide-react";

export type ConversationRecipient = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  photo_url?: string | null;
  conversation_id?: string | null;
};

type StartedConversation = {
  id: string;
  [key: string]: unknown;
};

type Props = {
  getHeaders: () => Promise<Record<string, string> | null>;
  onStarted: (conversation: StartedConversation) => void;
};

type Mode = "search" | "create";

type CreateDraft = {
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
};

function emptyDraft(): CreateDraft {
  return { fullName: "", email: "", phone: "", linkedinUrl: "" };
}

function draftFromQuery(query: string): CreateDraft {
  const trimmed = query.trim();
  if (!trimmed) return emptyDraft();
  if (trimmed.includes("@") && !trimmed.includes(" ")) {
    return { ...emptyDraft(), email: trimmed.toLowerCase() };
  }
  if (/linkedin\.com/i.test(trimmed)) {
    return { ...emptyDraft(), linkedinUrl: trimmed };
  }
  return { ...emptyDraft(), fullName: trimmed };
}

export function NewConversationPicker({ getHeaders, onStarted }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<CreateDraft>(emptyDraft);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<ConversationRecipient[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });

  function resetPanel() {
    setMode("search");
    setQuery("");
    setDraft(emptyDraft());
    setError(null);
    setCreating(false);
    setStartingId(null);
  }

  function openCreate(seedQuery = "") {
    setMode("create");
    setDraft(draftFromQuery(seedQuery));
    setError(null);
    window.setTimeout(() => nameRef.current?.focus(), 20);
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (mode === "create") {
          setMode("search");
          setError(null);
          return;
        }
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [mode, open]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPanelPos({ top: rect.bottom + 4, left: rect.left });
    };
    place();
    const id = window.setTimeout(() => {
      if (mode === "create") nameRef.current?.focus();
      else inputRef.current?.focus();
    }, 20);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [mode, open]);

  useEffect(() => {
    if (!open || mode !== "search") return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = await getHeaders();
        if (!headers) {
          if (!cancelled) setError("Sign in again, then retry.");
          return;
        }
        const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
        const res = await fetch(`/api/messaging/recipients${qs}`, { headers });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          recipients?: ConversationRecipient[];
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error || "Could not search people.");
          setRecipients([]);
          return;
        }
        setRecipients(Array.isArray(body.recipients) ? body.recipients : []);
      } catch {
        if (!cancelled) setError("Could not search people.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query.trim() ? 200 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [getHeaders, mode, open, query]);

  async function startWithContactId(contactId: string) {
    const headers = await getHeaders();
    if (!headers) {
      setError("Sign in again, then retry.");
      return false;
    }
    const res = await fetch("/api/messaging/conversations", {
      method: "POST",
      headers,
      body: JSON.stringify({ contact_id: contactId }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      conversation?: StartedConversation;
    };
    if (!res.ok || !body.conversation?.id) {
      setError(body.error || "Could not start that conversation.");
      return false;
    }
    onStarted(body.conversation);
    setOpen(false);
    resetPanel();
    return true;
  }

  async function startWith(recipient: ConversationRecipient) {
    setStartingId(recipient.id);
    setError(null);
    try {
      await startWithContactId(recipient.id);
    } catch {
      setError("Could not start that conversation.");
    } finally {
      setStartingId(null);
    }
  }

  async function createAndMessage(event: FormEvent) {
    event.preventDefault();
    const fullName = draft.fullName.trim();
    if (!fullName) {
      setError("Add a name to create this person.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const headers = await getHeaders();
      if (!headers) {
        setError("Sign in again, then retry.");
        return;
      }
      const createRes = await fetch("/api/coach/contacts", {
        method: "POST",
        headers,
        body: JSON.stringify({
          fullName,
          email: draft.email.trim() || undefined,
          phone: draft.phone.trim() || undefined,
          linkedinUrl: draft.linkedinUrl.trim() || undefined,
          type: "prospect",
        }),
      });
      const createBody = (await createRes.json().catch(() => ({}))) as {
        error?: string;
        contactId?: string;
      };
      if (!createRes.ok || !createBody.contactId) {
        setError(createBody.error || "Could not create that person.");
        return;
      }
      await startWithContactId(createBody.contactId);
    } catch {
      setError("Could not create that person.");
    } finally {
      setCreating(false);
    }
  }

  const trimmedQuery = query.trim();
  const showCreateFromSearch =
    mode === "search" &&
    !loading &&
    !error &&
    recipients.length === 0 &&
    Boolean(trimmedQuery);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="Start a conversation"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((v) => {
            if (v) resetPanel();
            return !v;
          });
          setError(null);
        }}
        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={mode === "create" ? "Add person and message" : "Start a conversation"}
          style={{ top: panelPos.top, left: panelPos.left }}
          className="fixed z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10"
        >
          {mode === "search" ? (
            <>
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <Search
                  className="h-3.5 w-3.5 shrink-0 text-slate-400"
                  strokeWidth={1.75}
                />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search people"
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  aria-label="Search people"
                />
                <button
                  type="button"
                  aria-label="Add a new person"
                  title="Add a new person"
                  onClick={() => openCreate(query)}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-50 hover:text-sky-700"
                >
                  <UserPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => {
                    setOpen(false);
                    resetPanel();
                  }}
                  className="rounded p-0.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {error ? (
                  <p className="px-3 py-3 text-sm text-rose-600">{error}</p>
                ) : null}
                {loading && recipients.length === 0 ? (
                  <p className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Searching…
                  </p>
                ) : null}
                {!loading && recipients.length === 0 && !error && !trimmedQuery ? (
                  <button
                    type="button"
                    onClick={() => openCreate()}
                    className="flex w-full items-center gap-2.5 px-3 py-3 text-left hover:bg-slate-50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                      <UserPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">
                        Add a new person
                      </span>
                      <span className="block text-[12px] text-slate-500">
                        Create a contact, then open a message
                      </span>
                    </span>
                  </button>
                ) : null}
                {showCreateFromSearch ? (
                  <button
                    type="button"
                    onClick={() => openCreate(trimmedQuery)}
                    className="flex w-full items-center gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                      <UserPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        Create “{trimmedQuery}”
                      </span>
                      <span className="block text-[12px] text-slate-500">
                        Add as a contact and start messaging
                      </span>
                    </span>
                  </button>
                ) : null}
                {recipients.map((person) => {
                  const name =
                    person.full_name?.trim() || person.email || "Unnamed";
                  const detail = [
                    person.business_name,
                    person.email || person.phone,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const busy = startingId === person.id;
                  return (
                    <button
                      key={person.id}
                      type="button"
                      disabled={Boolean(startingId)}
                      onClick={() => void startWith(person)}
                      className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-60"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                        {person.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={person.photo_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          name.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {name}
                        </span>
                        {detail ? (
                          <span className="block truncate text-[12px] text-slate-500">
                            {detail}
                          </span>
                        ) : null}
                      </span>
                      {busy ? (
                        <Loader2
                          className="mt-1.5 h-3.5 w-3.5 shrink-0 animate-spin text-slate-400"
                          aria-hidden
                        />
                      ) : person.conversation_id ? (
                        <span className="mt-1.5 shrink-0 text-[11px] font-medium text-slate-400">
                          Open
                        </span>
                      ) : (
                        <span className="mt-1.5 shrink-0 text-[11px] font-medium text-sky-700">
                          New
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <form onSubmit={(e) => void createAndMessage(e)} className="p-3">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Add person & message
                  </p>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    Creates a prospect, then opens the composer
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Back to search"
                  onClick={() => {
                    setMode("search");
                    setError(null);
                  }}
                  className="rounded p-0.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
              <div className="space-y-2.5">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-slate-600">
                    Name
                  </span>
                  <input
                    ref={nameRef}
                    required
                    value={draft.fullName}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, fullName: e.target.value }))
                    }
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    placeholder="Full name"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-slate-600">
                    Email
                  </span>
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, email: e.target.value }))
                    }
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    placeholder="Optional"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-slate-600">
                    Phone
                  </span>
                  <input
                    type="tel"
                    value={draft.phone}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, phone: e.target.value }))
                    }
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    placeholder="Optional · WhatsApp / SMS"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-slate-600">
                    LinkedIn URL
                  </span>
                  <input
                    type="url"
                    value={draft.linkedinUrl}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, linkedinUrl: e.target.value }))
                    }
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    placeholder="Optional · for LinkedIn DMs"
                  />
                </label>
              </div>
              {error ? (
                <p className="mt-2.5 text-sm text-rose-600">{error}</p>
              ) : null}
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("search");
                    setError(null);
                  }}
                  className="rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={creating || !draft.fullName.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-wait disabled:opacity-60"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Creating…
                    </>
                  ) : (
                    "Create & message"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
