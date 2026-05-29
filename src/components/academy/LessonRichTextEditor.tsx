"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bold, ChevronDown, Code2, Heading2, Link, List, ListOrdered, Palette } from "lucide-react";

import { academyProseClassName } from "@/components/academy/academyProseClassName";
import { clipboardToLessonMarkdown } from "@/lib/academy/htmlToLessonMarkdown";
import { splitTitleFromImportedMarkdown } from "@/lib/academy/importLessonMarkdown";
import { htmlToLessonMarkdown } from "@/lib/academy/htmlToLessonMarkdown";
import {
  applyAccordionColor,
  lessonAccordionHtml,
  LESSON_ACCORDION_CLASS,
  LESSON_ACCORDION_COLORS,
  type LessonAccordionColorId,
} from "@/lib/academy/lessonAccordion";
import {
  LESSON_EMBED_ATTR,
  LESSON_EMBED_BLOCK_CLASS,
  embedPlaceholderHtml,
} from "@/lib/academy/lessonHtmlEmbed";
import { LESSON_TEXT_COLORS } from "@/lib/academy/lessonTextColor";
import { markdownToHtml } from "@/lib/academy/markdownToHtml";

type Props = {
  markdown: string;
  onChange: (markdown: string) => void;
  onTitleFromPaste?: (title: string) => void;
  placeholder?: string;
};

export function LessonRichTextEditor({
  markdown,
  onChange,
  onTitleFromPaste,
  placeholder = "Write your lesson content, or paste from Google Docs…",
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const syncingFromProp = useRef(false);
  /** null until first sync so mount always hydrates from `markdown`. */
  const lastMarkdown = useRef<string | null>(null);

  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedDraft, setEmbedDraft] = useState("");
  const [editingEmbed, setEditingEmbed] = useState(false);
  const editingEmbedRef = useRef<HTMLElement | null>(null);
  const savedRange = useRef<Range | null>(null);

  const syncHtmlFromMarkdown = useCallback((md: string) => {
    const el = editorRef.current;
    if (!el) return;
    syncingFromProp.current = true;
    el.innerHTML = md.trim() ? markdownToHtml(md) : "";
    syncingFromProp.current = false;
    lastMarkdown.current = md;
  }, []);

  useEffect(() => {
    if (markdown === lastMarkdown.current) return;
    syncHtmlFromMarkdown(markdown);
  }, [markdown, syncHtmlFromMarkdown]);

  function syncMarkdownFromHtml() {
    if (syncingFromProp.current || !editorRef.current) return;
    const md = htmlToLessonMarkdown(editorRef.current.innerHTML);
    lastMarkdown.current = md;
    onChange(md);
  }

  function focusEditor() {
    editorRef.current?.focus();
  }

  function exec(cmd: string, value?: string) {
    focusEditor();
    document.execCommand(cmd, false, value);
    syncMarkdownFromHtml();
  }

  function handleHeading() {
    focusEditor();
    document.execCommand("formatBlock", false, "h3");
    syncMarkdownFromHtml();
  }

  function handleLink() {
    const url = window.prompt("Link URL", "https://");
    if (!url?.trim()) return;
    exec("createLink", url.trim());
  }

  function handleTextColor(color: string) {
    focusEditor();
    document.execCommand("foreColor", false, color);
    syncMarkdownFromHtml();
  }

  function getAccordionAtSelection(): HTMLDetailsElement | null {
    const sel = window.getSelection();
    if (!sel?.anchorNode || !editorRef.current) return null;
    let node: Node | null = sel.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node && node !== editorRef.current) {
      if (
        node instanceof HTMLDetailsElement &&
        node.classList.contains(LESSON_ACCORDION_CLASS)
      ) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  function handleInsertAccordion() {
    focusEditor();
    const html = lessonAccordionHtml("Section title", "<p>Type your content here…</p>", "sky");
    document.execCommand("insertHTML", false, html);
    syncMarkdownFromHtml();
  }

  function handleAccordionColor(colorId: LessonAccordionColorId) {
    const accordion = getAccordionAtSelection();
    if (!accordion) {
      window.alert("Click inside an accordion section first, or insert one with the Accordion button.");
      return;
    }
    applyAccordionColor(accordion, colorId);
    syncMarkdownFromHtml();
  }

  function handleAccordionCustomColor(background: string) {
    const accordion = getAccordionAtSelection();
    if (!accordion) {
      window.alert("Click inside an accordion section first, or insert one with the Accordion button.");
      return;
    }
    applyAccordionColor(accordion, "custom", { background });
    syncMarkdownFromHtml();
  }

  function captureSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    } else {
      savedRange.current = null;
    }
  }

  function openInsertEmbed() {
    captureSelection();
    editingEmbedRef.current = null;
    setEditingEmbed(false);
    setEmbedDraft("");
    setEmbedOpen(true);
  }

  function openEditEmbed(el: HTMLElement) {
    editingEmbedRef.current = el;
    setEditingEmbed(true);
    setEmbedDraft(el.getAttribute(LESSON_EMBED_ATTR) ?? "");
    setEmbedOpen(true);
  }

  function closeEmbed() {
    setEmbedOpen(false);
    setEmbedDraft("");
    setEditingEmbed(false);
    editingEmbedRef.current = null;
    savedRange.current = null;
  }

  function insertEmbedNode(html: string) {
    const editor = editorRef.current;
    if (!editor) return;
    const temp = document.createElement("div");
    temp.innerHTML = embedPlaceholderHtml(html);
    const node = temp.firstElementChild;
    if (!node) return;

    const range = savedRange.current;
    if (range && editor.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      range.insertNode(node);
    } else {
      editor.appendChild(node);
    }
    // Trailing paragraph so the caret isn't trapped after a block embed.
    const after = document.createElement("p");
    after.innerHTML = "<br>";
    node.parentNode?.insertBefore(after, node.nextSibling);
  }

  function saveEmbed() {
    const editor = editorRef.current;
    const html = embedDraft.trim();
    if (!editor) {
      closeEmbed();
      return;
    }
    if (!html) {
      editingEmbedRef.current?.remove();
      syncMarkdownFromHtml();
      closeEmbed();
      return;
    }
    if (editingEmbedRef.current) {
      editingEmbedRef.current.outerHTML = embedPlaceholderHtml(html);
    } else {
      insertEmbedNode(html);
    }
    syncMarkdownFromHtml();
    closeEmbed();
  }

  function removeEmbed() {
    editingEmbedRef.current?.remove();
    syncMarkdownFromHtml();
    closeEmbed();
  }

  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const block = target.closest(`.${LESSON_EMBED_BLOCK_CLASS}`);
    if (block instanceof HTMLElement && editorRef.current?.contains(block)) {
      e.preventDefault();
      openEditEmbed(block);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const html = e.clipboardData.getData("text/html");
    const plain = e.clipboardData.getData("text/plain");
    const converted = clipboardToLessonMarkdown(html, plain);

    if (converted) {
      e.preventDefault();
      const { title: importedTitle, body } = splitTitleFromImportedMarkdown(converted);
      const insertHtml = markdownToHtml(body);
      focusEditor();
      document.execCommand("insertHTML", false, insertHtml);
      syncMarkdownFromHtml();
      if (importedTitle && onTitleFromPaste) {
        onTitleFromPaste(importedTitle);
      }
      return;
    }

    // Rich HTML from Google Docs: let the browser paste, then convert on input
    const hasRichHtml = html.trim() && /<[a-z][\s\S]*>/i.test(html);
    if (!hasRichHtml) return;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <button
          type="button"
          title="Bold"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("bold")}
          className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-200 hover:bg-slate-50"
        >
          <Bold className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Bold</span>
        </button>
        <button
          type="button"
          title="Heading"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleHeading}
          className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-200 hover:bg-slate-50"
        >
          <Heading2 className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Heading</span>
        </button>
        <button
          type="button"
          title="Bullet list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertUnorderedList")}
          className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-200 hover:bg-slate-50"
        >
          <List className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">List</span>
        </button>
        <button
          type="button"
          title="Numbered list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertOrderedList")}
          className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-200 hover:bg-slate-50"
        >
          <ListOrdered className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Numbered</span>
        </button>
        <button
          type="button"
          title="Link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleLink}
          className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-200 hover:bg-slate-50"
        >
          <Link className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Link</span>
        </button>
        <button
          type="button"
          title="Insert collapsible accordion section"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleInsertAccordion}
          className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-200 hover:bg-slate-50"
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Accordion</span>
        </button>
        <button
          type="button"
          title="Embed HTML (interactive widget)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={openInsertEmbed}
          className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-200 hover:bg-slate-50"
        >
          <Code2 className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Embed</span>
        </button>

        <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:inline" aria-hidden />

        <div className="flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 px-1 text-xs font-medium text-slate-500">
            <Palette className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Colour</span>
          </span>
          {LESSON_TEXT_COLORS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              title={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleTextColor(value)}
              className="h-6 w-6 rounded-full border border-slate-200 shadow-sm transition hover:scale-110 hover:border-slate-300"
              style={{ backgroundColor: value }}
              aria-label={`Text colour: ${label}`}
            />
          ))}
          <label
            title="Custom colour"
            className="relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-slate-300 bg-white text-[10px] font-semibold text-slate-500 hover:border-slate-400"
          >
            +
            <input
              type="color"
              className="absolute inset-0 cursor-pointer opacity-0"
              defaultValue="#0284c7"
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => handleTextColor(e.target.value)}
              aria-label="Custom text colour"
            />
          </label>
        </div>

        <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:inline" aria-hidden />

        <div className="flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 px-1 text-xs font-medium text-slate-500">
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Accordion colour</span>
          </span>
          {LESSON_ACCORDION_COLORS.map(({ id, label, background, border }) => (
            <button
              key={id}
              type="button"
              title={`${label} (click inside accordion first)`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleAccordionColor(id)}
              className="h-6 w-6 rounded-md border-2 shadow-sm transition hover:scale-110"
              style={{ backgroundColor: background, borderColor: border }}
              aria-label={`Accordion colour: ${label}`}
            />
          ))}
          <label
            title="Custom accordion background (click inside accordion first)"
            className="relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-slate-300 bg-white text-[10px] font-semibold text-slate-500 hover:border-slate-400"
          >
            +
            <input
              type="color"
              className="absolute inset-0 cursor-pointer opacity-0"
              defaultValue="#e0f2fe"
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => handleAccordionCustomColor(e.target.value)}
              aria-label="Custom accordion background colour"
            />
          </label>
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-label="Lesson content"
        onInput={syncMarkdownFromHtml}
        onBlur={syncMarkdownFromHtml}
        onPaste={handlePaste}
        onClick={handleEditorClick}
        data-placeholder={placeholder}
        className={`min-h-[16rem] w-full rounded-lg border border-slate-100 bg-white px-1 py-2 outline-none focus:border-sky-200 focus:ring-2 focus:ring-sky-500/15 empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] ${academyProseClassName}`}
      />

      {embedOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Embed HTML"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeEmbed();
          }}
        >
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editingEmbed ? "Edit HTML embed" : "Embed HTML"}
              </h3>
              <button
                type="button"
                onClick={closeEmbed}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="mb-2 text-xs text-slate-500">
                Paste a self-contained HTML snippet (it can include its own{" "}
                <code className="rounded bg-slate-100 px-1">&lt;style&gt;</code> and{" "}
                <code className="rounded bg-slate-100 px-1">&lt;script&gt;</code>). Coaches see it
                rendered in a sandboxed frame.
              </p>
              <textarea
                value={embedDraft}
                onChange={(e) => setEmbedDraft(e.target.value)}
                autoFocus
                spellCheck={false}
                placeholder={'<div id="app"></div>\n<script>/* your widget */</script>'}
                className="h-72 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-500/15"
              />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              <span className="text-xs text-slate-400">
                {embedDraft.trim().length} characters
              </span>
              <div className="flex items-center gap-2">
                {editingEmbed ? (
                  <button
                    type="button"
                    onClick={removeEmbed}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                  >
                    Remove embed
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={saveEmbed}
                  className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
                >
                  {editingEmbed ? "Update" : "Insert"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
