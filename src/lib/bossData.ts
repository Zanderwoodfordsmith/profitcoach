/**
 * BOSS Dashboard structure - levels, areas, playbooks.
 * Mirrors the structure from BOSS Dashboard thank-you.js for grid/charts compatibility.
 */

export type BossLevel = {
  id: number;
  name: string;
  short: string;
};

export type BossArea = {
  id: number;
  code: string;
  name: string;
  pillar: "foundation" | "vision" | "velocity" | "value";
};

export type BossPlaybook = {
  ref: string;
  level: number;
  area: number;
  name: string;
};

export const LEVELS: BossLevel[] = [
  { id: 5, name: "Owner", short: "Owner" },
  { id: 4, name: "Overseer", short: "Overseer" },
  { id: 3, name: "Organised", short: "Organised" },
  { id: 2, name: "Overworked", short: "Overworked" },
  { id: 1, name: "Overwhelm", short: "Overwhelm" },
];

export const AREAS: BossArea[] = [
  { id: 0, code: "+", name: "Owner Performance", pillar: "foundation" },
  { id: 1, code: "A", name: "Aligned Vision", pillar: "vision" },
  { id: 2, code: "D", name: "Defined Strategy", pillar: "vision" },
  { id: 3, code: "D", name: "Disciplined Planning", pillar: "vision" },
  { id: 4, code: "P", name: "Profit & Cash Flow", pillar: "velocity" },
  { id: 5, code: "R", name: "Revenue & Marketing", pillar: "velocity" },
  { id: 6, code: "O", name: "Operations & Delivery", pillar: "velocity" },
  { id: 7, code: "F", name: "Financials & Metrics", pillar: "value" },
  { id: 8, code: "I", name: "Infrastructure & Systems", pillar: "value" },
  { id: 9, code: "T", name: "Team & Leadership", pillar: "value" },
];

export const PLAYBOOKS: BossPlaybook[] = [
  { ref: "5.0", level: 5, area: 0, name: "Life Design" },
  { ref: "5.1", level: 5, area: 1, name: "Mission" },
  { ref: "5.2", level: 5, area: 2, name: "Exit Strategy" },
  { ref: "5.3", level: 5, area: 3, name: "Succession Planning" },
  { ref: "5.4", level: 5, area: 4, name: "Wealth Building" },
  { ref: "5.5", level: 5, area: 5, name: "Branding" },
  { ref: "5.6", level: 5, area: 6, name: "Product Development" },
  { ref: "5.7", level: 5, area: 7, name: "Business Valuation" },
  { ref: "5.8", level: 5, area: 8, name: "Optimisation" },
  { ref: "5.9", level: 5, area: 9, name: "Company Culture" },
  { ref: "4.0", level: 4, area: 0, name: "Leadership" },
  { ref: "4.1", level: 4, area: 1, name: "Strategic Intent" },
  { ref: "4.2", level: 4, area: 2, name: "Growth Strategy" },
  { ref: "4.3", level: 4, area: 3, name: "Meetings & Reviews" },
  { ref: "4.4", level: 4, area: 4, name: "Profit Allocation" },
  { ref: "4.5", level: 4, area: 5, name: "Sales & Conversion" },
  { ref: "4.6", level: 4, area: 6, name: "Lifetime Value" },
  { ref: "4.7", level: 4, area: 7, name: "Dashboards & Reporting" },
  { ref: "4.8", level: 4, area: 8, name: "Management" },
  { ref: "4.9", level: 4, area: 9, name: "Developing Leaders" },
  { ref: "3.0", level: 3, area: 0, name: "Mindset & Habits" },
  { ref: "3.1", level: 3, area: 1, name: "Vision" },
  { ref: "3.2", level: 3, area: 2, name: "Positioning" },
  { ref: "3.3", level: 3, area: 3, name: "Projects & Planning" },
  { ref: "3.4", level: 3, area: 4, name: "Profit & Pricing" },
  { ref: "3.5", level: 3, area: 5, name: "Lead Nurture" },
  { ref: "3.6", level: 3, area: 6, name: "Customer Retention" },
  { ref: "3.7", level: 3, area: 7, name: "KPIs" },
  { ref: "3.8", level: 3, area: 8, name: "Systems" },
  { ref: "3.9", level: 3, area: 9, name: "Team Performance" },
  { ref: "2.0", level: 2, area: 0, name: "Time & Energy" },
  { ref: "2.1", level: 2, area: 1, name: "Goals" },
  { ref: "2.2", level: 2, area: 2, name: "Business Model" },
  { ref: "2.3", level: 2, area: 3, name: "Business Mapping" },
  { ref: "2.4", level: 2, area: 4, name: "Cost Control" },
  { ref: "2.5", level: 2, area: 5, name: "Lead Generation" },
  { ref: "2.6", level: 2, area: 6, name: "Customer Experience" },
  { ref: "2.7", level: 2, area: 7, name: "Bookkeeping" },
  { ref: "2.8", level: 2, area: 8, name: "AI & Automation" },
  { ref: "2.9", level: 2, area: 9, name: "Recruitment" },
  { ref: "1.0", level: 1, area: 0, name: "Focus" },
  { ref: "1.1", level: 1, area: 1, name: "Purpose" },
  { ref: "1.2", level: 1, area: 2, name: "Core Offer" },
  { ref: "1.3", level: 1, area: 3, name: "Execution" },
  { ref: "1.4", level: 1, area: 4, name: "Cash Flow" },
  { ref: "1.5", level: 1, area: 5, name: "Ideal Customer" },
  { ref: "1.6", level: 1, area: 6, name: "Fulfilment" },
  { ref: "1.7", level: 1, area: 7, name: "Finance Fundamentals" },
  { ref: "1.8", level: 1, area: 8, name: "Processes" },
  { ref: "1.9", level: 1, area: 9, name: "Team Foundations" },
];

export const PLAYBOOK_COUNT = 50;

/** Get playbook metadata by ref (safe for client components) */
export function getPlaybookMeta(ref: string): BossPlaybook | null {
  return PLAYBOOKS.find((p) => p.ref === ref) ?? null;
}

/** Wheel chart colors for each area (index 0-9) */
export const WHEEL_COLORS = [
  "#4C667A",
  "#093a6d",
  "#0c5290",
  "#3d7ab8",
  "#3183d9",
  "#42a1ee",
  "#7fc8f5",
  "#5dcce3",
  "#1ca0c2",
  "#157a96",
];

/** Level colors for diagram/wheel (Overwhelm→Owner) */
export const LEVEL_COLORS_DIAGRAM = [
  "#FC2975", // 1 Overwhelm
  "#FF7400", // 2 Overworked
  "#B743F0", // 3 Organised
  "#07BC84", // 4 Overseer
  "#238BF7", // 5 Owner
];

/** Alternative warm color palette for wheel */
export const WHEEL_COLORS_ALT = [
  "#E06D69",
  "#F39667",
  "#FBCB66",
  "#FAE774",
  "#B5D87E",
  "#8FBC69",
  "#71B8ED",
  "#528BC3",
  "#AC75B4",
  "#E17DDC",
];
