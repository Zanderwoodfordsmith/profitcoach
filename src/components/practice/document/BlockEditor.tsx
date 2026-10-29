"use client";

import { useLayoutEffect, useRef, useState, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Check, ChevronDown } from "lucide-react";

import { cardClass } from "@/components/ui/Card";
import { NOTE_VERSION_HEADINGS } from "@/lib/practiceKnowledge/campaignHandoff";
import type { BlueprintBlock } from "@/lib/practiceKnowledge/types";

/** Same grey click-in box as the answer fields, so written sections edit the same way. */
const FIELD =
  "bp-input w-full rounded-xl border border-[#e3e9f0] bg-[#f4f7fa] px-3.5 py-2.5 text-read text-[var(--bp-ink)] outline-none transition-[background-color,border-color,box-shadow] hover:border-[#d3dce6] hover:bg-[#f0f4f8] focus:border-[#bfdcf2] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,143,212,0.12)]";

/**
 * A textarea as tall as its text, refitted when its width changes (a phone,
 * a folded step opening), so nothing is hidden below the fold of the box.
 */
function FitTextarea({ value, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let width = 0;
    const fit = () => {
      if (!el.clientWidth || el.clientWidth === width) return;
      width = el.clientWidth;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + 2}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);
  return <textarea ref={ref} value={value} {...props} />;
}

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
      <FitTextarea
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
  return <p className="mb-1.5 text-ui font-medium text-[var(--bp-ink)]">{children}</p>;
}

function editorFor(block: BlueprintBlock, set: (next: BlueprintBlock) => void, underHeading = false): ReactNode {
  switch (block.type) {
    case "lede":
      return <Area value={block.text} onChange={(text) => set({ ...block, text })} className="bp-display text-subhead" />;
    case "paragraph":
      return <Area value={block.text} onChange={(text) => set({ ...block, text })} />;
    case "heading":
      // A heading inside a written section is the label for the boxes under it.
      return <h4 className="pt-3 text-base font-semibold tracking-[-0.01em] text-[var(--bp-ink)]">{block.text}</h4>;
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
              <p className="pt-2 text-ui font-medium text-[var(--bp-muted)]">{item.label}</p>
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
          <table className="w-full min-w-[34rem] border-separate border-spacing-1 text-left text-ui">
            <thead>
              <tr>
                {block.columns.map((col) => (
                  <th key={col} className="px-1 text-kicker font-semibold uppercase text-[var(--bp-muted)]">
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
                      <FitTextarea
                        value={cell}
                        rows={Math.max(1, Math.ceil(cell.length / 32))}
                        onChange={(e) =>
                          set({
                            ...block,
                            rows: block.rows.map((rw, i) => (i === r ? rw.map((cl, j) => (j === c ? e.target.value : cl)) : rw)),
                          })
                        }
                        className={`${FIELD} resize-y px-2 py-1.5 text-ui`}
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
          {block.note ? <p className="mt-1.5 px-0.5 text-sm text-[var(--bp-muted)]">{block.note}</p> : null}
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
    <div className={cardClass("plain", "overflow-hidden")}>
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
          <span className="block text-ui font-medium text-[var(--bp-ink)]">{block.label || "Message"}</span>
          {block.note ? <span className="mt-0.5 block truncate text-sm text-[var(--bp-muted)]">{block.note}</span> : null}
        </span>
      </button>
      <div className={open ? "border-t border-[#e6eaf0] px-3.5 py-3" : "hidden print:block border-t border-[#e6eaf0] px-3.5 py-3"}>
        <Area value={block.body} onChange={(body) => onChange({ ...block, body })} />
      </div>
    </div>
  );
}

type Version = "a" | "b" | "open";

/** Where the connection request and its other versions sit. Each version is the message under its own heading. */
function noteVersions(blocks: BlueprintBlock[]): { a: number; b: number; open: number } | null {
  const a = blocks.findIndex((b) => b.type === "message" && /^connection (request|note)(?!\s*b\b)/i.test((b.label ?? "").trim()));
  if (a < 0) return null;
  const under = (match: RegExp) => {
    const at = blocks.findIndex((b) => b.type === "heading" && match.test(b.text));
    return at >= 0 && blocks[at + 1]?.type === "message" ? at + 1 : -1;
  };
  return { a, b: under(NOTE_VERSION_HEADINGS.b), open: under(NOTE_VERSION_HEADINGS.open) };
}

/** Message 1 with the connection request's opening, for owners messaged without connecting. */
function openFromMessage1(blocks: BlueprintBlock[], a: number): string {
  const note = blocks[a];
  const m1 = blocks.slice(a + 1).find((b) => b.type === "message");
  if (note?.type !== "message" || m1?.type !== "message") return "";
  const opener = note.body.split("\n")[0].match(/^.*?[.?!](?=\s|$)/)?.[0] ?? note.body.split("\n")[0];
  const [first, ...rest] = m1.body.split("\n");
  return /thanks for connecting/i.test(first) ? [opener, ...rest].join("\n") : m1.body;
}

/** The connection request with A / B / Open tabs. A missing version is added when its tab is first opened. */
function NoteVersions({
  blocks,
  at,
  onChange,
  onAdd,
}: {
  blocks: BlueprintBlock[];
  at: { a: number; b: number; open: number };
  onChange: (index: number, body: string) => void;
  onAdd: (version: "b" | "open", body: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Version>("a");
  const note = blocks[at.a] as Extract<BlueprintBlock, { type: "message" }>;
  const index = at[tab];
  const shown = index >= 0 ? blocks[index] : null;
  const TABS: { id: Version; label: string; title: string }[] = [
    { id: "a", label: "A", title: "The connection request" },
    { id: "b", label: "B", title: "A second version to test against A" },
    { id: "open", label: "Open", title: "For Open Profiles: sent as a free InMail, no connection needed" },
  ];
  const choose = (id: Version) => {
    setTab(id);
    setOpen(true);
    if (id !== "a" && at[id] < 0) onAdd(id, id === "b" ? note.body : openFromMessage1(blocks, at.a));
  };
  return (
    <div className={cardClass("plain", "overflow-hidden")}>
      <div className="flex items-start gap-2 px-3.5 py-2.5">
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
          <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-[#94a3b8] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          <span className="min-w-0">
            <span className="block text-ui font-medium text-[var(--bp-ink)]">{note.label || "Connection request"}</span>
            {shown?.type === "message" && shown.note ? <span className="mt-0.5 block truncate text-sm text-[var(--bp-muted)]">{shown.note}</span> : null}
          </span>
        </button>
        <div role="tablist" aria-label="Which version" className="bp-no-print inline-flex shrink-0 rounded-full bg-[#eef2f6] p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={open && tab === t.id}
              title={t.title}
              onClick={() => choose(t.id)}
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                open && tab === t.id
                  ? "bg-white font-semibold text-[var(--bp-ink)] shadow-[0_1px_2px_rgba(5,30,54,0.15)]"
                  : `font-medium hover:text-[var(--bp-ink)] ${at[t.id] < 0 ? "text-[var(--bp-faint)]" : "text-[var(--bp-muted)]"}`
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className={open ? "border-t border-[#e6eaf0] px-3.5 py-3" : "hidden print:block border-t border-[#e6eaf0] px-3.5 py-3"}>
        {shown?.type === "message" ? (
          <>
            {tab === "open" ? <p className="mb-2 text-sm text-[var(--bp-muted)]">For owners with an Open Profile: sent as a free InMail instead of a connection request.</p> : null}
            {tab === "b" ? <p className="mb-2 text-sm text-[var(--bp-muted)]">Get Clients sends A to half the list and B to the other half.</p> : null}
            <Area value={shown.body} onChange={(body) => onChange(index, body)} />
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Messages in a run of three or more in a row (a campaign sequence) start closed. */
function inSequence(blocks: BlueprintBlock[], i: number): boolean {
  const isMessage = (j: number) => blocks[j]?.type === "message";
  if (!isMessage(i)) return false;
  let start = i;
  let end = i;
  while (isMessage(start - 1)) start--;
  while (isMessage(end + 1)) end++;
  return end - start >= 2;
}

/**
 * A written section as click-in boxes. A sequence of messages starts closed,
 * one line each, so you open the one you want. A message on its own, or one
 * under its own heading (the offer in three lengths), stays open.
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

  const versions = noteVersions(draft);
  // The B and Open versions show as tabs on the connection request, so their own headings and boxes are hidden.
  const asTabs = new Set(
    versions ? [versions.b, versions.open].filter((i) => i >= 0).flatMap((i) => [i - 1, i]) : []
  );

  return (
    <div className="relative space-y-4" onBlur={save}>
      {draft.map((block, i) =>
        asTabs.has(i) ? null : versions && i === versions.a ? (
          <NoteVersions
            key={i}
            blocks={draft}
            at={versions}
            onChange={(index, body) => setDraft((d) => d.map((b, j) => (j === index && b.type === "message" ? { ...b, body } : b)))}
            onAdd={(version, body) =>
              setDraft((d) => {
                // Added just before the checks, each under its own heading so it stays out of the follow-ups.
                const checks = d.findIndex((b) => b.type === "heading" && /check/i.test(b.text));
                const at = checks < 0 ? d.length : checks;
                const added: BlueprintBlock[] =
                  version === "b"
                    ? [{ type: "heading", text: "Connection request B" }, { type: "message", label: "Connection request B", body, note: "A second version: Get Clients sends A to half the list and B to the other half." }]
                    : [{ type: "heading", text: "Open Profile message" }, { type: "message", label: "Open Profile message", body, note: "No connection needed: for owners with an Open Profile." }];
                return [...d.slice(0, at), ...added, ...d.slice(at)];
              })
            }
          />
        ) : block.type === "message" && inSequence(draft, i) ? (
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
