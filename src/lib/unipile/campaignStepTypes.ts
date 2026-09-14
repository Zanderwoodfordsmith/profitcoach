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

export type CampaignStepConfig = NotifyStepConfig &
  AddToCampaignStepConfig &
  CallStepConfig;

export function defaultStepConfig(type: CampaignStepType): CampaignStepConfig {
  if (type === "notify") {
    return {
      in_app: true,
      email: false,
      whatsapp: false,
      campaign_id: null,
      wait: false,
    };
  }
  return {
    in_app: false,
    email: false,
    whatsapp: false,
    campaign_id: null,
    wait: false,
  };
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
