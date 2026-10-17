/**
 * Coach websites run as a local preview until they are released.
 * - Local (next dev): every coach, every Blueprint section, design options on, opt-ins send nothing.
 * - Production: off (404) unless COACH_SITES_LIVE=1, and then only signed-off Blueprint sections.
 */
export function coachSiteMode(): { enabled: boolean; preview: boolean } {
  const production = process.env.NODE_ENV === "production";
  return {
    enabled: !production || process.env.COACH_SITES_LIVE === "1",
    preview: !production,
  };
}
