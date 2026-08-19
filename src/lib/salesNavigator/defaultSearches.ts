/**
 * One-click Lead Finder searches: Classroom base search ± location / 1st-degree,
 * plus ideal-client narrowing from the prospect-search playbook.
 *
 * Nothing is persisted — these are preloaded filter packs that open Sales Nav.
 */

import {
  defaultCompanyKeywords,
  defaultJobTitleKeywords,
} from "@/lib/salesNavigator/baseSearchDefaults";
import {
  buildSalesNavSearchUrl,
  type SalesNavDegree,
  type SalesNavKeyword,
} from "@/lib/salesNavigator/buildSalesNavSearchUrl";
import { LEADROCKS_US_STATES } from "@/lib/leadFinder/leadrocksOptions";
import {
  applyProspectSearchStrategy,
  BASE_SEARCH_DEGREES,
  BASE_SEARCH_TEAM_SIZES,
} from "@/lib/salesNavigator/prospectSearch/applyStrategy";
import type { ProspectSearchStrategy } from "@/lib/salesNavigator/prospectSearch/types";
import {
  resolvePostcodeRegion,
  resolveSalesNavRegion,
} from "@/lib/salesNavigator/regions";

export type SearchMarket = "GB" | "US";

export type DefaultSearchId =
  | "base-country"
  | "base-1st"
  | "base-town"
  | "base-postcode"
  | "base-state"
  | "ideal-company"
  | "ideal-industry"
  | "ideal-keywords";

export type DefaultSearchContext = {
  market: SearchMarket;
  town: string;
  postcode: string;
  /** US state name or 2-letter code. */
  state: string;
  /** Avatar / ICP industry hint — used for the industry one-click. */
  industryHint: string;
};

export type AppliedDefaultSearch = {
  id: DefaultSearchId;
  label: string;
  description: string;
  market: SearchMarket;
  location: string;
  degrees: SalesNavDegree[];
  companyKeywords: SalesNavKeyword[];
  jobTitleKeywords: SalesNavKeyword[];
  keywordsBoolean: string;
  teamSizes: string[];
  industry: string;
  clearIndustry: boolean;
  stateCode: string | null;
  url: string;
  ready: boolean;
  missingHint: string | null;
};

const MAX_PLACE = 80;
const MAX_POSTCODE = 12;
const MAX_INDUSTRY = 120;

const FIRST_DEGREE: SalesNavDegree[] = ["1"];

export function clampPlace(value: string): string {
  return value.trim().slice(0, MAX_PLACE);
}

export function clampPostcode(value: string): string {
  return value.trim().toUpperCase().slice(0, MAX_POSTCODE);
}

export function inferSearchMarket(
  value: string | null | undefined
): SearchMarket {
  const t = (value ?? "").trim().toLowerCase();
  if (
    /^(us|u\.s\.|usa|u\.s\.a\.)$/.test(t) ||
    /\b(united states|u\.s\.a\.|u\.s\.|usa|america)\b/.test(t) ||
    /,\s*us\.?\s*$/.test(t)
  ) {
    return "US";
  }
  return "GB";
}

export function countryLocation(market: SearchMarket): string {
  return market === "US" ? "United States" : "United Kingdom";
}

export function countryLabel(market: SearchMarket): string {
  return market === "US" ? "United States" : "United Kingdom";
}

function findUsState(value: string): { code: string; label: string } | null {
  const k = value.trim().toLowerCase();
  if (!k) return null;
  return (
    LEADROCKS_US_STATES.find(
      (s) => s.label.toLowerCase() === k || s.code.toLowerCase() === k
    ) ?? null
  );
}

export function splitGeography(value: string | null | undefined): {
  market: SearchMarket;
  town: string;
  state: string;
} {
  const raw = (value ?? "").trim();
  const market = inferSearchMarket(raw);
  if (!raw) return { market, town: "", state: "" };

  const first = raw.split(",")[0]?.trim() ?? "";
  const countryish = /^(united kingdom|uk|u\.k\.|great britain|united states|usa|u\.s\.a\.|u\.s\.|us|america)$/i;
  if (!first || countryish.test(first)) {
    return { market, town: "", state: "" };
  }

  const usState = findUsState(first);
  if (usState) {
    return { market: "US", town: "", state: usState.label };
  }

  return { market, town: clampPlace(first), state: "" };
}

function locationReady(
  location: string
): { ok: true; location: string } | { ok: false; hint: string } {
  const trimmed = location.trim();
  if (!trimmed) return { ok: false, hint: "Add a location first." };
  const region = resolveSalesNavRegion(trimmed);
  if (!region) {
    return {
      ok: false,
      hint: "LinkedIn doesn’t recognise that place yet — try a city, county, or state.",
    };
  }
  return { ok: true, location: region.text };
}

function pack(input: {
  id: DefaultSearchId;
  label: string;
  description: string;
  market: SearchMarket;
  location: string;
  degrees: SalesNavDegree[];
  companyKeywords?: SalesNavKeyword[];
  jobTitleKeywords?: SalesNavKeyword[];
  keywordsBoolean?: string;
  industry?: string;
  clearIndustry?: boolean;
  stateCode?: string | null;
  ready: boolean;
  missingHint: string | null;
}): AppliedDefaultSearch {
  const companyKeywords = input.companyKeywords ?? defaultCompanyKeywords();
  const jobTitleKeywords = input.jobTitleKeywords ?? defaultJobTitleKeywords();
  const keywordsBoolean = input.keywordsBoolean ?? "";
  const teamSizes = [...BASE_SEARCH_TEAM_SIZES];
  const url = input.ready
    ? buildSalesNavSearchUrl({
        titleKeywords: jobTitleKeywords,
        companyKeywords,
        teamSizes,
        location: input.location,
        degrees: input.degrees,
        keywordsBoolean,
      })
    : "";

  return {
    id: input.id,
    label: input.label,
    description: input.description,
    market: input.market,
    location: input.location,
    degrees: input.degrees,
    companyKeywords,
    jobTitleKeywords,
    keywordsBoolean,
    teamSizes,
    industry: input.industry ?? "",
    clearIndustry: input.clearIndustry ?? true,
    stateCode: input.stateCode ?? null,
    url,
    ready: input.ready,
    missingHint: input.missingHint,
  };
}

function baseAt(
  id: DefaultSearchId,
  label: string,
  description: string,
  market: SearchMarket,
  location: string,
  degrees: SalesNavDegree[],
  extra?: { stateCode?: string | null }
): AppliedDefaultSearch {
  const resolved = locationReady(location);
  if (!resolved.ok) {
    return pack({
      id,
      label,
      description,
      market,
      location,
      degrees,
      stateCode: extra?.stateCode,
      ready: false,
      missingHint: resolved.hint,
    });
  }
  return pack({
    id,
    label,
    description,
    market,
    location: resolved.location,
    degrees,
    stateCode: extra?.stateCode,
    ready: true,
    missingHint: null,
  });
}

function fromStrategy(
  id: DefaultSearchId,
  label: string,
  description: string,
  market: SearchMarket,
  location: string,
  strategy: ProspectSearchStrategy | null,
  missingHint: string | null
): AppliedDefaultSearch {
  const resolved = locationReady(location);
  if (!resolved.ok) {
    return pack({
      id,
      label,
      description,
      market,
      location,
      degrees: [...BASE_SEARCH_DEGREES],
      ready: false,
      missingHint: resolved.hint,
    });
  }
  if (!strategy) {
    return pack({
      id,
      label,
      description,
      market,
      location: resolved.location,
      degrees: [...BASE_SEARCH_DEGREES],
      ready: false,
      missingHint,
    });
  }
  const applied = applyProspectSearchStrategy(strategy);
  return pack({
    id,
    label,
    description,
    market,
    location: resolved.location,
    degrees: applied.degrees,
    companyKeywords: applied.companyKeywords,
    jobTitleKeywords: applied.jobTitleKeywords,
    keywordsBoolean: applied.keywordsBoolean,
    clearIndustry: applied.clearIndustry,
    ready: true,
    missingHint: null,
  });
}

/** Industry word on Current Company — the playbook’s quick filter, no LLM. */
function industryCompanySearch(
  market: SearchMarket,
  location: string,
  industry: string
): AppliedDefaultSearch {
  const term = industry.trim().slice(0, MAX_INDUSTRY);
  const resolved = locationReady(location);
  if (!term) {
    return pack({
      id: "ideal-industry",
      label: "Ideal client · Industry",
      description: "Base search + industry word on company name.",
      market,
      location,
      degrees: [...BASE_SEARCH_DEGREES],
      ready: false,
      missingHint: "Set an industry or finish your avatar first.",
    });
  }
  if (!resolved.ok) {
    return pack({
      id: "ideal-industry",
      label: "Ideal client · Industry",
      description: "Base search + industry word on company name.",
      market,
      location,
      degrees: [...BASE_SEARCH_DEGREES],
      ready: false,
      missingHint: resolved.hint,
    });
  }
  const companyMap = new Map<string, SalesNavKeyword>();
  for (const k of defaultCompanyKeywords()) {
    companyMap.set(k.term.toLowerCase(), k);
  }
  companyMap.set(term.toLowerCase(), { term, mode: "include" });
  return pack({
    id: "ideal-industry",
    label: "Ideal client · Industry",
    description: `Company includes “${term}” on top of the base search.`,
    market,
    location: resolved.location,
    degrees: [...BASE_SEARCH_DEGREES],
    companyKeywords: [...companyMap.values()],
    industry: term,
    clearIndustry: true,
    ready: true,
    missingHint: null,
  });
}

export type IdealStrategyPicks = {
  company: ProspectSearchStrategy | null;
  category: ProspectSearchStrategy | null;
  keywords: ProspectSearchStrategy | null;
};

export function pickIdealStrategies(
  strategies: ProspectSearchStrategy[] | null | undefined
): IdealStrategyPicks {
  const list = strategies ?? [];
  return {
    company: list.find((s) => s.kind === "company_name") ?? null,
    category: list.find((s) => s.kind === "category_name") ?? null,
    keywords: list.find((s) => s.kind === "keywords") ?? null,
  };
}

/**
 * Preloaded searches for the current market + optional town / postcode / state.
 * Ideal-client rows use the playbook strategies when present.
 */
export function buildDefaultSearches(
  ctx: DefaultSearchContext,
  strategies?: ProspectSearchStrategy[] | null
): AppliedDefaultSearch[] {
  const market = ctx.market;
  const country = countryLocation(market);
  const town = clampPlace(ctx.town);
  const postcode = clampPostcode(ctx.postcode);
  const stateHit = findUsState(ctx.state);
  const picks = pickIdealStrategies(strategies);

  const countrySearch = baseAt(
    "base-country",
    `Base search · ${countryLabel(market)}`,
    "Owners / founders / CEOs, 1–200 staff, 2nd + 3rd, coach/consultant excluded.",
    market,
    country,
    [...BASE_SEARCH_DEGREES]
  );

  const firstDegree = baseAt(
    "base-1st",
    "Base search · 1st degree",
    "Same base filters, 1st-degree connections only — warm outreach.",
    market,
    country,
    FIRST_DEGREE
  );

  const out: AppliedDefaultSearch[] = [countrySearch, firstDegree];

  const townSearch = baseAt(
    "base-town",
    town ? `Base search · ${town}` : "Base search · Town",
    market === "US"
      ? "Base search narrowed to a city."
      : "Base search narrowed to a town or city.",
    market,
    town,
    [...BASE_SEARCH_DEGREES]
  );
  if (!town) {
    townSearch.ready = false;
    townSearch.missingHint =
      market === "US" ? "Add a city to enable this." : "Add a town to enable this.";
    townSearch.url = "";
  }
  out.push(townSearch);

  if (market === "GB") {
    const fromPostcode = postcode ? resolvePostcodeRegion(postcode) : null;
    const postcodeSearch = baseAt(
      "base-postcode",
      fromPostcode
        ? `Base search · ${fromPostcode.text}`
        : "Base search · Postcode",
      "UK postcode area mapped to the nearest Sales Nav county / city.",
      market,
      fromPostcode?.text ?? postcode,
      [...BASE_SEARCH_DEGREES]
    );
    if (!postcode) {
      postcodeSearch.ready = false;
      postcodeSearch.missingHint = "Add a UK postcode to enable this.";
      postcodeSearch.url = "";
    } else if (!fromPostcode) {
      postcodeSearch.ready = false;
      postcodeSearch.missingHint =
        "That postcode area isn’t mapped yet — try a nearby town instead.";
      postcodeSearch.url = "";
    }
    out.push(postcodeSearch);
  } else {
    const stateLocation = stateHit
      ? `${stateHit.label}, United States`
      : ctx.state.trim();
    const stateSearch = baseAt(
      "base-state",
      stateHit ? `Base search · ${stateHit.label}` : "Base search · State",
      "Base search narrowed to a US state.",
      market,
      stateLocation,
      [...BASE_SEARCH_DEGREES],
      { stateCode: stateHit?.code ?? null }
    );
    if (!stateHit) {
      stateSearch.ready = false;
      stateSearch.missingHint = "Pick a US state to enable this.";
      stateSearch.url = "";
    }
    out.push(stateSearch);
  }

  const companyLabel = picks.company?.label
    ? `Ideal client · ${picks.company.label}`
    : "Ideal client · Company name";
  out.push(
    fromStrategy(
      "ideal-company",
      companyLabel,
      picks.company
        ? "Playbook: industry words on Current Company (highest quality)."
        : "Uses your avatar to put industry naming words on Current Company.",
      market,
      country,
      picks.company,
      "Generate strategies (or set an avatar) to unlock this."
    )
  );

  if (picks.category) {
    out.push(
      fromStrategy(
        "ideal-industry",
        `Ideal client · ${picks.category.label}`,
        "Playbook: category naming words on Current Company.",
        market,
        country,
        picks.category,
        null
      )
    );
  } else {
    out.push(industryCompanySearch(market, country, ctx.industryHint));
  }

  const keywordsLabel = picks.keywords?.label
    ? `Ideal client · ${picks.keywords.label}`
    : "Ideal client · Keywords";
  out.push(
    fromStrategy(
      "ideal-keywords",
      keywordsLabel,
      picks.keywords
        ? "Playbook: Keywords bar boolean — noisier, use when company-name is thin."
        : "Uses your avatar to build a Keywords-bar boolean.",
      market,
      country,
      picks.keywords,
      "Generate strategies (or set an avatar) to unlock this."
    )
  );

  return out;
}
