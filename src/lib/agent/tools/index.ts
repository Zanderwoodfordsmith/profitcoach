import type Anthropic from "@anthropic-ai/sdk";

import { capabilitiesForActor } from "../context";
import type { AgentMode, AgentToolDef } from "../types";
import { blueprintTools } from "./blueprint";
import { blueprintAvaTools } from "./blueprintAva";
import { campaignPeopleTools } from "./campaignPeople";
import { campaignTools } from "./campaigns";
import { constraintTools } from "./constraint";
import { coreTools } from "./core";
import { escalateTools } from "./escalate";
import { guideTools } from "./guide";
import { listTools } from "./lists";
import { messagingTools } from "./messaging";
import { onboardingTools } from "./onboarding";
import { prospectTools } from "./prospects";

/** Every agent tool. Capabilities choose which ones they reveal. */
export const AGENT_TOOLS: AgentToolDef[] = [
  ...coreTools,
  ...prospectTools,
  ...listTools,
  ...campaignTools,
  ...campaignPeopleTools,
  ...messagingTools,
  ...constraintTools,
  ...blueprintTools,
  ...blueprintAvaTools,
  ...onboardingTools,
  ...escalateTools,
  ...guideTools,
];

const BY_NAME = new Map(AGENT_TOOLS.map((tool) => [tool.name, tool]));

export function getAgentTool(name: string): AgentToolDef | null {
  return BY_NAME.get(name) ?? null;
}

export function toolAllowedInMode(tool: AgentToolDef, mode: AgentMode): boolean {
  return !tool.modes || tool.modes.includes(mode);
}

/** A limited coach may use core tools and the tools of the capabilities they can open. */
export function toolAllowedForActor(tool: AgentToolDef, mode: AgentMode, limited: boolean): boolean {
  if (!toolAllowedInMode(tool, mode)) return false;
  if (!limited || tool.core) return true;
  return capabilitiesForActor(mode, true).some((cap) => cap.tools.includes(tool.name));
}

/**
 * The request's tool list: identical for every request in a mode (sorted,
 * stable), so the prompt cache and thinking stay valid. Non-core tools are
 * deferred until open_capability reveals them.
 */
export function anthropicToolsForMode(mode: AgentMode, limited = false): Anthropic.Messages.Tool[] {
  return AGENT_TOOLS.filter((tool) => toolAllowedForActor(tool, mode, limited))
    .sort((a, b) => Number(Boolean(b.core)) - Number(Boolean(a.core)) || a.name.localeCompare(b.name))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
      ...(tool.core ? {} : { defer_loading: true }),
    }));
}
