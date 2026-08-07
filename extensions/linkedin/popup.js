/* global PC_LINKEDIN_EXT */

const statusEl = document.getElementById("status");
const accessEl = document.getElementById("access");
const originEl = document.getElementById("origin");
const saveBtn = document.getElementById("save");
const copyBtn = document.getElementById("copy");
const openPanelBtn = document.getElementById("openPanel");

const cfg = globalThis.PC_LINKEDIN_EXT;

function setStatus(text, kind) {
  statusEl.textContent = text || "";
  statusEl.className = "status" + (kind ? ` ${kind}` : "");
}

function setAccess(text, kind) {
  accessEl.textContent = text || "";
  accessEl.className = "status" + (kind ? ` ${kind}` : "");
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
    void refreshAccess();
  });
}

originEl.addEventListener("change", () => {
  const choice =
    cfg.APP_CHOICES.find((c) => c.origin === originEl.value) ||
    cfg.APP_CHOICES[0];
  chrome.storage.local.set({ preferredAppId: choice.id });
  void refreshAccess();
});

async function getLinkedInCookieJson() {
  const res = await chrome.runtime.sendMessage({ type: "GET_LINKEDIN_COOKIES" });
  if (!res?.ok) throw new Error(res?.error || "Could not read LinkedIn cookies.");
  return JSON.stringify(res.cookies);
}

async function copyToClipboard(text) {
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

async function refreshAccess() {
  setAccess("Checking…");
  const auth = await chrome.runtime.sendMessage({
    type: "FIND_ACCESS_TOKEN",
    origin: originEl.value || cfg.DEFAULT_ORIGIN,
  });
  if (!auth?.ok) {
    setAccess(auth?.error || "Sign in to Profit Coach in another tab.", "err");
    return;
  }
  try {
    const res = await fetch(
      `${auth.originUsed || originEl.value}${cfg.ACCESS_PATH}`,
      {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
        cache: "no-store",
      }
    );
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.allowed) {
      setAccess("Connected — ready to save & draft", "ok");
      return;
    }
    if (body.code === "tier_required") {
      setAccess("Upgrade needed for Save & Draft.", "err");
    } else if (body.code === "allowlist") {
      setAccess("Beta not enabled for this account.", "err");
    } else {
      setAccess(body.error || "Not authorized.", "err");
    }
  } catch {
    setAccess("Can’t reach Profit Coach.", "err");
  }
}

async function onCopy() {
  copyBtn.disabled = true;
  saveBtn.disabled = true;
  setStatus("Reading cookies…");
  try {
    const json = await getLinkedInCookieJson();
    await copyToClipboard(json);
    setStatus("Copied.", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Copy failed.", "err");
  } finally {
    copyBtn.disabled = false;
    saveBtn.disabled = false;
  }
}

async function onSave() {
  copyBtn.disabled = true;
  saveBtn.disabled = true;
  setStatus("Saving session…");
  try {
    const cookie = await getLinkedInCookieJson();
    const auth = await chrome.runtime.sendMessage({
      type: "FIND_ACCESS_TOKEN",
      origin: originEl.value || cfg.DEFAULT_ORIGIN,
    });
    if (!auth?.ok) {
      await copyToClipboard(cookie);
      setStatus(`${auth?.error || "Not signed in."} Cookies copied.`, "err");
      return;
    }
    const apiOrigin = auth.originUsed || originEl.value;
    const res = await fetch(`${apiOrigin}${cfg.SESSION_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cookie,
        userAgent: navigator.userAgent,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      await copyToClipboard(cookie);
      throw new Error(
        (body.error || `Save failed (${res.status}).`) + " Cookies copied."
      );
    }
    setStatus("Sales Nav session saved.", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Save failed.", "err");
  } finally {
    copyBtn.disabled = false;
    saveBtn.disabled = false;
  }
}

async function onOpenPanel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setAccess("No active tab.", "err");
    return;
  }
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    window.close();
  } catch (err) {
    setAccess(
      err instanceof Error ? err.message : "Could not open side panel.",
      "err"
    );
  }
}

fillOrigins();
copyBtn.addEventListener("click", () => void onCopy());
saveBtn.addEventListener("click", () => void onSave());
openPanelBtn.addEventListener("click", () => void onOpenPanel());
