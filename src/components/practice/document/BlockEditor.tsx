"use client";

import { useState, type ReactNode } from "react";

import type { BlueprintBlock } from "@/lib/practiceKnowledge/types";

const FIELD =
  "w-full rounded-lg border border-[var(--bp-rule)] bg-white px-3 py-2 text-[0.9375rem] leading-[1.6] text-[var(--bp-ink)] outline-none focus:border-[var(--bp-sky)] focus:ring-2 focus:ring-[#cfe6f8]";

function Area({
  value,
  onChange,
  className = "",
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  hint?: string;
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(16, Math.max(2, value.split("\n").length + Math.floor(value.length / 60)))}
        className={`${FIELD} resize-y ${className}`}
      />
      {hint ? <p className="mt-1 text-xs text-[var(--bp-faint)]">{hint}</p> : null}
    </div>
  );
}

function Line({
  value,
  onChange,
  className = "",
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${FIELD} ${className}`}
    />
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="mb-1 text-xs font-semibold text-[var(--bp-muted)]">{children}</p>;
}

function editorFor(block: BlueprintBlock, set: (next: BlueprintBlock) => void): ReactNode {
  switch (block.type) {
    case "lede":
      return <Area value={block.text} onChange={(text) => set({ ...block, text })} className="bp-display text-[1.125rem]" />;
    case "paragraph":
      return <Area value={block.text} onChange={(text) => set({ ...block, text })} />;
    case "heading":
      return <Line value={block.text} onChange={(text) => set({ ...block, text })} className="font-semibold" />;
    case "bullets":
    case "numbered":
      return (
        <Area
          value={block.items.join("\n")}
          onChange={(text) => set({ ...block, items: text.split("\n") })}
          hint="One per line"
        />
      );
    case "quote":
      return (
        <div className="space-y-2">
          <Area value={block.text} onChange={(text) => set({ ...block, text })} className="italic" />
          <Line value={block.cite ?? ""} onChange={(cite) => set({ ...block, cite })} placeholder="Who said it (optional)" />
        </div>
      );
    case "stats":
      return (
        <div className="grid gap-2 @xl:grid-cols-2">
          {block.items.map((item, i) => (
            <div key={i} className="grid grid-cols-[6rem_1fr] gap-2">
              <Line
                value={item.value}
                onChange={(value) => set({ ...block, items: block.items.map((it, j) => (j === i ? { ...it, value } : it)) })}
                className="font-semibold"
              />
              <Line
                value={item.label}
                onChange={(label) => set({ ...block, items: block.items.map((it, j) => (j === i ? { ...it, label } : it)) })}
              />
            </div>
          ))}
        </div>
      );
    case "pairs":
      return (
        <div className="space-y-2">
          {block.items.map((item, i) => (
            <div key={i} className="grid gap-1.5 @xl:grid-cols-[minmax(8rem,12rem)_1fr] @xl:gap-3">
              <p className="pt-2 text-[0.8125rem] font-semibold text-[var(--bp-muted)]">{item.label}</p>
              <Area
                value={item.value}
                onChange={(value) => set({ ...block, items: block.items.map((it, j) => (j === i ? { ...it, value } : it)) })}
              />
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <div className="bp-scroll -mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[34rem] border-separate border-spacing-1 text-left text-[0.875rem]">
            <thead>
              <tr>
                {block.columns.map((col) => (
                  <th key={col} className="px-1 text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-[var(--bp-muted)]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="align-top">
                  {row.map((cell, c) => (
                    <td key={c}>
                      <textarea
                        value={cell}
                        rows={Math.max(1, Math.ceil(cell.length / 32))}
                        onChange={(e) =>
                          set({
                            ...block,
                            rows: block.rows.map((rw, i) => (i === r ? rw.map((cl, j) => (j === c ? e.target.value : cl)) : rw)),
                          })
                        }
                        className={`${FIELD} resize-y px-2 py-1.5 text-[0.875rem]`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "message":
      return (
        <div>
          <Caption>{block.label || "Message"}</Caption>
          <Area value={block.body} onChange={(body) => set({ ...block, body })} />
        </div>
      );
    case "callout":
      return <Area value={block.text} onChange={(text) => set({ ...block, text })} />;
    case "steps":
      return (
        <div className="space-y-3">
          {block.items.map((item, i) => (
            <div key={i} className="space-y-1.5">
              <Line
                value={item.title}
                onChange={(title) => set({ ...block, items: block.items.map((it, j) => (j === i ? { ...it, title } : it)) })}
                className="font-semibold"
              />
              <Area
                value={item.detail}
                onChange={(detail) => set({ ...block, items: block.items.map((it, j) => (j === i ? { ...it, detail } : it)) })}
              />
            </div>
          ))}
        </div>
      );
    case "timeline":
      return (
        <div className="space-y-3">
          {block.items.map((item, i) => (
            <div key={i} className="grid gap-1.5 @xl:grid-cols-[8rem_1fr]">
              <Line
                value={item.when}
                onChange={(when) => set({ ...block, items: block.items.map((it, j) => (j === i ? { ...it, when } : it)) })}
              />
              <div className="space-y-1.5">
                <Line
                  value={item.title}
                  onChange={(title) => set({ ...block, items: block.items.map((it, j) => (j === i ? { ...it, title } : it)) })}
                  className="font-semibold"
                />
                <Area
                  value={item.detail ?? ""}
                  onChange={(detail) => set({ ...block, items: block.items.map((it, j) => (j === i ? { ...it, detail } : it)) })}
                />
              </div>
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

/** Drop the empty lines people leave while typing lists. */
function tidy(blocks: BlueprintBlock[]): BlueprintBlock[] {
  return blocks.map((b) =>
    b.type === "bullets" || b.type === "numbered" ? { ...b, items: b.items.map((i) => i.trim()).filter(Boolean) } : b
  );
}

/** Every block of a written section as plain boxes, so any part of it can be changed. */
export function BlockEditor({
  blocks,
  onSave,
  onCancel,
}: {
  blocks: BlueprintBlock[];
  onSave: (blocks: BlueprintBlock[]) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<BlueprintBlock[]>(blocks);
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-4">
      {draft.map((block, i) => (
        <div key={i}>{editorFor(block, (next) => setDraft((d) => d.map((b, j) => (j === i ? next : b))))}</div>
      ))}
      <div className="sticky bottom-3 z-10 flex gap-2 pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            const ok = await onSave(tidy(draft));
            setSaving(false);
            if (ok) onCancel();
          }}
          className="rounded-full bg-[var(--bp-navy)] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-14px_rgba(5,30,54,0.8)] hover:bg-[var(--bp-blue)] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--bp-muted)] ring-1 ring-[var(--bp-rule)] hover:text-[var(--bp-ink)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
