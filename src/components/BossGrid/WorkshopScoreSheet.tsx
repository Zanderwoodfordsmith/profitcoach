"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Flag,
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
  parseAgreedActions,
  parseWorkshopActivity,
  parseWorkshopComments,
  playbookActionNotesKey,
  playbookActivityKey,
  playbookCommentsKey,
  playbookPriorityKey,
  playbookProspectScoresKey,
  PROSPECT_EASE_LEVELS,
  PROSPECT_IMPACT_LEVELS,
  SCORE_LABELS,
  serializeAgreedActions,
  serializePlaybookProspectScores,
  serializeWorkshopActivity,
  serializeWorkshopComments,
  URGENCY_POINTS,
  type CustomWorkshopAction,
  type PlaybookActionMeta,
  type PlaybookAgreedActions,
  type PlaybookProspectScores,
  type ProspectEaseLevel,
  type ProspectImpactLevel,
  type ProspectUrgencyLevel,
  WORKSHOP_EASE_META,
  WORKSHOP_IMPACT_META,
  WORKSHOP_PRIORITIES,
  WORKSHOP_PRIORITY_META,
  type WorkshopActionGroup,
  type WorkshopActivityEvent,
  type WorkshopComment,
} from "@/lib/playbookSessionNotes";
import { BOSS_PRO_SCORE_LABELS } from "@/lib/bossProScoringLabels";
import type { BossQuestionTooltipAnchor } from "./bossQuestionTooltip";
import { WorkshopActivityPanel } from "./WorkshopActivityPanel";

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
    dot: "bg-amber-500",
    active: "border-amber-400 bg-amber-50 text-amber-950 ring-1 ring-amber-300/60",
    idle: "border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50/40",
  },
  {
    value: 2 as const,
    label: BOSS_PRO_SCORE_LABELS[2],
    dot: "bg-emerald-500",
    active: "border-emerald-400 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-300/60",
    idle: "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/40",
  },
];

const CHECKLIST_LINE = /^-\s*\[([ xX])\]\s*(.+)$/;

function WorkshopSectionDivider() {
  return <div className="border-t border-slate-200" role="presentation" />;
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

type ProspectPillOption = {
  value: string;
  label: string;
  pill: string;
  flag?: string;
};

function WorkshopProspectPillDropdown({
  value,
  options,
  onChange,
  editable,
  placeholder = "Set",
  showFlag = false,
}: {
  value: string | undefined;
  options: ProspectPillOption[];
  onChange: (value: string) => void;
  editable: boolean;
  placeholder?: string;
  showFlag?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

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

  if (!editable) {
    if (!selected) return <span className="text-slate-400">—</span>;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${selected.pill}`}
      >
        {showFlag && selected.flag ? (
          <Flag className={`h-3 w-3 shrink-0 fill-current ${selected.flag}`} aria-hidden />
        ) : null}
        {selected.label}
      </span>
    );
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={
          selected
            ? `inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition hover:opacity-90 ${selected.pill}`
            : "inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
        }
        aria-expanded={open}
        aria-label={selected ? selected.label : placeholder}
      >
        {selected && showFlag && selected.flag ? (
          <Flag className={`h-3 w-3 shrink-0 fill-current ${selected.flag}`} aria-hidden />
        ) : null}
        {selected ? selected.label : placeholder}
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1.5 flex min-w-[7.5rem] flex-col gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`inline-flex w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-left text-xs font-semibold transition hover:opacity-90 ${option.pill} ${
                value === option.value ? "ring-1 ring-slate-300/80" : ""
              }`}
            >
              {showFlag && option.flag ? (
                <Flag className={`h-3 w-3 shrink-0 fill-current ${option.flag}`} aria-hidden />
              ) : null}
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const URGENCY_PILL_OPTIONS: ProspectPillOption[] = WORKSHOP_PRIORITIES.map((priority) => ({
  value: String(URGENCY_POINTS[priority]),
  label: WORKSHOP_PRIORITY_META[priority].label,
  pill: WORKSHOP_PRIORITY_META[priority].pill,
  flag: WORKSHOP_PRIORITY_META[priority].flag,
}));

const IMPACT_PILL_OPTIONS: ProspectPillOption[] = PROSPECT_IMPACT_LEVELS.map((level) => ({
  value: String(level),
  label: WORKSHOP_IMPACT_META[level].label,
  pill: WORKSHOP_IMPACT_META[level].pill,
}));

const EASE_PILL_OPTIONS: ProspectPillOption[] = PROSPECT_EASE_LEVELS.map((level) => ({
  value: String(level),
  label: WORKSHOP_EASE_META[level].label,
  pill: WORKSHOP_EASE_META[level].pill,
}));

function WorkshopHeaderMetaBlock({
  levelMeta,
  areaMeta,
  scores,
  onScoresChange,
  editable,
}: {
  levelMeta: { id: number; name: string } | null;
  areaMeta: { name: string } | null;
  scores: PlaybookProspectScores;
  onScoresChange: (patch: Partial<PlaybookProspectScores>) => void;
  editable: boolean;
}) {
  const composite = computeProspectImportance(scores);
  const showScorers =
    editable ||
    scores.impact !== undefined ||
    scores.urgency !== undefined ||
    scores.ease !== undefined;

  if (!levelMeta && !areaMeta && !showScorers) return null;

  const metaRowClass =
    "grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-5 text-sm";

  const showRightColumn = Boolean(levelMeta || areaMeta || showScorers);

  return (
    <div
      className={`mt-4 grid grid-cols-1 gap-x-14 gap-y-3 ${
        showScorers && showRightColumn ? "sm:grid-cols-2" : ""
      }`}
    >
      {showScorers ? (
        <div className="space-y-2.5">
          <div className={metaRowClass}>
            <span className="text-slate-400">Impact</span>
            <WorkshopProspectPillDropdown
              value={scores.impact !== undefined ? String(scores.impact) : undefined}
              options={IMPACT_PILL_OPTIONS}
              editable={editable}
              onChange={(next) => onScoresChange({ impact: Number(next) as ProspectImpactLevel })}
            />
          </div>
          <div className={metaRowClass}>
            <span className="text-slate-400">Urgency</span>
            <WorkshopProspectPillDropdown
              value={scores.urgency !== undefined ? String(scores.urgency) : undefined}
              options={URGENCY_PILL_OPTIONS}
              editable={editable}
              showFlag
              onChange={(next) => onScoresChange({ urgency: Number(next) as ProspectUrgencyLevel })}
            />
          </div>
          <div className={metaRowClass}>
            <span className="text-slate-400">Ease</span>
            <WorkshopProspectPillDropdown
              value={scores.ease !== undefined ? String(scores.ease) : undefined}
              options={EASE_PILL_OPTIONS}
              editable={editable}
              onChange={(next) => onScoresChange({ ease: Number(next) as ProspectEaseLevel })}
            />
          </div>
        </div>
      ) : null}

      {showRightColumn ? (
        <div className="space-y-2.5">
          {levelMeta ? (
            <div className={metaRowClass}>
              <span className="text-slate-400">Level</span>
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                {levelMeta.id}. {levelMeta.name}
              </span>
            </div>
          ) : null}
          {areaMeta ? (
            <div className={metaRowClass}>
              <span className="text-slate-400">Area</span>
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                {areaMeta.name}
              </span>
            </div>
          ) : null}
          {showScorers ? (
            <div className={metaRowClass}>
              <span className="text-slate-400">Importance</span>
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-900">
                {composite !== null ? `${composite}/10` : "—/10"}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function WorkshopChecklistCard({
  group,
  editable,
  onChange,
  onRemove,
}: {
  group: WorkshopActionGroup;
  editable: boolean;
  onChange: (next: WorkshopActionGroup) => void;
  onRemove: () => void;
}) {
  const updateItem = (id: string, patch: Partial<CustomWorkshopAction>) => {
    onChange({
      ...group,
      items: group.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  const removeItem = (id: string) => {
    onChange({ ...group, items: group.items.filter((item) => item.id !== id) });
  };

  const addItem = () => {
    onChange({
      ...group,
      items: [...group.items, { id: crypto.randomUUID(), text: "" }],
    });
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
        <ul className="mt-2 space-y-1">
          {group.items.map((item) => (
            <li key={item.id} className="group flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.done === true}
                disabled={!editable}
                onChange={(e) => updateItem(item.id, { done: e.target.checked })}
                className="h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600"
                aria-label={`Mark done: ${item.text || "item"}`}
              />
              {editable ? (
                <input
                  type="text"
                  value={item.text}
                  onChange={(e) => updateItem(item.id, { text: e.target.value })}
                  placeholder="Item name"
                  className="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              ) : (
                <span
                  className={`text-sm ${item.done ? "text-slate-400 line-through" : "text-slate-800"}`}
                >
                  {item.text}
                </span>
              )}
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
          ))}
        </ul>
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
}: {
  refKey: string;
  playbookTitle: string;
  agreed: PlaybookAgreedActions;
  onAgreedChange: (next: PlaybookAgreedActions) => void;
  editable: boolean;
  onActivityAppend: (event: Omit<WorkshopActivityEvent, "id" | "createdAt">) => void;
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

      <section className="pt-5">
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
  coachName,
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

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

  const activeGuide =
    local === 0
      ? question.scoringGuide.red
      : local === 1
        ? question.scoringGuide.amber
        : local === 2
          ? question.scoringGuide.green
          : null;

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

  return (
    <div className="fixed inset-0 z-[500]">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]"
        aria-label="Close scoring panel"
        onClick={() => onDismiss?.()}
      />
      <div
        className="fixed left-1/2 top-1/2 relative h-[min(77vh,748px)] w-[min(calc(100vw-1.5rem),67.76rem)] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 sm:w-[min(calc(100vw-2rem),67.76rem)]"
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

        <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-900/5">
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <header className="shrink-0 border-b border-slate-200 px-10 pt-7 pb-6 md:px-12 md:pt-8 md:pb-7">
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
              <WorkshopHeaderMetaBlock
                levelMeta={levelMeta ?? null}
                areaMeta={areaMeta ?? null}
                scores={localProspectScores}
                editable={showNotes}
                onScoresChange={handleProspectScoresChange}
              />
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="px-10 pt-6 pb-6 md:px-12 md:pt-7 md:pb-8">
              <p
                id={`${groupId}-question`}
                className="text-base font-medium leading-relaxed text-slate-800 md:text-lg"
              >
                {question.question}
              </p>

              <div className="mt-3 flex flex-wrap items-start gap-2">
                {SCORE_PILLS.map((pill) => {
                  const active = local === pill.value;
                  return (
                    <button
                      key={pill.value}
                      type="button"
                      onClick={() => pickScore(pill.value)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                        active ? pill.active : pill.idle
                      }`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${pill.dot}`} aria-hidden />
                      {pill.label}
                    </button>
                  );
                })}
                {local !== undefined ? (
                  <button
                    type="button"
                    onClick={clearScore}
                    className="self-center text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              {activeGuide ? (
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{activeGuide}</p>
              ) : null}

              <div className="my-5">
                <WorkshopSectionDivider />
              </div>

              <section>
                {showNotes ? (
                  <textarea
                    id={`${groupId}-description`}
                    value={localDescription}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    onBlur={handleDescriptionBlur}
                    rows={3}
                    className="w-full resize-none border-0 bg-transparent px-0 py-0 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="Add notes…"
                  />
                ) : localDescription ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                    {localDescription}
                  </p>
                ) : null}
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
