"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { BookOpen, Bold, GraduationCap, Heading1, Heading2, Heading3, Link2, List, Users } from "lucide-react";
import { safeExternalHref } from "@/lib/communityAutolink";
import {
  LINK_MARKER,
  boldRanges,
  deleteBesideLinkMarker,
  linkIndexAt,
  linkSpans,
  reconcileLinkMarkers,
  toggleBoldAt,
} from "@/lib/commentInlineFormat";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  MENTION_TOKEN_REGEX,
  atPrefixForMentionType,
  buildMentionTarget,
} from "@/lib/communityMentions";
import { profileInitialsFromName } from "@/lib/communityProfile";
import {
  AcademyMentionPicker,
  type AcademyMentionPick,
} from "@/components/community/AcademyMentionPicker";
import { broadcastMentionsForQuery } from "@/lib/communityMentionUsers";

export type MentionUser = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  broadcast?: "everyone" | "coaches";
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
  /** Post author (or similar) surfaced first in the @-mention picker. */
  prioritizeUserId?: string;
  /**
   * Include @everyone / @Profit Coaches (notifies every community member).
   * Off for support notes so a ticket cannot ping the whole community.
   */
  allowBroadcastMentions?: boolean;
  /**
   * Comment-sized formatting without the post toolbar: bold and links show
   * formatted while typing, Cmd+B / Cmd+K work, and a link can be clicked to
   * edit it. Pair with `formatRef` + `CommentFormatButtons` for buttons.
   */
  inlineFormatting?: boolean;
  formatRef?: Ref<MentionTextareaHandle>;
};

/** Formatting commands for buttons that live outside the textarea. */
export type MentionTextareaHandle = {
  toggleBold: () => void;
  openLink: () => void;
};

/** Where the link form writes: an existing link, or a new one over [start, end). */
type LinkTarget = { index: number | null; start: number; end: number };

type ListPos = {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

const LIST_MAX_HEIGHT = 208;
const LIST_GAP = 4;
const LIST_VIEWPORT_MARGIN = 12;

type KnownMention = {
  /** Leading `@`(s) shown in the composer: "@", "@@" or "@@@". */
  prefix: string;
  label: string;
  /** `mention:` target string (uuid, `lesson:…`, or `course:…`). */
  target: string;
};

function normalizeMentionLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

function linkUrlsFromRaw(raw: string): string[] {
  return extractLinkPairsInOrder(raw).map((pair) => pair.url);
}

function rawToDisplayFromRaw(raw: string): string {
  let s = raw.replace(
    new RegExp(MENTION_TOKEN_REGEX.source, "gi"),
    (_m, prefix: string, label: string) => {
      const clean = normalizeMentionLabel(String(label ?? ""));
      return `${prefix}${clean || "member"}`;
    }
  );
  s = s.replace(new RegExp(NON_MENTION_LINK_MD_RE.source, "gi"), (_full, label: string) => {
    return `${LINK_MARKER}${label}${LINK_MARKER}`;
  });
  return s;
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
    if (display.startsWith(LINK_MARKER, i)) {
      const close = display.indexOf(LINK_MARKER, i + LINK_MARKER.length);
      if (close === -1) {
        parts.push(display.slice(i));
        break;
      }
      const label = display.slice(i + LINK_MARKER.length, close);
      const url = urlsInOrder[u++] ?? "";
      if (url) {
        parts.push(`[${escapeMarkdownLinkLabel(label)}](${url})`);
      } else {
        parts.push(label);
      }
      i = close + LINK_MARKER.length;
    } else {
      const nextZ = display.indexOf(LINK_MARKER, i);
      const end = nextZ === -1 ? display.length : nextZ;
      parts.push(display.slice(i, end));
      i = end;
    }
  }
  return displayToRawText(parts.join(""), mentions);
}

/** Link text in the overlay. No font weight, so it stays as wide as the textarea's text. */
const MIRROR_LINK_CLASS = "text-blue-600 underline decoration-blue-600/40 underline-offset-2";
const MIRROR_ACTIVE_LINK_CLASS = `${MIRROR_LINK_CLASS} rounded-sm bg-blue-50`;
/** Bold drawn with a stroke: a heavier weight is wider and would push the caret off the text. */
const MIRROR_BOLD_STYLE = "-webkit-text-stroke:0.035em currentColor";
const MIRROR_BOLD_STARS_CLASS = "text-slate-300";

/**
 * HTML for the overlay drawn under the transparent textarea: link labels in
 * blue (markers hidden), `**bold**` with faint stars. Every character stays
 * the same width as in the textarea so the caret lines up.
 */
function displayToMirrorHtml(
  display: string,
  opts: { placeholder?: string; placeholderClass: string; activeLink: number }
): string {
  if (!display) {
    return opts.placeholder
      ? `<span class="${opts.placeholderClass}">${escapeHtml(opts.placeholder)}</span>`
      : "";
  }
  const linkAt = new Int32Array(display.length).fill(-1);
  linkSpans(display).forEach((span, idx) => linkAt.fill(idx, span.open, span.close + 1));
  // 1 = bold text, 2 = the stars around it.
  const boldAt = new Uint8Array(display.length);
  for (const r of boldRanges(display)) {
    boldAt.fill(2, r.start, r.end);
    boldAt.fill(1, r.start + 2, r.end - 2);
  }

  let out = "";
  let i = 0;
  while (i < display.length) {
    let j = i + 1;
    while (j < display.length && linkAt[j] === linkAt[i] && boldAt[j] === boldAt[i]) j++;
    const text = escapeHtml(display.slice(i, j));
    const classes: string[] = [];
    if (linkAt[i] >= 0) {
      classes.push(linkAt[i] === opts.activeLink ? MIRROR_ACTIVE_LINK_CLASS : MIRROR_LINK_CLASS);
    }
    if (boldAt[i] === 2) classes.push(MIRROR_BOLD_STARS_CLASS);
    const style = boldAt[i] === 1 ? ` style="${MIRROR_BOLD_STYLE}"` : "";
    out +=
      classes.length > 0 || style
        ? `<span${classes.length > 0 ? ` class="${classes.join(" ")}"` : ""}${style}>${text}</span>`
        : text;
    i = j;
  }
  // A trailing newline opens a new line in the textarea but not in a div.
  if (display.endsWith("\n")) out += "\u200b";
  return out;
}

/**
 * Accepts `example.com/page` or a full URL. Returns "" when it is not a usable
 * link, so the form can disable its button. Spaces and brackets are encoded so
 * the stored `[label](url)` parses back cleanly.
 */
function normalizeCommunityPostLinkUrl(input: string): string {
  const t = input.trim();
  if (!t) return "";
  const candidate = /^(https?:\/\/|mailto:|tel:)/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(candidate);
    if ((u.protocol === "http:" || u.protocol === "https:") && !u.hostname.includes(".")) {
      return "";
    }
  } catch {
    return "";
  }
  return candidate.replace(/\s/g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");
}

/** Link labels can't hold brackets (they end the markdown label) or link markers. */
function cleanLinkLabel(label: string): string {
  return label
    .replaceAll(LINK_MARKER, "")
    .replace(/[[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** `https://www.example.com/page/` → `example.com/page` for the link bar. */
function prettyLinkUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
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
  const re = new RegExp(MENTION_TOKEN_REGEX.source, "gi");
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const prefix = (m[1] ?? "").trim();
    const label = normalizeMentionLabel(m[2] ?? "");
    const target = (m[3] ?? "").trim();
    if (!prefix || !label || !target) continue;
    const key = `${prefix}::${target}::${label.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ prefix, label, target });
  }
  return out;
}

function displayToRawText(display: string, knownMentions: KnownMention[]): string {
  if (knownMentions.length === 0) return display;
  let out = display;
  // Longest tokens first so `@@Lesson` is replaced before a `@Lesson` member
  // could match its inner substring.
  const sorted = [...knownMentions].sort(
    (a, b) => b.prefix.length + b.label.length - (a.prefix.length + a.label.length)
  );
  for (const mention of sorted) {
    const needle = `${mention.prefix}${mention.label}`;
    const replacement = `[${mention.prefix}${mention.label}](mention:${mention.target})`;
    // `(?<![@[])` keeps us from matching inside an already-built token or a
    // longer `@`-run (e.g. avoid `@Foo` matching within `@@Foo`).
    out = out.replace(
      new RegExp(`(?<![@\\[])${escapeRegExp(needle)}`, "g"),
      replacement
    );
  }
  return out;
}

/** Longest name a member @mention query can grow to, e.g. "Mary Ann van der Berg". */
const MENTION_QUERY_MAX_WORDS = 5;

/**
 * Parses a member @mention at the caret: the text after the last `@` on the
 * same line. Spaces are allowed so "Daniel M" can narrow to a surname; the
 * picker closes once a multi-word query has no one left (see `noMatchRef`).
 */
export function getActiveMentionQuery(
  text: string,
  selectionStart: number,
  knownMentions: KnownMention[] = []
): { start: number; query: string } | null {
  const before = text.slice(0, selectionStart);
  const lastAt = before.lastIndexOf("@");
  if (lastAt === -1) return null;
  // Avoid treating `@` inside `[@Name](mention:…)` as a new mention query.
  if (lastAt >= 1 && before[lastAt - 1] === "[") return null;
  // Typing on after a picked "@Daniel Mirrorist" is the sentence, not a search.
  const finished = knownMentions.some((mention) => {
    const tokenStart = lastAt + 1 - mention.prefix.length;
    const token = `${mention.prefix}${mention.label}`;
    const tokenEnd = tokenStart + token.length;
    return (
      tokenStart >= 0 &&
      text.startsWith(token, tokenStart) &&
      (selectionStart > tokenEnd || (selectionStart === tokenEnd && /\s/.test(mention.label)))
    );
  });
  if (finished) return null;
  const fragment = before.slice(lastAt + 1);
  if (/^\s|\n/.test(fragment)) return null;
  if (fragment.trim().split(/\s+/).length > MENTION_QUERY_MAX_WORDS) return null;
  return { start: lastAt, query: fragment };
}

const MENTION_CACHE_TTL_MS = 60_000;
const MENTION_SEARCH_DEBOUNCE_MS = 120;

const mentionUsersCache = new Map<
  string,
  { users: MentionUser[]; fetchedAt: number }
>();

let mentionAccessToken: string | null = null;
let mentionAccessTokenAt = 0;

function mentionCacheKey(query: string, prioritizeUserId?: string): string {
  return `${prioritizeUserId ?? ""}|${query}`;
}

function readMentionCache(
  query: string,
  prioritizeUserId?: string
): MentionUser[] | null {
  const hit = mentionUsersCache.get(mentionCacheKey(query, prioritizeUserId));
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > MENTION_CACHE_TTL_MS) {
    mentionUsersCache.delete(mentionCacheKey(query, prioritizeUserId));
    return null;
  }
  return hit.users;
}

function writeMentionCache(
  query: string,
  prioritizeUserId: string | undefined,
  users: MentionUser[]
): void {
  mentionUsersCache.set(mentionCacheKey(query, prioritizeUserId), {
    users,
    fetchedAt: Date.now(),
  });
}

async function getMentionAccessToken(): Promise<string | null> {
  if (
    mentionAccessToken &&
    Date.now() - mentionAccessTokenAt < MENTION_CACHE_TTL_MS
  ) {
    return mentionAccessToken;
  }
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData.session?.access_token ?? null;
  mentionAccessToken = token;
  mentionAccessTokenAt = Date.now();
  return token;
}

async function fetchMentionUsers(
  query: string,
  prioritizeUserId?: string
): Promise<MentionUser[]> {
  const cached = readMentionCache(query, prioritizeUserId);
  if (cached) return cached;

  const token = await getMentionAccessToken();
  if (!token) return [];

  const qs = new URLSearchParams();
  if (query.length > 0) qs.set("q", query);
  if (prioritizeUserId) qs.set("prioritize", prioritizeUserId);

  const res = await fetch(`/api/community/mention-users?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { users?: MentionUser[] };
  const users = json.users ?? [];
  writeMentionCache(query, prioritizeUserId, users);
  return users;
}

/** Warm the default @ picker (post author + admins) before the user types. */
export function prefetchMentionUsers(prioritizeUserId?: string): void {
  const key = mentionCacheKey("", prioritizeUserId);
  const hit = mentionUsersCache.get(key);
  if (hit && Date.now() - hit.fetchedAt < MENTION_CACHE_TTL_MS) return;
  void fetchMentionUsers("", prioritizeUserId);
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
  prioritizeUserId,
  allowBroadcastMentions = true,
  inlineFormatting = false,
  formatRef,
}: Props) {
  const richFormatting = showFormattingToolbar || inlineFormatting;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const mirrorInnerRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef({ start: 0, end: 0, selectedText: "" });
  const pendingSelectionRef = useRef<[number, number] | null>(null);
  const [displayValue, setDisplayValue] = useState(() => rawToDisplayFromRaw(value));
  const [knownMentions, setKnownMentions] = useState<KnownMention[]>(() =>
    extractKnownMentionsFromRaw(value)
  );
  /** One URL per link marker pair in `displayValue`, in order. */
  const [linkUrls, setLinkUrls] = useState<string[]>(() => linkUrlsFromRaw(value));
  const [linkTarget, setLinkTarget] = useState<LinkTarget | null>(null);
  /** Link holding the caret, for the link bar (-1 when none). */
  const [caretLink, setCaretLink] = useState(-1);
  const [linkUrlDraft, setLinkUrlDraft] = useState("");
  const [linkLabelDraft, setLinkLabelDraft] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const [listPos, setListPos] = useState<ListPos | null>(null);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"lesson" | "course">("lesson");
  const fetchSeq = useRef(0);
  const mentionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Multi-word @ query that matched no one; longer queries from it stay closed. */
  const noMatchRef = useRef<{ start: number; query: string } | null>(null);

  // The raw value this editor last emitted or loaded. A parent echo of our own
  // onChange matches it and is ignored (rehydrating would move the caret); any
  // other change, such as clearing after posting, reloads the editor.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDisplayValue(rawToDisplayFromRaw(value));
    setKnownMentions(extractKnownMentionsFromRaw(value));
    setLinkUrls(linkUrlsFromRaw(value));
    setLinkTarget(null);
    setCaretLink(-1);
  }

  useEffect(() => {
    return () => {
      if (mentionDebounceRef.current) clearTimeout(mentionDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    prefetchMentionUsers(prioritizeUserId);
  }, [prioritizeUserId]);

  // Writing a new value into the textarea puts the caret at the end; put it
  // back before paint.
  useLayoutEffect(() => {
    const sel = pendingSelectionRef.current;
    const el = taRef.current;
    if (!sel || !el) return;
    pendingSelectionRef.current = null;
    el.focus();
    el.setSelectionRange(sel[0], sel[1]);
  });

  /**
   * Stores a new display string. Without `urls` the change is treated as
   * typing, so a link that lost a marker is unlinked (reconcileLinkMarkers).
   * Returns the stored display and `caret` shifted to match it.
   */
  const commitFromDisplay = useCallback(
    (
      nextDisplay: string,
      opts: { mentions?: KnownMention[]; urls?: string[]; caret?: number } = {}
    ) => {
      const fixed = opts.urls
        ? { display: nextDisplay, urls: opts.urls, caret: opts.caret ?? 0 }
        : reconcileLinkMarkers(displayValue, linkUrls, nextDisplay, opts.caret ?? 0);
      const nextRaw = assembleRawFromDisplay(
        fixed.display,
        opts.mentions ?? knownMentions,
        fixed.urls
      );
      setSyncedValue(nextRaw);
      setKnownMentions(extractKnownMentionsFromRaw(nextRaw));
      setDisplayValue(fixed.display);
      setLinkUrls(fixed.urls);
      onChange(nextRaw);
      return fixed;
    },
    [displayValue, knownMentions, linkUrls, onChange]
  );

  /** Selects [start, end) once `nextDisplay` is in the textarea. */
  const placeCaret = useCallback(
    (start: number, end: number, nextDisplay: string) => {
      const el = taRef.current;
      if (!el) return;
      if (el.value === nextDisplay) {
        el.focus();
        el.setSelectionRange(start, end);
      } else {
        pendingSelectionRef.current = [start, end];
      }
    },
    []
  );

  const captureTextareaSelection = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    let selected = displayValue.slice(start, end);
    if (selected.trim().length > 0) {
      selected = selected.replace(/\r\n/g, "\n").replace(/\n+/g, " ").trim();
    }
    selectionRef.current = { start, end, selectedText: selected };
  }, [displayValue]);

  const preventToolbarBlur = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

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

  const applyMentionUsers = useCallback(
    (users: MentionUser[], query: string) => {
      const broadcasts = allowBroadcastMentions
        ? broadcastMentionsForQuery(query)
        : [];
      const merged: MentionUser[] = [
        ...broadcasts,
        ...users.filter((user) => !user.broadcast),
      ];
      setMentionUsers(merged);
      const broadcastCount = broadcasts.length;
      setHighlightIdx(
        query.length === 0 && merged.length > broadcastCount ? broadcastCount : 0
      );
      return merged.length;
    },
    [allowBroadcastMentions]
  );

  const closeMention = useCallback(() => {
    if (mentionDebounceRef.current) {
      clearTimeout(mentionDebounceRef.current);
      mentionDebounceRef.current = null;
    }
    fetchSeq.current += 1;
    setMentionOpen(false);
    setMentionLoading(false);
  }, []);

  const runMentionFetch = useCallback(
    ({ start, query }: { start: number; query: string }) => {
      // "Daniel M" keeps searching; once a multi-word query finds no one, the
      // picker closes and stays closed while the user types on from there.
      const multiWord = /\s/.test(query.trim());
      const dead = noMatchRef.current;
      if (multiWord && dead && dead.start === start && query.startsWith(dead.query)) {
        closeMention();
        return;
      }
      const applyOrClose = (users: MentionUser[]) => {
        if (applyMentionUsers(users, query) === 0 && multiWord) {
          noMatchRef.current = { start, query };
          closeMention();
          return false;
        }
        return true;
      };

      setMentionOpen(true);

      const cached = readMentionCache(query, prioritizeUserId);
      if (cached) {
        if (!applyOrClose(cached)) return;
        setMentionLoading(false);
      } else {
        // After a space, keep the last matches up until the narrower list lands.
        if (!/\s/.test(query)) applyMentionUsers([], query);
        setMentionLoading(true);
      }

      const doFetch = () => {
        const seq = ++fetchSeq.current;
        fetchMentionUsers(query, prioritizeUserId)
          .then((users) => {
            if (fetchSeq.current !== seq) return;
            if (applyOrClose(users)) setMentionLoading(false);
          })
          .catch(() => {
            if (fetchSeq.current !== seq) return;
            if (applyOrClose([])) setMentionLoading(false);
          });
      };

      if (mentionDebounceRef.current) {
        clearTimeout(mentionDebounceRef.current);
        mentionDebounceRef.current = null;
      }

      if (query.length === 0) {
        doFetch();
        return;
      }

      mentionDebounceRef.current = setTimeout(doFetch, MENTION_SEARCH_DEBOUNCE_MS);
    },
    [applyMentionUsers, closeMention, prioritizeUserId]
  );

  const syncMentionFromDom = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    const q = getActiveMentionQuery(displayValue, el.selectionStart ?? 0, knownMentions);
    if (!q) {
      setMentionOpen(false);
      return;
    }
    runMentionFetch(q);
  }, [displayValue, knownMentions, runMentionFetch]);

  const insertMention = useCallback(
    (user: MentionUser) => {
      const el = taRef.current;
      if (!el) return;
      const sel = el.selectionStart ?? 0;
      const ctx = getActiveMentionQuery(displayValue, sel);
      if (!ctx) return;

      const isBroadcast = Boolean(user.broadcast);
      const safeName =
        user.display_name.replace(/[[\]()]/g, "").replace(/\s+/g, " ").trim() ||
        (isBroadcast ? "everyone" : "member");
      const prefix = atPrefixForMentionType(isBroadcast ? "group" : "user");
      const target = isBroadcast
        ? buildMentionTarget({ type: "group", group: user.broadcast! })
        : buildMentionTarget({ type: "user", userId: user.id });
      const mentionText = `${prefix}${safeName}`;
      const nextDisplay =
        displayValue.slice(0, ctx.start) + mentionText + " " + displayValue.slice(sel);
      const nextKnown = [...knownMentions, { prefix, label: safeName, target }];
      commitFromDisplay(nextDisplay, { mentions: nextKnown });
      setMentionOpen(false);

      requestAnimationFrame(() => {
        const pos = ctx.start + mentionText.length + 1;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [commitFromDisplay, displayValue, knownMentions]
  );

  /** Inserts a lesson/course mention (from the Academy picker) at the saved caret. */
  const insertEntityMention = useCallback(
    (pick: AcademyMentionPick) => {
      setPickerOpen(false);
      const el = taRef.current;
      if (!el) return;
      const { start, end } = selectionRef.current;
      const prefix = atPrefixForMentionType(pick.type);
      const safeLabel =
        pick.title.replace(/[[\]()]/g, "").replace(/\s+/g, " ").trim() || pick.type;
      const target =
        pick.type === "lesson"
          ? buildMentionTarget({
              type: "lesson",
              area: pick.area,
              courseId: pick.courseId,
              lessonId: pick.lessonId,
            })
          : buildMentionTarget({
              type: "course",
              area: pick.area,
              courseId: pick.courseId,
            });

      const mentionText = `${prefix}${safeLabel}`;
      const prevChar = displayValue[start - 1] ?? "";
      const lead = start > 0 && !/\s/.test(prevChar) ? " " : "";
      const insertText = `${lead}${mentionText} `;
      const nextDisplay =
        displayValue.slice(0, start) + insertText + displayValue.slice(end);
      const nextKnown = [...knownMentions, { prefix, label: safeLabel, target }];
      commitFromDisplay(nextDisplay, { mentions: nextKnown });

      requestAnimationFrame(() => {
        const pos = start + insertText.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [commitFromDisplay, displayValue, knownMentions]
  );

  /** Commits text the user typed (or deleted) and re-reads the @mention query. */
  const applyTypedEdit = useCallback(
    (typed: string, caret: number, forceCaret: boolean) => {
      const fixed = commitFromDisplay(typed, { caret });
      if (forceCaret || fixed.display !== typed) {
        placeCaret(fixed.caret, fixed.caret, fixed.display);
      }
      const ctx = getActiveMentionQuery(fixed.display, fixed.caret, knownMentions);
      if (!ctx) {
        setMentionOpen(false);
        return;
      }
      runMentionFetch(ctx);
    },
    [commitFromDisplay, knownMentions, placeCaret, runMentionFetch]
  );

  const toggleBold = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    const next = toggleBoldAt(displayValue, el.selectionStart ?? 0, el.selectionEnd ?? 0);
    const fixed = commitFromDisplay(next.text);
    setMentionOpen(false);
    placeCaret(next.start, next.end, fixed.display);
  }, [commitFromDisplay, displayValue, placeCaret]);

  const editLink = useCallback(
    (index: number) => {
      const span = linkSpans(displayValue)[index];
      if (!span) return;
      setLinkUrlDraft(linkUrls[index] ?? "");
      setLinkLabelDraft(displayValue.slice(span.open + 1, span.close));
      setLinkTarget({ index, start: span.open, end: span.close + 1 });
      setMentionOpen(false);
      setCaretLink(-1);
    },
    [displayValue, linkUrls]
  );

  /**
   * Link button / Cmd+K. Inside a link it edits that link; otherwise the
   * selection becomes the link text (widened to swallow any link it overlaps).
   */
  const openLink = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const inside = linkIndexAt(displayValue, start, end);
    if (inside !== -1) {
      editLink(inside);
      return;
    }
    let s = start;
    let e = end;
    for (const span of linkSpans(displayValue)) {
      if (span.open < e && span.close + 1 > s) {
        s = Math.min(s, span.open);
        e = Math.max(e, span.close + 1);
      }
    }
    setLinkUrlDraft("");
    setLinkLabelDraft(cleanLinkLabel(displayValue.slice(s, e)));
    setLinkTarget({ index: null, start: s, end: e });
    setMentionOpen(false);
    setCaretLink(-1);
  }, [displayValue, editLink]);

  const applyLink = useCallback(() => {
    if (!linkTarget) return;
    const url = normalizeCommunityPostLinkUrl(linkUrlDraft);
    if (!url) return;
    const label = cleanLinkLabel(linkLabelDraft) || linkLabelFromUrl(url);
    const { index, start, end } = linkTarget;
    const urls = [...linkUrls];
    if (index !== null) {
      urls[index] = url;
    } else {
      const spans = linkSpans(displayValue);
      const before = spans.filter((span) => span.close < start).length;
      const replaced = spans.filter((span) => span.open >= start && span.close < end).length;
      urls.splice(before, replaced, url);
    }
    const nextDisplay =
      displayValue.slice(0, start) + LINK_MARKER + label + LINK_MARKER + displayValue.slice(end);
    commitFromDisplay(nextDisplay, { urls });
    setLinkTarget(null);
    const caret = start + label.length + 2;
    placeCaret(caret, caret, nextDisplay);
  }, [commitFromDisplay, displayValue, linkLabelDraft, linkTarget, linkUrlDraft, linkUrls, placeCaret]);

  /** Turns a link back into plain text. */
  const removeLink = useCallback(
    (index: number) => {
      const span = linkSpans(displayValue)[index];
      if (!span) return;
      const label = displayValue.slice(span.open + 1, span.close);
      const nextDisplay =
        displayValue.slice(0, span.open) + label + displayValue.slice(span.close + 1);
      commitFromDisplay(nextDisplay, { urls: linkUrls.filter((_, i) => i !== index) });
      setLinkTarget(null);
      setCaretLink(-1);
      const caret = span.open + label.length;
      placeCaret(caret, caret, nextDisplay);
    },
    [commitFromDisplay, displayValue, linkUrls, placeCaret]
  );

  const closeLinkForm = useCallback(() => {
    if (!linkTarget) return;
    setLinkTarget(null);
    placeCaret(linkTarget.end, linkTarget.end, displayValue);
  }, [displayValue, linkTarget, placeCaret]);

  useImperativeHandle(formatRef, () => ({ toggleBold, openLink }), [toggleBold, openLink]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (richFormatting && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        const key = e.key.toLowerCase();
        if (key === "b" || key === "k") {
          e.preventDefault();
          // Cmd+K is also global search; inside the composer it means link.
          e.stopPropagation();
          if (key === "b") toggleBold();
          else openLink();
          return;
        }
      }
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        !e.altKey &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        const el = e.currentTarget;
        if (el.selectionStart === el.selectionEnd) {
          const edit = deleteBesideLinkMarker(
            displayValue,
            el.selectionStart,
            e.key === "Backspace" ? "backward" : "forward"
          );
          if (edit) {
            e.preventDefault();
            applyTypedEdit(edit.display, edit.caret, true);
            return;
          }
        }
      }
      if (!mentionOpen || mentionUsers.length === 0) {
        if (e.key === "Escape") setMentionOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => (i + 1) % mentionUsers.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((i) => (i - 1 + mentionUsers.length) % mentionUsers.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        insertMention(mentionUsers[safeHighlightIdx]!);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setMentionOpen(false);
      }
    },
    [
      applyTypedEdit,
      displayValue,
      insertMention,
      mentionOpen,
      mentionUsers,
      openLink,
      richFormatting,
      safeHighlightIdx,
      toggleBold,
    ]
  );

  const onSelectOrClick = useCallback(() => {
    syncMentionFromDom();
    const el = taRef.current;
    const collapsed = el && el.selectionStart === el.selectionEnd;
    setCaretLink(collapsed ? linkIndexAt(displayValue, el.selectionStart) : -1);
  }, [displayValue, syncMentionFromDom]);

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
    if (!richFormatting) return;
    syncMirrorScroll();
  }, [displayValue, richFormatting, syncMirrorScroll]);

  const onChangeInner = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      applyTypedEdit(e.target.value, e.target.selectionStart ?? 0, false);
    },
    [applyTypedEdit]
  );

  const openEntityPicker = useCallback((mode: "lesson" | "course") => {
    setPickerMode(mode);
    setPickerOpen(true);
    setMentionOpen(false);
  }, []);

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

  // The list is portalled and fixed-positioned so scrolling comment panels and
  // modals cannot clip it. Opens upward when there is more room above.
  useLayoutEffect(() => {
    if (!showList) return;

    function updateListPos() {
      const el = taRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - LIST_GAP - LIST_VIEWPORT_MARGIN;
      const spaceAbove = rect.top - LIST_GAP - LIST_VIEWPORT_MARGIN;
      const wanted = Math.min(LIST_MAX_HEIGHT, listRef.current?.scrollHeight || LIST_MAX_HEIGHT);
      const placeAbove = spaceBelow < wanted && spaceAbove > spaceBelow;
      const next: ListPos = {
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(0, Math.min(LIST_MAX_HEIGHT, placeAbove ? spaceAbove : spaceBelow)),
        ...(placeAbove
          ? { bottom: window.innerHeight - rect.top + LIST_GAP }
          : { top: rect.bottom + LIST_GAP }),
      };
      setListPos((cur) =>
        cur &&
        cur.left === next.left &&
        cur.width === next.width &&
        cur.maxHeight === next.maxHeight &&
        cur.top === next.top &&
        cur.bottom === next.bottom
          ? cur
          : next
      );
    }

    updateListPos();
    // Re-measure once the list has mounted so short lists are not flipped
    // upward on the assumption they are full height.
    const frame = window.requestAnimationFrame(updateListPos);
    window.addEventListener("resize", updateListPos);
    window.addEventListener("scroll", updateListPos, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateListPos);
      window.removeEventListener("scroll", updateListPos, true);
    };
  }, [showList, mentionUsers, mentionLoading, displayValue]);

  useEffect(() => {
    if (!showList) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-mention-idx="${safeHighlightIdx}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [showList, safeHighlightIdx]);

  const textareaClass = `${className}${autoResize ? " resize-none overflow-hidden" : ""}`;
  const activeLinkUrl = richFormatting && caretLink >= 0 ? linkUrls[caretLink] : undefined;
  const activeLinkHref = activeLinkUrl ? safeExternalHref(activeLinkUrl) : null;
  const linkPanelSpacing = showFormattingToolbar ? "mx-0.5 mb-2" : "mx-2 mb-2 mt-1";

  const editor = richFormatting ? (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        <div
          ref={mirrorInnerRef}
          className={`${textareaClass} whitespace-pre-wrap break-words text-slate-900`}
          dangerouslySetInnerHTML={{
            __html: displayToMirrorHtml(displayValue, {
              placeholder,
              placeholderClass: showFormattingToolbar ? "text-slate-400" : "text-slate-500",
              activeLink: linkTarget?.index ?? caretLink,
            }),
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
        onFocus={() => setLinkTarget(null)}
        onBlur={() => setCaretLink(-1)}
        onScroll={onScrollMirror}
        placeholder={undefined}
        aria-label={placeholder}
        disabled={disabled}
        rows={autoResize ? 1 : rows}
        className={`${textareaClass} relative z-[1] text-transparent caret-slate-900`}
      />
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
      className={textareaClass}
    />
  );

  const linkPanel = !richFormatting ? null : linkTarget ? (
    <div
      className={`relative z-20 ${linkPanelSpacing} rounded-xl border border-slate-200 bg-white p-3 shadow-lg`}
      role="group"
      aria-label={linkTarget.index === null ? "Add link" : "Edit link"}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          applyLink();
        } else if (e.key === "Escape") {
          // Close the form, not the modal around the composer.
          e.preventDefault();
          e.stopPropagation();
          closeLinkForm();
        }
      }}
    >
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-600">
          URL
          <input
            type="url"
            value={linkUrlDraft}
            onChange={(e) => setLinkUrlDraft(e.target.value)}
            placeholder="Paste a link"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            autoFocus
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Text to display
          <input
            type="text"
            value={linkLabelDraft}
            onChange={(e) => setLinkLabelDraft(e.target.value)}
            placeholder="Link label"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        {linkTarget.index !== null ? (
          <button
            type="button"
            className="mr-auto rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
            onClick={() => removeLink(linkTarget.index!)}
          >
            Remove link
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          onClick={closeLinkForm}
        >
          Cancel
        </button>
        <button
          type="button"
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          disabled={!normalizeCommunityPostLinkUrl(linkUrlDraft)}
          onClick={applyLink}
        >
          {linkTarget.index === null ? "Add link" : "Save"}
        </button>
      </div>
    </div>
  ) : activeLinkUrl ? (
    // Caret is in a link: show where it goes, with edit and remove.
    <div
      className={`${linkPanelSpacing} flex min-w-0 items-center gap-1 rounded-lg border border-slate-200 bg-white py-1 pl-2.5 pr-1 text-sm shadow-sm`}
    >
      <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
      {activeLinkHref ? (
        <a
          href={activeLinkHref}
          target="_blank"
          rel="noopener noreferrer"
          title={activeLinkUrl}
          className="min-w-0 flex-1 truncate text-blue-600 hover:underline"
          onMouseDown={preventToolbarBlur}
        >
          {prettyLinkUrl(activeLinkUrl)}
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate text-slate-500">{activeLinkUrl}</span>
      )}
      <button
        type="button"
        className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        onMouseDown={preventToolbarBlur}
        onClick={() => editLink(caretLink)}
      >
        Edit
      </button>
      <button
        type="button"
        className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        onMouseDown={preventToolbarBlur}
        onClick={() => removeLink(caretLink)}
      >
        Remove
      </button>
    </div>
  ) : null;

  return (
    <div className="relative">
      {showFormattingToolbar ? (
        <div className="border-b border-slate-200 transition focus-within:border-sky-500">
          {editor}
          <div className="mb-1.5 mt-1.5 flex flex-wrap items-center gap-1.5 px-0.5">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50"
              onMouseDown={preventToolbarBlur}
              onClick={toggleBold}
              aria-label="Bold"
              title="Bold"
            >
              <Bold className="h-4.5 w-4.5" strokeWidth={2.4} />
            </button>
            <button
              type="button"
              className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border border-slate-200 px-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onMouseDown={preventToolbarBlur}
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
              onMouseDown={preventToolbarBlur}
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
              onMouseDown={preventToolbarBlur}
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
              onMouseDown={preventToolbarBlur}
              onClick={() => applyLinePrefix("- ")}
              aria-label="Bullet list"
              title="Bullet list"
            >
              <List className="h-4 w-4" strokeWidth={2.1} />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50"
              onMouseDown={preventToolbarBlur}
              onClick={openLink}
              aria-label="Link"
              title="Link — select text, then add URL"
            >
              <Link2 className="h-4 w-4" strokeWidth={2.1} />
            </button>
            <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden />
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              onMouseDown={(e) => {
                preventToolbarBlur(e);
                captureTextareaSelection();
              }}
              onClick={() => openEntityPicker("lesson")}
              aria-label="Insert lesson"
              title="Insert a lesson link"
            >
              <BookOpen className="h-4 w-4" strokeWidth={2.1} />
              <span className="leading-none">Lesson</span>
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              onMouseDown={(e) => {
                preventToolbarBlur(e);
                captureTextareaSelection();
              }}
              onClick={() => openEntityPicker("course")}
              aria-label="Insert course"
              title="Insert a course link"
            >
              <GraduationCap className="h-4 w-4" strokeWidth={2.1} />
              <span className="leading-none">Course</span>
            </button>
          </div>
          {linkPanel}
        </div>
      ) : (
        <>
          {editor}
          {linkPanel}
        </>
      )}
      {showList && listPos
        ? createPortal(
        <ul
          ref={listRef}
          className="fixed z-[300] overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          style={listPos}
          role="listbox"
        >
          {mentionLoading && mentionUsers.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">Loading…</li>
          ) : mentionUsers.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No matches</li>
          ) : (
            mentionUsers.map((u, idx) => {
              const next = mentionUsers[idx + 1];
              const showDivider = Boolean(u.broadcast) && next && !next.broadcast;
              return (
                <li
                  key={u.id}
                  role="option"
                  aria-selected={idx === safeHighlightIdx}
                  data-mention-idx={idx}
                >
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
                    {u.broadcast ? (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                        <Users className="h-4 w-4" strokeWidth={2} />
                      </span>
                    ) : u.avatar_url ? (
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
                        {u.broadcast ? `@${u.display_name}` : u.display_name}
                      </span>
                      {u.broadcast ? (
                        <span className="block text-xs text-slate-500">
                          Notifies everyone
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {showDivider ? (
                    <div className="my-1 border-t border-slate-100" role="separator" />
                  ) : null}
                </li>
              );
            })
          )}
        </ul>,
            document.body
          )
        : null}

      <AcademyMentionPicker
        open={pickerOpen}
        mode={pickerMode}
        onClose={() => setPickerOpen(false)}
        onPick={insertEntityMention}
      />
    </div>
  );
}

/**
 * Bold + link buttons for a comment composer's own action row. Point
 * `editorRef` at the `formatRef` of a MentionTextarea with `inlineFormatting`.
 */
export function CommentFormatButtons({
  editorRef,
  size = "md",
  className = "",
}: {
  editorRef: RefObject<MentionTextareaHandle | null>;
  size?: "sm" | "md";
  className?: string;
}) {
  const buttonClass = `inline-flex ${
    size === "md" ? "h-9 w-9" : "h-8 w-8"
  } shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600`;
  const iconClass = size === "md" ? "h-[1.125rem] w-[1.125rem]" : "h-4 w-4";
  // Keep focus (and the selection) in the textarea while clicking.
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className={`flex items-center ${className}`}>
      <button
        type="button"
        className={buttonClass}
        onMouseDown={keepFocus}
        onClick={() => editorRef.current?.toggleBold()}
        aria-label="Bold"
        title="Bold"
      >
        <Bold className={iconClass} strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className={buttonClass}
        onMouseDown={keepFocus}
        onClick={() => editorRef.current?.openLink()}
        aria-label="Add link"
        title="Add link (select the words to link first)"
      >
        <Link2 className={iconClass} strokeWidth={2} />
      </button>
    </div>
  );
}
