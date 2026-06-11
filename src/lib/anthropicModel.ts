/** Default when ANTHROPIC_MODEL is unset. API id uses dashes: claude-opus-4-8 */
export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-8";

export function resolveAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
}
