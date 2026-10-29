/** Admin → Coaches → Getting live: the steps from paying to a first client, in order. Safe for the browser. */
export const GETTING_LIVE_GROUPS = [
  { key: "ready", label: "Get ready" },
  { key: "build", label: "We build it" },
  { key: "results", label: "Results" },
] as const;

export type GettingLiveGroupKey = (typeof GETTING_LIVE_GROUPS)[number]["key"];

export const GETTING_LIVE_STEPS = [
  { key: "about_you", label: "About You done", group: "ready" },
  { key: "blueprint_call", label: "Blueprint call", group: "ready" },
  { key: "blueprint_written", label: "Blueprint written", group: "build" },
  { key: "linkedin_updated", label: "LinkedIn profile done", group: "build" },
  { key: "leads_found", label: "2,500-person prospect list", group: "build" },
  { key: "campaign_set_up", label: "Campaign written", group: "build" },
  { key: "signed_off", label: "Coach agrees", group: "build" },
  { key: "campaign_live", label: "Campaign live", group: "build" },
  { key: "first_reply", label: "First reply", group: "results" },
  { key: "first_call", label: "First call", group: "results" },
  { key: "first_client", label: "First client", group: "results" },
] as const;

export type GettingLiveStepKey = (typeof GETTING_LIVE_STEPS)[number]["key"];

/** The launch list: everything up to the campaign going live. Results are tracked beside it, not as steps. */
export const LAUNCH_STEPS = GETTING_LIVE_STEPS.filter((s) => s.group !== "results");
export const RESULT_STEPS = GETTING_LIVE_STEPS.filter((s) => s.group === "results");

/** The group a step sits in, e.g. "We build it"; "Live" once the launch list is done. */
export function stepGroupLabel(key: GettingLiveStepKey | null): string {
  const group = GETTING_LIVE_STEPS.find((s) => s.key === key)?.group;
  return GETTING_LIVE_GROUPS.find((g) => g.key === group)?.label ?? "Live";
}
