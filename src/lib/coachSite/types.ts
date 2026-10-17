/**
 * A coach's public website, built from their Blueprint.
 *
 * Everything here is safe to print on a public page. The mapper in
 * fromBlueprint.ts reads only an allowlist of Blueprint fields: never phone,
 * WhatsApp, address, transcripts, fees or private notes.
 */

export type CoachSitePhoto = {
  src: string;
  alt: string;
  /** "portrait" is a proper headshot on a plain ground; "avatar" is a small profile picture. */
  kind: "portrait" | "avatar" | "stage";
  width: number;
  height: number;
};

export type CoachSitePlace = {
  /** Short place name for the page, e.g. "Hull, Yorkshire". */
  label: string;
  lat: number | null;
  lng: number | null;
};

export type CoachSiteFact = { value: string; label: string };

export type CoachSiteQuote = { quote: string; cite: string };

export type CoachSiteStep = { title: string; detail: string };

export type CoachSiteGapRow = { today: string; want: string };

export type CoachSiteOffer = {
  name: string | null;
  promise: string | null;
  whoFor: string | null;
  included: string | null;
  format: string | null;
};

/** Blueprint sections the site reads, for the preview's "needs" markers. */
export type CoachSiteSource =
  | "offer:direction"
  | "offer:lines"
  | "story:bio"
  | "proof.client_results"
  | "proof.problems_asked"
  | "photo"
  | "location";

export type CoachSite = {
  slug: string;
  name: string;
  firstName: string;
  photo: CoachSitePhoto | null;
  stagePhoto: CoachSitePhoto | null;
  place: CoachSitePlace | null;
  linkedinUrl: string | null;

  /** offer:direction lede, "I help ... without ... using ...". */
  positioning: string | null;
  /** offer:lines, the three lengths. */
  shortLine: string | null;
  mediumLine: string | null;
  longLine: string | null;
  /** story:bio "For partners", else a stored one-pager lede if one still exists. */
  intro: string | null;
  /** offer:direction "Who it is for", else avatar, else a stored one-pager. */
  whoIHelp: string | null;
  /** Problems owners already ask, else a stored one-pager. */
  ownerWords: string[];
  /** offer:direction "The gap". */
  gap: CoachSiteGapRow[];
  /** offer:direction "Key messages". */
  keyMessages: string[];
  /** How the work runs: offer format, or a stored one-pager if one still exists. */
  method: CoachSiteStep[];
  /** offer:direction "The offer", without price. */
  offer: CoachSiteOffer | null;
  /** offer:direction "Why you". */
  whyMe: string[];
  /** story:bio "Short bio", first person. */
  bio: string | null;
  /** story:bio stats, else a stored one-pager if one still exists. */
  facts: CoachSiteFact[];
  /** Named client testimonials from the Blueprint. */
  testimonials: CoachSiteQuote[];
  /** Career results, else a stored one-pager "Results" that are not testimonials. */
  results: string[];

  links: {
    /** Landing page that explains the BOSS Score first. */
    score: string;
    /** Straight into the scorecard questions. */
    assessment: string;
    /** The coach's discovery call calendar. */
    book: string;
  };

  /** Sources that were empty, so the preview can say what the Blueprint still needs. */
  missing: CoachSiteSource[];
  /** True when only sections BCA signed off were used. */
  approvedOnly: boolean;
};
