/** BOSS Pro hub — coach and admin reuse the same page module. */
export function isBossWorkshopPath(pathname: string | null): boolean {
  return pathname === "/coach/boss-pro" || pathname === "/admin/boss-pro";
}

export function isAdminBossProPath(pathname: string | null): boolean {
  return pathname === "/admin/boss-pro";
}

/** Admin org-wide picker — always on /admin/boss-pro; elsewhere only when not impersonating. */
export function isAdminUnscopedBossProView(
  role: string | undefined | null,
  pathname: string | null,
  impersonatingCoachId: string | null
): boolean {
  if (role !== "admin") return false;
  if (isAdminBossProPath(pathname)) return true;
  return !impersonatingCoachId;
}

/** Canonical Boss Pro workshop URL for a contact (or hub with no selection). */
export function bossProHubPath(
  contactId?: string | null,
  options?: { admin?: boolean }
): string {
  const base = options?.admin ? "/admin/boss-pro" : "/coach/boss-pro";
  if (!contactId) return base;
  return `${base}?contact=${encodeURIComponent(contactId)}`;
}
