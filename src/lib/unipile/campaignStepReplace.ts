import {
  campaignStepAllowsVariants,
  campaignStepStoresBody,
  isCampaignStepType,
  keepAbPair,
  sanitizeMessageMediaPatch,
  sanitizeStepConfig,
  type CampaignStepMedia,
  type CampaignStepMediaKind,
  type CampaignStepType,
} from "@/lib/unipile/campaignStepTypes";
import { clampWaitHours } from "@/lib/unipile/waitDuration";

const STEP_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StepInput = {
  id?: string;
  position?: number;
  step_type: string;
  body?: string | null;
  wait_hours?: number | null;
  variants?: Array<{
    key: string;
    label?: string;
    body: string;
    media_kind?: CampaignStepMediaKind | null;
    media?: CampaignStepMedia | null;
  }> | null;
  send_mode?: "auto" | "remind" | null;
  fallback_hours?: number | null;
  fallback_body?: string | null;
  config?: Record<string, unknown> | null;
};

export type CleanedCampaignStep = {
  id?: string;
  position: number;
  step_type: CampaignStepType;
  body: string | null;
  wait_hours: number | null;
  variants: NonNullable<StepInput["variants"]>;
  send_mode: "auto" | "remind";
  fallback_hours: number | null;
  fallback_body: string | null;
  config: ReturnType<typeof sanitizeStepConfig>;
};

/** Sanitize steps for replace_linkedin_campaign_steps. Positions are 0..n. */
export function cleanCampaignStepsForSave(
  steps: StepInput[]
): CleanedCampaignStep[] {
  const seenIds = new Set<string>();
  const cleaned: CleanedCampaignStep[] = [];
  for (const s of steps) {
    if (!isCampaignStepType(s.step_type)) continue;
    const sendMode =
      s.step_type === "message" && s.send_mode === "remind"
        ? "remind"
        : "auto";
    const fallbackHours =
      sendMode === "remind" && s.fallback_hours != null
        ? Math.max(1, Math.min(720, Number(s.fallback_hours)))
        : null;
    const rawId = typeof s.id === "string" ? s.id.trim() : "";
    const idKey = rawId.toLowerCase();
    const id =
      STEP_ID_RE.test(rawId) && !seenIds.has(idKey) ? rawId : undefined;
    if (id) seenIds.add(idKey);
    cleaned.push({
      ...(id ? { id } : {}),
      position: cleaned.length,
      step_type: s.step_type,
      body: campaignStepStoresBody(s.step_type)
        ? (s.body ?? "").slice(0, 16000)
        : null,
      wait_hours:
        s.step_type === "wait"
          ? clampWaitHours(Number(s.wait_hours ?? 24))
          : null,
      variants:
        campaignStepAllowsVariants(s.step_type) &&
        Array.isArray(s.variants) &&
        s.variants.length
          ? keepAbPair(
              s.variants
                .filter((v) => v?.key)
                .map((v) => {
                  const media = sanitizeMessageMediaPatch({
                    media_kind: v.media_kind,
                    media: v.media,
                  });
                  return {
                    key: String(v.key).slice(0, 32),
                    label: v.label
                      ? String(v.label).slice(0, 120)
                      : undefined,
                    body: String(v.body ?? "").slice(0, 16000),
                    media_kind: media.media_kind,
                    media: media.media,
                  };
                })
            )
          : [],
      send_mode: sendMode,
      fallback_hours: fallbackHours,
      fallback_body:
        sendMode === "remind" && s.fallback_body
          ? String(s.fallback_body).slice(0, 16000)
          : null,
      config: sanitizeStepConfig(s.step_type, s.config),
    });
  }
  return cleaned;
}
