import { activityBrief } from "@/lib/launch/jobActivity";
import { pageScope } from "@/lib/launch/avaWork";
import { blueprintPage, type BlueprintLink } from "@/lib/practiceKnowledge/blueprint";

import type { AgentCoach } from "./types";

/** The Blueprint page open (coach or admin view), or null. */
export function blueprintPageFromPath(screenPath: string | null): BlueprintLink | null {
  const match = screenPath?.match(/\/blueprint(?:\/coach)?\/([a-z0-9-]+)\/?$/);
  return match ? blueprintPage(match[1]) : null;
}

/** One page of a coach's Blueprint, not the overview or the whole document. */
export function workPageFromPath(screenPath: string | null): BlueprintLink | null {
  const page = blueprintPageFromPath(screenPath);
  return page && page.slug !== "blueprint" && page.slug !== "command" ? page : null;
}

/**
 * Admin on a coach's Blueprint page (4 Nov: one Ava, the Ava tab and
 * Activity in one): she works for BCA on that page, knows its sections and
 * their skills, and what's waiting for BCA. Lines for her working state.
 */
export async function bcaPageWork(coach: AgentCoach, screenPath: string | null): Promise<string[]> {
  const page = workPageFromPath(screenPath);
  if (!page) return [];
  const lines = [
    `Working for BCA on ${coach.name}'s ${page.title} page. ${coach.name} never sees this chat, and nothing reaches them until BCA presses Save or Send.`,
  ];
  if (page.slug === "linkedin") {
    lines.push(
      "LinkedIn profile: write or rewrite it with blueprint-writing, write_blueprint_section, section linkedin:rewrite. Save on its card puts it in the LinkedIn editor on this page."
    );
  }
  try {
    lines.push(...(await activityBrief(coach.id, pageScope(page.slug))));
  } catch (err) {
    console.error("agent page work:", err instanceof Error ? err.message : err);
  }
  lines.push(
    "Write this page's sections with blueprint-writing (write_blueprint_section, the keys above). To change the waiting draft, read it, or leave a message for BCA to send the coach, open page-activity."
  );
  return lines;
}
