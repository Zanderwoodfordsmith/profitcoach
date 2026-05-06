"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Bold, Heading1, Heading2, Heading3, List } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import { MENTION_MARKDOWN_REGEX } from "@/lib/communityMentions";
import { profileInitialsFromName } from "@/lib/communityProfile";

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
  showFormattingToolbar?: boolean;
};

type KnownMention = {
  id: string;
  label: string;
};

function normalizeMentionLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractKnownMentionsFromRaw(raw: string): KnownMention[] {
  const out: KnownMention[] = [];
  const re = new RegExp(MENTION_MARKDOWN_REGEX.source, "gi");
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const label = normalizeMentionLabel(m[1] ?? "");
    const id = (m[2] ?? "").trim();
    if (!label || !id) continue;
    const key = `${id}::${label.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id, label });
  }
  return out;
}

function rawToDisplayText(raw: string): string {
  return raw.replace(new RegExp(MENTION_MARKDOWN_REGEX.source, "gi"), (_m, label) => {
    const clean = normalizeMentionLabel(String(label ?? ""));
    return clean ? `@${clean}` : "@member";
  });
}

function displayToRawText(display: string, knownMentions: KnownMention[]): string {
  if (knownMentions.length === 0) return display;
  let out = display;
  const sorted = [...knownMentions].sort((a, b) => b.label.length - a.label.length);
  for (const mention of sorted) {
    const needle = `@${mention.label}`;
    const replacement = `[@${mention.label}](mention:${mention.id})`;
    out = out.replace(new RegExp(escapeRegExp(needle), "g"), replacement);
  }
  return out;
}

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
  showFormattingToolbar = false,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [displayValue, setDisplayValue] = useState(() => rawToDisplayText(value));
  const [knownMentions, setKnownMentions] = useState<KnownMention[]>(() =>
    extractKnownMentionsFromRaw(value)
  );
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const fetchSeq = useRef(0);

  useEffect(() => {
    setDisplayValue(rawToDisplayText(value));
    setKnownMentions(extractKnownMentionsFromRaw(value));
  }, [value]);

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
    const q = getActiveMentionQuery(displayValue, el.selectionStart ?? 0);
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
  }, [displayValue]);

  const insertMention = useCallback(
    (user: MentionUser) => {
      const el = taRef.current;
      if (!el) return;
      const sel = el.selectionStart ?? 0;
      const ctx = getActiveMentionQuery(displayValue, sel);
      if (!ctx) return;

      const safeName = user.display_name
        .replace(/\]/g, "")
        .replace(/\[/g, "")
        .replace(/\(/g, "")
        .replace(/\)/g, "")
        .trim();
      const mentionText = `@${safeName || "member"}`;
      const nextDisplay =
        displayValue.slice(0, ctx.start) + mentionText + " " + displayValue.slice(sel);
      const nextKnown = [...knownMentions, { id: user.id, label: safeName || "member" }];
      setKnownMentions(nextKnown);
      setDisplayValue(nextDisplay);
      onChange(displayToRawText(nextDisplay, nextKnown));
      setMentionOpen(false);

      requestAnimationFrame(() => {
        const pos = ctx.start + mentionText.length + 1;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [displayValue, knownMentions, onChange]
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
      const nextDisplay = e.target.value;
      setDisplayValue(nextDisplay);
      onChange(displayToRawText(nextDisplay, knownMentions));
      const ctx = getActiveMentionQuery(
        nextDisplay,
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
    [knownMentions, onChange]
  );

  const applyWrappedSelection = useCallback(
    (before: string, after: string) => {
      const el = taRef.current;
      if (!el) return;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? start;
      const selected = displayValue.slice(start, end);
      const nextDisplay =
        displayValue.slice(0, start) + before + selected + after + displayValue.slice(end);
      setDisplayValue(nextDisplay);
      onChange(displayToRawText(nextDisplay, knownMentions));
      setMentionOpen(false);

      requestAnimationFrame(() => {
        el.focus();
        if (selected.length > 0) {
          el.setSelectionRange(start + before.length, start + before.length + selected.length);
        } else {
          const caret = start + before.length;
          el.setSelectionRange(caret, caret);
        }
      });
    },
    [displayValue, knownMentions, onChange]
  );

  const applyLinePrefix = useCallback(
    (prefix: string) => {
      const el = taRef.current;
      if (!el) return;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? start;
      const lineStart = displayValue.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const lineEndIdx = displayValue.indexOf("\n", end);
      const lineEnd = lineEndIdx === -1 ? displayValue.length : lineEndIdx;
      const block = displayValue.slice(lineStart, lineEnd);
      const prefixedBlock = block
        .split("\n")
        .map((line) => `${prefix}${line}`)
        .join("\n");
      const nextDisplay =
        displayValue.slice(0, lineStart) + prefixedBlock + displayValue.slice(lineEnd);
      setDisplayValue(nextDisplay);
      onChange(displayToRawText(nextDisplay, knownMentions));
      setMentionOpen(false);

      requestAnimationFrame(() => {
        const delta = prefixedBlock.length - block.length;
        el.focus();
        const prefixCountBeforeStart = block
          .slice(0, Math.max(0, start - lineStart))
          .split("\n").length;
        const beforeStartDelta = prefix.length * prefixCountBeforeStart;
        el.setSelectionRange(start + beforeStartDelta, end + delta);
      });
    },
    [displayValue, knownMentions, onChange]
  );

  const showList = mentionOpen;

  return (
    <div className="relative">
      {showFormattingToolbar ? (
        <div className="border-b border-slate-200 transition focus-within:border-sky-500">
          <textarea
            ref={taRef}
            value={displayValue}
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
          <div className="mb-1.5 mt-1.5 flex flex-wrap items-center gap-1.5 px-0.5">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50"
              onClick={() => applyWrappedSelection("**", "**")}
              aria-label="Bold"
              title="Bold"
            >
              <Bold className="h-4.5 w-4.5" strokeWidth={2.4} />
            </button>
            <button
              type="button"
              className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border border-slate-200 px-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => applyLinePrefix("# ")}
              aria-label="Heading 1"
              title="Heading 1"
            >
              <Heading1 className="h-4.5 w-4.5" strokeWidth={2.2} />
              <span className="text-sm leading-none">1</span>
            </button>
            <button
              type="button"
              className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border border-slate-200 px-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => applyLinePrefix("## ")}
              aria-label="Heading 2"
              title="Heading 2"
            >
              <Heading2 className="h-4 w-4" strokeWidth={2.1} />
              <span className="text-xs leading-none">2</span>
            </button>
            <button
              type="button"
              className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border border-slate-200 px-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => applyLinePrefix("### ")}
              aria-label="Heading 3"
              title="Heading 3"
            >
              <Heading3 className="h-3.5 w-3.5" strokeWidth={2.1} />
              <span className="text-[11px] leading-none">3</span>
            </button>
            <button
              type="button"
              className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => applyLinePrefix("- ")}
              aria-label="Bullet list"
              title="Bullet list"
            >
              <List className="h-4 w-4" strokeWidth={2.1} />
            </button>
          </div>
        </div>
      ) : (
        <textarea
          ref={taRef}
          value={displayValue}
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
      )}
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
                      {profileInitialsFromName(u.display_name)}
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
