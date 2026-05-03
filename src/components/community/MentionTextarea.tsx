"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export type MentionUser = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  handle: string | null;
  role: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  rows?: number;
  /** Grow height with content (single-line feel when empty). */
  autoResize?: boolean;
  maxAutoHeightPx?: number;
};

/** Parses @mention cursor: contiguous non-whitespace after last `@` before caret. */
export function getActiveMentionQuery(
  text: string,
  selectionStart: number
): { start: number; query: string } | null {
  const before = text.slice(0, selectionStart);
  const lastAt = before.lastIndexOf("@");
  if (lastAt === -1) return null;
  // Avoid treating `@` inside `[@Name](mention:…)` as a new mention query
  if (lastAt >= 1 && before[lastAt - 1] === "[") return null;
  const fragment = before.slice(lastAt + 1);
  if (/\s/.test(fragment)) return null;
  return { start: lastAt, query: fragment };
}

async function fetchMentionUsers(query: string): Promise<MentionUser[]> {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return [];

  const qs = new URLSearchParams();
  if (query.length > 0) qs.set("q", query);

  const res = await fetch(`/api/community/mention-users?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return [];
  const json = (await res.json()) as { users?: MentionUser[] };
  return json.users ?? [];
}

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  disabled,
  rows = 4,
  autoResize = false,
  maxAutoHeightPx = 280,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const fetchSeq = useRef(0);

  const safeHighlightIdx = useMemo(
    () =>
      mentionUsers.length === 0
        ? 0
        : Math.min(highlightIdx, mentionUsers.length - 1),
    [highlightIdx, mentionUsers]
  );

  const syncMentionFromDom = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    const q = getActiveMentionQuery(value, el.selectionStart ?? 0);
    if (!q) {
      setMentionOpen(false);
      return;
    }
    setMentionOpen(true);
    setHighlightIdx(0);
    const seq = ++fetchSeq.current;
    setMentionLoading(true);
    void fetchMentionUsers(q.query).then((users) => {
      if (fetchSeq.current !== seq) return;
      setMentionUsers(users);
      setMentionLoading(false);
    });
  }, [value]);

  const insertMention = useCallback(
    (user: MentionUser) => {
      const el = taRef.current;
      if (!el) return;
      const sel = el.selectionStart ?? 0;
      const ctx = getActiveMentionQuery(value, sel);
      if (!ctx) return;

      const safeName = user.display_name
        .replace(/\]/g, "")
        .replace(/\[/g, "")
        .replace(/\(/g, "")
        .replace(/\)/g, "")
        .trim();
      const mentionText = `[@${safeName || "member"}](mention:${user.id})`;
      const next =
        value.slice(0, ctx.start) + mentionText + " " + value.slice(sel);
      onChange(next);
      setMentionOpen(false);

      requestAnimationFrame(() => {
        const pos = ctx.start + mentionText.length + 1;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [onChange, value]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!mentionOpen || mentionUsers.length === 0) {
        if (e.key === "Escape") setMentionOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => (i + 1) % mentionUsers.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx(
          (i) => (i - 1 + mentionUsers.length) % mentionUsers.length
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        insertMention(mentionUsers[safeHighlightIdx]!);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setMentionOpen(false);
      }
    },
    [mentionOpen, mentionUsers, safeHighlightIdx, insertMention]
  );

  const onSelectOrClick = useCallback(() => {
    syncMentionFromDom();
  }, [syncMentionFromDom]);

  useLayoutEffect(() => {
    if (!autoResize) return;
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, maxAutoHeightPx);
    el.style.height = `${next}px`;
  }, [autoResize, maxAutoHeightPx, value]);

  const onChangeInner = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      const ctx = getActiveMentionQuery(
        e.target.value,
        e.target.selectionStart ?? 0
      );
      if (!ctx) {
        setMentionOpen(false);
        return;
      }
      setMentionOpen(true);
      setHighlightIdx(0);
      const seq = ++fetchSeq.current;
      setMentionLoading(true);
      void fetchMentionUsers(ctx.query).then((users) => {
        if (fetchSeq.current !== seq) return;
        setMentionUsers(users);
        setMentionLoading(false);
      });
    },
    [onChange]
  );

  const showList = mentionOpen;

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        value={value}
        onChange={onChangeInner}
        onKeyDown={onKeyDown}
        onClick={onSelectOrClick}
        onSelect={onSelectOrClick}
        onKeyUp={onSelectOrClick}
        placeholder={placeholder}
        disabled={disabled}
        rows={autoResize ? 1 : rows}
        className={`${className}${autoResize ? " resize-none overflow-hidden" : ""}`}
      />
      {showList ? (
        <ul
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {mentionLoading ? (
            <li className="px-3 py-2 text-sm text-slate-500">Loading…</li>
          ) : mentionUsers.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No matches</li>
          ) : (
            mentionUsers.map((u, idx) => (
              <li key={u.id} role="option" aria-selected={idx === safeHighlightIdx}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    idx === safeHighlightIdx ? "bg-amber-50" : "hover:bg-slate-50"
                  }`}
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    insertMention(u);
                  }}
                >
                  {u.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.avatar_url}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                      {u.display_name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900">
                      {u.display_name}
                    </span>
                    {u.handle ? (
                      <span className="block truncate text-xs text-slate-500">
                        @{u.handle}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
