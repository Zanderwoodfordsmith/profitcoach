/** Default BOSS-style landing page copy (variant A = newCopy, variant B = legacy in routing). */

export type LandingKind = "legacy" | "newCopy";

export type FeatureItem = { title: string; text: string };

export type LandingContent = {
  eyebrow: string;
  heading: string;
  subheading: string;
  cta: string;
  heroStats: Array<{ k: string; v: string }>;
  painHeading: string;
  painIntro: string;
  painBullets: string[];
  painCloser: string;
  valueHeading: string;
  values: FeatureItem[];
  closeHeading: string;
  closeSubheading: string;
};

/** Keys coaches may override via profiles.landing_copy_overrides (expand over time). */
export const LANDING_COPY_OVERRIDE_KEYS = ["eyebrow"] as const;
export type LandingCopyOverrideKey = (typeof LANDING_COPY_OVERRIDE_KEYS)[number];

export type LandingCopyOverrides = Partial<Pick<LandingContent, LandingCopyOverrideKey>>;

const OVERRIDE_MAX_LEN: Record<LandingCopyOverrideKey, number> = {
  eyebrow: 120,
};

/** URL query params preserved from landing → assessment (prospect personalization). */
export const LANDING_TO_ASSESSMENT_PARAMS = ["company", "prospect"] as const;

export function getDefaultLandingContent(kind: LandingKind): LandingContent {
  if (kind === "newCopy") {
    return {
      eyebrow: "For Business Owners £500K to £5M",
      heading:
        "Know Exactly What to Fix First in Your £500K-£5M Business in 12 Minutes",
      subheading:
        "The BOSS Dashboard scores your business across 5 levels and 10 areas using 50 red, yellow, green questions to give you one score out of 100, one focus area, and one clear next move.",
      cta: "Get My Free BOSS Score (12 Minutes, No Call Required)",
      heroStats: [
        { k: "12 mins", v: "to complete" },
        { k: "50 Qs", v: "across 10 areas" },
        { k: "£0", v: "no credit card" },
        { k: "1 score", v: "actionable focus" },
      ],
      painHeading: "If your business feels stuck, it's not effort, it's clarity.",
      painIntro:
        "You can see twenty things wrong with your business, but you cannot see which one will move the needle first.",
      painBullets: [
        "Do you feel like you're firefighting every day with no strategic progress?",
        "Are you working harder than ever while your revenue stays flat?",
        "Have you tried books, consultants, and courses but still do not know what to fix first?",
        "Do twenty visible issues in your business still stay trapped in your head with no order and no plan?",
      ],
      painCloser:
        "The BOSS Dashboard pulls that picture out of your head and shows you exactly what to fix first, no call, no pitch, no commitment.",
      valueHeading: "Why The BOSS Dashboard Is Different",
      values: [
        { title: "Score Out of 100", text: "Get one clear number so you know exactly where you stand." },
        { title: "5 Levels of Business", text: "See all five levels on one grid so you fix the right level first." },
        { title: "50 Red, Yellow, Green Questions", text: "Spot what is bleeding, what works, and what is nearly there." },
        { title: "Built on 25+ Business Thinkers", text: "Use one mapped diagnostic instead of disconnected frameworks." },
        { title: "Owner Performance First", text: "Fix root causes in the owner layer before treating symptoms." },
        { title: "Free and No Call Required", text: "Take the full diagnostic in 12 minutes and get your score immediately." },
      ],
      closeHeading: "Are You The BOSS Of Your Business, Or Is It The BOSS Of You?",
      closeSubheading:
        "Find out in 12 minutes. 50 questions. 10 areas. 5 levels. One score out of 100. One clear focus area.",
    };
  }

  return {
    eyebrow: "Business Operating System Diagnostic",
    heading: "Are You The BOSS, Or Is Your Business The BOSS Of You?",
    subheading:
      "Take a fast strategic assessment inspired by the BOSS design and get a clear score, a clear priority, and a clear next step in under 12 minutes.",
    cta: "Take The Free BOSS Assessment",
    heroStats: [
      { k: "12 mins", v: "to complete" },
      { k: "50 Qs", v: "across 10 areas" },
      { k: "£0", v: "no credit card" },
      { k: "1 page", v: "action plan" },
    ],
    painHeading: "Most owners are not missing effort, they are missing order.",
    painIntro:
      "When everything feels urgent, you patch symptoms, stay overworked, and never fix the core bottleneck.",
    painBullets: [
      "You are carrying too many roles and still not seeing strategic progress.",
      "You know there are leaks in sales, team, and delivery but no ranked order for what to fix.",
      "Your weeks are full, but the needle does not move enough.",
      "You need one clear view of your whole operating system, not more random advice.",
    ],
    painCloser:
      "This diagnostic gives you a practical map so you can stop guessing and start fixing the right thing first.",
    valueHeading: "What You Get From This Assessment",
    values: [
      { title: "A Single Score", text: "See where your operating system sits right now." },
      { title: "A Priority Area", text: "Know which area has the highest leverage." },
      { title: "A 5-Level View", text: "Understand your maturity level as an owner." },
      { title: "A 10-Area Breakdown", text: "Get clarity across the full business." },
      { title: "Action Focus", text: "Turn insight into an immediate next move." },
      { title: "Instant Result", text: "No waiting and no call required." },
    ],
    closeHeading: "Get The Clarity To Grow Profit And Buy Back Time",
    closeSubheading: "One diagnostic. One score. One focus. One next move.",
  };
}

export function sanitizeLandingCopyOverrides(input: unknown): LandingCopyOverrides {
  if (input === null || input === undefined) return {};
  if (typeof input !== "object" || Array.isArray(input)) return {};

  const src = input as Record<string, unknown>;
  const out: LandingCopyOverrides = {};

  for (const key of LANDING_COPY_OVERRIDE_KEYS) {
    const raw = src[key];
    if (typeof raw !== "string") continue;
    const max = OVERRIDE_MAX_LEN[key];
    const cleaned = raw
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, max);
    if (cleaned) {
      (out as Record<string, string>)[key] = cleaned;
    }
  }

  return out;
}

export function mergeLandingContent(
  base: LandingContent,
  overrides: LandingCopyOverrides
): LandingContent {
  return { ...base, ...overrides };
}

const PROSPECT_PARAM_MAX = 80;

export function sanitizeProspectUrlParam(raw: string | null): string | null {
  if (raw == null) return null;
  const cleaned = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, PROSPECT_PARAM_MAX);
  return cleaned.length > 0 ? cleaned : null;
}
