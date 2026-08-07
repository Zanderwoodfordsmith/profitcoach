/* global PC_LINKEDIN_EXT */

const cfg = globalThis.PC_LINKEDIN_EXT;

const originEl = document.getElementById("origin");
const authStatusEl = document.getElementById("authStatus");
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

const FIT_LABELS = {
  very_weak: "Very weak",
  weak: "Weak",
  okay: "Okay",
  strong: "Strong",
  ideal: "Ideal",
};

function fitLabelFromScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "okay";
  if (n >= 80) return "ideal";
  if (n >= 60) return "strong";
  if (n >= 40) return "okay";
  if (n >= 20) return "weak";
  return "very_weak";
}

let profile = null;
let accessToken = null;
let apiOrigin = null;
let entitlementOk = false;
let profileTabId = null;
let impersonateCoachId = null;
let fitRequestId = 0;

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
  // LinkedIn often paints the card late — retry a few times before scoring.
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
        "This site doesn’t have the extension API yet — switch Advanced → Local dev (with npm run dev).",
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
            if (r?.ok) setDraftStatus("Inserted — click Send on LinkedIn.", "ok");
            else {
              void copyText(v.body || "");
              setDraftStatus(
                (r?.error || "Couldn’t insert.") + " Copied instead.",
                "warn"
              );
            }
          });
      });
      actions.append(copyBtn, insertBtn);
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
});

fillOrigins();
saveBtn.addEventListener("click", () => void onSave());
draftConnector.addEventListener("click", () => void onDraft("connector"));
draftDm.addEventListener("click", () => void onDraft("dm"));
reloadBtn.addEventListener("click", () => {
  void (async () => {
    await refreshProfile();
    await refreshAuth();
  })();
});

void (async () => {
  await new Promise((r) => setTimeout(r, 50));
  if (!originEl.value) originEl.value = cfg.DEFAULT_ORIGIN;
  await Promise.all([refreshProfile(), refreshAuth()]);
})();
