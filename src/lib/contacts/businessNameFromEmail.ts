/**
 * Guess a business name from an email domain.
 * Generic inboxes (Gmail, Hotmail, …) return null.
 * Concatenated brands get spaces at obvious word boundaries:
 * richardsengineering.com → "Richards Engineering".
 */

const FREE_LABELS = new Set([
  "gmail",
  "googlemail",
  "hotmail",
  "outlook",
  "live",
  "msn",
  "yahoo",
  "ymail",
  "rocketmail",
  "icloud",
  "me",
  "mac",
  "aol",
  "proton",
  "protonmail",
  "gmx",
  "zoho",
  "fastmail",
  "hey",
  "yandex",
  "mail",
  "inbox",
  "pm",
]);

const FREE_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "outlook.co.uk",
  "live.com",
  "live.co.uk",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "rocketmail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "gmx.com",
  "gmx.co.uk",
  "zoho.com",
  "fastmail.com",
  "hey.com",
  "yandex.com",
  "yandex.ru",
  "mail.com",
  "inbox.com",
  "btinternet.com",
  "btopenworld.com",
  "btconnect.com",
  "sky.com",
  "virginmedia.com",
  "talktalk.net",
  "blueyonder.co.uk",
  "ntlworld.com",
  "plusnet.com",
  "tiscali.co.uk",
  "privaterelay.appleid.com",
]);

const COMPOUND_SUFFIXES = [
  "co.uk",
  "org.uk",
  "me.uk",
  "ac.uk",
  "gov.uk",
  "ltd.uk",
  "plc.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "org.nz",
  "co.za",
  "com.br",
  "co.jp",
  "com.mx",
  "co.in",
  "com.sg",
];

/** Longer words first so "engineering" wins over a shorter suffix. */
const BUSINESS_WORDS = [
  "international",
  "manufacturing",
  "developments",
  "consultancy",
  "contractors",
  "bookkeeping",
  "photography",
  "recruitment",
  "investments",
  "landscaping",
  "construction",
  "engineering",
  "electrical",
  "automotive",
  "technology",
  "properties",
  "associates",
  "accountants",
  "maintenance",
  "management",
  "consulting",
  "surveyors",
  "architects",
  "mortgages",
  "bathrooms",
  "flooring",
  "logistics",
  "marketing",
  "insurance",
  "financial",
  "education",
  "furniture",
  "interiors",
  "wholesale",
  "supplies",
  "catering",
  "cleaning",
  "security",
  "training",
  "software",
  "holdings",
  "partners",
  "plumbing",
  "heating",
  "roofing",
  "builders",
  "property",
  "estates",
  "lettings",
  "rentals",
  "kitchens",
  "glazing",
  "windows",
  "fencing",
  "fitness",
  "academy",
  "coaching",
  "capital",
  "finance",
  "medical",
  "dental",
  "systems",
  "digital",
  "design",
  "studio",
  "media",
  "motors",
  "garage",
  "energy",
  "solar",
  "group",
  "homes",
  "legal",
  "health",
  "care",
  "tech",
  "foods",
].sort((a, b) => b.length - a.length);

function titleWord(word: string): string {
  if (word === "and") return "and";
  if (/^\d+$/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function brandLabel(domain: string): string | null {
  const host = domain.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  if (!host || host.includes("privaterelay") || host.endsWith(".appleid.com")) {
    return null;
  }
  if (FREE_DOMAINS.has(host)) return null;
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return null;
  const compound = COMPOUND_SUFFIXES.find(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
  const label = compound
    ? parts[parts.length - compound.split(".").length - 1]
    : parts[parts.length - 2];
  if (!label || label.length < 2 || FREE_LABELS.has(label)) return null;
  return label;
}

function segment(token: string): string[] {
  const lower = token.toLowerCase();
  if (!lower) return [];

  const andSplit = lower.match(/^([a-z0-9]{3,})and([a-z0-9]{3,})$/);
  if (andSplit) {
    return [...segment(andSplit[1]), "and", ...segment(andSplit[2])];
  }

  for (const word of BUSINESS_WORDS) {
    if (lower.length <= word.length + 2 || !lower.endsWith(word)) continue;
    const left = lower.slice(0, lower.length - word.length);
    const leftIsLetters = /[a-z]/.test(left);
    if (leftIsLetters && left.length < 3) continue;
    if (!leftIsLetters && left.length < 2) continue;
    return [...segment(left), word];
  }

  return [lower];
}

export function businessNameFromEmail(
  email: string | null | undefined
): string | null {
  const trimmed = (email ?? "").trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const label = brandLabel(trimmed.slice(at + 1));
  if (!label || !/^[a-z0-9-]+$/.test(label)) return null;

  const words = label
    .split(/[-_]+/)
    .filter(Boolean)
    .flatMap((chunk) => segment(chunk));
  if (!words.length) return null;
  const name = words.map(titleWord).join(" ").replace(/\s+/g, " ").trim();
  return name || null;
}
