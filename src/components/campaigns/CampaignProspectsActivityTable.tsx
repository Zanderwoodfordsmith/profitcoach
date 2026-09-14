"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  Bell,
  Check,
  ChevronDown,
  CircleDashed,
  Clock,
  MessageCircle,
  Minus,
  Pause,
  Play,
  Search,
} from "lucide-react";
import { ProspectTableAvatar } from "@/components/prospects/ProspectTableAvatar";
import { campaignStepTypeLabel } from "@/lib/unipile/campaignStepTypes";
import {
  actionSteps,
  campaignLeadName,
  leadNeedsCoach,
  leadProgressDots,
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

type SortField = "name" | "status" | "nextStep" | "when";

type Props = {
  leads: CampaignActivityLead[];
  steps: CampaignActivityStep[];
  jobs: CampaignActivityJob[];
  campaignStatus: string;
  busy?: boolean;
  onAdd: () => void;
  onDelete: (leadId: string) => void;
  onMarkInterest: (leadId: string) => void;
};

const FILTERS: Array<{ id: ActivityFilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "In progress" },
  { id: "pending", label: "Pending" },
  { id: "needsYou", label: "Needs you" },
  { id: "replied", label: "Replied" },
  { id: "finished", label: "Finished" },
  { id: "failed", label: "Failed" },
];

const TONE_CLASS: Record<LeadStatusTone, string> = {
  emerald: "bg-emerald-50 text-emerald-800",
  sky: "bg-sky-50 text-sky-800",
  amber: "bg-amber-50 text-amber-900",
  rose: "bg-rose-50 text-rose-800",
  slate: "bg-slate-100 text-slate-600",
};

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

function ProgressRail({
  dots,
  name,
}: {
  dots: LeadProgressDot[];
  name: string;
}) {
  if (!dots.length) return <span className="text-slate-400">—</span>;
  const done = dots.filter((d) => d.state === "done").length;
  const title = `${done} of ${dots.length} steps done for ${name}`;
  return (
    <div className="flex items-center gap-0.5" title={title} aria-label={title}>
      {dots.map((dot, i) => (
        <span key={`${dot.position}-${dot.stepType}`} className="flex items-center">
          {i > 0 ? (
            <span
              className={`h-px w-2 ${
                dots[i - 1]?.state === "done" || dots[i - 1]?.state === "error"
                  ? "bg-sky-400"
                  : "bg-slate-200"
              }`}
              aria-hidden
            />
          ) : null}
          <span
            className={`block rounded-full ${
              dot.state === "current"
                ? "h-2.5 w-2.5 bg-sky-600 ring-2 ring-sky-200"
                : dot.state === "done"
                  ? "h-2 w-2 bg-sky-600"
                  : dot.state === "error"
                    ? "h-2 w-2 bg-rose-500"
                    : "h-2 w-2 bg-slate-200"
            }`}
            title={`${dot.label}: ${dot.state === "done" ? "done" : dot.state === "current" ? "next" : dot.state === "error" ? "failed" : "remaining"}`}
          />
        </span>
      ))}
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

export function CampaignProspectsActivityTable({
  leads,
  steps,
  jobs,
  campaignStatus,
  busy = false,
  onAdd,
  onDelete,
  onMarkInterest,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ActivityFilterId>("all");
  const [sortField, setSortField] = useState<SortField>("when");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [openId, setOpenId] = useState<string | null>(null);

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
    };
    for (const lead of leads) {
      const leadJobs = jobsByLead.get(lead.id) ?? [];
      if (matchesActivityFilter(lead, leadJobs, "active")) counts.active += 1;
      if (matchesActivityFilter(lead, leadJobs, "pending")) counts.pending += 1;
      if (matchesActivityFilter(lead, leadJobs, "replied")) counts.replied += 1;
      if (matchesActivityFilter(lead, leadJobs, "finished")) counts.finished += 1;
      if (matchesActivityFilter(lead, leadJobs, "failed")) counts.failed += 1;
      if (matchesActivityFilter(lead, leadJobs, "needsYou")) counts.needsYou += 1;
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
      };
    });

    decorated.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "status") {
        cmp = leadStatusLabel(a.status).localeCompare(leadStatusLabel(b.status));
      } else if (sortField === "nextStep") cmp = a.nextStep.localeCompare(b.nextStep);
      else {
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

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDir(field === "name" ? "asc" : "asc");
  }

  return (
    <div className="min-h-[60vh]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prospects"
            aria-label="Search prospects"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
          />
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 rounded-lg bg-[#0c5290] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0a457a]"
        >
          Add prospects
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((item) => {
          const count = filterCounts[item.id];
          if (item.id !== "all" && count === 0) return null;
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
              }`}
            >
              {item.label}
              <span className={`ml-1 tabular-nums ${active ? "text-white/70" : "text-slate-400"}`}>
                {count}
              </span>
            </button>
          );
        })}
        {query.trim() || filter !== "all" ? (
          <span className="ml-1 text-xs text-slate-400">
            {rows.length} shown
          </span>
        ) : null}
      </div>

      {leads.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center rounded-2xl bg-slate-50">
          <div className="text-center">
            <p className="text-sm text-slate-500">No prospects yet</p>
            <button
              type="button"
              onClick={onAdd}
              className="mt-2 text-sm font-semibold text-[#0c5290] hover:underline"
            >
              Add prospects
            </button>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center text-sm text-slate-500">
          No prospects match this view.
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          aria-label="Campaign prospect activity"
        >
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <div className="min-w-0 flex-1">
              <SortButton
                label="Lead"
                active={sortField === "name"}
                onClick={() => toggleSort("name")}
              />
            </div>
            <div className="shrink-0">
              <SortButton
                label="Status"
                active={sortField === "status"}
                onClick={() => toggleSort("status")}
              />
            </div>
            <div className="hidden w-28 shrink-0 lg:block">
              <SortButton
                label="Next step"
                active={sortField === "nextStep"}
                onClick={() => toggleSort("nextStep")}
              />
            </div>
            <div className="hidden w-28 shrink-0 xl:block">
              <SortButton
                label="When"
                active={sortField === "when"}
                onClick={() => toggleSort("when")}
              />
            </div>
            <div className="w-14 shrink-0" />
          </div>
          <ul>
            {rows.map((row) => {
              const open = openId === row.lead.id;
              const canInterest =
                (row.lead.status === "replied" ||
                  row.lead.status === "in_sequence" ||
                  row.lead.status === "connected") &&
                !row.lead.interest_outcome;
              const subtitle = row.lead.company || row.lead.title || "";
              return (
                <li key={row.lead.id} className="border-b border-slate-100 last:border-b-0">
                  <div className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/80">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : row.lead.id)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      aria-expanded={open}
                    >
                      <ProspectTableAvatar name={row.name} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1">
                          <span className="truncate font-medium text-slate-900">
                            {row.name}
                          </span>
                          <ChevronDown
                            className={`h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform ${open ? "rotate-180" : ""}`}
                            aria-hidden
                          />
                        </span>
                        {subtitle ? (
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {subtitle}
                          </span>
                        ) : null}
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <ProgressRail dots={row.dots} name={row.name} />
                          <span className="text-xs text-slate-500 lg:hidden">
                            {row.nextStep}
                            {row.when !== "—" ? ` · ${row.when}` : ""}
                          </span>
                        </span>
                      </span>
                    </button>
                    <span
                      className={`mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[leadStatusTone(row.lead.status)]}`}
                    >
                      <StatusIcon kind={leadStatusIcon(row.lead.status)} />
                      {leadStatusLabel(row.lead.status)}
                    </span>
                    <span className="mt-1 hidden w-28 shrink-0 text-sm font-medium text-slate-800 lg:block">
                      {row.nextStep}
                    </span>
                    <span className="mt-1 hidden w-28 shrink-0 text-sm text-slate-600 xl:block">
                      {row.needsYou ? (
                        <span className="inline-flex items-center gap-1 text-amber-800">
                          <Bell className="h-3 w-3" aria-hidden />
                          Needs you
                        </span>
                      ) : (
                        <span className="tabular-nums">{row.when}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDelete(row.lead.id)}
                      className="mt-1 w-14 shrink-0 text-right text-xs font-medium text-slate-400 hover:text-rose-600 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                  {open ? (
                    <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3">
                      <LeadActivityDetail
                        lead={row.lead}
                        steps={steps}
                        jobs={row.jobs}
                        canInterest={canInterest}
                        busy={busy}
                        onMarkInterest={() => onMarkInterest(row.lead.id)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function SortButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wide ${
        active ? "text-slate-700" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" aria-hidden />
    </button>
  );
}

function LeadActivityDetail({
  lead,
  steps,
  jobs,
  canInterest,
  busy,
  onMarkInterest,
}: {
  lead: CampaignActivityLead;
  steps: CampaignActivityStep[];
  jobs: CampaignActivityJob[];
  canInterest: boolean;
  busy: boolean;
  onMarkInterest: () => void;
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
        {canInterest ? (
          <button
            type="button"
            disabled={busy}
            onClick={onMarkInterest}
            className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
          >
            Mark interested
          </button>
        ) : null}
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
