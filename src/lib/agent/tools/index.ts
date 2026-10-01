import type Anthropic from "@anthropic-ai/sdk";

import type { AgentMode, AgentToolDef } from "../types";
import { campaignPeopleTools } from "./campaignPeople";
import { campaignTools } from "./campaigns";
import { coreTools } from "./core";
import { guideTools } from "./guide";
import { listTools } from "./lists";
import { messagingTools } from "./messaging";
import { prospectTools } from "./prospects";

/** Every agent tool. Capabilities choose which ones they reveal. */
export const AGENT_TOOLS: AgentToolDef[] = [
  ...coreTools,
  ...prospectTools,
  ...listTools,
  ...campaignTools,
  ...campaignPeopleTools,
  ...messagingTools,
  ...guideTools,
];

const BY_NAME = new Map(AGENT_TOOLS.map((tool) => [tool.name, tool]));

export function getAgentTool(name: string): AgentToolDef | null {
  return BY_NAME.get(name) ?? null;
}

export function toolAllowedInMode(tool: AgentToolDef, mode: AgentMode): boolean {
  return !tool.modes || tool.modes.includes(mode);
}

/**
 * The request's tool list: identical for every request in a mode (sorted,
 * stable), so the prompt cache and thinking stay valid. Non-core tools are
 * deferred until open_capability reveals them.
 */
export function anthropicToolsForMode(mode: AgentMode): Anthropic.Messages.Tool[] {
  return AGENT_TOOLS.filter((tool) => toolAllowedInMode(tool, mode))
    .sort((a, b) => Number(Boolean(b.core)) - Number(Boolean(a.core)) || a.name.localeCompare(b.name))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
      ...(tool.core ? {} : { defer_loading: true }),
    }));
}
