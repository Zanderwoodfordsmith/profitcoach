"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Calendar,
  CalendarPlus,
  ChevronDown,
  Flag,
  Gauge,
  LayoutGrid,
  Layers,
  Plus,
  Sparkles,
  Target,
  User,
  UserPlus,
  X,
} from "lucide-react";
import type {
  PlaybookDates,
  PlaybookProspectScores,
  ProspectEaseLevel,
  ProspectImpactLevel,
  ProspectUrgencyLevel,
  WorkshopTeamMember,
} from "@/lib/playbookSessionNotes";
import {
  computeProspectImportance,
  PROSPECT_EASE_LEVELS,
  PROSPECT_IMPACT_LEVELS,
  WORKSHOP_EASE_META,
  WORKSHOP_IMPACT_META,
  WORKSHOP_PRIORITIES,
  WORKSHOP_PRIORITY_META,
  URGENCY_POINTS,
} from "@/lib/playbookSessionNotes";

type ProspectPillOption = {
  value: string;
  label: string;
  pill: string;
  flag?: string;
};

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

function getImportancePartialHint(scores: PlaybookProspectScores): string | null {
  if (computeProspectImportance(scores) !== null) return null;

  const setCount = [scores.impact, scores.urgency, scores.ease].filter(
    (value) => value !== undefined
  ).length;
  if (setCount === 0) return null;

  return "score all 3";
}

const META_ROW_CLASS =
  "grid grid-cols-[7.75rem_minmax(0,1fr)] items-center gap-x-4 text-sm";

export const WORKSHOP_PLAYBOOK_TABLE_GRID =
  "grid grid-cols-[1.25rem_minmax(0,1fr)_2.25rem_2rem_2rem_2rem_1.25rem] items-center gap-x-1.5";

function MetaGridPlaceholder() {
  return <div className="hidden min-h-[30px] sm:block" aria-hidden />;
}

function memberInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function MetaFieldRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Target;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={META_ROW_CLASS}>
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span>{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function WorkshopProspectPillDropdown({
  value,
  options,
  onChange,
  editable,
  placeholder = "Set",
  showFlag = false,
  allowClear = false,
}: {
  value: string | undefined;
  options: ProspectPillOption[];
  onChange: (value: string | null) => void;
  editable: boolean;
  placeholder?: string;
  showFlag?: boolean;
  allowClear?: boolean;
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
    if (!selected) return <span className="text-slate-400">Empty</span>;
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
    <div ref={rootRef} className="relative inline-flex max-w-full">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={
          selected
            ? `inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition hover:opacity-90 ${selected.pill}`
            : "inline-flex max-w-full items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
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
          {allowClear && value ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="mt-0.5 w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AssigneeAvatar({ name }: { name: string }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700">
      {memberInitials(name) || "?"}
    </span>
  );
}

export function WorkshopAssigneesField({
  teamMembers,
  assigneeIds,
  editable,
  onAssigneeIdsChange,
  onTeamMembersChange,
  variant = "default",
}: {
  teamMembers: WorkshopTeamMember[];
  assigneeIds: string[];
  editable: boolean;
  onAssigneeIdsChange: (ids: string[]) => void;
  onTeamMembersChange: (members: WorkshopTeamMember[]) => void;
  variant?: "default" | "compact";
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedMembers = assigneeIds
    .map((id) => teamMembers.find((member) => member.id === id))
    .filter((member): member is WorkshopTeamMember => Boolean(member));

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return teamMembers;
    return teamMembers.filter((member) => member.name.toLowerCase().includes(needle));
  }, [query, teamMembers]);

  const toggleAssignee = (memberId: string) => {
    onAssigneeIdsChange(
      assigneeIds.includes(memberId)
        ? assigneeIds.filter((id) => id !== memberId)
        : [...assigneeIds, memberId]
    );
  };

  const removeAssignee = (memberId: string) => {
    onAssigneeIdsChange(assigneeIds.filter((id) => id !== memberId));
  };

  const addTeamMember = () => {
    const name = query.trim();
    if (!name) return;
    const existing = teamMembers.find(
      (member) => member.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      if (!assigneeIds.includes(existing.id)) {
        onAssigneeIdsChange([...assigneeIds, existing.id]);
      }
      setQuery("");
      return;
    }
    const member: WorkshopTeamMember = {
      id: crypto.randomUUID(),
      name,
    };
    onTeamMembersChange([...teamMembers, member]);
    onAssigneeIdsChange([...assigneeIds, member.id]);
    setQuery("");
  };

  if (!editable) {
    if (selectedMembers.length === 0) {
      return variant === "compact" ? (
        <UserPlus className="h-4 w-4 text-slate-300" aria-hidden />
      ) : (
        <span className="text-slate-400">Empty</span>
      );
    }
    return (
      <div className={`flex flex-wrap ${variant === "compact" ? "gap-1" : "gap-1.5"}`}>
        {selectedMembers.map((member) => (
          <span
            key={member.id}
            className={
              variant === "compact"
                ? "inline-flex"
                : "inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800"
            }
          >
            {variant === "compact" ? (
              <AssigneeAvatar name={member.name} />
            ) : (
              <>
                <AssigneeAvatar name={member.name} />
                {member.name}
              </>
            )}
          </span>
        ))}
      </div>
    );
  }

  const triggerClass =
    variant === "compact"
      ? "inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md text-left transition hover:bg-slate-50/80"
      : "flex min-h-[30px] w-full flex-wrap items-center gap-1.5 rounded-md text-left transition hover:bg-slate-50/80";

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={triggerClass}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={selectedMembers.length > 0 ? "Edit assignees" : "Add assignee"}
      >
        {selectedMembers.length > 0 ? (
          selectedMembers.map((member) => (
            <span
              key={member.id}
              className={
                variant === "compact"
                  ? "inline-flex items-center"
                  : "inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800"
              }
            >
              {variant === "compact" ? (
                <AssigneeAvatar name={member.name} />
              ) : (
                <>
                  <AssigneeAvatar name={member.name} />
                  <span className="max-w-[9rem] truncate">{member.name}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="rounded p-0.5 text-slate-400 hover:text-slate-700"
                    aria-label={`Remove ${member.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeAssignee(member.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        removeAssignee(member.id);
                      }
                    }}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </span>
                </>
              )}
            </span>
          ))
        ) : variant === "compact" ? (
          <UserPlus className="h-4 w-4 text-slate-400" aria-hidden />
        ) : (
          <span className="text-slate-400">Empty</span>
        )}
      </button>

      {open ? (
        <div
          id={listId}
          className={`absolute top-full z-30 mt-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-2 shadow-lg ${
            variant === "compact" ? "left-0" : "right-0"
          }`}
        >
          <label className="sr-only" htmlFor={`${listId}-search`}>
            Search or add team member
          </label>
          <input
            id={`${listId}-search`}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTeamMember();
              }
            }}
            placeholder="Search or add name…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none ring-sky-500 focus:border-sky-300 focus:ring-2"
          />

          <div className="mt-2 max-h-44 overflow-y-auto">
            <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Team
            </p>
            {filteredMembers.length > 0 ? (
              <ul className="space-y-0.5">
                {filteredMembers.map((member) => {
                  const selected = assigneeIds.includes(member.id);
                  return (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() => toggleAssignee(member.id)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                          selected ? "bg-sky-50 text-sky-900" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <AssigneeAvatar name={member.name} />
                        <span className="min-w-0 flex-1 truncate">{member.name}</span>
                        {member.isClient ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Me
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-2 py-2 text-sm text-slate-400">No matches</p>
            )}
          </div>

          {query.trim() &&
          !teamMembers.some(
            (member) => member.name.toLowerCase() === query.trim().toLowerCase()
          ) ? (
            <button
              type="button"
              onClick={addTeamMember}
              className="mt-2 inline-flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-sky-700 transition hover:bg-sky-50"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <Plus className="h-3.5 w-3.5" aria-hidden />
              </span>
              Add “{query.trim()}”
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatPlaybookDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function WorkshopDateTrigger({
  label,
  value,
  editable,
  onChange,
  compact = false,
}: {
  label: string;
  value?: string;
  editable: boolean;
  onChange: (value: string | undefined) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const display = value ? formatPlaybookDate(value) : label;

  const openPicker = () => {
    if (!editable) return;
    const input = inputRef.current;
    if (!input) return;
    input.showPicker?.();
    input.focus();
  };

  if (compact) {
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

  if (!editable) {
    if (!value) return null;
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
        <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden />
        {display}
      </span>
    );
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={openPicker}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-700"
      >
        <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden />
        {display}
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

function WorkshopDatesField({
  dates,
  editable,
  onChange,
}: {
  dates: PlaybookDates;
  editable: boolean;
  onChange: (patch: Partial<PlaybookDates>) => void;
}) {
  if (!editable) {
    if (!dates.startDate && !dates.dueDate) {
      return <span className="text-slate-400">Empty</span>;
    }
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-sm text-slate-500">
        {dates.startDate ? (
          <WorkshopDateTrigger
            label="Start"
            value={dates.startDate}
            editable={false}
            onChange={() => undefined}
          />
        ) : null}
        {dates.startDate && dates.dueDate ? (
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
        ) : null}
        {dates.dueDate ? (
          <WorkshopDateTrigger
            label="Due"
            value={dates.dueDate}
            editable={false}
            onChange={() => undefined}
          />
        ) : null}
      </span>
    );
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <WorkshopDateTrigger
        label="Start"
        value={dates.startDate}
        editable={editable}
        onChange={(startDate) => onChange({ startDate })}
      />
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
      <WorkshopDateTrigger
        label="Due"
        value={dates.dueDate}
        editable={editable}
        onChange={(dueDate) => onChange({ dueDate })}
      />
    </div>
  );
}

export function WorkshopPlaybookMetaFields({
  levelMeta,
  areaMeta,
  scores,
  onScoresChange,
  teamMembers,
  onTeamMembersChange,
  assigneeIds,
  onAssigneeIdsChange,
  dates,
  onDatesChange,
  editable,
}: {
  levelMeta: { id: number; name: string } | null;
  areaMeta: { name: string } | null;
  scores: PlaybookProspectScores;
  onScoresChange: (patch: Partial<PlaybookProspectScores>) => void;
  teamMembers: WorkshopTeamMember[];
  onTeamMembersChange: (members: WorkshopTeamMember[]) => void;
  assigneeIds: string[];
  onAssigneeIdsChange: (ids: string[]) => void;
  dates: PlaybookDates;
  onDatesChange: (patch: Partial<PlaybookDates>) => void;
  editable: boolean;
}) {
  const composite = computeProspectImportance(scores);
  const importancePartialHint = getImportancePartialHint(scores);
  const showScorers =
    editable ||
    scores.impact !== undefined ||
    scores.urgency !== undefined ||
    scores.ease !== undefined;

  if (
    !editable &&
    !levelMeta &&
    !areaMeta &&
    !showScorers &&
    assigneeIds.length === 0 &&
    !dates.startDate &&
    !dates.dueDate
  ) {
    return null;
  }

  return (
    <div className="mt-5 grid grid-cols-1 items-center gap-y-3 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-3">
      {showScorers ? (
        <MetaFieldRow icon={Target} label="Impact">
          <WorkshopProspectPillDropdown
            value={scores.impact !== undefined ? String(scores.impact) : undefined}
            options={IMPACT_PILL_OPTIONS}
            editable={editable}
            allowClear
            onChange={(next) =>
              onScoresChange({
                impact: next === null ? undefined : (Number(next) as ProspectImpactLevel),
              })
            }
          />
        </MetaFieldRow>
      ) : (
        <MetaGridPlaceholder />
      )}

      <MetaFieldRow icon={User} label="Assignees">
        <WorkshopAssigneesField
          teamMembers={teamMembers}
          assigneeIds={assigneeIds}
          editable={editable}
          onAssigneeIdsChange={onAssigneeIdsChange}
          onTeamMembersChange={onTeamMembersChange}
        />
      </MetaFieldRow>

      {showScorers ? (
        <MetaFieldRow icon={Flag} label="Urgency">
          <WorkshopProspectPillDropdown
            value={scores.urgency !== undefined ? String(scores.urgency) : undefined}
            options={URGENCY_PILL_OPTIONS}
            editable={editable}
            showFlag
            allowClear
            onChange={(next) =>
              onScoresChange({
                urgency: next === null ? undefined : (Number(next) as ProspectUrgencyLevel),
              })
            }
          />
        </MetaFieldRow>
      ) : (
        <MetaGridPlaceholder />
      )}

      <MetaFieldRow icon={Calendar} label="Dates">
        <WorkshopDatesField dates={dates} editable={editable} onChange={onDatesChange} />
      </MetaFieldRow>

      {showScorers ? (
        <MetaFieldRow icon={Gauge} label="Ease">
          <WorkshopProspectPillDropdown
            value={scores.ease !== undefined ? String(scores.ease) : undefined}
            options={EASE_PILL_OPTIONS}
            editable={editable}
            allowClear
            onChange={(next) =>
              onScoresChange({
                ease: next === null ? undefined : (Number(next) as ProspectEaseLevel),
              })
            }
          />
        </MetaFieldRow>
      ) : (
        <MetaGridPlaceholder />
      )}

      {levelMeta ? (
        <MetaFieldRow icon={Layers} label="Level">
          <span className="text-sm text-slate-800">
            {levelMeta.id}. {levelMeta.name}
          </span>
        </MetaFieldRow>
      ) : (
        <MetaGridPlaceholder />
      )}

      {showScorers ? (
        <MetaFieldRow icon={Sparkles} label="Importance">
          <span className="text-sm text-slate-800">
            <span className="font-semibold tabular-nums">
              {composite !== null ? `${composite}/10` : "—/10"}
            </span>
            {importancePartialHint ? (
              <span className="ml-1.5 text-xs font-normal text-slate-500">
                ({importancePartialHint})
              </span>
            ) : null}
          </span>
        </MetaFieldRow>
      ) : (
        <MetaGridPlaceholder />
      )}

      {areaMeta ? (
        <MetaFieldRow icon={LayoutGrid} label="Area">
          <span className="text-sm text-slate-800">{areaMeta.name}</span>
        </MetaFieldRow>
      ) : (
        <MetaGridPlaceholder />
      )}
    </div>
  );
}
