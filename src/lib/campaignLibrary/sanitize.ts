import type { CampaignStepInput } from "@/lib/unipile/campaigns";
import {
  campaignStepAllowsVariants,
  campaignStepStoresBody,
  defaultStepConfig,
  isCampaignStepType,
  keepAbPair,
  parseManualFallbackHours,
  sanitizeMessageMediaPatch,
  sanitizeStepConfig,
  type CampaignStepType,
} from "@/lib/unipile/campaignStepTypes";
import { clampWaitHours } from "@/lib/unipile/waitDuration";
import {
  clampDailyLimit,
  DAILY_INVITE_LIMIT_MAX,
  DAILY_MESSAGE_LIMIT_MAX,
  DAILY_REACT_LIMIT_MAX,
  DEFAULT_CAMPAIGN_SEND_RULES,
  parseCampaignSendRules,
} from "@/lib/unipile/campaignSendWindow";
import {
  DEFAULT_LIBRARY_ITEM_NAME,
  isCampaignLibraryItemType,
  isCampaignLibraryKind,
  isCampaignLibraryStatus,
  type CampaignLibraryItemType,
  type CampaignLibraryKind,
  type CampaignLibraryStatus,
  type CampaignLibraryTemplateSettings,
  type CampaignLibraryItemSettings,
} from "@/lib/campaignLibrary/types";

export function blankLibraryMessageStep(): CampaignStepInput {
  return {
    position: 0,
    step_type: "message",
    body: "",
    wait_hours: null,
    variants: [],
    send_mode: "auto",
    fallback_hours: null,
    fallback_body: null,
    config: defaultStepConfig("message"),
  };
}

export function defaultLibraryTemplateSettings(): CampaignLibraryTemplateSettings {
  return {
    stop_on_reply: true,
    daily_invite_limit: 20,
    daily_message_limit: 20,
    daily_react_limit: 20,
    timezone: "Europe/London",
    send_rules: DEFAULT_CAMPAIGN_SEND_RULES.map((row) => ({ ...row })),
    manual_fallback_hours: null,
  };
}

export function sanitizeLibraryItemSettings(
  itemType: CampaignLibraryItemType,
  raw: unknown
): CampaignLibraryItemSettings {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const manualFallbackHours = parseManualFallbackHours(
    source.manual_fallback_hours
  );
  if (itemType !== "template") {
    return manualFallbackHours == null
      ? {}
      : { manual_fallback_hours: manualFallbackHours };
  }
  const defaults = defaultLibraryTemplateSettings();
  const timezone =
    typeof source.timezone === "string" && source.timezone.trim()
      ? source.timezone.trim()
      : defaults.timezone;
  return {
    stop_on_reply: source.stop_on_reply !== false,
    daily_invite_limit: clampDailyLimit(
      source.daily_invite_limit,
      DAILY_INVITE_LIMIT_MAX,
      defaults.daily_invite_limit
    ),
    daily_message_limit: clampDailyLimit(
      source.daily_message_limit,
      DAILY_MESSAGE_LIMIT_MAX,
      defaults.daily_message_limit
    ),
    daily_react_limit: clampDailyLimit(
      source.daily_react_limit,
      DAILY_REACT_LIMIT_MAX,
      defaults.daily_react_limit
    ),
    timezone,
    send_rules: parseCampaignSendRules(source.send_rules),
    manual_fallback_hours: manualFallbackHours,
  };
}

export function parseLibraryItemType(
  value: unknown
): CampaignLibraryItemType | null {
  return isCampaignLibraryItemType(value) ? value : null;
}

export function parseLibraryKind(value: unknown): CampaignLibraryKind | null {
  return isCampaignLibraryKind(value) ? value : null;
}

export function parseLibraryStatus(
  value: unknown
): CampaignLibraryStatus | null {
  return isCampaignLibraryStatus(value) ? value : null;
}

export function normalizeLibraryName(
  itemType: CampaignLibraryItemType,
  name: unknown
): string {
  if (typeof name !== "string") return DEFAULT_LIBRARY_ITEM_NAME[itemType];
  return name.trim() || DEFAULT_LIBRARY_ITEM_NAME[itemType];
}

function stripLiveCampaignRefs(
  type: CampaignStepType,
  config: Record<string, unknown>
): Record<string, unknown> {
  if (type === "add_to_campaign") {
    return { campaign_id: null };
  }
  if (type === "invite") {
    return {
      ...config,
      on_no_connect: "none",
      no_connect_wait_hours: null,
      no_connect_campaign_id: null,
    };
  }
  return config;
}

export function cleanLibraryStep(
  step: CampaignStepInput,
  position: number
): CampaignStepInput | null {
  if (!isCampaignStepType(step.step_type)) return null;
  const sendMode =
    step.step_type === "message" && step.send_mode === "remind"
      ? "remind"
      : "auto";
  const fallbackHours =
    sendMode === "remind" && step.fallback_hours != null
      ? Math.max(1, Math.min(720, Number(step.fallback_hours)))
      : null;
  const config = stripLiveCampaignRefs(
    step.step_type,
    sanitizeStepConfig(step.step_type, step.config)
  );
  return {
    position,
    step_type: step.step_type,
    body: campaignStepStoresBody(step.step_type)
      ? (step.body ?? "").slice(0, 16000)
      : null,
    wait_hours:
      step.step_type === "wait"
        ? clampWaitHours(Number(step.wait_hours ?? 24))
        : null,
    variants:
      campaignStepAllowsVariants(step.step_type) &&
      Array.isArray(step.variants) &&
      step.variants.length
        ? keepAbPair(
            step.variants
              .filter((v) => v?.key)
              .map((v) => {
                const media = sanitizeMessageMediaPatch({
                  media_kind: v.media_kind,
                  media: v.media,
                });
                return {
                  key: String(v.key).slice(0, 32),
                  label: v.label ? String(v.label).slice(0, 120) : undefined,
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
      sendMode === "remind" && step.fallback_body
        ? String(step.fallback_body).slice(0, 16000)
        : null,
    config,
  };
}

export function normalizeLibrarySteps(
  itemType: CampaignLibraryItemType,
  steps: CampaignStepInput[]
): CampaignStepInput[] {
  const cleaned = steps
    .map((step, index) => cleanLibraryStep(step, index))
    .filter((step): step is CampaignStepInput => step != null);
  if (itemType === "step") {
    const one = cleaned[0] ?? blankLibraryMessageStep();
    return [{ ...one, position: 0 }];
  }
  return cleaned.map((step, index) => ({ ...step, position: index }));
}
