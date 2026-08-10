/**
 * Coach-facing routes that exist but are not released yet.
 * Admins may use them (tabs show subtle/locked). Coaches are redirected.
 */

const CLIENT_WORKSPACE_PATH =
  /^\/coach\/clients\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|\?|$)/i;

export type AdminPreviewCoachRoute = {
  /** Exact prefix match via startsWith, unless `match` is set. */
  prefix?: string;
  match?: (pathname: string) => boolean;
  fallback: string;
};

export const ADMIN_PREVIEW_COACH_ROUTES: AdminPreviewCoachRoute[] = [
  { prefix: "/coach/first-campaign", fallback: "/coach/prospects" },
  { prefix: "/coach/pipeline", fallback: "/coach/prospects" },
  { prefix: "/coach/funnel-analyzer", fallback: "/coach/prospects" },
  { prefix: "/coach/message-generator", fallback: "/coach/prospects" },
  { prefix: "/coach/clients/coaching", fallback: "/coach/clients" },
  {
    match: (pathname) => CLIENT_WORKSPACE_PATH.test(pathname),
    fallback: "/coach/clients",
  },
];

export function adminPreviewCoachRouteForPath(
  pathname: string | null
): AdminPreviewCoachRoute | null {
  if (!pathname || !pathname.startsWith("/coach/")) return null;
  return (
    ADMIN_PREVIEW_COACH_ROUTES.find((route) => {
      if (route.match) return route.match(pathname);
      if (route.prefix) {
        return (
          pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)
        );
      }
      return false;
    }) ?? null
  );
}
