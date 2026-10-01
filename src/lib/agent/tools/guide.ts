import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { AgentToolDef } from "../types";
import { AgentToolError, coachOf, isUuid, str } from "./util";

/** "Take me there" links, and the admin switch for coach access to the agent. */

const PAGES: Record<string, { path: string; label: string }> = {
  campaigns: { path: "/campaigns", label: "Open Campaigns" },
  pool: { path: "/campaigns?tab=pool", label: "Open the Pool" },
  magnets: { path: "/campaigns?tab=magnets", label: "Open Lead magnets" },
  conversations: { path: "/conversations", label: "Open Conversations" },
  calls: { path: "/calls", label: "Open Calls" },
  prospects: { path: "/prospects", label: "Open Prospects" },
  content: { path: "/linkedin", label: "Open Content" },
  links: { path: "/share", label: "Open Links" },
  "first-campaign": { path: "/first-campaign", label: "Open First Campaign" },
  blueprint: { path: "/practice", label: "Open the Practice Blueprint" },
};

export const PAGE_KEYS = [...Object.keys(PAGES), "campaign"];

export function pageHref(
  mode: "admin" | "coach",
  page: string,
  campaignId?: string | null
): { href: string; label: string } | null {
  const prefix = mode === "admin" ? "/admin" : "/coach";
  if (page === "campaign") {
    if (!campaignId || !isUuid(campaignId)) return null;
    return { href: `${prefix}/campaigns/${campaignId}`, label: "Open the campaign" };
  }
  const entry = PAGES[page];
  if (!entry) return null;
  if (page === "blueprint" && mode === "admin") {
    return { href: "/admin/blueprint/coach/blueprint", label: entry.label };
  }
  return { href: `${prefix}${entry.path}`, label: entry.label };
}

export const guideTools: AgentToolDef[] = [
  {
    name: "link_to_page",
    label: "Finding the page",
    description:
      "Give the person a button to a page in the app. Page keys come from the app map. For one campaign use page \"campaign\" with campaign_id.",
    input_schema: {
      type: "object",
      properties: {
        page: { type: "string", enum: PAGE_KEYS },
        campaign_id: { type: "string" },
        label: { type: "string", description: "Optional button text" },
      },
      required: ["page"],
    },
    run: async (input, ctx) => {
      const link = pageHref(ctx.mode, str(input, "page"), str(input, "campaign_id"));
      if (!link) throw new AgentToolError("Unknown page, or a campaign page without a campaign id.");
      const label = str(input, "label") || link.label;
      return {
        ok: true,
        note:
          ctx.mode === "admin"
            ? "Admin pages show the coach you are viewing as. Use View as coach to see theirs."
            : undefined,
        _link: { href: link.href, label },
      };
    },
  },
  {
    name: "set_agent_access",
    label: "Changing agent access",
    modes: ["admin"],
    needsCoach: true,
    description: "Admin only. Switch the agent on or off for the active coach's own account. Asks for confirmation.",
    input_schema: {
      type: "object",
      properties: { enabled: { type: "boolean" } },
      required: ["enabled"],
    },
    gate: (input, ctx) => {
      const coach = coachOf(ctx);
      const enabled = input.enabled === true;
      return {
        confirm: true,
        title: `${enabled ? "Give" : "Remove"} ${coach.name} ${enabled ? "access to" : "access from"} the agent`,
        details: [
          { label: "Coach", value: coach.name },
          {
            label: "What changes",
            value: enabled
              ? "An Agent tab appears in their Profit Coach AI panel. It acts on their account only."
              : "The Agent tab disappears for them.",
          },
        ],
      };
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const enabled = input.enabled === true;
      const { error } = await supabaseAdmin
        .from("coaches")
        .update({ ai_agent_enabled: enabled })
        .eq("id", coach.id);
      if (error) throw new Error(error.message);
      return { coach: coach.name, agent_enabled: enabled };
    },
  },
];
