/**
 * Extracts the GHL booking widget id from calendar embed HTML.
 * Example: .../widget/booking/YBxvoiQH6HcHjHYrOWkU
 */
export function extractGhlCalendarIdFromEmbed(
  embedCode: string | null | undefined
): string | null {
  if (typeof embedCode !== "string") return null;
  const trimmed = embedCode.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/\/widget\/booking\/([A-Za-z0-9_-]+)/i);
  return match?.[1]?.trim() || null;
}
