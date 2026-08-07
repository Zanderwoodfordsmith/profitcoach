import type {
  AvatarPayload,
  CampaignBrainKey,
  CampaignBrainSlice,
  IdealClientProfilePayload,
} from "./types";

/** Map confirmed avatar/profile slices into ai_context brain fields. */
export function buildBrainSliceFromAvatar(opts: {
  profile?: IdealClientProfilePayload | null;
  avatar?: AvatarPayload | null;
  keys: CampaignBrainKey[];
}): CampaignBrainSlice {
  const { profile, avatar, keys } = opts;
  const out: CampaignBrainSlice = {};
  const keySet = new Set(keys);

  if (keySet.has("ideal_client")) {
    const parts: string[] = [];
    if (profile?.oneLineSummary) parts.push(profile.oneLineSummary);
    if (profile?.targetMarket) {
      const tm = profile.targetMarket;
      parts.push(
        `Market: ${tm.industry} · ${tm.geography} · ${tm.teamSize} · ${tm.revenueRange}`
      );
    }
    if (avatar?.persona?.headline) parts.push(`Persona: ${avatar.persona.headline}`);
    if (parts.length) out.ideal_client = parts.join("\n");
  }

  if (keySet.has("industry_vocabulary") && avatar?.industryVocabulary) {
    const v = avatar.industryVocabulary;
    const lines = [
      v.customers && `customers → ${v.customers}`,
      v.staff && `staff → ${v.staff}`,
      v.jobs && `jobs → ${v.jobs}`,
      v.money && `money → ${v.money}`,
      ...(v.extra ?? []),
    ].filter(Boolean);
    if (lines.length) out.industry_vocabulary = lines.join("\n");
  }

  if (keySet.has("pain_language")) {
    const pains: string[] = [];
    for (const f of profile?.frustrationsTheySayOutLoud ?? []) pains.push(f);
    for (const f of profile?.whatKeepsThemAwakeAtNight ?? []) pains.push(f);
    if (avatar?.persona?.specificProblem?.text) {
      pains.push(avatar.persona.specificProblem.text);
    }
    if (pains.length) out.pain_language = pains.slice(0, 12).join("\n");
  }

  if (keySet.has("messaging_hooks")) {
    const hooks = [
      ...(profile?.coachPositioning?.messagingHooks ?? []),
      ...(avatar?.messagingHooks ?? []),
      ...(avatar?.mainDesires ?? []),
    ];
    if (hooks.length) out.messaging_hooks = hooks.slice(0, 10).join("\n");
  }

  if (keySet.has("proof_framing")) {
    const why = profile?.coachPositioning?.whyThisCoach ?? [];
    const stmt = profile?.coachPositioning?.positioningStatement;
    const parts = [stmt, ...why].filter(Boolean);
    if (parts.length) out.proof_framing = parts.join("\n");
  }

  return out;
}
