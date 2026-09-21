"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  MERGE_FIELD_CATALOG,
  mergeToken,
  tokenizeMergeFields,
  type MergeField,
  type MergeSegment,
} from "@/lib/unipile/mergeFields";

const MERGE_DRAG_PREFIX = "pc-merge:";

let activeMergeDragKey: string | null = null;

/** True while a merge-field chip is being dragged — sequence drop zones should ignore it. */
export function isMergeFieldDrag(): boolean {
  return activeMergeDragKey != null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function chipClass(kind: "field" | "unknown", size: "editor" | "preview") {
  if (size === "preview") {
    if (kind === "unknown") {
      return "font-medium text-rose-700";
    }
    return "font-medium text-[#0c5290]";
  }
  if (kind === "unknown") {
    return "inline-flex items-baseline whitespace-nowrap rounded-md bg-rose-200 px-1.5 py-0.5 font-semibold text-rose-950";
  }
  return "inline-flex items-baseline whitespace-nowrap rounded-md bg-sky-200 px-1.5 py-0.5 font-semibold text-sky-950";
}

function segmentsToHtml(segments: MergeSegment[], size: "editor" | "preview") {
  return segments
    .map((seg) => {
      if (seg.kind === "text") return escapeHtml(seg.value);
      if (seg.kind === "unknown") {
        return `<span contenteditable="false" data-merge-unknown="${escapeHtml(
          seg.key
        )}" class="${chipClass("unknown", size)}" title="Unknown variable">${escapeHtml(
          seg.key.replaceAll("_", " ")
        )}</span>`;
      }
      return `<span contenteditable="false" data-merge-key="${escapeHtml(
        seg.field.key
      )}" class="${chipClass("field", size)}">${escapeHtml(seg.field.label)}</span>`;
    })
    .join("");
}

function serializeEditor(root: HTMLElement): string {
  let out = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const key = node.getAttribute("data-merge-key");
    if (key) {
      out += mergeToken(key);
      return;
    }
    const unknown = node.getAttribute("data-merge-unknown");
    if (unknown) {
      out += mergeToken(unknown);
      return;
    }
    if (node.tagName === "BR") {
      out += "\n";
      return;
    }
    node.childNodes.forEach(walk);
    if (node.tagName === "DIV" && node !== root) out += "\n";
  };
  root.childNodes.forEach(walk);
  return out.replace(/\n+$/g, "");
}

function FieldChip({
  segment,
  size,
}: {
  segment: Extract<MergeSegment, { kind: "field" | "unknown" }>;
  size: "editor" | "preview";
}) {
  if (segment.kind === "unknown") {
    return (
      <span
        title={`Unknown variable “${segment.key}”. Pick one from the list.`}
        className={chipClass("unknown", size)}
      >
        {segment.key.replaceAll("_", " ")}
      </span>
    );
  }
  return (
    <span title={segment.field.label} className={chipClass("field", size)}>
      {segment.field.label}
    </span>
  );
}

export function MergeFieldPreview({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const segments = useMemo(() => tokenizeMergeFields(text), [text]);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <FieldChip key={i} segment={seg} size="preview" />
        )
      )}
    </span>
  );
}

function placeCaretFromPoint(
  editor: HTMLElement,
  x: number,
  y: number
): boolean {
  const hit = document.elementFromPoint(x, y);
  if (!hit || !editor.contains(hit)) return false;

  const chip = hit.closest<HTMLElement>(
    "[data-merge-key], [data-merge-unknown]"
  );
  if (chip && editor.contains(chip)) {
    const rect = chip.getBoundingClientRect();
    const range = document.createRange();
    if (x < rect.left + rect.width / 2) range.setStartBefore(chip);
    else range.setStartAfter(chip);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    return true;
  }

  const anyDoc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number
    ) => { offsetNode: Node; offset: number } | null;
  };

  let range: Range | null = null;
  if (typeof anyDoc.caretRangeFromPoint === "function") {
    range = anyDoc.caretRangeFromPoint(x, y);
  } else if (typeof anyDoc.caretPositionFromPoint === "function") {
    const pos = anyDoc.caretPositionFromPoint(x, y);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }
  if (!range || !editor.contains(range.startContainer)) {
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
  }
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  return true;
}

function mergeKeyFromDrag(data: DataTransfer): string | null {
  const raw = data.getData("text/plain") || data.getData("text");
  if (raw.startsWith(MERGE_DRAG_PREFIX)) {
    return raw.slice(MERGE_DRAG_PREFIX.length);
  }
  return activeMergeDragKey;
}

function InsertChip({
  field,
  onInsert,
  tabbable,
}: {
  field: MergeField;
  onInsert: (key: string) => void;
  tabbable: boolean;
}) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  function showTip(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    setTip({ x: rect.left + rect.width / 2, y: rect.top });
  }

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        draggable
        tabIndex={tabbable ? 0 : -1}
        aria-label={`Insert ${field.label}. ${field.hint}. Example: ${field.example}. Click to insert, or drag into the message.`}
        onPointerEnter={(event) => showTip(event.currentTarget)}
        onPointerLeave={() => setTip(null)}
        onFocus={(event) => showTip(event.currentTarget)}
        onBlur={() => setTip(null)}
        onDragStart={(event) => {
          setTip(null);
          activeMergeDragKey = field.key;
          event.dataTransfer.setData(
            "text/plain",
            `${MERGE_DRAG_PREFIX}${field.key}`
          );
          event.dataTransfer.effectAllowed = "copy";
          event.stopPropagation();
        }}
        onDragEnd={() => {
          activeMergeDragKey = null;
        }}
        onClick={() => onInsert(field.key)}
        className="inline-flex shrink-0 cursor-grab select-none items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-[#0c5290] transition duration-150 hover:border-sky-300 hover:bg-sky-50 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c5290]/40"
      >
        {field.label}
      </button>
      {tip ? (
        <span
          role="tooltip"
          className="pointer-events-none fixed z-50 w-max max-w-[16rem] -translate-x-1/2 -translate-y-full rounded-md bg-slate-900 px-2.5 py-1.5 text-left shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
          style={{ left: tip.x, top: tip.y - 8 }}
        >
          <span className="block text-[12px] font-medium leading-snug text-white">
            {field.hint}
          </span>
          <span className="mt-0.5 block text-[11px] font-normal leading-snug text-sky-200">
            e.g. {field.example}
          </span>
          <span className="mt-1 block text-[11px] font-normal leading-snug text-slate-300">
            Click to insert, or drag into the message
          </span>
        </span>
      ) : null}
    </span>
  );
}

export function MergeFieldComposer({
  value,
  onChange,
  onCommit,
  placeholder = "Hi First name…",
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  onCommit: () => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const ignoreBlur = useRef(false);
  const emitted = useRef(value);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value === emitted.current && el.innerHTML) return;
    emitted.current = value;
    el.innerHTML = value
      ? segmentsToHtml(tokenizeMergeFields(value), "editor")
      : "";
  }, [value]);

  useEffect(() => {
    function onSel() {
      const el = editorRef.current;
      if (!el || document.activeElement !== el) return;
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (el.contains(range.commonAncestorContainer)) {
        savedRange.current = range.cloneRange();
      }
    }
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  function emit() {
    const el = editorRef.current;
    if (!el) return;
    const next = serializeEditor(el);
    if (next === emitted.current) return;
    emitted.current = next;
    onChange(next);
  }

  function restoreCaret() {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    const saved = savedRange.current;
    if (saved) {
      try {
        if (el.contains(saved.commonAncestorContainer)) {
          sel?.removeAllRanges();
          sel?.addRange(saved);
          return;
        }
      } catch {
        /* range detached after a re-render */
      }
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function insert(key: string, atPoint?: { x: number; y: number }) {
    const field = MERGE_FIELD_CATALOG.find((item) => item.key === key);
    const el = editorRef.current;
    if (!field || !el) return;
    el.focus();
    if (atPoint) {
      placeCaretFromPoint(el, atPoint.x, atPoint.y);
    } else {
      restoreCaret();
    }
    const html = segmentsToHtml(
      [{ kind: "field", value: mergeToken(key), field }],
      "editor"
    );
    document.execCommand("insertHTML", false, html);
    emit();
    const sel = window.getSelection();
    if (sel?.rangeCount) savedRange.current = sel.getRangeAt(0).cloneRange();
  }

  function onEditorDragOver(event: React.DragEvent) {
    if (!isMergeFieldDrag()) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    const el = editorRef.current;
    if (el) placeCaretFromPoint(el, event.clientX, event.clientY);
  }

  function onEditorDrop(event: React.DragEvent) {
    const key = mergeKeyFromDrag(event.dataTransfer);
    if (!key) return;
    event.preventDefault();
    event.stopPropagation();
    insert(key, { x: event.clientX, y: event.clientY });
    activeMergeDragKey = null;
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:border-[#0c5290]"
      onDragOver={(event) => {
        if (!isMergeFieldDrag()) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        if (!isMergeFieldDrag() && !mergeKeyFromDrag(event.dataTransfer)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onDragOver={onEditorDragOver}
        onDrop={onEditorDrop}
        onBlur={() => {
          if (ignoreBlur.current) {
            ignoreBlur.current = false;
            return;
          }
          const el = editorRef.current;
          if (el) {
            const next = serializeEditor(el);
            emitted.current = next;
            onChange(next);
            el.innerHTML = next
              ? segmentsToHtml(tokenizeMergeFields(next), "editor")
              : "";
          }
          onCommit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            document.execCommand("insertLineBreak");
            emit();
          }
        }}
        className="min-h-[8.5rem] w-full bg-white px-3 py-2.5 text-[15px] leading-relaxed text-slate-800 outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
      />
      <div
        className="flex items-stretch border-t border-slate-200 bg-slate-100"
        onPointerDown={() => {
          ignoreBlur.current = true;
        }}
      >
        <div className="relative min-w-0 flex-1">
          <div
            className={
              expanded
                ? "flex flex-wrap gap-1 p-1.5"
                : "flex flex-nowrap gap-1 overflow-hidden p-1.5"
            }
          >
            {MERGE_FIELD_CATALOG.map((field) => (
              <InsertChip
                key={field.key}
                field={field}
                tabbable={expanded}
                onInsert={insert}
              />
            ))}
          </div>
        </div>
        <div className="relative z-10 flex shrink-0 self-stretch items-start bg-slate-100">
          {expanded ? null : (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-full w-7 bg-gradient-to-l from-slate-100 from-30% to-transparent"
            />
          )}
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            className="flex items-center gap-0.5 px-2 py-1.5 text-xs font-medium text-slate-800 transition duration-150 hover:bg-slate-200 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0c5290]/40"
          >
            {expanded ? "See less" : "See more"}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                expanded ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>
        </div>
      </div>
    </div>
  );
}
