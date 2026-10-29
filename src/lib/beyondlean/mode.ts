/**
 * Paul Swift's site (Beyondlean, roadmap job 116) is a local preview until it's released:
 * production 404s unless BEYONDLEAN_SITE_LIVE=1.
 */
export function beyondleanMode() {
  const production = process.env.NODE_ENV === "production";
  return {
    enabled: !production || process.env.BEYONDLEAN_SITE_LIVE === "1",
    preview: !production,
  };
}
