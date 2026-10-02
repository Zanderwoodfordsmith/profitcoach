const LEAD_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function prospectDetailHref(
  contactId: string | null | undefined,
  isAdmin: boolean
): string | null {
  if (!contactId) return null;
  const base = isAdmin ? "/admin/prospects" : "/coach/prospects";
  return `${base}/${encodeURIComponent(contactId)}`;
}

/** Contact page for someone in a campaign, with their next message queued to load. */
export function campaignContactHref(
  contactId: string | null | undefined,
  isAdmin: boolean,
  leadId?: string | null
): string | null {
  const base = prospectDetailHref(contactId, isAdmin);
  if (!base) return null;
  const params = new URLSearchParams({ from: "campaigns" });
  const lead = leadId?.trim() || "";
  if (LEAD_ID_RE.test(lead)) params.set("composeLead", lead);
  return `${base}?${params.toString()}`;
}
