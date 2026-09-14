"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Braces } from "lucide-react";
import {
  MERGE_FIELD_CATALOG,
  mergeToken,
  tokenizeMergeFields,
  type MergeFieldGroup,
  type MergeSegment,
} from "@/lib/unipile/mergeFields";

const GROUPS: MergeFieldGroup[] = ["Prospect", "You", "Scorecard"];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function chipClass(kind: "field" | "unknown", size: "editor" | "preview") {
  const pad = size === "preview" ? "px-1 py-0.5" : "px-1.5 py-0.5";
  if (kind === "unknown") {
    return `inline-flex items-baseline whitespace-nowrap rounded-md bg-rose-200 font-semibold text-rose-950 ${pad}`;
  }
  return `inline-flex items-baseline whitespace-nowrap rounded-md bg-sky-200 font-semibold text-sky-950 ${pad}`;
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
  const menuRef = useRef<HTMLDivElement>(null);
  const emitted = useRef(value);
  const [open, setOpen] = useState(false);

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
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function emit() {
    const el = editorRef.current;
    if (!el) return;
    const next = serializeEditor(el);
    if (next === emitted.current) return;
    emitted.current = next;
    onChange(next);
  }

  function insert(key: string) {
    const el = editorRef.current;
    el?.focus();
    const html = segmentsToHtml(
      [{ kind: "field", value: mergeToken(key), field: MERGE_FIELD_CATALOG.find((f) => f.key === key)! }],
      "editor"
    );
    document.execCommand("insertHTML", false, html);
    emit();
    setOpen(false);
  }

  return (
    <div>
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={() => {
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
        className="min-h-[8.5rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[15px] leading-relaxed text-slate-800 outline-none focus:border-[#0c5290] empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
      />
      <div ref={menuRef} className="relative mt-1.5 flex items-center">
        <button
          type="button"
          aria-label="Insert variable"
          aria-expanded={open}
          aria-haspopup="menu"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50 hover:text-[#0c5290] ${
            open ? "bg-slate-50 text-[#0c5290]" : ""
          }`}
        >
          <Braces className="h-4 w-4" aria-hidden />
        </button>
        {open ? (
          <div
            role="menu"
            className="absolute bottom-8 left-0 z-30 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
          >
            {GROUPS.map((group) => {
              const items = MERGE_FIELD_CATALOG.filter((f) => f.group === group);
              if (!items.length) return null;
              return (
                <div key={group} className="py-1">
                  <p className="px-3 py-1 text-[11px] font-medium text-slate-400">
                    {group}
                  </p>
                  {items.map((field) => (
                    <button
                      key={field.key}
                      type="button"
                      role="menuitem"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insert(field.key)}
                      className="flex w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {field.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
