/**
 * Scrape LinkedIn Messaging via Voyager from the extension (user IP + live cookies).
 * Loaded in the background service worker via importScripts.
 */

(function (global) {
  function stripQuotes(value) {
    const v = String(value || "").trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      return v.slice(1, -1);
    }
    return v;
  }

  function asRecord(v) {
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  }

  function textFrom(v) {
    if (typeof v === "string") return v.trim();
    const o = asRecord(v);
    if (!o) return "";
    if (typeof o.text === "string") return o.text.trim();
    return "";
  }

  function isoFromMs(ms) {
    const n = typeof ms === "number" ? ms : Number(ms);
    if (!Number.isFinite(n) || n <= 0) return null;
    return new Date(n).toISOString();
  }

  function profileName(p) {
    if (!p) return "Unknown";
    const name = `${p.firstName || ""} ${p.lastName || ""}`.trim();
    return name || p.publicIdentifier || "Unknown";
  }

  function profileHeadline(p) {
    if (!p) return null;
    if (typeof p.occupation === "string" && p.occupation.trim())
      return p.occupation.trim();
    if (typeof p.headline === "string" && p.headline.trim())
      return p.headline.trim();
    return null;
  }

  function profileUrl(p) {
    if (!p || typeof p.publicIdentifier !== "string" || !p.publicIdentifier)
      return null;
    return `https://www.linkedin.com/in/${p.publicIdentifier}`;
  }

  function includedByUrn(payload) {
    const map = new Map();
    const included = Array.isArray(payload.included) ? payload.included : [];
    for (const item of included) {
      const rec = asRecord(item);
      if (!rec) continue;
      const urn = rec.entityUrn || rec.urn;
      if (typeof urn === "string") map.set(urn, rec);
    }
    return map;
  }

  function resolvePointer(value, byUrn) {
    if (typeof value === "string") return byUrn.get(value) || null;
    const rec = asRecord(value);
    if (!rec) return null;
    if (typeof rec.entityUrn === "string" && byUrn.has(rec.entityUrn)) {
      return byUrn.get(rec.entityUrn) || rec;
    }
    return rec;
  }

  async function cookiesToAuth() {
    const cookies = await chrome.cookies.getAll({ domain: "linkedin.com" });
    if (!cookies.length) {
      throw new Error("No LinkedIn cookies. Log into LinkedIn in Chrome first.");
    }
    const map = new Map();
    for (const c of cookies) {
      if (!c.name || c.value == null) continue;
      map.set(c.name, stripQuotes(c.value));
    }
    const liAt = map.get("li_at");
    if (!liAt) {
      throw new Error("Missing li_at — log into LinkedIn, then retry.");
    }
    const jsession = map.get("JSESSIONID") || "";
    if (!jsession) {
      throw new Error(
        "Missing JSESSIONID. Open linkedin.com/messaging once, then retry."
      );
    }
    const pairs = [];
    for (const [name, value] of map) {
      if (name === "JSESSIONID") pairs.push(`JSESSIONID="${value}"`);
      else pairs.push(`${name}=${value}`);
    }
    return {
      cookieHeader: pairs.join("; "),
      csrfToken: jsession,
    };
  }

  function headers(auth) {
    return {
      Accept: "application/vnd.linkedin.normalized+json+2.1",
      "csrf-token": auth.csrfToken,
      "x-restli-protocol-version": "2.0.0",
      "x-li-lang": "en_US",
      Cookie: auth.cookieHeader,
      Referer: "https://www.linkedin.com/messaging/",
      "Accept-Language": "en-US,en;q=0.9",
    };
  }

  async function voyagerGet(auth, path) {
    const res = await fetch(`https://www.linkedin.com${path}`, {
      method: "GET",
      headers: headers(auth),
      credentials: "omit",
      cache: "no-store",
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text };
  }

  function parseParticipants(conv, byUrn, myProfileUrn) {
    const out = [];
    const participants = asRecord(conv.participants);
    const items = Array.isArray(participants?.items)
      ? participants.items
      : Array.isArray(conv.participants)
        ? conv.participants
        : [];

    for (const item of items) {
      const rec = asRecord(item);
      let profile = null;
      if (rec) {
        const mini =
          resolvePointer(rec["*miniProfile"] ?? rec.miniProfile, byUrn) ||
          resolvePointer(rec["*participant"] ?? rec.participant, byUrn) ||
          resolvePointer(rec.entityUrn, byUrn) ||
          rec;
        profile =
          resolvePointer(mini?.["*miniProfile"] ?? mini?.miniProfile, byUrn) ||
          mini;
      } else if (typeof item === "string") {
        profile = byUrn.get(item) || null;
        profile =
          resolvePointer(
            profile?.["*miniProfile"] ?? profile?.miniProfile,
            byUrn
          ) || profile;
      }
      if (!profile) continue;
      const urn = profile.entityUrn || profile.objectUrn || "";
      if (myProfileUrn && urn && urn === myProfileUrn) continue;
      out.push({
        name: profileName(profile),
        headline: profileHeadline(profile),
        profileUrl: profileUrl(profile),
      });
    }
    return out;
  }

  function parsePreviewBody(conv) {
    const events = asRecord(conv.events);
    const elems = Array.isArray(events?.elements)
      ? events.elements
      : Array.isArray(conv.events)
        ? conv.events
        : [];
    const first = asRecord(elems[0]);
    if (!first) return null;
    const eventContent = asRecord(first.eventContent);
    return (
      textFrom(eventContent?.attributedBody) ||
      textFrom(eventContent?.body) ||
      textFrom(first.body) ||
      null
    );
  }

  async function fetchMeProfileUrn(auth) {
    const res = await voyagerGet(auth, "/voyager/api/me");
    if (!res.ok || !res.json) return null;
    const byUrn = includedByUrn(res.json);
    const data = asRecord(res.json.data);
    if (typeof data?.["*miniProfile"] === "string") return data["*miniProfile"];
    for (const [urn, rec] of byUrn) {
      if (
        (urn.includes("fs_miniProfile") || urn.includes("fsd_profile")) &&
        (rec.firstName || rec.publicIdentifier)
      ) {
        return urn;
      }
    }
    return null;
  }

  async function fetchEvents(auth, conversationUrn, myProfileUrn, byUrnSeed) {
    const encoded = encodeURIComponent(conversationUrn);
    let res = await voyagerGet(
      auth,
      `/voyager/api/messaging/conversations/${encoded}/events?count=30`
    );
    if (!res.ok || !res.json) return [];

    const byUrn = includedByUrn(res.json);
    for (const [k, v] of byUrnSeed) byUrn.set(k, v);

    const messages = [];
    const elements = Array.isArray(res.json.elements) ? res.json.elements : [];
    for (const el of elements) {
      const event = asRecord(el);
      if (!event) continue;
      const eventContent = asRecord(event.eventContent);
      const body =
        textFrom(eventContent?.attributedBody) ||
        textFrom(eventContent?.body) ||
        textFrom(event.body) ||
        "";
      if (!body) continue;

      const from =
        resolvePointer(event["*from"] ?? event.from, byUrn) ||
        resolvePointer(
          asRecord(event.from)?.["*miniProfile"] ??
            asRecord(event.from)?.miniProfile,
          byUrn
        );
      const fromProfile =
        resolvePointer(from?.["*miniProfile"] ?? from?.miniProfile, byUrn) ||
        from;
      const fromUrn =
        (fromProfile && fromProfile.entityUrn) ||
        (typeof event["*from"] === "string" ? event["*from"] : "") ||
        "";
      const fromMe = Boolean(myProfileUrn && fromUrn && fromUrn === myProfileUrn);

      messages.push({
        id: event.entityUrn || event.backendUrn || `${conversationUrn}-${messages.length}`,
        body,
        sentAt: isoFromMs(
          event.createdAt ?? event.deliveredAt ?? event.lastActivityAt
        ),
        fromName: fromMe ? "You" : profileName(fromProfile),
        fromMe,
      });
    }
    messages.sort((a, b) => {
      const ta = a.sentAt ? Date.parse(a.sentAt) : 0;
      const tb = b.sentAt ? Date.parse(b.sentAt) : 0;
      return ta - tb;
    });
    return messages;
  }

  async function scrapeLinkedInInbox(limit = 3) {
    const capped = Math.min(10, Math.max(1, Number(limit) || 3));
    const auth = await cookiesToAuth();
    const listRes = await voyagerGet(
      auth,
      `/voyager/api/messaging/conversations?keyVersion=LEGACY_INBOX&q=participants&start=0&count=${capped}`
    );

    if (!listRes.ok || !listRes.json) {
      throw new Error(
        `LinkedIn messaging returned HTTP ${listRes.status}. Open linkedin.com/messaging while logged in, then retry.`
      );
    }

    const byUrn = includedByUrn(listRes.json);
    const elements = Array.isArray(listRes.json.elements)
      ? listRes.json.elements
      : [];
    if (!elements.length) {
      throw new Error("No conversations returned. Is Messaging empty?");
    }

    const myProfileUrn = await fetchMeProfileUrn(auth);
    const conversations = [];

    for (const raw of elements.slice(0, capped)) {
      const conv = asRecord(raw);
      if (!conv) continue;
      const entityUrn = conv.entityUrn || conv.backendUrn;
      if (!entityUrn) continue;

      const participants = parseParticipants(conv, byUrn, myProfileUrn);
      const title =
        participants.map((p) => p.name).filter(Boolean).join(", ") ||
        textFrom(conv.title) ||
        "Conversation";
      const subtitle =
        participants[0]?.headline || parsePreviewBody(conv) || null;

      let messages = [];
      try {
        messages = await fetchEvents(auth, entityUrn, myProfileUrn, byUrn);
      } catch {
        messages = [];
      }
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
      warning: conversations.some((c) => c.messages.length <= 1)
        ? "Some threads only returned a preview."
        : null,
    };
  }

  global.PC_SCRAPE_LINKEDIN_INBOX = scrapeLinkedInInbox;
})(globalThis);
