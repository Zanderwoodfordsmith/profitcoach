import type { BlueprintBlock, BuiltSection } from "./types";

/**
 * Turns a written campaign section into Get Clients campaign steps. The
 * connection campaign opens with an invite; the others are messages only, for
 * people already connected. Messages go out on "remind" so the coach sees each
 * one before it sends.
 */

type Step = {
  position: number;
  step_type: "invite" | "wait" | "message";
  body?: string | null;
  wait_hours?: number | null;
  send_mode?: "auto" | "remind" | null;
};

export type CampaignHandoff = {
  /** Short name the agent and the API use. */
  id: "connection" | "messaging" | "reactivation" | "nurture" | "reply_interested";
  /** The Blueprint section it comes from. */
  section: string;
  name: string;
  /** The sequence sits under a heading containing one of these (lower case). */
  headings: string[];
  /** note: the first message is the connection request. none: messages only. */
  invite: "note" | "none";
  /** Hours to wait before each message after the first one. */
  waits: number[];
};

export const CAMPAIGN_HANDOFFS: CampaignHandoff[] = [
  {
    id: "connection",
    section: "campaigns:messaging",
    name: "Blueprint · Connection campaign",
    // "connector" and "campaign a" match sections written before the split.
    headings: ["sequence", "connector", "campaign a"],
    invite: "note",
    // From the classroom connector cadence: 30 minutes, 1 day, 2 days, 4 days, 2 weeks.
    waits: [1, 24, 48, 96, 336],
  },
  { id: "messaging", section: "campaigns:conversation", name: "Blueprint · Messaging campaign", headings: ["sequence"], invite: "none", waits: [72, 96, 120] },
  { id: "reactivation", section: "campaigns:reactivation", name: "Blueprint · Reactivation", headings: ["sequence"], invite: "none", waits: [120, 336] },
  { id: "nurture", section: "campaigns:nurture", name: "Blueprint · Ongoing nurture", headings: ["sequence"], invite: "none", waits: [336, 336, 336] },
  { id: "reply_interested", section: "campaigns:interested", name: "Blueprint · Reply interested", headings: ["sequence"], invite: "none", waits: [48, 72] },
];

export function handoffForSection(key: string): CampaignHandoff | null {
  return CAMPAIGN_HANDOFFS.find((h) => h.section === key) ?? null;
}

/** Accepts the short id, or the names the agent used before the split. */
export function handoffById(id: string): CampaignHandoff | null {
  const alias: Record<string, CampaignHandoff["id"]> = { connector: "connection", conversation: "messaging" };
  const wanted = alias[id] ?? id;
  return CAMPAIGN_HANDOFFS.find((h) => h.id === wanted) ?? null;
}

/** {first_name} in the blueprint becomes {{first_name}} in the campaign builder. */
export function toCampaignTokens(text: string): string {
  return text.replace(/\{\{?\s*([a-z_]+)\s*\}?\}/gi, (_, name: string) => `{{${name.toLowerCase()}}}`);
}

function messagesUnder(blocks: BlueprintBlock[], match: (heading: string) => boolean): string[] {
  const out: string[] = [];
  let inside = false;
  for (const b of blocks) {
    if (b.type === "heading") inside = match(b.text.toLowerCase());
    else if (inside && b.type === "message") out.push(b.body);
  }
  return out;
}

/** The written messages for one campaign, in order, untrimmed. */
export function campaignMessages(handoff: CampaignHandoff, section: BuiltSection): string[] {
  return messagesUnder(section.blocks, (h) => handoff.headings.some((word) => h.includes(word)));
}

export function campaignPlan(
  handoff: CampaignHandoff,
  section: BuiltSection
): { name: string; steps: Step[] } | null {
  const messages = campaignMessages(handoff, section);
  if (!messages.length) return null;

  const steps: Step[] = [];
  let position = 0;
  let followUps = messages;
  if (handoff.invite === "note") {
    const [note, ...rest] = messages;
    steps.push({ position: position++, step_type: "invite", body: toCampaignTokens(note).slice(0, 300), send_mode: "auto" });
    followUps = rest;
  }
  followUps.forEach((body, i) => {
    // Messages-only campaigns send their first message when someone is added.
    const first = handoff.invite === "none" && i === 0;
    if (!first) {
      const wait = handoff.invite === "note" ? handoff.waits[i] : handoff.waits[i - 1];
      steps.push({ position: position++, step_type: "wait", wait_hours: wait ?? 96, send_mode: "auto" });
    }
    steps.push({ position: position++, step_type: "message", body: toCampaignTokens(body), send_mode: "remind" });
  });
  return { name: handoff.name, steps };
}
