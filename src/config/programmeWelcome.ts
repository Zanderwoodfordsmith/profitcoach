/**
 * Post-checkout / GHL welcome (/welcome).
 */

export const PROGRAMME_WELCOME_VIDALYTICS_EMBED_ID =
  "vidalytics_embed_jlQzP_2rQRW2N8QK";

export const PROGRAMME_WELCOME_VIDALYTICS_BASE_URL =
  "https://fast.vidalytics.com/embeds/Wb70Vokr/jlQzP_2rQRW2N8QK/";

/** @deprecated Prefer Vidalytics embed constants above. */
export const PROGRAMME_WELCOME_VIDEO_URL =
  process.env.NEXT_PUBLIC_PROGRAMME_WELCOME_VIDEO_URL?.trim() || "";

/**
 * Paste into a GHL email/SMS. Custom values merge contact merge fields.
 * Phone custom field keys vary by location — `{{contact.phone}}` is the usual default.
 */
export const PROGRAMME_WELCOME_GHL_LINK_TEMPLATE =
  "https://theprofitcoach.com/welcome" +
  "?first_name={{contact.first_name}}" +
  "&last_name={{contact.last_name}}" +
  "&email={{contact.email}}" +
  "&phone={{contact.phone}}" +
  "&linkedin={{contact.linkedin_profile_url}}";

export type ProgrammeWelcomePrefill = {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
};

function firstParam(
  params: URLSearchParams,
  keys: string[]
): string {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return "";
}

/** Read GHL (or manual) query prefills from `/welcome?...`. */
export function parseProgrammeWelcomePrefill(
  params: URLSearchParams
): ProgrammeWelcomePrefill | null {
  const firstName = firstParam(params, [
    "first_name",
    "firstName",
    "firstname",
  ]);
  const lastName = firstParam(params, ["last_name", "lastName", "lastname"]);
  const email = firstParam(params, ["email", "Email"]);
  const phone = firstParam(params, ["phone", "tel", "mobile"]);
  const linkedinUrl = firstParam(params, [
    "linkedin",
    "linkedin_url",
    "linkedin_profile_url",
    "linkedinUrl",
  ]);
  const fullNameParam = firstParam(params, ["full_name", "name", "fullName"]);

  const fullName =
    fullNameParam ||
    [firstName, lastName].filter(Boolean).join(" ").trim();

  if (!email && !firstName && !fullName && !linkedinUrl && !phone) {
    return null;
  }

  return {
    firstName: firstName || fullName.split(/\s+/)[0] || "",
    lastName,
    fullName: fullName || firstName || "there",
    email,
    phone,
    linkedinUrl,
  };
}
