/** BOSS Pro hub — coach and admin reuse the same page module. */
export function isBossWorkshopPath(pathname: string | null): boolean {
  return pathname === "/coach/boss-pro" || pathname === "/admin/boss-pro";
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
