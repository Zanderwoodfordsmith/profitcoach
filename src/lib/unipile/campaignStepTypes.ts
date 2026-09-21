import { clampWaitHours } from "@/lib/unipile/waitDuration";

export const CAMPAIGN_STEP_TYPES = [
  "invite",
  "message",
  "wait",
  "comment",
  "react",
  "visit",
  "follow",
  "email",
  "whatsapp",
  "instagram",
  "instagram_react",
  "instagram_comment",
  "instagram_follow",
  "messenger",
  "notify",
  "add_to_campaign",
  "call",
] as const;

export type CampaignStepType = (typeof CAMPAIGN_STEP_TYPES)[number];

const STEP_TYPE_SET = new Set<string>(CAMPAIGN_STEP_TYPES);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCampaignStepType(value: string): value is CampaignStepType {
  return STEP_TYPE_SET.has(value);
}

export type NotifyStepConfig = {
  in_app: boolean;
  email: boolean;
  whatsapp: boolean;
};

export type AddToCampaignStepConfig = {
  campaign_id: string | null;
};

export type CallStepConfig = {
  wait: boolean;
};

export type CampaignStepMediaKind = "voice" | "video";

export type CampaignStepMedia = {
  kind: CampaignStepMediaKind;
  path: string;
  mime: string;
  filename: string;
  size: number;
};

export type MessageStepConfig = {
  media_kind: CampaignStepMediaKind | null;
  media: CampaignStepMedia | null;
};

export type InviteNoConnectAction = "none" | "other_campaign";

export type InviteStepConfig = {
  on_no_connect: InviteNoConnectAction;
  no_connect_wait_hours: number | null;
  no_connect_campaign_id: string | null;
};

export type CampaignStepConfig = NotifyStepConfig &
  AddToCampaignStepConfig &
  CallStepConfig &
  MessageStepConfig &
  InviteStepConfig;

const EMPTY_CONFIG: CampaignStepConfig = {
  in_app: false,
  email: false,
  whatsapp: false,
  campaign_id: null,
  wait: false,
  media_kind: null,
  media: null,
  on_no_connect: "none",
  no_connect_wait_hours: null,
  no_connect_campaign_id: null,
};

export function defaultStepConfig(type: CampaignStepType): CampaignStepConfig {
  if (type === "notify") {
    return { ...EMPTY_CONFIG, in_app: true };
  }
  return { ...EMPTY_CONFIG };
}

function asMediaKind(value: unknown): CampaignStepMediaKind | null {
  return value === "voice" || value === "video" ? value : null;
}

function sanitizeMedia(raw: Record<string, unknown>): CampaignStepMedia | null {
  const kind = asMediaKind(raw.kind);
  const path = typeof raw.path === "string" ? raw.path.trim() : "";
  if (!kind || !path || path.includes("..") || path.length > 500) return null;
  const mime = typeof raw.mime === "string" ? raw.mime.trim().slice(0, 120) : "";
  const filename =
    typeof raw.filename === "string" ? raw.filename.trim().slice(0, 200) : "";
  const size = typeof raw.size === "number" && Number.isFinite(raw.size) ? raw.size : 0;
  return {
    kind,
    path,
    mime: mime || "application/octet-stream",
    filename: filename || path.split("/").pop() || "file",
    size: Math.max(0, Math.round(size)),
  };
}

export function sanitizeMessageMediaPatch(raw: {
  media_kind?: unknown;
  media?: unknown;
}): {
  media_kind: CampaignStepMediaKind | null;
  media: CampaignStepMedia | null;
} {
  const mediaRaw =
    raw.media && typeof raw.media === "object" && !Array.isArray(raw.media)
      ? (raw.media as Record<string, unknown>)
      : null;
  const media = mediaRaw ? sanitizeMedia(mediaRaw) : null;
  return {
    media_kind: media?.kind ?? asMediaKind(raw.media_kind),
    media,
  };
}

export function messageSendConfigFrom(
  stepConfig: unknown,
  variant?: {
    media_kind?: CampaignStepMediaKind | null;
    media?: CampaignStepMedia | null;
  } | null
): unknown {
  if (
    variant &&
    (variant.media_kind !== undefined || variant.media !== undefined)
  ) {
    return {
      media_kind: variant.media_kind ?? null,
      media: variant.media ?? null,
    };
  }
  return stepConfig;
}

export function sanitizeStepConfig(
  type: CampaignStepType,
  config: unknown
): Record<string, unknown> {
  const raw =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  if (type === "notify") {
    const inApp = raw.in_app !== false;
    const email = Boolean(raw.email);
    const whatsapp = Boolean(raw.whatsapp);
    return {
      in_app: inApp || (!email && !whatsapp),
      email,
      whatsapp,
    };
  }
  if (type === "add_to_campaign") {
    const id =
      typeof raw.campaign_id === "string" ? raw.campaign_id.trim() : "";
    return { campaign_id: UUID_RE.test(id) ? id : null };
  }
  if (type === "call") {
    return { wait: raw.wait === true };
  }
  if (type === "message") {
    return sanitizeMessageMediaPatch({
      media_kind: raw.media_kind,
      media: raw.media,
    });
  }
  if (type === "invite") {
    const action: InviteNoConnectAction =
      raw.on_no_connect === "other_campaign" ? "other_campaign" : "none";
    const id =
      typeof raw.no_connect_campaign_id === "string"
        ? raw.no_connect_campaign_id.trim()
        : "";
    const waitRaw = Number(raw.no_connect_wait_hours);
    return {
      on_no_connect: action,
      no_connect_wait_hours:
        action === "other_campaign"
          ? clampWaitHours(
              Number.isFinite(waitRaw) && waitRaw > 0 ? waitRaw : 24 * 7
            )
          : null,
      no_connect_campaign_id:
        action === "other_campaign" && UUID_RE.test(id) ? id : null,
    };
  }
  return {};
}

export function notifyConfigFrom(
  config: unknown
): NotifyStepConfig {
  const raw =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  const email = Boolean(raw.email);
  const whatsapp = Boolean(raw.whatsapp);
  return {
    in_app: raw.in_app !== false,
    email,
    whatsapp,
  };
}

export function addToCampaignIdFrom(config: unknown): string | null {
  const raw =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  const id =
    typeof raw.campaign_id === "string" ? raw.campaign_id.trim() : "";
  return UUID_RE.test(id) ? id : null;
}

export function messageMediaFrom(config: unknown): CampaignStepMedia | null {
  const raw =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  const mediaRaw =
    raw.media && typeof raw.media === "object" && !Array.isArray(raw.media)
      ? (raw.media as Record<string, unknown>)
      : null;
  return mediaRaw ? sanitizeMedia(mediaRaw) : null;
}

export function messageMediaKindFrom(
  config: unknown
): CampaignStepMediaKind | null {
  const media = messageMediaFrom(config);
  if (media) return media.kind;
  const raw =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  return asMediaKind(raw.media_kind);
}

export function inviteNoConnectFrom(config: unknown): InviteStepConfig {
  const sanitized = sanitizeStepConfig("invite", config);
  return {
    on_no_connect:
      sanitized.on_no_connect === "other_campaign" ? "other_campaign" : "none",
    no_connect_wait_hours:
      typeof sanitized.no_connect_wait_hours === "number"
        ? sanitized.no_connect_wait_hours
        : null,
    no_connect_campaign_id:
      typeof sanitized.no_connect_campaign_id === "string"
        ? sanitized.no_connect_campaign_id
        : null,
  };
}

/** True only when the coach opted in. Missing config means the sequence carries on. */
export function callWaitFrom(config: unknown): boolean {
  const raw =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  return raw.wait === true;
}

export function notifyChannelSummary(config: unknown): string {
  const channels = notifyConfigFrom(config);
  const labels: string[] = [];
  if (channels.in_app) labels.push("Notification");
  if (channels.email) labels.push("Email");
  if (channels.whatsapp) labels.push("WhatsApp");
  return labels.length ? labels.join(" · ") : "No channel yet";
}

export function campaignStepTypeLabel(type: string): string {
  switch (type) {
    case "invite":
      return "Connection request";
    case "react":
      return "Like post";
    case "comment":
      return "Comment";
    case "message":
      return "LinkedIn message";
    case "wait":
      return "Wait";
    case "visit":
      return "View profile";
    case "follow":
      return "Follow";
    case "email":
      return "Email";
    case "whatsapp":
      return "WhatsApp";
    case "instagram":
      return "Instagram message";
    case "instagram_react":
      return "Instagram like";
    case "instagram_comment":
      return "Instagram comment";
    case "instagram_follow":
      return "Instagram follow";
    case "messenger":
      return "Messenger";
    case "notify":
      return "Notify me";
    case "add_to_campaign":
      return "Add to other campaign";
    case "call":
      return "Phone call";
    default:
      return type;
  }
}

export function campaignStepDisplayLabel(
  type: string,
  config?: unknown,
  variants?: Array<{ media_kind?: CampaignStepMediaKind | null }> | null
): string {
  if (type === "message") {
    if (variants && variants.length > 0) {
      const kinds = new Set(
        variants.map((variant) => variant.media_kind ?? null)
      );
      if (kinds.size === 1) {
        const kind = [...kinds][0];
        if (kind === "voice") return "Voice note";
        if (kind === "video") return "Video message";
      } else {
        return "A/B message";
      }
    }
    const kind = messageMediaKindFrom(config);
    if (kind === "voice") return "Voice note";
    if (kind === "video") return "Video message";
  }
  return campaignStepTypeLabel(type);
}

function stepHasCopy(
  body: string | null | undefined,
  variants?: Array<{ body: string }> | null
): boolean {
  if (variants && variants.length > 0) {
    return variants.some((v) => v.body.trim().length > 0);
  }
  return Boolean((body ?? "").trim());
}

/** Collapsed-card hint when a message, voice, or video step is still empty. */
export function campaignStepIncompleteHint(input: {
  step_type: string;
  body?: string | null;
  variants?: Array<{
    body: string;
    media_kind?: CampaignStepMediaKind | null;
    media?: CampaignStepMedia | null;
  }> | null;
  config?: unknown;
}): string | null {
  if (input.step_type !== "message") return null;
  if (input.variants && input.variants.length > 0) {
    for (const variant of input.variants) {
      if (variant.media_kind === "voice" && !variant.media) {
        return "You need to add a voice note";
      }
      if (variant.media_kind === "video" && !variant.media) {
        return "You need to add a video";
      }
      if (!variant.media_kind && !variant.body.trim()) {
        return "You need to add a message";
      }
    }
    return null;
  }
  const kind = messageMediaKindFrom(input.config);
  const media = messageMediaFrom(input.config);
  if (kind === "voice" && !media) return "You need to add a voice note";
  if (kind === "video" && !media) return "You need to add a video";
  if (!kind && !stepHasCopy(input.body, input.variants)) {
    return "You need to add a message";
  }
  return null;
}

/** Steps whose body is copy the coach writes to the prospect. */
export function campaignStepHasCopy(type: string): boolean {
  return (
    type === "message" ||
    type === "comment" ||
    type === "invite" ||
    type === "email" ||
    type === "whatsapp" ||
    type === "instagram" ||
    type === "instagram_comment" ||
    type === "messenger"
  );
}

export function campaignStepOpensEditor(type: string): boolean {
  return (
    campaignStepHasCopy(type) ||
    type === "wait" ||
    type === "notify" ||
    type === "add_to_campaign" ||
    type === "call"
  );
}

export function campaignStepStoresBody(type: string): boolean {
  return (
    type !== "wait" &&
    type !== "react" &&
    type !== "visit" &&
    type !== "follow" &&
    type !== "instagram_react" &&
    type !== "instagram_follow" &&
    type !== "notify" &&
    type !== "add_to_campaign"
  );
}

export function campaignStepAllowsVariants(type: string): boolean {
  return (
    type === "message" ||
    type === "invite" ||
    type === "email" ||
    type === "whatsapp" ||
    type === "instagram" ||
    type === "messenger"
  );
}

/** A/B is two versions. Extra keys (C, D, …) are dropped. */
export function keepAbPair<T extends { key: string }>(variants: T[]): T[] {
  const byKey = new Map(variants.map((variant) => [variant.key, variant]));
  return ["A", "B"].flatMap((key) => {
    const variant = byKey.get(key);
    return variant ? [variant] : [];
  });
}

/** LinkedIn messages (text, voice, video) can send automatically or wait for the coach. */
export type CampaignSendMode = "auto" | "remind";

export function campaignStepHasSendMode(type: string): boolean {
  return type === "message";
}

export function campaignStepSendMode(
  sendMode: string | null | undefined
): CampaignSendMode {
  return sendMode === "remind" ? "remind" : "auto";
}

/** Copied onto a new manual step when the campaign fallback default is on. */
export const DEFAULT_MANUAL_FALLBACK_HOURS = 24;

/** Campaign / template default. Null means new manual steps start with fallback off. */
export function parseManualFallbackHours(value: unknown): number | null {
  if (value == null || value === false || value === "") return null;
  if (value === true) return DEFAULT_MANUAL_FALLBACK_HOURS;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return Math.max(1, Math.min(720, Math.round(hours)));
}

export function campaignSendModePatch(
  mode: CampaignSendMode,
  input: {
    fromMode?: string | null;
    fallbackHours?: number | null;
    defaultFallbackHours?: number | null;
  } = {}
): {
  send_mode: CampaignSendMode;
  fallback_hours: number | null;
  fallback_body?: null;
} {
  if (mode === "auto") {
    return { send_mode: "auto", fallback_hours: null, fallback_body: null };
  }
  if (campaignStepSendMode(input.fromMode) === "remind") {
    return {
      send_mode: "remind",
      fallback_hours: campaignFallbackEnabled(input.fallbackHours)
        ? campaignFallbackHoursPatch(true, input.fallbackHours)
        : null,
    };
  }
  return {
    send_mode: "remind",
    fallback_hours: parseManualFallbackHours(input.defaultFallbackHours),
  };
}

/** New LinkedIn messages match All-steps Manual, and copy the campaign fallback default. */
export function campaignNewStepSendFields(
  type: string,
  allMessageMode: CampaignSendMode | "mixed" | null | undefined,
  defaultFallbackHours?: number | null
): {
  send_mode: CampaignSendMode;
  fallback_hours: number | null;
  fallback_body: null;
} {
  if (!campaignStepHasSendMode(type) || allMessageMode !== "remind") {
    return { send_mode: "auto", fallback_hours: null, fallback_body: null };
  }
  const patch = campaignSendModePatch("remind", { defaultFallbackHours });
  return {
    send_mode: patch.send_mode,
    fallback_hours: patch.fallback_hours,
    fallback_body: null,
  };
}

/** Manual steps auto-send after this window. Null / off means they stay in the coach queue. */
export function campaignFallbackEnabled(
  fallbackHours: number | null | undefined
): boolean {
  return fallbackHours != null && Number(fallbackHours) > 0;
}

export function campaignFallbackHoursPatch(
  enabled: false,
  previousHours?: number | null
): null;
export function campaignFallbackHoursPatch(
  enabled: true,
  previousHours?: number | null
): number;
export function campaignFallbackHoursPatch(
  enabled: boolean,
  previousHours?: number | null
): number | null;
export function campaignFallbackHoursPatch(
  enabled: boolean,
  previousHours?: number | null
): number | null {
  if (!enabled) return null;
  const hours = previousHours != null ? Number(previousHours) : NaN;
  if (Number.isFinite(hours) && hours > 0) {
    return Math.max(1, Math.min(720, hours));
  }
  return DEFAULT_MANUAL_FALLBACK_HOURS;
}

export function sequenceMessageSendMode(
  steps: Array<{ step_type: string; send_mode?: string | null }>
): CampaignSendMode | "mixed" | null {
  const modes = steps
    .filter((step) => campaignStepHasSendMode(step.step_type))
    .map((step) => campaignStepSendMode(step.send_mode));
  if (modes.length === 0) return null;
  const first = modes[0];
  return modes.every((mode) => mode === first) ? first : "mixed";
}

/** Coach-facing actions that run when a lead reaches this point (no send job). */
export function campaignStepIsInternal(type: string): boolean {
  return type === "notify" || type === "add_to_campaign";
}

/** Sequence pauses here until the coach marks the step done. */
export function campaignStepNeedsCoach(
  type: string,
  config?: unknown
): boolean {
  return type === "call" && callWaitFrom(config);
}

/**
 * Wait, notify, add-to-campaign, and non-waiting calls do not park the lead
 * on a send job. Non-waiting calls still enqueue a Due reminder separately.
 */
export function campaignStepCreatesJob(
  type: string,
  config?: unknown
): boolean {
  if (type === "wait" || campaignStepIsInternal(type)) return false;
  if (type === "call") return callWaitFrom(config);
  return true;
}

export const CAMPAIGN_CHANNELS = [
  "linkedin",
  "email",
  "whatsapp",
  "instagram",
  "messenger",
] as const;

export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

const LINKEDIN_STEP_TYPES = new Set([
  "invite",
  "message",
  "comment",
  "react",
  "visit",
  "follow",
]);

const INSTAGRAM_STEP_TYPES = new Set([
  "instagram",
  "instagram_react",
  "instagram_comment",
  "instagram_follow",
]);

export function isLinkedInOutreachStep(type: string): boolean {
  return LINKEDIN_STEP_TYPES.has(type);
}

export function isInstagramCampaignStep(type: string): boolean {
  return INSTAGRAM_STEP_TYPES.has(type);
}

/** Platforms this sequence actually sends on, from steps plus campaign channel. */
export function campaignChannelsFromSteps(
  stepTypes: readonly string[],
  campaignChannel?: string | null
): CampaignChannel[] {
  const found = new Set<CampaignChannel>();
  const emailPrimary = campaignChannel === "email";

  for (const type of stepTypes) {
    if (type === "email") found.add("email");
    else if (type === "whatsapp") found.add("whatsapp");
    else if (type === "messenger") found.add("messenger");
    else if (INSTAGRAM_STEP_TYPES.has(type)) found.add("instagram");
    else if (type === "message" && emailPrimary) found.add("email");
    else if (LINKEDIN_STEP_TYPES.has(type)) found.add("linkedin");
  }

  if (found.size === 0) {
    found.add(emailPrimary ? "email" : "linkedin");
  }

  return CAMPAIGN_CHANNELS.filter((channel) => found.has(channel));
}

export function campaignStepHeatmapBucket(
  stepType: string | undefined
): "invite" | "message" | "email" | "engagement" | null {
  if (stepType === "invite" || stepType === "instagram_follow") return "invite";
  if (
    stepType === "message" ||
    stepType === "whatsapp" ||
    stepType === "instagram" ||
    stepType === "messenger"
  ) {
    return "message";
  }
  if (stepType === "email") return "email";
  if (
    stepType === "comment" ||
    stepType === "react" ||
    stepType === "visit" ||
    stepType === "follow" ||
    stepType === "instagram_react" ||
    stepType === "instagram_comment"
  ) {
    return "engagement";
  }
  return null;
}
