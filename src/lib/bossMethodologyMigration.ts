/**
 * BOSS Pro methodology v1 → v2: playbook identity ref mapping for answer migration.
 * Refs are grid cell IDs (level.area); when playbooks move between cells, remap by name.
 */

export const METHODOLOGY_VERSION = 2;
export const LEGACY_METHODOLOGY_VERSION = 1;

/** Playbook display name at each ref in methodology v1 */
export const V1_PLAYBOOK_BY_REF: Record<string, string> = {
  "1.0": "Focus",
  "2.0": "Time & Energy",
  "3.0": "Mindset & Habits",
  "4.0": "Leadership",
  "5.0": "Life Design",
  "1.1": "Purpose",
  "2.1": "Goals",
  "3.1": "Vision",
  "4.1": "Strategic Intent",
  "5.1": "Mission",
  "1.2": "Core Offer",
  "2.2": "Business Model",
  "3.2": "Positioning",
  "4.2": "Growth Strategy",
  "5.2": "Exit Strategy",
  "1.3": "Execution",
  "2.3": "Business Mapping",
  "3.3": "Projects & Planning",
  "4.3": "Meetings & Reviews",
  "5.3": "Succession Planning",
  "1.4": "Cash Flow",
  "2.4": "Cost Control",
  "3.4": "Profit & Pricing",
  "4.4": "Profit Allocation",
  "5.4": "Wealth Building",
  "1.5": "Ideal Customer",
  "2.5": "Lead Generation",
  "3.5": "Lead Nurture",
  "4.5": "Sales & Conversion",
  "5.5": "Branding",
  "1.6": "Fulfilment",
  "2.6": "Customer Experience",
  "3.6": "Customer Retention",
  "4.6": "Lifetime Value",
  "5.6": "Product Development",
  "1.7": "Finance Fundamentals",
  "2.7": "Bookkeeping",
  "3.7": "KPIs",
  "4.7": "Dashboards & Reporting",
  "5.7": "Business Valuation",
  "1.8": "Processes",
  "2.8": "AI & Automation",
  "3.8": "Systems",
  "4.8": "Management",
  "5.8": "Optimisation",
  "1.9": "Team Foundations",
  "2.9": "Recruitment",
  "3.9": "Team Performance",
  "4.9": "Developing Leaders",
  "5.9": "Company Culture",
};

/** Playbook display name at each ref in methodology v2 */
export const V2_PLAYBOOK_BY_REF: Record<string, string> = {
  "1.0": "Focus",
  "2.0": "Time & Energy",
  "3.0": "Mindset & Habits",
  "4.0": "Leadership",
  "5.0": "Life Design",
  "1.1": "Purpose",
  "2.1": "Goals",
  "3.1": "Vision",
  "4.1": "Strategic Intent",
  "5.1": "Mission",
  "1.2": "Ideal Customer",
  "2.2": "Core Offer",
  "3.2": "Business Model",
  "4.2": "Growth Strategy",
  "5.2": "Exit Strategy",
  "1.3": "Execution",
  "2.3": "Business Mapping",
  "3.3": "Projects & Planning",
  "4.3": "Meetings & Reviews",
  "5.3": "Succession Planning",
  "1.4": "Cash Flow",
  "2.4": "Cost Control",
  "3.4": "Profit & Pricing",
  "4.4": "Profit Allocation",
  "5.4": "Wealth Building",
  "1.5": "Customer Acquisition",
  "2.5": "Sales & Conversion",
  "3.5": "Positioning",
  "4.5": "Follow-up & Nurture",
  "5.5": "Branding",
  "1.6": "Fulfilment",
  "2.6": "Customer Experience",
  "3.6": "Customer Retention",
  "4.6": "Lifetime Value",
  "5.6": "Product Development",
  "1.7": "Bookkeeping",
  "2.7": "Finance Fundamentals",
  "3.7": "KPIs",
  "4.7": "Dashboards & Reporting",
  "5.7": "Business Valuation",
  "1.8": "Processes",
  "2.8": "Systems",
  "3.8": "Management",
  "4.8": "AI & Automation",
  "5.8": "Optimisation",
  "1.9": "Team Output",
  "2.9": "Team Performance",
  "3.9": "Recruitment",
  "4.9": "Developing Leaders",
  "5.9": "Company Culture",
};

/** v1 playbook name → v2 ref (for answer migration) */
export const V1_NAME_TO_V2_REF: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [ref, name] of Object.entries(V2_PLAYBOOK_BY_REF)) {
    map[name] = ref;
  }
  map["Team Foundations"] = "1.9";
  // Interim v2 layout (Customers & Offer merge) → split to strategy L1/L2
  map["Customers & Offer"] = "1.2";
  map["Brand Visibility"] = "5.5";
  map["Market Authority"] = "5.5";
  // Pre-rename playbook titles (v2 grid identity unchanged)
  map["Lead Generation"] = "1.5";
  map["Lead Nurture"] = "4.5";
  return map;
})();

export type AnswersMap = Record<string, 0 | 1 | 2>;

/** Remap v1 answers (keyed by ref) to v2 refs using playbook identity. */
export function migrateAnswersV1ToV2(v1Answers: AnswersMap): AnswersMap {
  const v2: AnswersMap = {};

  for (const [v1Ref, score] of Object.entries(v1Answers)) {
    if (score == null) continue;
    const playbookName = V1_PLAYBOOK_BY_REF[v1Ref];
    if (!playbookName) continue;
    const v2Ref = V1_NAME_TO_V2_REF[playbookName];
    if (!v2Ref) continue;

    const existing = v2[v2Ref];
    if (existing == null) {
      v2[v2Ref] = score;
    } else {
      v2[v2Ref] = Math.min(existing, score) as 0 | 1 | 2;
    }
  }

  return v2;
}

/** Prior v2 grid (before strategy/revenue reorder) — ref → playbook name */
export const INTERIM_V2_PLAYBOOK_BY_REF: Record<string, string> = {
  ...V1_PLAYBOOK_BY_REF,
  "1.2": "Customers & Offer",
  "1.5": "Customer Acquisition",
  "1.7": "Bookkeeping",
  "1.9": "Team Output",
  "2.5": "Sales & Conversion",
  "2.7": "Finance Fundamentals",
  "2.8": "Systems",
  "2.9": "Team Performance",
  "3.5": "Brand Visibility",
  "3.8": "Management",
  "3.9": "Recruitment",
  "4.5": "Follow-up & Nurture",
  "4.8": "AI & Automation",
  "5.5": "Market Authority",
};

/** Remap answers stored under interim v2 refs (by ref identity, not v1 names). */
export function migrateInterimV2AnswersByRef(answers: AnswersMap): AnswersMap {
  const v2: AnswersMap = {};
  for (const [ref, score] of Object.entries(answers)) {
    if (score == null) continue;
    const name = INTERIM_V2_PLAYBOOK_BY_REF[ref];
    if (!name) {
      v2[ref] = score;
      continue;
    }
    if (name === "Customers & Offer") {
      v2["1.2"] = score;
      v2["2.2"] = score;
      continue;
    }
    const targetRef = V1_NAME_TO_V2_REF[name] ?? ref;
    const existing = v2[targetRef];
    if (existing == null) v2[targetRef] = score;
    else v2[targetRef] = Math.min(existing, score) as 0 | 1 | 2;
  }
  return v2;
}

/** Remap session notes keys ending in __prospect_scores etc. if ref-based */
export function migrateSessionAnswersV1ToV2(
  notes: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(notes)) {
    const refMatch = key.match(/^(\d\.\d)(__.*)$/);
    if (!refMatch) {
      out[key] = value;
      continue;
    }
    const [, v1Ref, suffix] = refMatch;
    const playbookName = V1_PLAYBOOK_BY_REF[v1Ref];
    const v2Ref = playbookName ? V1_NAME_TO_V2_REF[playbookName] : v1Ref;
    const newKey = `${v2Ref}${suffix}`;
    if (out[newKey] == null) {
      out[newKey] = value;
    }
  }
  return out;
}
