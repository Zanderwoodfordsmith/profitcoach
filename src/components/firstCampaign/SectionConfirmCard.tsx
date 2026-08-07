"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronRight, GripVertical, Pencil, Plus, X } from "lucide-react";

export type SectionConfirmStatus = "pending" | "confirmed" | "editing";

const ACCENT = [
  { bar: "bg-[#0c5290]", text: "text-[#0c5290]" },
  { bar: "bg-[#1ca0c2]", text: "text-[#1ca0c2]" },
  { bar: "bg-[#42a1ee]", text: "text-[#0c5290]" },
  { bar: "bg-emerald-500", text: "text-emerald-800" },
  { bar: "bg-slate-500", text: "text-slate-700" },
] as const;

function AutoGrowTextarea({
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
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      placeholder={placeholder}
      className={`block w-full resize-none overflow-hidden bg-transparent outline-none ${className}`}
    />
  );
}

export function ProfileSectionStepper({
  sections,
  activeIndex,
  statuses,
  onSelect,
}: {
  sections: { id: string; label: string }[];
  activeIndex: number;
  statuses: Record<string, SectionConfirmStatus>;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Profile sections" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1 sm:gap-1.5">
        {sections.map((section, index) => {
          const status = statuses[section.id] ?? "pending";
          const confirmed = status === "confirmed";
          const active = index === activeIndex;
          const reachable =
            index === 0 ||
            confirmed ||
            sections
              .slice(0, index)
              .every((s) => statuses[s.id] === "confirmed");
          const canOpen =
            index <= activeIndex ||
            confirmed ||
            (reachable &&
              index > 0 &&
              statuses[sections[index - 1]!.id] === "confirmed");

          return (
            <li key={section.id} className="flex items-center gap-1 sm:gap-1.5">
              {index > 0 ? (
                <span
                  className={`hidden h-px w-3 sm:block ${
                    confirmed || active ? "bg-slate-300" : "bg-slate-200"
                  }`}
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                disabled={!canOpen && !active}
                onClick={() => canOpen && onSelect(index)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-[13px] ${
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : confirmed
                      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200/80"
                      : canOpen
                        ? "bg-white/70 text-slate-600 hover:bg-white"
                        : "cursor-not-allowed bg-white/40 text-slate-300"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    active
                      ? "bg-white/20 text-white"
                      : confirmed
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {confirmed && !active ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </span>
                {section.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Compact row for completed (above) or upcoming (below) sections. */
export function CollapsedSectionRow({
  index,
  title,
  summary,
  state,
  onClick,
}: {
  index: number;
  title: string;
  summary?: string;
  state: "done" | "upcoming";
  onClick?: () => void;
}) {
  const done = state === "done";
  const clickable = Boolean(onClick);

  const inner = (
    <>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          done
            ? "bg-emerald-600 text-white"
            : "bg-slate-200/80 text-slate-400"
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-semibold ${
            done ? "text-slate-600" : "text-slate-400"
          }`}
        >
          {title}
        </span>
        {summary ? (
          <span
            className={`mt-0.5 block truncate text-xs ${
              done ? "text-slate-400" : "text-slate-300"
            }`}
          >
            {summary}
          </span>
        ) : null}
      </span>
      {clickable ? (
        <ChevronRight
          className={`h-4 w-4 shrink-0 ${done ? "text-slate-300" : "text-slate-200"}`}
        />
      ) : null}
    </>
  );

  const className = `flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
    done
      ? "border-slate-200/70 bg-white/45 text-slate-600 hover:border-slate-300 hover:bg-white/70"
      : "border-transparent bg-slate-100/40 text-slate-400"
  }`;

  if (clickable) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }

  return <div className={`${className} cursor-default`}>{inner}</div>;
}

/**
 * Facilitated review panel — glass surface, accent rail, green confirm.
 */
export function SectionConfirmCard({
  title,
  hint,
  status,
  onConfirm,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  children,
  editChildren,
  index,
  total,
  accentIndex,
  confirmLabel = "Looks right",
  hideStepLabel = false,
  actionsExtra,
}: {
  title: string;
  hint?: string;
  status: SectionConfirmStatus;
  onConfirm: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  children: ReactNode;
  editChildren?: ReactNode;
  index: number;
  total: number;
  accentIndex?: number;
  confirmLabel?: string;
  hideStepLabel?: boolean;
  actionsExtra?: ReactNode;
}) {
  const confirmed = status === "confirmed";
  const editing = status === "editing";
  const accent = ACCENT[(accentIndex ?? index) % ACCENT.length];

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl transition ${
        confirmed
          ? "border-emerald-200/80 bg-white/75 shadow-[0_8px_30px_rgba(16,185,129,0.08)]"
          : editing
            ? "border-sky-200/90 bg-white/85 shadow-[0_12px_40px_rgba(12,82,144,0.10)]"
            : "border-white/70 bg-white/60 shadow-[0_10px_40px_rgba(15,23,42,0.06)]"
      }`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${accent.bar}`} aria-hidden />

      <div className="px-5 py-4 pl-6 sm:px-7 sm:py-5 sm:pl-8">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {!hideStepLabel ? (
              <p
                className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${accent.text}`}
              >
                {index + 1} of {total}
              </p>
            ) : null}
            <h3
              className={`text-xl font-semibold tracking-tight text-slate-900 sm:text-[1.35rem] ${
                hideStepLabel ? "" : "mt-1"
              }`}
            >
              {title}
            </h3>
            {hint ? (
              <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-slate-500">
                {hint}
              </p>
            ) : null}
          </div>
          {confirmed ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100/90 px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
              Confirmed
            </span>
          ) : null}
        </div>

        <div className="text-[15px] leading-relaxed text-slate-700 sm:text-base">
          {editing && editChildren ? editChildren : children}
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          {editing ? (
            <>
              <button
                type="button"
                onClick={onSaveEdit}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Save changes
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100/80 hover:text-slate-700"
              >
                Cancel
              </button>
            </>
          ) : confirmed ? (
            <button
              type="button"
              onClick={onStartEdit}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-900"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit again
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onConfirm}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-500"
              >
                <Check className="h-4 w-4" strokeWidth={2.5} />
                {confirmLabel}
              </button>
              <button
                type="button"
                onClick={onStartEdit}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/40 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white/80 hover:text-slate-900"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            </>
          )}
          {actionsExtra}
        </div>
      </div>
    </section>
  );
}

type SortableLine = { id: string; text: string };

function splitLabelledLine(text: string): { label: string | null; body: string } {
  const idx = text.indexOf(":");
  if (idx > 0 && idx < 48) {
    return {
      label: text.slice(0, idx).trim(),
      body: text.slice(idx + 1).trim(),
    };
  }
  return { label: null, body: text };
}

function SortableLineRow({
  item,
  variant,
  onChangeText,
  onRemove,
}: {
  item: SortableLine;
  variant: "default" | "soft";
  onChangeText: (value: string) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const { label, body } = splitLabelledLine(item.text);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-2 rounded-xl border px-3 py-2 transition ${
        variant === "soft"
          ? "border-slate-200/60 bg-slate-50/70 hover:border-slate-300/80"
          : "border-white/80 bg-white/70 shadow-sm shadow-slate-900/[0.03] hover:border-slate-200"
      } ${isDragging ? "shadow-lg ring-1 ring-sky-200" : ""}`}
    >
      <button
        type="button"
        className="mt-0.5 cursor-grab touch-none rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        {label ? (
          <>
            <p className="text-[15px] font-semibold leading-snug text-slate-900">
              {label}
            </p>
            <AutoGrowTextarea
              value={body}
              onChange={(nextBody) =>
                onChangeText(nextBody.trim() ? `${label}: ${nextBody}` : label)
              }
              className="mt-0.5 text-[15px] leading-snug text-slate-700"
            />
          </>
        ) : (
          <AutoGrowTextarea
            value={item.text}
            onChange={onChangeText}
            className="text-[15px] leading-snug text-slate-800"
          />
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="mt-0.5 rounded-lg p-1.5 text-slate-300 opacity-70 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
        aria-label="Remove"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}

function newLineId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Interactive keep / remove / reorder list. */
export function InteractiveLineList({
  lines,
  onChange,
  emptyLabel = "Nothing here yet — add one below.",
  addPlaceholder = "Add another…",
  variant = "default",
}: {
  lines: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
  addPlaceholder?: string;
  variant?: "default" | "soft";
}) {
  const [draft, setDraft] = useState("");
  const listKey = useId();
  const [itemIds, setItemIds] = useState<string[]>(() =>
    lines.map(() => newLineId())
  );

  useEffect(() => {
    setItemIds((prev) => {
      if (prev.length === lines.length) return prev;
      if (prev.length < lines.length) {
        return [
          ...prev,
          ...Array.from({ length: lines.length - prev.length }, () => newLineId()),
        ];
      }
      return prev.slice(0, lines.length);
    });
  }, [lines.length, listKey]);

  const items: SortableLine[] = lines.map((text, index) => ({
    id: itemIds[index] ?? `${listKey}-${index}`,
    text,
  }));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function removeAt(index: number) {
    setItemIds((prev) => prev.filter((_, i) => i !== index));
    onChange(lines.filter((_, i) => i !== index));
  }

  function updateAt(index: number, value: string) {
    onChange(lines.map((line, i) => (i === index ? value : line)));
  }

  function addLine() {
    const t = draft.trim();
    if (!t) return;
    setItemIds((prev) => [...prev, newLineId()]);
    onChange([...lines, t]);
    setDraft("");
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setItemIds((prev) => arrayMove(prev, oldIndex, newIndex));
    onChange(arrayMove(lines, oldIndex, newIndex));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {lines.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200/80 bg-white/40 px-4 py-4 text-center text-sm text-slate-400">
          {emptyLabel}
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-1.5">
              {items.map((item, index) => (
                <SortableLineRow
                  key={item.id}
                  item={item}
                  variant={variant}
                  onChangeText={(value) => updateAt(index, value)}
                  onRemove={() => removeAt(index)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <div className="mt-0.5 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addLine();
            }
          }}
          placeholder={addPlaceholder}
          className="min-w-0 flex-1 rounded-xl border border-slate-200/80 bg-white/50 px-3.5 py-2.5 text-[15px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-400/20"
        />
        <button
          type="button"
          onClick={addLine}
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/60 px-3.5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Drag to prioritise · × to drop · add anything that&apos;s missing.
      </p>
    </div>
  );
}

export function BulletListEditor({
  lines,
  onChange,
  placeholder = "One item per line",
}: {
  lines: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <InteractiveLineList
      lines={lines}
      onChange={onChange}
      addPlaceholder={placeholder}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full rounded-xl border border-slate-200/80 bg-white/60 px-3.5 py-3 text-[15px] leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-400/20"
    />
  );
}

export function ProfileReviewShell({
  sticky,
  children,
  footer,
}: {
  sticky?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative">
      {sticky ? (
        <div className="sticky top-0 z-20 -mx-1 mb-4 border-b border-slate-100/80 bg-white/90 px-1 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75">
          {sticky}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:gap-3.5">{children}</div>
      {footer ? (
        <div className="sticky bottom-3 z-10 mt-6 rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-3.5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
