import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBlueprintContext } from "@/lib/practiceKnowledge/blueprintContext";
import { blocksToMarkdown, sanitizeBuiltSections } from "@/lib/practiceKnowledge/blocks";
import {
  CAMPAIGN_HANDOFFS,
  campaignMessages,
  campaignPlan,
  handoffById,
  toCampaignTokens,
  type CampaignHandoff,
} from "@/lib/practiceKnowledge/campaignHandoff";
import { replaceCampaignSteps, type CampaignStepInput } from "@/lib/unipile/campaigns";

import type { AgentToolContext, AgentToolDef, AgentToolInput, GateDecision } from "../types";
import { loadCampaignRow } from "./campaigns";
import { AgentToolError, coachOf, plural, str } from "./util";

/** Writing a campaign's sequence, from scratch or from the Practice Blueprint. */

const WRITABLE_STEP_TYPES = ["invite", "wait", "message", "email", "visit", "follow"] as const;
type WritableStepType = (typeof WRITABLE_STEP_TYPES)[number];

/** LinkedIn rejects connection notes over 300 characters. */
export const INVITE_NOTE_MAX = 300;

type DraftStep = {
  step_type: WritableStepType;
  body?: string;
  variant_b?: string;
  wait_hours?: number;
  send_mode?: "auto" | "remind";
};

/** Turn the model's draft steps into builder steps, or explain what is wrong. */
export function stepsFromDraft(raw: unknown): { steps: CampaignStepInput[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: "Pass at least one step." };
  if (raw.length > 30) return { error: "Thirty steps is the most a sequence can have." };
  const steps: CampaignStepInput[] = [];
  for (const [index, entry] of raw.entries()) {
    if (!entry || typeof entry !== "object") return { error: `Step ${index + 1} is not an object.` };
    const draft = entry as DraftStep;
    if (!WRITABLE_STEP_TYPES.includes(draft.step_type)) {
      return { error: `Step ${index + 1}: step_type must be one of ${WRITABLE_STEP_TYPES.join(", ")}.` };
    }
    if (draft.step_type === "invite" && index !== 0) {
      return { error: "The invite (connection request) must be the first step." };
    }
    if (draft.step_type === "wait") {
      const hours = Number(draft.wait_hours);
      if (!Number.isFinite(hours) || hours <= 0) return { error: `Step ${index + 1}: a wait needs wait_hours.` };
      steps.push({ position: index, step_type: "wait", wait_hours: hours });
      continue;
    }
    const body = toCampaignTokens(typeof draft.body === "string" ? draft.body.trim() : "");
    const variantB =
      typeof draft.variant_b === "string" && draft.variant_b.trim()
        ? toCampaignTokens(draft.variant_b.trim())
        : null;
    if ((draft.step_type === "message" || draft.step_type === "email") && !body) {
      return { error: `Step ${index + 1}: a ${draft.step_type} needs a body.` };
    }
    if (draft.step_type === "invite") {
      for (const [label, text] of [["Invite note", body], ["Invite note B", variantB ?? ""]] as const) {
        if (text.length > INVITE_NOTE_MAX) {
          return { error: `${label} is ${text.length} characters. LinkedIn allows ${INVITE_NOTE_MAX}; aim for under 275.` };
        }
      }
    }
    steps.push({
      position: index,
      step_type: draft.step_type,
      body,
      send_mode: draft.step_type === "message" && draft.send_mode !== "auto" ? "remind" : "auto",
      variants: variantB
        ? [
            { key: "A", label: "A", body },
            { key: "B", label: "B", body: variantB },
          ]
        : null,
    });
  }
  return { steps };
}

function summariseSteps(steps: CampaignStepInput[]): string {
  const messages = steps.filter((s) => s.step_type !== "wait").length;
  const days = steps.reduce((sum, s) => sum + (s.step_type === "wait" ? Number(s.wait_hours ?? 0) : 0), 0) / 24;
  return `${plural(messages, "step")} over about ${Math.max(1, Math.round(days))} days`;
}

async function stepsGate(
  ctx: AgentToolContext,
  campaignId: string,
  steps: CampaignStepInput[]
): Promise<GateDecision> {
  const coach = coachOf(ctx);
  const campaign = await loadCampaignRow(coach.id, campaignId);
  if (campaign.status !== "running") return { confirm: false };
  return {
    confirm: true,
    title: `Rewrite the messages in ${campaign.name}`,
    details: [
      { label: "For", value: coach.name },
      { label: "New sequence", value: summariseSteps(steps) },
    ],
    warning: "The campaign is on. People part-way through get the new messages from their next step.",
  };
}

async function blueprintSteps(coachId: string, handoff: CampaignHandoff) {
  const { data } = await supabaseAdmin
    .from("coach_practice_knowledge")
    .select("built_sections")
    .eq("coach_id", coachId)
    .maybeSingle();
  const section = sanitizeBuiltSections(data?.built_sections ?? {})[handoff.section];
  if (!section) throw new AgentToolError(`The coach's blueprint has no ${handoff.id.replace("_", " ")} campaign written yet.`);
  const messages = campaignMessages(handoff, section);
  const plan = campaignPlan(handoff, section);
  if (!plan || !messages.length) {
    throw new AgentToolError(`The blueprint's ${handoff.id.replace("_", " ")} campaign has no messages. Rewrite that section first.`);
  }
  // The hand-off cuts long notes mid-word. Never save a cut note: hand the
  // messages back so the agent can shorten the note and use write_campaign_steps.
  const note = handoff.invite === "note" ? toCampaignTokens(messages[0] ?? "") : "";
  if (note.length > INVITE_NOTE_MAX) {
    throw new AgentToolError(
      `The blueprint's connection note is ${note.length} characters; LinkedIn allows ${INVITE_NOTE_MAX}. ` +
        `Nothing was saved. Shorten the note to under 275 characters, keep the rest, and save with write_campaign_steps ` +
        `(invite, then waits of 1, 24, 48, 96 and 336 hours before each follow-up, follow-ups on remind). ` +
        `The blueprint messages, in order: ${JSON.stringify(messages.map(toCampaignTokens))}`
    );
  }
  return plan.steps as CampaignStepInput[];
}

/** Which Blueprint campaign to use. `variant` is the name used before the campaigns were split. */
function handoffOf(input: AgentToolInput): CampaignHandoff {
  const handoff = handoffById(str(input, "campaign") || str(input, "variant") || "connection");
  if (!handoff) throw new AgentToolError(`Unknown campaign. Use one of: ${CAMPAIGN_HANDOFFS.map((h) => h.id).join(", ")}.`);
  return handoff;
}

function trimmed(text: unknown, max: number): string | null {
  if (typeof text !== "string" || !text.trim()) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export const messagingTools: AgentToolDef[] = [
  {
    name: "get_coach_brain",
    label: "Reading what we know about the coach",
    needsCoach: true,
    description:
      "What we know about the active coach for writing. The Practice Blueprint (their answers, voice and tone, offer, proof, and written guides) is the source of truth; the older brain fields fill gaps.",
    input_schema: { type: "object", properties: {} },
    run: async (_input, ctx) => {
      const coach = coachOf(ctx);
      const [{ data: profile }, { data: practice }, blueprint] = await Promise.all([
        supabaseAdmin.from("profiles").select("ai_context, full_name, location").eq("id", coach.id).maybeSingle(),
        supabaseAdmin.from("coach_practice_knowledge").select("built_sections").eq("coach_id", coach.id).maybeSingle(),
        loadBlueprintContext(coach.id),
      ]);
      const brain = (profile?.ai_context ?? {}) as Record<string, unknown>;
      const built = sanitizeBuiltSections(practice?.built_sections ?? {});
      const section = (key: string) => {
        const blocks = built[key]?.blocks;
        return blocks?.length ? trimmed(blocksToMarkdown(blocks), 3_500) : null;
      };
      const results = Array.isArray(brain.client_results) ? brain.client_results : [];
      return {
        coach: profile?.full_name ?? coach.name,
        location: profile?.location ?? null,
        ideal_client: trimmed(brain.ideal_client, 1_500),
        industry_vocabulary: trimmed(brain.industry_vocabulary, 800),
        pain_language: trimmed(brain.pain_language, 1_500),
        messaging_hooks: trimmed(brain.messaging_hooks, 1_000),
        proof_framing: trimmed(brain.proof_framing, 1_000),
        superpowers: trimmed(brain.superpowers, 1_000),
        client_results: results.slice(0, 6).map((r) => {
          const row = (r ?? {}) as Record<string, unknown>;
          return { title: trimmed(row.title, 200), story: trimmed(row.story, 600) };
        }),
        blueprint_avatar: section("market:avatar"),
        blueprint_pain_points: section("market:pains"),
        blueprint_campaign_messaging: section("campaigns:messaging"),
        blueprint_messaging_campaign: section("campaigns:conversation"),
        blueprint_reactivation: section("campaigns:reactivation"),
        blueprint: blueprint || null,
      };
    },
  },
  {
    name: "use_blueprint_messaging",
    label: "Bringing in the blueprint messages",
    needsCoach: true,
    description:
      'Replace a campaign\'s steps with one of the coach\'s Practice Blueprint campaigns. campaign: "connection" (connection note and five follow-ups, for new 2nd and 3rd degree owners), "messaging" (messages only, a conversation into the BOSS Scorecard for connections who fit), or "reactivation" (messages only, for people the coach already knows). Messages go on remind. Nurture and replies to people who said yes are not written per coach: use the Ongoing nurture and Positive replies templates from list_campaign_templates.',
    input_schema: {
      type: "object",
      properties: {
        campaign_id: { type: "string" },
        campaign: { type: "string", enum: CAMPAIGN_HANDOFFS.map((h) => h.id) },
      },
      required: ["campaign_id", "campaign"],
    },
    gate: async (input, ctx) => {
      const steps = await blueprintSteps(coachOf(ctx).id, handoffOf(input));
      return stepsGate(ctx, str(input, "campaign_id"), steps);
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const campaign = await loadCampaignRow(coach.id, str(input, "campaign_id"));
      const steps = await blueprintSteps(coach.id, handoffOf(input));
      await replaceCampaignSteps(campaign.id, steps);
      return { campaign: campaign.name, steps: steps.length, summary: summariseSteps(steps) };
    },
  },
  {
    name: "write_campaign_steps",
    label: "Saving the messages",
    needsCoach: true,
    description:
      "Replace a campaign's whole sequence. Steps in order: an optional invite first (connection note, under 275 characters, can be blank), then wait (wait_hours) and message steps. Messages default to remind (the coach approves each one); pass send_mode auto to send automatically. variant_b adds an A/B test. Use {{first_name}}, {{company}}, {{title}}, {{location}}. Asks for confirmation when the campaign is running.",
    input_schema: {
      type: "object",
      properties: {
        campaign_id: { type: "string" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              step_type: { type: "string", enum: [...WRITABLE_STEP_TYPES] },
              body: { type: "string" },
              variant_b: { type: "string", description: "Optional B version for an A/B test" },
              wait_hours: { type: "number", description: "Wait steps only" },
              send_mode: { type: "string", enum: ["auto", "remind"] },
            },
            required: ["step_type"],
          },
        },
      },
      required: ["campaign_id", "steps"],
    },
    gate: async (input, ctx) => {
      const parsed = stepsFromDraft(input.steps);
      if ("error" in parsed) return { error: parsed.error };
      return stepsGate(ctx, str(input, "campaign_id"), parsed.steps);
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const campaign = await loadCampaignRow(coach.id, str(input, "campaign_id"));
      const parsed = stepsFromDraft(input.steps);
      if ("error" in parsed) throw new AgentToolError(parsed.error);
      await replaceCampaignSteps(campaign.id, parsed.steps);
      return { campaign: campaign.name, steps: parsed.steps.length, summary: summariseSteps(parsed.steps) };
    },
  },
];
