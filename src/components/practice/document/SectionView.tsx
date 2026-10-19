"use client";

import Link from "next/link";
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Check, ChevronDown, ChevronUp, GripVertical, Lightbulb, Loader2, MoreHorizontal, Plus, Sparkles, X } from "lucide-react";

import {
  fieldFilled,
  fieldValue,
  sectionByKey,
  type BlueprintSection,
  type FieldSpec,
  type SectionRef,
} from "@/lib/practiceKnowledge/blueprint";
import { sectionWorkflow, todoOwner, type SectionWorkflow } from "@/lib/practiceKnowledge/sectionWorkflow";
import { blocksToMarkdown } from "@/lib/practiceKnowledge/blocks";
import type { BlueprintBlock } from "@/lib/practiceKnowledge/types";
import { handoffForSection } from "@/lib/practiceKnowledge/campaignHandoff";
import { isNewsletterOverviewKey, stripStandingFacts } from "@/lib/practiceKnowledge/newsletters";

import { useSectionComments } from "../comments/SectionCommentsContext";
import { CommentButton } from "../comments/SectionCommentsUI";
import { usePractice } from "../PracticeProvider";
import { BlockBoxes } from "./BlockEditor";
import { Blocks } from "./Blocks";
import { LinkedInProfileSection } from "./LinkedInProfileSection";
import { StatusSwitch } from "./StatusMenu";
import { InfoTip } from "./InfoTip";
import { SetupSocials, SetupWidget } from "./SetupPanels";

function formatDate(iso: string | undefined | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** What a section is for, and where it comes from and goes. Shown behind the info icon. */
function SectionAbout({ section }: { section: BlueprintSection }) {
  return (
    <>
      {section.about ? <span className="block">{section.about}</span> : null}
      {section.fields?.length === 1 && section.fields[0].help && !lineHintOnly(section.fields[0].help) ? (
        <span className="block">{section.fields[0].help}</span>
      ) : null}
      {section.from?.length ? (
        <span className="block text-white/75">
          <span className="font-semibold text-white">Built from:</span> {section.from.join(", ")}
        </span>
      ) : null}
      {section.feeds ? (
        <span className="block text-white/75">
          <span className="font-semibold text-white">Used for:</span> {section.feeds}
        </span>
      ) : null}
    </>
  );
}

/** The empty-box hint: the example (lists one per line become a comma list), or a fixed placeholder. */
function hint(field: FieldSpec): string {
  if (field.placeholder) return field.placeholder;
  return field.example ? `e.g. ${field.example.split("\n").join(", ")}` : "Type here";
}

/** In the empty boxes BCA fills after About You, so they look the same as they will once filled. */
const BCA_FILLS_HINT = "Our team fills this in from your Blueprint Call.";

/** The look of something the coach fills in: a light grey box with a soft edge that turns white while you type. */
const INPUT_BOX =
  "bp-input w-full rounded-xl border border-[#e3e9f0] bg-[#f4f7fa] px-3.5 py-2.5 text-left text-[0.9844rem] leading-[1.6] text-[var(--bp-ink)] transition-[background-color,border-color,box-shadow] placeholder:text-[#9aa8b8] hover:border-[#d3dce6] hover:bg-[#f0f4f8] focus:border-[#bfdcf2] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,143,212,0.12)]";

/** How tall an empty box starts, so its size says how much to write. */
const EMPTY_ROWS: Partial<Record<FieldSpec["kind"], number>> = { text: 1, list: 3, longtext: 4 };
/** Past this the box scrolls instead of growing, until someone drags it taller. */
const MAX_BOX_PX = 420;
const MIN_BOX_PX = 48;

/** A corner grip. Dragging it only changes the height of the box. */
function ResizeGrip({ onResize }: { onResize: (height: number) => void }) {
  const drag = useRef<{ y: number; h: number } | null>(null);

  function heightOf(handle: HTMLElement) {
    return handle.parentElement?.getBoundingClientRect().height ?? MIN_BOX_PX;
  }

  return (
    <button
      type="button"
      aria-label="Drag to make taller"
      title="Drag to make taller"
      tabIndex={-1}
      className="bp-no-print absolute bottom-1 right-1 z-10 flex h-4 w-4 cursor-ns-resize touch-none items-center justify-center text-[#b0bcc8] hover:text-[#5e7082]"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { y: event.clientY, h: heightOf(event.currentTarget) };
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        onResize(Math.max(MIN_BOX_PX, drag.current.h + event.clientY - drag.current.y));
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden>
        <path d="M9 4 L4 9 M9 7 L7 9" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** A box that is always ready to type in. It grows with the answer and saves when you leave it. */
function AnswerBox({ field }: { field: FieldSpec }) {
  const { payload, saveField } = usePractice();
  const current = payload ? fieldValue(payload, field.path)?.value : null;
  const stored = field.kind === "list" ? ((current as string[] | null) ?? []).join("\n") : String(current ?? "");
  const [value, setValue] = useState(stored);
  const [seen, setSeen] = useState(stored);
  const [typing, setTyping] = useState(false);
  const [saved, setSaved] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Follow the saved answer when it changes elsewhere (the assistant, an import), unless mid-typing here.
  if (stored !== seen) {
    setSeen(stored);
    if (!typing) setValue(stored);
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (height != null) {
      el.style.height = `${height}px`;
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, MAX_BOX_PX)}px`;
  }, [value, height]);

  function save() {
    setTyping(false);
    if (value === stored) return;
    saveField(field, field.kind === "list" ? value.split("\n").map((v) => v.trim()).filter(Boolean) : value.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        id={`f-${field.path}`}
        rows={EMPTY_ROWS[field.kind] ?? 3}
        value={value}
        placeholder={hint(field)}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setTyping(true)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey || field.kind === "text")) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className={`${INPUT_BOX} block resize-none overflow-y-auto`}
      />
      <ResizeGrip onResize={setHeight} />
      <span
        aria-live="polite"
        className={`bp-no-print pointer-events-none absolute bottom-2 right-7 inline-flex items-center gap-1 text-xs font-medium text-[#17663a] transition-opacity ${
          saved ? "opacity-100" : "opacity-0"
        }`}
      >
        {saved ? (
          <>
            <Check className="h-3 w-3" aria-hidden /> Saved
          </>
        ) : null}
      </span>
    </div>
  );
}

function EnumBox({ field }: { field: FieldSpec }) {
  const { payload, saveField } = usePractice();
  const current = payload ? String(fieldValue(payload, field.path)?.value ?? "") : "";
  const shown = current || field.assume || "";
  return (
    <div className="relative">
      <select
        id={`f-${field.path}`}
        value={shown}
        onChange={(e) => {
          if (e.target.value) saveField(field, e.target.value);
        }}
        className={`${INPUT_BOX} cursor-pointer appearance-none pr-10 ${shown ? "" : "text-[#9aa8b8]"}`}
      >
        {field.assume ? null : <option value="">Choose…</option>}
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bp-faint)]" aria-hidden />
    </div>
  );
}

type CardPart = { key: string; label: string; placeholder: string; long?: boolean };

/** What a result card asks, in the order a coach thinks of it: what changed, where, then how. */
const RESULT_PARTS: CardPart[][] = [
  [
    { key: "metric_from", label: "Before", placeholder: "e.g. 74 debtor days" },
    { key: "metric_to", label: "After", placeholder: "e.g. 31 debtor days" },
    { key: "timeframe", label: "How long it took", placeholder: "e.g. 9 months" },
  ],
  [
    { key: "role", label: "Your role", placeholder: "e.g. Finance Director" },
    { key: "company", label: "Company", placeholder: "e.g. Harlow & Pike" },
  ],
  [{ key: "mechanism", label: "How you did it", placeholder: "e.g. A weekly cash meeting and new credit terms for the top 20 customers", long: true }],
];

const STORY_PARTS: CardPart[][] = [
  [{ key: "title", label: "The result", placeholder: "e.g. Took a 20-person builder from 4% to 11% net margin in a year" }],
  [{ key: "story", label: "The story", placeholder: "Who they were, what was wrong, what you did together, and what changed.", long: true }],
];

type CardDraft = { id: string; rest: Record<string, unknown>; cells: Record<string, string> };

/**
 * Results and client stories as cards: one per result, each with its own
 * boxes, and "Add another" underneath. Saves when you leave a box.
 */
function ResultCards({ field }: { field: FieldSpec }) {
  const { payload, saveField, setAssistantOpen, sample } = usePractice();
  const stories = field.kind === "stories";
  const parts = stories ? STORY_PARTS : RESULT_PARTS;
  const keys = parts.flat().map((part) => part.key);
  const noun = stories ? "story" : "result";

  const current = payload ? fieldValue(payload, field.path)?.value : null;
  const stored: CardDraft[] = Array.isArray(current)
    ? current
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const rec = item as Record<string, unknown>;
          return {
            id: String(rec.id || crypto.randomUUID()),
            rest: rec,
            cells: Object.fromEntries(keys.map((key) => [key, String(rec[key] ?? "")])),
          };
        })
    : [];
  const storedKey = JSON.stringify(stored.map((card) => [card.id, ...keys.map((key) => card.cells[key])]));
  const blank = (): CardDraft => ({ id: crypto.randomUUID(), rest: {}, cells: Object.fromEntries(keys.map((key) => [key, ""])) });
  const [cards, setCards] = useState<CardDraft[]>(() => (stored.length ? stored : [blank()]));
  const [seen, setSeen] = useState(storedKey);
  const [focus, setFocus] = useState(false);

  if (storedKey !== seen && !focus) {
    setSeen(storedKey);
    setCards(stored.length ? stored : [blank()]);
  }

  function persist(next: CardDraft[]) {
    const saved = next
      .filter((card) => keys.some((key) => card.cells[key].trim()))
      .map((card) => {
        const cells = Object.fromEntries(keys.map((key) => [key, card.cells[key].trim()]));
        if (stories) return { id: card.id, ...cells };
        return {
          proof_type: "career",
          ...card.rest,
          id: card.id,
          ...cells,
          precise: Boolean(cells.metric_from && cells.metric_to),
        };
      });
    const key = JSON.stringify(saved.map((card) => [card.id, ...keys.map((k) => String((card as Record<string, unknown>)[k] ?? ""))]));
    setCards(next.length ? next : [blank()]);
    if (key === storedKey) return;
    setSeen(key);
    saveField(field, saved);
  }

  const edit = (id: string, key: string, text: string) =>
    cards.map((card) => (card.id === id ? { ...card, cells: { ...card.cells, [key]: text } } : card));

  return (
    <div className="space-y-3">
      {cards.map((card, index) => (
        <div key={card.id} className="rounded-2xl border border-[#e3e9f0] bg-white p-3.5 @lg:p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[var(--bp-muted)]">
              {stories ? "Story" : "Result"} {index + 1}
            </p>
            {cards.length > 1 || keys.some((key) => card.cells[key]) ? (
              <button
                type="button"
                className={NUDGE}
                aria-label={`Remove ${noun} ${index + 1}`}
                onClick={() => persist(cards.filter((item) => item.id !== card.id))}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="space-y-2.5">
            {parts.map((row, r) => (
              <div key={r} className={`grid gap-2.5 ${row.length === 3 ? "@lg:grid-cols-3" : row.length === 2 ? "@lg:grid-cols-2" : ""}`}>
                {row.map((part) => {
                  const id = `f-${field.path}-${card.id}-${part.key}`;
                  const props = {
                    id: index === 0 && r === 0 && part === row[0] ? `f-${field.path}` : id,
                    value: card.cells[part.key] ?? "",
                    placeholder: part.placeholder,
                    onFocus: () => setFocus(true),
                    onChange: (event: { target: { value: string } }) => setCards(edit(card.id, part.key, event.target.value)),
                    onBlur: (event: { target: { value: string } }) => {
                      setFocus(false);
                      persist(edit(card.id, part.key, event.target.value));
                    },
                  };
                  return (
                    <label key={part.key} htmlFor={props.id} className="block min-w-0">
                      <span className="mb-1 block px-0.5 text-[0.8125rem] font-semibold text-[var(--bp-muted)]">{part.label}</span>
                      {part.long ? (
                        <textarea {...props} rows={3} className={`${INPUT_BOX} resize-y`} />
                      ) : (
                        <input {...props} type="text" className={INPUT_BOX} />
                      )}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="bp-no-print flex flex-wrap items-center gap-x-4 gap-y-1 px-0.5">
        <button
          type="button"
          onClick={() => setCards((prev) => [...prev, blank()])}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--bp-blue)] hover:underline"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add another {noun}
        </button>
        {sample ? null : (
          <button
            type="button"
            onClick={() => setAssistantOpen(true)}
            className="inline-flex items-center gap-1 text-sm text-[var(--bp-muted)] hover:text-[var(--bp-blue)] hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Or talk it through with Ava
          </button>
        )}
      </div>
    </div>
  );
}

function lineHintOnly(help: string | undefined) {
  return help?.trim().toLowerCase().replace(/\.$/, "") === "one per line";
}

const NUDGE =
  "rounded p-0.5 text-[#8aa0b4] hover:bg-[#eef2f6] hover:text-[var(--bp-ink)] disabled:pointer-events-none disabled:opacity-30";

type TableDraft = { id: string; cells: Record<string, string> };

function blankRow(columns: { key: string }[]): TableDraft {
  return { id: crypto.randomUUID(), cells: Object.fromEntries(columns.map((column) => [column.key, ""])) };
}

function rowFilled(row: TableDraft, columns: { key: string }[]) {
  return columns.some((column) => row.cells[column.key]?.trim());
}

/** A full-width table. Each row is one entry, and the arrows change its order. */
function RowsEditor({ field }: { field: FieldSpec }) {
  const { payload, saveField } = usePractice();
  const columns = field.columns ?? [];
  const current = payload ? fieldValue(payload, field.path)?.value : null;
  const stored: TableDraft[] = Array.isArray(current)
    ? current
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const rec = item as Record<string, unknown>;
          return {
            id: String(rec.id || crypto.randomUUID()),
            cells: Object.fromEntries(columns.map((column) => [column.key, String(rec[column.key] ?? "")])),
          };
        })
    : [];
  const storedKey = JSON.stringify(stored.map((row) => [row.id, ...columns.map((column) => row.cells[column.key])]));
  const [rows, setRows] = useState<TableDraft[]>(() => (stored.length ? stored : [blankRow(columns)]));
  const [seen, setSeen] = useState(storedKey);
  const [focus, setFocus] = useState(false);

  if (storedKey !== seen && !focus) {
    setSeen(storedKey);
    setRows(stored.length ? stored : [blankRow(columns)]);
  }

  function persist(next: TableDraft[]) {
    const saved = next
      .filter((row) => rowFilled(row, columns))
      .map((row) => ({
        id: row.id,
        ...Object.fromEntries(columns.map((column) => [column.key, row.cells[column.key].trim()])),
      }));
    const key = JSON.stringify(
      saved.map((row) => [row.id, ...columns.map((column) => String((row as Record<string, string>)[column.key] ?? ""))])
    );
    setRows(next.length ? next : [blankRow(columns)]);
    if (key === storedKey) return;
    setSeen(key);
    saveField(field, saved);
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const next = rows.slice();
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    persist(next);
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="border-b border-[#e6eaf0] px-2 pb-2 text-left text-[0.75rem] font-semibold leading-4 text-[var(--bp-muted)]"
                >
                  {column.label}
                </th>
              ))}
              <th scope="col" className="w-14 border-b border-[#e6eaf0] pb-2">
                <span className="sr-only">Order</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="align-top">
                {columns.map((column, columnIndex) => (
                  <td key={column.key} className="border-b border-[#eef1f5] px-1.5 py-2">
                    <textarea
                      id={index === 0 && columnIndex === 0 ? `f-${field.path}` : undefined}
                      aria-label={column.label}
                      rows={2}
                      value={row.cells[column.key] ?? ""}
                      placeholder={column.placeholder ?? column.label}
                      onChange={(event) => {
                        const text = event.target.value;
                        setRows((prev) =>
                          prev.map((item) =>
                            item.id === row.id ? { ...item, cells: { ...item.cells, [column.key]: text } } : item
                          )
                        );
                      }}
                      onFocus={() => setFocus(true)}
                      onBlur={(event) => {
                        setFocus(false);
                        const next = rows.map((item) =>
                          item.id === row.id
                            ? { ...item, cells: { ...item.cells, [column.key]: event.target.value } }
                            : item
                        );
                        persist(next);
                      }}
                      className={`${INPUT_BOX} min-h-16 resize-y py-2 text-sm`}
                    />
                  </td>
                ))}
                <td className="border-b border-[#eef1f5] py-2 pl-1">
                  <div className="flex flex-col items-center">
                    <button type="button" className={NUDGE} aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button type="button" className={NUDGE} aria-label="Move down" disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={NUDGE}
                      aria-label="Remove row"
                      onClick={() => persist(rows.filter((item) => item.id !== row.id))}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, blankRow(columns)])}
        className="mt-2 inline-flex items-center gap-1 px-0.5 text-xs font-semibold text-[var(--bp-blue)] hover:underline"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Add a row
      </button>
    </div>
  );
}

type LineDraft = { id: string; text: string };

function newLine(): LineDraft {
  return { id: crypto.randomUUID(), text: "" };
}

function asLineList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const text = String(value ?? "").trim();
  return text ? text.split(/\n+/).map((item) => item.trim()).filter(Boolean) : [];
}

/** Addable, reorderable lines. Used for paired more/less lists, not every list field. */
function LineListEditor({ field }: { field: FieldSpec }) {
  const { payload, saveField } = usePractice();
  const stored = asLineList(payload ? fieldValue(payload, field.path)?.value : null);
  const storedKey = JSON.stringify(stored);
  const [items, setItems] = useState<LineDraft[]>(() =>
    stored.length ? stored.map((text) => ({ id: crypto.randomUUID(), text })) : [newLine()]
  );
  const [seen, setSeen] = useState(storedKey);
  const [focus, setFocus] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  if (storedKey !== seen && !focus) {
    setSeen(storedKey);
    setItems(stored.length ? stored.map((text) => ({ id: crypto.randomUUID(), text })) : [newLine()]);
  }

  function persist(next: LineDraft[]) {
    const lines = next.map((item) => item.text.trim()).filter(Boolean);
    setItems(next.length ? next : [newLine()]);
    if (JSON.stringify(lines) === storedKey) return;
    setSeen(JSON.stringify(lines));
    saveField(field, lines);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    persist(next);
  }

  const examples = (field.example ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="relative">
      <ul className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <li
            key={item.id}
            onDragOver={(event) => {
              event.preventDefault();
              if (!dragId || dragId === item.id) return;
              const from = items.findIndex((row) => row.id === dragId);
              if (from < 0 || from === index) return;
              const next = items.slice();
              const [row] = next.splice(from, 1);
              next.splice(index, 0, row);
              setItems(next);
            }}
            className={`flex items-center gap-1 ${dragId === item.id ? "opacity-50" : ""}`}
          >
            <button
              type="button"
              draggable
              aria-label="Drag to reorder"
              className={`${NUDGE} cursor-grab active:cursor-grabbing`}
              onDragStart={(event) => {
                setDragId(item.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                persist(itemsRef.current);
              }}
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
            </button>
            <input
              id={index === 0 ? `f-${field.path}` : undefined}
              value={item.text}
              placeholder={examples[index] ? `e.g. ${examples[index]}` : (index === 0 && field.placeholder) || "Type here"}
              onChange={(event) => {
                const text = event.target.value;
                setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, text } : row)));
              }}
              onFocus={() => setFocus(true)}
              onBlur={(event) => {
                setFocus(false);
                persist(itemsRef.current.map((row) => (row.id === item.id ? { ...row, text: event.target.value } : row)));
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                const next = itemsRef.current.slice();
                next.splice(index + 1, 0, newLine());
                setItems(next);
              }}
              className={`${INPUT_BOX} py-2`}
            />
            <div className="flex shrink-0 flex-col items-center">
              <button type="button" className={NUDGE} aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                className={NUDGE}
                aria-label="Move down"
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
              >
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                className={NUDGE}
                aria-label="Remove line"
                onClick={() => persist(items.filter((row) => row.id !== item.id))}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, newLine()])}
          className="inline-flex items-center gap-1 px-0.5 text-xs font-semibold text-[var(--bp-blue)] hover:underline"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add
        </button>
        <span
          aria-live="polite"
          className={`inline-flex items-center gap-1 text-xs font-medium text-[#17663a] transition-opacity ${
            saved ? "opacity-100" : "opacity-0"
          }`}
        >
          {saved ? (
            <>
              <Check className="h-3 w-3" aria-hidden /> Saved
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}

/** One answer. A section with a single box uses its own title, so the box is not labelled again. */
function Field({ field, changed, solo }: { field: FieldSpec; changed?: boolean; solo?: boolean }) {
  const { payload } = usePractice();
  if (!payload) return null;
  const structured = field.kind === "results" || field.kind === "stories";
  const paired = Boolean(field.pair);
  const list = field.kind === "list" && !paired;
  const showHelp = Boolean(field.help) && !lineHintOnly(field.help);
  // No "Needed" badge: the section's To do already says so.
  const mark = changed ? (
    <span className="rounded-full bg-[#fff4e0] px-2 py-px text-[0.6875rem] font-semibold text-[#8a5300]">Changed</span>
  ) : null;
  const cue =
    field.cue === "more" ? (
      <ArrowUp className="h-3.5 w-3.5 text-[#2f8a55]" aria-hidden />
    ) : field.cue === "less" ? (
      <ArrowDown className="h-3.5 w-3.5 text-[#2f8a55]" aria-hidden />
    ) : null;

  return (
    <div className="min-w-0">
      <div className={solo ? undefined : "mb-1.5 flex items-center gap-1.5 px-0.5"}>
        <label htmlFor={`f-${field.path}`} className={solo ? "sr-only" : "inline-flex items-center gap-1 text-[0.875rem] font-semibold text-[var(--bp-ink)]"}>
          {cue}
          {field.label}
        </label>
        {solo ? null : (
          <>
            {showHelp ? <InfoTip label={field.label}>{field.help}</InfoTip> : null}
            {mark}
          </>
        )}
      </div>
      {field.kind === "enum" ? (
        <EnumBox field={field} />
      ) : field.kind === "rows" ? (
        <RowsEditor field={field} />
      ) : paired && field.kind === "list" ? (
        <LineListEditor field={field} />
      ) : structured ? (
        <ResultCards field={field} />
      ) : (
        <AnswerBox field={field} />
      )}
      {list || (solo && changed) ? (
        <div className="mt-1.5 flex items-center gap-2 px-0.5">
          {list ? <span className="text-xs text-[var(--bp-faint)]">One per line</span> : null}
          {solo && changed ? <span className="ml-auto">{mark}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function Fields({ section, changedFields, bcaFills }: { section: BlueprintSection; changedFields: string[]; bcaFills?: boolean }) {
  const { payload, href } = usePractice();
  const fields = (section.fields ?? [])
    .filter((f) => {
      if (!f.showIf || !payload) return true;
      const answer = fieldValue(payload, f.showIf.path)?.value;
      return typeof answer === "string" && f.showIf.in.includes(answer);
    })
    .map((f) => (bcaFills ? { ...f, placeholder: BCA_FILLS_HINT, example: undefined } : f));
  // Short answers sit two to a row. Widgets and long answers take the full width.
  // Paired lists (more/less) sit on their own row, not next to a picker.
  const short = (f: FieldSpec) => !f.widget && !f.pair && (f.kind === "text" || f.kind === "enum");
  const shortCount = fields.filter(short).length;
  const showSocials = section.extras?.includes("socials");
  const inline = section.layout === "inline";
  const cells: { key: string; wide: boolean; nodes: FieldSpec[] }[] = [];
  for (const field of fields) {
    if (field.pair && cells.at(-1)?.nodes[0]?.pair) {
      cells.at(-1)!.nodes.push(field);
      continue;
    }
    const wide = !inline && (Boolean(field.widget) || field.pair || !short(field) || shortCount < 2);
    cells.push({ key: field.path, wide, nodes: [field] });
  }
  return (
    <div className={inline ? "grid gap-y-3" : "grid gap-x-4 gap-y-5 @xl:grid-cols-2"}>
      {cells.map((cell) => (
        <Fragment key={cell.key}>
          <div
            className={
              [
                cell.wide ? "@xl:col-span-2" : "",
                inline ? "bp-inline" : "",
                cell.nodes.length > 1 ? "grid grid-cols-1 gap-x-4 gap-y-5 min-[22rem]:grid-cols-2" : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
          >
            {cell.nodes.map((field) =>
              field.widget ? (
                <SetupWidget key={field.path} field={field} changed={changedFields.includes(field.path)} />
              ) : (
                <Field
                  key={field.path}
                  field={field}
                  changed={changedFields.includes(field.path)}
                  solo={fields.length === 1 && !inline}
                />
              )
            )}
          </div>
        </Fragment>
      ))}
      {showSocials ? <SetupSocials /> : null}
      {section.link ? (
        <p className="bp-no-print border-t border-[#e1e6ec] pt-3 text-sm @xl:col-span-2">
          <Link href={href(section.link.href)} className="inline-flex items-center gap-1 font-semibold text-[var(--bp-blue)] hover:underline">
            {section.link.label}
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function WriteButton({ refKey, label }: { refKey: string; label: string }) {
  const { build, building, sample } = usePractice();
  const busy = building.active.length > 0;
  if (sample) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => build(refKey)}
      className="bp-no-print inline-flex items-center gap-1.5 rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--bp-blue)] disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

function SendToCampaigns({ sectionKey, name }: { sectionKey: string; name: string }) {
  const { sendCampaign, href, sample } = usePractice();
  const [state, setState] = useState<{ busy?: boolean; done?: string; error?: string }>({});
  if (sample) return null;

  async function send() {
    setState({ busy: true });
    const res = await sendCampaign(sectionKey);
    setState(res.campaignId ? { done: res.campaignId } : { error: res.error });
  }

  return (
    <div className="bp-no-print mt-6 rounded-xl border border-[var(--bp-rule)] bg-white px-5 py-4">
      <p className="text-[0.9375rem] font-semibold text-[var(--bp-ink)]">Happy with it? Send it to Get Clients</p>
      <p className="mt-1 text-sm leading-6 text-[var(--bp-muted)]">
        Creates a draft campaign with these messages and timings. From then on, change it in Get Clients, not here.
        Nothing sends until prospects are added and the campaign is started.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={Boolean(state.busy)}
          onClick={() => void send()}
          className="rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--bp-blue)] disabled:opacity-50"
        >
          {state.busy ? "Creating…" : `Create the ${name.toLowerCase()}`}
        </button>
        {state.done ? (
          <Link
            href={href(`/coach/campaigns/${state.done}`)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--bp-blue)] hover:underline"
          >
            Draft created. Open it
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
        {state.error ? <span className="text-sm text-[#9b1c1c]">{state.error}</span> : null}
      </div>
    </div>
  );
}

type MenuItem = { label: string; onClick: () => void; disabled?: boolean };

/** Quiet actions (Edit, Rewrite, Copy) behind a "…" button. */
function MoreMenu({ items, note }: { items: MenuItem[]; note?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="More actions"
        className="rounded-full p-1.5 text-[var(--bp-faint)] hover:bg-[var(--bp-tint)] hover:text-[var(--bp-ink)]"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div className="bp-pop absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-[#e3e8ef] bg-white p-1 shadow-lg">
          {note ? <p className="px-2.5 pb-1 pt-1.5 text-xs text-[var(--bp-faint)]">{note}</p> : null}
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-[var(--bp-ink)] hover:bg-[var(--bp-tint)] disabled:opacity-40"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Older newsletter drafts planned the next six issues inside the issue. That list is not part of the issue. */
function dropPlannedIssues(key: string, blocks: BlueprintBlock[]): BlueprintBlock[] {
  if (key !== "content:newsletter" && key !== "content:analogy") return blocks;
  const out: BlueprintBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === "heading" && /next six issues/i.test(block.text)) {
      if (blocks[i + 1]?.type === "table") i += 1;
      continue;
    }
    out.push(block);
  }
  return out;
}

/** What BCA wrote, in a soft grey panel. */
function OutputBody({
  refKey,
  section,
  emptyHint,
  canWrite = true,
}: {
  refKey: string;
  section: BlueprintSection;
  emptyHint?: string;
  canWrite?: boolean;
}) {
  const { knowledge, building, saveBlocks, href } = usePractice();
  const built = knowledge?.built_sections[refKey];
  const blocks = built
    ? (isNewsletterOverviewKey(refKey) ? stripStandingFacts(dropPlannedIssues(refKey, built.blocks)) : dropPlannedIssues(refKey, built.blocks))
    : [];
  const writing = building.active.includes(refKey);
  const queued = building.queue.includes(refKey);
  const panel = "bp-output rounded-xl border border-[#e6eaf0] bg-white px-5 py-5 @2xl:px-6";

  if (writing) {
    return (
      <div className={panel} aria-live="polite">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-[var(--bp-blue)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Writing this from your blueprint…
        </p>
        <div className="mt-4 space-y-2.5">
          {[92, 100, 76, 88].map((w, i) => (
            <div key={i} className="h-3 animate-pulse rounded-full bg-[#e2e7ee]" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!built) {
    const needs = (section.needs ?? [])
      .filter((k) => !knowledge?.built_sections[k])
      .map((k) => sectionByKey(k)?.section.title)
      .filter(Boolean);
    if (emptyHint) {
      return (
        <div>
          <p className="text-sm leading-6 text-[var(--bp-muted)]">{queued ? "Queued. This is next." : emptyHint}</p>
          {canWrite && !queued ? (
            <div className="mt-3">
              <WriteButton refKey={refKey} label="Write it now" />
            </div>
          ) : null}
        </div>
      );
    }
    return (
      <div className={panel}>
        <p className="text-[0.9375rem] font-semibold text-[var(--bp-ink)]">
          {queued ? "Queued. BCA writes this next." : "BCA writes this for you."}
        </p>
        <p className="mt-1 text-sm leading-6 text-[var(--bp-muted)]">
          From {section.from?.join(", ").toLowerCase() || "your blueprint"}.
          {needs.length ? ` Best written after ${needs.join(" and ").toLowerCase()}.` : ""}
        </p>
        {queued ? null : (
          <div className="mt-3">
            <WriteButton refKey={refKey} label="Write it now" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bp-output">
      {/* key: a rewrite brings fresh text into the boxes. */}
      <div className="bp-no-print">
        <BlockBoxes key={built.generated_at} blocks={blocks} onSave={(next) => saveBlocks(refKey, next)} />
      </div>
      <div className="hidden print:block">
        <Blocks blocks={blocks} />
      </div>
      {handoffForSection(refKey) ? <SendToCampaigns sectionKey={refKey} name={section.title} /> : null}
      {section.link ? (
        <p className="bp-no-print mt-5 border-t border-[#e1e6ec] pt-3 text-sm">
          <Link href={href(section.link.href)} className="inline-flex items-center gap-1 font-semibold text-[var(--bp-blue)] hover:underline">
            {section.link.label}
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </p>
      ) : null}
    </div>
  );
}

/**
 * One block of the blueprint, straight on the white page: the title (info,
 * status, actions) over a light rule, then the content. Inputs are grey boxes
 * to write in; outputs sit in a white panel with a light edge.
 */

/** BCA's recommendation, one quiet line until the coach wants it. */
function TipToggle({ tip }: { tip: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bp-no-print mb-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--bp-blue)] hover:underline"
      >
        <Lightbulb className="h-3.5 w-3.5 text-[var(--bp-sky)]" aria-hidden />
        {open ? "Hide what BCA recommends" : "What BCA recommends"}
      </button>
      {open ? (
        <p className="mt-2 rounded-xl bg-[var(--bp-tint)] px-4 py-3 text-[0.9375rem] leading-[1.6] text-[#0b3f6b]">{tip}</p>
      ) : null}
    </div>
  );
}

export function SectionView({
  sectionRef,
  asLine = false,
  lineTitle,
  showAbout = false,
  bare = false,
  quiet = false,
  emptyHint,
  canWrite = true,
  startOpen,
  roomy = false,
}: {
  sectionRef: SectionRef;
  /** An expandable line. Used for the pieces inside a newsletter. */
  asLine?: boolean;
  lineTitle?: string;
  /** A short description under the title. Inner pieces leave this off. */
  showAbout?: boolean;
  /** The body only. The parent already has the title. */
  bare?: boolean;
  /** A line with a title and a chevron, and no status row. */
  quiet?: boolean;
  /** Replaces the empty "BCA writes this" panel. */
  emptyHint?: string;
  /** Offer the Write button. Coach-stored newsletters leave this off. */
  canWrite?: boolean;
  /** Open on first paint. */
  startOpen?: boolean;
  /** Taller writing boxes. Used for the newsletter issue itself. */
  roomy?: boolean;
}) {
  const { knowledge, payload, setSectionStatus, addNote, building, build, href, viewer } = usePractice();
  const focusKey = useSectionComments()?.openKey ?? null;
  const discussing = focusKey === sectionRef.key;
  // While one section is being discussed, the rest step back. Hover brings one forward to read.
  const receded = Boolean(focusKey && !discussing && sectionByKey(focusKey));
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState("");
  const { section, key, page } = sectionRef;
  const folded = asLine || section.face === "closed";
  const [open, setOpen] = useState(startOpen ?? !folded);
  const title = lineTitle ?? section.title;
  if (!knowledge || !payload) return null;

  const row = { ...knowledge, payload };
  const work = sectionWorkflow(sectionRef, row);
  const isOutput = section.source === "we_build";
  const built = knowledge.built_sections[key];
  const writing = building.active.includes(key);
  const busy = building.active.length > 0;
  const requests = (payload.review.notes?.value ?? []).filter((n) => n.section === key);
  const lastRequest = requests[requests.length - 1];
  const changeAsked = work.status === "todo" && work.owner === "bca" && Boolean(lastRequest);
  const selected = work.tracked ? work.status : "todo";
  // After About You, answers are BCA's to fill. The coach sees the same boxes, with a hint that BCA fills them.
  const bcaFills =
    !isOutput &&
    viewer === "coach" &&
    !sectionRef.group.yours &&
    !(section.fields ?? []).some((field) => fieldFilled(payload, field));

  function chooseStatus(status: SectionWorkflow["status"]) {
    setSectionStatus(key, status);
    setAsking(status === "todo" && isOutput && Boolean(built));
  }

  const menu: MenuItem[] = built
    ? [
        {
          label: "Rewrite",
          disabled: busy,
          onClick: () => {
            if (built.edited_at && !window.confirm("Rewriting replaces the edits to this section. Carry on?")) return;
            build(key);
          },
        },
        { label: "Copy", onClick: () => void navigator.clipboard?.writeText(blocksToMarkdown(built.blocks, 3)) },
        { label: "Ask for a change", onClick: () => setAsking(true) },
      ]
    : [];

  function sendAsk() {
    if (!ask.trim()) return;
    addNote(ask, page.slug, key);
    setAsk("");
    setAsking(false);
  }

  if (bare) {
    return (
      <div id={`s-${key.replace(":", "-")}`} className={`px-5 py-5 ${roomy ? "bp-issue-body" : ""}`}>
        <OutputBody refKey={key} section={section} emptyHint={emptyHint} canWrite={canWrite} />
      </div>
    );
  }

  return (
    <section
      id={`s-${key.replace(":", "-")}`}
      className={
        asLine
          ? `scroll-mt-24 border-b border-[#e6eaf0] bg-white last:border-b-0 print:border-0 print:opacity-100 ${receded ? "opacity-50 hover:opacity-100" : ""}`
          : `bp-section scroll-mt-24 rounded-2xl border bg-white transition-[opacity,box-shadow] duration-200 print:rounded-none print:border-0 print:opacity-100 print:shadow-none ${
              discussing
                ? "border-[#9cc9ec] shadow-[0_18px_40px_-18px_rgba(12,82,144,0.45)] ring-2 ring-[#cfe6f8]"
                : `border-[#dbe3ec] shadow-[0_1px_2px_rgba(5,30,54,0.05)] ${receded ? "opacity-50 hover:opacity-100" : ""}`
            }`
      }
    >
      <header
        className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 print:px-0 ${
          asLine ? "px-4 py-3" : `bp-head px-5 py-3 @2xl:px-6 ${open ? "rounded-t-2xl" : "rounded-2xl"}`
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {folded ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className="inline-flex min-w-0 items-start gap-1.5 text-left"
            >
              <ChevronDown
                className={`mt-1 h-4 w-4 shrink-0 text-[var(--bp-faint)] transition-transform ${
                  quiet ? (open ? "" : "-rotate-90") : open ? "rotate-180" : ""
                }`}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em] text-[var(--bp-ink)]">
                  {title}
                </span>
                {showAbout && section.about ? (
                  <span className="mt-0.5 block text-sm leading-5 text-[var(--bp-muted)]">{section.about}</span>
                ) : null}
              </span>
            </button>
          ) : (
            <h3 className="min-w-0 text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em] text-[var(--bp-ink)]">
              {title}
            </h3>
          )}
          {quiet ? null : (
            <InfoTip label={section.title}>
              <SectionAbout section={section} />
            </InfoTip>
          )}
        </div>
        <div className={`bp-no-print ml-auto flex shrink-0 items-center gap-2 ${quiet ? "hidden" : ""}`}>
          {writing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--bp-muted)]" aria-label="Writing" /> : null}
          {menu.length ? (
            <MoreMenu
              items={menu}
              note={built ? `Written ${formatDate(built.generated_at)}${built.edited_at ? `, edited ${formatDate(built.edited_at)}` : ""}` : undefined}
            />
          ) : null}
          <CommentButton sectionKey={key} title={section.title} />
          <StatusSwitch
            label={section.title}
            status={selected}
            onChange={chooseStatus}
            todoOwner={todoOwner(sectionRef)}
            bcaReview={work.status === "review" && work.owner === "bca"}
          />
        </div>
      </header>


      {folded && !open && !asLine ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-4 pt-1 @2xl:px-6">
          <p className="text-sm leading-6 text-[var(--bp-muted)]">{section.about}</p>
          {section.link ? (
            <Link href={href(section.link.href)} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--bp-blue)] hover:underline">
              {section.link.label}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}

      {open || folded ? (
      <div className={`${asLine ? "bg-[#f8fafc] px-4" : "px-5 @2xl:px-6"} pb-5 pt-4 print:block print:px-0 ${open ? "" : "hidden"}`}>
        {asking ? (
          <div className="bp-no-print mb-4 space-y-2">
            <textarea
              autoFocus
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              rows={3}
              placeholder="What should change? e.g. Make the headline about cash, not growth."
              className={`${INPUT_BOX} resize-y outline-none focus:border-[var(--bp-sky)] focus:ring-2 focus:ring-[#cfe6f8]`}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={sendAsk}
                className="rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--bp-blue)]"
              >
                Send to BCA
              </button>
              <button
                type="button"
                onClick={() => setAsking(false)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--bp-muted)] hover:bg-[var(--bp-tint)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {changeAsked && lastRequest ? (
          <p className="mb-4 rounded-xl bg-[#fff8ec] px-4 py-2.5 text-sm leading-6 text-[#6b4300]">
            <span className="font-semibold">Change asked {formatDate(lastRequest.at)}: </span>
            {lastRequest.body}
          </p>
        ) : null}

        {work.changed && work.changedFields.length === 0 ? (
          <p className="mb-4 text-sm text-[#8a5300]">Changed since this was signed off.</p>
        ) : null}

        {section.tip ? <TipToggle tip={section.tip} /> : null}

        {section.custom === "linkedin" ? (
          <LinkedInProfileSection />
        ) : isOutput ? (
          <OutputBody refKey={key} section={section} emptyHint={emptyHint} canWrite={canWrite} />
        ) : (
          <Fields section={section} changedFields={work.changedFields} bcaFills={bcaFills} />
        )}
      </div>
      ) : null}
    </section>
  );
}
