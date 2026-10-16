"use client";

import Link from "next/link";
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, ChevronUp, Lightbulb, Loader2, MoreHorizontal, Plus, Sparkles, X } from "lucide-react";

import {
  fieldValue,
  sectionByKey,
  type BlueprintSection,
  type FieldSpec,
  type SectionRef,
} from "@/lib/practiceKnowledge/blueprint";
import { sectionWorkflow, type SectionWorkflow } from "@/lib/practiceKnowledge/sectionWorkflow";
import { blocksToMarkdown } from "@/lib/practiceKnowledge/blocks";
import { formatFieldValue } from "@/lib/practiceKnowledge/exportMarkdown";

import { OwnerMark } from "../OwnerMark";
import { usePractice } from "../PracticeProvider";
import { BlockEditor } from "./BlockEditor";
import { Blocks } from "./Blocks";
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

/** The look of something the coach fills in: a light grey box with a soft edge that turns white while you type. */
const INPUT_BOX =
  "bp-input w-full rounded-xl border border-[#e6eaf0] bg-[#f4f6f9] px-3.5 py-2.5 text-left text-[0.9844rem] leading-[1.6] text-[var(--bp-ink)] transition-[background-color,border-color,box-shadow] placeholder:text-[#9aa8b8] hover:border-[#dbe1e9] hover:bg-[#eff2f6] focus:border-[#bfdcf2] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,143,212,0.12)]";

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
  return (
    <div className="relative">
      <select
        id={`f-${field.path}`}
        value={current}
        onChange={(e) => {
          if (e.target.value) saveField(field, e.target.value);
        }}
        className={`${INPUT_BOX} cursor-pointer appearance-none pr-10 ${current ? "" : "text-[#9aa8b8]"}`}
      >
        <option value="">Choose…</option>
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

/** Results and stories have structure (from, to, timeframe), so the conversation with BCA captures them. */
function StructuredBox({ field }: { field: FieldSpec }) {
  const { payload, setAssistantOpen, sample } = usePractice();
  const [height, setHeight] = useState<number | null>(null);
  if (!payload) return null;
  const values = formatFieldValue(payload, field);
  return (
    <div className="relative">
      <button
        type="button"
        id={`f-${field.path}`}
        onClick={() => !sample && setAssistantOpen(true)}
        style={height != null ? { height } : undefined}
        className={`${INPUT_BOX} block overflow-y-auto text-left`}
      >
        {values.length ? (
          <span className="block space-y-1.5">
            {values.map((v, i) => (
              <span key={i} className="block whitespace-pre-line">
                {v}
              </span>
            ))}
          </span>
        ) : (
          <span className="block text-[#9aa8b8]">{hint(field)}</span>
        )}
        <span className="bp-no-print mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--bp-blue)]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {values.length ? "Add or change with BCA" : "Add with BCA"}
        </span>
      </button>
      <ResizeGrip onResize={setHeight} />
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

/** One answer. A section with a single box uses its own title, so the box is not labelled again. */
function Field({ field, changed, solo }: { field: FieldSpec; changed?: boolean; solo?: boolean }) {
  const { payload } = usePractice();
  if (!payload) return null;
  const filled = formatFieldValue(payload, field).length > 0;
  const structured = field.kind === "results" || field.kind === "stories";
  const list = field.kind === "list";
  const showHelp = Boolean(field.help) && !lineHintOnly(field.help);
  const mark = changed ? (
    <span className="rounded-full bg-[#fff4e0] px-2 py-px text-[0.6875rem] font-semibold text-[#8a5300]">Changed</span>
  ) : !filled && field.required ? (
    <span className="rounded-full bg-[#fde8e6] px-2 py-px text-[0.6875rem] font-semibold text-[#9b2c2c]">Needed</span>
  ) : null;

  return (
    <div className="min-w-0">
      <div className={solo ? undefined : "mb-1.5 flex items-center gap-1.5 px-0.5"}>
        <label htmlFor={`f-${field.path}`} className={solo ? "sr-only" : "text-[0.875rem] font-semibold text-[var(--bp-ink)]"}>
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
      ) : structured ? (
        <StructuredBox field={field} />
      ) : (
        <AnswerBox field={field} />
      )}
      {list || (solo && (showHelp || mark)) ? (
        <div className="mt-1.5 flex items-center gap-2 px-0.5">
          {list ? <span className="text-xs text-[var(--bp-faint)]">One per line</span> : null}
          {solo && showHelp ? <InfoTip label={field.label}>{field.help}</InfoTip> : null}
          {solo && mark ? <span className="ml-auto">{mark}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function Fields({ section, changedFields }: { section: BlueprintSection; changedFields: string[] }) {
  const fields = section.fields ?? [];
  // Short answers sit two to a row. Widgets and long answers take the full width.
  const short = (f: FieldSpec) => !f.widget && (f.kind === "text" || f.kind === "enum");
  const shortCount = fields.filter(short).length;
  const showSocials = section.extras?.includes("socials");
  return (
    <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-2">
      {fields.map((field) => {
        const wide = Boolean(field.widget) || !short(field) || shortCount < 2;
        return (
          <Fragment key={field.path}>
            {showSocials && field.widget === "email" ? (
              <div className="@xl:col-span-2">
                <SetupSocials />
              </div>
            ) : null}
            <div className={wide ? "@xl:col-span-2" : undefined}>
              {field.widget ? (
                <SetupWidget field={field} changed={changedFields.includes(field.path)} />
              ) : (
                <Field
                  field={field}
                  changed={changedFields.includes(field.path)}
                  solo={fields.length === 1}
                />
              )}
            </div>
          </Fragment>
        );
      })}
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

function SendToCampaigns() {
  const { sendCampaign, href, sample } = usePractice();
  const [state, setState] = useState<{ busy?: string; done?: { id: string; label: string }; error?: string }>({});
  if (sample) return null;

  async function send(variant: "connector" | "conversation", label: string) {
    setState({ busy: variant });
    const res = await sendCampaign(variant);
    setState(res.campaignId ? { done: { id: res.campaignId, label } } : { error: res.error });
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
          onClick={() => void send("connector", "Connector campaign")}
          className="rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--bp-blue)] disabled:opacity-50"
        >
          {state.busy === "connector" ? "Creating…" : "Connector campaign"}
        </button>
        <button
          type="button"
          disabled={Boolean(state.busy)}
          onClick={() => void send("conversation", "Scorecard conversation")}
          className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--bp-ink)] ring-1 ring-[var(--bp-rule)] hover:ring-[var(--bp-sky)] disabled:opacity-50"
        >
          {state.busy === "conversation" ? "Creating…" : "Scorecard conversation"}
        </button>
        {state.done ? (
          <Link
            href={href(`/coach/campaigns/${state.done.id}`)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--bp-blue)] hover:underline"
          >
            {state.done.label} created. Open it
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
        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-[#e3e8ef] bg-white p-1 shadow-lg">
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

/** What BCA wrote, in a soft grey panel. */
function OutputBody({
  refKey,
  section,
  editing,
  setEditing,
}: {
  refKey: string;
  section: BlueprintSection;
  editing: boolean;
  setEditing: (v: boolean) => void;
}) {
  const { knowledge, building, editMessage, saveBlocks, href } = usePractice();
  const built = knowledge?.built_sections[refKey];
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
    <div className={panel}>
      {editing ? (
        <BlockEditor blocks={built.blocks} onSave={(blocks) => saveBlocks(refKey, blocks)} onCancel={() => setEditing(false)} />
      ) : (
        <Blocks blocks={built.blocks} onSaveMessage={(index, body) => editMessage(refKey, index, body)} />
      )}
      {refKey === "campaigns:messaging" && !editing ? <SendToCampaigns /> : null}
      {section.link && !editing ? (
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
const STATUS_OPTIONS: { id: SectionWorkflow["status"]; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];

const SELECTED: Record<SectionWorkflow["status"], string> = {
  todo: "bg-[#fde8e6] text-[#9b2c2c] shadow-[0_1px_2px_rgba(5,30,54,0.08)]",
  review: "bg-[#ffe14a] text-[#6b4500] shadow-[0_1px_2px_rgba(5,30,54,0.08)]",
  done: "bg-[#b6f3cc] text-[#0e6a36] shadow-[0_1px_2px_rgba(5,30,54,0.08)]",
};

/** To do, Review, and Done, with the current one selected. */
function StatusSwitch({
  label,
  status,
  onChange,
}: {
  label: string;
  status: SectionWorkflow["status"];
  onChange: (status: SectionWorkflow["status"]) => void;
}) {
  return (
    <div role="group" aria-label={`${label} status`} className="inline-flex rounded-full bg-[#f1f4f8] p-0.5">
      {STATUS_OPTIONS.map((option) => {
        const selected = status === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              if (!selected) onChange(option.id);
            }}
            className={`rounded-full px-2.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8fd4] ${
              selected
                ? `font-semibold ${SELECTED[option.id]}`
                : "font-medium text-[#5e7082] hover:text-[#3e4e60]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function SectionView({ sectionRef }: { sectionRef: SectionRef }) {
  const { knowledge, payload, setSectionStatus, addNote, building, build, href } = usePractice();
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState("");
  const { section, key, page } = sectionRef;
  const folded = section.face === "closed";
  const [open, setOpen] = useState(!folded);
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

  function chooseStatus(status: SectionWorkflow["status"]) {
    setSectionStatus(key, status);
    setAsking(status === "todo" && isOutput && Boolean(built));
  }

  const menu: MenuItem[] = built
    ? [
        { label: "Edit", onClick: () => setEditing(true) },
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

  return (
    <section
      id={`s-${key.replace(":", "-")}`}
      className="bp-section scroll-mt-24"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#eceff3] pb-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {folded ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className="inline-flex min-w-0 items-center gap-1.5 text-left"
            >
              <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--bp-faint)] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
              <h3 className="min-w-0 text-[1.125rem] font-semibold leading-snug tracking-[-0.01em] text-[var(--bp-ink)]">
                {section.title}
              </h3>
            </button>
          ) : (
            <h3 className="min-w-0 text-[1.125rem] font-semibold leading-snug tracking-[-0.01em] text-[var(--bp-ink)]">
              {section.title}
            </h3>
          )}
          <InfoTip label={section.title}>
            <SectionAbout section={section} />
          </InfoTip>
        </div>
        <div className="bp-no-print ml-auto flex shrink-0 items-center gap-2">
          {writing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--bp-muted)]" aria-label="Writing" /> : null}
          {work.owner ? <OwnerMark owner={work.owner} size="sm" /> : null}
          {menu.length && !editing ? (
            <MoreMenu
              items={menu}
              note={built ? `Written ${formatDate(built.generated_at)}${built.edited_at ? `, edited ${formatDate(built.edited_at)}` : ""}` : undefined}
            />
          ) : null}
          <StatusSwitch label={section.title} status={selected} onChange={chooseStatus} />
        </div>
      </header>

      {folded && !open ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3">
          <p className="text-sm leading-6 text-[var(--bp-muted)]">{section.about}</p>
          {section.link ? (
            <Link href={href(section.link.href)} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--bp-blue)] hover:underline">
              {section.link.label}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}

      {open ? (
      <div className="pt-5">
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

        {section.tip ? (
          <p className="mb-5 flex gap-2.5 rounded-xl bg-[var(--bp-tint)] px-4 py-3 text-[0.9375rem] leading-[1.6] text-[#0b3f6b]">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bp-sky)]" aria-hidden />
            <span>
              <span className="font-semibold">BCA recommends: </span>
              {section.tip}
            </span>
          </p>
        ) : null}

        {isOutput ? (
          <OutputBody refKey={key} section={section} editing={editing} setEditing={setEditing} />
        ) : (
          <Fields section={section} changedFields={work.changedFields} />
        )}
      </div>
      ) : null}
    </section>
  );
}
