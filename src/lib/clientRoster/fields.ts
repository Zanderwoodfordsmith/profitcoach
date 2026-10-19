import { normalizeLinkedInProfileUrl } from "@/lib/linkedin/normalizeProfileUrl";
import { splitFullName } from "@/lib/splitFullName";

export type ClientRosterPatch = {
  fullName?: string;
  businessName?: string | null;
  joinedOn?: string | null;
  feeAmount?: number | null;
  problemNotes?: string | null;
  linkedinUrl?: string | null;
  sector?: string | null;
  revenueBand?: RevenueBand | null;
  teamSize?: TeamSize | null;
  source?: ClientSource | null;
  result?: string | null;
  fit?: number | null;
};

export const REVENUE_BANDS = ["under_500k", "500k_1m", "1m_2m", "2m_5m", "5m_10m", "10m_plus"] as const;
export type RevenueBand = (typeof REVENUE_BANDS)[number];
export const REVENUE_BAND_LABELS: Record<RevenueBand, string> = {
  under_500k: "Under £500k",
  "500k_1m": "£500k to £1m",
  "1m_2m": "£1m to £2m",
  "2m_5m": "£2m to £5m",
  "5m_10m": "£5m to £10m",
  "10m_plus": "£10m+",
};
export const TEAM_SIZES = ["1_5", "6_15", "16_50", "51_200", "200_plus"] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];
export const TEAM_SIZE_LABELS: Record<TeamSize, string> = {
  "1_5": "1 to 5",
  "6_15": "6 to 15",
  "16_50": "16 to 50",
  "51_200": "51 to 200",
  "200_plus": "200+",
};
export const CLIENT_SOURCES = ["linkedin_outreach", "linkedin_content", "referral", "network", "event", "scorecard", "ads", "email", "other"] as const;
export type ClientSource = (typeof CLIENT_SOURCES)[number];
export const CLIENT_SOURCE_LABELS: Record<ClientSource, string> = {
  linkedin_outreach: "LinkedIn outreach",
  linkedin_content: "LinkedIn posts",
  referral: "Referral",
  network: "Someone I knew",
  event: "Event or talk",
  scorecard: "BOSS Score",
  ads: "Ads",
  email: "Email",
  other: "Other",
};

/** Accepts the stored key, the label, or common spreadsheet wording. */
export function parseChoice<T extends string>(value: unknown, keys: readonly T[], labels: Record<T, string>, what: string): T | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error(`Pick a ${what}.`);
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  const norm = (x: string) => x.toLowerCase().replace(/[£,+\s]|to|-/g, "");
  for (const k of keys) {
    if (raw === k || norm(raw) === norm(k) || norm(raw) === norm(labels[k])) return k;
  }
  throw new Error(`"${value.trim()}" isn't a ${what} we know. Use one of: ${keys.map((k) => labels[k]).join(", ")}.`);
}

/** Pounds from "£750k", "1.2m", "1,200,000" or "2 million"; null if there is no number. */
function money(text: string): number | null {
  const m = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k|m|mn|million|thousand)?/i);
  if (!m) return null;
  const unit = (m[2] ?? "").toLowerCase();
  const n = Number(m[1]);
  return unit === "k" || unit === "thousand" ? n * 1e3 : unit.startsWith("m") ? n * 1e6 : n;
}

function midpoint(text: string, read: (part: string) => number | null): number | null {
  const parts = text.split(/\s*(?:-|–|to)\s*/i).map(read).filter((n): n is number => n != null);
  if (!parts.length) return null;
  return parts.length === 1 ? parts[0]! : (parts[0]! + parts[parts.length - 1]!) / 2;
}

/** Turnover as people type it ("£1m-£3m", "750k", "Under £500k") mapped to a band. */
export function parseRevenueBand(value: unknown): RevenueBand | null {
  try {
    return parseChoice(value, REVENUE_BANDS, REVENUE_BAND_LABELS, "turnover");
  } catch (err) {
    const text = String(value).toLowerCase();
    // "1-3m": the unit on the last number applies to the first too.
    const unit = text.match(/(k|m|mn|million)\b/)?.[1] ?? "";
    let amount = midpoint(text, (part) => money(/[a-z]/.test(part) || !unit ? part : `${part}${unit}`));
    if (amount == null) throw err;
    if (amount < 1000) amount *= 1e6; // "2.5" in a turnover column means £2.5m
    if (amount < 5e5) return "under_500k";
    if (amount < 1e6) return "500k_1m";
    if (amount < 2e6) return "1m_2m";
    if (amount < 5e6) return "2m_5m";
    if (amount < 1e7) return "5m_10m";
    return "10m_plus";
  }
}

/** Team size as a number or range ("12", "10-24", "about 30") mapped to a band. */
export function parseTeamSize(value: unknown): TeamSize | null {
  try {
    return parseChoice(value, TEAM_SIZES, TEAM_SIZE_LABELS, "team size");
  } catch (err) {
    const people = midpoint(String(value), (part) => {
      const m = part.replace(/,/g, "").match(/\d+/);
      return m ? Number(m[0]) : null;
    });
    if (people == null) throw err;
    if (people <= 5) return "1_5";
    if (people <= 15) return "6_15";
    if (people <= 50) return "16_50";
    if (people <= 200) return "51_200";
    return "200_plus";
  }
}

const SOURCE_WORDS: [RegExp, ClientSource][] = [
  [/boss|score/i, "scorecard"],
  [/linked\s*in.*(post|content)|(post|content).*linked\s*in/i, "linkedin_content"],
  [/linked\s*in/i, "linkedin_outreach"],
  [/referr|recommend|intro/i, "referral"],
  [/event|talk|seminar|webinar|speak|workshop|conference/i, "event"],
  [/\bads?\b|advert|facebook|meta|google/i, "ads"],
  [/e-?mail|newsletter/i, "email"],
  [/friend|knew|network|existing|old client|contact/i, "network"],
];

/** How the client found the coach, from the label or everyday wording ("referred by Sam"). */
export function parseClientSource(value: unknown): ClientSource | null {
  try {
    return parseChoice(value, CLIENT_SOURCES, CLIENT_SOURCE_LABELS, "source");
  } catch {
    const text = String(value);
    return SOURCE_WORDS.find(([re]) => re.test(text))?.[1] ?? "other";
  }
}

export function parseFit(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error("Fit is a score from 1 to 5.");
  return n;
}

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
  if ("sector" in body) patch.sector = cleanOptionalText(body.sector, 120, "Sector is too long.");
  if ("revenueBand" in body) patch.revenueBand = parseRevenueBand(body.revenueBand);
  if ("teamSize" in body) patch.teamSize = parseTeamSize(body.teamSize);
  if ("source" in body) patch.source = parseClientSource(body.source);
  if ("result" in body) patch.result = cleanOptionalText(body.result, 1000, "Result is too long.");
  if ("fit" in body) patch.fit = parseFit(body.fit);

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
  if (patch.sector !== undefined) db.client_sector = patch.sector;
  if (patch.revenueBand !== undefined) db.client_revenue_band = patch.revenueBand;
  if (patch.teamSize !== undefined) db.client_team_size = patch.teamSize;
  if (patch.source !== undefined) db.client_source = patch.source;
  if (patch.result !== undefined) db.client_result = patch.result;
  if (patch.fit !== undefined) db.client_fit = patch.fit;
  return db;
}
