/**
 * Curated ICP/avatar library seed data for `icp_avatar_library`.
 *
 * Sourced from the 215-document BCA avatar corpus analysis in
 * `docs/ideal-client-language-patterns.md` (universal pains §1, industry
 * vocabulary §2-3, objections §4, buying triggers §5, main-desire lines §6).
 *
 * The corpus is a strong source of *universal* owner pain/objection/trigger
 * language and a weak source of *industry* vocabulary (only 20/215 files
 * have a single trade noun) — so universal fields below are shared across
 * every entry, and only the vocabulary + industry-specific pain/desire
 * fields vary per industry. See docs §7 for the full rationale.
 */

export type LibraryDepth = "deep" | "light";
export type LibraryConfidence = "high" | "medium" | "low";

export type LibraryVocabulary = {
  customers?: string;
  staff?: string;
  jobs?: string;
  money?: string;
  extra?: string[];
};

export type LibrarySeedEntry = {
  industryKey: string;
  industryLabel: string;
  depth: LibraryDepth;
  confidence: LibraryConfidence;
  roleTitles: string[];
  teamSize: string;
  revenueRange: string;
  geography: string;
  vocabulary: LibraryVocabulary;
  universalPains: string[];
  industryPains: string[];
  mainDesires: string[];
  objections: string[];
  buyingTriggers: string[];
  sourceFiles: string[];
};

const HOUSE_ROLE_TITLES = ["Owner", "Founder", "CEO", "Managing Director", "Co-founder"];
const HOUSE_TEAM_SIZE = "11-50";
const HOUSE_REVENUE_RANGE = "£1M-£10M";
const UK = "United Kingdom";

/** §1 — six pains that recur across nearly every industry in the corpus. */
export const UNIVERSAL_PAINS: string[] = [
  "Why does everything still come back to me?",
  "We're busy… but where's the profit?",
  "If I step back, will standards slip?",
  "I've built a job… not a scalable business.",
  "Why doesn't the team just take more ownership?",
  "I should be further ahead by now.",
];

/** §4 — canonical five-objection sequence, industry name slotted in. */
export function canonicalObjections(industryLabel: string): string[] {
  const lower = industryLabel.toLowerCase();
  return [
    `No one understands ${lower} — generic business coaches won't get the pressures of my industry.`,
    "I've been burned before by consultants — a folder full of fluff, no operational grounding.",
    "I'm too busy right now — I'll sort it when things calm down (they never do).",
    "We're doing okay — the pain isn't unbearable yet.",
    "I can probably fix this myself — classic high-performing founder mindset.",
  ];
}

/** §5 — buying triggers ranked by frequency/prominence across the corpus. */
export const BASE_BUYING_TRIGGERS: string[] = [
  "Growth has plateaued for another year running — 'we should be further ahead than this.'",
  "Burnout or a health scare makes the pace visibly unsustainable.",
  "A spouse/partner conversation about missed time with family lands hard.",
  "An exit or valuation conversation exposes over-reliance on the owner ('if you stepped away, what's left?').",
  "Peer comparison at a networking event — others are visibly further ahead.",
  "A cash flow scare or near-miss on payroll/VAT.",
  "A key person resigns, citing lack of autonomy or career progression.",
  "Losing a contract/client the business 'should have won.'",
  "A year-end review or audit reveals margins are thinner than expected.",
  "The owner privately names their own bottleneck for the first time.",
];

const LIFE_SCIENCES_HEALTHCARE_TRIGGERS = [
  ...BASE_BUYING_TRIGGERS,
  "An audit or compliance review raises 'would we pass if it were tomorrow?'",
];

// ---------------------------------------------------------------------------
// DEEP entries
// ---------------------------------------------------------------------------

const MANUFACTURING_ENGINEERING: LibrarySeedEntry = {
  industryKey: "manufacturing_engineering",
  industryLabel: "Manufacturing & Engineering",
  depth: "deep",
  confidence: "high",
  roleTitles: HOUSE_ROLE_TITLES,
  teamSize: HOUSE_TEAM_SIZE,
  revenueRange: HOUSE_REVENUE_RANGE,
  geography: UK,
  vocabulary: {
    customers: "customers, OEMs",
    staff: "the shop floor, operators",
    jobs: "orders, runs, big jobs",
    money: "margin, overheads, waste, bottom line",
    extra: [
      "lean",
      "continuous improvement",
      "capacity",
      "constraints",
      "quality audit",
      "production line",
      "energy costs",
    ],
  },
  universalPains: UNIVERSAL_PAINS,
  industryPains: [
    "There's too much waste and delay caused by poor quality, inefficient processes and supply issues — it's eroding our bottom line.",
    "Our overheads keep creeping up — energy costs, materials, employment costs — it's squeezing our margins hard.",
    "Big jobs aren't delivering the expected margin.",
    "A couple of long-tenure employees are acting like 'terrorists' — sabotaging any change to how the shop floor runs.",
    "A high-profile quality audit revealed bottlenecks in the production line, risking reputational damage.",
  ],
  mainDesires: [
    "make your profit match how hard you're working",
    "stop overheads squeezing your margins",
    "get the shop floor running without you in it",
    "know your true job costing before you quote the next one",
  ],
  objections: [
    ...canonicalObjections("manufacturing"),
    "No one understands manufacturing properly — the pressures of the shop floor, supply chain and margins.",
  ],
  buyingTriggers: BASE_BUYING_TRIGGERS,
  sourceFiles: [
    "Paul-Grys---Manufacturing---Ideal-Client-Profile.md",
    "Terence-Monaghan---Ideal-Client-Avatar---Manufacturing-Engineering.md",
    "Peter-Buglass---Ideal-Client-Avatar-Manufacturing.md",
    "Graham-Campbell---Ideal-Client-Avatar---Manufacturing.md",
    "Ideal-Client-Profile-Engineering-Manufacturing-Production-Design-Businesses.md",
  ],
};

const SAAS_SOFTWARE: LibrarySeedEntry = {
  industryKey: "saas_software",
  industryLabel: "SaaS & Software",
  depth: "deep",
  confidence: "high",
  roleTitles: HOUSE_ROLE_TITLES,
  teamSize: HOUSE_TEAM_SIZE,
  revenueRange: HOUSE_REVENUE_RANGE,
  geography: UK,
  vocabulary: {
    customers: "users, accounts, logos",
    staff: "the team, engineers, CS",
    jobs: "deals, deployments, onboardings",
    money: "MRR, ARR, churn, runway, burn rate",
    extra: ["activation", "adoption", "GTM", "pipeline", "demos", "the window"],
  },
  universalPains: UNIVERSAL_PAINS,
  industryPains: [
    "Burning cash every month building the product — runway is a source of real fear, not a spreadsheet line.",
    "We sound like everyone else, even though we're not — differentiation isn't landing.",
    "I'm struggling to get users to see the value of the product fast enough, so we're losing them before they do.",
    "The team is good but doesn't 'think commercially' — they wait for decisions instead of closing gaps themselves.",
    "If we keep going like this, will we miss the window? — the fear is time-boxed against the market, not just operational.",
  ],
  mainDesires: [
    "cut churn and keep the revenue you've already won",
    "get customers to see the value faster",
    "grow without you closing every deal",
    "extend the runway without another fundraise",
  ],
  objections: [
    ...canonicalObjections("SaaS"),
    "External consultants may not truly understand the nuances of a software business model.",
    "Maybe the market is saturated and I've missed my peak window.",
  ],
  buyingTriggers: BASE_BUYING_TRIGGERS,
  sourceFiles: [
    "Amended-Client-Avatar---SaaS.md",
    "Ideal-Client-Avatar---SaaS-Business-Owner.md",
    "Joe-Jarrett---Ideal-Client-Avatar---B2B-SAAS.md",
    "Graham-Withe---Ideal-Client-Avatar---B2B---Saas.md",
    "LeMon---Ideal-Client-Avatar---Saas.md",
  ],
};

const CONSTRUCTION_TRADES: LibrarySeedEntry = {
  industryKey: "construction_trades",
  industryLabel: "Construction & Trades",
  depth: "deep",
  confidence: "high",
  roleTitles: HOUSE_ROLE_TITLES,
  teamSize: HOUSE_TEAM_SIZE,
  revenueRange: HOUSE_REVENUE_RANGE,
  geography: UK,
  vocabulary: {
    customers: "clients, main contractors",
    staff: "the lads, crew, subbies",
    jobs: "jobs, sites, projects, snags",
    money: "margin, job profit, valuations",
    extra: ["off the tools", "on site", "job costing", "snagging", "rework", "quoting"],
  },
  universalPains: UNIVERSAL_PAINS,
  industryPains: [
    "One bad job can wipe out the profit from three good ones.",
    "Jobs are taking longer than expected, materials cost more than planned, and job costing is too weak to catch it in time.",
    "An irate client calls about a project dragging on because of excessive snagging.",
    "Poor communication between office and site keeps causing avoidable rework.",
    "If I'm not on site, something goes wrong.",
  ],
  mainDesires: [
    "get off the tools without standards slipping",
    "win more profitable jobs",
    "stop one bad job wiping out the profit from three good ones",
    "know your real job costing before you quote the next one",
  ],
  objections: [
    ...canonicalObjections("construction and trades"),
    "I've tried consultants who talk theory but have never run a site.",
  ],
  buyingTriggers: BASE_BUYING_TRIGGERS,
  sourceFiles: [
    "Derek-Hollingdale---Ideal-Client-Avatar---Construction-Trades.md",
    "Nov-Construction-Profile-Avatar.md",
    "Chris-Shaw---Ideal-Client-Avatar--.md",
    "Ideal-client-profile---Develops-Construction.md",
    "Gordon-Mackay---Ideal-Client-Avatar---Construction-Specialist-Contracting-Services.md",
  ],
};

// ---------------------------------------------------------------------------
// LIGHT entries
// ---------------------------------------------------------------------------

const HEALTHCARE: LibrarySeedEntry = {
  industryKey: "healthcare",
  industryLabel: "Healthcare & Life Sciences",
  depth: "light",
  confidence: "medium",
  roleTitles: HOUSE_ROLE_TITLES,
  teamSize: HOUSE_TEAM_SIZE,
  revenueRange: HOUSE_REVENUE_RANGE,
  geography: UK,
  vocabulary: {
    customers: "clients, partners, payers",
    staff: "specialists, the Commercial/Medical/Market Access teams",
    jobs: "programmes, studies, submissions",
    money: "cost-to-serve, project profitability",
    extra: ["audit", "compliance", "licences", "tick-box"],
  },
  universalPains: UNIVERSAL_PAINS,
  industryPains: [
    "If we were audited tomorrow, would I be completely confident?",
    "Are we compliant because we're good — or because I'm watching?",
    "Clear divides between Commercial, Medical, Market Access and Operations mean strategy never quite aligns.",
    "Difficult conversations get avoided for fear of upsetting specialists.",
  ],
  mainDesires: [
    "be audit-ready without watching everything yourself",
    "get Commercial and Medical pulling the same way",
    "grow commercially without going 'too corporate'",
  ],
  objections: canonicalObjections("healthcare"),
  buyingTriggers: LIFE_SCIENCES_HEALTHCARE_TRIGGERS,
  sourceFiles: [
    "Ideal-Client-Avatar---Life-Sciences.md",
    "Allison-Hogg---Ideal-Client-Profile---Life-Sciences.md",
    "Andy-Blocke---Ideal-Client-Avatar---Healthcare-Fitness.md",
  ],
};

const PROFESSIONAL_SERVICES: LibrarySeedEntry = {
  industryKey: "professional_services",
  industryLabel: "Professional Services",
  depth: "light",
  confidence: "medium",
  roleTitles: HOUSE_ROLE_TITLES,
  teamSize: HOUSE_TEAM_SIZE,
  revenueRange: HOUSE_REVENUE_RANGE,
  geography: UK,
  vocabulary: {
    customers: "clients",
    staff: "the practice, associates, technicians",
    jobs: "projects, engagements, stages",
    money: "fees, cash, bad payers",
    extra: ["winning the right work"],
  },
  universalPains: UNIVERSAL_PAINS,
  industryPains: [
    "We're winning work, but not the right work.",
    "One delayed payment could cause a real cash problem.",
    "Turnover keeps growing but cash always feels tight.",
    "Everything still lands on my desk, no matter how senior the team gets.",
  ],
  mainDesires: [
    "win the right work, not just more work",
    "stop everything landing on your desk",
    "grow fees without growing the stress",
  ],
  objections: canonicalObjections("professional services"),
  buyingTriggers: BASE_BUYING_TRIGGERS,
  sourceFiles: [
    "Andrew-Hayward---Ideal-Client-Avatar---Architects-Professional-Services.md",
    "Andrew-Hayward---Ideal-Client-Profile---Architects.md",
  ],
};

const RECRUITMENT: LibrarySeedEntry = {
  industryKey: "recruitment",
  industryLabel: "Recruitment",
  depth: "light",
  confidence: "medium",
  roleTitles: HOUSE_ROLE_TITLES,
  teamSize: HOUSE_TEAM_SIZE,
  revenueRange: HOUSE_REVENUE_RANGE,
  geography: UK,
  vocabulary: {
    customers: "clients",
    staff: "consultants, top billers, desks",
    jobs: "placements, roles, fills",
    money: "GP, fees, billings",
    extra: ["exit interview", "top billers"],
  },
  universalPains: UNIVERSAL_PAINS,
  industryPains: [
    "The firm excels at placing candidates for clients, yet struggles to attract and retain top talent within its own team.",
    "High turnover among top billers, often due to unmet growth expectations.",
    "Failed attempts at empowering staff mean the work keeps boomeranging back to the owner's desk.",
    "I need to be out there winning clients, not buried in admin work.",
  ],
  mainDesires: [
    "keep your top billers",
    "grow billings without being the top biller yourself",
    "stop work coming back to your desk",
  ],
  objections: canonicalObjections("recruitment"),
  buyingTriggers: BASE_BUYING_TRIGGERS,
  sourceFiles: [
    "Miles-S---Ideal-Client-Avatar---Recruitment.md",
    "Jason-G---Ideal-Client-Avatar---Recruitment.md",
    "Liam-H---Ideal-Client-Avatar---Recruitment.md",
  ],
};

const BUILDERS_MERCHANTS: LibrarySeedEntry = {
  industryKey: "builders_merchants",
  industryLabel: "Builders' & Trade Merchants",
  depth: "light",
  confidence: "medium",
  roleTitles: HOUSE_ROLE_TITLES,
  teamSize: HOUSE_TEAM_SIZE,
  revenueRange: HOUSE_REVENUE_RANGE,
  geography: UK,
  vocabulary: {
    customers: "trade customers, accounts",
    staff: "branch teams, counter staff",
    jobs: "orders, deliveries",
    money: "margin leakage, rebates, debtor days, shrinkage",
    extra: ["branches", "yards", "trading terms", "overdraft"],
  },
  universalPains: UNIVERSAL_PAINS,
  industryPains: [
    "Inconsistent branch performance — some branches simply outperform others for no clear reason.",
    "A long-time trade customer switches to a national chain because they offer a better rebate scheme.",
    "The bank flags concerns about the overdraft being close to its limit — again.",
    "Security and theft leakage (shrinkage) quietly erode margin no one is watching closely enough.",
  ],
  mainDesires: [
    "get every branch performing like your best one",
    "stop margin leaking out of the yard",
    "bring your debtor days down",
  ],
  objections: canonicalObjections("builders' merchants"),
  buyingTriggers: BASE_BUYING_TRIGGERS,
  sourceFiles: [
    "Nick-Summers---Ideal-Client-Profile---Trade-merchant.md",
    "Ideal-Client-Avatar---Builders-Merchants.md",
    "Ashley-C---Ideal-Client-Profile-and-Avatar---Builders-Merchant-Supplies.md",
  ],
};

const ACCOUNTANCY: LibrarySeedEntry = {
  industryKey: "accountancy",
  industryLabel: "Accountancy & Professional Practice",
  depth: "light",
  confidence: "high",
  roleTitles: HOUSE_ROLE_TITLES,
  teamSize: HOUSE_TEAM_SIZE,
  revenueRange: HOUSE_REVENUE_RANGE,
  geography: UK,
  vocabulary: {
    customers: "clients",
    staff: "fee earners, associates, partners",
    jobs: "jobs, files, compliance work",
    money: "fees, WIP, billable hours, write-offs, lock-up",
    extra: ["Big 4", "practice", "fee increase"],
  },
  universalPains: UNIVERSAL_PAINS,
  industryPains: [
    "WIP keeps growing and cash flow is becoming a concern, but chasing overdue invoices risks upsetting long-term clients.",
    "A long-standing client disputes a recent fee increase, claiming they can get the same service elsewhere for half the price.",
    "A promising senior accountant joins, only to leave within a year for a Big 4 firm.",
    "He wants to grow the firm beyond selling time.",
  ],
  mainDesires: [
    "get your WIP down and cash in faster",
    "grow the practice beyond selling time",
    "raise your fees without losing clients",
  ],
  objections: canonicalObjections("accountancy"),
  buyingTriggers: [
    ...BASE_BUYING_TRIGGERS,
    "Acquisition talks fall flat when a buyer says 'you're too reliant on you — if you stepped away, what's left?'",
  ],
  sourceFiles: [
    "Ideal-Client-Avatar---Accountancy.md",
    "Michael-Douglas---Ideal-Client-Avatar---Accountancy-Firm.md",
    "Jo-Mousley---Ideal-Client-Profile-And-Avatar--.md",
  ],
};

const HOSPITALITY_EVENTS: LibrarySeedEntry = {
  industryKey: "hospitality_events",
  industryLabel: "Hospitality & Events",
  depth: "light",
  confidence: "medium",
  roleTitles: HOUSE_ROLE_TITLES,
  teamSize: HOUSE_TEAM_SIZE,
  revenueRange: HOUSE_REVENUE_RANGE,
  geography: UK,
  vocabulary: {
    customers: "guests, couples, clients",
    staff: "the team, front of house",
    jobs: "bookings, weddings, events, stays",
    money: "deposits, occupancy, event profit, OTA commission",
    extra: ["season", "peak season", "covers"],
  },
  universalPains: UNIVERSAL_PAINS,
  industryPains: [
    "We're fully booked, so why isn't there money left?",
    "Deposits get spent too early, creating delivery pressure months later.",
    "More weddings or events means more complexity, not more profit — the 'busy fool' trap.",
    "Competing with OTAs and low-margin operators has eroded profits.",
  ],
  mainDesires: [
    "make real profit from a full diary",
    "stop spending deposits you'll need later",
    "get through peak season without 14-hour days",
  ],
  objections: canonicalObjections("hospitality and events"),
  buyingTriggers: BASE_BUYING_TRIGGERS,
  sourceFiles: [
    "Matt-Beevers---Ideal-Client-Profile---Wedding-Venue-Sector.md",
    "MB---Ideal-Client-Avatar---Wedding-Venue-Sector.md",
    "Andrea-M---Ideal-Client-Avatar.md",
    "Amit---Ideal-Client-Avatar---Hospitality.md",
  ],
};

const IMPORTERS_DISTRIBUTORS: LibrarySeedEntry = {
  industryKey: "importers_distributors",
  industryLabel: "Importers & Distributors",
  depth: "light",
  confidence: "medium",
  roleTitles: HOUSE_ROLE_TITLES,
  teamSize: HOUSE_TEAM_SIZE,
  revenueRange: HOUSE_REVENUE_RANGE,
  geography: UK,
  vocabulary: {
    customers: "customers, retailers",
    staff: "the team, warehouse",
    jobs: "orders, containers, SKUs",
    money: "landed cost, SKU margin, stock, tariffs",
    extra: ["ERP", "single source of truth"],
  },
  universalPains: UNIVERSAL_PAINS,
  industryPains: [
    "SKU-level profitability is unclear — some lines are quietly losing money.",
    "Whether they can keep absorbing price increases, and whether customers will accept another price rise, are both live worries at once.",
    "Global politics, tariffs and trade changes keep hitting the P&L unexpectedly.",
    "ERP, accounting, inventory and spreadsheets all disagree with each other.",
  ],
  mainDesires: [
    "know which SKUs actually make you money",
    "pass price rises on without losing customers",
    "free up the cash tied up in stock",
  ],
  objections: canonicalObjections("importing and distribution"),
  buyingTriggers: BASE_BUYING_TRIGGERS,
  sourceFiles: [
    "Yair-Emanuel---Ideal-Client-Avatar---Importers-and-Distributors.md",
    "Daniel-Mirwis---Ideal-Client-Avatar---Houseware-Tableware-and-Kitchenware.md",
  ],
};

export const LIBRARY_SEED_ENTRIES: LibrarySeedEntry[] = [
  MANUFACTURING_ENGINEERING,
  SAAS_SOFTWARE,
  CONSTRUCTION_TRADES,
  HEALTHCARE,
  PROFESSIONAL_SERVICES,
  RECRUITMENT,
  BUILDERS_MERCHANTS,
  ACCOUNTANCY,
  HOSPITALITY_EVENTS,
  IMPORTERS_DISTRIBUTORS,
];

export function findLibrarySeedEntry(industryKey: string): LibrarySeedEntry | undefined {
  return LIBRARY_SEED_ENTRIES.find((e) => e.industryKey === industryKey);
}
