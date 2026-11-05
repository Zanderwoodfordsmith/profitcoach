import { loadGettingLive } from "@/lib/gettingLive";
import { jobStatusFrom, type JobStatus } from "@/lib/launch/jobStatus";
import { launchProgressFrom } from "@/lib/launch/progress";
import { LAUNCH_THREADS } from "@/lib/launch/threads";
import { BLUEPRINT_SECTIONS, fieldFilled, fieldValue, type FieldSpec } from "@/lib/practiceKnowledge/blueprint";
import { formatFieldValue } from "@/lib/practiceKnowledge/exportMarkdown";
import { findPracticeKnowledge } from "@/lib/practiceKnowledge/store";
import type { PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";

import { cachedFunnelNumbers, constraintCardLines } from "./tools/constraint";
import type { AgentCoach } from "./types";

/**
 * Card 178: what Ava knows about the coach before the first word, like Virtual
 * JK's client intake. About You is our intake, and the launch jobs are the
 * plan, so the card is built from those two. A snapshot at the start of the
 * turn; tools still have the full, latest detail.
 */

const VALUE_MAX = 400;
const ANSWERS_MAX = 5_000;
/** Contact details and switches tell Ava nothing about the coach. */
const SKIP_WIDGETS = new Set<FieldSpec["widget"]>(["phone", "whatsapp", "email", "switch"]);

const STATUS_WORDS: Record<JobStatus, string> = {
  done: "done",
  needs_you: "waiting on the coach",
  review: "waiting for the coach to check",
  in_progress: "in progress",
  bca_todo: "BCA to do",
  later: "not started yet",
};

const waitsOnCoach = (status: JobStatus) => status === "needs_you" || status === "review";

function shown(field: FieldSpec, row: PracticeKnowledgeRow): boolean {
  if (!field.showIf) return true;
  const gate = fieldValue(row.payload, field.showIf.path)?.value;
  return field.showIf.in.includes(String(gate ?? ""));
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function aboutYou(row: PracticeKnowledgeRow): { lines: string[]; open: number } {
  const lines: string[] = [];
  let open = 0;
  let used = 0;
  for (const ref of BLUEPRINT_SECTIONS) {
    if (!ref.group.yours || ref.section.face === "stored" || ref.section.source === "we_build") continue;
    for (const field of ref.section.fields ?? []) {
      if (SKIP_WIDGETS.has(field.widget) || !shown(field, row)) continue;
      if (!fieldFilled(row.payload, field)) {
        open += 1;
        continue;
      }
      const value = formatFieldValue(row.payload, field).join("; ").trim();
      if (!value) continue;
      const line = `- ${field.label}: ${clip(value, VALUE_MAX)}`;
      if (used + line.length > ANSWERS_MAX) continue;
      used += line.length;
      lines.push(line);
    }
  }
  return { lines, open };
}

export async function coachCard(coach: AgentCoach): Promise<string> {
  const [row, live, funnel] = await Promise.all([
    findPracticeKnowledge(coach.id),
    loadGettingLive({ coachId: coach.id }).catch(() => null),
    cachedFunnelNumbers(coach.id).catch(() => null),
  ]);
  const progress = launchProgressFrom(row, live?.rows.find((r) => r.coach_id === coach.id) ?? null);
  const first = coach.name.split(/\s+/)[0] || coach.name;

  const jobs = LAUNCH_THREADS.filter((t) => t.phase !== null).map((thread) => {
    const job = progress[thread.key];
    const status = jobStatusFrom(job?.items ?? []);
    const total = job?.items.length ?? 0;
    const done = job?.items.filter((i) => i.done).length ?? 0;
    const theirs = (job?.items ?? []).filter((i) => !i.done && i.waitsOn === "coach").map((i) => i.label);
    return { thread, status, total, done, theirs };
  });

  const jobLines = jobs.map(({ thread, status, total, done, theirs }) => {
    const count = total && status !== "done" ? ` (${done} of ${total} done)` : "";
    const needs =
      waitsOnCoach(status)
        ? ` Needs from ${first}: ${theirs.slice(0, 4).join(", ")}. ${thread.brief?.need ?? ""}`.trimEnd()
        : "";
    return `- ${thread.label}: ${STATUS_WORDS[status]}${count}.${needs}`;
  });

  const waiting = jobs.find((j) => waitsOnCoach(j.status));
  const notDone = jobs.find((j) => j.status !== "done");
  const next = waiting
    ? `Next job for ${first}: ${waiting.thread.label}.`
    : notDone
      ? `Nothing is waiting on ${first} right now. Next up: ${notDone.thread.label} (${STATUS_WORDS[notDone.status]}).`
      : `Every launch job is done.`;

  const answers = row ? aboutYou(row) : { lines: [], open: 0 };

  return [
    `# About this coach`,
    `What you know about ${coach.name} at the start of this turn, from their Blueprint and launch jobs. Use it instead of asking for anything already here. Your tools have the full, latest detail.`,
    `## Launch jobs, in order`,
    ...jobLines,
    next,
    `When a job is finished in this chat, end by naming the next job in one line, with roughly how long it takes, instead of asking another question.`,
    `## About You answers`,
    ...(answers.lines.length ? answers.lines : ["(None yet.)"]),
    ...(answers.open ? [`Still open in About You: ${answers.open} answers.`] : []),
    ...(funnel ? constraintCardLines(funnel) : []),
  ].join("\n");
}
