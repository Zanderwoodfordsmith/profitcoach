/** BOSS matrix workshop hub — coach and admin reuse the same page module. */
export function isBossWorkshopPath(pathname: string | null): boolean {
  return pathname === "/coach/workshop" || pathname === "/admin/workshop";
}
