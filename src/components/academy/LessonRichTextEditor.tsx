"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Link,
  List,
  ListOrdered,
  Palette,
  Type,
} from "lucide-react";

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
import {
  applyLessonImgAlign,
  readLessonImgAlign,
  type LessonImgAlign,
} from "@/lib/academy/lessonImageDisplay";
import {
  uploadAcademyLessonImageFile,
  validateAcademyLessonImageFile,
} from "@/lib/academyLessonImage";

type Props = {
  markdown: string;
  onChange: (markdown: string) => void;
  courseId: string;
  lessonId: string;
  onTitleFromPaste?: (title: string) => void;
  onError?: (message: string) => void;
  placeholder?: string;
};

function imageFilesFromList(list: FileList | File[] | null | undefined): File[] {
  if (!list) return [];
  return Array.from(list).filter((file) => !("error" in validateAcademyLessonImageFile(file)));
}

export function LessonRichTextEditor({
  markdown,
  onChange,
  courseId,
  lessonId,
  onTitleFromPaste,
  onError,
  placeholder = "Write your lesson content, or paste from Google Docs…",
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const syncingFromProp = useRef(false);
  /** null until first sync so mount always hydrates from `markdown`. */
  const lastMarkdown = useRef<string | null>(null);

  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedDraft, setEmbedDraft] = useState("");
  const [editingEmbed, setEditingEmbed] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [imgAlign, setImgAlign] = useState<LessonImgAlign>("left");
  const [imgFrame, setImgFrame] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const editingEmbedRef = useRef<HTMLElement | null>(null);
  const savedRange = useRef<Range | null>(null);
  const headingMenuRef = useRef<HTMLDivElement>(null);
  const editorShellRef = useRef<HTMLDivElement>(null);
  const selectedImgRef = useRef<HTMLImageElement | null>(null);
  selectedImgRef.current = selectedImg;

  useEffect(() => {
    if (!headingMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!headingMenuRef.current?.contains(e.target as Node)) {
        setHeadingMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [headingMenuOpen]);

  const clearImageSelection = useCallback(() => {
    const prev = selectedImgRef.current;
    if (prev) prev.removeAttribute("data-lesson-img-selected");
    setSelectedImg(null);
    setImgFrame(null);
  }, []);

  const updateImageFrame = useCallback(() => {
    const img = selectedImgRef.current;
    const shell = editorShellRef.current;
    if (!img || !shell || !img.isConnected) {
      setImgFrame(null);
      return;
    }
    const shellRect = shell.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    setImgFrame({
      top: imgRect.top - shellRect.top + shell.scrollTop,
      left: imgRect.left - shellRect.left + shell.scrollLeft,
      width: imgRect.width,
      height: imgRect.height,
    });
  }, []);

  const selectImage = useCallback(
    (img: HTMLImageElement) => {
      const prev = selectedImgRef.current;
      if (prev && prev !== img) prev.removeAttribute("data-lesson-img-selected");
      img.setAttribute("data-lesson-img-selected", "true");
      setSelectedImg(img);
      setImgAlign(readLessonImgAlign(img));
      // Measure after paint so layout is current.
      requestAnimationFrame(() => {
        selectedImgRef.current = img;
        updateImageFrame();
      });
    },
    [updateImageFrame]
  );

  function setSelectedImageAlign(align: LessonImgAlign) {
    const img = selectedImgRef.current;
    if (!img) return;
    applyLessonImgAlign(img, align);
    setImgAlign(align);
    syncMarkdownFromHtml();
    requestAnimationFrame(() => updateImageFrame());
  }

  const syncHtmlFromMarkdown = useCallback(
    (md: string) => {
      const el = editorRef.current;
      if (!el) return;
      clearImageSelection();
      syncingFromProp.current = true;
      el.innerHTML = md.trim() ? markdownToHtml(md) : "";
      syncingFromProp.current = false;
      lastMarkdown.current = md;
    },
    [clearImageSelection]
  );

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

  function handleHeading(tag: "h1" | "h2" | "h3" | "p") {
    focusEditor();
    document.execCommand("formatBlock", false, tag);
    syncMarkdownFromHtml();
  }

  function handleLink() {
    const url = window.prompt("Link URL", "https://");
    if (!url?.trim()) return;
    exec("createLink", url.trim());
  }

  function placeCaretAfter(node: Node) {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    savedRange.current = range.cloneRange();
  }

  /** DOM insert — reliable after file-picker focus loss (execCommand often no-ops). */
  function insertImageAtSelection(url: string, alt: string) {
    const editor = editorRef.current;
    if (!editor) return;

    const img = document.createElement("img");
    img.src = url;
    img.alt = alt.trim() || "Image";

    const wrap = document.createElement("p");
    wrap.appendChild(img);

    const after = document.createElement("p");
    after.appendChild(document.createElement("br"));

    const range =
      savedRange.current && editor.contains(savedRange.current.commonAncestorContainer)
        ? savedRange.current
        : null;

    if (range) {
      range.deleteContents();
      range.insertNode(after);
      range.insertNode(wrap);
    } else {
      editor.appendChild(wrap);
      editor.appendChild(after);
    }

    placeCaretAfter(after);
    focusEditor();
    syncMarkdownFromHtml();
  }

  async function uploadAndInsertImages(files: File[]) {
    if (files.length === 0) return;
    onError?.("");
    // Prefer a range already captured (toolbar click / drop point); else current selection.
    if (
      !savedRange.current ||
      !editorRef.current?.contains(savedRange.current.commonAncestorContainer)
    ) {
      captureSelection();
    }
    setUploadingImage(true);
    try {
      for (const file of files) {
        const up = await uploadAcademyLessonImageFile(file, courseId, lessonId);
        if ("error" in up) {
          onError?.(up.error);
          break;
        }
        const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
        insertImageAtSelection(up.url, alt);
      }
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function openImagePicker() {
    captureSelection();
    imageInputRef.current?.click();
  }

  function handleImageInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = imageFilesFromList(e.target.files);
    if (files.length === 0) {
      onError?.("File must be an image (PNG, JPEG, GIF, WebP, or SVG).");
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }
    void uploadAndInsertImages(files);
  }

  function handleEditorDragEnter(e: React.DragEvent<HTMLDivElement>) {
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    setDragOver(true);
  }

  function handleEditorDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleEditorDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  }

  function rangeFromPoint(clientX: number, clientY: number): Range | null {
    if (typeof document.caretRangeFromPoint === "function") {
      return document.caretRangeFromPoint(clientX, clientY);
    }
    const pos = (
      document as Document & {
        caretPositionFromPoint?: (
          x: number,
          y: number
        ) => { offsetNode: Node; offset: number } | null;
      }
    ).caretPositionFromPoint?.(clientX, clientY);
    if (!pos) return null;
    const range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.collapse(true);
    return range;
  }

  function handleEditorDrop(e: React.DragEvent<HTMLDivElement>) {
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    setDragOver(false);
    const files = imageFilesFromList(e.dataTransfer.files);
    if (files.length === 0) {
      onError?.("Drop a PNG, JPEG, GIF, WebP, or SVG image.");
      return;
    }
    const editor = editorRef.current;
    const dropRange = rangeFromPoint(e.clientX, e.clientY);
    if (editor && dropRange && editor.contains(dropRange.commonAncestorContainer)) {
      savedRange.current = dropRange;
    } else {
      captureSelection();
    }
    void uploadAndInsertImages(files);
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
      clearImageSelection();
      openEditEmbed(block);
      return;
    }
    if (target instanceof HTMLImageElement && editorRef.current?.contains(target)) {
      e.preventDefault();
      selectImage(target);
      return;
    }
    clearImageSelection();
  }

  function beginImageResize(
    corner: "nw" | "ne" | "sw" | "se",
    e: React.PointerEvent<HTMLSpanElement>
  ) {
    const img = selectedImgRef.current;
    if (!img) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = img.getBoundingClientRect().width;
    const editorWidth = editorRef.current?.clientWidth ?? startWidth;
    const maxWidth = Math.max(120, editorWidth - 8);
    const sign = corner === "ne" || corner === "se" ? 1 : -1;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) * sign;
      const next = Math.min(maxWidth, Math.max(80, Math.round(startWidth + dx)));
      img.style.width = `${next}px`;
      img.style.height = "auto";
      img.setAttribute("width", String(next));
      img.removeAttribute("height");
      updateImageFrame();
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      syncMarkdownFromHtml();
      updateImageFrame();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  useEffect(() => {
    if (!selectedImg) return;
    updateImageFrame();
    const onReposition = () => updateImageFrame();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [selectedImg, updateImageFrame]);

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const imageFiles = imageFilesFromList(e.clipboardData.files);
    if (imageFiles.length > 0) {
      e.preventDefault();
      void uploadAndInsertImages(imageFiles);
      return;
    }

    // Some browsers expose screenshot pastes via items instead of files.
    const itemFiles: File[] = [];
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (file && !("error" in validateAcademyLessonImageFile(file))) {
        itemFiles.push(file);
      }
    }
    if (itemFiles.length > 0) {
      e.preventDefault();
      void uploadAndInsertImages(itemFiles);
      return;
    }

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

  const toolbarBtnClass =
    "inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-200/80 hover:bg-white hover:text-slate-800 hover:shadow-sm";

  const headingOptions: Array<{
    tag: "h1" | "h2" | "h3" | "p";
    label: string;
    hint: string;
    icon: typeof Heading1;
  }> = [
    { tag: "h1", label: "Title", hint: "Heading 1", icon: Heading1 },
    { tag: "h2", label: "Heading", hint: "Heading 2", icon: Heading2 },
    { tag: "h3", label: "Subheading", hint: "Heading 3", icon: Heading3 },
    { tag: "p", label: "Body", hint: "Normal text", icon: Type },
  ];

  return (
    <div>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
        <div
          role="toolbar"
          aria-label="Formatting"
          className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-slate-200 bg-slate-50/95 px-2 py-1.5 backdrop-blur-sm"
        >
          <button
            type="button"
            title="Bold"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("bold")}
            className={toolbarBtnClass}
          >
            <Bold className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Bold</span>
          </button>
          <div className="relative" ref={headingMenuRef}>
            <button
              type="button"
              title="Headings"
              aria-expanded={headingMenuOpen}
              aria-haspopup="menu"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setHeadingMenuOpen((open) => !open)}
              className={toolbarBtnClass}
            >
              <Heading2 className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Heading</span>
              <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
            </button>
            {headingMenuOpen ? (
              <div
                role="menu"
                className="absolute left-0 top-full z-30 mt-1 min-w-[10.5rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              >
                {headingOptions.map(({ tag, label, hint, icon: Icon }) => (
                  <button
                    key={tag}
                    type="button"
                    role="menuitem"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      handleHeading(tag);
                      setHeadingMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                    <span className="font-medium">{label}</span>
                    <span className="ml-auto text-[10px] text-slate-400">{hint}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            title="Bullet list"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("insertUnorderedList")}
            className={toolbarBtnClass}
          >
            <List className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">List</span>
          </button>
          <button
            type="button"
            title="Numbered list"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("insertOrderedList")}
            className={toolbarBtnClass}
          >
            <ListOrdered className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Numbered</span>
          </button>
          <button
            type="button"
            title="Link"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleLink}
            className={toolbarBtnClass}
          >
            <Link className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Link</span>
          </button>
          <button
            type="button"
            title="Insert image"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openImagePicker}
            disabled={uploadingImage}
            className={`${toolbarBtnClass} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">
              {uploadingImage ? "Uploading…" : "Image"}
            </span>
          </button>
          <button
            type="button"
            title="Insert collapsible accordion section"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleInsertAccordion}
            className={toolbarBtnClass}
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Accordion</span>
          </button>
          <button
            type="button"
            title="Embed HTML (interactive widget)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openInsertEmbed}
            className={toolbarBtnClass}
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
                className="h-6 w-6 rounded-full border border-slate-200 bg-white shadow-sm transition hover:scale-110 hover:border-slate-300"
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

        <div className="relative" ref={editorShellRef}>
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
            onDragEnter={handleEditorDragEnter}
            onDragOver={handleEditorDragOver}
            onDragLeave={handleEditorDragLeave}
            onDrop={handleEditorDrop}
            data-placeholder={placeholder}
            className={`lesson-rich-editor min-h-[16rem] w-full bg-white px-3.5 py-3 outline-none transition focus-visible:bg-sky-50/20 empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] md:px-4 md:py-3.5 ${
              dragOver ? "bg-sky-50/70 ring-2 ring-inset ring-sky-300" : ""
            } ${academyProseClassName}`}
          />
          {selectedImg && imgFrame ? (
            <>
              <div
                className="pointer-events-none absolute z-20"
                style={{
                  top: imgFrame.top,
                  left: imgFrame.left,
                  width: imgFrame.width,
                  height: imgFrame.height,
                }}
              >
                <div className="absolute inset-0 rounded-lg ring-2 ring-sky-500" />
                {(
                  [
                    ["nw", "-left-1.5 -top-1.5 cursor-nwse-resize"],
                    ["ne", "-right-1.5 -top-1.5 cursor-nesw-resize"],
                    ["sw", "-bottom-1.5 -left-1.5 cursor-nesw-resize"],
                    ["se", "-bottom-1.5 -right-1.5 cursor-nwse-resize"],
                  ] as const
                ).map(([corner, posClass]) => (
                  <span
                    key={corner}
                    role="presentation"
                    onPointerDown={(ev) => beginImageResize(corner, ev)}
                    className={`pointer-events-auto absolute h-3 w-3 rounded-sm border-2 border-sky-500 bg-white shadow-sm ${posClass}`}
                  />
                ))}
              </div>
              <div
                role="toolbar"
                aria-label="Image alignment"
                className="pointer-events-auto absolute z-30 flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-md"
                style={{
                  top: Math.max(4, imgFrame.top - 40),
                  left: imgFrame.left + imgFrame.width / 2,
                  transform: "translateX(-50%)",
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                {(
                  [
                    ["left", AlignLeft, "Align left"],
                    ["center", AlignCenter, "Align centre"],
                    ["right", AlignRight, "Align right"],
                  ] as const
                ).map(([align, Icon, label]) => (
                  <button
                    key={align}
                    type="button"
                    title={label}
                    aria-label={label}
                    aria-pressed={imgAlign === align}
                    onClick={() => setSelectedImageAlign(align)}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition ${
                      imgAlign === align
                        ? "bg-sky-100 text-sky-700"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {uploadingImage ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm font-medium text-slate-600">
              Uploading image…
            </div>
          ) : null}
          {dragOver && !uploadingImage ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-sky-50/80 text-sm font-medium text-sky-800">
              Drop image to upload
            </div>
          ) : null}
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.png,.jpg,.jpeg,.gif,.webp,.svg"
        multiple
        className="sr-only"
        onChange={handleImageInputChange}
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
