/**
 * Profit Coach for LinkedIn — background service worker.
 */

importScripts("config.js", "inbox-scrape.js");

const cfg = globalThis.PC_LINKEDIN_EXT;

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_LINKEDIN_COOKIES") {
    void collectLinkedInCookies()
      .then((cookies) => sendResponse({ ok: true, cookies }))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Cookie read failed.",
        })
      );
    return true;
  }

  if (message?.type === "OPEN_SIDE_PANEL") {
    const tabId = sender.tab?.id;
    if (typeof tabId !== "number") {
      sendResponse({ ok: false, error: "No tab." });
      return false;
    }
    void chrome.sidePanel
      .open({ tabId })
      .then(() => sendResponse({ ok: true }))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Could not open panel.",
        })
      );
    return true;
  }

  if (message?.type === "PROFILE_CONTEXT") {
    const profile = message.profile ?? null;
    void chrome.storage.session
      .set({
        lastProfile: profile,
        lastProfileAt: Date.now(),
        lastProfileTabId: sender.tab?.id ?? null,
      })
      .then(() => {
        chrome.runtime
          .sendMessage({ type: "PROFILE_UPDATED", profile })
          .catch(() => {});
        sendResponse({ ok: true });
      });
    return true;
  }

  if (message?.type === "GET_STORED_PROFILE") {
    void chrome.storage.session.get(
      ["lastProfile", "lastProfileAt", "lastProfileTabId"],
      (stored) => {
        sendResponse({
          ok: true,
          profile: stored.lastProfile ?? null,
          at: stored.lastProfileAt ?? null,
          tabId: stored.lastProfileTabId ?? null,
        });
      }
    );
    return true;
  }

  if (message?.type === "READ_ACTIVE_PROFILE") {
    void readActiveLinkedInProfile()
      .then((result) => sendResponse(result))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Could not read profile.",
        })
      );
    return true;
  }

  if (message?.type === "FIND_ACCESS_TOKEN") {
    void findAccessToken(message.origin)
      .then((result) => sendResponse(result))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Auth lookup failed.",
        })
      );
    return true;
  }

  if (message?.type === "INSERT_LINKEDIN_TEXT") {
    void resolveLinkedInTabId(message.tabId)
      .then((tabId) => {
        if (typeof tabId !== "number") {
          sendResponse({ ok: false, error: "No LinkedIn profile tab open." });
          return;
        }
        return chrome.tabs
          .sendMessage(tabId, {
            type: "INSERT_TEXT",
            text: message.text ?? "",
          })
          .then((res) => sendResponse(res ?? { ok: true }))
          .catch(() =>
            sendResponse({
              ok: false,
              error: "Refresh the LinkedIn tab, then try Insert again.",
            })
          );
      })
      .catch(() =>
        sendResponse({ ok: false, error: "No LinkedIn profile tab open." })
      );
    return true;
  }

  if (message?.type === "SN_CONNECT_START_REQUEST") {
    void startSalesNavConnect(message.options)
      .then((res) => sendResponse(res))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Could not start.",
        })
      );
    return true;
  }

  if (message?.type === "SN_CONNECT_STOP_REQUEST") {
    void stopSalesNavConnect()
      .then((res) => sendResponse(res))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Could not stop.",
        })
      );
    return true;
  }

  if (message?.type === "CONNECT_STATUS") {
    void chrome.storage.session
      .set({
        lastConnectStatus: {
          ...message,
          at: Date.now(),
        },
      })
      .then(() => {
        chrome.runtime
          .sendMessage({ type: "CONNECT_STATUS_UPDATED", payload: message })
          .catch(() => {});
        sendResponse({ ok: true });
      });
    return true;
  }

  if (message?.type === "GET_CONNECT_STATUS") {
    void chrome.storage.session.get(["lastConnectStatus"], (stored) => {
      void chrome.storage.local.get(
        ["connectDayKey", "connectSentToday", "connectSettings"],
        (local) => {
          sendResponse({
            ok: true,
            status: stored.lastConnectStatus ?? null,
            sentToday: local.connectSentToday ?? 0,
            dayKey: local.connectDayKey ?? null,
            settings: local.connectSettings ?? null,
          });
        }
      );
    });
    return true;
  }

  if (message?.type === "SCRAPE_LINKEDIN_INBOX") {
    void (async () => {
      try {
        const scrape = globalThis.PC_SCRAPE_LINKEDIN_INBOX;
        if (typeof scrape !== "function") {
          sendResponse({ ok: false, error: "Inbox scrape not loaded." });
          return;
        }
        const result = await scrape(message.limit ?? 3);
        sendResponse({ ok: true, ...result });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Inbox scrape failed.",
        });
      }
    })();
    return true;
  }

  return false;
});

function isSalesNavSearchUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return false;
    return /\/sales\/(search\/people|lists\/people)/i.test(u.pathname);
  } catch {
    return false;
  }
}

async function resolveSalesNavSearchTabId() {
  const [active] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (active?.id && isSalesNavSearchUrl(active.url)) return active.id;
  const tabs = await chrome.tabs.query({
    url: [
      "*://www.linkedin.com/sales/search/people*",
      "*://www.linkedin.com/sales/lists/people*",
      "*://linkedin.com/sales/search/people*",
      "*://linkedin.com/sales/lists/people*",
    ],
  });
  return tabs[0]?.id ?? null;
}

async function ensureConnectScript(tabId) {
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { type: "SN_CONNECT_PING" });
    if (ping?.ok) return true;
  } catch {
    // inject
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content-sales-nav-connect.js"],
  });
  return true;
}

async function startSalesNavConnect(options) {
  const tabId = await resolveSalesNavSearchTabId();
  if (typeof tabId !== "number") {
    return {
      ok: false,
      error:
        "Open a Sales Navigator people search or lead list tab first, then Start.",
    };
  }
  await chrome.storage.session.set({ connectRunnerTabId: tabId });
  if (options && typeof options === "object") {
    const settings = {};
    if (Number.isFinite(Number(options.dailyCap))) {
      settings.dailyCap = Math.min(80, Math.max(1, Number(options.dailyCap)));
    }
    if (Number.isFinite(Number(options.delayMinMs))) {
      settings.delayMinMs = Number(options.delayMinMs);
    }
    if (Number.isFinite(Number(options.delayMaxMs))) {
      settings.delayMaxMs = Number(options.delayMaxMs);
    }
    if (Object.keys(settings).length) {
      const prev = await chrome.storage.local.get(["connectSettings"]);
      await chrome.storage.local.set({
        connectSettings: { ...(prev.connectSettings || {}), ...settings },
      });
    }
  }
  await ensureConnectScript(tabId);
  const res = await chrome.tabs.sendMessage(tabId, {
    type: "SN_CONNECT_START",
    options: options || {},
  });
  return res ?? { ok: true };
}

async function stopSalesNavConnect() {
  const stored = await chrome.storage.session.get(["connectRunnerTabId"]);
  let tabId = stored.connectRunnerTabId;
  if (typeof tabId !== "number") {
    tabId = await resolveSalesNavSearchTabId();
  }
  if (typeof tabId !== "number") {
    return { ok: true, detail: "No Sales Nav search tab." };
  }
  try {
    await ensureConnectScript(tabId);
    return (
      (await chrome.tabs.sendMessage(tabId, { type: "SN_CONNECT_STOP" })) || {
        ok: true,
      }
    );
  } catch {
    return { ok: true };
  }
}

function isLinkedInProfileUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return false;
    return (
      /\/in\//i.test(u.pathname) || /\/sales\/(lead|people)\//i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

function contentScriptForUrl(url) {
  try {
    const u = new URL(url);
    if (/\/sales\/(lead|people)\//i.test(u.pathname)) {
      return "content-sales-nav.js";
    }
  } catch {
    // fall through
  }
  return "content-linkedin.js";
}

async function resolveLinkedInTabId(preferredId) {
  if (typeof preferredId === "number") {
    try {
      const tab = await chrome.tabs.get(preferredId);
      if (tab?.id && isLinkedInProfileUrl(tab.url)) return tab.id;
    } catch {
      // fall through
    }
  }
  const [active] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (active?.id && isLinkedInProfileUrl(active.url)) return active.id;
  const profiles = await chrome.tabs.query({
    url: [
      "*://www.linkedin.com/in/*",
      "*://linkedin.com/in/*",
      "*://www.linkedin.com/sales/lead/*",
      "*://www.linkedin.com/sales/people/*",
      "*://linkedin.com/sales/lead/*",
      "*://linkedin.com/sales/people/*",
    ],
  });
  return profiles[0]?.id ?? null;
}

async function askTabForProfile(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "GET_PROFILE" });
    if (res?.ok && res.profile) return res.profile;
  } catch {
    // inject and retry
  }
  let scriptFile = "content-linkedin.js";
  try {
    const tab = await chrome.tabs.get(tabId);
    scriptFile = contentScriptForUrl(tab.url || "");
  } catch {
    // keep default
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [scriptFile],
    });
  } catch {
    // may already be injected
  }
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "GET_PROFILE" });
    if (res?.ok && res.profile) return res.profile;
  } catch {
    // ignore
  }
  return null;
}

async function readActiveLinkedInProfile() {
  const tabId = await resolveLinkedInTabId(null);
  if (typeof tabId !== "number") {
    return {
      ok: false,
      error:
        "Open a LinkedIn or Sales Navigator lead page first (/in/… or /sales/lead/…).",
    };
  }
  const profile = await askTabForProfile(tabId);
  if (!profile?.linkedinUrl) {
    return {
      ok: false,
      error: "Couldn’t read this profile yet. Wait a second and try again.",
      tabId,
    };
  }
  await chrome.storage.session.set({
    lastProfile: profile,
    lastProfileAt: Date.now(),
    lastProfileTabId: tabId,
  });
  chrome.runtime
    .sendMessage({ type: "PROFILE_UPDATED", profile })
    .catch(() => {});
  return { ok: true, profile, tabId };
}

async function collectLinkedInCookies() {
  const cookies = await chrome.cookies.getAll({ domain: "linkedin.com" });
  if (!cookies.length) {
    throw new Error(
      "No LinkedIn cookies found. Log into LinkedIn in this browser first."
    );
  }
  const hasLiAt = cookies.some((c) => c.name === "li_at" && c.value);
  if (!hasLiAt) {
    throw new Error(
      "LinkedIn login cookie missing. Log into LinkedIn, then try again."
    );
  }
  return cookies.map((c) => ({
    domain: c.domain,
    expirationDate: c.expirationDate,
    hostOnly: c.hostOnly,
    httpOnly: c.httpOnly,
    name: c.name,
    path: c.path,
    sameSite:
      c.sameSite === "no_restriction"
        ? "no_restriction"
        : c.sameSite === "lax"
          ? "lax"
          : c.sameSite === "strict"
            ? "strict"
            : "unspecified",
    secure: c.secure,
    session: c.session,
    storeId: c.storeId || "0",
    value: c.value,
  }));
}

function originCandidates(origin) {
  const list = [origin];
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost") {
      list.push(`http://127.0.0.1:${u.port || "3002"}`);
    } else if (u.hostname === "127.0.0.1") {
      list.push(`http://localhost:${u.port || "3002"}`);
    } else if (u.hostname === "www.businesscoachacademy.com") {
      list.push("https://businesscoachacademy.com");
      list.push("https://app.businesscoachacademy.com");
    }
  } catch {
    // ignore
  }
  return [...new Set(list)];
}

function readSupabaseAccessTokenInPage() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const access =
        parsed?.access_token ||
        parsed?.currentSession?.access_token ||
        parsed?.session?.access_token;
      if (typeof access === "string" && access.length > 20) return access;
    } catch {
      // ignore
    }
  }
  return null;
}

async function findAppTab(origin) {
  const candidates = originCandidates(origin);
  const tabs = await chrome.tabs.query({});
  return (
    tabs.find(
      (t) =>
        typeof t.id === "number" &&
        t.url &&
        candidates.some((o) => t.url.startsWith(o))
    ) || null
  );
}

async function tokenFromTab(match) {
  try {
    const injected = await chrome.scripting.executeScript({
      target: { tabId: match.id },
      func: readSupabaseAccessTokenInPage,
    });
    const token = injected?.[0]?.result;
    if (typeof token === "string" && token.length > 20) {
      return {
        ok: true,
        accessToken: token,
        originUsed: new URL(match.url).origin,
      };
    }
  } catch {
    // fall through
  }
  try {
    const res = await chrome.tabs.sendMessage(match.id, {
      type: "GET_SUPABASE_ACCESS_TOKEN",
    });
    if (res?.ok && res.accessToken) {
      return {
        ok: true,
        accessToken: res.accessToken,
        originUsed: res.origin || new URL(match.url).origin,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

/** Prefer chosen origin, then any open Profit Coach tab. */
async function findAccessToken(preferredOrigin) {
  const preferred = preferredOrigin || cfg.DEFAULT_ORIGIN;
  const order = [
    preferred,
    ...cfg.APP_ORIGINS.filter((o) => o !== preferred),
  ];

  let sawAppTab = false;
  for (const origin of order) {
    const match = await findAppTab(origin);
    if (!match?.id) continue;
    sawAppTab = true;
    const token = await tokenFromTab(match);
    if (token?.ok) return token;
  }

  if (!sawAppTab) {
    return {
      ok: false,
      error:
        "Open Profit Coach in another tab and sign in (live site or local), then come back.",
    };
  }
  return {
    ok: false,
    error: "Profit Coach is open but you’re not signed in. Sign in, then retry.",
  };
}
