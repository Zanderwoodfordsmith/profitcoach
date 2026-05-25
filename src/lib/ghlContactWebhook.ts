export type GhlContactMatchStatus =
  | "matched"
  | "unmatched_contact"
  | "unmatched_coach";

export type GhlContactWebhookPayload = {
  email?: string | null;
  location?: { id?: string | null; name?: string | null } | null;
  location_id?: string | null;
  /** Profit Coach contacts.id when sent as UUID; otherwise treated as CRM id. */
  contact_id?: string | null;
  profit_coach_contact_id?: string | null;
  pc_contact_id?: string | null;
  /** Preferred keys for the CRM / GHL contact id. */
  crm_contact_id?: string | null;
  ghl_contact_id?: string | null;
  id?: string | null;
  [key: string]: unknown;
};

export type ParsedGhlContactWebhook = {
  crmContactId: string;
  profitCoachContactId: string | null;
  ghlLocationId: string | null;
  email: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeEmail(value: unknown): string | null {
  const trimmed = asTrimmedString(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function readCrmContactId(body: GhlContactWebhookPayload): string | null {
  const explicit =
    asTrimmedString(body.crm_contact_id) ?? asTrimmedString(body.ghl_contact_id);
  if (explicit) return explicit;

  const contactId = asTrimmedString(body.contact_id);
  if (contactId && !isUuid(contactId)) return contactId;

  const id = asTrimmedString(body.id);
  if (id && !isUuid(id)) return id;

  return null;
}

function readProfitCoachContactId(
  body: GhlContactWebhookPayload
): string | null {
  const explicit =
    asTrimmedString(body.profit_coach_contact_id) ??
    asTrimmedString(body.pc_contact_id);
  if (explicit && isUuid(explicit)) return explicit;

  const contactId = asTrimmedString(body.contact_id);
  if (contactId && isUuid(contactId)) return contactId;

  return null;
}

export function parseGhlContactWebhookPayload(
  body: GhlContactWebhookPayload
): ParsedGhlContactWebhook | { error: string } {
  const crmContactId = readCrmContactId(body);
  if (!crmContactId) {
    return {
      error:
        "Missing CRM contact id (crm_contact_id, ghl_contact_id, or non-UUID contact_id).",
    };
  }

  const location =
    body.location && typeof body.location === "object" ? body.location : null;

  return {
    crmContactId,
    profitCoachContactId: readProfitCoachContactId(body),
    ghlLocationId:
      asTrimmedString(body.location_id) ?? asTrimmedString(location?.id),
    email: normalizeEmail(body.email),
  };
}

export function getGhlContactWebhookSecret(): string {
  return (
    process.env.GHL_CONTACT_WEBHOOK_SECRET?.trim() ||
    process.env.GHL_APPOINTMENT_WEBHOOK_SECRET?.trim() ||
    ""
  );
}

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
