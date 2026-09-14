import {
  callWaitFrom,
  campaignStepIsInternal,
  campaignStepTypeLabel,
} from "@/lib/unipile/campaignStepTypes";
import {
  formatDayLabel,
  formatShortDateTime,
  formatShortTime,
} from "@/lib/formatShortDate";

export type CampaignActivityLead = {
  id: string;
  linkedin_url: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title?: string | null;
  status: string;
  interest_outcome?: string | null;
  last_error: string | null;
  current_step_position?: number;
  next_action_at?: string | null;
};

export type CampaignActivityStep = {
  id?: string;
  position: number;
  step_type: string;
  config?: unknown;
};

export type CampaignActivityJob = {
  id: string;
  lead_id: string;
  step_id: string;
  status: string;
  scheduled_for: string;
  last_error: string | null;
  updated_at?: string | null;
};

export type LeadStatusTone = "emerald" | "sky" | "amber" | "rose" | "slate";

export type LeadStatusIcon =
  | "replied"
  | "connected"
  | "pending"
  | "sequence"
  | "queued"
  | "paused"
  | "failed"
  | "finished"
  | "skipped"
  | "needsYou";

export type LeadProgressDot = {
  position: number;
  stepType: string;
  label: string;
  state: "done" | "current" | "remaining" | "error";
};

const TERMINAL_STATUSES = new Set([
  "replied",
  "interested",
  "assessment_sent",
  "assessment_done",
  "call_offered",
  "completed",
  "failed",
  "skipped",
]);

export const OPEN_CAMPAIGN_LEAD_STATUSES = [
  "queued",
  "invited",
  "connected",
  "in_sequence",
  "paused",
] as const;

const OPEN_STATUSES = new Set<string>(OPEN_CAMPAIGN_LEAD_STATUSES);

export function campaignLeadName(lead: CampaignActivityLead): string {
  return (
    [lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
    lead.linkedin_url ||
    "Unknown"
  );
}

export function isTerminalLeadStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isOpenLeadStatus(status: string): boolean {
  return OPEN_STATUSES.has(status);
}

export function leadStatusLabel(status: string): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "invited":
      return "Connection pending";
    case "connected":
      return "Connected";
    case "in_sequence":
      return "In sequence";
    case "paused":
      return "Paused";
    case "replied":
      return "Replied";
    case "interested":
      return "Interested";
    case "assessment_sent":
      return "Score sent";
    case "assessment_done":
      return "Score done";
    case "call_offered":
      return "Call offered";
    case "completed":
      return "Finished";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
  }
}

export function leadStatusTone(status: string): LeadStatusTone {
  switch (status) {
    case "replied":
    case "connected":
    case "interested":
    case "assessment_done":
    case "call_offered":
      return "emerald";
    case "in_sequence":
    case "assessment_sent":
      return "sky";
    case "paused":
      return "amber";
    case "failed":
      return "rose";
    default:
      return "slate";
  }
}

export function leadStatusIcon(status: string): LeadStatusIcon {
  switch (status) {
    case "replied":
    case "interested":
      return "replied";
    case "connected":
      return "connected";
    case "invited":
      return "pending";
    case "in_sequence":
    case "assessment_sent":
      return "sequence";
    case "paused":
      return "paused";
    case "failed":
      return "failed";
    case "completed":
    case "assessment_done":
    case "call_offered":
      return "finished";
    case "skipped":
      return "skipped";
    default:
      return "queued";
  }
}

export function actionSteps(
  steps: CampaignActivityStep[]
): CampaignActivityStep[] {
  return [...steps]
    .filter((step) => step.step_type !== "wait")
    .sort((a, b) => a.position - b.position);
}

function stepAt(
  steps: CampaignActivityStep[],
  position: number
): CampaignActivityStep | undefined {
  return steps.find((step) => step.position === position);
}

/** The next outbound action still ahead for this lead, or null if finished. */
export function nextActionStep(
  lead: CampaignActivityLead,
  steps: CampaignActivityStep[]
): CampaignActivityStep | null {
  if (isTerminalLeadStatus(lead.status)) return null;
  const sorted = [...steps].sort((a, b) => a.position - b.position);
  let pos = lead.current_step_position ?? 0;
  if (lead.status === "invited") pos += 1;
  for (let i = 0; i < sorted.length + 2; i += 1) {
    const step = stepAt(sorted, pos);
    if (!step) return null;
    if (
      step.step_type === "wait" ||
      campaignStepIsInternal(step.step_type) ||
      (step.step_type === "call" && !callWaitFrom(step.config))
    ) {
      pos += 1;
      continue;
    }
    return step;
  }
  return null;
}

export function nextStepLabel(
  lead: CampaignActivityLead,
  steps: CampaignActivityStep[]
): string {
  if (lead.status === "failed") return "Stopped";
  if (lead.status === "skipped") return "Skipped";
  if (lead.status === "replied" || lead.status === "interested") return "Finished";
  if (lead.status === "completed") return "Finished";
  const step = nextActionStep(lead, steps);
  if (!step) return "Finished";
  return campaignStepTypeLabel(step.step_type);
}

function latestJobForStep(
  jobs: CampaignActivityJob[],
  stepId: string | undefined
): CampaignActivityJob | null {
  if (!stepId) return null;
  const matches = jobs.filter((job) => job.step_id === stepId);
  if (!matches.length) return null;
  return matches.reduce((best, job) =>
    job.scheduled_for > best.scheduled_for ? job : best
  );
}

export function leadNeedsCoach(
  lead: CampaignActivityLead,
  jobs: CampaignActivityJob[]
): boolean {
  return jobs.some(
    (job) => job.lead_id === lead.id && job.status === "awaiting_coach"
  );
}

export function leadProgressDots(
  lead: CampaignActivityLead,
  steps: CampaignActivityStep[],
  jobs: CampaignActivityJob[]
): LeadProgressDot[] {
  const next = nextActionStep(lead, steps);
  const leadJobs = jobs.filter((job) => job.lead_id === lead.id);
  const finished = lead.status === "completed";
  const failed = lead.status === "failed";

  return actionSteps(steps).map((step) => {
    const job = latestJobForStep(leadJobs, step.id);
    const label = campaignStepTypeLabel(step.step_type);
    if (job?.status === "failed" || (failed && next?.position === step.position)) {
      return { position: step.position, stepType: step.step_type, label, state: "error" };
    }
    if (job?.status === "succeeded") {
      return { position: step.position, stepType: step.step_type, label, state: "done" };
    }
    if (finished) {
      return { position: step.position, stepType: step.step_type, label, state: "done" };
    }
    if (next && step.position === next.position) {
      return { position: step.position, stepType: step.step_type, label, state: "current" };
    }
    if (next && step.position < next.position) {
      return { position: step.position, stepType: step.step_type, label, state: "done" };
    }
    if (!next && isTerminalLeadStatus(lead.status) && step.position <= (lead.current_step_position ?? 0)) {
      return { position: step.position, stepType: step.step_type, label, state: "done" };
    }
    return { position: step.position, stepType: step.step_type, label, state: "remaining" };
  });
}

export function formatUpcomingWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() < Date.now() - 60_000) return "Due now";
  const day = formatDayLabel(iso);
  if (day === "Today") return `Today, ${formatShortTime(iso)}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startTomorrow = new Date(
    tomorrow.getFullYear(),
    tomorrow.getMonth(),
    tomorrow.getDate()
  );
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (startDate.getTime() === startTomorrow.getTime()) {
    return `Tomorrow, ${formatShortTime(iso)}`;
  }
  return formatShortDateTime(iso);
}

export function leadWhenLabel(input: {
  lead: CampaignActivityLead;
  steps: CampaignActivityStep[];
  jobs: CampaignActivityJob[];
  campaignStatus: string;
}): string {
  const { lead, jobs, campaignStatus } = input;
  if (leadNeedsCoach(lead, jobs.filter((job) => job.lead_id === lead.id))) {
    return "Needs you";
  }
  if (lead.status === "invited") return "Waiting for accept";
  if (lead.status === "paused") return "Paused";
  if (lead.status === "failed") return "Failed";
  if (isTerminalLeadStatus(lead.status)) return "—";
  if (campaignStatus !== "running" && lead.status === "queued") return "Not started";
  return formatUpcomingWhen(lead.next_action_at) ?? "—";
}

export type ActivityFilterId =
  | "all"
  | "active"
  | "pending"
  | "replied"
  | "finished"
  | "failed"
  | "needsYou";

export function matchesActivityFilter(
  lead: CampaignActivityLead,
  jobs: CampaignActivityJob[],
  filter: ActivityFilterId
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "active":
      return isOpenLeadStatus(lead.status);
    case "pending":
      return lead.status === "invited" || lead.status === "queued";
    case "replied":
      return (
        lead.status === "replied" ||
        lead.status === "interested" ||
        lead.status === "assessment_sent" ||
        lead.status === "assessment_done" ||
        lead.status === "call_offered"
      );
    case "finished":
      return lead.status === "completed" || lead.status === "skipped";
    case "failed":
      return lead.status === "failed";
    case "needsYou":
      return leadNeedsCoach(lead, jobs);
    default:
      return true;
  }
}

export function jobStatusLabel(status: string): string {
  switch (status) {
    case "succeeded":
      return "Sent";
    case "pending":
      return "Scheduled";
    case "running":
      return "Sending";
    case "awaiting_coach":
      return "Needs you";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function stepHistoryLabel(input: {
  lead: CampaignActivityLead;
  step: CampaignActivityStep;
  job: CampaignActivityJob | null;
}): string {
  const { lead, step, job } = input;
  if (job) {
    if (job.status === "succeeded" && job.updated_at) {
      const verb = step.step_type === "call" ? "Called" : "Sent";
      return `${verb} · ${formatShortDateTime(job.updated_at)}`;
    }
    if (job.status === "pending" || job.status === "awaiting_coach") {
      return `${jobStatusLabel(job.status)} · ${formatShortDateTime(job.scheduled_for)}`;
    }
    return jobStatusLabel(job.status);
  }
  if (lead.status === "invited" && step.step_type === "invite") {
    return "Sent · waiting for accept";
  }
  const current = lead.current_step_position ?? 0;
  const doneVerb = step.step_type === "call" ? "Called" : "Sent";
  if (step.position < current) return doneVerb;
  if (step.position === current && isTerminalLeadStatus(lead.status)) {
    return lead.status === "failed" ? "Failed" : doneVerb;
  }
  return step.step_type === "call" ? "Not called" : "Not sent";
}
