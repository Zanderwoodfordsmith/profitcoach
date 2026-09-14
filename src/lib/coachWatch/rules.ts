export type WatchScopeKind = "campaign" | "magnet";

export type WatchChannel = "in_app" | "email" | "whatsapp";

export type WatchEventDef = {
  id: string;
  label: string;
};

export const CAMPAIGN_WATCH_EVENTS: WatchEventDef[] = [
  { id: "replied", label: "Someone replies" },
  { id: "interested", label: "Someone is interested" },
  { id: "connected", label: "They accept the invite" },
  { id: "sequence_done", label: "They finish the sequence" },
];

export const MAGNET_WATCH_EVENTS: WatchEventDef[] = [
  { id: "started", label: "They start the assessment" },
  { id: "completed", label: "They finish the assessment" },
  { id: "abandoned", label: "They leave without finishing" },
];

export type CoachWatchRule = {
  id: string;
  scope_kind: WatchScopeKind;
  scope_id: string;
  event: string;
  in_app: boolean;
  email: boolean;
  whatsapp: boolean;
};

export function watchEventsFor(kind: WatchScopeKind): WatchEventDef[] {
  return kind === "magnet" ? MAGNET_WATCH_EVENTS : CAMPAIGN_WATCH_EVENTS;
}

export function isWatchEvent(kind: WatchScopeKind, event: string): boolean {
  return watchEventsFor(kind).some((item) => item.id === event);
}

export function watchEventLabel(kind: WatchScopeKind, event: string): string {
  return watchEventsFor(kind).find((item) => item.id === event)?.label ?? event;
}
