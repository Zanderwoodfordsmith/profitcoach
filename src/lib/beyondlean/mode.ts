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

/**
 * Search engines stay out until the site is on Paul's own domain (NEXT_PUBLIC_BEYONDLEAN_DOMAIN set in production).
 * Until then every page is noindex, so the theprofitcoach.com/beyondlean preview never competes with it.
 */
export const beyondleanRobots =
  process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_BEYONDLEAN_DOMAIN
    ? { index: true, follow: true }
    : { index: false, follow: false };
