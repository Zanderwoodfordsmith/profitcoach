/**
 * Model settings for the agent. AGENT_ANTHROPIC_MODEL overrides the default.
 * Features are only sent to models that accept them.
 */

export const AGENT_DEFAULT_MODEL = "claude-opus-5-5";

export function agentModel(): string {
  return process.env.AGENT_ANTHROPIC_MODEL?.trim() || AGENT_DEFAULT_MODEL;
}

/** Models that accept tool_addition system messages (beta mid-conversation-tool-changes-2026-07-01). */
const TOOL_CHANGE_MODELS = new Set([
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-opus-4-8",
  "claude-fable-5",
  "claude-fable-5-1",
  "claude-sonnet-5-5",
]);

/** Models that accept the server-side refusal fallback in its "default" form. */
const DEFAULT_FALLBACK_MODELS = new Set([
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-fable-5-1",
  "claude-sonnet-5-5",
]);

/** Models that take output_config.effort. */
const EFFORT_MODELS = new Set([
  ...TOOL_CHANGE_MODELS,
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-sonnet-5",
  "claude-sonnet-4-6",
]);

export function modelSupportsToolChanges(model: string): boolean {
  return TOOL_CHANGE_MODELS.has(model);
}

export function modelSupportsDefaultFallback(model: string): boolean {
  return DEFAULT_FALLBACK_MODELS.has(model);
}

export function modelSupportsEffort(model: string): boolean {
  return EFFORT_MODELS.has(model);
}

export const TOOL_CHANGES_BETA = "mid-conversation-tool-changes-2026-07-01";
export const DEFAULT_FALLBACK_BETA = "server-side-fallback-2026-07-01";
