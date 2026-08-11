/**
 * Sales Navigator people search / lead list: paced More → Connect → Send invite.
 * Runs only when the side panel starts a session on this tab.
 */

(function () {
  if (window.__pcSnConnectInstalled) return;
  window.__pcSnConnectInstalled = true;

  const DEFAULTS = {
    dailyCap: 25,
    delayMinMs: 8_000,
    delayMaxMs: 18_000,
    maxPerRun: 5,
  };

  /** @type {null | { abort: boolean }} */
  let runCtrl = null;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function randBetween(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
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

  function emit(type, payload = {}) {
    try {
      chrome.runtime.sendMessage({ type, ...payload }).catch(() => {});
    } catch {
      // extension context gone
    }
  }

  function dayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  async function loadStats() {
    const stored = await chrome.storage.local.get([
      "connectDayKey",
      "connectSentToday",
      "connectSettings",
    ]);
    const key = dayKey();
    let sent = Number(stored.connectSentToday) || 0;
    if (stored.connectDayKey !== key) {
      sent = 0;
      await chrome.storage.local.set({
        connectDayKey: key,
        connectSentToday: 0,
      });
    }
    const settings = { ...DEFAULTS, ...(stored.connectSettings || {}) };
    return { sentToday: sent, settings, dayKey: key };
  }

  async function bumpSent() {
    const { sentToday, dayKey: key } = await loadStats();
    const next = sentToday + 1;
    await chrome.storage.local.set({
      connectDayKey: key,
      connectSentToday: next,
    });
    return next;
  }

  function findResultRows() {
    const selectors = [
      "ol.artdeco-list > li.artdeco-list__item",
      "ul.artdeco-list > li.artdeco-list__item",
      "[data-x--search-result]",
      "li.artdeco-list__item",
      '[data-view-name="search-results-entity"]',
      ".entity-result",
    ];
    /** @type {HTMLElement[]} */
    const rows = [];
    const seen = new Set();
    for (const sel of selectors) {
      let nodes;
      try {
        nodes = document.querySelectorAll(sel);
      } catch {
        continue;
      }
      for (const node of nodes) {
        if (!(node instanceof HTMLElement) || !isVisible(node)) continue;
        if (seen.has(node)) continue;
        // Prefer leaf-ish rows that look like people cards
        const text = cleanText(node.innerText).slice(0, 80);
        if (text.length < 8) continue;
        if (/^filters?$|^sort by/i.test(text)) continue;
        seen.add(node);
        rows.push(node);
      }
      if (rows.length >= 5) break;
    }
    // Deduplicate nested: keep outermost only
    return rows.filter((row) => !rows.some((other) => other !== row && other.contains(row)));
  }

  function rowName(row) {
    const link =
      row.querySelector('a[data-control-name*="view_lead"], a[href*="/sales/lead/"], a[href*="/sales/people/"]') ||
      row.querySelector("a[href*='/sales/']");
    const fromLink = cleanText(link?.innerText || "").split("\n")[0];
    if (fromLink && fromLink.length > 1 && fromLink.length < 80) return fromLink;
    const heading = row.querySelector("span[data-anonymize='person-name'], .artdeco-entity-lockup__title");
    const t = cleanText(heading?.innerText || "").split("\n")[0];
    return t || "Lead";
  }

  function rowAlreadyPendingOrConnected(row) {
    const t = cleanText(row.innerText).toLowerCase();
    if (/\bpending\b/.test(t) && /connect|invite|message/.test(t)) return "pending";
    if (/\b1st\b/.test(t) || /\bconnected\b/.test(t)) return "connected";
    // Explicit pending CTA
    const pendingBtn = [...row.querySelectorAll("button, a, span")].find((el) =>
      /^pending$/i.test(cleanText(el.textContent))
    );
    if (pendingBtn && isVisible(pendingBtn)) return "pending";
    return null;
  }

  function clickLikeHuman(el) {
    if (!(el instanceof HTMLElement)) return false;
    el.scrollIntoView({ block: "center", inline: "nearest" });
    el.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window, buttons: 1 })
    );
    el.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window, buttons: 1 })
    );
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: window, buttons: 1 })
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

  function findMoreButton(row) {
    const candidates = [
      ...row.querySelectorAll(
        'button[aria-label*="More" i], button[id*="hue-menu-trigger" i], button[aria-label*="overflow" i], button[aria-label*="Open actions" i]'
      ),
      ...row.querySelectorAll("button"),
    ];
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const aria = cleanText(el.getAttribute("aria-label") || "");
      const text = cleanText(el.innerText || el.textContent);
      if (/more actions|open actions|overflow|show more/i.test(aria)) return el;
      if (/^more$/i.test(text) || /^more$/i.test(aria)) return el;
      // Icon-only overflow often has aria with person's name
      if (/more/i.test(aria) && !/message|save|inmail/i.test(aria)) return el;
    }
    // Last resort: last icon button in the row action strip
    const iconBtns = [...row.querySelectorAll("button")].filter(isVisible);
    const overflow = iconBtns.find((b) => {
      const aria = (b.getAttribute("aria-label") || "").toLowerCase();
      return aria.includes("more") || b.querySelector('svg[data-test-icon*="overflow" i], li-icon[type*="overflow"]');
    });
    return overflow || null;
  }

  function findConnectControl(scope) {
    const root = scope || document;
    const nodes = [
      ...root.querySelectorAll(
        '[role="menuitem"], [role="option"], a[role="menuitem"], button, a, div[role="button"]'
      ),
    ];
    for (const el of nodes) {
      if (!isVisible(el)) continue;
      const aria = cleanText(el.getAttribute("aria-label") || "");
      const text = cleanText(el.innerText || el.textContent);
      if (/invite .+ to connect/i.test(aria)) return el;
      if (/^connect$/i.test(text) || /^connect$/i.test(aria)) return el;
      if (/^invite$/i.test(text) && /connect/i.test(aria || text)) return el;
      if (/to connect/i.test(aria) && !/message|inmail|follow/i.test(aria)) return el;
    }
    return null;
  }

  function findDirectConnectInRow(row) {
    return findConnectControl(row);
  }

  function inviteModalOpen() {
    const dialogs = document.querySelectorAll('div[role="dialog"], .artdeco-modal, .send-invite');
    for (const d of dialogs) {
      if (!(d instanceof HTMLElement) || !isVisible(d)) continue;
      const t = cleanText(d.innerText);
      if (/add a note|send without a note|send invitation|how do you know/i.test(t)) {
        return d;
      }
    }
    return null;
  }

  function findSendButton(dialog) {
    const root = dialog || document;
    const buttons = [...root.querySelectorAll("button")];
    const prefer = [
      /^send without a note$/i,
      /^send invitation$/i,
      /^send invite$/i,
      /^send$/i,
    ];
    for (const re of prefer) {
      for (const btn of buttons) {
        if (!isVisible(btn)) continue;
        const aria = cleanText(btn.getAttribute("aria-label") || "");
        const text = cleanText(btn.innerText || btn.textContent);
        if (re.test(aria) || re.test(text)) return btn;
      }
    }
    return null;
  }

  function detectInviteLimit() {
    const text = cleanText(document.body?.innerText || "").slice(0, 12_000);
    const patterns = [
      /weekly invitation limit/i,
      /you've reached the weekly/i,
      /you.?ve reached linkedin.?s limit/i,
      /too many invitations/i,
      /invitation limit/i,
      /unable to send invitation/i,
      /limit on invitations/i,
    ];
    return patterns.some((re) => re.test(text));
  }

  function dismissOpenMenus() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true })
    );
  }

  async function waitFor(predicate, timeoutMs, stepMs = 200) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (runCtrl?.abort) return null;
      const v = predicate();
      if (v) return v;
      await sleep(stepMs);
    }
    return null;
  }

  async function connectOneRow(row) {
    const name = rowName(row);
    const skip = rowAlreadyPendingOrConnected(row);
    if (skip) {
      return { status: "skipped", name, detail: skip };
    }

    row.scrollIntoView({ block: "center", inline: "nearest" });
    await sleep(400);

    // Prefer More → Connect (Sales Nav list UX); fall back to direct Connect in row
    let opened = false;
    const more = findMoreButton(row);
    if (more) {
      clickLikeHuman(more);
      await sleep(700);
      const menuConnect = await waitFor(() => findConnectControl(document), 4_000);
      if (menuConnect) {
        clickLikeHuman(menuConnect);
        opened = true;
      } else {
        dismissOpenMenus();
        await sleep(300);
      }
    }

    if (!opened) {
      const direct = findDirectConnectInRow(row);
      if (direct) {
        clickLikeHuman(direct);
        opened = true;
      }
    }

    if (!opened) {
      return { status: "skipped", name, detail: "no_connect_control" };
    }

    const dialog = await waitFor(() => inviteModalOpen(), 10_000);
    if (!dialog) {
      if (detectInviteLimit()) {
        return { status: "limit", name, detail: "invitation_limit" };
      }
      // Sometimes invite sends without modal when already warmed — treat as miss
      return { status: "error", name, detail: "modal_not_found" };
    }

    if (detectInviteLimit()) {
      return { status: "limit", name, detail: "invitation_limit" };
    }

    const sendBtn = findSendButton(dialog);
    if (!sendBtn) {
      return { status: "error", name, detail: "send_button_not_found" };
    }

    clickLikeHuman(sendBtn);
    await sleep(900);

    if (detectInviteLimit()) {
      return { status: "limit", name, detail: "invitation_limit_after_send" };
    }

    // Close leftover dialog if still open
    const still = inviteModalOpen();
    if (still) {
      const cancel = [...still.querySelectorAll("button")].find((b) =>
        /^(cancel|dismiss|close)$/i.test(cleanText(b.innerText || b.getAttribute("aria-label")))
      );
      if (cancel) clickLikeHuman(cancel);
      else dismissOpenMenus();
    }

    return { status: "sent", name, detail: "ok" };
  }

  async function ensureRowsLoaded(minCount) {
    let rows = findResultRows();
    let scrolls = 0;
    while (rows.length < minCount && scrolls < 6) {
      window.scrollBy(0, Math.floor(window.innerHeight * 0.7));
      await sleep(900);
      rows = findResultRows();
      scrolls += 1;
    }
    return rows;
  }

  async function runConnectSession(opts = {}) {
    if (runCtrl && !runCtrl.abort) {
      return { ok: false, error: "Already running on this page." };
    }

    const { sentToday, settings } = await loadStats();
    const dailyCap = Math.max(1, Number(opts.dailyCap) || settings.dailyCap);
    const delayMin = Math.max(2_000, Number(opts.delayMinMs) || settings.delayMinMs);
    const delayMax = Math.max(delayMin, Number(opts.delayMaxMs) || settings.delayMaxMs);
    const maxPerRun = Math.max(1, Number(opts.maxPerRun) || settings.maxPerRun);

    if (sentToday >= dailyCap) {
      emit("CONNECT_STATUS", {
        running: false,
        status: "stopped",
        detail: `Daily cap reached (${sentToday}/${dailyCap}).`,
        sentToday,
        dailyCap,
      });
      return { ok: false, error: `Daily cap reached (${sentToday}/${dailyCap}).` };
    }

    runCtrl = { abort: false };
    let sentThisRun = 0;
    let skipped = 0;
    let errors = 0;
    let processed = 0;

    emit("CONNECT_STATUS", {
      running: true,
      status: "running",
      detail: "Scanning Sales Nav results…",
      sentToday,
      dailyCap,
      sentThisRun,
    });

    /** @type {WeakSet<HTMLElement>} */
    const done = new WeakSet();

    try {
      while (!runCtrl.abort) {
        const { sentToday: currentSent } = await loadStats();
        if (currentSent >= dailyCap || sentThisRun >= maxPerRun) {
          emit("CONNECT_STATUS", {
            running: false,
            status: "stopped",
            detail:
              currentSent >= dailyCap
                ? `Daily cap reached (${currentSent}/${dailyCap}).`
                : `Run limit reached (${sentThisRun}/${maxPerRun}).`,
            sentToday: currentSent,
            dailyCap,
            sentThisRun,
            skipped,
            errors,
          });
          break;
        }

        let rows = await ensureRowsLoaded(8);
        const next = rows.find((r) => !done.has(r));
        if (!next) {
          // Try load more / next page
          const loadMore = [...document.querySelectorAll("button")].find((b) =>
            /show more|see more|load more|next/i.test(cleanText(b.innerText || b.getAttribute("aria-label")))
          );
          if (loadMore && isVisible(loadMore)) {
            clickLikeHuman(loadMore);
            await sleep(2_000);
            rows = findResultRows();
            const again = rows.find((r) => !done.has(r));
            if (!again) {
              emit("CONNECT_STATUS", {
                running: false,
                status: "done",
                detail: `Finished visible results. Sent ${sentThisRun} this run.`,
                sentToday: currentSent,
                dailyCap,
                sentThisRun,
                skipped,
                errors,
              });
              break;
            }
            continue;
          }
          emit("CONNECT_STATUS", {
            running: false,
            status: "done",
            detail: `No more connectable rows. Sent ${sentThisRun} this run.`,
            sentToday: currentSent,
            dailyCap,
            sentThisRun,
            skipped,
            errors,
          });
          break;
        }

        done.add(next);
        processed += 1;
        emit("CONNECT_STATUS", {
          running: true,
          status: "working",
          detail: `Connecting ${rowName(next)}…`,
          sentToday: currentSent,
          dailyCap,
          sentThisRun,
          processed,
          skipped,
          errors,
        });

        const result = await connectOneRow(next);

        if (result.status === "limit") {
          emit("CONNECT_STATUS", {
            running: false,
            status: "limit",
            detail: "LinkedIn invitation limit detected — stopped.",
            sentToday: currentSent,
            dailyCap,
            sentThisRun,
            skipped,
            errors,
            lastName: result.name,
          });
          break;
        }

        if (result.status === "sent") {
          sentThisRun += 1;
          const newTotal = await bumpSent();
          emit("CONNECT_STATUS", {
            running: true,
            status: "sent",
            detail: `Sent invite to ${result.name}`,
            sentToday: newTotal,
            dailyCap,
            sentThisRun,
            processed,
            skipped,
            errors,
            lastName: result.name,
          });
          const wait = randBetween(delayMin, delayMax);
          emit("CONNECT_STATUS", {
            running: true,
            status: "waiting",
            detail: `Waiting ${Math.round(wait / 1000)}s before next…`,
            sentToday: newTotal,
            dailyCap,
            sentThisRun,
          });
          await sleep(wait);
        } else if (result.status === "skipped") {
          skipped += 1;
          emit("CONNECT_STATUS", {
            running: true,
            status: "skipped",
            detail: `Skipped ${result.name} (${result.detail})`,
            sentToday: currentSent,
            dailyCap,
            sentThisRun,
            processed,
            skipped,
            errors,
            lastName: result.name,
          });
          await sleep(randBetween(600, 1_400));
        } else {
          errors += 1;
          emit("CONNECT_STATUS", {
            running: true,
            status: "error",
            detail: `${result.name}: ${result.detail}`,
            sentToday: currentSent,
            dailyCap,
            sentThisRun,
            processed,
            skipped,
            errors,
            lastName: result.name,
          });
          await sleep(randBetween(1_500, 3_000));
          if (errors >= 5) {
            emit("CONNECT_STATUS", {
              running: false,
              status: "stopped",
              detail: "Too many errors — stopped. Refresh the Sales Nav page and try again.",
              sentToday: currentSent,
              dailyCap,
              sentThisRun,
              skipped,
              errors,
            });
            break;
          }
        }
      }
    } finally {
      runCtrl = null;
    }

    return { ok: true, sentThisRun, skipped, errors };
  }

  function stopConnectSession() {
    if (runCtrl) runCtrl.abort = true;
    emit("CONNECT_STATUS", {
      running: false,
      status: "stopped",
      detail: "Stopped.",
    });
    return { ok: true };
  }

  function isSearchOrListPage() {
    return /\/sales\/(search\/people|lists\/people|lists\/lead)/i.test(
      window.location.pathname || ""
    );
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "SN_CONNECT_START") {
      if (!isSearchOrListPage()) {
        sendResponse({
          ok: false,
          error:
            "Open a Sales Navigator people search or lead list, then start again.",
        });
        return false;
      }
      // Ack immediately — the run can last many minutes (Chrome message timeout).
      sendResponse({ ok: true, started: true });
      void runConnectSession(message.options || {});
      return false;
    }
    if (message?.type === "SN_CONNECT_STOP") {
      sendResponse(stopConnectSession());
      return false;
    }
    if (message?.type === "SN_CONNECT_PING") {
      sendResponse({
        ok: true,
        pageOk: isSearchOrListPage(),
        running: Boolean(runCtrl && !runCtrl.abort),
        href: window.location.href,
      });
      return false;
    }
    return false;
  });
})();
