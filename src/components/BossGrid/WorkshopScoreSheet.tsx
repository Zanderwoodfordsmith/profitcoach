"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Calendar,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Hourglass,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ASSESSMENT_QUESTIONS } from "@/lib/assessmentQuestions";
import { AREAS, getPlaybookMeta, LEVELS } from "@/lib/bossData";
import type { AnswersMap } from "@/lib/bossScores";
import type { ActionItem, PlaybookContent } from "@/lib/playbookContentTypes";
import {
  agreedActionsCount,
  appendWorkshopActivity,
  computeProspectImportance,
  loadPlaybookProspectScores,
  getChecklistDescendantProgress,
  parseAgreedActions,
  parsePlaybookAssignees,
  parsePlaybookDates,
  parseWorkshopActivity,
  parseWorkshopComments,
  playbookActionNotesKey,
  playbookActivityKey,
  playbookAssigneesKey,
  playbookCommentsKey,
  playbookDatesKey,
  playbookPriorityKey,
  playbookProspectScoresKey,
  resolveWorkshopTeamMembers,
  SCORE_LABELS,
  serializeAgreedActions,
  serializePlaybookAssignees,
  serializePlaybookDates,
  serializePlaybookProspectScores,
  serializeWorkshopActivity,
  serializeWorkshopComments,
  serializeWorkshopTeamMembers,
  syncChecklistParentDone,
  WORKSHOP_CHECKLIST_MAX_DEPTH,
  WORKSHOP_TEAM_MEMBERS_KEY,
  type CustomWorkshopAction,
  type PlaybookActionMeta,
  type PlaybookAgreedActions,
  type PlaybookDates,
  type PlaybookProspectScores,
  type WorkshopActionGroup,
  type WorkshopActivityEvent,
  type WorkshopComment,
  type WorkshopTeamMember,
} from "@/lib/playbookSessionNotes";
import { BOSS_PRO_SCORE_LABELS } from "@/lib/bossProScoringLabels";
import {
  getBossGridNeighbors,
  type BossGridDirection,
  type BossGridNeighbor,
} from "@/lib/bossGridNavigation";
import type { BossQuestionTooltipAnchor } from "./bossQuestionTooltip";
import { WorkshopActivityPanel } from "./WorkshopActivityPanel";
import {
  WorkshopAssigneesField,
  WorkshopPlaybookMetaFields,
  WORKSHOP_PLAYBOOK_TABLE_GRID,
} from "./WorkshopPlaybookMetaFields";

const SCORE_PILLS = [
  {
    value: 0 as const,
    label: BOSS_PRO_SCORE_LABELS[0],
    dot: "bg-red-500",
    active: "border-red-400 bg-red-50 text-red-900 ring-1 ring-red-300/60",
    idle: "border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-red-50/40",
  },
  {
    value: 1 as const,
    label: BOSS_PRO_SCORE_LABELS[1],
    dot: "bg-yellow-400",
    active: "border-yellow-400 bg-yellow-50 text-yellow-950 ring-1 ring-yellow-300/60",
    idle: "border-slate-200 bg-white text-slate-600 hover:border-yellow-200 hover:bg-yellow-50/40",
  },
  {
    value: 2 as const,
    label: BOSS_PRO_SCORE_LABELS[2],
    dot: "bg-emerald-500",
    active: "border-emerald-400 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-300/60",
    idle: "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/40",
  },
];

function WorkshopScorePillDropdown({
  value,
  onPick,
  onClear,
  scoringGuide,
}: {
  value: 0 | 1 | 2 | undefined;
  onPick: (score: 0 | 1 | 2) => void;
  onClear: () => void;
  scoringGuide: (typeof ASSESSMENT_QUESTIONS)[number]["scoringGuide"];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = SCORE_PILLS.find((pill) => pill.value === value);
  const guideByValue = {
    0: scoringGuide.red,
    1: scoringGuide.amber,
    2: scoringGuide.green,
  } as const;
  const selectedGuide = value !== undefined ? guideByValue[value] : undefined;

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const triggerClass = selected
    ? `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition hover:opacity-90 ${selected.active}`
    : "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-500 transition hover:border-slate-400 hover:text-slate-700";

  return (
    <div ref={rootRef} className="relative shrink-0 self-start">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={selected ? `Score: ${selected.label}` : "Set score"}
        title={selectedGuide}
      >
        {selected ? (
          <>
            <span className={`h-2 w-2 shrink-0 rounded-full ${selected.dot}`} aria-hidden />
            {selected.label}
          </>
        ) : (
          "Set score"
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-20 mt-1.5 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
          role="listbox"
          aria-label="Score options"
        >
          {SCORE_PILLS.map((pill) => {
            const active = value === pill.value;
            const guide = guideByValue[pill.value];
            return (
              <button
                key={pill.value}
                type="button"
                role="option"
                aria-selected={active}
                aria-label={`${pill.label}. ${guide}`}
                onClick={() => {
                  onPick(pill.value);
                  setOpen(false);
                }}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                  active ? pill.active : pill.idle
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${pill.dot}`} aria-hidden />
                  {pill.label}
                </span>
                <span className="mt-1 block pl-4 text-xs leading-snug text-slate-600">{guide}</span>
              </button>
            );
          })}
          {value !== undefined ? (
            <button
              type="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="mt-0.5 w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              Clear score
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const CHECKLIST_LINE = /^-\s*\[([ xX])\]\s*(.+)$/;

function WorkshopSectionDivider() {
  return <div className="border-t border-slate-200" role="presentation" />;
}

function isLongPlaybookNotes(text: string): boolean {
  if (!text.trim()) return false;
  return text.split("\n").length > 3 || text.length > 180;
}

const PLAYBOOK_NOTES_INPUT_CLASS =
  "w-full resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-base leading-relaxed text-slate-900 outline-none placeholder:text-slate-400";

function WorkshopPlaybookNotesField({
  id,
  value,
  editable,
  onChange,
  onBlur,
  placeholder = "Add notes…",
}: {
  id: string;
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const long = isLongPlaybookNotes(value);
  const [expanded, setExpanded] = useState(() => !long);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    if (editable && expanded) adjustHeight();
  }, [value, editable, expanded]);

  const expandNotes = () => {
    setExpanded(true);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      adjustHeight();
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  if (!editable) {
    if (!value.trim()) return null;
    if (!long || expanded) {
      return (
        <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-600">{value}</p>
      );
    }
    return (
      <div>
        <p className="line-clamp-3 whitespace-pre-wrap text-base leading-relaxed text-slate-600">
          {value}
        </p>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 text-sm font-medium text-sky-700 transition hover:text-sky-800"
        >
          See more
        </button>
      </div>
    );
  }

  if (long && !expanded) {
    return (
      <div>
        <p className="line-clamp-3 whitespace-pre-wrap text-base leading-relaxed text-slate-900">
          {value}
        </p>
        <button
          type="button"
          onClick={expandNotes}
          className="mt-1 text-sm font-medium text-sky-700 transition hover:text-sky-800"
        >
          See more
        </button>
      </div>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      rows={1}
      className={PLAYBOOK_NOTES_INPUT_CLASS}
      placeholder={placeholder}
      style={{ minHeight: "1.625rem" }}
    />
  );
}

const GRID_NAV_POSITION: Record<BossGridDirection, string> = {
  up: "left-1/2 -top-11 -translate-x-1/2",
  down: "-bottom-11 left-1/2 -translate-x-1/2",
  left: "-left-11 top-1/2 -translate-y-1/2",
  right: "-right-11 top-1/2 -translate-y-1/2",
};

const GRID_NAV_BUTTON_CLASS =
  "absolute z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-transparent text-white/55 shadow-none transition duration-200 hover:border-white/15 hover:bg-white/10 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35";

const GRID_NAV_ICON: Record<BossGridDirection, typeof ChevronUp> = {
  up: ChevronUp,
  down: ChevronDown,
  left: ChevronLeft,
  right: ChevronRight,
};

function WorkshopGridNavButton({
  direction,
  neighbor,
  onNavigate,
}: {
  direction: BossGridDirection;
  neighbor: BossGridNeighbor;
  onNavigate: (ref: string) => void;
}) {
  const Icon = GRID_NAV_ICON[direction];

  return (
    <button
      type="button"
      onClick={() => onNavigate(neighbor.ref)}
      className={`${GRID_NAV_BUTTON_CLASS} ${GRID_NAV_POSITION[direction]}`}
      aria-label={`Go to ${neighbor.name} (${neighbor.ref})`}
      title={`${neighbor.name} (${neighbor.ref})`}
    >
      <Icon
        className="h-5 w-5 shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
        strokeWidth={2}
        aria-hidden
      />
    </button>
  );
}

function WorkshopGridNavButtons({
  refKey,
  onNavigate,
}: {
  refKey: string;
  onNavigate: (ref: string) => void;
}) {
  const neighbors = getBossGridNeighbors(refKey);
  const directions = (["up", "down", "left", "right"] as const).filter(
    (direction) => neighbors[direction]
  );

  if (directions.length === 0) return null;

  return (
    <>
      {directions.map((direction) => {
        const neighbor = neighbors[direction];
        if (!neighbor) return null;
        return (
          <WorkshopGridNavButton
            key={direction}
            direction={direction}
            neighbor={neighbor}
            onNavigate={onNavigate}
          />
        );
      })}
    </>
  );
}

function collectPlaybookActions(content: PlaybookContent): ActionItem[] {
  if (
    content.actionSections?.length &&
    content.actionSections.some((s) => s.actions?.length)
  ) {
    return content.actionSections.flatMap((s) => s.actions ?? []);
  }
  return content.actions ?? [];
}

function ActionDetailContent({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/);

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIdx) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const isChecklist = lines.length > 0 && lines.every((l) => CHECKLIST_LINE.test(l.trim()));

        if (isChecklist) {
          return (
            <ul key={blockIdx} className="space-y-1.5 rounded-lg border border-slate-100 bg-white p-2.5">
              {lines.map((line, lineIdx) => {
                const match = line.trim().match(CHECKLIST_LINE);
                if (!match) return null;
                const checked = match[1].toLowerCase() === "x";
                return (
                  <li key={lineIdx} className="flex items-start gap-2 text-sm leading-snug text-slate-700">
                    <span
                      className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                        checked
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                      aria-hidden
                    >
                      {checked ? (
                        <svg viewBox="0 0 12 12" className="h-2 w-2" fill="none">
                          <path
                            d="M2.5 6L5 8.5L9.5 3.5"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                    <span className={checked ? "text-slate-500 line-through" : undefined}>{match[2]}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        if (lines[0]?.startsWith("### ")) {
          return (
            <div key={blockIdx}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {lines[0].replace(/^###\s*/, "")}
              </p>
              {lines.length > 1 ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {lines.slice(1).join("\n")}
                </div>
              ) : null}
            </div>
          );
        }

        return (
          <div key={blockIdx} className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {block}
          </div>
        );
      })}
    </div>
  );
}

function ScheduleFields({
  item,
  onChange,
  compact,
}: {
  item: Pick<CustomWorkshopAction, "startDate" | "dueDate" | "timeEstimateMinutes">;
  onChange: (patch: Partial<CustomWorkshopAction>) => void;
  compact?: boolean;
}) {
  const inputClass = compact
    ? "h-7 rounded border border-slate-200 bg-white px-1.5 text-[11px] text-slate-700 outline-none focus:border-sky-300"
    : "h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-sky-300";

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "" : "mt-1.5"}`}>
      <label className="inline-flex items-center gap-1 text-[11px] text-slate-500">
        <Calendar className="h-3 w-3" aria-hidden />
        <input
          type="date"
          value={item.startDate ?? ""}
          onChange={(e) => onChange({ startDate: e.target.value || undefined })}
          className={inputClass}
          aria-label="Start date"
        />
      </label>
      <label className="inline-flex items-center gap-1 text-[11px] text-slate-500">
        <span>→</span>
        <input
          type="date"
          value={item.dueDate ?? ""}
          onChange={(e) => onChange({ dueDate: e.target.value || undefined })}
          className={inputClass}
          aria-label="Due date"
        />
      </label>
      <label className="inline-flex items-center gap-1 text-[11px] text-slate-500">
        <Clock className="h-3 w-3" aria-hidden />
        <input
          type="number"
          min={0}
          step={15}
          value={item.timeEstimateMinutes ?? ""}
          onChange={(e) =>
            onChange({
              timeEstimateMinutes: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          placeholder="min"
          className={`${inputClass} w-14`}
          aria-label="Time estimate in minutes"
        />
      </label>
    </div>
  );
}

const CHECKLIST_INDENT_REM = 1.25;
const CHECKLIST_RING_RADIUS = 8;
const CHECKLIST_RING_CIRCUMFERENCE = 2 * Math.PI * CHECKLIST_RING_RADIUS;
const CHECKLIST_GRID_CLASS = WORKSHOP_PLAYBOOK_TABLE_GRID;

const CHECKLIST_DONE_TEXT_CLASS =
  "text-slate-400 line-through decoration-slate-300 decoration-1";

function formatChecklistDate(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatChecklistEstimate(minutes?: number): string {
  if (minutes == null || minutes <= 0) return "—";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function checklistItemHasMeta(item: CustomWorkshopAction): boolean {
  return Boolean(
    item.assigneeIds?.length ||
      item.startDate ||
      item.dueDate ||
      (item.timeEstimateMinutes != null && item.timeEstimateMinutes > 0)
  );
}

function WorkshopChecklistDateCell({
  label,
  value,
  editable,
  onChange,
}: {
  label: string;
  value?: string;
  editable: boolean;
  onChange: (value: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const display = value ? formatChecklistDate(value) : label;

  const openPicker = () => {
    if (!editable) return;
    const input = inputRef.current;
    if (!input) return;
    input.showPicker?.();
    input.focus();
  };

  if (!editable) {
    if (!value) return <CalendarPlus className="h-4 w-4 text-slate-300" aria-hidden />;
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center text-slate-500"
        title={display}
      >
        <CalendarPlus className="h-4 w-4" aria-hidden />
      </span>
    );
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={openPicker}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-slate-50 ${
          value ? "text-slate-600" : "text-slate-400 hover:text-slate-600"
        }`}
        title={value ? display : label}
        aria-label={value ? `${label}: ${display}` : label}
      >
        <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden />
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        className="pointer-events-none absolute h-px w-px opacity-0"
        tabIndex={-1}
        aria-label={label}
      />
    </span>
  );
}

function WorkshopChecklistEstimateCell({
  value,
  editable,
  onChange,
}: {
  value?: number;
  editable: boolean;
  onChange: (value: number | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const display = formatChecklistEstimate(value);

  if (!editable) {
    if (value == null || value <= 0) {
      return <Hourglass className="h-4 w-4 text-slate-300" aria-hidden />;
    }
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center text-slate-600"
        title={display}
      >
        <Hourglass className="h-4 w-4" aria-hidden />
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-slate-50 ${
          value != null && value > 0 ? "text-slate-600" : "text-slate-400 hover:text-slate-600"
        }`}
        title={value != null && value > 0 ? display : "Set time estimate"}
        aria-label={value != null && value > 0 ? `Time estimate: ${display}` : "Set time estimate"}
      >
        <Hourglass className="h-4 w-4 shrink-0" aria-hidden />
      </button>
      {open ? (
        <input
          ref={inputRef}
          type="number"
          min={0}
          step={15}
          value={value ?? ""}
          onChange={(event) =>
            onChange(event.target.value ? Number(event.target.value) : undefined)
          }
          onBlur={() => setOpen(false)}
          placeholder="min"
          className="absolute right-0 top-full z-20 mt-1 w-14 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 shadow-sm outline-none focus:border-sky-300"
          aria-label="Time estimate in minutes"
        />
      ) : null}
    </div>
  );
}

function WorkshopChecklistToggle({
  checked,
  editable,
  onChange,
  label,
  progress,
}: {
  checked: boolean;
  editable: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  progress?: { completed: number; total: number };
}) {
  const hasChildren = progress != null && progress.total > 0;
  const ratio = hasChildren ? progress.completed / progress.total : checked ? 1 : 0;
  const allDone = hasChildren ? progress.completed === progress.total : checked;
  const partial = hasChildren && ratio > 0 && ratio < 1;

  const circleClass = `relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
    allDone
      ? "border-emerald-500 bg-emerald-500 shadow-[0_1px_3px_rgba(16,185,129,0.35)]"
      : partial
        ? "border-emerald-200 bg-white"
        : "border-slate-300 bg-white"
  } ${editable && !allDone ? "hover:border-slate-400" : ""}`;

  const tick = allDone ? (
    <Check className="relative z-[1] h-2.5 w-2.5 stroke-[2.75] text-white" aria-hidden />
  ) : null;

  const progressRing =
    hasChildren && !allDone ? (
      <svg
        className="pointer-events-none absolute inset-0 -rotate-90"
        viewBox="0 0 20 20"
        aria-hidden
      >
        <circle
          cx="10"
          cy="10"
          r={CHECKLIST_RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-slate-200"
        />
        {ratio > 0 ? (
          <circle
            cx="10"
            cy="10"
            r={CHECKLIST_RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-emerald-500"
            strokeDasharray={`${ratio * CHECKLIST_RING_CIRCUMFERENCE} ${CHECKLIST_RING_CIRCUMFERENCE}`}
          />
        ) : null}
      </svg>
    ) : null;

  const ariaChecked = hasChildren
    ? progress.completed === progress.total
      ? true
      : progress.completed > 0
        ? "mixed"
        : false
    : checked;

  if (!editable) {
    return (
      <span
        role="checkbox"
        aria-checked={ariaChecked === "mixed" ? "mixed" : ariaChecked}
        aria-label={`Done: ${label || "item"}${hasChildren ? `, ${progress.completed} of ${progress.total}` : ""}`}
        className={circleClass}
      >
        {progressRing}
        {tick}
      </span>
    );
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={ariaChecked === "mixed" ? "mixed" : ariaChecked}
      aria-label={`Mark done: ${label || "item"}${hasChildren ? `, ${progress.completed} of ${progress.total}` : ""}`}
      onClick={() => onChange(!allDone)}
      className={`${circleClass} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/45 focus-visible:ring-offset-1`}
    >
      {progressRing}
      {tick}
    </button>
  );
}

function WorkshopChecklistCard({
  group,
  editable,
  teamMembers,
  onTeamMembersChange,
  onChange,
  onRemove,
}: {
  group: WorkshopActionGroup;
  editable: boolean;
  teamMembers: WorkshopTeamMember[];
  onTeamMembersChange: (members: WorkshopTeamMember[]) => void;
  onChange: (next: WorkshopActionGroup) => void;
  onRemove: () => void;
}) {
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const itemInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const descendantProgress = useMemo(
    () => group.items.map((_, index) => getChecklistDescendantProgress(group.items, index)),
    [group.items]
  );

  const showMetaColumns =
    editable || group.items.some((item) => checklistItemHasMeta(item));

  useEffect(() => {
    if (!focusItemId) return;
    const el = itemInputRefs.current.get(focusItemId);
    if (el) {
      el.focus();
      setFocusItemId(null);
    }
  }, [group.items, focusItemId]);

  const commitItems = (items: CustomWorkshopAction[]) => {
    onChange({ ...group, items: syncChecklistParentDone(items) });
  };

  const updateItem = (id: string, patch: Partial<CustomWorkshopAction>) => {
    commitItems(
      group.items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const removeItem = (id: string, focusPreviousId?: string) => {
    commitItems(group.items.filter((item) => item.id !== id));
    if (focusPreviousId) setFocusItemId(focusPreviousId);
  };

  const insertItemAfter = (index: number) => {
    const current = group.items[index];
    if (!current) return;
    const depth = current.depth ?? 0;
    const newItem: CustomWorkshopAction = { id: crypto.randomUUID(), text: "", depth };
    const items = [...group.items];
    items.splice(index + 1, 0, newItem);
    commitItems(items);
    setFocusItemId(newItem.id);
  };

  const indentItem = (index: number, outdent: boolean) => {
    const current = group.items[index];
    if (!current) return;
    const currentDepth = current.depth ?? 0;
    if (outdent) {
      if (currentDepth === 0) return;
      updateItem(current.id, { depth: currentDepth - 1 });
      return;
    }
    const previous = group.items[index - 1];
    if (!previous) return;
    const maxDepth = Math.min(WORKSHOP_CHECKLIST_MAX_DEPTH, (previous.depth ?? 0) + 1);
    if (currentDepth >= maxDepth) return;
    updateItem(current.id, { depth: currentDepth + 1 });
  };

  const toggleItemDone = (index: number) => {
    const progress = descendantProgress[index];
    const current = group.items[index];
    if (!current) return;

    if (progress.total > 0) {
      const markDone = progress.completed !== progress.total;
      const parentDepth = current.depth ?? 0;
      commitItems(
        group.items.map((item, itemIndex) => {
          if (itemIndex === index) return { ...item, done: markDone };
          if (itemIndex <= index) return item;
          const depth = item.depth ?? 0;
          if (depth <= parentDepth) return item;
          return { ...item, done: markDone };
        })
      );
      return;
    }

    updateItem(current.id, { done: !current.done });
  };

  const addItem = () => {
    const newItem: CustomWorkshopAction = { id: crypto.randomUUID(), text: "", depth: 0 };
    commitItems([...group.items, newItem]);
    setFocusItemId(newItem.id);
  };

  const canRemoveChecklist = editable && group.items.every((item) => !item.text.trim());

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        {editable ? (
          <input
            type="text"
            value={group.title}
            onChange={(e) => onChange({ ...group, title: e.target.value })}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-slate-900 outline-none"
          />
        ) : (
          <p className="text-sm font-semibold text-slate-900">{group.title}</p>
        )}
        {canRemoveChecklist ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-slate-400 hover:text-red-600"
            aria-label={`Remove ${group.title}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      {group.items.length > 0 ? (
        <div className="mt-2 overflow-visible">
          {showMetaColumns ? (
            <div
              className={`${CHECKLIST_GRID_CLASS} border-b border-slate-100 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400`}
            >
              <span aria-hidden />
              <span>Action</span>
              <span className="text-center">Assignees</span>
              <span className="text-center">Start</span>
              <span className="text-center">Due</span>
              <span className="text-center">Est.</span>
              <span aria-hidden />
            </div>
          ) : null}

          <ul className={`${showMetaColumns ? "mt-1.5" : ""} space-y-1`}>
            {group.items.map((item, index) => {
              const depth = item.depth ?? 0;
              const progress = descendantProgress[index];
              const showProgressLabel = progress.total >= 2;

              const actionCell = (
                <div
                  className="flex min-w-0 flex-1 items-center gap-2"
                  style={{ paddingLeft: `${depth * CHECKLIST_INDENT_REM}rem` }}
                >
                  {editable ? (
                    <input
                      ref={(el) => {
                        if (el) itemInputRefs.current.set(item.id, el);
                        else itemInputRefs.current.delete(item.id);
                      }}
                      type="text"
                      value={item.text}
                      onChange={(e) => updateItem(item.id, { text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          insertItemAfter(index);
                          return;
                        }
                        if (e.key === "Tab") {
                          e.preventDefault();
                          indentItem(index, e.shiftKey);
                          return;
                        }
                        if (
                          e.key === "Backspace" &&
                          item.text.length === 0 &&
                          group.items.length > 1
                        ) {
                          e.preventDefault();
                          const prevId = index > 0 ? group.items[index - 1]?.id : undefined;
                          removeItem(item.id, prevId);
                        }
                      }}
                      placeholder="Item name"
                      className={`min-w-0 flex-1 border-0 bg-transparent py-0.5 text-base outline-none placeholder:text-slate-400 ${
                        item.done ? CHECKLIST_DONE_TEXT_CLASS : "text-slate-900"
                      }`}
                    />
                  ) : (
                    <span
                      className={`min-w-0 flex-1 text-base ${
                        item.done ? CHECKLIST_DONE_TEXT_CLASS : "text-slate-800"
                      }`}
                    >
                      {item.text}
                    </span>
                  )}
                  {showProgressLabel ? (
                    <span className="shrink-0 text-xs tabular-nums text-slate-400">
                      {progress.completed}/{progress.total}
                    </span>
                  ) : null}
                </div>
              );

              if (!showMetaColumns) {
                return (
                  <li key={item.id} className="group flex items-center gap-2">
                    <WorkshopChecklistToggle
                      checked={item.done === true}
                      editable={editable}
                      progress={progress.total > 0 ? progress : undefined}
                      onChange={() => toggleItemDone(index)}
                      label={item.text}
                    />
                    {actionCell}
                    {editable ? (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="rounded p-1 text-slate-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ) : null}
                  </li>
                );
              }

              return (
                <li key={item.id} className={`${CHECKLIST_GRID_CLASS} group`}>
                  <WorkshopChecklistToggle
                    checked={item.done === true}
                    editable={editable}
                    progress={progress.total > 0 ? progress : undefined}
                    onChange={() => toggleItemDone(index)}
                    label={item.text}
                  />

                  {actionCell}
                  <div className="flex min-w-0 justify-center">
                    <WorkshopAssigneesField
                      teamMembers={teamMembers}
                      assigneeIds={item.assigneeIds ?? []}
                      editable={editable}
                      variant="compact"
                      onAssigneeIdsChange={(ids) =>
                        updateItem(item.id, {
                          assigneeIds: ids.length > 0 ? ids : undefined,
                        })
                      }
                      onTeamMembersChange={onTeamMembersChange}
                    />
                  </div>

                  <div className="flex justify-center">
                    <WorkshopChecklistDateCell
                      label="Start date"
                      value={item.startDate}
                      editable={editable}
                      onChange={(startDate) => updateItem(item.id, { startDate })}
                    />
                  </div>

                  <div className="flex justify-center">
                    <WorkshopChecklistDateCell
                      label="Due date"
                      value={item.dueDate}
                      editable={editable}
                      onChange={(dueDate) => updateItem(item.id, { dueDate })}
                    />
                  </div>

                  <div className="flex justify-center">
                    <WorkshopChecklistEstimateCell
                      value={item.timeEstimateMinutes}
                      editable={editable}
                      onChange={(timeEstimateMinutes) =>
                        updateItem(item.id, { timeEstimateMinutes })
                      }
                    />
                  </div>

                  {editable ? (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded p-1 text-slate-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : (
                    <span aria-hidden />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {editable ? (
        <button
          type="button"
          onClick={addItem}
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add item
        </button>
      ) : null}
    </div>
  );
}

function SelectableActionRow({
  action,
  selected,
  meta,
  onToggle,
  onMetaChange,
  editable,
}: {
  action: ActionItem;
  selected: boolean;
  meta?: PlaybookActionMeta;
  onToggle: () => void;
  onMetaChange: (patch: Partial<PlaybookActionMeta>) => void;
  editable: boolean;
}) {
  const hasDetail = action.detailSections && action.detailSections.length > 0;

  return (
    <li
      className={`overflow-hidden rounded-md border transition ${
        selected ? "border-sky-200 bg-sky-50/30" : "border-slate-100 bg-white"
      }`}
    >
      <div className="flex gap-2.5 p-2.5">
        <input
          type="checkbox"
          checked={selected}
          disabled={!editable}
          onChange={onToggle}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600"
          aria-label={`Agree to Action ${action.number}: ${action.title}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">
            {action.number}. {action.title}
          </p>
          {selected && editable ? (
            <ScheduleFields
              item={meta ?? {}}
              onChange={onMetaChange}
              compact
            />
          ) : null}
          {hasDetail ? (
            <details className="group mt-2" open={selected}>
              <summary className="cursor-pointer list-none text-xs font-medium text-sky-700 [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-1 group-open:hidden">
                  Checklist & steps <ChevronDown className="h-3 w-3" />
                </span>
                <span className="hidden items-center gap-1 group-open:inline-flex">
                  Hide steps <ChevronDown className="h-3 w-3 rotate-180" />
                </span>
              </summary>
              <div className="mt-2 space-y-3 border-t border-slate-100 pt-2">
                {action.detailSections!.map((sec, i) => (
                  <div key={i}>
                    {sec.title ? (
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {sec.title}
                      </p>
                    ) : null}
                    <ActionDetailContent content={sec.content} />
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function WorkshopMainPanel({
  refKey,
  playbookTitle,
  agreed,
  onAgreedChange,
  editable,
  onActivityAppend,
  teamMembers,
  onTeamMembersChange,
}: {
  refKey: string;
  playbookTitle: string;
  agreed: PlaybookAgreedActions;
  onAgreedChange: (next: PlaybookAgreedActions) => void;
  editable: boolean;
  onActivityAppend: (event: Omit<WorkshopActivityEvent, "id" | "createdAt">) => void;
  teamMembers: WorkshopTeamMember[];
  onTeamMembersChange: (members: WorkshopTeamMember[]) => void;
}) {
  const [content, setContent] = useState<PlaybookContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const [checklistsOpen, setChecklistsOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setContent(null);
    fetch(`/api/playbooks/${encodeURIComponent(refKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PlaybookContent | null) => {
        if (!cancelled) setContent(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refKey]);

  const actions = content ? collectPlaybookActions(content) : [];
  const selectedPlaybookCount = agreed.playbook.length;

  useEffect(() => {
    if (selectedPlaybookCount > 0) setPlaybookOpen(true);
  }, [selectedPlaybookCount]);

  const updateGroups = (groups: WorkshopActionGroup[]) => {
    onAgreedChange({ ...agreed, groups });
  };

  const defaultChecklistTitle = `${playbookTitle} checklist`;

  const createChecklist = () => {
    if (!editable) return;
    setChecklistsOpen(true);
    onAgreedChange({
      ...agreed,
      groups: [
        ...agreed.groups,
        {
          id: crypto.randomUUID(),
          title: defaultChecklistTitle,
          items: [],
        },
      ],
    });
    onActivityAppend({ type: "checklist_added", meta: { title: defaultChecklistTitle } });
  };

  const togglePlaybook = (num: number) => {
    if (!editable) return;
    const playbook = agreed.playbook.includes(num)
      ? agreed.playbook.filter((n) => n !== num)
      : [...agreed.playbook, num].sort((a, b) => a - b);
    onAgreedChange({ ...agreed, playbook });
  };

  const updatePlaybookMeta = (num: number, patch: Partial<PlaybookActionMeta>) => {
    if (!editable) return;
    const key = String(num);
    onAgreedChange({
      ...agreed,
      playbookMeta: {
        ...agreed.playbookMeta,
        [key]: { ...agreed.playbookMeta?.[key], ...patch },
      },
    });
  };

  if (!editable && agreed.groups.length === 0 && selectedPlaybookCount === 0) {
    return null;
  }

  const showChecklists = editable || agreed.groups.length > 0;

  return (
    <>
      {showChecklists ? (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            What needs to happen?
          </p>
          {agreed.groups.length > 0 ? (
            <button
              type="button"
              onClick={() => setChecklistsOpen((open) => !open)}
              className="inline-flex items-center gap-2 text-left"
              aria-expanded={checklistsOpen}
            >
              {checklistsOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              )}
              <span className="text-base font-semibold text-slate-900">Checklists</span>
            </button>
          ) : null}

          {(checklistsOpen || agreed.groups.length === 0) && (
            <div className={agreed.groups.length > 0 ? "mt-3 space-y-3" : undefined}>
              {agreed.groups.map((group) => (
                <WorkshopChecklistCard
                  key={group.id}
                  group={group}
                  editable={editable}
                  teamMembers={teamMembers}
                  onTeamMembersChange={onTeamMembersChange}
                  onChange={(next) =>
                    updateGroups(agreed.groups.map((g) => (g.id === group.id ? next : g)))
                  }
                  onRemove={() => updateGroups(agreed.groups.filter((g) => g.id !== group.id))}
                />
              ))}

              {editable ? (
                <button
                  type="button"
                  onClick={createChecklist}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add checklist
                </button>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      <section className="pt-6">
        <button
          type="button"
          onClick={() => setPlaybookOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={playbookOpen}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Playbook actions
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {loading
                ? "Loading…"
                : actions.length === 0
                  ? "None available"
                  : `${actions.length} steps`}
              {selectedPlaybookCount > 0 ? ` · ${selectedPlaybookCount} selected` : ""}
            </p>
          </div>
          {playbookOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          )}
        </button>

        {playbookOpen ? (
          <div className="mt-2 space-y-2">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : error ? (
              <p className="text-sm text-slate-500">Could not load playbook actions.</p>
            ) : actions.length === 0 ? (
              <p className="text-sm text-slate-500">No actions listed for this playbook yet.</p>
            ) : (
              <ul className="space-y-2">
                {actions.map((action) => (
                  <SelectableActionRow
                    key={action.number}
                    action={action}
                    selected={agreed.playbook.includes(action.number)}
                    meta={agreed.playbookMeta?.[String(action.number)]}
                    onToggle={() => togglePlaybook(action.number)}
                    onMetaChange={(patch) => updatePlaybookMeta(action.number, patch)}
                    editable={editable}
                  />
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>
    </>
  );
}

export type WorkshopScoreSheetProps = {
  tooltip: BossQuestionTooltipAnchor;
  question: (typeof ASSESSMENT_QUESTIONS)[number];
  onPickScore: (ref: string, score: 0 | 1 | 2 | null) => void;
  answerScores?: AnswersMap;
  getPlaybookUrl?: (ref: string) => string | null;
  playbookNotes?: Record<string, string>;
  onPlaybookNotesChange?: (ref: string, notes: string) => void;
  onDismiss?: () => void;
  onNavigate?: (ref: string) => void;
  coachName?: string;
  clientName?: string;
  allowClientComments?: boolean;
};

export function WorkshopScoreSheet({
  tooltip,
  question,
  onPickScore,
  answerScores,
  getPlaybookUrl,
  playbookNotes,
  onPlaybookNotesChange,
  onDismiss,
  onNavigate,
  coachName,
  clientName,
  allowClientComments = false,
}: WorkshopScoreSheetProps) {
  const groupId = useId();
  const current = answerScores?.[tooltip.ref] as 0 | 1 | 2 | undefined;
  const [local, setLocal] = useState<0 | 1 | 2 | undefined>(current);
  const savedDescription = playbookNotes?.[tooltip.ref] ?? "";
  const savedAgreedRaw = playbookNotes?.[playbookActionNotesKey(tooltip.ref)];
  const savedCommentsRaw = playbookNotes?.[playbookCommentsKey(tooltip.ref)];
  const savedActivityRaw = playbookNotes?.[playbookActivityKey(tooltip.ref)];
  const savedProspectScoresRaw = playbookNotes?.[playbookProspectScoresKey(tooltip.ref)];
  const savedLegacyPriorityRaw = playbookNotes?.[playbookPriorityKey(tooltip.ref)];
  const savedTeamMembersRaw = playbookNotes?.[WORKSHOP_TEAM_MEMBERS_KEY];
  const savedAssigneesRaw = playbookNotes?.[playbookAssigneesKey(tooltip.ref)];
  const savedDatesRaw = playbookNotes?.[playbookDatesKey(tooltip.ref)];

  const [localDescription, setLocalDescription] = useState(savedDescription);
  const [localAgreed, setLocalAgreed] = useState<PlaybookAgreedActions>(() =>
    parseAgreedActions(savedAgreedRaw)
  );
  const [localComments, setLocalComments] = useState<WorkshopComment[]>(() =>
    parseWorkshopComments(savedCommentsRaw)
  );
  const [localActivity, setLocalActivity] = useState<WorkshopActivityEvent[]>(() =>
    parseWorkshopActivity(savedActivityRaw)
  );
  const [localProspectScores, setLocalProspectScores] = useState<PlaybookProspectScores>(() =>
    loadPlaybookProspectScores(savedProspectScoresRaw, savedLegacyPriorityRaw)
  );
  const [localTeamMembers, setLocalTeamMembers] = useState<WorkshopTeamMember[]>(() =>
    resolveWorkshopTeamMembers(savedTeamMembersRaw, clientName)
  );
  const [localAssigneeIds, setLocalAssigneeIds] = useState<string[]>(() =>
    parsePlaybookAssignees(savedAssigneesRaw)
  );
  const [localDates, setLocalDates] = useState<PlaybookDates>(() =>
    parsePlaybookDates(savedDatesRaw)
  );

  const [activityCollapsed, setActivityCollapsed] = useState(false);
  const prevScoreRef = useRef<0 | 1 | 2 | undefined>(current);

  useEffect(() => {
    setLocal(current);
    prevScoreRef.current = current;
  }, [current, tooltip.ref]);

  useEffect(() => {
    setLocalDescription(savedDescription);
  }, [savedDescription, tooltip.ref]);

  useEffect(() => {
    setLocalAgreed(parseAgreedActions(savedAgreedRaw));
  }, [savedAgreedRaw, tooltip.ref]);

  useEffect(() => {
    setLocalComments(parseWorkshopComments(savedCommentsRaw));
  }, [savedCommentsRaw, tooltip.ref]);

  useEffect(() => {
    setLocalActivity(parseWorkshopActivity(savedActivityRaw));
  }, [savedActivityRaw, tooltip.ref]);

  useEffect(() => {
    setLocalProspectScores(
      loadPlaybookProspectScores(savedProspectScoresRaw, savedLegacyPriorityRaw)
    );
  }, [savedProspectScoresRaw, savedLegacyPriorityRaw, tooltip.ref]);

  useEffect(() => {
    setLocalTeamMembers(resolveWorkshopTeamMembers(savedTeamMembersRaw, clientName));
  }, [savedTeamMembersRaw, clientName]);

  useEffect(() => {
    setLocalAssigneeIds(parsePlaybookAssignees(savedAssigneesRaw));
  }, [savedAssigneesRaw, tooltip.ref]);

  useEffect(() => {
    setLocalDates(parsePlaybookDates(savedDatesRaw));
  }, [savedDatesRaw, tooltip.ref]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onDismiss?.();
        return;
      }
      if (!onNavigate) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const neighbors = getBossGridNeighbors(tooltip.ref);
      const keyMap: Partial<Record<string, BossGridDirection>> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      const direction = keyMap[e.key];
      const neighbor = direction ? neighbors[direction] : undefined;
      if (neighbor) {
        e.preventDefault();
        onNavigate(neighbor.ref);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss, onNavigate, tooltip.ref]);

  const playbookUrl = getPlaybookUrl?.(tooltip.ref) ?? null;
  const playbookMeta = getPlaybookMeta(tooltip.ref);
  const playbookTitle = playbookMeta?.name ?? tooltip.ref;
  const levelMeta = playbookMeta ? LEVELS.find((l) => l.id === playbookMeta.level) : null;
  const areaMeta = playbookMeta ? AREAS.find((a) => a.id === playbookMeta.area) : null;
  const showNotes = Boolean(onPlaybookNotesChange);
  const showPlaybook = Boolean(playbookUrl);
  const agreedCount = agreedActionsCount(localAgreed);

  const persistKey = (key: string, value: string) => {
    onPlaybookNotesChange?.(key, value);
  };

  const appendActivity = (event: Omit<WorkshopActivityEvent, "id" | "createdAt">) => {
    const next = appendWorkshopActivity(localActivity, {
      ...event,
      author: event.author ?? "coach",
      authorName: event.authorName ?? coachName,
    });
    setLocalActivity(next);
    persistKey(playbookActivityKey(tooltip.ref), serializeWorkshopActivity(next));
  };

  const pickScore = (score: 0 | 1 | 2) => {
    const prev = prevScoreRef.current;
    if (local === score) {
      setLocal(undefined);
      onPickScore(tooltip.ref, null);
      appendActivity({ type: "score_cleared", meta: { previousScore: prev } });
      prevScoreRef.current = undefined;
      return;
    }
    setLocal(score);
    onPickScore(tooltip.ref, score);
    appendActivity({
      type: "score_set",
      meta: { score, previousScore: prev, label: SCORE_LABELS[score] },
    });
    prevScoreRef.current = score;
  };

  const clearScore = () => {
    const prev = prevScoreRef.current;
    setLocal(undefined);
    onPickScore(tooltip.ref, null);
    appendActivity({ type: "score_cleared", meta: { previousScore: prev } });
    prevScoreRef.current = undefined;
  };

  const persistAgreed = (next: PlaybookAgreedActions) => {
    setLocalAgreed(next);
    persistKey(playbookActionNotesKey(tooltip.ref), serializeAgreedActions(next));
  };

  const handleDescriptionChange = (next: string) => {
    setLocalDescription(next);
    persistKey(tooltip.ref, next);
  };

  const handleDescriptionBlur = () => {
    if (localDescription.trim() !== savedDescription.trim()) {
      appendActivity({ type: "description_updated" });
    }
  };

  const handleCommentsChange = (next: WorkshopComment[]) => {
    setLocalComments(next);
    persistKey(playbookCommentsKey(tooltip.ref), serializeWorkshopComments(next));
  };

  const handleProspectScoresChange = (patch: Partial<PlaybookProspectScores>) => {
    const next = { ...localProspectScores, ...patch };
    for (const key of ["impact", "urgency", "ease"] as const) {
      if (key in patch && patch[key] === undefined) {
        delete next[key];
      }
    }
    setLocalProspectScores(next);
    persistKey(playbookProspectScoresKey(tooltip.ref), serializePlaybookProspectScores(next));
    const total = computeProspectImportance(next);
    appendActivity({
      type: "prospect_scores_updated",
      meta: {
        urgency: next.urgency,
        impact: next.impact,
        ease: next.ease,
        total: total ?? undefined,
      },
    });
  };

  const handleTeamMembersChange = (members: WorkshopTeamMember[]) => {
    setLocalTeamMembers(members);
    persistKey(WORKSHOP_TEAM_MEMBERS_KEY, serializeWorkshopTeamMembers(members));
    setLocalAssigneeIds((current) => {
      const next = current.filter((id) => members.some((member) => member.id === id));
      if (next.length !== current.length) {
        persistKey(playbookAssigneesKey(tooltip.ref), serializePlaybookAssignees(next));
      }
      return next;
    });
  };

  const handleAssigneeIdsChange = (ids: string[]) => {
    setLocalAssigneeIds(ids);
    persistKey(playbookAssigneesKey(tooltip.ref), serializePlaybookAssignees(ids));
  };

  const handleDatesChange = (patch: Partial<PlaybookDates>) => {
    const next = { ...localDates, ...patch };
    setLocalDates(next);
    persistKey(playbookDatesKey(tooltip.ref), serializePlaybookDates(next));
  };

  return (
    <div className="fixed inset-0 z-[500]">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]"
        aria-label="Close scoring panel"
        onClick={() => onDismiss?.()}
      />
      <div
        className="fixed left-1/2 top-1/2 relative h-[min(85vh,823px)] w-[min(calc(100vw-1.5rem),74.5rem)] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 sm:w-[min(calc(100vw-2rem),74.5rem)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${groupId}-playbook`}
        aria-describedby={`${groupId}-question`}
      >
        <button
          type="button"
          onClick={() => onDismiss?.()}
          className="absolute -right-3 -top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition hover:bg-slate-50 hover:text-slate-800"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        {onNavigate ? (
          <WorkshopGridNavButtons refKey={tooltip.ref} onNavigate={onNavigate} />
        ) : null}

        <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-900/5">
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="px-10 pt-7 pb-6 md:px-12 md:pt-8 md:pb-8">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Playbook {tooltip.ref}
                {agreedCount > 0 ? (
                  <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 font-medium normal-case text-sky-800">
                    {agreedCount} action{agreedCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </span>
              <h2
                id={`${groupId}-playbook`}
                className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl"
              >
                {showPlaybook ? (
                  /^https?:\/\//i.test(playbookUrl!) ? (
                    <a
                      href={playbookUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 transition hover:text-sky-700"
                      onClick={() => onDismiss?.()}
                    >
                      {playbookTitle}
                      <ArrowUpRight className="h-5 w-5 shrink-0 opacity-50" aria-hidden />
                    </a>
                  ) : (
                    <Link
                      href={playbookUrl!}
                      className="inline-flex items-center gap-1.5 transition hover:text-sky-700"
                      onClick={() => onDismiss?.()}
                    >
                      {playbookTitle}
                      <ArrowUpRight className="h-5 w-5 shrink-0 opacity-50" aria-hidden />
                    </Link>
                  )
                ) : (
                  playbookTitle
                )}
              </h2>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <p
                  id={`${groupId}-question`}
                  className="min-w-0 flex-1 text-base font-medium leading-relaxed text-slate-800 md:text-lg"
                >
                  {question.question}
                </p>

                <WorkshopScorePillDropdown
                  value={local}
                  onPick={pickScore}
                  onClear={clearScore}
                  scoringGuide={question.scoringGuide}
                />
              </div>

              <WorkshopPlaybookMetaFields
                levelMeta={levelMeta ?? null}
                areaMeta={areaMeta ?? null}
                scores={localProspectScores}
                editable={showNotes}
                onScoresChange={handleProspectScoresChange}
                teamMembers={localTeamMembers}
                onTeamMembersChange={handleTeamMembersChange}
                assigneeIds={localAssigneeIds}
                onAssigneeIdsChange={handleAssigneeIdsChange}
                dates={localDates}
                onDatesChange={handleDatesChange}
              />

              <div className="mt-6 border-t border-slate-200" role="presentation" />

              <section className="pt-3 md:pt-3.5">
                <WorkshopPlaybookNotesField
                  key={tooltip.ref}
                  id={`${groupId}-description`}
                  value={localDescription}
                  editable={showNotes}
                  onChange={handleDescriptionChange}
                  onBlur={handleDescriptionBlur}
                />
              </section>

              {(showNotes || localAgreed.groups.length > 0 || agreedCount > 0) && (
                <>
                  <div className="my-5">
                    <WorkshopSectionDivider />
                  </div>
                  <WorkshopMainPanel
                    refKey={tooltip.ref}
                    playbookTitle={playbookTitle}
                    agreed={localAgreed}
                    onAgreedChange={persistAgreed}
                    editable={showNotes}
                    onActivityAppend={appendActivity}
                    teamMembers={localTeamMembers}
                    onTeamMembersChange={handleTeamMembersChange}
                  />
                </>
              )}
              </div>
            </div>
          </div>

          {showNotes ? (
            <WorkshopActivityPanel
              activity={localActivity}
              comments={localComments}
              editable={showNotes}
              allowClientComments={allowClientComments}
              defaultAuthor="coach"
              defaultAuthorName={coachName}
              onCommentsChange={handleCommentsChange}
              onActivityAppend={appendActivity}
              collapsed={activityCollapsed}
              onCollapsedChange={setActivityCollapsed}
            />
          ) : null}
        </div>
        </div>
      </div>
    </div>
  );
}
