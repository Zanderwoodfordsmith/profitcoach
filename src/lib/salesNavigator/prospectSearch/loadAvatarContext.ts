import type { AvatarPayload } from "@/lib/firstCampaign/types";
import { loadCoachAiContextRow } from "@/lib/profitCoachAi/loadCoachPromptContext";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ProspectSearchAvatarContext = {
  /** Short niche label for the industry field / prompt. */
  industryHint: string | null;
  /** Richer context block for the model. */
  avatarSummary: string | null;
  source: "avatar" | "icp" | "brain" | null;
};

function buildAvatarSummary(avatar: AvatarPayload): string {
  const lines: string[] = [];
  if (avatar.persona?.headline) lines.push(`Persona: ${avatar.persona.headline}`);
  if (avatar.persona?.personaName) {
    lines.push(`Name: ${avatar.persona.personaName}`);
  }
  if (avatar.persona?.demographics?.occupation) {
    lines.push(`Occupation: ${avatar.persona.demographics.occupation}`);
  }
  if (avatar.persona?.demographics?.location) {
    lines.push(`Location: ${avatar.persona.demographics.location}`);
  }
  if (avatar.persona?.demographics?.businessSize) {
    lines.push(`Business size: ${avatar.persona.demographics.businessSize}`);
  }
  if (avatar.persona?.specificProblem?.text) {
    lines.push(`Specific problem: "${avatar.persona.specificProblem.text}"`);
  }
  if (avatar.messagingHooks?.length) {
    lines.push(
      "Messaging hooks:",
      ...avatar.messagingHooks.slice(0, 6).map((h) => `- ${h}`)
    );
  }
  if (avatar.industryVocabulary) {
    const v = avatar.industryVocabulary;
    const vocab = [
      v.customers && `customers → ${v.customers}`,
      v.staff && `staff → ${v.staff}`,
      v.jobs && `jobs → ${v.jobs}`,
      v.money && `money → ${v.money}`,
    ].filter(Boolean);
    if (vocab.length) lines.push("Vocabulary:", ...vocab.map((x) => `- ${x}`));
  }
  return lines.join("\n") || "";
}

/**
 * Load ideal-avatar / ICP / AI-brain context for Sales Nav search suggestions.
 * Prefers First Campaign selected avatar, then ICP, then AI brain ideal_client.
 */
export async function loadProspectSearchAvatarContext(
  userId: string
): Promise<ProspectSearchAvatarContext> {
  const [brain, setupRes] = await Promise.all([
    loadCoachAiContextRow(userId),
    supabaseAdmin
      .from("coach_campaign_setup")
      .select("selected_avatar_id, selected_icp_id")
      .eq("coach_id", userId)
      .maybeSingle(),
  ]);

  const avatarId = setupRes.data?.selected_avatar_id as string | null;
  const icpId = setupRes.data?.selected_icp_id as string | null;

  if (avatarId) {
    const { data: avatarRow } = await supabaseAdmin
      .from("coach_avatars")
      .select("edited_payload, generated_payload")
      .eq("id", avatarId)
      .eq("coach_id", userId)
      .maybeSingle();
    const payload = (avatarRow?.edited_payload ??
      avatarRow?.generated_payload) as AvatarPayload | null;
    if (payload) {
      const occupation = payload.persona?.demographics?.occupation?.trim();
      const headline = payload.persona?.headline?.trim();
      return {
        industryHint: occupation || headline || null,
        avatarSummary: buildAvatarSummary(payload) || null,
        source: "avatar",
      };
    }
  }

  if (icpId) {
    const { data: icp } = await supabaseAdmin
      .from("coach_icps")
      .select("label, industry, geography, role_titles")
      .eq("id", icpId)
      .eq("coach_id", userId)
      .maybeSingle();
    if (icp) {
      const industry = (icp.industry as string | null)?.trim() || null;
      const label = (icp.label as string | null)?.trim() || null;
      const roles = Array.isArray(icp.role_titles)
        ? (icp.role_titles as string[]).filter(Boolean).slice(0, 6)
        : [];
      const lines = [
        label && `ICP: ${label}`,
        industry && `Industry: ${industry}`,
        icp.geography && `Geography: ${icp.geography}`,
        roles.length ? `Roles: ${roles.join(", ")}` : null,
      ].filter(Boolean);
      return {
        industryHint: industry || label,
        avatarSummary: lines.join("\n") || null,
        source: "icp",
      };
    }
  }

  const ideal = brain?.ideal_client?.trim() || null;
  if (ideal) {
    return {
      industryHint: ideal.split(/[.\n]/)[0]?.trim().slice(0, 120) || ideal.slice(0, 120),
      avatarSummary: [
        `Ideal client (AI brain): ${ideal.slice(0, 2000)}`,
        brain?.industry_vocabulary?.trim()
          ? `Industry vocabulary: ${brain.industry_vocabulary.trim().slice(0, 1000)}`
          : null,
        brain?.messaging_hooks?.trim()
          ? `Messaging hooks: ${brain.messaging_hooks.trim().slice(0, 1000)}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
      source: "brain",
    };
  }

  return { industryHint: null, avatarSummary: null, source: null };
}
