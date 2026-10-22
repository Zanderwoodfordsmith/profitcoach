/**
 * Where a visitor came from: the tag on the link they opened. Coaches make
 * tagged links in Toolkit (utm_source=linkedin, or the short ?src=linkedin);
 * the BOSS Score and coach website pages remember the tag in the browser and
 * send it with the BOSS Score or the opt-in.
 */

export type TrafficSource = { source: string; medium: string | null; campaign: string | null };

/** The channels a coach can pick in the link maker. */
export const TRAFFIC_CHANNELS: { value: string; label: string; medium: string }[] = [
  { value: "linkedin", label: "LinkedIn", medium: "social" },
  { value: "youtube", label: "YouTube", medium: "video" },
  { value: "email", label: "Email", medium: "email" },
  { value: "qr", label: "QR code", medium: "print" },
  { value: "facebook", label: "Facebook", medium: "social" },
  { value: "instagram", label: "Instagram", medium: "social" },
  { value: "whatsapp", label: "WhatsApp", medium: "message" },
];

const STORAGE_KEY = "pc_traffic";
const KEEP_DAYS = 30;

/** "LinkedIn Post!" → "linkedin-post". Empty when nothing usable is left. */
export function cleanTag(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function trafficFromParams(params: URLSearchParams): TrafficSource | null {
  const source = cleanTag(params.get("utm_source") ?? params.get("src"));
  if (!source) return null;
  return {
    source,
    medium: cleanTag(params.get("utm_medium")) || null,
    campaign: cleanTag(params.get("utm_campaign")) || null,
  };
}

/** Server side: accept only a clean tag from the request body. */
export function cleanTraffic(raw: unknown): TrafficSource | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const source = cleanTag(r.source);
  if (!source) return null;
  return { source, medium: cleanTag(r.medium) || null, campaign: cleanTag(r.campaign) || null };
}

/** Browser: keep the latest tagged visit for 30 days. Safe to call on any page. */
export function rememberTraffic(search: string = typeof window === "undefined" ? "" : window.location.search): void {
  const found = trafficFromParams(new URLSearchParams(search));
  if (!found) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...found, at: Date.now() }));
  } catch {
    // Private mode: the tag still rides on this page's URL.
  }
}

/** Browser: the remembered tag, or the one on this page's URL. */
export function recallTraffic(): TrafficSource | null {
  if (typeof window === "undefined") return null;
  const here = trafficFromParams(new URLSearchParams(window.location.search));
  if (here) return here;
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as (TrafficSource & { at?: number }) | null;
    if (!raw?.at || Date.now() - raw.at > KEEP_DAYS * 86_400_000) return null;
    return cleanTraffic(raw);
  } catch {
    return null;
  }
}

/** Add a tag to any link the coach hands out. */
export function taggedLink(url: string, source: string, campaign?: string | null): string {
  const tag = cleanTag(source);
  if (!tag) return url;
  const u = new URL(url);
  u.searchParams.set("utm_source", tag);
  const channel = TRAFFIC_CHANNELS.find((c) => c.value === tag);
  if (channel) u.searchParams.set("utm_medium", channel.medium);
  const camp = cleanTag(campaign);
  if (camp) u.searchParams.set("utm_campaign", camp);
  return u.toString();
}

export function trafficLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  return TRAFFIC_CHANNELS.find((c) => c.value === source)?.label ?? source.replace(/-/g, " ");
}
