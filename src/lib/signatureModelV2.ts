export type SignatureScore = "red" | "yellow" | "green" | null;

export const SIGNATURE_MODULE_IDS = [
  "compass",
  "engine",
  "authority",
  "offer",
  "pipeline",
  "value",
  "profit",
  "launchpad",
  "playbook",
  "time",
  "income",
  "lifestyle_fulfilment",
] as const;

export type SignatureModuleId = (typeof SIGNATURE_MODULE_IDS)[number];

export type SignatureScoresMap = Partial<
  Record<SignatureModuleId, SignatureScore>
>;

export type SignatureMatrixColumn = {
  moduleId: SignatureModuleId;
  code: string;
  pillarId: string;
  pillarTitle: string;
  displayTitle: string;
};

export type SignaturePillar = {
  id: string;
  title: string;
  letter: string;
  green: string;
  red: string;
  modules: {
    id: SignatureModuleId;
    code: string;
    diagramTitle: string;
    /** Declarative “I …” line (shown after bold module title) */
    question: string;
    onrampHint: string;
  }[];
};

/** Centre lenses: display order Income → Impact (client results) → Freedom. Same moduleIds for stored scores. */
export type SignatureLifestyleLens = {
  moduleId: SignatureModuleId;
  code: string;
  lensLabel: string;
  pillarPair: [number, number];
  question: string;
  onrampHint: string;
};

export const SIGNATURE_LIFESTYLE_LENSES: SignatureLifestyleLens[] = [
  {
    moduleId: "income",
    code: "O1",
    lensLabel: "Income",
    pillarPair: [0, 1],
    question:
      "I earn from coaching at a level that matches my goals, and I’m clear on what moves the needle next.",
    onrampHint: "Often still red or yellow in the first months of building.",
  },
  {
    moduleId: "time",
    code: "O2",
    lensLabel: "Impact",
    pillarPair: [1, 2],
    question:
      "My clients get tangible results I can point to — not just great conversations or sessions ticked off.",
    onrampHint: "Strengthens once your delivery system and milestones are explicit.",
  },
  {
    moduleId: "lifestyle_fulfilment",
    code: "O3",
    lensLabel: "Freedom",
    pillarPair: [0, 2],
    question:
      "Coaching fits my life instead of running it — I protect off-time and the practice still grows.",
    onrampHint: "Usually lags ambition until boundaries and leverage catch up.",
  },
];

export const SIGNATURE_MODEL_V2: { pillars: SignaturePillar[] } = {
  pillars: [
    {
      id: "reach",
      title: "Connect",
      letter: "C",
      green: "Reliable Leads",
      red: "Random Referrals",
      modules: [
        {
          id: "compass",
          code: "R1",
          diagramTitle: "Client Compass",
          question:
            "I know exactly who I serve, the outcomes I own for them, and my messaging makes the right people lean in.",
          onrampHint: "Often green or yellow right after a strong positioning session.",
        },
        {
          id: "engine",
          code: "R2",
          diagramTitle: "Lead Engine",
          question:
            "I have a simple, repeatable way to generate enquiries — not random bursts when I finally post.",
          onrampHint: "Typically yellow while the engine is new but running.",
        },
        {
          id: "authority",
          code: "R3",
          diagramTitle: "Authority Builder",
          question:
            "I put content out that builds trust and authority without leaving me drained or inconsistent.",
          onrampHint: "Often red until a rhythm and format that fits you is locked in.",
        },
      ],
    },
    {
      id: "enrol",
      title: "Enroll",
      letter: "E",
      green: "Simple Sales",
      red: "Exhausting Selling",
      modules: [
        {
          id: "offer",
          code: "E1",
          diagramTitle: "Offer Formula",
          question:
            "My offer is clear, compelling, and something I’m proud to present every single time.",
          onrampHint: "Often green or yellow once packaging and price feel settled.",
        },
        {
          id: "pipeline",
          code: "E2",
          diagramTitle: "Pipeline Accelerator",
          question:
            "I know where every prospect is, and I move them forward with a calm process — nothing falls through the cracks.",
          onrampHint: "Yellow or red early while CRM and follow-ups are still forming.",
        },
        {
          id: "value",
          code: "E3",
          diagramTitle: "Value Session",
          question:
            "I run value conversations with a proven structure and convert without feeling pushy or apologetic.",
          onrampHint: "Yellow or red when you’re trained but haven’t had enough reps yet.",
        },
      ],
    },
    {
      id: "deliver",
      title: "Deliver",
      letter: "D",
      green: "Rewarding Coaching",
      red: "Thankless Grind",
      modules: [
        {
          id: "profit",
          code: "D1",
          diagramTitle: "Profit System",
          question:
            "I can run a sharp business diagnostic and show any client exactly where to focus for the biggest payoff.",
          onrampHint: "Often yellow once certification lands; green with repetition.",
        },
        {
          id: "launchpad",
          code: "D2",
          diagramTitle: "Client Launchpad",
          question:
            "My first sessions with a new client create clarity, buy-in, and momentum — they know what to do from week one.",
          onrampHint: "Session one may be strong while sessions two to four are still in build.",
        },
        {
          id: "playbook",
          code: "D3",
          diagramTitle: "Coaching Playbook",
          question:
            "My sessions are structured and engaging — clients show up, do the work, and keep going because they see progress.",
          onrampHint: "Often red before you have a steady client load to refine against.",
        },
      ],
    },
  ],
};

/** Solid fills for module cards (matches `SignaturePetalDiagram` pillar disc colours). */
export const SIGNATURE_COMPASS_PILLAR_COVER_HEX = {
  reach: "#0c5290",
  enrol: "#6eb6f0",
  deliver: "#2a9d8f",
} as const;

export type SignatureCompassPillarId = keyof typeof SIGNATURE_COMPASS_PILLAR_COVER_HEX;

export function getSignaturePillarTitleById(
  pillarId: string | undefined
): string | undefined {
  if (!pillarId) return undefined;
  return SIGNATURE_MODEL_V2.pillars.find((p) => p.id === pillarId)?.title;
}

export function flattenSignatureModules() {
  return SIGNATURE_MODEL_V2.pillars.flatMap((p) =>
    p.modules.map((m) => ({ pillar: p, ...m }))
  );
}

export function getSignatureMatrixColumns(): SignatureMatrixColumn[] {
  const pillarColumns = SIGNATURE_MODEL_V2.pillars.flatMap((pillar) =>
    pillar.modules.map((module) => ({
      moduleId: module.id,
      code: module.code,
      pillarId: pillar.id,
      pillarTitle: pillar.title,
      displayTitle: module.diagramTitle,
    }))
  );

  const lifestyleColumns = SIGNATURE_LIFESTYLE_LENSES.map((lens) => ({
    moduleId: lens.moduleId,
    code: lens.code,
    pillarId: "lifestyle",
    pillarTitle: "Lifestyle",
    displayTitle: lens.lensLabel,
  }));

  return [...pillarColumns, ...lifestyleColumns];
}

export function isSignatureModuleId(k: string): k is SignatureModuleId {
  return (SIGNATURE_MODULE_IDS as readonly string[]).includes(k);
}

export function normalizeScores(
  raw: unknown
): Record<SignatureModuleId, SignatureScore> {
  const out = {} as Record<SignatureModuleId, SignatureScore>;
  for (const id of SIGNATURE_MODULE_IDS) {
    out[id] = null;
  }
  if (!raw || typeof raw !== "object") return out;
  for (const id of SIGNATURE_MODULE_IDS) {
    const v = (raw as Record<string, unknown>)[id];
    if (v === "red" || v === "yellow" || v === "green") {
      out[id] = v;
    } else {
      out[id] = null;
    }
  }
  return out;
}
