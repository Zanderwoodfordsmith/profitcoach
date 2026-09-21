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
  contact_id?: string | null;
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
  created_at?: string | null;
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
    case "completed":
      return "emerald";
    case "queued":
    case "in_sequence":
    case "assessment_sent":
      return "sky";
    case "invited":
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

function isSkippableNextStep(step: CampaignActivityStep): boolean {
  return (
    step.step_type === "wait" ||
    campaignStepIsInternal(step.step_type) ||
    (step.step_type === "call" && !callWaitFrom(step.config))
  );
}

function sortedSteps(steps: CampaignActivityStep[]): CampaignActivityStep[] {
  return [...steps].sort((a, b) => a.position - b.position);
}

function nextOutboundAfterWait(
  steps: CampaignActivityStep[],
  waitIndex: number
): CampaignActivityStep | null {
  for (let i = waitIndex + 1; i < steps.length; i++) {
    if (!isSkippableNextStep(steps[i])) return steps[i];
  }
  return null;
}

function lastWaitBeforeAction(
  steps: CampaignActivityStep[],
  actionIndex: number
): CampaignActivityStep | null {
  for (let i = actionIndex - 1; i >= 0; i--) {
    const step = steps[i];
    if (step.step_type === "wait") return step;
    if (!isSkippableNextStep(step)) return null;
  }
  return null;
}

type WaitOccupancyLead = {
  status: string;
  current_step_position?: number | null;
  next_action_at?: string | null;
};

/**
 * True when this lead is waiting to take the next send after `waitPosition`.
 * They stay here until that send actually goes out — not only while the timer
 * is still running.
 */
export function leadIsHeldByWait(input: {
  lead: WaitOccupancyLead;
  waitPosition: number;
  steps: CampaignActivityStep[];
}): boolean {
  if (!isOpenLeadStatus(input.lead.status)) return false;

  const steps = sortedSteps(input.steps);
  const waitIndex = steps.findIndex((s) => s.position === input.waitPosition);
  if (waitIndex < 0 || steps[waitIndex]?.step_type !== "wait") return false;
  if (steps[waitIndex + 1]?.step_type === "wait") return false;

  const nextAction = nextOutboundAfterWait(steps, waitIndex);
  if (!nextAction) return false;
  return (input.lead.current_step_position ?? 0) === nextAction.position;
}

/** True when this lead is still in a wait immediately before `actionPosition`. */
export function leadIsHeldBeforeAction(input: {
  lead: WaitOccupancyLead;
  actionPosition: number;
  steps: CampaignActivityStep[];
}): boolean {
  const steps = sortedSteps(input.steps);
  const actionIndex = steps.findIndex((s) => s.position === input.actionPosition);
  if (actionIndex < 0) return false;
  const wait = lastWaitBeforeAction(steps, actionIndex);
  if (!wait) return false;
  return leadIsHeldByWait({
    lead: input.lead,
    waitPosition: wait.position,
    steps,
  });
}

export type LeadWaitDeletePatch = {
  id: string;
  current_step_position?: number;
  next_action_at?: string;
};

/** Shift later leads back one step; anyone in the deleted wait becomes due now. */
export function patchesAfterDeletedWait(input: {
  waitPosition: number;
  steps: CampaignActivityStep[];
  leads: Array<{ id: string } & WaitOccupancyLead>;
  nowIso: string;
}): LeadWaitDeletePatch[] {
  const held = new Set(
    input.leads
      .filter((lead) =>
        leadIsHeldByWait({
          lead,
          waitPosition: input.waitPosition,
          steps: input.steps,
        })
      )
      .map((lead) => lead.id)
  );
  const patches: LeadWaitDeletePatch[] = [];
  for (const lead of input.leads) {
    const pos = lead.current_step_position ?? 0;
    const nextPos = pos > input.waitPosition ? pos - 1 : pos;
    const release = held.has(lead.id);
    if (nextPos === pos && !release) continue;
    patches.push({
      id: lead.id,
      ...(nextPos !== pos ? { current_step_position: nextPos } : {}),
      ...(release ? { next_action_at: input.nowIso } : {}),
    });
  }
  return patches;
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
  for (const step of sorted) {
    if (step.position < pos) continue;
    if (isSkippableNextStep(step)) continue;
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
  if (step) return campaignStepTypeLabel(step.step_type);
  if (isOpenLeadStatus(lead.status)) return "—";
  return "Finished";
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

const STARTED_JOB_STATUSES = new Set([
  "succeeded",
  "running",
  "failed",
  "awaiting_coach",
]);

/** When the sequence actually began — first send, not when they were enrolled. */
export function leadStartedAt(jobs: CampaignActivityJob[]): string | null {
  let started: string | null = null;
  for (const job of jobs) {
    if (!STARTED_JOB_STATUSES.has(job.status)) continue;
    const at = job.updated_at || job.scheduled_for;
    if (!at) continue;
    if (!started || at < started) started = at;
  }
  return started;
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
  | "needsYou"
  | "paused";

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
    case "paused":
      return lead.status === "paused";
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

export type InviteFunnelSlice = "connected" | "waiting" | "remaining";

export type InviteFunnelCounts = {
  connected: number;
  waiting: number;
  remaining: number;
  total: number;
};

const INVITE_CONNECTED_STATUSES = new Set([
  "connected",
  "in_sequence",
  "replied",
  "interested",
  "assessment_sent",
  "assessment_done",
  "call_offered",
  "completed",
]);

/** Where a lead sits on the connection-request funnel. */
export function inviteFunnelSliceForLead(
  lead: { status: string; current_step_position?: number | null },
  invitePosition: number
): InviteFunnelSlice {
  if (lead.status === "invited") return "waiting";
  if (INVITE_CONNECTED_STATUSES.has(lead.status)) return "connected";
  if (
    lead.status === "paused" &&
    (lead.current_step_position ?? 0) > invitePosition
  ) {
    return "connected";
  }
  return "remaining";
}

export function inviteFunnelCounts(
  leads: Array<{ status: string; current_step_position?: number | null }>,
  invitePosition: number
): InviteFunnelCounts {
  const counts: InviteFunnelCounts = {
    connected: 0,
    waiting: 0,
    remaining: 0,
    total: leads.length,
  };
  for (const lead of leads) {
    counts[inviteFunnelSliceForLead(lead, invitePosition)] += 1;
  }
  return counts;
}
