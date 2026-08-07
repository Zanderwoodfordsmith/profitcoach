import type {
  NewsletterFormat,
  NewsletterLengthMode,
  Overview537,
  PlannedEdition,
} from "./types";

function padTitle(prefix: string, item: string): string {
  const clean = item.replace(/^[✅❌⚠️👀💥\d.\-\s]+/, "").trim();
  return `${prefix}: ${clean}`;
}

/** Deterministic 16-edition plan from a locked 5-3-7 overview. */
export function buildCascadeFrom537(opts: {
  leadTopic: string;
  overview: Overview537;
  lengthMode?: NewsletterLengthMode;
}): PlannedEdition[] {
  const length = opts.lengthMode ?? "short";
  const deepFormat: NewsletterFormat =
    length === "long" ? "in_depth" : "pam_deep_dive";
  const strategies = opts.overview.strategies.slice(0, 5);
  const mistakes = opts.overview.mistakes.slice(0, 3);
  const checklist = opts.overview.checklist.slice(0, 7);

  const editions: PlannedEdition[] = [
    {
      sequence_index: 1,
      kind: "overview_537",
      kind_index: null,
      title: `💥 ${opts.leadTopic}`,
      tagline: "5 strategies · 3 mistakes · 7-point checklist",
      format: "pam_537_overview",
      length_mode: length === "long" ? "long" : "short",
    },
  ];

  strategies.forEach((s, i) => {
    editions.push({
      sequence_index: editions.length + 1,
      kind: "strategy",
      kind_index: i + 1,
      title: padTitle(`Strategy ${i + 1}`, s),
      tagline: `Deep dive on strategy ${i + 1} of 5`,
      format: deepFormat,
      length_mode: length,
    });
  });

  mistakes.forEach((m, i) => {
    editions.push({
      sequence_index: editions.length + 1,
      kind: "mistake",
      kind_index: i + 1,
      title: padTitle(`Mistake ${i + 1}`, m),
      tagline: `Critical mistake ${i + 1} of 3 to avoid`,
      format: deepFormat,
      length_mode: length,
    });
  });

  checklist.forEach((c, i) => {
    editions.push({
      sequence_index: editions.length + 1,
      kind: "checklist",
      kind_index: i + 1,
      title: padTitle(`Checklist ${i + 1}`, c),
      tagline: `Action item ${i + 1} of 7`,
      format: length === "long" ? "in_depth" : "quick_insight",
      length_mode: length,
    });
  });

  return editions;
}

/** Append Profit System + industry fillers to reach target count (default 26). */
export function fillCascadeToYear(
  base: PlannedEdition[],
  opts: {
    targetCount?: number;
    industryLabel?: string | null;
    profitSystemTopics?: string[];
    industryTopics?: string[];
  }
): PlannedEdition[] {
  const target = opts.targetCount ?? 26;
  if (base.length >= target) return base.slice(0, target);

  const out = [...base];
  const profitDefaults = opts.profitSystemTopics?.length
    ? opts.profitSystemTopics
    : [
        "The P.R.O.F.I.T. System overview",
        "Business Blueprint: squeeze more from assets you already have",
        "13-week cashflow: stop the rollercoaster",
        "Team as profit enhancers (roles, KPIs, positional contracts)",
        "Pricing courage without losing clients",
      ];
  const industryDefaults = opts.industryTopics?.length
    ? opts.industryTopics
    : [
        opts.industryLabel
          ? `What ${opts.industryLabel} owners get wrong about profit`
          : "Industry myth: more revenue always means more profit",
        opts.industryLabel
          ? `${opts.industryLabel}: reclaiming 10 hours a week`
          : "Reclaiming 10 hours a week without dropping revenue",
        "The question clients ask me every week",
        "A client win (and what made it work)",
        "Timely POV: what I'm seeing in the market right now",
      ];

  let i = 0;
  while (out.length < target) {
    const useProfit = i % 2 === 0;
    const pool = useProfit ? profitDefaults : industryDefaults;
    const topic = pool[Math.floor(i / 2) % pool.length]!;
    out.push({
      sequence_index: out.length + 1,
      kind: useProfit ? "profit_system" : "industry",
      kind_index: null,
      title: topic,
      tagline: useProfit ? "Profit System edition" : "Industry / timely edition",
      format: i % 3 === 0 ? "timely_pov" : "quick_insight",
      length_mode: "short",
    });
    i += 1;
  }
  return out;
}

export function normalizeOverview537(raw: unknown): Overview537 {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const asList = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.map((x) => String(x ?? "").trim()).filter(Boolean)
      : [];
  return {
    strategies: asList(o.strategies).slice(0, 5),
    mistakes: asList(o.mistakes).slice(0, 3),
    checklist: asList(o.checklist).slice(0, 7),
  };
}
