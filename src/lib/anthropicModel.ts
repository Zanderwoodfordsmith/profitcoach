/** Default when ANTHROPIC_MODEL is unset. API id uses dashes: claude-sonnet-4-6 */
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

export function resolveAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
}

/**
 * The best model, for writing that reaches owners: Blueprint sections, the
 * LinkedIn profile, campaigns and launch drafts. Short helper calls keep the
 * model above.
 */
export const WRITING_MODEL = "claude-opus-5-5";
