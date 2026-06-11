/** Default when ANTHROPIC_MODEL is unset. API id uses dashes: claude-sonnet-4-6 */
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

export function resolveAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
}
