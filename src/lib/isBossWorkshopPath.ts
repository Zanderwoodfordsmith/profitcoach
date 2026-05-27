/** BOSS Pro hub — coach and admin reuse the same page module. */
export function isBossWorkshopPath(pathname: string | null): boolean {
  return pathname === "/coach/boss-pro" || pathname === "/admin/boss-pro";
}
