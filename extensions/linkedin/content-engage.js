/**
 * Feed comments + messaging reply helpers (human still clicks Post/Send).
 */

(function () {
  const BTN_CLASS = "pc-engage-btn";
  const STYLE_ID = "pc-engage-style";

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${BTN_CLASS} {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 8px;
        border: none;
        border-radius: 999px;
        padding: 4px 10px;
        background: #0c1b2a;
        color: #f8fafc;
        font: 600 12px/1.2 ui-sans-serif, system-ui, sans-serif;
        cursor: pointer;
        white-space: nowrap;
      }
      .${BTN_CLASS}:disabled { opacity: 0.5; cursor: wait; }
      .pc-engage-popover {
        position: absolute;
        z-index: 2147483646;
        width: min(320px, calc(100vw - 24px));
        background: #fff;
        color: #0c1b2a;
        border: 1px solid #e4e9ef;
        border-radius: 12px;
        box-shadow: 0 12px 40px rgba(12,27,42,0.18);
        padding: 12px;
        font: 13px/1.45 ui-sans-serif, system-ui, sans-serif;
      }
      .pc-engage-popover h4 { margin: 0 0 8px; font-size: 12px; }
      .pc-engage-popover pre {
        margin: 0 0 8px;
        white-space: pre-wrap;
        font: inherit;
        background: #f4f6f8;
        border-radius: 8px;
        padding: 8px;
      }
      .pc-engage-popover .row { display: flex; gap: 6px; margin-bottom: 10px; }
      .pc-engage-popover button {
        border: none;
        border-radius: 8px;
        padding: 6px 10px;
        font: 600 12px ui-sans-serif, system-ui, sans-serif;
        cursor: pointer;
        background: #e8f4fa;
        color: #0b6e99;
      }
      .pc-engage-popover .close {
        background: transparent;
        color: #5b6b7c;
        float: right;
        padding: 0 4px;
      }
      .pc-engage-status { font-size: 11px; color: #5b6b7c; margin: 0 0 8px; }
    `;
    document.documentElement.appendChild(style);
  }

  function textOf(el) {
    return (el?.innerText || el?.textContent || "").replace(/\s+/g, " ").trim();
  }

  async function getAuth() {
    const stored = await chrome.storage.local.get([
      "preferredAppId",
      "impersonateCoachId",
    ]);
    const cfg = await new Promise((resolve) => {
      // config not in content script — hardcode choices matching config.js
      const choices = {
        live: "https://www.businesscoachacademy.com",
        local: "http://localhost:3002",
      };
      resolve(choices[stored.preferredAppId] || choices.live);
    });
    const auth = await chrome.runtime.sendMessage({
      type: "FIND_ACCESS_TOKEN",
      origin: cfg,
    });
    if (!auth?.ok) throw new Error(auth?.error || "Sign in to Profit Coach.");
    return {
      accessToken: auth.accessToken,
      apiOrigin: auth.originUsed || cfg,
      impersonateCoachId: stored.impersonateCoachId || null,
    };
  }

  async function callDraftEngage(payload) {
    const auth = await getAuth();
    const headers = {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    };
    if (auth.impersonateCoachId) {
      headers["x-impersonate-coach-id"] = auth.impersonateCoachId;
    }
    const res = await fetch(
      `${auth.apiOrigin}/api/coach/extension/draft-engage`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Draft failed (${res.status}).`);
    return body.variants || [];
  }

  function findComposerNear(root) {
    const scope = root || document;
    const selectors = [
      'div.ql-editor[contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      'div.msg-form__contenteditable[contenteditable="true"]',
      "textarea",
    ];
    for (const sel of selectors) {
      const nodes = scope.querySelectorAll(sel);
      for (const el of nodes) {
        if (el.offsetParent !== null || el.getClientRects().length) return el;
      }
    }
    return null;
  }

  function insertInto(el, text) {
    if (!el) return false;
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    try {
      document.execCommand("selectAll", false);
      document.execCommand("insertText", false, text);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
      return true;
    } catch {
      el.textContent = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
  }

  function closePopovers() {
    document.querySelectorAll(".pc-engage-popover").forEach((n) => n.remove());
  }

  function showPopover(anchor, variants, composerRoot) {
    closePopovers();
    const pop = document.createElement("div");
    pop.className = "pc-engage-popover";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.textContent = "×";
    close.addEventListener("click", () => pop.remove());
    pop.appendChild(close);
    const status = document.createElement("p");
    status.className = "pc-engage-status";
    status.textContent = "Review, then Insert — you still click Post/Send.";
    pop.appendChild(status);

    for (const v of variants) {
      const h = document.createElement("h4");
      h.textContent = v.label || "Option";
      const pre = document.createElement("pre");
      pre.textContent = v.body || "";
      const row = document.createElement("div");
      row.className = "row";
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", () => {
        void navigator.clipboard.writeText(v.body || "").then(() => {
          status.textContent = "Copied.";
        });
      });
      const insertBtn = document.createElement("button");
      insertBtn.type = "button";
      insertBtn.textContent = "Insert";
      insertBtn.addEventListener("click", () => {
        const box = findComposerNear(composerRoot) || findComposerNear(document);
        if (insertInto(box, v.body || "")) {
          status.textContent = "Inserted — click Post/Send yourself.";
        } else {
          void navigator.clipboard.writeText(v.body || "");
          status.textContent = "No box open — copied instead.";
        }
      });
      row.append(copyBtn, insertBtn);
      pop.append(h, pre, row);
    }

    const rect = anchor.getBoundingClientRect();
    pop.style.top = `${window.scrollY + rect.bottom + 6}px`;
    pop.style.left = `${Math.max(12, window.scrollX + rect.left)}px`;
    document.documentElement.appendChild(pop);
  }

  function extractPostText(article) {
    const selectors = [
      ".feed-shared-update-v2__description",
      ".update-components-text",
      ".feed-shared-text",
      '[data-test-id="main-feed-activity-card"] .break-words',
      ".break-words",
    ];
    for (const sel of selectors) {
      const el = article.querySelector(sel);
      const t = textOf(el);
      if (t && t.length > 20) return t;
    }
    return textOf(article).slice(0, 2000);
  }

  function extractAuthor(article) {
    const name =
      textOf(
        article.querySelector(
          ".update-components-actor__title span[aria-hidden='true'], .update-components-actor__name, .feed-shared-actor__name"
        )
      ) || "";
    const headline =
      textOf(
        article.querySelector(
          ".update-components-actor__description, .feed-shared-actor__description"
        )
      ) || "";
    return { name, headline };
  }

  function wireFeed() {
    const articles = document.querySelectorAll(
      "div.feed-shared-update-v2, div.occludable-update, article"
    );
    articles.forEach((article) => {
      if (!(article instanceof HTMLElement)) return;
      if (article.dataset.pcEngageWired === "1") return;
      const social = article.querySelector(
        ".feed-shared-social-action-bar, .social-actions-button, .update-v2-social-activity"
      );
      if (!social) return;
      article.dataset.pcEngageWired = "1";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = BTN_CLASS;
      btn.textContent = "PC comment";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        void (async () => {
          btn.disabled = true;
          btn.textContent = "…";
          try {
            // Prefer opening comment box so Insert has a target
            const commentToggle = article.querySelector(
              'button[aria-label*="Comment"], button.comment-button, .comment-button'
            );
            if (commentToggle) commentToggle.click();
            await new Promise((r) => setTimeout(r, 400));
            const author = extractAuthor(article);
            const variants = await callDraftEngage({
              kind: "comment",
              text: extractPostText(article),
              authorName: author.name || null,
              authorHeadline: author.headline || null,
            });
            showPopover(btn, variants, article);
          } catch (err) {
            alert(err instanceof Error ? err.message : "Draft failed.");
          } finally {
            btn.disabled = false;
            btn.textContent = "PC comment";
          }
        })();
      });
      social.appendChild(btn);
    });
  }

  function extractThread() {
    const bubbles = document.querySelectorAll(
      ".msg-s-event-listitem__body, .msg-s-message-group__message, .msg-s-event__content"
    );
    const lines = [];
    bubbles.forEach((b) => {
      const t = textOf(b);
      if (t) lines.push(t);
    });
    return lines.slice(-12).join("\n---\n");
  }

  function extractOtherName() {
    return (
      textOf(
        document.querySelector(
          ".msg-overlay-bubble-header__title, .msg-entity-lockup__entity-title, h2.msg-conversations-container__title"
        )
      ) || ""
    );
  }

  function wireMessaging() {
    if (!/\/messaging/i.test(location.pathname)) return;
    const form =
      document.querySelector(".msg-form, form.msg-form, .msg-form__footer") ||
      document.querySelector(".msg-s-message-list-container");
    if (!form || form.dataset.pcEngageWired === "1") return;
    const footer =
      document.querySelector(".msg-form__footer, .msg-form__left-actions") ||
      form;
    footer.dataset.pcEngageWired = "1";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = BTN_CLASS;
    btn.textContent = "PC reply";
    btn.style.margin = "8px";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void (async () => {
        btn.disabled = true;
        btn.textContent = "…";
        try {
          const thread = extractThread();
          const latest = thread.split("\n---\n").filter(Boolean).pop() || thread;
          const variants = await callDraftEngage({
            kind: "reply",
            text: latest,
            thread,
            authorName: extractOtherName() || null,
          });
          showPopover(btn, variants, document.querySelector(".msg-form") || document);
        } catch (err) {
          alert(err instanceof Error ? err.message : "Draft failed.");
        } finally {
          btn.disabled = false;
          btn.textContent = "PC reply";
        }
      })();
    });
    footer.appendChild(btn);
  }

  function tick() {
    ensureStyles();
    if (/\/feed/i.test(location.pathname) || location.pathname === "/") {
      wireFeed();
    }
    wireMessaging();
  }

  ensureStyles();
  tick();
  setInterval(tick, 1500);
  const obs = new MutationObserver(() => tick());
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
