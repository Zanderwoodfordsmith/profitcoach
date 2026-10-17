"use client";

import { useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

import type { BlueprintBlock } from "@/lib/practiceKnowledge/types";

/** Same grey click-in box as the answer fields, so written sections edit the same way. */
const FIELD =
  "bp-input w-full rounded-xl border border-[#e3e9f0] bg-[#f4f7fa] px-3.5 py-2.5 text-[0.9844rem] leading-[1.6] text-[var(--bp-ink)] outline-none transition-[background-color,border-color,box-shadow] hover:border-[#d3dce6] hover:bg-[#f0f4f8] focus:border-[#bfdcf2] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,143,212,0.12)]";

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
  return <p className="mb-1.5 text-[0.875rem] font-semibold text-[var(--bp-ink)]">{children}</p>;
}

function editorFor(block: BlueprintBlock, set: (next: BlueprintBlock) => void, underHeading = false): ReactNode {
  switch (block.type) {
    case "lede":
      return <Area value={block.text} onChange={(text) => set({ ...block, text })} className="bp-display text-[1.125rem]" />;
    case "paragraph":
      return <Area value={block.text} onChange={(text) => set({ ...block, text })} />;
    case "heading":
      // A heading inside a written section is the label for the boxes under it.
      return <h4 className="pt-3 text-[1rem] font-semibold tracking-[-0.01em] text-[var(--bp-ink)]">{block.text}</h4>;
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
          {underHeading ? null : <Caption>{block.label || "Message"}</Caption>}
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

/** One message in a sequence. Closed until you open it, so a campaign is a list of lines. */
function MessageLine({
  block,
  onChange,
}: {
  block: Extract<BlueprintBlock, { type: "message" }>;
  onChange: (next: BlueprintBlock) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-[#e3e9f0] bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-2 px-3.5 py-2.5 text-left"
      >
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-[#94a3b8] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
        <span className="min-w-0">
          <span className="block text-[0.9375rem] font-semibold text-[var(--bp-ink)]">{block.label || "Message"}</span>
          {block.note ? <span className="mt-0.5 block truncate text-sm text-[var(--bp-muted)]">{block.note}</span> : null}
        </span>
      </button>
      <div className={open ? "border-t border-[#e6eaf0] px-3.5 py-3" : "hidden print:block border-t border-[#e6eaf0] px-3.5 py-3"}>
        <Area value={block.body} onChange={(body) => onChange({ ...block, body })} />
      </div>
    </div>
  );
}

/**
 * A written section as click-in boxes. A run of messages starts closed, one
 * line each, so you open the one you want. A single message stays open.
 */
export function BlockBoxes({
  blocks,
  onSave,
}: {
  blocks: BlueprintBlock[];
  onSave: (blocks: BlueprintBlock[]) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<BlueprintBlock[]>(blocks);
  const stored = useRef(JSON.stringify(blocks));
  const [saved, setSaved] = useState(false);
  const collapseMessages = draft.filter((block) => block.type === "message").length > 1;

  async function save() {
    const next = tidy(draft);
    const json = JSON.stringify(next);
    if (json === stored.current) return;
    stored.current = json;
    if (await onSave(next)) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    }
  }

  return (
    <div className="relative space-y-4" onBlur={save}>
      {draft.map((block, i) =>
        collapseMessages && block.type === "message" ? (
          <MessageLine
            key={i}
            block={block}
            onChange={(next) => setDraft((d) => d.map((b, j) => (j === i ? next : b)))}
          />
        ) : (
          <div key={i}>
            {editorFor(block, (next) => setDraft((d) => d.map((b, j) => (j === i ? next : b))), draft[i - 1]?.type === "heading")}
          </div>
        )
      )}
      <p
        aria-live="polite"
        className={`pointer-events-none sticky bottom-3 ml-auto inline-flex w-fit items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#17663a] shadow-sm transition-opacity ${
          saved ? "opacity-100" : "opacity-0"
        }`}
      >
        {saved ? (
          <>
            <Check className="h-3 w-3" aria-hidden /> Saved
          </>
        ) : null}
      </p>
    </div>
  );
}
