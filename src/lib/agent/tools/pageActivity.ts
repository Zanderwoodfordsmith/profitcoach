import { activityBrief, changeOpenDraft, openWork, queueCoachMessage } from "@/lib/launch/jobActivity";
import { pageScope } from "@/lib/launch/avaWork";

import { workPageFromPath } from "../pageWork";
import type { AgentToolContext, AgentToolDef } from "../types";
import { AgentToolError, coachOf, str } from "./util";

/**
 * Admin only, on a coach's Blueprint page (4 Nov: the Ava tab and Activity in
 * one): read what's waiting for BCA, change Ava's waiting draft, or leave a
 * message for BCA to send. Nothing here reaches the coach; BCA presses Save
 * or Send in the strip at the top of Ava's panel.
 */

function scopeOf(ctx: AgentToolContext): { scope: string; title: string } {
  const page = workPageFromPath(ctx.screenPath);
  if (!page) throw new AgentToolError("Open one page of the coach's Blueprint first.");
  return { scope: pageScope(page.slug), title: page.title };
}

export const pageActivityTools: AgentToolDef[] = [
  {
    name: "read_page_activity",
    label: "Looking at this page's work",
    modes: ["admin"],
    needsCoach: true,
    description:
      "This Blueprint page's work for BCA: sections and their skills, what's missing, and the full text of the draft and message waiting in the strip at the top of Ava's panel.",
    input_schema: { type: "object", properties: {} },
    run: async (_input, ctx) => {
      const coach = coachOf(ctx);
      const { scope, title } = scopeOf(ctx);
      const [brief, open] = await Promise.all([activityBrief(coach.id, scope), openWork(coach.id, scope)]);
      return { page: title, brief, waiting_draft: open.draft, waiting_message: open.message };
    },
  },
  {
    name: "change_page_draft",
    label: "Changing the draft",
    modes: ["admin"],
    needsCoach: true,
    description:
      "Change the draft waiting in the strip at the top of Ava's panel. Makes a new version of the sections named (all of them if none), with BCA's changes in their words. Takes up to a minute.",
    input_schema: {
      type: "object",
      properties: {
        changes: { type: "string", description: "What to change, in BCA's words." },
        sections: { type: "array", items: { type: "string" }, description: "Section keys from the draft, e.g. campaigns:messaging. Leave out for all." },
      },
      required: ["changes"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const { scope } = scopeOf(ctx);
      const changes = str(input, "changes");
      if (!changes) throw new AgentToolError("Say what to change.");
      const keys = Array.isArray(input.sections) ? input.sections.filter((k): k is string => typeof k === "string") : [];
      try {
        const item = await changeOpenDraft(coach.id, scope, changes, keys, ctx.actorUserId);
        return { ok: true, version: item.payload.version, sections: (item.payload.sections ?? []).map((s) => s.title), note: "The new version is in the strip at the top of my panel." };
      } catch (err) {
        throw new AgentToolError(err instanceof Error ? err.message : "Could not change the draft.");
      }
    },
  },
  {
    name: "queue_coach_message",
    label: "Writing a message for the coach",
    modes: ["admin"],
    needsCoach: true,
    description:
      "Leave a message from Ava to the coach in the strip at the top of Ava's panel. It replaces any message already waiting. BCA edits it and presses Send; it goes into this page's chat, signed Ava.",
    input_schema: {
      type: "object",
      properties: { message: { type: "string", description: "The message, written to the coach." } },
      required: ["message"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const { scope } = scopeOf(ctx);
      try {
        await queueCoachMessage(coach.id, scope, str(input, "message"));
      } catch (err) {
        throw new AgentToolError(err instanceof Error ? err.message : "Could not leave the message.");
      }
      return { ok: true, note: "Waiting in the strip at the top of my panel for BCA to check and send." };
    },
  },
];
