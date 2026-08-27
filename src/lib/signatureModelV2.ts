export type SignatureScore = "red" | "yellow" | "green" | null;

export const SIGNATURE_MODULE_IDS = [
  "compass",
  "pipeline_setup",
  "engine",
  "offer",
  "value",
  "closing",
  "launchpad",
  "rhythm",
  "continuity",
  "time",
  "income",
  "lifestyle_fulfilment",
] as const;

/**
 * Retired module ids whose meaning carried over to a renamed module.
 * Scores saved under the old key are read when the new key has no value.
 * (`authority` and `pipeline` are retired without a successor — their
 * content re-homed but the wedge meaning changed.)
 */
export const LEGACY_SIGNATURE_MODULE_ID_MAP: Record<string, SignatureModuleId> =
  {
    profit: "rhythm",
    playbook: "continuity",
  };

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

export type SignatureModuleMeta = {
  id: SignatureModuleId;
  code: string;
  title: string;
  question: string;
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
      "My clients get tangible results I can point to, not just great conversations or sessions ticked off.",
    onrampHint: "Strengthens once your delivery system and milestones are explicit.",
  },
  {
    moduleId: "lifestyle_fulfilment",
    code: "O3",
    lensLabel: "Freedom",
    pillarPair: [0, 2],
    question:
      "Coaching fits my life instead of running it: I protect off-time and the practice still grows.",
    onrampHint: "Usually lags ambition until boundaries and leverage catch up.",
  },
];

export const SIGNATURE_MODEL_V2: { pillars: SignaturePillar[] } = {
  pillars: [
    {
      id: "reach",
      title: "Get Calls",
      letter: "C",
      green: "Reliable Leads",
      red: "Random Referrals",
      modules: [
        {
          id: "compass",
          code: "R1",
          diagramTitle: "Client Compass",
          question:
            "I know exactly who I serve, I can find them easily, and my messaging makes the right people lean in.",
          onrampHint: "Often green or yellow once positioning and prospect search are clear.",
        },
        {
          id: "pipeline_setup",
          code: "R2",
          diagramTitle: "Pipeline Setup",
          question:
            "My LinkedIn profile is set up, my lead magnets are ready, and booking is simple so prospects can take the next step easily.",
          onrampHint: "Usually yellow while profile, magnets, and booking setup are still being finished.",
        },
        {
          id: "engine",
          code: "R3",
          diagramTitle: "Lead Engine",
          question:
            "I run a simple, repeatable lead generation system of conversations and content that keeps my pipeline full and growing.",
          onrampHint: "Typically yellow while the engine is new but running.",
        },
      ],
    },
    {
      id: "enrol",
      title: "Win Clients",
      letter: "E",
      green: "Simple Sales",
      red: "Exhausting Selling",
      modules: [
        {
          id: "offer",
          code: "E1",
          diagramTitle: "Offer Design",
          question:
            "My offer is clear, compelling, and something I'm proud to present every time.",
          onrampHint: "Often green or yellow once packaging and price feel settled.",
        },
        {
          id: "value",
          code: "E2",
          diagramTitle: "Value Sessions",
          question:
            "I run value sessions with a proven structure that feels natural and converts consistently.",
          onrampHint: "Yellow or red when you’re trained but haven’t had enough reps yet.",
        },
        {
          id: "closing",
          code: "E3",
          diagramTitle: "Client Closing",
          question:
            "I close confidently, handle objections without pressure, and follow up until prospects decide.",
          onrampHint: "Yellow or red early while follow-up habits and objection reps are still forming.",
        },
      ],
    },
    {
      id: "deliver",
      title: "Coach Clients",
      letter: "D",
      green: "Rewarding Coaching",
      red: "Thankless Grind",
      modules: [
        {
          id: "launchpad",
          code: "D1",
          diagramTitle: "Client Launch",
          question:
            "My first sessions create clarity, buy-in, direction and momentum so clients know exactly what to do from week one.",
          onrampHint: "Session one may be strong while sessions two to four are still in build.",
        },
        {
          id: "rhythm",
          code: "D2",
          diagramTitle: "Coaching Method",
          question:
            "I have a clear method for ongoing sessions that I trust to guide any conversation and keep clients progressing.",
          onrampHint: "Often yellow once certification lands; green with repetition.",
        },
        {
          id: "continuity",
          code: "D3",
          diagramTitle: "Client Retention",
          question:
            "My clients see real progress they can point to, they stay month after month, and renewals and expansion happen naturally.",
          onrampHint: "Often red before you have a steady client load to refine against.",
        },
      ],
    },
  ],
};

/** Solid fills for module cards (matches `SignaturePetalDiagram` pillar disc colours). */
export const SIGNATURE_COMPASS_PILLAR_COVER_HEX = {
  reach: "#0c5290",
  enrol: "#42a1ee",
  deliver: "#1ca0c2",
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

export function getSignatureModuleMetaById(
  moduleId: SignatureModuleId
): SignatureModuleMeta | null {
  for (const pillar of SIGNATURE_MODEL_V2.pillars) {
    const mod = pillar.modules.find((m) => m.id === moduleId);
    if (mod) {
      return {
        id: mod.id,
        code: mod.code,
        title: mod.diagramTitle,
        question: mod.question,
      };
    }
  }
  return null;
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
  const record = raw as Record<string, unknown>;
  for (const id of SIGNATURE_MODULE_IDS) {
    const v = record[id];
    if (v === "red" || v === "yellow" || v === "green") {
      out[id] = v;
    } else {
      out[id] = null;
    }
  }
  for (const [legacyId, newId] of Object.entries(
    LEGACY_SIGNATURE_MODULE_ID_MAP
  )) {
    if (out[newId] !== null) continue;
    const v = record[legacyId];
    if (v === "red" || v === "yellow" || v === "green") {
      out[newId] = v;
    }
  }
  return out;
}
