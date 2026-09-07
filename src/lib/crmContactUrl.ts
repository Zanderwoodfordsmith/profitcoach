/**
 * Browser-safe CRM contact URL helpers (no server-only imports).
 */

export function buildCrmContactDetailUrl(
  crmLocationId: string,
  crmContactId: string
): string {
  return `https://app.procoachplatform.com/v2/location/${encodeURIComponent(
    crmLocationId
  )}/contacts/detail/${encodeURIComponent(crmContactId)}`;
}

export function getProspectCrmContactUrl(input: {
  crm_location_id?: string | null;
  crm_contact_id?: string | null;
}): string | null {
  const crmLocationId = input.crm_location_id?.trim();
  const crmContactId = input.crm_contact_id?.trim();
  if (!crmLocationId || !crmContactId) return null;
  return buildCrmContactDetailUrl(crmLocationId, crmContactId);
}
