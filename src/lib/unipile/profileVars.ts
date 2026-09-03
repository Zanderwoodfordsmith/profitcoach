/**
 * LinkedIn outreach merge fields — keep worker + templates in sync.
 */

export type OutreachLeadFields = {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  title?: string | null;
  city?: string | null;
  location?: string | null;
};

export const OUTREACH_TEMPLATE_VARIABLES = [
  "first_name",
  "last_name",
  "full_name",
  "company",
  "title",
  "headline",
  "job_title",
  "city",
  "location",
  "assessment_url",
  "scorecard_url",
  "coach_name",
  "review_name",
] as const;

function pickString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

/** Map a Unipile user profile payload into lead merge fields. */
export function extractUnipileProfileFields(
  data: Record<string, unknown> | null | undefined
): OutreachLeadFields {
  if (!data) return {};

  const work = data.work_experience as
    | Array<{ company?: string; position?: string }>
    | undefined;
  const currentWork =
    work?.find((w) => (w as { current?: boolean }).current) || work?.[0];

  const first_name = pickString(
    data.first_name,
    data.firstName,
    typeof data.name === "string" ? data.name.split(/\s+/)[0] : null
  );
  const last_name = pickString(
    data.last_name,
    data.lastName,
    typeof data.name === "string"
      ? data.name.split(/\s+/).slice(1).join(" ")
      : null
  );
  const company = pickString(
    data.company,
    currentWork?.company,
    (data.companies as Array<{ name?: string }> | undefined)?.[0]?.name
  );
  const title = pickString(
    data.headline,
    data.occupation,
    data.title,
    currentWork?.position
  );
  const location = pickString(data.location);
  const city =
    pickString(
      (data as { city?: string }).city,
      location?.includes(",") ? location.split(",")[0] : location
    ) || null;

  return { first_name, last_name, company, title, city, location };
}

export function mergeLeadFields(
  base: OutreachLeadFields,
  incoming: OutreachLeadFields
): OutreachLeadFields {
  return {
    first_name: base.first_name || incoming.first_name || null,
    last_name: base.last_name || incoming.last_name || null,
    company: base.company || incoming.company || null,
    title: base.title || incoming.title || null,
    city: base.city || incoming.city || null,
    location: base.location || incoming.location || null,
  };
}

export function leadFieldsIncomplete(lead: OutreachLeadFields): boolean {
  return !(
    lead.first_name &&
    lead.last_name &&
    lead.company &&
    lead.title
  );
}

/** All supported template keys (including aliases). */
export function outreachTemplateVars(
  lead: OutreachLeadFields,
  extras?: Record<string, string | null | undefined>
): Record<string, string> {
  const first = (lead.first_name || "").trim();
  const last = (lead.last_name || "").trim();
  const full = [first, last].filter(Boolean).join(" ");
  const company = (lead.company || "").trim();
  const title = (lead.title || "").trim();
  const city = (lead.city || "").trim();
  const location = (lead.location || city || "").trim();

  const base: Record<string, string> = {
    first_name: first,
    firstName: first,
    last_name: last,
    lastName: last,
    full_name: full,
    fullName: full,
    name: full || first,
    company,
    company_name: company,
    companyName: company,
    title,
    headline: title,
    job_title: title,
    jobTitle: title,
    city,
    location,
    assessment_url: "",
    scorecard_url: "",
    coach_name: "",
    review_name: "Business Clarity Review",
    their_reply: "",
  };
  if (extras) {
    for (const [k, v] of Object.entries(extras)) {
      if (v != null && String(v).trim()) base[k] = String(v).trim();
    }
  }
  if (base.assessment_url && !base.scorecard_url) {
    base.scorecard_url = base.assessment_url;
  }
  return base;
}
