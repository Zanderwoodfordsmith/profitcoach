"use client";

import { useCallback, useEffect, useRef } from "react";
import { Bold, Heading2, Link, List, ListOrdered } from "lucide-react";

import { academyProseClassName } from "@/components/academy/academyProseClassName";
import { clipboardToLessonMarkdown } from "@/lib/academy/htmlToLessonMarkdown";
import { splitTitleFromImportedMarkdown } from "@/lib/academy/importLessonMarkdown";
import { htmlToLessonMarkdown } from "@/lib/academy/htmlToLessonMarkdown";
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
  const lastMarkdown = useRef(markdown);

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
