import { normalizeLinkedInProfileUrl } from "@/lib/linkedin/normalizeProfileUrl";
import { splitFullName } from "@/lib/splitFullName";

export type ClientRosterPatch = {
  fullName?: string;
  businessName?: string | null;
  joinedOn?: string | null;
  feeAmount?: number | null;
  problemNotes?: string | null;
  linkedinUrl?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cleanOptionalText(
  value: unknown,
  max: number,
  tooLong: string
): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("Invalid text.");
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) throw new Error(tooLong);
  return trimmed;
}

export function parseJoinedOn(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("Join date must be a real date.");
  const trimmed = value.trim();
  if (!trimmed) return null;
  const day = trimmed.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new Error("Join date must be a real date.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, date));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== date
  ) {
    throw new Error("Join date must be a real date.");
  }
  return day;
}

function roundFee(amount: number): number {
  if (amount < 0 || amount > 1_000_000) {
    throw new Error("Price must be between 0 and 1,000,000.");
  }
  return Math.round(amount * 100) / 100;
}

export function parseFeeAmount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Price must be a number.");
    return roundFee(value);
  }
  if (typeof value !== "string") throw new Error("Price must be a number.");
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalised = trimmed.replace(/£/g, "").replace(/,/g, "").replace(/\s/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(normalised)) {
    throw new Error("Price must be a number, like 2000.");
  }
  return roundFee(Number(normalised));
}

export function parseOptionalLinkedIn(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error("Paste a LinkedIn profile URL.");
  }
  if (!value.trim()) return null;
  const url = normalizeLinkedInProfileUrl(value);
  if (!url) {
    throw new Error("Enter a valid LinkedIn profile URL (linkedin.com/in/…).");
  }
  return url;
}

export function parseClientRosterPatch(body: unknown): ClientRosterPatch {
  if (!isRecord(body)) throw new Error("Invalid request.");
  const patch: ClientRosterPatch = {};

  if ("fullName" in body) {
    if (typeof body.fullName !== "string" || !body.fullName.trim()) {
      throw new Error("Add the person's name.");
    }
    const name = body.fullName.trim();
    if (name.length > 200) throw new Error("Name is too long.");
    patch.fullName = name;
  }
  if ("businessName" in body) {
    patch.businessName = cleanOptionalText(
      body.businessName,
      200,
      "Business name is too long."
    );
  }
  if ("problemNotes" in body) {
    patch.problemNotes = cleanOptionalText(
      body.problemNotes,
      4000,
      "Notes are too long."
    );
  }
  if ("joinedOn" in body) patch.joinedOn = parseJoinedOn(body.joinedOn);
  if ("feeAmount" in body) patch.feeAmount = parseFeeAmount(body.feeAmount);
  if ("linkedinUrl" in body) patch.linkedinUrl = parseOptionalLinkedIn(body.linkedinUrl);

  if (Object.keys(patch).length === 0) throw new Error("Nothing to save.");
  return patch;
}

export function parseClientRosterCreate(
  body: unknown
): ClientRosterPatch & { fullName: string } {
  if (!isRecord(body) || !("fullName" in body)) {
    throw new Error("Add the person's name.");
  }
  const patch = parseClientRosterPatch(body);
  if (!patch.fullName) throw new Error("Add the person's name.");
  return patch as ClientRosterPatch & { fullName: string };
}

export function clientRosterToContactPatch(
  patch: ClientRosterPatch
): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (patch.fullName !== undefined) {
    const { first_name, last_name } = splitFullName(patch.fullName);
    db.full_name = patch.fullName;
    db.first_name = first_name;
    db.last_name = last_name;
  }
  if (patch.businessName !== undefined) db.business_name = patch.businessName;
  if (patch.joinedOn !== undefined) db.client_joined_on = patch.joinedOn;
  if (patch.feeAmount !== undefined) db.client_fee_amount = patch.feeAmount;
  if (patch.problemNotes !== undefined) {
    db.client_problem_notes = patch.problemNotes;
  }
  if (patch.linkedinUrl !== undefined) db.linkedin_url = patch.linkedinUrl;
  return db;
}
