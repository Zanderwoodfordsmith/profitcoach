import { businessNameFromEmail } from "@/lib/contacts/businessNameFromEmail";

/** Strip emoji and other decorative symbols from contact display text. */
function stripDecorativeChars(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\uFE0E\uFE0F\u200D\u20E3]/g, "")
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "") // skin tone modifiers
    .replace(/\s+/g, " ")
    .trim();
}

/** Capitalize the first letter of each word; lowercase the rest. */
function capitalizeWord(word: string): string {
  for (let i = 0; i < word.length; ) {
    const codePoint = word.codePointAt(i)!;
    const ch = String.fromCodePoint(codePoint);
    const charLen = ch.length;
    if (/^\p{L}$/u.test(ch)) {
      return (
        word.slice(0, i) +
        ch.toLocaleUpperCase() +
        word.slice(i + charLen).toLocaleLowerCase()
      );
    }
    i += charLen;
  }
  return word;
}

function formatWords(text: string): string {
  return stripDecorativeChars(text)
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalizeWord)
    .join(" ");
}

/**
 * Drop a trailing note such as "Zahid (fixing meeting…)".
 * Notes belong on the activity, not on the person's name.
 */
export function personNameWithoutNote(
  text: string | null | undefined
): string {
  return (text ?? "").replace(/\s*\(.*$/, "").replace(/\s+/g, " ").trim();
}

/** Lowercase name particles kept as typed after the first word (Bas van Dijk). */
const NAME_PARTICLES = new Set([
  "van", "von", "de", "der", "den", "du", "da", "di", "le", "la", "del", "della", "bin", "al",
]);

/** Common letters after a name, kept in capitals. Mixed case (CEng, MIMechE) is kept anyway. */
const POST_NOMINALS = new Set([
  "OBE", "MBE", "CBE", "KBE", "DBE", "KC", "QC", "DL", "JP", "MP",
  "MBA", "BA", "MA", "BSC", "MSC", "PHD", "LLB", "LLM", "BENG", "MENG",
  "FCA", "ACA", "ACCA", "FCCA", "CIMA", "ACMA", "FCMA", "CTA", "ATT", "MAAT", "FMAAT", "AAT",
  "TEP", "CFP", "DIPPFS", "CII",
  "MIET", "FIET", "MICE", "FICE", "MCIOB", "FCIOB", "ICIOB", "MRICS", "FRICS",
  "MCIPS", "FCIPS", "MCMI", "FCMI", "MIOD", "FIOD", "CMGR", "MCIPD", "FCIPD", "CIPD",
  "MCIM", "FCIM", "MCIBSE", "FCIBSE", "FIMECHE", "MIMECHE", "FRENG", "FRSA", "RIBA",
  "MSOE", "MIIRSM", "CMIOSH", "IOSH", "NEBOSH", "PMP", "PGCE", "QTS",
]);

/** "o'brien" → "O'Brien", "bradley-smith" → "Bradley-Smith". */
function capitalizeNameParts(word: string): string {
  return word
    .toLocaleLowerCase()
    .replace(/(^|[-'’])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase());
}

/**
 * Fix only names typed all lower or ALL CAPS. Mixed case is kept as typed,
 * so McGill, MacDonald, AdeNiran and letters like CEng stay right.
 */
function formatPersonWord(word: string, index: number, wholeNameShouting: boolean): string {
  const lower = word.toLocaleLowerCase();
  const upper = word.toLocaleUpperCase();
  if (lower === upper) return word; // no letters
  if (index > 0 && NAME_PARTICLES.has(lower) && word === lower) return word;
  if (word === lower) return capitalizeNameParts(word);
  if (word !== upper) return word;
  // ALL CAPS: a shouted name (SHAH → Shah), unless it's letters after the name
  // (MIET, MBA, OBE), an initial (J) or has dots (LL.B).
  if (!wholeNameShouting && index > 0) {
    const letters = word.replace(/[^\p{L}]/gu, "");
    if (letters.length <= 1 || word.includes(".") || POST_NOMINALS.has(letters)) {
      return word;
    }
  }
  return capitalizeNameParts(word);
}

/** Display / save format for person names (first, last, full). */
export function formatProspectPersonName(
  text: string | null | undefined
): string {
  const withoutNote = stripDecorativeChars(personNameWithoutNote(text));
  if (!withoutNote) return "";
  const wholeNameShouting = withoutNote === withoutNote.toLocaleUpperCase();
  return withoutNote
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => formatPersonWord(word, i, wholeNameShouting))
    .join(" ");
}

/** Display / save format for title, business, and similar labels. */
export function formatProspectLabel(
  text: string | null | undefined
): string | null {
  if (!text?.trim()) return null;
  return formatWords(text);
}

const BUSINESS_LEGAL_SUFFIX =
  /(?:\s+|,)+\b(?:limited|ltd|llp|llc|plc|inc|incorporated|corporation|corp)\.?$/i;

function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
  const right = (b ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
  return Boolean(left && right && left === right);
}

/** Drop a trailing Ltd / Limited / PLC / LLP / Inc; keeps the casing as typed. */
export function stripBusinessLegalSuffix(text: string): string {
  const trimmed = text.trim();
  return trimmed.replace(BUSINESS_LEGAL_SUFFIX, "").trim() || trimmed;
}

/** Title-case a company name and drop trailing Ltd / Limited / LLC / Inc. */
export function formatBusinessLabel(
  text: string | null | undefined
): string | null {
  const formatted = formatProspectLabel(text);
  if (!formatted) return null;
  return stripBusinessLegalSuffix(formatted);
}

export function businessNamesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return namesMatch(formatBusinessLabel(a), formatBusinessLabel(b));
}

const JOB_TITLE_SHORTENINGS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bManaging Director\b/gi, replacement: "MD" },
  { pattern: /\bBusiness Owner\b/gi, replacement: "Owner" },
  { pattern: /\bCompany Owner\b/gi, replacement: "Owner" },
];

/** Display format for job titles — same casing as labels, plus compact shortenings. */
export function formatProspectJobTitle(
  text: string | null | undefined
): string | null {
  const formatted = formatProspectLabel(text);
  if (!formatted) return null;
  let out = formatted;
  for (const { pattern, replacement } of JOB_TITLE_SHORTENINGS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

const PLACEHOLDER_PERSON_NAME =
  /^(unknown|n\/a|na|none|null|test|tbc|tba|-+|\.+)$/i;

const EMAIL_ROLE_LOCAL = new Set([
  "info",
  "hello",
  "hi",
  "admin",
  "administrator",
  "sales",
  "enquiries",
  "enquiry",
  "inquiries",
  "inquiry",
  "contact",
  "office",
  "support",
  "accounts",
  "account",
  "team",
  "mail",
  "email",
  "noreply",
  "no-reply",
  "newsletter",
  "billing",
  "hr",
  "jobs",
  "careers",
  "reception",
  "webmaster",
]);

function usablePersonName(text: string | null | undefined): string {
  const raw = (text ?? "").trim();
  if (!raw || raw.includes("@")) return "";
  const formatted = formatProspectPersonName(raw);
  if (!formatted || PLACEHOLDER_PERSON_NAME.test(formatted)) return "";
  return formatted;
}

function usableBusinessName(text: string | null | undefined): string | null {
  const formatted = formatBusinessLabel(text);
  if (!formatted || PLACEHOLDER_PERSON_NAME.test(formatted)) return null;
  return formatted;
}

/** jane.smith or jane_smith → Jane Smith. Role inboxes stay unnamed. */
export function personNameFromEmail(email: string | null | undefined): string | null {
  const local = (email ?? "").trim().split("@")[0]?.split("+")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length < 1 || parts.length > 3) return null;
  if (
    parts.some(
      (part) =>
        EMAIL_ROLE_LOCAL.has(part.toLowerCase()) || !/^[a-z]{2,}$/i.test(part)
    )
  ) {
    return null;
  }
  if (parts.length === 1 && parts[0].length < 3) return null;
  return formatProspectPersonName(parts.join(" ")) || null;
}

/**
 * Pipeline card title when the contact was saved as Unknown.
 * A real name wins. Otherwise a name read from the email, then the email itself.
 */
export function pipelineCardIdentity(input: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  business_name?: string | null;
}): { title: string; detail: string | null } {
  const stored =
    usablePersonName(input.full_name) ||
    usablePersonName(
      [input.first_name, input.last_name].filter(Boolean).join(" ")
    );
  if (stored) return { title: stored, detail: null };

  const email = input.email?.trim() || "";
  const fromEmail = personNameFromEmail(email);
  if (fromEmail) return { title: fromEmail, detail: null };

  const business =
    usableBusinessName(input.business_name) || businessNameFromEmail(email);
  if (email) return { title: email, detail: business };
  return { title: "Unknown", detail: business };
}

export function normalizeProspectPersonName(
  text: string | null | undefined
): string | null {
  const formatted = formatProspectPersonName(text);
  return formatted || null;
}

export function normalizeProspectLabel(
  text: string | null | undefined
): string | null {
  return formatProspectLabel(text);
}
