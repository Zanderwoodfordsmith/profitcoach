export function prospectDetailHref(
  contactId: string | null | undefined,
  isAdmin: boolean
): string | null {
  if (!contactId) return null;
  const base = isAdmin ? "/admin/prospects" : "/coach/prospects";
  return `${base}/${encodeURIComponent(contactId)}`;
}
