import type { BlueprintBlock, BuiltSection } from "./types";

/**
 * Turns the written "Campaign messaging" section into Get Clients campaign
 * steps: an invite, then wait and message steps. Messages go out on "remind"
 * so the coach sees each one before it sends.
 */

export type HandoffVariant = "connector" | "conversation";

type Step = {
  position: number;
  step_type: "invite" | "wait" | "message";
  body?: string | null;
  wait_hours?: number | null;
  send_mode?: "auto" | "remind" | null;
};

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

// Hours to wait before each follow-up, from the classroom connector cadence.
const CONNECTOR_WAITS = [1, 24, 48, 96, 336];
const CONVERSATION_WAITS = [1, 72, 96, 120];

export function campaignStepsFromSection(
  section: BuiltSection,
  variant: HandoffVariant
): { name: string; steps: Step[] } | null {
  const blocks = section.blocks;
  const messages =
    variant === "connector"
      ? messagesUnder(blocks, (h) => h.includes("connector") || h.includes("campaign a"))
      : messagesUnder(blocks, (h) => h.includes("scorecard") || h.includes("campaign b") || h.includes("conversation"));
  if (!messages.length) return null;

  const steps: Step[] = [];
  let position = 0;
  // Connector: the first message is the connection request note. Conversation: blank invite.
  const [inviteNote, ...followUps] = variant === "connector" ? messages : ["", ...messages];
  steps.push({ position: position++, step_type: "invite", body: toCampaignTokens(inviteNote).slice(0, 300), send_mode: "auto" });
  const waits = variant === "connector" ? CONNECTOR_WAITS : CONVERSATION_WAITS;
  followUps.forEach((body, i) => {
    steps.push({ position: position++, step_type: "wait", wait_hours: waits[i] ?? 96, send_mode: "auto" });
    steps.push({ position: position++, step_type: "message", body: toCampaignTokens(body), send_mode: "remind" });
  });
  return {
    name: variant === "connector" ? "Blueprint · Connector campaign" : "Blueprint · Conversation into the scorecard",
    steps,
  };
}
