"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import {
  ArrowUpRight,
  Bold,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CircleCheck,
  Copy,
  FilePen,
  GripVertical,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Newspaper,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { Blocks } from "@/components/practice/document/Blocks";
import "@/components/practice/document/blueprint.css";
import "@/components/practice/document/blueprint-clean.css";
import "./newsletter-editor.css";
import { CoverMaker } from "./CoverMaker";
import { fetchProfileRole } from "@/lib/getClients/cachedProfileRole";
import { getSessionUser } from "@/lib/supabaseAccessToken";
import { badgeClass } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { blocksToMarkdown } from "@/lib/practiceKnowledge/blocks";
import type { BlueprintBlock, NewsletterPublish } from "@/lib/practiceKnowledge/types";
import type { LinkedInHistoryPayload, NewsletterDraftItem, NewsletterIssueItem } from "@/lib/linkedinHistory/loadHistory";
import { LINE_MARKER, blocksToDoc, docToBlocks } from "@/lib/linkedinHistory/newsletterDoc";

type Headers = () => Promise<Record<string, string> | null>;

const CADENCE: Record<string, string> = { weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

function reach(issue: Pick<NewsletterIssueItem, "impressions" | "reactions" | "comments">): string {
  const parts = [
    issue.impressions ? `${issue.impressions.toLocaleString("en-GB")} views` : null,
    `${issue.reactions} reactions`,
    issue.comments ? `${issue.comments} comments` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

type Status = "draft" | "scheduled" | "published";

/**
 * One issue in the left list, by its id: "draft:" + Blueprint key, or the imported issue id.
 * A draft BCA wrote that is already out on LinkedIn (same title as an imported issue) shows once, as published.
 */
type Item =
  | { id: string; kind: "draft"; status: Status; title: string; date: string | null; sortAt: string; draft: NewsletterDraftItem; match: NewsletterIssueItem | null }
  | { id: string; kind: "issue"; status: "published"; title: string; date: string; sortAt: string; issue: NewsletterIssueItem };

function sameTitle(a: string, b: string): boolean {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return Boolean(norm(a)) && norm(a) === norm(b);
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

type Bar = { left: ReactNode; right: ReactNode };

const PAGE = "w-full max-w-[51rem] px-6 pt-8 pb-24 md:px-10 lg:px-14";
const TITLE = "text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#0f172a] md:text-[2rem]";
const TOOL =
  "shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-30";

/** The slim bar over the page, as on a clean Blueprint page. */
function TopBar({ left, right, children }: Bar & { children?: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-2 border-b border-slate-200 px-4 py-1.5 md:px-5">
      {left}
      <div className="ml-auto flex items-center gap-1">
        {children}
        {right}
      </div>
    </div>
  );
}

async function uploadImage(file: File, getHeaders: Headers): Promise<string | null> {
  const headers = await getHeaders();
  if (!headers) return null;
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/coach/newsletter/image", { method: "POST", headers, body: form });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error || "Could not upload that picture.");
  return body.url;
}

/** Opens the file picker and hands back the picture's link once it's uploaded. */
function usePicturePicker(getHeaders: Headers, onPicked: (url: string) => void) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const element = (
    <input
      ref={input}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      className="hidden"
      onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setBusy(true);
        setError(null);
        try {
          const url = await uploadImage(file, getHeaders);
          if (url) onPicked(url);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not upload that picture.");
        } finally {
          setBusy(false);
        }
      }}
    />
  );
  return { open: () => input.current?.click(), busy, error, element };
}

/** A picture with alt text and, if set, a link: it copies out as <a><img></a>, the way LinkedIn takes it. */
const NewsletterImage = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      href: {
        default: null,
        parseHTML: (el: HTMLElement) => el.closest("a")?.getAttribute("href") ?? null,
        renderHTML: () => ({}),
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const img = ["img", HTMLAttributes] as const;
    return node.attrs.href ? ["a", { href: node.attrs.href, target: "_blank", rel: "noreferrer" }, img] : img;
  },
});

function useNewsletterEditor(content: JSONContent, placeholder: string, events: { onChange: () => void; onFocus: (editor: Editor) => void }) {
  const ref = useRef(events);
  useLayoutEffect(() => {
    ref.current = events;
  });
  return useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Saved as light Markdown, so only what that can hold: bold, italic, struck, links, lists, quotes.
        underline: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true, HTMLAttributes: { target: "_blank", rel: "noreferrer" } },
      }),
      NewsletterImage,
      Placeholder.configure({ placeholder }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: () => ref.current.onChange(),
    onFocus: ({ editor }) => ref.current.onFocus(editor),
  });
}

/** Link button: a small box under it for the address. */
function LinkTool({ editor, active }: { editor: Editor | null; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  function apply() {
    if (!editor) return;
    const value = href.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!value) chain.unsetLink().run();
    else chain.setLink({ href: /^https?:\/\//i.test(value) ? value : `https://${value}` }).run();
    setOpen(false);
  }
  return (
    <span className="relative">
      <button
        type="button"
        title="Link"
        aria-label="Link"
        aria-pressed={active}
        disabled={!editor}
        className={`${TOOL} ${active ? "bg-slate-100 text-slate-900" : ""}`}
        onClick={() => {
          setHref(String(editor?.getAttributes("link").href ?? ""));
          setOpen((v) => !v);
        }}
      >
        <Link2 className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <span className="absolute left-0 top-full z-30 mt-1.5 flex w-72 items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          <input
            autoFocus
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Paste a link"
            className="min-w-0 flex-1 rounded-md px-2 py-1 text-sm outline-none focus:bg-slate-50"
          />
          <button type="button" onClick={apply} className={buttonClass("main", "small")}>
            {href.trim() ? "Add" : "Remove"}
          </button>
        </span>
      ) : null}
    </span>
  );
}

/** For the picture that's picked: alt text (read out to people who can't see it) and a link. */
function ImageTool({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [alt, setAlt] = useState("");
  const [href, setHref] = useState("");
  function save() {
    const link = href.trim();
    editor
      .chain()
      .focus()
      .updateAttributes("image", { alt: alt.trim() || null, href: link ? (/^https?:\/\//i.test(link) ? link : `https://${link}`) : null })
      .run();
    setOpen(false);
  }
  const field = "w-full rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-sky-400";
  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => {
          const attrs = editor.getAttributes("image");
          setAlt(String(attrs.alt ?? ""));
          setHref(String(attrs.href ?? ""));
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
      >
        Alt text & link
      </button>
      {open ? (
        <span className="absolute left-0 top-full z-30 mt-1.5 block w-80 space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <label className="block text-xs font-medium text-slate-600">
            Alt text
            <input autoFocus value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="What the picture shows" className={`mt-1 ${field}`} />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Link
            <input
              value={href}
              onChange={(e) => setHref(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
              placeholder="Where a click on it goes (optional)"
              className={`mt-1 ${field}`}
            />
          </label>
          <span className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className={buttonClass("second", "small")}>
              Cancel
            </button>
            <button type="button" onClick={save} className={buttonClass("main", "small")}>
              Save
            </button>
          </span>
        </span>
      ) : null}
    </span>
  );
}

/** The formatting bar over the editor: text style, then marks, lists, picture, undo. */

/**
 * Bullets or numbers for the lines picked. Lines that already start with "1. " or "- " lose that marker, so
 * the number isn't shown twice, and lines kept apart by Shift+Enter each become their own point.
 */
function makeList(editor: Editor, kind: "bulletList" | "orderedList") {
  const toggle = () => (kind === "bulletList" ? editor.chain().focus().toggleBulletList().run() : editor.chain().focus().toggleOrderedList().run());
  const { doc, selection } = editor.state;
  const last = doc.childCount - 1;
  const fromIdx = Math.min(doc.resolve(selection.from).index(0), last);
  const toIdx = Math.min(doc.resolve(selection.to).index(0), last);
  let start = 0;
  for (let i = 0; i < fromIdx; i++) start += doc.child(i).nodeSize;
  let end = start;
  const items: JSONContent[] = [];
  for (let i = fromIdx; i <= toIdx; i++) {
    const node = doc.child(i);
    end += node.nodeSize;
    if (node.type.name !== "paragraph") return toggle();
    let line: JSONContent[] = [];
    const lines: JSONContent[][] = [];
    for (const child of node.toJSON().content ?? []) {
      if (child.type === "hardBreak") {
        lines.push(line);
        line = [];
      } else line.push(child);
    }
    lines.push(line);
    for (const parts of lines) {
      const first = parts[0];
      if (first?.type === "text" && typeof first.text === "string") {
        const text = first.text.replace(LINE_MARKER, "");
        if (text) parts[0] = { ...first, text };
        else parts.shift();
      }
      if (parts.length) items.push({ type: "listItem", content: [{ type: "paragraph", content: parts }] });
    }
  }
  if (!items.length) return toggle();
  editor.chain().focus().insertContentAt({ from: start, to: end }, { type: kind, content: items }).run();
}

function FormatBar({
  editor,
  onPicture,
  uploading,
  trailing,
}: {
  editor: Editor | null;
  onPicture: () => void;
  uploading: boolean;
  trailing?: ReactNode;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      style: e?.isActive("heading", { level: 2 }) ? "h2" : e?.isActive("heading", { level: 3 }) ? "h3" : "p",
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      strike: e?.isActive("strike") ?? false,
      link: e?.isActive("link") ?? false,
      bullets: e?.isActive("bulletList") ?? false,
      numbered: e?.isActive("orderedList") ?? false,
      quote: e?.isActive("blockquote") ?? false,
      image: e?.isActive("image") ?? false,
      undo: e?.can().undo() ?? false,
      redo: e?.can().redo() ?? false,
    }),
  });
  const tool = (active: boolean | undefined) => `${TOOL} ${active ? "bg-slate-100 text-slate-900" : ""}`;
  const sep = <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-slate-200" />;
  const run = (fn: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => editor && fn(editor.chain().focus()).run();
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 px-4 py-1.5 md:px-5">
      <span className="relative shrink-0">
        <select
          aria-label="Text style"
          disabled={!editor}
          value={state?.style ?? "p"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "p") run((c) => c.setParagraph());
            else run((c) => c.setHeading({ level: v === "h2" ? 2 : 3 }));
          }}
          className="appearance-none rounded-md bg-transparent py-1 pl-2 pr-7 text-sm font-medium text-slate-700 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-sky-200"
        >
          <option value="p">Normal text</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
      </span>
      {sep}
      <button type="button" title="Bold" aria-label="Bold" aria-pressed={state?.bold} disabled={!editor} className={tool(state?.bold)} onClick={() => run((c) => c.toggleBold())}>
        <Bold className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" title="Italic" aria-label="Italic" aria-pressed={state?.italic} disabled={!editor} className={tool(state?.italic)} onClick={() => run((c) => c.toggleItalic())}>
        <Italic className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" title="Strikethrough" aria-label="Strikethrough" aria-pressed={state?.strike} disabled={!editor} className={tool(state?.strike)} onClick={() => run((c) => c.toggleStrike())}>
        <Strikethrough className="h-4 w-4" aria-hidden />
      </button>
      <LinkTool editor={editor} active={Boolean(state?.link)} />
      {sep}
      <button type="button" title="Bullet list" aria-label="Bullet list" aria-pressed={state?.bullets} disabled={!editor} className={tool(state?.bullets)} onClick={() => editor && makeList(editor, "bulletList")}>
        <List className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" title="Numbered list" aria-label="Numbered list" aria-pressed={state?.numbered} disabled={!editor} className={tool(state?.numbered)} onClick={() => editor && makeList(editor, "orderedList")}>
        <ListOrdered className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" title="Quote" aria-label="Quote" aria-pressed={state?.quote} disabled={!editor} className={tool(state?.quote)} onClick={() => run((c) => c.toggleBlockquote())}>
        <Quote className="h-4 w-4" aria-hidden />
      </button>
      {sep}
      <button type="button" title="Add a picture" aria-label="Add a picture" disabled={!editor || uploading} className={TOOL} onClick={onPicture}>
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
      </button>
      {editor && state?.image ? <ImageTool key={String(editor.getAttributes("image").src)} editor={editor} /> : null}
      {sep}
      <button type="button" title="Undo" aria-label="Undo" disabled={!state?.undo} className={TOOL} onClick={() => run((c) => c.undo())}>
        <Undo2 className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" title="Redo" aria-label="Redo" disabled={!state?.redo} className={TOOL} onClick={() => run((c) => c.redo())}>
        <Redo2 className="h-4 w-4" aria-hidden />
      </button>
      {trailing ? <span className="ml-auto pl-2">{trailing}</span> : null}
    </div>
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Copies the issue as formatted text with its pictures; plain text where the browser won't take that. */
function RichCopyButton({ getContent }: { getContent: () => { html: string; text: string } | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy the issue, with its pictures"
      onClick={async () => {
        const content = getContent();
        if (!content) return;
        try {
          if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
            await navigator.clipboard.write([
              new ClipboardItem({
                "text/html": new Blob([content.html], { type: "text/html" }),
                "text/plain": new Blob([content.text], { type: "text/plain" }),
              }),
            ]);
          } else {
            await navigator.clipboard.writeText(content.text);
          }
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          // clipboard blocked; nothing to do
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CopyButton({ text }: { text: () => string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const value = text();
        if (!value) return;
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          // clipboard blocked; nothing to do
        }
      }}
      className={buttonClass("second", "small")}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy text"}
    </button>
  );
}

/** The cover photo across the top of the page, or a quiet place to add one. */
function Cover({ url, busy, onPick, onRemove }: { url: string | null; busy: boolean; onPick?: () => void; onRemove?: () => void }) {
  if (url) {
    return (
      <div className="group relative mb-8 overflow-hidden rounded-lg bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="aspect-video w-full object-cover" />
        {onPick ? (
          <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
            <button type="button" onClick={onPick} disabled={busy} className={buttonClass("second", "small")}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Change cover
            </button>
            <button type="button" onClick={onRemove} className={buttonClass("second", "small")}>
              Remove
            </button>
          </div>
        ) : null}
      </div>
    );
  }
  if (!onPick) return null;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy}
      className="mb-8 flex h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-500 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700"
    >
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        Add a cover photo
      </span>
      <span className="text-xs text-slate-400">1920 × 1080 works best on LinkedIn</span>
    </button>
  );
}

/** The issue's title, edited in place. It grows to fit. */
function TitleInput({ value, onChange, onEnter }: { value: string; onChange: (value: string) => void; onEnter: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder="Title"
      aria-label="Title"
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
        }
      }}
      className={`nl-title ${TITLE} block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-slate-300`}
    />
  );
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveNote({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span className={`pr-2 text-xs ${status === "error" ? "text-red-600" : "text-slate-400"}`} aria-live="polite">
      {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Didn't save"}
    </span>
  );
}

const STATUS_LOOK: Record<Status, { label: string; tone: "amber" | "blue" | "green"; icon: typeof FilePen }> = {
  draft: { label: "Draft", tone: "amber", icon: FilePen },
  scheduled: { label: "Scheduled", tone: "blue", icon: CalendarClock },
  published: { label: "Published", tone: "green", icon: CircleCheck },
};

/** Where the issue stands: draft, scheduled on LinkedIn (with when), or published. */
function StatusMenu({ status, at, onChange }: { status: Status; at: string | null; onChange: (publish: NewsletterPublish | null) => void }) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [when, setWhen] = useState(() => toLocalInput(at));
  const look = STATUS_LOOK[status];
  const Icon = look.icon;
  const choose = (publish: NewsletterPublish | null) => {
    onChange(publish);
    setOpen(false);
    setPicking(false);
  };
  const option = "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50";
  return (
    <span className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Status: ${look.label}`}
        onClick={() => setOpen((v) => !v)}
        className={badgeClass(look.tone, "gap-1.5 px-2.5 py-1 hover:brightness-95")}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {look.label}
        {status === "scheduled" && at ? <span className="font-normal opacity-80">· {formatWhen(at)}</span> : null}
        <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
      </button>
      {open ? (
        <span role="menu" className="absolute right-0 top-full z-30 mt-1.5 w-60 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <button type="button" role="menuitem" className={option} onClick={() => choose(null)}>
            <FilePen className="h-3.5 w-3.5 text-amber-600" aria-hidden />
            Draft
          </button>
          <button type="button" role="menuitem" className={option} onClick={() => setPicking(true)}>
            <CalendarClock className="h-3.5 w-3.5 text-sky-600" aria-hidden />
            Scheduled on LinkedIn…
          </button>
          {picking ? (
            <span className="flex items-center gap-1.5 px-2.5 pb-2 pt-1">
              <input
                type="datetime-local"
                aria-label="When it goes out"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
              />
              <button
                type="button"
                disabled={!when}
                onClick={() => choose({ status: "scheduled", at: new Date(when).toISOString() })}
                className={buttonClass("main", "small")}
              >
                Set
              </button>
            </span>
          ) : null}
          <button type="button" role="menuitem" className={option} onClick={() => choose({ status: "published", at: new Date().toISOString() })}>
            <CircleCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            Published
          </button>
        </span>
      ) : null}
    </span>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A draft from BCA: cover, title and the issue as one free-form page. Saves to the Blueprint as you go. */
function DraftView({
  draft,
  status: issueStatus,
  match,
  getHeaders,
  onSaved,
  bar,
}: {
  draft: NewsletterDraftItem;
  status: Status;
  /** The same issue imported from LinkedIn, once it's out. */
  match: NewsletterIssueItem | null;
  getHeaders: Headers;
  onSaved?: () => void;
  bar: Bar;
}) {
  // Read once: the editors own the text from here on.
  const [issueDoc] = useState(() => blocksToDoc(draft.blocks, { withTitle: true }));
  const [postDoc] = useState(() => (draft.post && draft.post_key ? blocksToDoc(draft.post, { withTitle: false }) : null));
  const [title, setTitle] = useState(issueDoc.title ?? draft.title);
  const [cover, setCover] = useState<string | null>(issueDoc.cover);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const live = useRef({ title, cover });
  useLayoutEffect(() => {
    live.current = { title, cover };
  });

  // What's waiting to be saved, per section. Kept ready so leaving the page can still save it.
  const pending = useRef<Map<string, BlueprintBlock[]>>(new Map());
  const timer = useRef<number | null>(null);
  const onSavedRef = useRef(onSaved);
  useLayoutEffect(() => {
    onSavedRef.current = onSaved;
  });

  async function flush() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const jobs = [...pending.current.entries()];
    if (!jobs.length) return;
    pending.current.clear();
    setStatus("saving");
    const results = await Promise.all(
      jobs.map(async ([section, blocks]) => {
        try {
          const headers = await getHeaders();
          if (!headers) return false;
          const res = await fetch("/api/coach/practice/build", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ section, blocks }),
            // Finishes even when the page is closing.
            keepalive: true,
          });
          return res.ok;
        } catch {
          return false;
        }
      })
    );
    // A failed save stays waiting, unless something newer replaced it.
    jobs.forEach(([section, blocks], i) => {
      if (!results[i] && !pending.current.has(section)) pending.current.set(section, blocks);
    });
    const ok = results.every(Boolean);
    setStatus(ok ? "saved" : "error");
    if (ok) onSavedRef.current?.();
  }
  const flushRef = useRef(flush);
  useLayoutEffect(() => {
    flushRef.current = flush;
  });

  function queue(section: string, blocks: BlueprintBlock[]) {
    pending.current.set(section, blocks);
    setStatus("idle");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flushRef.current(), 1200);
  }

  // Leaving the issue, or closing the page, saves what's waiting.
  useEffect(() => {
    const onHide = () => void flushRef.current();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void flushRef.current();
    };
  }, []);

  const [active, setActive] = useState<Editor | null>(null);
  const issueEditor = useNewsletterEditor(issueDoc.content, "Write your issue…", {
    onChange: () => queueIssue(),
    onFocus: setActive,
  });
  const postEditor = useNewsletterEditor(postDoc?.content ?? { type: "doc", content: [{ type: "paragraph" }] }, "Write the post…", {
    onChange: () => {
      if (postEditor && postDoc && draft.post_key) queue(draft.post_key, docToBlocks(postEditor.getJSON(), { title: null, cover: null, kept: postDoc.kept }));
    },
    onFocus: setActive,
  });

  function queueIssue(next: Partial<{ title: string; cover: string | null }> = {}) {
    if (!issueEditor) return;
    const { title: t, cover: c } = { ...live.current, ...next };
    queue(draft.key, docToBlocks(issueEditor.getJSON(), { title: t, cover: c, kept: issueDoc.kept }));
  }

  const picture = usePicturePicker(getHeaders, (url) => {
    (active ?? issueEditor)?.chain().focus().setImage({ src: url }).run();
  });
  const coverPicker = usePicturePicker(getHeaders, (url) => {
    setCover(url);
    queueIssue({ cover: url });
  });
  const [coverMakerOpen, setCoverMakerOpen] = useState(false);
  // Everyone gets the cover window; its "Ava makes it" option is admins only for now.
  const [coverAva, setCoverAva] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getSessionUser();
      if (!user) return;
      const { role } = await fetchProfileRole(user.id);
      if (!cancelled) setCoverAva(role === "admin");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function setPublish(publish: NewsletterPublish | null) {
    setStatus("saving");
    try {
      const headers = await getHeaders();
      if (!headers) throw new Error();
      const res = await fetch("/api/coach/practice/build", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ section: draft.key, publish }),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
      onSavedRef.current?.();
    } catch {
      setStatus("error");
    }
  }

  // The issue with its formatting and pictures (for LinkedIn's editor), and plain text for anywhere else.
  const copyContent = () =>
    issueEditor
      ? {
          html: `<h1>${escapeHtml(live.current.title)}</h1>${issueEditor.getHTML()}`,
          text: `${live.current.title}\n\n${blocksToMarkdown(docToBlocks(issueEditor.getJSON(), { title: null, cover: null, kept: [] }), 2)}`,
        }
      : null;

  return (
    <>
      <div className="sticky top-[var(--nl-sticky-top,0px)] z-10 border-b border-slate-200 bg-white/95 backdrop-blur [&>*:first-child]:border-b-slate-100">
        <TopBar left={bar.left} right={bar.right}>
          <SaveNote status={status} />
        </TopBar>
        <FormatBar
          editor={active ?? issueEditor}
          onPicture={picture.open}
          uploading={picture.busy}
          trailing={
            <span className="flex items-center gap-1">
              <RichCopyButton getContent={copyContent} />
              {match ? (
                <a href={match.url} target="_blank" rel="noreferrer" title="Open on LinkedIn" aria-label="Open on LinkedIn" className={TOOL}>
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
              ) : null}
              <StatusMenu status={issueStatus} at={draft.publish?.at ?? match?.published_at ?? null} onChange={(p) => void setPublish(p)} />
            </span>
          }
        />
      </div>
      {picture.element}
      {coverPicker.element}
      <CoverMaker
        open={coverMakerOpen}
        onClose={() => setCoverMakerOpen(false)}
        getHeaders={getHeaders}
        issue={() => ({ title: live.current.title, text: issueEditor?.getText() ?? "" })}
        onUse={(url) => {
          setCover(url);
          queueIssue({ cover: url });
        }}
        onUpload={coverPicker.open}
        showAva={coverAva}
      />
      <div className={PAGE}>
        <Cover
          url={cover}
          busy={coverPicker.busy}
          onPick={() => setCoverMakerOpen(true)}
          onRemove={() => {
            setCover(null);
            queueIssue({ cover: null });
          }}
        />
        {coverPicker.error || picture.error ? <p className="-mt-6 mb-6 text-sm text-red-600">{coverPicker.error || picture.error}</p> : null}
        <TitleInput
          value={title}
          onChange={(value) => {
            setTitle(value);
            queueIssue({ title: value });
          }}
          onEnter={() => issueEditor?.chain().focus("start").run()}
        />
        <div className="nl-editor mt-8">
          <EditorContent editor={issueEditor} />
        </div>
        {postDoc ? (
          <section className="mt-14 border-t border-slate-200 pt-8">
            <h2 className="text-[1.375rem] font-medium leading-tight tracking-[-0.02em] text-slate-900">Post about this issue</h2>
            <p className="mt-1 text-sm text-slate-500">For the feed, so people open it.</p>
            <div className="nl-editor mt-5">
              <EditorContent editor={postEditor} />
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

/** An issue already on LinkedIn. Read only. */
function IssueView({ issue, getHeaders, bar }: { issue: NewsletterIssueItem; getHeaders: Headers; bar: Bar }) {
  const [blocks, setBlocks] = useState<BlueprintBlock[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const headers = await getHeaders();
        if (!headers) throw new Error();
        const res = await fetch(`/api/linkedin/history/issues/${encodeURIComponent(issue.id)}`, { headers });
        const body = (await res.json().catch(() => ({}))) as { blocks?: BlueprintBlock[] | null };
        if (!cancelled) {
          if (body.blocks?.length) setBlocks(body.blocks);
          else setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [issue, getHeaders]);

  return (
    <>
      <div className="sticky top-[var(--nl-sticky-top,0px)] z-10 bg-white/95 backdrop-blur">
        <TopBar left={bar.left} right={bar.right} />
      </div>
      <div className={PAGE}>
        <Cover url={issue.cover_url} busy={false} />
        <h1 className={TITLE}>{issue.topic || issue.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className={badgeClass("green")}>
            <CircleCheck className="h-3 w-3" aria-hidden />
            Published
          </span>
          <span className="text-sm tabular-nums text-slate-500">
            {formatDate(issue.published_at)} · {reach(issue)}
          </span>
          <span className="ml-auto flex gap-2">
            <CopyButton text={() => (blocks ? blocksToMarkdown(blocks, 2) : null)} />
            <a href={issue.url} target="_blank" rel="noreferrer" className={buttonClass("second", "small")}>
              Open on LinkedIn
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </span>
        </div>
        <div className="mt-8">
          {blocks ? (
            <Blocks blocks={blocks} />
          ) : failed ? (
            <p className="text-sm text-slate-500">The full text isn&apos;t here yet. Open it on LinkedIn to read it.</p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading the issue…
            </p>
          )}
        </div>
      </div>
    </>
  );
}

const GROUP_TONE: Record<Status, string> = {
  draft: "text-amber-600",
  scheduled: "text-sky-600",
  published: "text-emerald-600",
};

function rowClass(active: boolean) {
  return `block w-full rounded-[7px] py-2.5 pl-4 pr-2 text-left leading-snug transition ${
    active ? "bg-white text-[#0f172a] shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-[#334155] hover:bg-white/55 hover:text-[#0f172a]"
  }`;
}

function RowText({ item, active }: { item: Item; active: boolean }) {
  return (
    <>
      <span className={`line-clamp-2 text-sm ${active ? "font-semibold" : "font-medium"}`}>{item.title}</span>
      {item.date ? <span className="mt-0.5 block text-xs tabular-nums text-[#64748b]">{item.date}</span> : null}
    </>
  );
}

/** A draft in the queue: drag the grip (or use the arrow keys on it) to move it. */
function DraggableRow({ item, active, onPick }: { item: Item; active: boolean; onPick: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`group relative ${isDragging ? "rounded-[7px] shadow-lg" : ""}`}
    >
      <button
        type="button"
        aria-label={`Move "${item.title}"`}
        className="absolute left-0 top-2.5 z-[1] cursor-grab touch-none rounded p-0.5 text-[#94a3b8] opacity-0 transition-opacity hover:text-[#475569] focus-visible:opacity-100 active:cursor-grabbing group-hover:opacity-100"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button type="button" aria-current={active ? "page" : undefined} onClick={() => onPick(item.id)} className={rowClass(active)}>
        <RowText item={item} active={active} />
      </button>
    </li>
  );
}

/** Drafts, Scheduled or Published in the left list, drawn like the Blueprint sidebar: a small capitals label that folds. */
function ListGroup({
  status,
  label,
  items,
  selected,
  onPick,
  onReorder,
}: {
  status: Status;
  label: string;
  items: Item[];
  selected: string | null;
  onPick: (id: string) => void;
  /** Drafts only: the queue can be put in any order. Scheduled and Published sort by date. */
  onReorder?: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  if (!items.length) return null;
  const Icon = STATUS_LOOK[status].icon;
  const ids = items.map((item) => item.id);
  function onDragEnd(event: DragEndEvent) {
    const from = ids.indexOf(String(event.active.id));
    const to = event.over ? ids.indexOf(String(event.over.id)) : -1;
    if (from < 0 || to < 0 || from === to) return;
    onReorder?.(arrayMove(ids, from, to));
  }
  return (
    <div className="pt-3.5 first:pt-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-[7px] px-4 pb-1 pt-0.5 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-[#94a3b8] hover:text-[#64748b]"
      >
        <Icon className={`h-3 w-3 ${GROUP_TONE[status]}`} aria-hidden />
        {label}
        <span className="tabular-nums tracking-normal">{items.length}</span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden />
      </button>
      {open ? (
        onReorder && items.length > 1 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <DraggableRow key={item.id} item={item} active={item.id === selected} onPick={onPick} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" aria-current={item.id === selected ? "page" : undefined} onClick={() => onPick(item.id)} className={rowClass(item.id === selected)}>
                  <RowText item={item} active={item.id === selected} />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

export function NewsletterIssuesTab({
  history,
  loading,
  importing,
  onImport,
  getHeaders,
  openIssueId,
  onOpenIssue,
  blueprintHref,
  onDraftSaved,
}: {
  history: LinkedInHistoryPayload | null;
  loading: boolean;
  importing: boolean;
  onImport: () => void;
  getHeaders: Headers;
  /** An imported issue id, or "draft:" + Blueprint key. */
  openIssueId: string | null;
  onOpenIssue: (id: string | null) => void;
  /** Where the newsletter's name and call to action are set. Hidden when null. */
  blueprintHref: string | null;
  /** A draft was edited: fetch the list again so it shows the new text. */
  onDraftSaved?: () => void;
}) {
  const { drafts, scheduled, published } = useMemo(() => {
    const issues = history?.issues ?? [];
    const claimed = new Set<string>();
    const fromDrafts: Item[] = (history?.drafts ?? []).map((draft) => {
      // Out on LinkedIn already if an imported issue has the same title.
      const match = issues.find((issue) => !claimed.has(issue.id) && (sameTitle(issue.title, draft.title) || sameTitle(issue.topic ?? "", draft.title))) ?? null;
      if (match) claimed.add(match.id);
      const status: Status = draft.publish?.status ?? (match ? "published" : "draft");
      const at = draft.publish?.at ?? match?.published_at ?? null;
      return {
        id: `draft:${draft.key}`,
        kind: "draft" as const,
        status,
        title: draft.title,
        date: status === "scheduled" && at ? formatWhen(at) : status === "published" && at ? formatDate(at) : null,
        sortAt: status === "draft" ? draft.generated_at : at ?? draft.generated_at,
        draft,
        match,
      };
    });
    const imported: Item[] = issues
      .filter((issue) => !claimed.has(issue.id))
      .map((issue) => ({
        id: issue.id,
        kind: "issue" as const,
        status: "published" as const,
        title: issue.topic || issue.title,
        date: formatDate(issue.published_at),
        sortAt: issue.published_at,
        issue,
      }));
    return {
      drafts: fromDrafts.filter((item) => item.status === "draft"),
      scheduled: fromDrafts.filter((item) => item.status === "scheduled").sort((a, b) => a.sortAt.localeCompare(b.sortAt)),
      published: [...fromDrafts.filter((item) => item.status === "published"), ...imported].sort((a, b) => b.sortAt.localeCompare(a.sortAt)),
    };
  }, [history]);
  // The order just dropped, shown straight away until the saved list comes back with it.
  const [dropped, setDropped] = useState<{ ids: string[]; history: LinkedInHistoryPayload | null } | null>(null);
  const queue = useMemo(() => {
    if (!dropped || dropped.history !== history) return drafts;
    const at = (item: Item) => {
      const i = dropped.ids.indexOf(item.id);
      return i < 0 ? Infinity : i;
    };
    return [...drafts].sort((a, b) => at(a) - at(b));
  }, [drafts, dropped, history]);
  async function reorder(ids: string[]) {
    setDropped({ ids, history });
    try {
      const headers = await getHeaders();
      if (!headers) return;
      const res = await fetch("/api/coach/practice/build", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ order: ids.map((id) => id.replace(/^draft:/, "")) }),
      });
      if (res.ok) onDraftSaved?.();
    } catch {
      // The list shows the new order; it comes back as it was on the next load if this didn't save.
    }
  }
  const all = useMemo(() => [...queue, ...scheduled, ...published], [queue, scheduled, published]);
  // On a wide screen the first issue opens straight away; on a phone the list comes first.
  const selectedId = openIssueId && all.some((item) => item.id === openIssueId) ? openIssueId : all[0]?.id ?? null;
  const selected = all.find((item) => item.id === selectedId) ?? null;
  const index = selected ? all.indexOf(selected) : -1;

  if (loading && !history) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your newsletter…
      </div>
    );
  }

  const settings = history?.newsletter;
  const name = settings?.name || history?.issues.find((i) => i.newsletter_name)?.newsletter_name || "Your newsletter";
  const medianViews = median((history?.issues ?? []).filter((i) => i.impressions > 0).slice(0, 12).map((i) => i.impressions));
  const facts = [
    settings?.cadence ? CADENCE[settings.cadence] ?? null : null,
    medianViews != null ? `usually ${medianViews.toLocaleString("en-GB")} views` : null,
  ].filter(Boolean);
  const neverImported = Boolean(history?.connected && !history.last_import?.last_ok_at);

  const bar: Bar | null = selected
    ? {
        left: (
          <>
            <button
              type="button"
              onClick={() => onOpenIssue(null)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 md:hidden"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Issues
            </button>
            <p className="hidden min-w-0 items-center gap-2 text-sm md:flex">
              <span className="shrink-0 text-slate-500">Newsletter</span>
              <span className="select-none text-slate-300" aria-hidden>
                /
              </span>
              <span className="min-w-0 truncate font-semibold text-slate-900">{selected.title}</span>
            </p>
          </>
        ),
        right: (
          <span className="flex items-center gap-0.5">
            <button type="button" disabled={index <= 0} onClick={() => onOpenIssue(all[index - 1]!.id)} aria-label="Previous issue" className={TOOL}>
              <ChevronUp className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" disabled={index >= all.length - 1} onClick={() => onOpenIssue(all[index + 1]!.id)} aria-label="Next issue" className={TOOL}>
              <ChevronDown className="h-4 w-4" aria-hidden />
            </button>
          </span>
        ),
      }
    : null;

  return (
    // Edge to edge, as on a Blueprint page: flush to the sidebar and the header, no frame (Zander, 25 Nov 2026).
    <div className="bp-doc bp-clean -mx-4 flex min-h-[calc(100dvh-var(--nl-sticky-top,0px))] bg-white md:-mx-8 md:-mb-6">
      <aside
        className={`w-full shrink-0 border-r border-[var(--app-subnav-rule)] bg-[var(--app-subnav-bg)] md:block md:w-72 ${openIssueId ? "hidden" : "block"}`}
        aria-label="Newsletter issues"
      >
        <div className="border-b border-[var(--app-subnav-rule)] px-6 py-4">
          <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
          {facts.length ? <p className="mt-0.5 text-xs tabular-nums text-slate-500">{facts.join(" · ")}</p> : null}
          {blueprintHref ? (
            <Link href={blueprintHref} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--bp-blue)] hover:underline">
              Name and call to action
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
        <nav className="px-2 py-4">
          <ListGroup status="draft" label="Drafts" items={queue} selected={selectedId} onPick={onOpenIssue} onReorder={(ids) => void reorder(ids)} />
          <ListGroup status="scheduled" label="Scheduled" items={scheduled} selected={selectedId} onPick={onOpenIssue} />
          <ListGroup status="published" label="Published" items={published} selected={selectedId} onPick={onOpenIssue} />
          {neverImported ? (
            <div className="mx-1 mt-4 rounded-md bg-white/70 p-3">
              <p className="text-sm font-medium text-slate-900">Bring in your past issues</p>
              <p className="mt-0.5 text-xs text-slate-600">We read them from LinkedIn. Nothing is posted.</p>
              <button type="button" onClick={onImport} disabled={importing} className={buttonClass("second", "small", "mt-2")}>
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {importing ? "Importing…" : "Import from LinkedIn"}
              </button>
            </div>
          ) : null}
        </nav>
      </aside>

      <main className={`min-w-0 flex-1 md:block ${openIssueId ? "block" : "hidden"}`}>
        {selected && bar ? (
          selected.kind === "draft" ? (
            <DraftView
              key={selected.id}
              draft={selected.draft}
              status={selected.status}
              match={selected.match}
              getHeaders={getHeaders}
              onSaved={onDraftSaved}
              bar={bar}
            />
          ) : (
            <IssueView key={selected.id} issue={selected.issue} getHeaders={getHeaders} bar={bar} />
          )
        ) : (
          <div className="px-6 py-20 text-center">
            <Newspaper className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-800">No newsletter issues yet</p>
            <p className="mt-1 text-xs text-slate-500">Issues you publish on LinkedIn show up here, and so do the ones BCA writes for you.</p>
          </div>
        )}
      </main>
    </div>
  );
}
