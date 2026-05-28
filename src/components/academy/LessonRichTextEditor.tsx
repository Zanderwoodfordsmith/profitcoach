"use client";

import { useCallback, useEffect, useRef } from "react";
import { Bold, ChevronDown, Heading2, Link, List, ListOrdered, Palette } from "lucide-react";

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
        data-placeholder={placeholder}
        className={`min-h-[16rem] w-full rounded-lg border border-slate-100 bg-white px-1 py-2 outline-none focus:border-sky-200 focus:ring-2 focus:ring-sky-500/15 empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] ${academyProseClassName}`}
      />
    </div>
  );
}
