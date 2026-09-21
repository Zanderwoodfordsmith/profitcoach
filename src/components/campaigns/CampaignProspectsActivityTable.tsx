"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowRightLeft,
  ArrowUpDown,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock,
  Layers,
  MessageCircle,
  Minus,
  Pause,
  Play,
  Search,
  Trash2,
} from "lucide-react";
import { ProspectTableAvatar } from "@/components/prospects/ProspectTableAvatar";
import { ReplyDispositionBar } from "@/components/messaging/ReplyDispositionBar";
import { FilterSlidersIcon } from "@/components/icons/FilterSlidersIcon";
import { TableToolbarButton } from "@/components/table/TableToolbarButton";
import { CampaignAudienceEmpty } from "@/components/campaigns/CampaignAudienceEmpty";
import type { CampaignAddProspectsMode } from "@/lib/campaigns/addProspectsMode";
import { dispositionFromInterestOutcome } from "@/lib/prospects/replyDisposition";
import {
  formatBusinessLabel,
  formatProspectJobTitle,
} from "@/lib/prospectDisplayFormat";
import Link from "next/link";
import { formatShortDate } from "@/lib/formatShortDate";
import { campaignStepTypeLabel } from "@/lib/unipile/campaignStepTypes";
import {
  actionSteps,
  campaignLeadName,
  leadNeedsCoach,
  leadProgressDots,
  leadStartedAt,
  leadStatusIcon,
  leadStatusLabel,
  leadStatusTone,
  leadWhenLabel,
  matchesActivityFilter,
  nextStepLabel,
  stepHistoryLabel,
  type ActivityFilterId,
  type CampaignActivityJob,
  type CampaignActivityLead,
  type CampaignActivityStep,
  type LeadProgressDot,
  type LeadStatusIcon,
  type LeadStatusTone,
} from "@/lib/unipile/campaignLeadActivity";

type SortField = "name" | "progress" | "status" | "nextStep" | "when" | "started";
type GroupField = "status" | "nextStep" | "when" | null;
type ToolbarMenu = "filter" | "sort" | "group" | "move" | null;

type CampaignOption = { id: string; name: string };

type Props = {
  leads: CampaignActivityLead[];
  steps: CampaignActivityStep[];
  jobs: CampaignActivityJob[];
  campaignStatus: string;
  campaigns?: CampaignOption[];
  prospectHref?: (lead: CampaignActivityLead) => string | null;
  busy?: boolean;
  onAdd: (mode?: CampaignAddProspectsMode) => void;
  onDelete: (leadIds: string[]) => void;
  onPause: (leadIds: string[]) => void;
  onResume: (leadIds: string[]) => void;
  onMove: (leadIds: string[], campaignId: string) => void;
  repliesHref?: string | null;
  onMarkInterest: (
    leadId: string,
    outcome: "positive" | "soft" | "negative" | null
  ) => void;
};

const FILTERS: Array<{ id: ActivityFilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "In progress" },
  { id: "pending", label: "Pending" },
  { id: "needsYou", label: "Needs you" },
  { id: "replied", label: "Replied" },
  { id: "finished", label: "Finished" },
  { id: "failed", label: "Failed" },
  { id: "paused", label: "Paused" },
];

const TONE_CLASS: Record<LeadStatusTone, string> = {
  emerald: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  sky: "border border-sky-200 bg-sky-100 text-sky-900",
  amber: "border border-amber-200 bg-amber-50 text-amber-950",
  rose: "border border-rose-200 bg-rose-50 text-rose-800",
  slate: "border border-slate-200 bg-slate-50 text-slate-600",
};

const DROPDOWN =
  "absolute left-0 z-[90] mt-1 w-56 rounded-md border border-slate-200 bg-white p-3 shadow-lg";
const CONTACT_NARROW = "w-[16rem]";
const CONTACT_WIDE = "w-[22rem]";
const COL_PROGRESS = "w-[11.5rem]";
const COL_STATUS = "w-28";
const COL_NEXT = "w-[9rem]";
const COL_DUE = "w-36";
const COL_STARTED = "w-16";
const ROW = "flex items-center gap-x-3 px-3";
const PROGRESS_POPOVER_WIDTH = 360;
const PROGRESS_OPEN_MS = 80;
const PROGRESS_CLOSE_MS = 160;

function StatusIcon({ kind }: { kind: LeadStatusIcon }) {
  const cls = "h-3 w-3 shrink-0";
  switch (kind) {
    case "replied":
      return <MessageCircle className={cls} aria-hidden />;
    case "connected":
    case "finished":
      return <Check className={cls} aria-hidden />;
    case "pending":
      return <Clock className={cls} aria-hidden />;
    case "sequence":
      return <Play className={cls} aria-hidden />;
    case "paused":
      return <Pause className={cls} aria-hidden />;
    case "failed":
      return <AlertCircle className={cls} aria-hidden />;
    case "skipped":
      return <Minus className={cls} aria-hidden />;
    case "needsYou":
      return <Bell className={cls} aria-hidden />;
    default:
      return <CircleDashed className={cls} aria-hidden />;
  }
}

function ProgressRail({ dots }: { dots: LeadProgressDot[] }) {
  if (!dots.length) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex items-center">
      {dots.map((dot, i) => {
        const remaining = dot.state === "remaining";
        const current = dot.state === "current";
        const error = dot.state === "error";
        const size = current
          ? "h-7 w-7 text-[11px] font-semibold"
          : remaining
            ? "h-3.5 w-3.5 text-[8px]"
            : "h-5 w-5 text-[9px] font-medium";
        const tone = error
          ? "bg-rose-500 text-white"
          : current || dot.state === "done"
            ? "bg-sky-600 text-white"
            : "bg-slate-200 text-slate-500";
        return (
          <span key={`${dot.position}-${dot.stepType}`} className="flex items-center">
            {i > 0 ? (
              <span
                className={`h-px ${current ? "w-2.5" : "w-1.5"} ${
                  dots[i - 1]?.state === "done" || dots[i - 1]?.state === "error"
                    ? "bg-sky-400"
                    : "bg-slate-200"
                }`}
                aria-hidden
              />
            ) : null}
            <span
              className={`inline-flex items-center justify-center rounded-full tabular-nums ${size} ${tone}`}
            >
              {i + 1}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function whenSortValue(when: string): number {
  if (when === "Needs you" || when === "Due now") return 0;
  if (when === "Waiting for accept") return 2;
  if (when === "Not started" || when === "Paused") return 8;
  if (when === "—" || when.startsWith("Failed")) return 9;
  return 4;
}

function progressDoneCount(dots: LeadProgressDot[]): number {
  return dots.filter((dot) => dot.state === "done").length;
}

function nextStepClass(label: string, needsYou: boolean): string {
  if (needsYou) return "text-amber-800";
  const value = label.toLowerCase();
  if (label === "Finished") return "text-emerald-700";
  if (label === "Stopped" || label === "Skipped" || value.includes("fail")) {
    return "text-rose-700";
  }
  if (label === "—" ) return "text-slate-400";
  if (value.includes("connection") || value.includes("invite")) return "text-sky-800";
  if (value.includes("message") || value.includes("whatsapp") || value.includes("instagram")) {
    return "text-violet-800";
  }
  if (value.includes("call") || value.includes("react")) return "text-teal-800";
  return "text-indigo-800";
}

export function CampaignProspectsActivityTable({
  leads,
  steps,
  jobs,
  campaignStatus,
  campaigns = [],
  prospectHref,
  busy = false,
  onAdd,
  onDelete,
  onPause,
  onResume,
  onMove,
  onMarkInterest,
  repliesHref = null,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ActivityFilterId>("all");
  const [sortField, setSortField] = useState<SortField>("when");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [groupField, setGroupField] = useState<GroupField>(null);
  const [menu, setMenu] = useState<ToolbarMenu>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [contactWide, setContactWide] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const jobsByLead = useMemo(() => {
    const map = new Map<string, CampaignActivityJob[]>();
    for (const job of jobs) {
      const list = map.get(job.lead_id) ?? [];
      list.push(job);
      map.set(job.lead_id, list);
    }
    return map;
  }, [jobs]);

  const filterCounts = useMemo(() => {
    const counts: Record<ActivityFilterId, number> = {
      all: leads.length,
      active: 0,
      pending: 0,
      replied: 0,
      finished: 0,
      failed: 0,
      needsYou: 0,
      paused: 0,
    };
    for (const lead of leads) {
      const leadJobs = jobsByLead.get(lead.id) ?? [];
      if (matchesActivityFilter(lead, leadJobs, "active")) counts.active += 1;
      if (matchesActivityFilter(lead, leadJobs, "pending")) counts.pending += 1;
      if (matchesActivityFilter(lead, leadJobs, "replied")) counts.replied += 1;
      if (matchesActivityFilter(lead, leadJobs, "finished")) counts.finished += 1;
      if (matchesActivityFilter(lead, leadJobs, "failed")) counts.failed += 1;
      if (matchesActivityFilter(lead, leadJobs, "needsYou")) counts.needsYou += 1;
      if (matchesActivityFilter(lead, leadJobs, "paused")) counts.paused += 1;
    }
    return counts;
  }, [leads, jobsByLead]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = leads.filter((lead) => {
      const leadJobs = jobsByLead.get(lead.id) ?? [];
      if (!matchesActivityFilter(lead, leadJobs, filter)) return false;
      if (!q) return true;
      const hay = [
        campaignLeadName(lead),
        lead.company,
        lead.title,
        lead.status,
        nextStepLabel(lead, steps),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    const decorated = filtered.map((lead) => {
      const leadJobs = jobsByLead.get(lead.id) ?? [];
      return {
        lead,
        name: campaignLeadName(lead),
        subtitle: [formatProspectJobTitle(lead.title), formatBusinessLabel(lead.company)]
          .filter(Boolean)
          .join(" · "),
        status: lead.status,
        nextStep: nextStepLabel(lead, steps),
        when: leadWhenLabel({
          lead,
          steps,
          jobs: leadJobs,
          campaignStatus,
        }),
        dots: leadProgressDots(lead, steps, leadJobs),
        jobs: leadJobs,
        needsYou: leadNeedsCoach(lead, leadJobs),
        startedAt: leadStartedAt(leadJobs),
      };
    });

    decorated.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "progress") {
        cmp = progressDoneCount(a.dots) - progressDoneCount(b.dots);
        if (cmp === 0) cmp = a.dots.length - b.dots.length;
      } else if (sortField === "status") {
        cmp = leadStatusLabel(a.status).localeCompare(leadStatusLabel(b.status));
      } else if (sortField === "nextStep") cmp = a.nextStep.localeCompare(b.nextStep);
      else if (sortField === "started") {
        cmp = (a.startedAt || "").localeCompare(b.startedAt || "");
      } else {
        cmp = whenSortValue(a.when) - whenSortValue(b.when);
        if (cmp === 0) {
          const at = a.lead.next_action_at || "";
          const bt = b.lead.next_action_at || "";
          cmp = at.localeCompare(bt);
        }
      }
      if (cmp === 0) cmp = a.name.localeCompare(b.name);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return decorated;
  }, [leads, steps, jobsByLead, filter, query, sortField, sortDir, campaignStatus]);

  const groups = useMemo(() => {
    if (!groupField) return [{ key: "all", label: null as string | null, rows }];
    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      const key =
        groupField === "status"
          ? leadStatusLabel(row.status)
          : groupField === "nextStep"
            ? row.nextStep
            : row.when;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, groupRows]) => ({ key, label: key, rows: groupRows }));
  }, [groupField, rows]);

  const visibleIds = useMemo(() => rows.map((row) => row.lead.id), [rows]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.length;
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIdSet.has(id));
  const selectedLeads = useMemo(
    () => leads.filter((lead) => selectedIdSet.has(lead.id)),
    [leads, selectedIdSet]
  );
  const canPause = selectedLeads.some((lead) =>
    ["queued", "invited", "connected", "in_sequence"].includes(lead.status)
  );
  const canResume = selectedLeads.some((lead) => lead.status === "paused");
  const contactCol = contactWide ? CONTACT_WIDE : CONTACT_NARROW;
  const sortActive = sortField !== "when" || sortDir !== "asc";

  useEffect(() => {
    setSelectedIds((ids) => ids.filter((id) => leads.some((lead) => lead.id === id)));
  }, [leads]);

  useEffect(() => {
    if (!menu) return;
    function onDoc(event: MouseEvent) {
      if (toolbarRef.current?.contains(event.target as Node)) return;
      setMenu(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  function toggleMenu(next: Exclude<ToolbarMenu, null>) {
    setMenu((current) => (current === next ? null : next));
  }

  function toggleSelected(id: string) {
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((ids) => ids.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setSelectedIds((ids) => [...new Set([...ids, ...visibleIds])]);
  }

  function confirmDelete() {
    if (!selectedCount) return;
    const noun = selectedCount === 1 ? "contact" : "contacts";
    if (!window.confirm(`Remove ${selectedCount} ${noun} from this campaign?`)) {
      return;
    }
    onDelete(selectedIds);
    setSelectedIds([]);
  }

  return (
    <div className="min-h-[60vh]">
      {leads.length > 0 ? (
      <div
        ref={toolbarRef}
        className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="relative w-44 shrink-0 sm:w-56">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts"
              aria-label="Search contacts"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <div className="flex shrink-0 items-center gap-1">
            <div className="relative">
              <TableToolbarButton
                label="Filter"
                aria-haspopup="true"
                aria-expanded={menu === "filter"}
                active={menu === "filter"}
                badge={filter !== "all" ? 1 : null}
                onClick={() => toggleMenu("filter")}
                icon={<FilterSlidersIcon className="h-5 w-5 text-slate-500" />}
              />
              {menu === "filter" ? (
                <div role="menu" className={DROPDOWN}>
                  <p className="text-xs font-medium text-slate-600">Status</p>
                  <div className="mt-1.5 flex flex-col">
                    {FILTERS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setFilter(item.id);
                          setMenu(null);
                        }}
                        className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${
                          filter === item.id
                            ? "bg-sky-50 font-medium text-sky-800"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {item.label}
                        <span className="tabular-nums text-xs text-slate-400">
                          {filterCounts[item.id]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="relative">
              <TableToolbarButton
                label="Sort"
                aria-haspopup="true"
                aria-expanded={menu === "sort"}
                active={menu === "sort"}
                badge={sortActive ? 1 : null}
                onClick={() => toggleMenu("sort")}
                icon={<ArrowUpDown className="h-5 w-5 text-slate-500" aria-hidden />}
              />
              {menu === "sort" ? (
                <div role="menu" className={DROPDOWN}>
                  <label className="block text-xs font-medium text-slate-600">
                    Sort by
                    <select
                      className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      value={sortField}
                      onChange={(e) => setSortField(e.target.value as SortField)}
                    >
                      <option value="name">Contact</option>
                      <option value="progress">Campaign progress</option>
                      <option value="status">Status</option>
                      <option value="nextStep">Next step</option>
                      <option value="when">Next step due</option>
                      <option value="started">Started</option>
                    </select>
                  </label>
                  <label className="mt-3 block text-xs font-medium text-slate-600">
                    Order
                    <select
                      className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      value={sortDir}
                      onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                  </label>
                </div>
              ) : null}
            </div>
            <div className="relative">
              <TableToolbarButton
                label="Group"
                aria-haspopup="true"
                aria-expanded={menu === "group"}
                active={menu === "group" || Boolean(groupField)}
                badge={groupField ? 1 : null}
                onClick={() => toggleMenu("group")}
                icon={<Layers className="h-5 w-5 text-slate-500" aria-hidden />}
              />
              {menu === "group" ? (
                <div role="menu" className={DROPDOWN}>
                  <p className="text-xs font-medium text-slate-600">Group by</p>
                  {(
                    [
                      { key: null, label: "None" },
                      { key: "status", label: "Status" },
                      { key: "nextStep", label: "Next step" },
                      { key: "when", label: "Next step due" },
                    ] as Array<{ key: GroupField; label: string }>
                  ).map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setGroupField(item.key);
                        setMenu(null);
                      }}
                      className={`mt-1 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm ${
                        groupField === item.key
                          ? "bg-sky-50 font-medium text-sky-800"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {item.label}
                      {groupField === item.key ? (
                        <Check className="h-3.5 w-3.5 text-sky-600" aria-hidden />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
          {selectedCount > 0 ? (
            <>
              <span className="mr-1 text-sm font-medium text-slate-600">
                {selectedCount} selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="mr-1 text-sm text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
              {canResume ? (
                <TableToolbarButton
                  label="Resume"
                  disabled={busy}
                  onClick={() => {
                    onResume(selectedIds);
                    setSelectedIds([]);
                  }}
                  icon={<Play className="h-5 w-5 text-slate-500" aria-hidden />}
                />
              ) : null}
              {canPause ? (
                <TableToolbarButton
                  label="Pause"
                  disabled={busy}
                  onClick={() => {
                    onPause(selectedIds);
                    setSelectedIds([]);
                  }}
                  icon={<Pause className="h-5 w-5 text-slate-500" aria-hidden />}
                />
              ) : null}
              <div className="relative">
                <TableToolbarButton
                  label="Move"
                  disabled={busy || campaigns.length === 0}
                  aria-haspopup="true"
                  aria-expanded={menu === "move"}
                  active={menu === "move"}
                  onClick={() => toggleMenu("move")}
                  icon={<ArrowRightLeft className="h-5 w-5 text-slate-500" aria-hidden />}
                />
                {menu === "move" ? (
                  <div
                    role="menu"
                    className="absolute right-0 z-[90] mt-1 w-64 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
                  >
                    <p className="px-3 py-1.5 text-xs font-medium text-slate-500">
                      Move to campaign
                    </p>
                    {campaigns.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-500">
                        No other campaigns.
                      </p>
                    ) : (
                      campaigns.map((campaign) => (
                        <button
                          key={campaign.id}
                          type="button"
                          role="menuitem"
                          className="block w-full truncate px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            onMove(selectedIds, campaign.id);
                            setSelectedIds([]);
                            setMenu(null);
                          }}
                        >
                          {campaign.name}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              <TableToolbarButton
                label="Remove"
                disabled={busy}
                onClick={confirmDelete}
                icon={<Trash2 className="h-5 w-5 text-slate-500" aria-hidden />}
              />
            </>
          ) : null}
          {repliesHref ? (
            <Link
              href={repliesHref}
              className="ml-1 inline-flex h-10 shrink-0 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-50"
            >
              View replies
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => onAdd()}
            className="inline-flex h-10 shrink-0 items-center rounded-lg bg-[#0c5290] px-3.5 text-sm font-semibold text-white hover:bg-[#0a457a]"
          >
            Add prospects
          </button>
        </div>
      </div>
      ) : null}

      {leads.length === 0 ? (
        <CampaignAudienceEmpty variant="prospects" onAdd={onAdd} />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center text-sm text-slate-500">
          No prospects match this view.
        </div>
      ) : (
        <div
          className="overflow-x-auto overflow-y-hidden rounded-xl border border-slate-200 bg-white"
          aria-label="Campaign prospect activity"
        >
          <div className={`${ROW} border-b border-slate-200 bg-slate-50 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500`}>
            <div className="flex w-8 shrink-0 items-center justify-center">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                aria-label="Select all contacts in this view"
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
            </div>
            <div className={`flex ${contactCol} shrink-0 items-center gap-1`}>
              <span>Contact</span>
              <button
                type="button"
                onClick={() => setContactWide((wide) => !wide)}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                title={contactWide ? "Narrow contact column" : "Widen contact column"}
                aria-label={contactWide ? "Narrow contact column" : "Widen contact column"}
              >
                {contactWide ? (
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </div>
            <div className={`${COL_PROGRESS} shrink-0`}>Campaign progress</div>
            <div className={`${COL_STATUS} shrink-0`}>Status</div>
            <div className={`hidden ${COL_NEXT} shrink-0 lg:block`}>Next step</div>
            <div className={`hidden ${COL_DUE} shrink-0 xl:block`}>Next step due</div>
            <div className={`hidden ${COL_STARTED} shrink-0 xl:block`}>Started</div>
          </div>
          <ul className="w-full">
            {groups.map((group) => (
              <li key={group.key}>
                {group.label ? (
                  <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    {group.label}
                    <span className="ml-1.5 font-normal tabular-nums text-slate-400">
                      {group.rows.length}
                    </span>
                  </div>
                ) : null}
                <ul>
                  {group.rows.map((row) => {
                    const href = prospectHref?.(row.lead) ?? null;
                    const checked = selectedIdSet.has(row.lead.id);
                    return (
                      <li
                        key={row.lead.id}
                        className={`border-b border-slate-100 last:border-b-0 ${
                          checked ? "bg-sky-50/60" : ""
                        }`}
                      >
                        <div className={`${ROW} py-3 hover:bg-slate-50/80`}>
                          <div className="flex w-8 shrink-0 items-center justify-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelected(row.lead.id)}
                              aria-label={`Select ${row.name}`}
                              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            />
                          </div>
                          <div className={`flex ${contactCol} shrink-0 items-center gap-3`}>
                            <ProspectTableAvatar name={row.name} />
                            <span className="min-w-0 flex-1">
                              {href ? (
                                <Link
                                  href={href}
                                  title={row.name}
                                  className="block truncate font-medium text-[#0c5290] hover:underline"
                                >
                                  {row.name}
                                </Link>
                              ) : (
                                <span
                                  title={row.name}
                                  className="block truncate font-medium text-slate-900"
                                >
                                  {row.name}
                                </span>
                              )}
                              {row.subtitle ? (
                                <span
                                  title={row.subtitle}
                                  className="mt-0.5 block truncate text-xs text-slate-500"
                                >
                                  {row.subtitle}
                                </span>
                              ) : null}
                              <span className="mt-0.5 block truncate text-xs text-slate-500 lg:hidden">
                                {row.nextStep}
                                {row.when !== "—" ? ` · ${row.when}` : ""}
                              </span>
                            </span>
                          </div>
                          <div className={`${COL_PROGRESS} shrink-0`}>
                            <ProgressHoverCard
                              name={row.name}
                              dots={row.dots}
                              lead={row.lead}
                              steps={steps}
                              jobs={row.jobs}
                              busy={busy}
                              onMarkInterest={(outcome) =>
                                onMarkInterest(row.lead.id, outcome)
                              }
                            />
                          </div>
                          <span className={`${COL_STATUS} shrink-0`}>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASS[leadStatusTone(row.lead.status)]}`}
                            >
                              <StatusIcon kind={leadStatusIcon(row.lead.status)} />
                              {leadStatusLabel(row.lead.status)}
                            </span>
                          </span>
                          <span
                            className={`hidden ${COL_NEXT} shrink-0 whitespace-nowrap text-sm font-medium lg:block ${nextStepClass(row.nextStep, row.needsYou)}`}
                          >
                            {row.nextStep}
                          </span>
                          <span className={`hidden ${COL_DUE} shrink-0 whitespace-nowrap text-sm text-slate-600 xl:block`}>
                            {row.needsYou ? (
                              <span className="inline-flex items-center gap-1 text-amber-800">
                                <Bell className="h-3 w-3" aria-hidden />
                                Needs you
                              </span>
                            ) : (
                              <span className="tabular-nums">{row.when}</span>
                            )}
                          </span>
                          <span className={`hidden ${COL_STARTED} shrink-0 whitespace-nowrap text-sm tabular-nums text-slate-600 xl:block`}>
                            {row.startedAt ? formatShortDate(row.startedAt) : "—"}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ProgressHoverCard({
  name,
  dots,
  lead,
  steps,
  jobs,
  busy,
  onMarkInterest,
}: {
  name: string;
  dots: LeadProgressDot[];
  lead: CampaignActivityLead;
  steps: CampaignActivityStep[];
  jobs: CampaignActivityJob[];
  busy: boolean;
  onMarkInterest: (outcome: "positive" | "soft" | "negative" | null) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null
  );
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clearTimers();
    openTimerRef.current = window.setTimeout(() => {
      setOpen(true);
    }, PROGRESS_OPEN_MS);
  }, [clearTimers]);

  const scheduleHide = useCallback(() => {
    if (pinned) return;
    clearTimers();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, PROGRESS_CLOSE_MS);
  }, [clearTimers, pinned]);

  const close = useCallback(() => {
    clearTimers();
    setPinned(false);
    setOpen(false);
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target) ||
        target.closest('[role="listbox"]')
      ) {
        return;
      }
      close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [close, open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPosition(null);
      return;
    }

    function updatePosition() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const panelWidth = Math.min(PROGRESS_POPOVER_WIDTH, window.innerWidth - 24);
      let left = rect.left;
      left = Math.max(12, Math.min(left, window.innerWidth - panelWidth - 12));

      const estimatedHeight = Math.min(420, 88 + Math.max(1, steps.length) * 48);
      let top = rect.bottom + 8;
      if (top + estimatedHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - estimatedHeight - 8);
      }
      setPosition({ left, top });
    }

    updatePosition();
    const scrollOpts = { capture: true } as const;
    window.addEventListener("scroll", updatePosition, scrollOpts);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, scrollOpts);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, steps.length]);

  const panel =
    open && position ? (
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label={`Sequence progress for ${name}`}
        className="fixed z-[220] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5"
        style={{
          left: position.left,
          top: position.top,
          width: Math.min(PROGRESS_POPOVER_WIDTH, window.innerWidth - 24),
        }}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onMouseDown={() => setPinned(true)}
      >
        <div className="border-b border-slate-100 px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {dots.length
              ? `${progressDoneCount(dots)} of ${dots.length} steps done`
              : "No sequence steps yet"}
          </p>
        </div>
        <div className="max-h-[22rem] overflow-y-auto px-3 py-2.5">
          <LeadActivityDetail
            lead={lead}
            steps={steps}
            jobs={jobs}
            busy={busy}
            onMarkInterest={onMarkInterest}
          />
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="-mx-1 rounded-md px-1 py-1 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
        aria-label={
          dots.length
            ? `${progressDoneCount(dots)} of ${dots.length} steps for ${name}`
            : `Sequence progress for ${name}`
        }
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={scheduleHide}
        onClick={() => {
          clearTimers();
          if (open && pinned) {
            close();
            return;
          }
          setPinned(true);
          setOpen(true);
        }}
      >
        <ProgressRail dots={dots} />
      </button>
      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </>
  );
}

function LeadActivityDetail({
  lead,
  steps,
  jobs,
  busy,
  onMarkInterest,
}: {
  lead: CampaignActivityLead;
  steps: CampaignActivityStep[];
  jobs: CampaignActivityJob[];
  busy: boolean;
  onMarkInterest: (outcome: "positive" | "soft" | "negative" | null) => void;
}) {
  const action = actionSteps(steps);
  if (!action.length) {
    return (
      <p className="text-sm text-slate-500">
        This campaign has no sequence steps yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {lead.linkedin_url ? (
          <a
            href={lead.linkedin_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-[#0c5290] hover:underline"
          >
            Open LinkedIn profile
          </a>
        ) : null}
        <ReplyDispositionBar
          compact
          value={dispositionFromInterestOutcome(lead.interest_outcome)}
          busy={busy}
          onChange={(disposition) =>
            onMarkInterest(
              disposition === "interested"
                ? "positive"
                : disposition === "neutral"
                  ? "soft"
                  : disposition === "not_interested"
                    ? "negative"
                    : null
            )
          }
        />
      </div>
      {lead.last_error ? (
        <p className="text-xs text-rose-700">{lead.last_error}</p>
      ) : null}
      <ol className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {action.map((step) => {
          const job = [...jobs]
            .filter((j) => j.step_id === step.id)
            .sort((a, b) => b.scheduled_for.localeCompare(a.scheduled_for))[0];
          return (
            <li
              key={step.id ?? `${step.position}-${step.step_type}`}
              className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {campaignStepTypeLabel(step.step_type)}
                </p>
                {job?.last_error ? (
                  <p className="mt-0.5 text-xs text-rose-700">{job.last_error}</p>
                ) : null}
              </div>
              <p className="text-xs tabular-nums text-slate-500">
                {stepHistoryLabel({ lead, step, job: job ?? null })}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
