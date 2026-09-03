/**
 * Map Unipile LinkedIn / Sales Nav search rows onto the same lead shape
 * Apify Short imports use, so Lead Finder can compare providers.
 */

import { normalizeLinkedInProfileUrl } from "@/lib/apify/linkedinProfile";
import type { SalesNavImportedLead } from "@/lib/apify/salesNavigatorTypes";
import { yearsAtCompanyBucketFromMonths } from "@/lib/salesNavigator/tenure";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function tenureMonths(tenure: unknown): number | null {
  const rec = asRecord(tenure);
  if (!rec) return null;
  const years =
    asNumber(rec.years) ??
    asNumber(rec.numYears) ??
    asNumber(rec.year) ??
    0;
  const months =
    asNumber(rec.months) ??
    asNumber(rec.numMonths) ??
    asNumber(rec.month) ??
    0;
  if (years <= 0 && months <= 0) return null;
  return years * 12 + months;
}

function formatTenurePart(months: number | null, suffix: string): string | null {
  if (months == null || months <= 0) return null;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const bits: string[] = [];
  if (years > 0) bits.push(`${years} year${years === 1 ? "" : "s"}`);
  if (rem > 0) bits.push(`${rem} month${rem === 1 ? "" : "s"}`);
  return bits.length ? `${bits.join(" ")} ${suffix}` : null;
}

function firstPosition(rec: Record<string, unknown>): Record<string, unknown> | null {
  const positions = rec.current_positions;
  if (Array.isArray(positions) && positions.length > 0) {
    return asRecord(positions[0]);
  }
  return asRecord(rec.current_position);
}

function profileUrl(rec: Record<string, unknown>): string | null {
  const direct =
    asString(rec.public_profile_url) ??
    asString(rec.profile_url) ??
    asString(rec.url) ??
    asString(rec.linkedin_url);
  if (direct) {
    return normalizeLinkedInProfileUrl(direct) ?? direct;
  }
  const slug = asString(rec.public_identifier);
  if (slug) return `https://www.linkedin.com/in/${slug}`;
  return null;
}

export function mapUnipileSearchItem(
  item: unknown
): SalesNavImportedLead | null {
  const rec = asRecord(item);
  if (!rec) return null;

  const firstName =
    asString(rec.first_name) ?? asString(rec.firstname) ?? null;
  const lastName = asString(rec.last_name) ?? asString(rec.lastname) ?? null;
  const name = asString(rec.name);
  const fullName =
    ([firstName, lastName].filter(Boolean).join(" ") || null) ?? name;

  const linkedinUrl = profileUrl(rec);
  if (!fullName && !linkedinUrl) return null;

  const position = firstPosition(rec);
  const jobTitle =
    asString(position?.role) ??
    asString(position?.title) ??
    asString(rec.title) ??
    asString(rec.headline);
  const company =
    asString(position?.company) ??
    asString(rec.company) ??
    asString(rec.current_company) ??
    asString(rec.company_name);

  const monthsAtCompany = tenureMonths(
    position?.tenure_at_company ?? rec.tenure_at_company
  );
  const monthsInRole = tenureMonths(
    position?.tenure_at_role ?? rec.tenure_at_role
  );
  const tenureLabel =
    [
      formatTenurePart(monthsInRole, "in role"),
      formatTenurePart(monthsAtCompany, "in company"),
    ]
      .filter(Boolean)
      .join(" · ") || null;

  const headline = asString(rec.headline) ?? asString(rec.summary);
  const about =
    asString(rec.about) ??
    asString(position?.description) ??
    headline;

  return {
    fullName,
    firstName:
      firstName ||
      (name ? name.split(/\s+/)[0] ?? null : null),
    lastName:
      lastName ||
      (name ? name.split(/\s+/).slice(1).join(" ") || null : null),
    jobTitle,
    company,
    linkedinUrl,
    location: asString(rec.location),
    email: asString(rec.email),
    headline,
    about,
    photoUrl:
      asString(rec.profile_picture_url) ??
      asString(rec.picture_url) ??
      asString(rec.profile_picture_url_large),
    premium: Boolean(rec.premium ?? rec.is_premium),
    tenureLabel,
    monthsAtCompany,
    monthsInRole,
    yearsAtCompanyBucket: yearsAtCompanyBucketFromMonths(monthsAtCompany),
    raw: { ...rec, _provider: "unipile" },
  };
}
