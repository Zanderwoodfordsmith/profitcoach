import type Anthropic from "@anthropic-ai/sdk";

import {
  createRoadmapJob,
  formatRoadmapJobNumber,
  isRoadmapStatus,
  isRoadmapVisibility,
  listRoadmapJobs,
  resolveRoadmapJobId,
  updateRoadmapJob,
  type RoadmapJob,
} from "@/lib/roadmap/core";

/**
 * Admin-only AI tools over the roadmap mutation cores. Thin wrappers only —
 * all behaviour lives in src/lib/roadmap/core.ts, shared with the admin UI.
 */

export const ROADMAP_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "list_roadmap_jobs",
    description:
      "List internal build-roadmap jobs (jobs to be done). Use before updating so you have real job ids. Optionally filter by area or status.",
    input_schema: {
      type: "object",
      properties: {
        area: {
          type: "string",
          description:
            "Filter by area: set-up, get-clients, keep-clients, platform",
        },
        status: {
          type: "string",
          description:
            "Filter by status: todo, up_next, in_progress, review, done, staged, live, evaluate, parked, vetoed",
        },
      },
    },
  },
  {
    name: "create_roadmap_job",
    description:
      "Add a job to the build roadmap. Use when the admin asks to add/track a job, task, idea, or bug. If they say 'here' or 'this page', set app_path to the current app path.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short imperative title" },
        done_when: {
          type: "string",
          description:
            "What finished looks like, in one or two plain sentences. Always set it.",
        },
        urgent: {
          type: "boolean",
          description: "True only when the admin says it's urgent (waiting costs money or risk).",
        },
        notes: {
          type: "string",
          description:
            "Scope notes — crisp enough that an agent could pick this up later",
        },
        area: {
          type: "string",
          description: "set-up, get-clients, keep-clients, or platform",
        },
        project: {
          type: "string",
          description:
            "Project label grouping related jobs, e.g. Blueprint, Ava, Scripts & BOSS Review, Classroom. Reuse an existing label from list_roadmap_jobs.",
        },
        status: {
          type: "string",
          description: "todo (default), up_next, in_progress, review, done, staged, live, evaluate, parked, vetoed",
        },
        blocked_by: {
          type: "string",
          description:
            "What blocks it, if anything. A job with blocked_by set shows a red blocked flag; there is no blocked status.",
        },
        app_path: {
          type: "string",
          description: "App route this job relates to, e.g. /admin/linkedin",
        },
        checklist: {
          type: "array",
          items: { type: "string" },
          description: "Initial checklist items (steps toward the outcome)",
        },
        impact: {
          type: "number",
          description:
            "1-5: how much better it makes BCA. 5 = a big move on coach results (calls, clients), cash (sales, upgrades, retention), member happiness, or Zander's time (less manual work). Only set when the admin gives or agrees a score.",
        },
        ease: {
          type: "number",
          description:
            "1-5: time until live, including review and anyone else it needs. 5 = under an hour (one prompt), 4 = half a day, 3 = a day or two, 2 = about a week, 1 = longer or waiting on others. Only set when the admin gives or agrees a score.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_roadmap_job",
    description:
      "Update an existing roadmap job (status, title, notes, blocked_by, area, project, visibility, app_path, impact, ease). Requires the job id or number from list_roadmap_jobs.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Job id (uuid) or job number, e.g. #12 or 12",
        },
        status: {
          type: "string",
          description: "todo, up_next, in_progress, review, done, staged, live, evaluate, parked, vetoed",
        },
        title: { type: "string" },
        notes: { type: "string" },
        done_when: { type: "string", description: "What finished looks like" },
        urgent: { type: "boolean", description: "Set or clear the Urgent flag" },
        blocked_by: { type: "string" },
        area: { type: "string" },
        project: {
          type: "string",
          description: "Project label; empty string clears it",
        },
        app_path: { type: "string" },
        visibility: {
          type: "string",
          description:
            "internal (default) or members (shows on the public member roadmap later)",
        },
        impact: {
          type: "number",
          description:
            "1-5: how much better it makes BCA. 5 = a big move on coach results (calls, clients), cash (sales, upgrades, retention), member happiness, or Zander's time (less manual work). Only set when the admin gives or agrees a score.",
        },
        ease: {
          type: "number",
          description:
            "1-5: time until live, including review and anyone else it needs. 5 = under an hour (one prompt), 4 = half a day, 3 = a day or two, 2 = about a week, 1 = longer or waiting on others. Only set when the admin gives or agrees a score.",
        },
        add_checklist_items: {
          type: "array",
          items: { type: "string" },
          description: "Checklist items to append to the job",
        },
        complete_checklist_items: {
          type: "array",
          items: { type: "string" },
          description:
            "Existing checklist items to mark done, matched by (partial) text",
        },
      },
      required: ["id"],
    },
  },
];

export const ROADMAP_TOOLS_SYSTEM_SECTION = `# Build roadmap tools (admin only)
You can read and write the internal build roadmap (jobs to be done) using tools.
- Granularity rule: a job = one result that can be shipped and reviewed in one sitting, named so it is obvious when it's finished (e.g. "Blueprint: voice call hands over to checking", not "Ava"). Steps belong on its checklist. A bigger piece of work is a project label shared by several jobs. A new idea that comes up mid-job is a new job in the same project, not more checklist on the current one.
- Every job has done_when (its own field): exactly what finished looks like, one or two sentences. Notes hold the why and the scope; don't repeat done_when in notes.
- Always call list_roadmap_jobs before updating, and never invent job ids.
- Every job has a number shown as #12. The admin may say "12", "#12", "BLD-12" or "build 12": that is job number 12. Use #12 when referring to a job.
- Areas, in coach-journey order: set-up (practice install: Blueprint, brand, website, profile, onboarding), get-clients (leads, replies, bookings, closes), keep-clients (deliver for clients and keep them), platform (the app itself: Classroom, Ava plumbing, admin, fixes).
- Scores: impact and ease, each 1-5. Impact = how much better it makes BCA: coach results (calls, clients), cash (sales, upgrades, retention), member happiness, or Zander's time (less manual work, more automated); 5 = a big move on any one. Ease = time until live including review and anyone else needed: 5 under an hour (one prompt), 4 half a day, 3 a day or two, 2 about a week, 1 longer or waiting on others. Suggest scores if asked, but only write them when the admin gives or agrees them.
- Statuses (workflow order): todo, up_next, in_progress, review, done, staged, live. Ideas sit outside the flow: evaluate = a new idea saved with a description, not scored or decided yet (put new ideas here unless the admin says otherwise); parked = a good idea for one day, not now; vetoed = decided against for now, kept as a log of what was ruled out (check it before suggesting something similar). Visibility: internal (default) or members.
- "review" = built, waiting for the admin to check it; when you finish building a job, move it to review, never straight to done. "done" (shown as Ready) = the admin checked it, waiting for the next stage. "staged" = on staging.theprofitcoach.com, waiting to go live. "live" = coaches/members have it.
- urgent = waiting costs money or risk; urgent jobs sort to the top whatever their scores. Only set it when the admin says so.
- Blocked is NOT a status: to mark a job blocked, set blocked_by to the reason (keep its status). To unblock, set blocked_by to an empty string.
- When the admin says "add a job here" or refers to "this page", set app_path from the current app path in context.
- Write notes crisp enough that an autonomous agent could pick the job up later.
- Jobs can carry reference images (design refs/screenshots, uploaded in the roadmap UI). Each has a public url — include those urls when summarising or handing a job to a builder.
- Only use these tools for roadmap/job/task management requests — never while drafting coach marketing copy.
- After a write, confirm in one short sentence what changed.`;

function compactJob(j: RoadmapJob) {
  return {
    id: j.id,
    number: formatRoadmapJobNumber(j.job_number),
    title: j.title,
    area: j.area,
    project: j.project,
    status: j.status,
    blocked_by: j.blocked_by,
    app_path: j.app_path,
    visibility: j.visibility,
    impact: j.impact,
    ease: j.ease,
    done_when: j.done_when,
    urgent: j.urgent,
    notes: j.notes ? j.notes.slice(0, 400) : null,
    checklist: (j.checklist ?? []).map((c) => ({
      text: c.text,
      done: c.done,
    })),
    images: (j.images ?? []).map((i) => ({ name: i.name, url: i.url })),
  };
}

function strArray(input: ToolInput, key: string): string[] {
  const v = input[key];
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim());
}

function makeChecklistItems(texts: string[]) {
  return texts.map((text) => ({
    id: crypto.randomUUID(),
    text,
    done: false,
  }));
}

type ToolInput = Record<string, unknown>;

function str(input: ToolInput, key: string): string | undefined {
  const v = input[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function score(input: ToolInput, key: string): number | null {
  const v = Number(input[key]);
  return Number.isFinite(v) && v >= 1 && v <= 5 ? Math.round(v) : null;
}

export async function executeRoadmapTool(
  name: string,
  rawInput: unknown
): Promise<string> {
  const input = (rawInput ?? {}) as ToolInput;
  try {
    if (name === "list_roadmap_jobs") {
      const statusRaw = str(input, "status");
      const jobs = await listRoadmapJobs({
        area: str(input, "area") ?? null,
        status: statusRaw && isRoadmapStatus(statusRaw) ? statusRaw : null,
      });
      return JSON.stringify({ count: jobs.length, jobs: jobs.map(compactJob) });
    }

    if (name === "create_roadmap_job") {
      const title = str(input, "title");
      if (!title) return JSON.stringify({ error: "title is required" });
      const statusRaw = str(input, "status");
      const job = await createRoadmapJob({
        title,
        notes: str(input, "notes") ?? null,
        doneWhen: str(input, "done_when") ?? null,
        urgent: input.urgent === true,
        area: str(input, "area") ?? null,
        project: str(input, "project") ?? null,
        status: statusRaw && isRoadmapStatus(statusRaw) ? statusRaw : null,
        blockedBy: str(input, "blocked_by") ?? null,
        appPath: str(input, "app_path") ?? null,
        impact: score(input, "impact"),
        ease: score(input, "ease"),
      });
      const checklistTexts = strArray(input, "checklist");
      const withChecklist =
        checklistTexts.length > 0
          ? await updateRoadmapJob(job.id, {
              checklist: makeChecklistItems(checklistTexts),
            })
          : job;
      return JSON.stringify({ created: compactJob(withChecklist) });
    }

    if (name === "update_roadmap_job") {
      const ref = str(input, "id");
      if (!ref) return JSON.stringify({ error: "id is required" });
      const id = await resolveRoadmapJobId(ref);
      if (!id) return JSON.stringify({ error: `No job ${ref}.` });
      const statusRaw = str(input, "status");
      const visibilityRaw = str(input, "visibility");

      // Checklist ops need the current items (append / mark done by text).
      const addItems = strArray(input, "add_checklist_items");
      const completeItems = strArray(input, "complete_checklist_items");
      let checklistPatch: { checklist: RoadmapJob["checklist"] } | null = null;
      if (addItems.length > 0 || completeItems.length > 0) {
        const all = await listRoadmapJobs();
        const current = all.find((j) => j.id === id);
        if (!current) return JSON.stringify({ error: "Job not found." });
        const updated = (current.checklist ?? []).map((c) => {
          const matched = completeItems.some((t) =>
            c.text.toLowerCase().includes(t.toLowerCase())
          );
          return matched ? { ...c, done: true } : c;
        });
        checklistPatch = {
          checklist: [...updated, ...makeChecklistItems(addItems)],
        };
      }

      const job = await updateRoadmapJob(id, {
        ...(checklistPatch ?? {}),
        ...(str(input, "title") ? { title: str(input, "title") } : {}),
        ...(str(input, "notes") ? { notes: str(input, "notes") } : {}),
        ...(str(input, "done_when") ? { doneWhen: str(input, "done_when") } : {}),
        ...(typeof input.urgent === "boolean" ? { urgent: input.urgent } : {}),
        ...(str(input, "area") ? { area: str(input, "area") } : {}),
        ...("project" in input ? { project: str(input, "project") ?? null } : {}),
        // blocked_by: present-but-empty clears the blocked flag.
        ...("blocked_by" in input
          ? { blockedBy: str(input, "blocked_by") ?? null }
          : {}),
        ...(str(input, "app_path")
          ? { appPath: str(input, "app_path") }
          : {}),
        ...(statusRaw && isRoadmapStatus(statusRaw)
          ? { status: statusRaw }
          : {}),
        ...(visibilityRaw && isRoadmapVisibility(visibilityRaw)
          ? { visibility: visibilityRaw }
          : {}),
        ...(score(input, "impact") !== null
          ? { impact: score(input, "impact") }
          : {}),
        ...(score(input, "ease") !== null ? { ease: score(input, "ease") } : {}),
      });
      return JSON.stringify({ updated: compactJob(job) });
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` });
  } catch (e) {
    return JSON.stringify({
      error: e instanceof Error ? e.message : "Tool execution failed.",
    });
  }
}
