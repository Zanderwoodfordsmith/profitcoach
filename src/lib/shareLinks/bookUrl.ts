/** Public booking path for a coach calendar. */
export function coachBookPath(coachSlug: string, calendarSlug: string): string {
  const slug = coachSlug.trim();
  const cal = calendarSlug.trim();
  if (!slug || !cal) return "";
  if (slug === "zander" && cal === "discovery") return "/zander";
  return `/book/${encodeURIComponent(slug)}/${encodeURIComponent(cal)}`;
}
