/* global PC_LINKEDIN_EXT */

const cfg = globalThis.PC_LINKEDIN_EXT;

const originEl = document.getElementById("origin");
const authStatusEl = document.getElementById("authStatus");
const panelTitle = document.getElementById("panelTitle");
const profileEmpty = document.getElementById("profileEmpty");
const profileBlock = document.getElementById("profileBlock");
const pName = document.getElementById("pName");
const pMeta = document.getElementById("pMeta");
const stageEl = document.getElementById("stage");
const saveBtn = document.getElementById("saveBtn");
const saveStatus = document.getElementById("saveStatus");
const workspaceLink = document.getElementById("workspaceLink");
const draftConnector = document.getElementById("draftConnector");
const draftDm = document.getElementById("draftDm");
const draftStatus = document.getElementById("draftStatus");
const draftsEl = document.getElementById("drafts");
const reloadBtn = document.getElementById("reloadBtn");
const coachWrap = document.getElementById("coachWrap");
const coachSelect = document.getElementById("coachSelect");
const fitBlock = document.getElementById("fitBlock");
const fitScore = document.getElementById("fitScore");
const fitLabel = document.getElementById("fitLabel");
const fitMarker = document.getElementById("fitMarker");
const fitWhy = document.getElementById("fitWhy");
const fitNot = document.getElementById("fitNot");
const fitStatus = document.getElementById("fitStatus");
const connectStartBtn = document.getElementById("connectStartBtn");
const connectStopBtn = document.getElementById("connectStopBtn");
const connectStatus = document.getElementById("connectStatus");
const connectSentToday = document.getElementById("connectSentToday");
const connectCapLabel = document.getElementById("connectCapLabel");
const connectDailyCap = document.getElementById("connectDailyCap");
const connectMaxPerRun = document.getElementById("connectMaxPerRun");
const connectDelayMin = document.getElementById("connectDelayMin");
const connectDelayMax = document.getElementById("connectDelayMax");
const connectThisBtn = document.getElementById("connectThisBtn");
const connectThisStatus = document.getElementById("connectThisStatus");
const connectWithNote = document.getElementById("connectWithNote");
const connectNoteText = document.getElementById("connectNoteText");
const connectLogEl = document.getElementById("connectLog");
const clearConnectLogBtn = document.getElementById("clearConnectLogBtn");
const inboxSyncBtn = document.getElementById("inboxSyncBtn");
const inboxSyncStatus = document.getElementById("inboxSyncStatus");

const TAB_TITLES = {
  profile: "Profile",
  connect: "Connect",
  tools: "Tools",
  settings: "Settings",
};

const FIT_LABELS = {
  very_weak: "Very weak",
  weak: "Weak",
  okay: "Okay",
  strong: "Strong",
  ideal: "Ideal",
};

const CONNECT_LOG_MAX = 40;

let profile = null;
let accessToken = null;
let apiOrigin = null;
let entitlementOk = false;
let profileTabId = null;
let impersonateCoachId = null;
let fitRequestId = 0;
/** @type {Array<{ at: number, text: string, kind: string }>} */
let connectLog = [];

function setPill(text, kind) {
  authStatusEl.textContent = text;
  authStatusEl.className = "pill" + (kind ? ` ${kind}` : "");
}

function setSaveStatus(text, kind) {
  saveStatus.textContent = text || "";
  saveStatus.className = "msg" + (kind ? ` ${kind}` : "");
}

function setDraftStatus(text, kind) {
  draftStatus.textContent = text || "";
  draftStatus.className = "msg" + (kind ? ` ${kind}` : "");
}

function setConnectStatus(text, kind) {
  connectStatus.textContent = text || "";
  connectStatus.className = "msg" + (kind ? ` ${kind}` : "");
}

function setConnectThisStatus(text, kind) {
  connectThisStatus.textContent = text || "";
  connectThisStatus.className = "msg" + (kind ? ` ${kind}` : "");
}

function switchTab(tab) {
  const id = TAB_TITLES[tab] ? tab : "profile";
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.tab !== id);
  });
  document.querySelectorAll(".nav-item").forEach((btn) => {
    const on = btn.dataset.tab === id;
    btn.classList.toggle("active", on);
    if (on) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });
  panelTitle.textContent = TAB_TITLES[id];
  chrome.storage.local.set({ sidepanelTab: id });
}

function formatLogTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function renderConnectLog() {
  connectLogEl.innerHTML = "";
  if (!connectLog.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "No activity yet.";
    connectLogEl.appendChild(li);
    return;
  }
  for (const entry of connectLog) {
    const li = document.createElement("li");
    if (entry.kind) li.className = entry.kind;
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = formatLogTime(entry.at);
    li.appendChild(when);
    li.appendChild(document.createTextNode(entry.text));
    connectLogEl.appendChild(li);
  }
}

function pushConnectLog(text, kind = "") {
  if (!text) return;
  connectLog.unshift({ at: Date.now(), text, kind });
  connectLog = connectLog.slice(0, CONNECT_LOG_MAX);
  chrome.storage.session.set({ connectActivityLog: connectLog });
  renderConnectLog();
}

async function loadConnectLog() {
  try {
    const stored = await chrome.storage.session.get(["connectActivityLog"]);
    if (Array.isArray(stored.connectActivityLog)) {
      connectLog = stored.connectActivityLog;
    }
  } catch {
    // ignore
  }
  renderConnectLog();
}

function readConnectOptions() {
  const dailyCap = Math.min(
    80,
    Math.max(1, Number(connectDailyCap.value) || 25)
  );
  const maxPerRun = Math.min(
    40,
    Math.max(1, Number(connectMaxPerRun.value) || 5)
  );
  let delayMinSec = Math.min(
    120,
    Math.max(3, Number(connectDelayMin.value) || 8)
  );
  let delayMaxSec = Math.min(
    180,
    Math.max(3, Number(connectDelayMax.value) || 18)
  );
  if (delayMaxSec < delayMinSec) delayMaxSec = delayMinSec;
  connectDailyCap.value = String(dailyCap);
  connectMaxPerRun.value = String(maxPerRun);
  connectDelayMin.value = String(delayMinSec);
  connectDelayMax.value = String(delayMaxSec);
  return {
    dailyCap,
    maxPerRun,
    delayMinMs: delayMinSec * 1000,
    delayMaxMs: delayMaxSec * 1000,
  };
}

function persistConnectSettings() {
  const opts = readConnectOptions();
  void chrome.storage.local.get(["connectSettings"], (stored) => {
    void chrome.storage.local.set({
      connectSettings: {
        ...(stored.connectSettings || {}),
        dailyCap: opts.dailyCap,
        maxPerRun: opts.maxPerRun,
        delayMinMs: opts.delayMinMs,
        delayMaxMs: opts.delayMaxMs,
      },
    });
  });
  connectCapLabel.textContent = `Cap: ${opts.dailyCap}`;
}

function renderConnectStats(sentToday, dailyCap, running) {
  const sent = Number(sentToday) || 0;
  const cap = Number(dailyCap) || Number(connectDailyCap.value) || 25;
  connectSentToday.textContent = `Today: ${sent}`;
  connectCapLabel.textContent = `Cap: ${cap}`;
  if (document.activeElement !== connectDailyCap) {
    connectDailyCap.value = String(cap);
  }
  connectStartBtn.disabled = Boolean(running);
  connectStopBtn.disabled = !running;
}

function applyConnectPayload(payload, { log = true } = {}) {
  if (!payload) return;
  const running = Boolean(payload.running);
  const cap = payload.dailyCap ?? (Number(connectDailyCap.value) || 25);
  renderConnectStats(payload.sentToday, cap, running);
  const detail = payload.detail || payload.status || "";
  let kind = "";
  if (payload.status === "limit" || payload.status === "error") kind = "err";
  else if (payload.status === "sent" || payload.status === "done") kind = "ok";
  else if (payload.status === "waiting" || payload.status === "skipped")
    kind = "warn";
  setConnectStatus(detail, kind);
  if (
    log &&
    detail &&
    ["sent", "error", "limit", "done", "stopped", "skipped"].includes(
      payload.status
    )
  ) {
    pushConnectLog(detail, kind);
  }
}

async function refreshConnectStatus() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "GET_CONNECT_STATUS" });
    if (!res?.ok) return;
    const settings = res.settings || {};
    const cap = settings.dailyCap || Number(connectDailyCap.value) || 25;
    if (Number.isFinite(Number(settings.maxPerRun))) {
      connectMaxPerRun.value = String(settings.maxPerRun);
    }
    if (Number.isFinite(Number(settings.delayMinMs))) {
      connectDelayMin.value = String(Math.round(settings.delayMinMs / 1000));
    }
    if (Number.isFinite(Number(settings.delayMaxMs))) {
      connectDelayMax.value = String(Math.round(settings.delayMaxMs / 1000));
    }
    const running = Boolean(res.status?.running);
    renderConnectStats(res.sentToday, cap, running);
    if (res.status?.detail) applyConnectPayload(res.status, { log: false });
  } catch {
    // ignore
  }
}

function setInboxSyncStatus(text, kind) {
  inboxSyncStatus.textContent = text || "";
  inboxSyncStatus.className = "msg" + (kind ? ` ${kind}` : "");
}

async function onInboxSync() {
  if (!entitlementOk || !accessToken || !apiOrigin) {
    setInboxSyncStatus("Sign in to Profit Coach first.", "err");
    return;
  }
  inboxSyncBtn.disabled = true;
  setInboxSyncStatus("Scraping Messaging from this browser…");
  try {
    const scraped = await chrome.runtime.sendMessage({
      type: "SCRAPE_LINKEDIN_INBOX",
      limit: 3,
    });
    if (!scraped?.ok) {
      throw new Error(scraped?.error || "Scrape failed.");
    }
    setInboxSyncStatus("Saving to Profit Coach…");
    const res = await fetch(`${apiOrigin}${cfg.INBOX_MIRROR_PATH}`, {
      method: "POST",
      headers: apiHeaders(true),
      body: JSON.stringify({
        conversations: scraped.conversations || [],
        scrapedAt: scraped.scrapedAt,
        source: "extension",
        warning: scraped.warning || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || `Save failed (${res.status}).`);
    }
    const n = Array.isArray(scraped.conversations)
      ? scraped.conversations.length
      : 0;
    setInboxSyncStatus(
      `Synced ${n} thread${n === 1 ? "" : "s"}. Open Admin → Tools → LI Inbox.`,
      "ok"
    );
  } catch (err) {
    setInboxSyncStatus(
      err instanceof Error ? err.message : "Inbox sync failed.",
      "err"
    );
  } finally {
    inboxSyncBtn.disabled = false;
  }
}

async function onConnectThisProfile() {
  setConnectThisStatus("Sending connection request…");
  connectThisBtn.disabled = true;
  try {
    const note =
      connectWithNote.checked && connectNoteText.value.trim()
        ? connectNoteText.value.trim()
        : "";
    const res = await chrome.runtime.sendMessage({
      type: "PROFILE_CONNECT_REQUEST",
      options: { note },
      tabId: profileTabId,
    });
    if (!res?.ok) {
      const kind =
        res?.status === "skipped"
          ? "warn"
          : res?.status === "limit"
            ? "err"
            : "err";
      const detail = res?.detail || res?.error || "Could not connect.";
      setConnectThisStatus(detail, kind);
      pushConnectLog(detail, kind);
      if (Number.isFinite(Number(res?.sentToday))) {
        renderConnectStats(
          res.sentToday,
          Number(connectDailyCap.value) || 25,
          false
        );
      }
      return;
    }
    setConnectThisStatus(res.detail || "Sent.", "ok");
    pushConnectLog(res.detail || `Sent invite to ${res.name || "profile"}`, "ok");
    if (Number.isFinite(Number(res.sentToday))) {
      renderConnectStats(
        res.sentToday,
        Number(connectDailyCap.value) || 25,
        false
      );
    } else {
      void refreshConnectStatus();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not connect.";
    setConnectThisStatus(msg, "err");
    pushConnectLog(msg, "err");
  } finally {
    connectThisBtn.disabled = false;
  }
}

async function onConnectStart() {
  const opts = readConnectOptions();
  persistConnectSettings();
  setConnectStatus("Starting…");
  connectStartBtn.disabled = true;
  pushConnectLog(
    `Starting Sales Nav run (max ${opts.maxPerRun}, cap ${opts.dailyCap})…`
  );
  try {
    const res = await chrome.runtime.sendMessage({
      type: "SN_CONNECT_START_REQUEST",
      options: opts,
    });
    if (!res?.ok) {
      const err = res?.error || "Could not start.";
      setConnectStatus(err, "err");
      pushConnectLog(err, "err");
      connectStartBtn.disabled = false;
      connectStopBtn.disabled = true;
      return;
    }
    setConnectStatus("Running on Sales Nav tab…", "ok");
    connectStopBtn.disabled = false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not start.";
    setConnectStatus(msg, "err");
    pushConnectLog(msg, "err");
    connectStartBtn.disabled = false;
  }
}

async function onConnectStop() {
  try {
    await chrome.runtime.sendMessage({ type: "SN_CONNECT_STOP_REQUEST" });
    setConnectStatus("Stopped.", "warn");
    pushConnectLog("Stopped.", "warn");
    connectStartBtn.disabled = false;
    connectStopBtn.disabled = true;
  } catch {
    setConnectStatus("Stopped.", "warn");
  }
}

function apiHeaders(json = false) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  if (json) headers["Content-Type"] = "application/json";
  if (impersonateCoachId) {
    headers["x-impersonate-coach-id"] = impersonateCoachId;
  }
  return headers;
}

function fillOrigins() {
  originEl.innerHTML = "";
  for (const choice of cfg.APP_CHOICES) {
    const opt = document.createElement("option");
    opt.value = choice.origin;
    opt.textContent = choice.label;
    originEl.appendChild(opt);
  }
  chrome.storage.local.get(["preferredAppId"], (stored) => {
    const choice =
      cfg.APP_CHOICES.find((c) => c.id === stored.preferredAppId) ||
      cfg.APP_CHOICES[0];
    originEl.value = choice.origin;
  });
}

originEl.addEventListener("change", () => {
  const choice =
    cfg.APP_CHOICES.find((c) => c.origin === originEl.value) ||
    cfg.APP_CHOICES[0];
  chrome.storage.local.set({ preferredAppId: choice.id });
  void refreshAuth();
});

coachSelect.addEventListener("change", () => {
  impersonateCoachId = coachSelect.value || null;
  chrome.storage.local.set({ impersonateCoachId: impersonateCoachId || "" });
  void refreshAuth();
});

function fillCoachSelect(coaches, selectedId) {
  coachSelect.innerHTML = "";
  if (!coaches?.length) {
    coachWrap.classList.add("hidden");
    return;
  }
  coachWrap.classList.remove("hidden");
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a coach…";
  coachSelect.appendChild(placeholder);
  for (const c of coaches) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.slug ? `${c.name} (${c.slug})` : c.name;
    coachSelect.appendChild(opt);
  }
  if (selectedId && coaches.some((c) => c.id === selectedId)) {
    coachSelect.value = selectedId;
    impersonateCoachId = selectedId;
  }
}

function clearFit() {
  fitBlock.classList.add("hidden");
  fitScore.textContent = "";
  fitLabel.textContent = "–";
  if (fitMarker) fitMarker.style.left = "0%";
  fitWhy.innerHTML = "";
  fitNot.innerHTML = "";
  fitStatus.textContent = "";
}

function fitLabelFromScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "okay";
  if (n >= 80) return "ideal";
  if (n >= 60) return "strong";
  if (n >= 40) return "okay";
  if (n >= 20) return "weak";
  return "very_weak";
}

function renderFit(fit) {
  fitBlock.classList.remove("hidden");
  const score = Math.max(0, Math.min(100, Number(fit.score) || 0));
  const key = fit.label || fitLabelFromScore(score);
  fitLabel.textContent = fit.labelText || FIT_LABELS[key] || "Okay";
  fitScore.textContent = `${score}/100`;
  if (fitMarker) fitMarker.style.left = `${score}%`;
  fitWhy.innerHTML = "";
  for (const line of fit.whyFit || []) {
    const li = document.createElement("li");
    li.textContent = line;
    fitWhy.appendChild(li);
  }
  fitNot.innerHTML = "";
  for (const line of fit.whyNot || []) {
    const li = document.createElement("li");
    li.textContent = line;
    fitNot.appendChild(li);
  }
  if (fit.talkingPoints?.length) {
    fitStatus.textContent = "Angles: " + fit.talkingPoints.join(" · ");
    fitStatus.className = "msg";
  }
}

async function refreshFit() {
  if (!entitlementOk || !profile?.fullName || !profile?.linkedinUrl) {
    clearFit();
    return;
  }
  const req = ++fitRequestId;
  fitBlock.classList.remove("hidden");
  fitStatus.textContent = "Scoring ICP fit…";
  fitStatus.className = "msg";
  try {
    const res = await fetch(`${apiOrigin}${cfg.FIT_PATH}`, {
      method: "POST",
      headers: apiHeaders(true),
      body: JSON.stringify({
        linkedinUrl: profile.linkedinUrl,
        fullName: profile.fullName,
        firstName: profile.firstName,
        jobTitle: profile.jobTitle,
        businessName: profile.businessName,
        headline: profile.headline,
        location: profile.location,
        about: profile.about,
        connectionDegree: profile.connectionDegree ?? null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (req !== fitRequestId) return;
    if (!res.ok) {
      fitStatus.textContent = body.error || "Couldn’t score fit.";
      fitStatus.className = "msg err";
      return;
    }
    fitStatus.textContent = "";
    renderFit(body.fit || {});
  } catch {
    if (req !== fitRequestId) return;
    fitStatus.textContent = "Couldn’t score fit.";
    fitStatus.className = "msg err";
  }
}

function renderProfile(next) {
  profile = next;
  workspaceLink.classList.add("hidden");
  workspaceLink.innerHTML = "";
  setSaveStatus("");
  clearFit();

  if (!profile?.linkedinUrl) {
    profileEmpty.classList.remove("hidden");
    profileBlock.classList.add("hidden");
    profileEmpty.innerHTML =
      "<p>Open a LinkedIn or Sales Navigator lead page, then hit <strong>Refresh</strong>.</p>";
    updateActionEnabled();
    return;
  }

  if (!profile.fullName) {
    profileEmpty.classList.remove("hidden");
    profileBlock.classList.add("hidden");
    profileEmpty.innerHTML =
      "<p>Profile page is still loading. Hit <strong>Refresh</strong> in a moment.</p>";
    updateActionEnabled();
    return;
  }

  profileEmpty.classList.add("hidden");
  profileBlock.classList.remove("hidden");
  pName.textContent = profile.fullName;
  pMeta.textContent = [
    profile.jobTitle || profile.headline,
    profile.businessName,
    profile.location,
  ]
    .filter(Boolean)
    .join(" · ");
  if (!pMeta.textContent) {
    pMeta.textContent = "Details still loading — hit Refresh";
  }
  updateActionEnabled();
  if (entitlementOk && !profileLooksThin(profile)) void refreshFit();
}

function updateActionEnabled() {
  const ready = Boolean(
    entitlementOk && profile?.fullName && profile?.linkedinUrl
  );
  saveBtn.disabled = !ready;
  draftConnector.disabled = !ready;
  draftDm.disabled = !ready;
}

function profileLooksThin(p) {
  if (!p?.fullName) return true;
  return !(p.headline || p.jobTitle || p.businessName || p.about);
}

async function refreshProfile() {
  profileEmpty.classList.remove("hidden");
  profileBlock.classList.add("hidden");
  profileEmpty.innerHTML = "<p>Reading LinkedIn…</p>";

  let res = await chrome.runtime.sendMessage({ type: "READ_ACTIVE_PROFILE" });
  for (let i = 0; i < 4 && res?.ok && profileLooksThin(res.profile); i++) {
    profileEmpty.innerHTML = "<p>Waiting for profile details…</p>";
    await new Promise((r) => setTimeout(r, 900));
    res = await chrome.runtime.sendMessage({ type: "READ_ACTIVE_PROFILE" });
  }

  if (!res?.ok) {
    profileEmpty.innerHTML = `<p>${res?.error || "Couldn’t read this page."}</p>`;
    profile = null;
    updateActionEnabled();
    return;
  }
  profileTabId = res.tabId ?? null;
  renderProfile(res.profile);
  if (profileLooksThin(res.profile)) {
    fitBlock.classList.remove("hidden");
    fitStatus.textContent =
      "Only saw a name so far — scroll the LinkedIn profile a bit, then hit Refresh.";
    fitStatus.className = "msg warn";
  }
}

async function refreshAuth() {
  setPill("Checking login…");
  entitlementOk = false;
  accessToken = null;
  apiOrigin = null;
  updateActionEnabled();

  const stored = await chrome.storage.local.get(["impersonateCoachId"]);
  if (stored.impersonateCoachId) {
    impersonateCoachId = stored.impersonateCoachId;
  }

  const auth = await chrome.runtime.sendMessage({
    type: "FIND_ACCESS_TOKEN",
    origin: originEl.value || cfg.DEFAULT_ORIGIN,
  });

  if (!auth?.ok) {
    setPill(auth?.error || "Sign in to Profit Coach in another tab.", "err");
    return;
  }

  accessToken = auth.accessToken;
  apiOrigin = auth.originUsed || originEl.value;

  try {
    const res = await fetch(`${apiOrigin}${cfg.ACCESS_PATH}`, {
      headers: apiHeaders(),
      cache: "no-store",
    });

    if (res.status === 404) {
      setPill(
        "This site doesn’t have the extension API yet — switch Settings → Local dev (with npm run dev).",
        "warn"
      );
      return;
    }

    const body = await res.json().catch(() => ({}));

    if (Array.isArray(body.coaches) && body.coaches.length) {
      fillCoachSelect(body.coaches, body.actingAsCoachId || impersonateCoachId);
    } else if (body.role !== "admin") {
      coachWrap.classList.add("hidden");
    }

    if (res.ok && body.allowed) {
      entitlementOk = true;
      if (body.actingAsCoachId) {
        impersonateCoachId = body.actingAsCoachId;
        chrome.storage.local.set({ impersonateCoachId });
      }
      const asLabel =
        body.role === "admin" && coachSelect.selectedOptions[0]
          ? ` as ${coachSelect.selectedOptions[0].textContent}`
          : "";
      setPill(`Connected${asLabel}`, "ok");
      updateActionEnabled();
      if (profile?.fullName && profile?.linkedinUrl) void refreshFit();
      return;
    }

    if (body.code === "need_coach") {
      fillCoachSelect(body.coaches || [], impersonateCoachId);
      setPill("Choose a coach above to test as them", "warn");
    } else if (body.code === "tier_required") {
      setPill("Upgrade needed for Save & Draft", "warn");
    } else if (body.code === "allowlist") {
      setPill("Beta not enabled for this account", "warn");
    } else {
      setPill(body.error || "Not authorized", "err");
    }
  } catch {
    setPill("Can’t reach Profit Coach", "err");
  }
  updateActionEnabled();
}

async function onSave() {
  if (!entitlementOk || !profile || !accessToken || !apiOrigin) return;
  saveBtn.disabled = true;
  setSaveStatus("Saving…");
  try {
    const res = await fetch(`${apiOrigin}${cfg.SAVE_PATH}`, {
      method: "POST",
      headers: apiHeaders(true),
      body: JSON.stringify({
        linkedinUrl: profile.linkedinUrl,
        fullName: profile.fullName,
        jobTitle: profile.jobTitle,
        businessName: profile.businessName,
        headline: profile.headline,
        location: profile.location,
        about: profile.about,
        photoUrl: profile.photoUrl,
        prospectStatus: stageEl.value || "new",
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (body.code === "need_coach") {
        fillCoachSelect(body.coaches || [], impersonateCoachId);
        setPill("Choose a coach above to test as them", "warn");
        entitlementOk = false;
      }
      throw new Error(body.error || `Save failed (${res.status}).`);
    }
    setSaveStatus(body.created ? "Saved." : "Updated.", "ok");
    if (body.workspaceUrl) {
      workspaceLink.classList.remove("hidden");
      workspaceLink.innerHTML = `<a href="${body.workspaceUrl}" target="_blank" rel="noreferrer">Open prospect →</a>`;
    }
  } catch (err) {
    setSaveStatus(err instanceof Error ? err.message : "Save failed.", "err");
  } finally {
    updateActionEnabled();
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

async function onDraft(kind) {
  if (!entitlementOk || !profile || !accessToken || !apiOrigin) return;
  draftConnector.disabled = true;
  draftDm.disabled = true;
  draftsEl.innerHTML = "";
  setDraftStatus("Writing…");
  try {
    const res = await fetch(`${apiOrigin}${cfg.DRAFT_PATH}`, {
      method: "POST",
      headers: apiHeaders(true),
      body: JSON.stringify({
        kind,
        fullName: profile.fullName,
        firstName: profile.firstName,
        jobTitle: profile.jobTitle,
        businessName: profile.businessName,
        headline: profile.headline,
        location: profile.location,
        about: profile.about,
        linkedinUrl: profile.linkedinUrl,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || `Draft failed (${res.status}).`);
    }
    const variants = Array.isArray(body.variants) ? body.variants : [];
    if (!variants.length) throw new Error("No drafts returned.");
    setDraftStatus("Pick one — you still click Send on LinkedIn.", "ok");
    for (const v of variants) {
      const card = document.createElement("div");
      card.className = "draft";
      const title = document.createElement("h3");
      title.textContent = v.label || "Option";
      const pre = document.createElement("pre");
      pre.textContent = v.body || "";
      const actions = document.createElement("div");
      actions.className = "draft-actions";
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "secondary";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", () => {
        void copyText(v.body || "").then(() => setDraftStatus("Copied.", "ok"));
      });
      const insertBtn = document.createElement("button");
      insertBtn.type = "button";
      insertBtn.className = "secondary";
      insertBtn.textContent = "Insert";
      insertBtn.addEventListener("click", () => {
        void chrome.runtime
          .sendMessage({
            type: "INSERT_LINKEDIN_TEXT",
            text: v.body || "",
            tabId: profileTabId,
          })
          .then((r) => {
            if (r?.ok)
              setDraftStatus("Inserted — click Send on LinkedIn.", "ok");
            else {
              void copyText(v.body || "");
              setDraftStatus(
                (r?.error || "Couldn’t insert.") + " Copied instead.",
                "warn"
              );
            }
          });
      });
      const useAsConnectNote = document.createElement("button");
      useAsConnectNote.type = "button";
      useAsConnectNote.className = "secondary";
      useAsConnectNote.textContent = "Use for Connect";
      useAsConnectNote.addEventListener("click", () => {
        connectWithNote.checked = true;
        connectNoteText.classList.remove("hidden");
        connectNoteText.value = (v.body || "").slice(0, 300);
        switchTab("connect");
        setDraftStatus("Note loaded on Connect tab.", "ok");
      });
      if (kind === "connector") {
        actions.style.gridTemplateColumns = "1fr 1fr 1fr";
        actions.append(copyBtn, insertBtn, useAsConnectNote);
      } else {
        actions.append(copyBtn, insertBtn);
      }
      card.append(title, pre, actions);
      draftsEl.appendChild(card);
    }
  } catch (err) {
    setDraftStatus(err instanceof Error ? err.message : "Draft failed.", "err");
  } finally {
    updateActionEnabled();
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "PROFILE_UPDATED" && message.profile) {
    renderProfile(message.profile);
  }
  if (message?.type === "CONNECT_STATUS_UPDATED" && message.payload) {
    applyConnectPayload(message.payload);
  }
});

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

fillOrigins();
saveBtn.addEventListener("click", () => void onSave());
draftConnector.addEventListener("click", () => void onDraft("connector"));
draftDm.addEventListener("click", () => void onDraft("dm"));
inboxSyncBtn.addEventListener("click", () => void onInboxSync());
connectStartBtn.addEventListener("click", () => void onConnectStart());
connectStopBtn.addEventListener("click", () => void onConnectStop());
connectThisBtn.addEventListener("click", () => void onConnectThisProfile());
clearConnectLogBtn.addEventListener("click", () => {
  connectLog = [];
  chrome.storage.session.set({ connectActivityLog: [] });
  renderConnectLog();
});
connectWithNote.addEventListener("change", () => {
  connectNoteText.classList.toggle("hidden", !connectWithNote.checked);
});
for (const el of [
  connectDailyCap,
  connectMaxPerRun,
  connectDelayMin,
  connectDelayMax,
]) {
  el.addEventListener("change", () => persistConnectSettings());
}
reloadBtn.addEventListener("click", () => {
  void (async () => {
    await refreshProfile();
    await refreshAuth();
    await refreshConnectStatus();
  })();
});

void (async () => {
  await new Promise((r) => setTimeout(r, 50));
  if (!originEl.value) originEl.value = cfg.DEFAULT_ORIGIN;
  const stored = await chrome.storage.local.get(["sidepanelTab"]);
  if (stored.sidepanelTab && TAB_TITLES[stored.sidepanelTab]) {
    switchTab(stored.sidepanelTab);
  }
  await loadConnectLog();
  await Promise.all([refreshProfile(), refreshAuth(), refreshConnectStatus()]);
})();
