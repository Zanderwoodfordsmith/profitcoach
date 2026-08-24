import type Anthropic from "@anthropic-ai/sdk";

import {
  createRoadmapJob,
  isRoadmapStatus,
  isRoadmapVisibility,
  listRoadmapJobs,
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
            "Filter by area: beat1, beat2, website, ai-panel, q4, general",
        },
        status: {
          type: "string",
          description:
            "Filter by status: todo, up_next, in_progress, done, live, parked",
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
        notes: {
          type: "string",
          description:
            "Scope notes — crisp enough that an agent could pick this up later",
        },
        area: {
          type: "string",
          description: "beat1, beat2, website, ai-panel, q4, or general",
        },
        status: {
          type: "string",
          description: "todo (default), up_next, in_progress, done, live, parked",
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
      },
      required: ["title"],
    },
  },
  {
    name: "update_roadmap_job",
    description:
      "Update an existing roadmap job (status, title, notes, blocked_by, area, visibility, app_path). Requires the job id from list_roadmap_jobs.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Job id (uuid)" },
        status: {
          type: "string",
          description: "todo, up_next, in_progress, done, live, parked",
        },
        title: { type: "string" },
        notes: { type: "string" },
        blocked_by: { type: "string" },
        area: { type: "string" },
        app_path: { type: "string" },
        visibility: {
          type: "string",
          description:
            "internal (default) or members (shows on the public member roadmap later)",
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
- Granularity rule: a job = an outcome/deliverable. Steps, sub-tasks, and inputs belong on an existing job's checklist — prefer add_checklist_items over creating a new job. Only create a new job for a genuinely new deliverable.
- Always call list_roadmap_jobs before updating, and never invent job ids.
- Areas: beat1 (Sept relaunch), beat2 (content studio), website, ai-panel, q4, general.
- Statuses (workflow order): todo, up_next, in_progress, done, live. parked = backlog/someday. Visibility: internal (default) or members.
- "done" means built and verified; "live" means released to coaches/members. "Shipped" or "released" from the admin means live.
- Blocked is NOT a status: to mark a job blocked, set blocked_by to the reason (keep its status). To unblock, set blocked_by to an empty string.
- When the admin says "add a job here" or refers to "this page", set app_path from the current app path in context.
- Write notes crisp enough that an autonomous agent could pick the job up later.
- Jobs can carry reference images (design refs/screenshots, uploaded in the roadmap UI). Each has a public url — include those urls when summarising or handing a job to a builder.
- Only use these tools for roadmap/job/task management requests — never while drafting coach marketing copy.
- After a write, confirm in one short sentence what changed.`;

function compactJob(j: RoadmapJob) {
  return {
    id: j.id,
    title: j.title,
    area: j.area,
    status: j.status,
    blocked_by: j.blocked_by,
    app_path: j.app_path,
    visibility: j.visibility,
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
        area: str(input, "area") ?? null,
        status: statusRaw && isRoadmapStatus(statusRaw) ? statusRaw : null,
        blockedBy: str(input, "blocked_by") ?? null,
        appPath: str(input, "app_path") ?? null,
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
      const id = str(input, "id");
      if (!id) return JSON.stringify({ error: "id is required" });
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
        ...(str(input, "area") ? { area: str(input, "area") } : {}),
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
