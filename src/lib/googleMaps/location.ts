/** Countries we show in the Maps import picker. ISO 3166-1 alpha-2. */
export const GOOGLE_MAPS_COUNTRIES = [
  { code: "GB", label: "United Kingdom", flag: "🇬🇧" },
  { code: "IE", label: "Ireland", flag: "🇮🇪" },
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "AU", label: "Australia", flag: "🇦🇺" },
  { code: "CA", label: "Canada", flag: "🇨🇦" },
  { code: "NZ", label: "New Zealand", flag: "🇳🇿" },
  { code: "ZA", label: "South Africa", flag: "🇿🇦" },
  { code: "DE", label: "Germany", flag: "🇩🇪" },
  { code: "FR", label: "France", flag: "🇫🇷" },
  { code: "ES", label: "Spain", flag: "🇪🇸" },
  { code: "NL", label: "Netherlands", flag: "🇳🇱" },
] as const;

export const GOOGLE_MAPS_COUNTRY_OTHER = "OTHER";
export const GOOGLE_MAPS_DEFAULT_COUNTRY = "GB";
export const GOOGLE_MAPS_LOCATION_MAX = 120;

export const GOOGLE_MAPS_US_STATES = [
  { code: "AL", label: "Alabama" },
  { code: "AK", label: "Alaska" },
  { code: "AZ", label: "Arizona" },
  { code: "AR", label: "Arkansas" },
  { code: "CA", label: "California" },
  { code: "CO", label: "Colorado" },
  { code: "CT", label: "Connecticut" },
  { code: "DE", label: "Delaware" },
  { code: "DC", label: "District of Columbia" },
  { code: "FL", label: "Florida" },
  { code: "GA", label: "Georgia" },
  { code: "HI", label: "Hawaii" },
  { code: "ID", label: "Idaho" },
  { code: "IL", label: "Illinois" },
  { code: "IN", label: "Indiana" },
  { code: "IA", label: "Iowa" },
  { code: "KS", label: "Kansas" },
  { code: "KY", label: "Kentucky" },
  { code: "LA", label: "Louisiana" },
  { code: "ME", label: "Maine" },
  { code: "MD", label: "Maryland" },
  { code: "MA", label: "Massachusetts" },
  { code: "MI", label: "Michigan" },
  { code: "MN", label: "Minnesota" },
  { code: "MS", label: "Mississippi" },
  { code: "MO", label: "Missouri" },
  { code: "MT", label: "Montana" },
  { code: "NE", label: "Nebraska" },
  { code: "NV", label: "Nevada" },
  { code: "NH", label: "New Hampshire" },
  { code: "NJ", label: "New Jersey" },
  { code: "NM", label: "New Mexico" },
  { code: "NY", label: "New York" },
  { code: "NC", label: "North Carolina" },
  { code: "ND", label: "North Dakota" },
  { code: "OH", label: "Ohio" },
  { code: "OK", label: "Oklahoma" },
  { code: "OR", label: "Oregon" },
  { code: "PA", label: "Pennsylvania" },
  { code: "RI", label: "Rhode Island" },
  { code: "SC", label: "South Carolina" },
  { code: "SD", label: "South Dakota" },
  { code: "TN", label: "Tennessee" },
  { code: "TX", label: "Texas" },
  { code: "UT", label: "Utah" },
  { code: "VT", label: "Vermont" },
  { code: "VA", label: "Virginia" },
  { code: "WA", label: "Washington" },
  { code: "WV", label: "West Virginia" },
  { code: "WI", label: "Wisconsin" },
  { code: "WY", label: "Wyoming" },
] as const;

export type GoogleMapsCountryCode =
  | (typeof GOOGLE_MAPS_COUNTRIES)[number]["code"]
  | typeof GOOGLE_MAPS_COUNTRY_OTHER;

export type GoogleMapsUsStateCode =
  (typeof GOOGLE_MAPS_US_STATES)[number]["code"];

const COUNTRY_BY_CODE = new Map<string, string>(
  GOOGLE_MAPS_COUNTRIES.map((country) => [country.code, country.label])
);
const US_STATE_BY_CODE = new Map<string, string>(
  GOOGLE_MAPS_US_STATES.map((state) => [state.code, state.label])
);

/**
 * Short codes Apify/Nominatim have geocoded to the wrong place
 * (e.g. "UK" → Ouaka, Central African Republic).
 */
const LOCATION_ALIASES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bU\.?K\.?\b/gi, label: "United Kingdom" },
  { pattern: /\bG\.?B\.?\b/gi, label: "United Kingdom" },
  { pattern: /\bU\.?S\.?A\.?\b/gi, label: "United States" },
  { pattern: /\bU\.?S\.?\b/gi, label: "United States" },
  { pattern: /\bU\.?A\.?E\.?\b/gi, label: "United Arab Emirates" },
];

export function isGoogleMapsCountryCode(
  value: unknown
): value is GoogleMapsCountryCode {
  if (typeof value !== "string") return false;
  const code = value.trim().toUpperCase();
  return code === GOOGLE_MAPS_COUNTRY_OTHER || COUNTRY_BY_CODE.has(code);
}

export function googleMapsCountryLabel(code: string): string | null {
  const key = code.trim().toUpperCase();
  return COUNTRY_BY_CODE.get(key) ?? null;
}

export function isGoogleMapsUsStateCode(
  value: unknown
): value is GoogleMapsUsStateCode {
  return typeof value === "string" && US_STATE_BY_CODE.has(value.trim().toUpperCase());
}

export function googleMapsUsStateLabel(code: string): string | null {
  return US_STATE_BY_CODE.get(code.trim().toUpperCase()) ?? null;
}

export function googleMapsNeedsUsState(countryCode: string | null | undefined): boolean {
  return countryCode?.trim().toUpperCase() === "US";
}

export function expandGoogleMapsLocationAliases(value: string): string {
  let out = value.trim().replace(/\s+/g, " ");
  for (const alias of LOCATION_ALIASES) {
    out = out.replace(alias.pattern, alias.label);
  }
  return out.replace(/,\s*,+/g, ",").replace(/\s+,/g, ",").replace(/,\s+/g, ", ").trim();
}

function stripTrailingLabel(value: string, label: string): string {
  const suffix = new RegExp(
    `(?:,\\s*)?${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
    "i"
  );
  return value.replace(suffix, "").trim().replace(/,$/, "").trim();
}

export type GoogleMapsLocationInput = {
  city?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  stateCode?: string | null;
  /** Legacy single field from older clients. */
  location?: string | null;
};

export type ResolvedGoogleMapsLocation = {
  locationQuery: string;
  countryCode: string | null;
  countryLabel: string | null;
  stateCode: string | null;
  stateLabel: string | null;
};

export function resolveGoogleMapsLocation(
  input: GoogleMapsLocationInput
): ResolvedGoogleMapsLocation | { error: string } {
  const countryCodeRaw = input.countryCode?.trim().toUpperCase() || "";
  const stateCodeRaw = input.stateCode?.trim().toUpperCase() || "";
  const cityRaw = expandGoogleMapsLocationAliases(input.city ?? "");
  const otherName = expandGoogleMapsLocationAliases(input.countryName ?? "");
  const legacy = expandGoogleMapsLocationAliases(input.location ?? "");

  if (countryCodeRaw) {
    if (!isGoogleMapsCountryCode(countryCodeRaw)) {
      return { error: "Pick a country from the list." };
    }
    const countryLabel =
      countryCodeRaw === GOOGLE_MAPS_COUNTRY_OTHER
        ? otherName
        : googleMapsCountryLabel(countryCodeRaw);
    if (!countryLabel || countryLabel.length < 2) {
      return {
        error:
          countryCodeRaw === GOOGLE_MAPS_COUNTRY_OTHER
            ? "Enter the country name, for example United Kingdom."
            : "Pick a country.",
      };
    }
    if (countryLabel.length > GOOGLE_MAPS_LOCATION_MAX) {
      return { error: "Country name is too long." };
    }
    let stateCode: string | null = null;
    let stateLabel: string | null = null;
    if (googleMapsNeedsUsState(countryCodeRaw)) {
      if (!isGoogleMapsUsStateCode(stateCodeRaw)) {
        return { error: "Pick a US state." };
      }
      stateCode = stateCodeRaw;
      stateLabel = googleMapsUsStateLabel(stateCodeRaw);
    }
    let city = stripTrailingLabel(cityRaw, countryLabel);
    if (stateLabel) city = stripTrailingLabel(city, stateLabel);
    const parts = [city, stateLabel, countryLabel].filter(Boolean);
    const locationQuery = parts.join(", ");
    if (locationQuery.length > GOOGLE_MAPS_LOCATION_MAX) {
      return { error: "City or area is too long." };
    }
    return {
      locationQuery,
      countryCode:
        countryCodeRaw === GOOGLE_MAPS_COUNTRY_OTHER ? null : countryCodeRaw,
      countryLabel,
      stateCode,
      stateLabel,
    };
  }

  if (legacy.length < 2) {
    return { error: "Pick a country, or enter a city and country." };
  }
  if (legacy.length > GOOGLE_MAPS_LOCATION_MAX) {
    return { error: "City or area is too long." };
  }
  return {
    locationQuery: legacy,
    countryCode: null,
    countryLabel: null,
    stateCode: null,
    stateLabel: null,
  };
}

export function formatGoogleMapsLocationHint(locationQuery: string): string {
  return `We’ll search ${locationQuery}.`;
}

/**
 * Apify compass/crawler-google-places only accepts lowercase ISO 3166-1
 * alpha-2 codes (e.g. "gb"). Uppercase "GB" is rejected as invalid input.
 */
export function googleMapsApifyCountryCode(
  code: string | null | undefined
): string | undefined {
  const trimmed = code?.trim();
  if (!trimmed || trimmed.toUpperCase() === GOOGLE_MAPS_COUNTRY_OTHER) {
    return undefined;
  }
  return trimmed.toLowerCase();
}
