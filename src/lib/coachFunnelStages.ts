/**
 * The coach funnel (job 242): #0 Live, then Get calls, Win clients and Serve
 * clients, three steps each. Tells a market, message, sales, execution or
 * delivery problem apart instead of reading every miss as "BCA failed".
 * Safe for the browser; the loader is in coachFunnel.ts.
 */

export const FUNNEL_GROUPS = [
  { key: "live", label: "#0 Live" },
  { key: "get", label: "Get calls" },
  { key: "win", label: "Win clients" },
  { key: "serve", label: "Serve clients" },
] as const;

export const FUNNEL_STAGES = [
  { key: "live", group: "live", label: "Setup done, campaign running" },
  { key: "contacted", group: "get", label: "Contacted" },
  { key: "interested", group: "get", label: "Interested" },
  { key: "booked", group: "get", label: "Call booked" },
  { key: "first_showed", group: "win", label: "Constraint Call showed" },
  { key: "roadmap_showed", group: "win", label: "Roadmap call showed" },
  { key: "won", group: "win", label: "Client won" },
  { key: "started", group: "serve", label: "Started" },
  { key: "kept", group: "serve", label: "Kept 90 days" },
  { key: "case_study", group: "serve", label: "Case study" },
] as const;

export type FunnelStageKey = (typeof FUNNEL_STAGES)[number]["key"];

/** A count, or null when the app can't see that step yet (with why). */
export type FunnelCount = { n: number } | { n: null; why: string };

export type FunnelCounts = Record<FunnelStageKey, FunnelCount> & {
  /** Of the people contacted, how many accepted: splits a market problem from a message problem. */
  accepted: number;
};

export type ProblemKind = "execution" | "market" | "message" | "sales" | "delivery";

export const PROBLEM_LABEL: Record<ProblemKind, string> = {
  execution: "Execution",
  market: "Market",
  message: "Message",
  sales: "Sales",
  delivery: "Delivery",
};

export type FunnelVerdict =
  | { kind: ProblemKind; stage: FunnelStageKey; text: string }
  | { kind: null; stage: FunnelStageKey | null; text: string };

/**
 * Each step against the one before it: the rate we aim for, and how many
 * people the step before needs before the rate means anything. Rates follow
 * the Scoreboard targets (show rates eased from 100% to 80%).
 */
const CHECKS: {
  stage: FunnelStageKey;
  from: FunnelStageKey;
  target: number;
  minBase: number;
  kind: ProblemKind;
  text: (rate: string) => string;
}[] = [
  { stage: "interested", from: "contacted", target: 0.01, minBase: 300, kind: "message", text: (r) => `${r} of people contacted are interested (aim: 1%).` },
  { stage: "booked", from: "interested", target: 0.5, minBase: 6, kind: "sales", text: (r) => `${r} of interested people book a call (aim: 50%).` },
  { stage: "first_showed", from: "booked", target: 0.8, minBase: 5, kind: "sales", text: (r) => `${r} of booked calls show up (aim: 80%).` },
  { stage: "roadmap_showed", from: "first_showed", target: 0.8, minBase: 5, kind: "sales", text: (r) => `${r} of Constraint Calls go on to a Roadmap call (aim: 80%).` },
  { stage: "won", from: "roadmap_showed", target: 0.25, minBase: 4, kind: "sales", text: (r) => `${r} of Roadmap calls become clients (aim: 25%).` },
  { stage: "started", from: "won", target: 0.8, minBase: 3, kind: "delivery", text: (r) => `${r} of new clients have a first session logged (aim: 80%).` },
];

/** Below this share accepting the invite, the people (market) are the problem, not the words. */
const ACCEPT_TARGET = 0.2;

export function pct(n: number, of: number): string {
  if (!of) return "–";
  const p = (n / of) * 100;
  return `${p < 10 && p > 0 ? p.toFixed(1) : Math.round(p)}%`;
}

/**
 * The first step below target with enough people to judge, in funnel order
 * (an early step starves every step after it). Not live = execution.
 */
export function weakestStep(counts: FunnelCounts, liveCoaches: number, coaches: number): FunnelVerdict {
  if (coaches === 1 && liveCoaches === 0) {
    return { kind: "execution", stage: "live", text: "Not live yet: the campaign isn't running." };
  }
  if (coaches > 1 && liveCoaches < coaches / 2) {
    return { kind: "execution", stage: "live", text: `Only ${liveCoaches} of ${coaches} coaches are live.` };
  }
  for (const c of CHECKS) {
    const base = counts[c.from].n;
    const got = counts[c.stage].n;
    if (base === null || got === null) {
      const missing = counts[c.from].n === null ? counts[c.from] : counts[c.stage];
      return { kind: null, stage: c.stage, text: `Can't judge past here yet: ${"why" in missing ? missing.why : ""}` };
    }
    if (base < c.minBase) {
      return { kind: null, stage: c.from, text: `Too early to tell: ${base} at ${label(c.from)} so far (need ${c.minBase}).` };
    }
    if (got / base < c.target) {
      if (c.stage === "interested") {
        const accept = counts.accepted / base;
        if (accept < ACCEPT_TARGET) {
          return { kind: "market", stage: "contacted", text: `${pct(counts.accepted, base)} accept the invite (aim: 20%): the people may be wrong.` };
        }
      }
      return { kind: c.kind, stage: c.stage, text: c.text(pct(got, base)) };
    }
  }
  return { kind: null, stage: null, text: "Every step we can judge is on target." };
}

function label(key: FunnelStageKey): string {
  return FUNNEL_STAGES.find((s) => s.key === key)?.label.toLowerCase() ?? key;
}

/**
 * Add up several coaches' counts. A step is unknown if it is unknown for any
 * coach, so a rate never mixes coaches who mark their calls with those who don't.
 */
export function sumCounts(list: FunnelCounts[]): FunnelCounts {
  const out = { accepted: 0 } as FunnelCounts;
  for (const s of FUNNEL_STAGES) {
    const unknown = list.map((c) => c[s.key]).find((c) => c.n === null);
    out[s.key] = unknown ?? { n: list.reduce((a, c) => a + (c[s.key].n ?? 0), 0) };
  }
  out.accepted = list.reduce((a, c) => a + c.accepted, 0);
  return out;
}
