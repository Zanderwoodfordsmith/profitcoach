import {
  tryInsertContactStripping,
  tryUpdateContactStripping,
} from "@/lib/contactSchemaSafeInsert";
import { splitFullName } from "@/lib/splitFullName";

export type GhlContactMatchStatus =
  | "matched"
  | "created"
  | "unmatched_contact"
  | "unmatched_coach";

export type GhlContactWebhookPayload = {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  business_name?: string | null;
  company_name?: string | null;
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
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phone: string | null;
  businessName: string | null;
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

function resolveContactFullName(input: {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
}): string {
  if (input.fullName) return input.fullName;
  const joined = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  return joined || "Unknown";
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
    firstName: asTrimmedString(body.first_name),
    lastName: asTrimmedString(body.last_name),
    fullName: asTrimmedString(body.full_name),
    phone: asTrimmedString(body.phone),
    businessName:
      asTrimmedString(body.business_name) ?? asTrimmedString(body.company_name),
  };
}

export function resolveGhlContactDisplayName(
  parsed: Pick<
    ParsedGhlContactWebhook,
    "fullName" | "firstName" | "lastName"
  >
): string {
  return resolveContactFullName(parsed);
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

export type CreateProspectFromGhlContactResult =
  | { contactId: string; created: boolean }
  | { error: string };

/**
 * Creates a new prospect when GHL originates the contact (manual add, import, etc.).
 * Requires email so the row can be deduped per coach.
 */
export async function createProspectFromGhlContact(input: {
  coachId: string;
  parsed: ParsedGhlContactWebhook;
}): Promise<CreateProspectFromGhlContactResult> {
  const { coachId, parsed } = input;

  if (!parsed.email) {
    return {
      error:
        "Email is required to create a prospect from GHL. Map contact.email in the workflow body.",
    };
  }

  const fullName = resolveContactFullName(parsed);
  let firstName = parsed.firstName;
  let lastName = parsed.lastName;
  if (fullName !== "Unknown" && !firstName && !lastName) {
    const split = splitFullName(fullName);
    firstName = split.first_name;
    lastName = split.last_name;
  }

  const insertPayload: Record<string, unknown> = {
    coach_id: coachId,
    type: "prospect",
    full_name: fullName,
    email: parsed.email,
    phone: parsed.phone,
    business_name: parsed.businessName,
    crm_contact_id: parsed.crmContactId,
  };
  if (firstName) insertPayload.first_name = firstName;
  if (lastName) insertPayload.last_name = lastName;

  const { data, error } = await tryInsertContactStripping(insertPayload);
  if (error) {
    return { error: error.message };
  }
  if (!data?.id) {
    return { error: "Failed to create prospect." };
  }

  return { contactId: data.id, created: true };
}

export async function linkProspectCrmContactId(
  contactId: string,
  crmContactId: string,
  patch?: Record<string, unknown>
): Promise<{ contactId: string; crm_contact_id: string } | { error: string }> {
  const updatePayload = {
    crm_contact_id: crmContactId,
    ...patch,
  };

  const { data, error } = await tryUpdateContactStripping(contactId, updatePayload);
  if (error) {
    if (error.code === "42703") {
      return { error: "crm_contact_id column is not migrated yet." };
    }
    return { error: error.message };
  }
  if (!data?.id) {
    return { error: "Failed to update contact." };
  }

  return { contactId: data.id, crm_contact_id: crmContactId };
}
