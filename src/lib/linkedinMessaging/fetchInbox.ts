/**
 * Spike: pull N most recent LinkedIn Messaging conversations via Voyager (cookie).
 * Unofficial / ToS-grey — admin test only.
 */

import {
  parseLinkedInCookieAuth,
  voyagerHeaders,
  type LinkedInCookieAuth,
} from "@/lib/linkedinMessaging/cookieAuth";

export type MirrorMessage = {
  id: string;
  body: string;
  sentAt: string | null;
  fromName: string;
  fromMe: boolean;
};

export type MirrorConversation = {
  id: string;
  entityUrn: string;
  title: string;
  subtitle: string | null;
  lastActivityAt: string | null;
  participants: { name: string; headline: string | null; profileUrl: string | null }[];
  messages: MirrorMessage[];
};

export type FetchMirrorInboxResult = {
  conversations: MirrorConversation[];
  scrapedAt: string;
  warning?: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function textFrom(v: unknown): string {
  if (typeof v === "string") return v.trim();
  const o = asRecord(v);
  if (!o) return "";
  if (typeof o.text === "string") return o.text.trim();
  if (typeof o.attributes === "object") {
    // attributed text sometimes nested
  }
  return "";
}

function includedByUrn(payload: Record<string, unknown>): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  const included = Array.isArray(payload.included) ? payload.included : [];
  for (const item of included) {
    const rec = asRecord(item);
    if (!rec) continue;
    const urn =
      (typeof rec.entityUrn === "string" && rec.entityUrn) ||
      (typeof rec.urn === "string" && rec.urn) ||
      null;
    if (urn) map.set(urn, rec);
  }
  return map;
}

function resolvePointer(
  value: unknown,
  byUrn: Map<string, Record<string, unknown>>
): Record<string, unknown> | null {
  if (typeof value === "string") return byUrn.get(value) ?? null;
  const rec = asRecord(value);
  if (!rec) return null;
  if (typeof rec.entityUrn === "string" && byUrn.has(rec.entityUrn)) {
    return byUrn.get(rec.entityUrn) ?? rec;
  }
  return rec;
}

function profileName(p: Record<string, unknown> | null): string {
  if (!p) return "Unknown";
  const first = typeof p.firstName === "string" ? p.firstName : "";
  const last = typeof p.lastName === "string" ? p.lastName : "";
  const name = `${first} ${last}`.trim();
  if (name) return name;
  if (typeof p.publicIdentifier === "string") return p.publicIdentifier;
  return "Unknown";
}

function profileHeadline(p: Record<string, unknown> | null): string | null {
  if (!p) return null;
  if (typeof p.occupation === "string" && p.occupation.trim()) return p.occupation.trim();
  if (typeof p.headline === "string" && p.headline.trim()) return p.headline.trim();
  return null;
}

function profileUrl(p: Record<string, unknown> | null): string | null {
  if (!p) return null;
  const id = typeof p.publicIdentifier === "string" ? p.publicIdentifier : "";
  if (!id) return null;
  return `https://www.linkedin.com/in/${id}`;
}

function isoFromMs(ms: unknown): string | null {
  const n = typeof ms === "number" ? ms : Number(ms);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n).toISOString();
}

async function voyagerGet(
  auth: LinkedInCookieAuth,
  pathAndQuery: string
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null; text: string }> {
  const url = pathAndQuery.startsWith("http")
    ? pathAndQuery
    : `https://www.linkedin.com${pathAndQuery}`;
  const res = await fetch(url, {
    method: "GET",
    headers: voyagerHeaders(auth),
    redirect: "manual",
    cache: "no-store",
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

function extractConversationElements(
  payload: Record<string, unknown>
): Record<string, unknown>[] {
  if (Array.isArray(payload.elements)) {
    return payload.elements.map(asRecord).filter(Boolean) as Record<string, unknown>[];
  }
  const data = asRecord(payload.data);
  // GraphQL-ish shapes
  const messenger = asRecord(data?.messengerConversationsBySyncToken) ||
    asRecord(data?.messengerConversations) ||
    asRecord(
      asRecord(data?.data)?.messengerConversationsBySyncToken
    );
  if (messenger && Array.isArray(messenger.elements)) {
    return messenger.elements.map(asRecord).filter(Boolean) as Record<string, unknown>[];
  }
  return [];
}

function parseParticipants(
  conv: Record<string, unknown>,
  byUrn: Map<string, Record<string, unknown>>,
  myProfileUrn: string | null
): MirrorConversation["participants"] {
  const out: MirrorConversation["participants"] = [];
  const participants = asRecord(conv.participants);
  const items = Array.isArray(participants?.items)
    ? participants!.items
    : Array.isArray(conv.participants)
      ? (conv.participants as unknown[])
      : [];

  for (const item of items) {
    const rec = asRecord(item);
    let profile: Record<string, unknown> | null = null;
    if (rec) {
      const mini =
        resolvePointer(rec["*miniProfile"] ?? rec.miniProfile, byUrn) ||
        resolvePointer(rec["*participant"] ?? rec.participant, byUrn) ||
        resolvePointer(rec.entityUrn, byUrn) ||
        rec;
      // messaging participant → miniProfile
      profile =
        resolvePointer(mini?.["*miniProfile"] ?? mini?.miniProfile, byUrn) ||
        mini;
    } else if (typeof item === "string") {
      profile = byUrn.get(item) ?? null;
      profile =
        resolvePointer(profile?.["*miniProfile"] ?? profile?.miniProfile, byUrn) ||
        profile;
    }
    if (!profile) continue;
    const urn =
      (typeof profile.entityUrn === "string" && profile.entityUrn) ||
      (typeof profile.objectUrn === "string" && profile.objectUrn) ||
      "";
    if (myProfileUrn && urn && urn === myProfileUrn) continue;
    out.push({
      name: profileName(profile),
      headline: profileHeadline(profile),
      profileUrl: profileUrl(profile),
    });
  }
  return out;
}

function parsePreviewBody(conv: Record<string, unknown>): string | null {
  const events = asRecord(conv.events);
  const elems = Array.isArray(events?.elements)
    ? events!.elements
    : Array.isArray(conv.events)
      ? (conv.events as unknown[])
      : [];
  const first = asRecord(elems[0]);
  if (!first) return null;
  const eventContent = asRecord(first.eventContent);
  const body =
    textFrom(eventContent?.attributedBody) ||
    textFrom(eventContent?.body) ||
    textFrom(first.body) ||
    "";
  return body || null;
}

async function fetchMeProfileUrn(auth: LinkedInCookieAuth): Promise<string | null> {
  const res = await voyagerGet(auth, "/voyager/api/me");
  if (!res.ok || !res.json) return null;
  const byUrn = includedByUrn(res.json);
  const data = asRecord(res.json.data);
  const miniUrn =
    (typeof data?.["*miniProfile"] === "string" && data["*miniProfile"]) ||
    (typeof asRecord(data?.miniProfile)?.entityUrn === "string" &&
      (asRecord(data?.miniProfile)!.entityUrn as string)) ||
    null;
  if (miniUrn) return miniUrn;
  for (const [urn, rec] of byUrn) {
    if (urn.includes("fs_miniProfile") || urn.includes("fsd_profile")) {
      if (rec.firstName || rec.publicIdentifier) return urn;
    }
  }
  return null;
}

async function fetchConversationEvents(
  auth: LinkedInCookieAuth,
  conversationUrn: string,
  myProfileUrn: string | null,
  byUrnSeed: Map<string, Record<string, unknown>>
): Promise<MirrorMessage[]> {
  const encoded = encodeURIComponent(conversationUrn);
  const res = await voyagerGet(
    auth,
    `/voyager/api/messaging/conversations/${encoded}/events?count=30&q=syncToken`
  );

  // Some accounts want simpler query
  const res2 =
    res.ok && res.json
      ? res
      : await voyagerGet(
          auth,
          `/voyager/api/messaging/conversations/${encoded}/events?count=30`
        );

  if (!res2.ok || !res2.json) {
    return [];
  }

  const byUrn = includedByUrn(res2.json);
  for (const [k, v] of byUrnSeed) byUrn.set(k, v);

  const elements = Array.isArray(res2.json.elements)
    ? res2.json.elements
    : [];

  const messages: MirrorMessage[] = [];
  for (const el of elements) {
    const event = asRecord(el);
    if (!event) continue;
    const eventContent = asRecord(event.eventContent);
    const body =
      textFrom(eventContent?.attributedBody) ||
      textFrom(eventContent?.body) ||
      textFrom(event.body) ||
      "";
    const contentType =
      typeof eventContent?.["$type"] === "string" ? eventContent["$type"] : "";
    if (!body && contentType.includes("ParticipantChange")) {
      continue;
    }
    if (!body) continue;

    const from =
      resolvePointer(event["*from"] ?? event.from, byUrn) ||
      resolvePointer(
        asRecord(event.from)?.["*miniProfile"] ?? asRecord(event.from)?.miniProfile,
        byUrn
      );
    const fromProfile =
      resolvePointer(from?.["*miniProfile"] ?? from?.miniProfile, byUrn) || from;
    const fromUrn =
      (typeof fromProfile?.entityUrn === "string" && fromProfile.entityUrn) ||
      (typeof event["*from"] === "string" && event["*from"]) ||
      "";
    const fromMe = Boolean(myProfileUrn && fromUrn && fromUrn === myProfileUrn);

    messages.push({
      id:
        (typeof event.entityUrn === "string" && event.entityUrn) ||
        (typeof event.backendUrn === "string" && event.backendUrn) ||
        `${conversationUrn}-${messages.length}`,
      body,
      sentAt: isoFromMs(event.createdAt ?? event.deliveredAt ?? event.lastActivityAt),
      fromName: fromMe ? "You" : profileName(fromProfile),
      fromMe,
    });
  }

  // Voyager often returns newest-first; show oldest → newest for chat UI
  messages.sort((a, b) => {
    const ta = a.sentAt ? Date.parse(a.sentAt) : 0;
    const tb = b.sentAt ? Date.parse(b.sentAt) : 0;
    return ta - tb;
  });
  return messages;
}

export async function fetchLinkedInMirrorInbox(opts: {
  cookie: string;
  userAgent?: string | null;
  limit?: number;
}): Promise<FetchMirrorInboxResult> {
  const limit = Math.min(10, Math.max(1, opts.limit ?? 3));
  const auth = parseLinkedInCookieAuth(opts.cookie, opts.userAgent);

  const listRes = await voyagerGet(
    auth,
    `/voyager/api/messaging/conversations?keyVersion=LEGACY_INBOX&q=participants&start=0&count=${limit}`
  );

  if (listRes.status === 302 || listRes.status === 401 || listRes.status === 403) {
    throw new Error(
      `LinkedIn rejected the session (HTTP ${listRes.status}). Refresh cookies from linkedin.com (need li_at + JSESSIONID) and try again. Cloud IPs are often challenged — if this keeps failing, we’ll move scrape into the extension.`
    );
  }

  if (!listRes.ok || !listRes.json) {
    const snippet = listRes.text.slice(0, 180).replace(/\s+/g, " ");
    throw new Error(
      `Could not list conversations (HTTP ${listRes.status}). ${snippet || "Empty response."}`
    );
  }

  // Challenge / checkpoint HTML sometimes returns 200 with non-JSON — already handled
  if (
    typeof listRes.text === "string" &&
    /captcha|challenge|checkpoint/i.test(listRes.text) &&
    !listRes.json.elements
  ) {
    throw new Error(
      "LinkedIn returned a challenge page instead of messaging data. Cookie may be stale, or this server IP is blocked. Re-export cookies or we scrape from the extension next."
    );
  }

  const byUrn = includedByUrn(listRes.json);
  const elements = extractConversationElements(listRes.json).slice(0, limit);
  if (!elements.length) {
    throw new Error(
      "No conversations in the response. Cookie might work for Sales Nav but not Messaging, or the inbox is empty."
    );
  }

  const myProfileUrn = await fetchMeProfileUrn(auth);

  const conversations: MirrorConversation[] = [];
  for (const conv of elements) {
    const entityUrn =
      (typeof conv.entityUrn === "string" && conv.entityUrn) ||
      (typeof conv.backendUrn === "string" && conv.backendUrn) ||
      "";
    if (!entityUrn) continue;

    const participants = parseParticipants(conv, byUrn, myProfileUrn);
    const title =
      participants.map((p) => p.name).filter(Boolean).join(", ") ||
      textFrom(conv.title) ||
      "Conversation";
    const subtitle =
      participants[0]?.headline || parsePreviewBody(conv) || null;

    let messages: MirrorMessage[] = [];
    try {
      messages = await fetchConversationEvents(
        auth,
        entityUrn,
        myProfileUrn,
        byUrn
      );
    } catch {
      messages = [];
    }

    // If events failed, at least show preview as a single bubble
    if (!messages.length) {
      const preview = parsePreviewBody(conv);
      if (preview) {
        messages = [
          {
            id: `${entityUrn}-preview`,
            body: preview,
            sentAt: isoFromMs(conv.lastActivityAt),
            fromName: title,
            fromMe: false,
          },
        ];
      }
    }

    conversations.push({
      id: entityUrn,
      entityUrn,
      title,
      subtitle,
      lastActivityAt: isoFromMs(conv.lastActivityAt),
      participants,
      messages,
    });
  }

  return {
    conversations,
    scrapedAt: new Date().toISOString(),
    warning:
      conversations.some((c) => c.messages.length <= 1)
        ? "Some threads only returned a preview — LinkedIn may have limited the events endpoint from this server."
        : undefined,
  };
}
