"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Bold, Heading1, Heading2, Heading3, Link2, List } from "lucide-react";
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
  minAutoHeightPx?: number;
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

/** Invisible wrappers around link labels in the editor (zero-width non-joiner). */
const LINK_ZWNJ = "\u200c";

type LinkPair = { label: string; url: string };

const NON_MENTION_LINK_MD_RE = /\[([^\]]+)\]\((?!mention:)([^)]+)\)/gi;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractLinkPairsInOrder(raw: string): LinkPair[] {
  const out: LinkPair[] = [];
  const re = new RegExp(NON_MENTION_LINK_MD_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out.push({ label: m[1] ?? "", url: m[2] ?? "" });
  }
  return out;
}

function rawToDisplayFromRaw(raw: string): string {
  let s = raw.replace(new RegExp(MENTION_MARKDOWN_REGEX.source, "gi"), (_m, label) => {
    const clean = normalizeMentionLabel(String(label ?? ""));
    return clean ? `@${clean}` : "@member";
  });
  s = s.replace(new RegExp(NON_MENTION_LINK_MD_RE.source, "gi"), (_full, label: string) => {
    return `${LINK_ZWNJ}${label}${LINK_ZWNJ}`;
  });
  return s;
}

function extractZwnjLinkLabelsInOrder(display: string): string[] {
  const labels: string[] = [];
  let i = 0;
  while (i < display.length) {
    if (display.startsWith(LINK_ZWNJ, i)) {
      const close = display.indexOf(LINK_ZWNJ, i + LINK_ZWNJ.length);
      if (close === -1) break;
      labels.push(display.slice(i + LINK_ZWNJ.length, close));
      i = close + LINK_ZWNJ.length;
    } else {
      const nextZ = display.indexOf(LINK_ZWNJ, i);
      if (nextZ === -1) break;
      i = nextZ;
    }
  }
  return labels;
}

function countCompleteZwnjLinksBefore(display: string, pos: number): number {
  let count = 0;
  let i = 0;
  while (i < display.length && i < pos) {
    if (display.startsWith(LINK_ZWNJ, i)) {
      const close = display.indexOf(LINK_ZWNJ, i + LINK_ZWNJ.length);
      if (close === -1) break;
      const end = close + LINK_ZWNJ.length;
      if (end <= pos) count++;
      i = end;
    } else {
      const nextZ = display.indexOf(LINK_ZWNJ, i);
      if (nextZ === -1 || nextZ >= pos) break;
      i = nextZ;
    }
  }
  return count;
}

function resolveUrlsForLabels(labels: string[], pool: LinkPair[]): string[] {
  const q = [...pool];
  return labels.map((lab) => {
    const idx = q.findIndex((p) => p.label === lab);
    if (idx === -1) return "";
    const [{ url }] = q.splice(idx, 1);
    return url;
  });
}

function assembleRawFromDisplay(
  display: string,
  mentions: KnownMention[],
  urlsInOrder: string[]
): string {
  const parts: string[] = [];
  let i = 0;
  let u = 0;
  while (i < display.length) {
    if (display.startsWith(LINK_ZWNJ, i)) {
      const close = display.indexOf(LINK_ZWNJ, i + LINK_ZWNJ.length);
      if (close === -1) {
        parts.push(display.slice(i));
        break;
      }
      const label = display.slice(i + LINK_ZWNJ.length, close);
      const url = urlsInOrder[u++] ?? "";
      if (url) {
        parts.push(`[${escapeMarkdownLinkLabel(label)}](${url})`);
      } else {
        parts.push(label);
      }
      i = close + LINK_ZWNJ.length;
    } else {
      const nextZ = display.indexOf(LINK_ZWNJ, i);
      const end = nextZ === -1 ? display.length : nextZ;
      parts.push(display.slice(i, end));
      i = end;
    }
  }
  return displayToRawText(parts.join(""), mentions);
}

function displayToMirrorHtml(display: string, ph?: string): string {
  if (!display && ph) {
    return `<span class="text-slate-400">${escapeHtml(ph)}</span>`;
  }
  let out = "";
  let idx = 0;
  while (idx < display.length) {
    if (display.startsWith(LINK_ZWNJ, idx)) {
      const close = display.indexOf(LINK_ZWNJ, idx + LINK_ZWNJ.length);
      if (close === -1) {
        out += escapeHtml(display.slice(idx));
        break;
      }
      const label = display.slice(idx + LINK_ZWNJ.length, close);
      out += `<span class="font-medium !text-blue-600 underline underline-offset-2 decoration-blue-600/40">${escapeHtml(label)}</span>`;
      idx = close + LINK_ZWNJ.length;
    } else {
      const nextZ = display.indexOf(LINK_ZWNJ, idx);
      const end = nextZ === -1 ? display.length : nextZ;
      out += escapeHtml(display.slice(idx, end));
      idx = end;
    }
  }
  return out;
}

function normalizeCommunityPostLinkUrl(input: string): string {
  const t = input.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^(mailto|tel):/i.test(t)) return t;
  return `https://${t}`;
}

/** Minimal escaping so `[label](url)` survives CommonMark parsing. */
function escapeMarkdownLinkLabel(label: string): string {
  return label
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

function linkLabelFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, "") || "Link";
  } catch {
    return "Link";
  }
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
  minAutoHeightPx = 0,
  showFormattingToolbar = false,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const mirrorInnerRef = useRef<HTMLDivElement>(null);
  const lastRawRef = useRef(value);
  const [displayValue, setDisplayValue] = useState(() => rawToDisplayFromRaw(value));
  const [knownMentions, setKnownMentions] = useState<KnownMention[]>(() =>
    extractKnownMentionsFromRaw(value)
  );
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const fetchSeq = useRef(0);

  useEffect(() => {
    // Ignore parent echoes of our own onChange while typing; rehydrating here
    // can reset caret/selection and feel like "cursor jumping".
    if (value === lastRawRef.current) return;
    setDisplayValue(rawToDisplayFromRaw(value));
    setKnownMentions(extractKnownMentionsFromRaw(value));
    lastRawRef.current = value;
  }, [value]);

  const commitFromDisplay = useCallback(
    (nextDisplay: string, nextMentions = knownMentions) => {
      const labels = extractZwnjLinkLabelsInOrder(nextDisplay);
      const pool = extractLinkPairsInOrder(lastRawRef.current);
      const urls = resolveUrlsForLabels(labels, pool);
      const nextRaw = assembleRawFromDisplay(nextDisplay, nextMentions, urls);
      lastRawRef.current = nextRaw;
      setKnownMentions(extractKnownMentionsFromRaw(nextRaw));
      setDisplayValue(nextDisplay);
      onChange(nextRaw);
    },
    [knownMentions, onChange]
  );

  const syncMirrorScroll = useCallback(() => {
    const ta = taRef.current;
    const inner = mirrorInnerRef.current;
    if (!ta || !inner) return;
    inner.style.minHeight = `${ta.scrollHeight}px`;
    inner.style.transform = `translateY(-${ta.scrollTop}px)`;
  }, []);

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
      commitFromDisplay(nextDisplay, nextKnown);
      setMentionOpen(false);

      requestAnimationFrame(() => {
        const pos = ctx.start + mentionText.length + 1;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [commitFromDisplay, displayValue, knownMentions]
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
    const clampedHeight =
      maxAutoHeightPx > 0 ? Math.min(el.scrollHeight, maxAutoHeightPx) : el.scrollHeight;
    const next = Math.max(minAutoHeightPx, clampedHeight);
    el.style.height = `${next}px`;
  }, [autoResize, maxAutoHeightPx, minAutoHeightPx, displayValue]);

  useLayoutEffect(() => {
    if (!showFormattingToolbar) return;
    syncMirrorScroll();
  }, [displayValue, showFormattingToolbar, syncMirrorScroll]);

  const onChangeInner = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextDisplay = e.target.value;
      commitFromDisplay(nextDisplay);
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
    [commitFromDisplay]
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
      commitFromDisplay(nextDisplay);
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
    [commitFromDisplay, displayValue]
  );

  const insertMarkdownLink = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    let selected = displayValue.slice(start, end);
    const hadSelection = selected.trim().length > 0;
    if (hadSelection) {
      selected = selected.replace(/\r\n/g, "\n").replace(/\n+/g, " ").trim();
    }
    const pairIdx = countCompleteZwnjLinksBefore(displayValue, start);
    const pool = extractLinkPairsInOrder(lastRawRef.current);

    let label: string;
    let normalized: string;
    if (!hadSelection) {
      const urlRaw = window.prompt("Link URL:", "https://");
      if (urlRaw === null) return;
      normalized = normalizeCommunityPostLinkUrl(urlRaw);
      if (!normalized) return;
      const defaultLabel = linkLabelFromUrl(normalized);
      const labelRaw = window.prompt("Text to show for this link:", defaultLabel);
      if (labelRaw === null) return;
      label = labelRaw.trim().length > 0 ? labelRaw.trim() : defaultLabel;
    } else {
      const urlRaw = window.prompt("Link URL:", "https://");
      if (urlRaw === null) return;
      normalized = normalizeCommunityPostLinkUrl(urlRaw);
      if (!normalized) return;
      label = selected;
    }

    pool.splice(pairIdx, 0, { label, url: normalized });
    const nextDisplay =
      displayValue.slice(0, start) +
      LINK_ZWNJ +
      label +
      LINK_ZWNJ +
      displayValue.slice(end);
    const labels = extractZwnjLinkLabelsInOrder(nextDisplay);
    const urls = resolveUrlsForLabels(labels, pool);
    const nextRaw = assembleRawFromDisplay(nextDisplay, knownMentions, urls);
    lastRawRef.current = nextRaw;
    setKnownMentions(extractKnownMentionsFromRaw(nextRaw));
    setDisplayValue(nextDisplay);
    onChange(nextRaw);
    setMentionOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + LINK_ZWNJ.length + label.length + LINK_ZWNJ.length;
      el.setSelectionRange(caret, caret);
    });
  }, [displayValue, knownMentions, onChange]);

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
      commitFromDisplay(nextDisplay);
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
    [commitFromDisplay, displayValue]
  );

  const onScrollMirror = useCallback(() => {
    syncMirrorScroll();
  }, [syncMirrorScroll]);

  const showList = mentionOpen;

  return (
    <div className="relative">
      {showFormattingToolbar ? (
        <div className="border-b border-slate-200 transition focus-within:border-sky-500">
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
            >
              <div
                ref={mirrorInnerRef}
                className={`${className}${autoResize ? " resize-none overflow-hidden" : ""} whitespace-pre-wrap break-words text-slate-900`}
                dangerouslySetInnerHTML={{
                  __html: displayToMirrorHtml(displayValue, placeholder),
                }}
              />
            </div>
            <textarea
              ref={taRef}
              value={displayValue}
              onChange={onChangeInner}
              onKeyDown={onKeyDown}
              onClick={onSelectOrClick}
              onSelect={onSelectOrClick}
              onKeyUp={onSelectOrClick}
              onScroll={onScrollMirror}
              placeholder={undefined}
              disabled={disabled}
              rows={autoResize ? 1 : rows}
              className={`${className}${autoResize ? " resize-none overflow-hidden" : ""} relative z-[1] text-transparent caret-slate-900`}
            />
          </div>
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
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50"
              onClick={() => insertMarkdownLink()}
              aria-label="Link"
              title="Link — select text, then add URL"
            >
              <Link2 className="h-4 w-4" strokeWidth={2.1} />
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
