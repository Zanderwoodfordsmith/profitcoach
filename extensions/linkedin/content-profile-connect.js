/**
 * Single-profile connection request on /in/… or Sales Nav lead pages.
 * Used for testing Connect without a Sales Nav search list.
 */

(function () {
  if (window.__pcProfileConnectInstalled) return;
  window.__pcProfileConnectInstalled = true;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function cleanText(raw) {
    return String(raw || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number(style.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  }

  function dayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  async function bumpSent() {
    const stored = await chrome.storage.local.get([
      "connectDayKey",
      "connectSentToday",
    ]);
    const key = dayKey();
    let sent = Number(stored.connectSentToday) || 0;
    if (stored.connectDayKey !== key) sent = 0;
    const next = sent + 1;
    await chrome.storage.local.set({
      connectDayKey: key,
      connectSentToday: next,
    });
    return next;
  }

  function clickLikeHuman(el) {
    if (!(el instanceof HTMLElement)) return false;
    el.scrollIntoView({ block: "center", inline: "nearest" });
    el.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        view: window,
        buttons: 1,
      })
    );
    el.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        view: window,
        buttons: 1,
      })
    );
    el.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
        buttons: 1,
      })
    );
    if (typeof el.click === "function") {
      try {
        el.click();
      } catch {
        // ignore
      }
    }
    return true;
  }

  function pageKind() {
    const path = window.location.pathname || "";
    if (/\/sales\/(lead|people)\//i.test(path)) return "sales_nav";
    if (/\/in\//i.test(path)) return "profile";
    return null;
  }

  function profileAlreadyConnected() {
    const body = cleanText(document.body?.innerText || "").slice(0, 8_000).toLowerCase();
    if (/\bpending\b/.test(body) && /invitation|connect/.test(body)) {
      const pendingBtn = [...document.querySelectorAll("button")].find(
        (b) => isVisible(b) && /^pending$/i.test(cleanText(b.innerText))
      );
      if (pendingBtn) return "pending";
    }
    const degree = [...document.querySelectorAll("span, button")].find((el) => {
      if (!isVisible(el)) return false;
      return /^1st\b/i.test(cleanText(el.textContent));
    });
    if (degree) return "connected";
    return null;
  }

  function findConnectButton() {
    const buttons = [...document.querySelectorAll("button, a[role='button']")];
    for (const el of buttons) {
      if (!isVisible(el)) continue;
      const aria = cleanText(el.getAttribute("aria-label") || "");
      const text = cleanText(el.innerText || el.textContent);
      if (/invite .+ to connect/i.test(aria)) return el;
      if (/^connect$/i.test(text) || /^connect$/i.test(aria)) return el;
      if (/^invite$/i.test(text) && /connect/i.test(aria)) return el;
    }
    return null;
  }

  function findMoreActionsButton() {
    const buttons = [...document.querySelectorAll("button")];
    for (const el of buttons) {
      if (!isVisible(el)) continue;
      const aria = cleanText(el.getAttribute("aria-label") || "");
      const text = cleanText(el.innerText || el.textContent);
      if (/more actions|open actions|overflow/i.test(aria)) return el;
      if (/^more$/i.test(text) || /^more$/i.test(aria)) return el;
      if (/more/i.test(aria) && !/message|save|inmail|follow/i.test(aria)) {
        return el;
      }
    }
    return null;
  }

  function findConnectInMenu() {
    const nodes = [
      ...document.querySelectorAll(
        '[role="menuitem"], [role="option"], a[role="menuitem"], button, a, div[role="button"]'
      ),
    ];
    for (const el of nodes) {
      if (!isVisible(el)) continue;
      const aria = cleanText(el.getAttribute("aria-label") || "");
      const text = cleanText(el.innerText || el.textContent);
      if (/invite .+ to connect/i.test(aria)) return el;
      if (/^connect$/i.test(text) || /^connect$/i.test(aria)) return el;
      if (/to connect/i.test(aria) && !/message|inmail|follow/i.test(aria)) {
        return el;
      }
    }
    return null;
  }

  function inviteModalOpen() {
    const dialogs = document.querySelectorAll(
      'div[role="dialog"], .artdeco-modal, .send-invite'
    );
    for (const d of dialogs) {
      if (!(d instanceof HTMLElement) || !isVisible(d)) continue;
      const t = cleanText(d.innerText);
      if (
        /add a note|send without a note|send invitation|how do you know/i.test(
          t
        )
      ) {
        return d;
      }
    }
    return null;
  }

  function findAddNoteButton(dialog) {
    const root = dialog || document;
    return (
      [...root.querySelectorAll("button")].find((btn) => {
        if (!isVisible(btn)) return false;
        const aria = cleanText(btn.getAttribute("aria-label") || "");
        const text = cleanText(btn.innerText || btn.textContent);
        return /^add a note$/i.test(text) || /^add a note$/i.test(aria);
      }) || null
    );
  }

  function findNoteField(dialog) {
    const root = dialog || document;
    const selectors = [
      "textarea.connect-button-send-invite__custom-message",
      'textarea[name="message"]',
      "textarea",
      '[contenteditable="true"]',
    ];
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  function fillNote(el, text) {
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    try {
      document.execCommand("selectAll", false);
      document.execCommand("insertText", false, text);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
    } catch {
      el.textContent = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function findSendButton(dialog, withNote) {
    const root = dialog || document;
    const buttons = [...root.querySelectorAll("button")];
    const prefer = withNote
      ? [/^send invitation$/i, /^send invite$/i, /^send$/i]
      : [
          /^send without a note$/i,
          /^send invitation$/i,
          /^send invite$/i,
          /^send$/i,
        ];
    for (const re of prefer) {
      for (const btn of buttons) {
        if (!isVisible(btn)) continue;
        if (btn.disabled) continue;
        const aria = cleanText(btn.getAttribute("aria-label") || "");
        const text = cleanText(btn.innerText || btn.textContent);
        if (re.test(aria) || re.test(text)) return btn;
      }
    }
    return null;
  }

  function detectInviteLimit() {
    const text = cleanText(document.body?.innerText || "").slice(0, 12_000);
    return [
      /weekly invitation limit/i,
      /you've reached the weekly/i,
      /you.?ve reached linkedin.?s limit/i,
      /too many invitations/i,
      /invitation limit/i,
      /unable to send invitation/i,
    ].some((re) => re.test(text));
  }

  function dismissOpenMenus() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        bubbles: true,
      })
    );
  }

  async function waitFor(predicate, timeoutMs, stepMs = 200) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const v = predicate();
      if (v) return v;
      await sleep(stepMs);
    }
    return null;
  }

  function displayName() {
    const h1 = document.querySelector("h1");
    const t = cleanText(h1?.innerText || "").split("\n")[0];
    if (t && t.length < 80) return t;
    return "this profile";
  }

  async function sendConnectionRequest(opts = {}) {
    const kind = pageKind();
    if (!kind) {
      return {
        ok: false,
        status: "error",
        detail: "Open a LinkedIn profile (/in/…) or Sales Nav lead page.",
      };
    }

    const note =
      typeof opts.note === "string" ? opts.note.trim().slice(0, 300) : "";
    const withNote = Boolean(note);
    const name = displayName();

    const skip = profileAlreadyConnected();
    if (skip === "pending") {
      return {
        ok: false,
        status: "skipped",
        name,
        detail: "Invitation already pending.",
      };
    }
    if (skip === "connected") {
      return {
        ok: false,
        status: "skipped",
        name,
        detail: "Already a 1st-degree connection.",
      };
    }

    let opened = false;
    const direct = findConnectButton();
    if (direct) {
      clickLikeHuman(direct);
      opened = true;
    } else {
      const more = findMoreActionsButton();
      if (more) {
        clickLikeHuman(more);
        await sleep(700);
        const menuConnect = await waitFor(() => findConnectInMenu(), 4_000);
        if (menuConnect) {
          clickLikeHuman(menuConnect);
          opened = true;
        } else {
          dismissOpenMenus();
        }
      }
    }

    if (!opened) {
      return {
        ok: false,
        status: "error",
        name,
        detail: "Couldn’t find a Connect button on this page.",
      };
    }

    const dialog = await waitFor(() => inviteModalOpen(), 10_000);
    if (!dialog) {
      if (detectInviteLimit()) {
        return {
          ok: false,
          status: "limit",
          name,
          detail: "LinkedIn invitation limit detected.",
        };
      }
      return {
        ok: false,
        status: "error",
        name,
        detail: "Invite modal didn’t open.",
      };
    }

    if (detectInviteLimit()) {
      return {
        ok: false,
        status: "limit",
        name,
        detail: "LinkedIn invitation limit detected.",
      };
    }

    if (withNote) {
      const addNote = findAddNoteButton(dialog);
      if (addNote) {
        clickLikeHuman(addNote);
        await sleep(500);
      }
      const field = await waitFor(() => findNoteField(inviteModalOpen()), 5_000);
      if (!field) {
        return {
          ok: false,
          status: "error",
          name,
          detail: "Couldn’t find the note field.",
        };
      }
      fillNote(field, note);
      await sleep(400);
    }

    const sendBtn = findSendButton(inviteModalOpen() || dialog, withNote);
    if (!sendBtn) {
      return {
        ok: false,
        status: "error",
        name,
        detail: "Couldn’t find Send on the invite modal.",
      };
    }

    clickLikeHuman(sendBtn);
    await sleep(1_000);

    if (detectInviteLimit()) {
      return {
        ok: false,
        status: "limit",
        name,
        detail: "LinkedIn invitation limit after send attempt.",
      };
    }

    const still = inviteModalOpen();
    if (still) {
      // Modal still open often means send failed or needs another click
      const retry = findSendButton(still, withNote);
      if (retry && !retry.disabled) {
        clickLikeHuman(retry);
        await sleep(800);
      }
    }

    const sentToday = await bumpSent();
    return {
      ok: true,
      status: "sent",
      name,
      detail: withNote
        ? `Sent invite with note to ${name}`
        : `Sent invite to ${name}`,
      sentToday,
      withNote,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "PROFILE_CONNECT_PING") {
      sendResponse({
        ok: true,
        pageOk: Boolean(pageKind()),
        kind: pageKind(),
        href: window.location.href,
      });
      return false;
    }
    if (message?.type === "PROFILE_CONNECT_SEND") {
      void sendConnectionRequest(message.options || {})
        .then((res) => sendResponse(res))
        .catch((err) =>
          sendResponse({
            ok: false,
            status: "error",
            detail: err instanceof Error ? err.message : "Connect failed.",
          })
        );
      return true;
    }
    return false;
  });
})();
