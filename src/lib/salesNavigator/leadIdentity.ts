import { createHash } from "crypto";

/** Normalize a public LinkedIn /in/ URL for matching. */
export function normalizePublicLinkedInUrl(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const inIdx = parts.findIndex((p) => p.toLowerCase() === "in");
  if (inIdx < 0 || !parts[inIdx + 1]) return null;

  let slug = parts[inIdx + 1].replace(/\/+$/, "");
  try {
    slug = decodeURIComponent(slug);
  } catch {
    // keep raw slug
  }
  if (!slug || !/^[a-zA-Z0-9\-_%]+$/.test(slug)) return null;

  return `https://www.linkedin.com/in/${slug.toLowerCase()}`;
}

function normPersonPart(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Fallback identity when LinkedIn URL is missing or changed. */
export function nameCompanyIdentityKey(input: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  company?: string | null;
}): string | null {
  const company = normPersonPart(input.company);
  if (!company) return null;

  const first = normPersonPart(input.firstName);
  const last = normPersonPart(input.lastName);
  if (first && last) {
    const hash = createHash("sha256")
      .update(`${first}|${last}|${company}`)
      .digest("hex")
      .slice(0, 24);
    return `nameflco:${hash}`;
  }

  const full = normPersonPart(input.fullName);
  if (!full) return null;
  const hash = createHash("sha256")
    .update(`${full}|${company}`)
    .digest("hex")
    .slice(0, 24);
  return `nameco:${hash}`;
}

export function salesNavDedupeKey(input: {
  linkedinUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  company?: string | null;
  email?: string | null;
}): string | null {
  const li = normalizePublicLinkedInUrl(input.linkedinUrl);
  if (li) return `linkedin:${li}`;

  const email = input.email?.trim().toLowerCase();
  if (email) return `email:${email}`;

  return nameCompanyIdentityKey(input);
}

export function samePersonNameCompany(
  a: {
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    company?: string | null;
  },
  b: {
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    company?: string | null;
  }
): boolean {
  const companyA = normPersonPart(a.company);
  const companyB = normPersonPart(b.company);
  if (!companyA || !companyB || companyA !== companyB) return false;

  const firstA = normPersonPart(a.firstName);
  const lastA = normPersonPart(a.lastName);
  const firstB = normPersonPart(b.first_name);
  const lastB = normPersonPart(b.last_name);
  if (firstA && lastA && firstB && lastB) {
    return firstA === firstB && lastA === lastB;
  }

  const fullA = normPersonPart(a.fullName);
  const fullB = normPersonPart(b.full_name);
  return Boolean(fullA && fullB && fullA === fullB);
}
