/**
 * Sales Navigator lead / people pages: extract visible fields for the side panel.
 * Prefer a public linkedin.com/in/ URL when the page exposes one.
 */

(function () {
  const BTN_ID = "pc-linkedin-open-panel";

  function cleanText(raw) {
    return String(raw || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function visibleText(el) {
    if (!el) return "";
    const hidden = el.querySelector?.(':scope > span[aria-hidden="true"]');
    if (hidden) {
      const t = cleanText(hidden.innerText || hidden.textContent);
      if (t) return t;
    }
    const anyHidden = el.querySelector?.('span[aria-hidden="true"]');
    if (anyHidden) {
      const t = cleanText(anyHidden.innerText || anyHidden.textContent);
      if (t && t.length > 1 && t.length < 400) return t;
    }
    return cleanText(el.innerText || el.textContent);
  }

  function firstMatching(root, selectors, minLen = 1) {
    const scope = root || document;
    for (const sel of selectors) {
      try {
        const nodes = scope.querySelectorAll(sel);
        for (const el of nodes) {
          const t = visibleText(el);
          if (t.length >= minLen) return t;
        }
      } catch {
        // bad selector
      }
    }
    return "";
  }

  function isSalesLeadPath(pathname) {
    return /\/sales\/(lead|people)\//i.test(pathname || "");
  }

  /** Canonical sales/lead or sales/people URL (member id before comma). */
  function canonicalSalesLeadUrl() {
    try {
      const u = new URL(window.location.href);
      const parts = u.pathname.split("/").filter(Boolean);
      const salesIdx = parts.findIndex((p) => p.toLowerCase() === "sales");
      if (salesIdx < 0) return null;
      const kind = (parts[salesIdx + 1] || "").toLowerCase();
      const idRaw = parts[salesIdx + 2];
      if (!["lead", "people"].includes(kind) || !idRaw) return null;
      const id = decodeURIComponent(idRaw).split(",")[0].trim();
      if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
      return `https://www.linkedin.com/sales/${kind}/${id}`;
    } catch {
      return null;
    }
  }

  /** Public /in/ URL if Sales Nav exposes it on the page. */
  function findPublicProfileUrl() {
    const anchors = document.querySelectorAll(
      'a[href*="linkedin.com/in/"], a[href*="/in/"]'
    );
    for (const a of anchors) {
      try {
        const href = a.getAttribute("href") || a.href;
        if (!href || /\/sales\//i.test(href)) continue;
        const u = new URL(href, window.location.origin);
        if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) continue;
        const parts = u.pathname.split("/").filter(Boolean);
        const inIdx = parts.findIndex((p) => p.toLowerCase() === "in");
        if (inIdx < 0 || !parts[inIdx + 1]) continue;
        const slug = decodeURIComponent(parts[inIdx + 1].replace(/\/+$/, ""));
        if (!slug || !/^[a-zA-Z0-9\-_%]+$/.test(slug)) continue;
        // Skip obvious non-profile /in/ noise
        if (/^(me|edit|overlay)$/i.test(slug)) continue;
        return `https://www.linkedin.com/in/${slug}`;
      } catch {
        // continue
      }
    }
    return null;
  }

  function nameFromTitle() {
    const title = cleanText(document.title || "");
    if (!title) return "";
    const cleaned = title
      .replace(/\s*[\|–—-]\s*Sales Navigator.*$/i, "")
      .replace(/\s*[\|–—-]\s*LinkedIn.*$/i, "")
      .trim();
    if (
      cleaned &&
      cleaned.length < 90 &&
      !/sales navigator|linkedin|sign in/i.test(cleaned)
    ) {
      return cleaned;
    }
    return "";
  }

  function findNameHeading() {
    const byAnon = firstMatching(
      document,
      [
        '[data-anonymize="person-name"]',
        '[data-anonymize="person-name"] span',
        ".profile-topcard-person-entity__name",
        "h1[data-anonymize='person-name']",
      ],
      2
    );
    if (byAnon) {
      const el =
        document.querySelector('[data-anonymize="person-name"]') ||
        document.querySelector("h1");
      return {
        el,
        name: byAnon
          .replace(/\s+(1st|2nd|3rd|Premium|Verified).*$/i, "")
          .trim(),
      };
    }

    const candidates = [
      ...document.querySelectorAll("h1"),
      ...document.querySelectorAll('[data-x--lead-profile] h1'),
      ...document.querySelectorAll(".profile-topcard h1"),
    ];
    for (const h1 of candidates) {
      let t = visibleText(h1);
      t = t
        .replace(/\s+(1st|2nd|3rd|Premium|Verified).*$/i, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!t || t.length < 2 || t.length > 90) continue;
      if (/^(sales navigator|linkedin|home|search)$/i.test(t)) continue;
      if (h1.closest("nav, header, .global-nav")) continue;
      return { el: h1, name: t };
    }
    return null;
  }

  function topCardRoot(nameEl) {
    if (!nameEl) {
      return (
        document.querySelector(".profile-topcard") ||
        document.querySelector('[data-x--lead-profile]') ||
        document.querySelector("main") ||
        document.body
      );
    }
    return (
      nameEl.closest(".profile-topcard") ||
      nameEl.closest("section") ||
      nameEl.closest('[data-x--lead-profile]') ||
      nameEl.closest("aside") ||
      nameEl.parentElement?.parentElement?.parentElement ||
      document.querySelector("main") ||
      document.body
    );
  }

  function extractHeadline(card) {
    return firstMatching(
      card,
      [
        '[data-anonymize="headline"]',
        '[data-anonymize="job-title"]',
        ".profile-topcard__summary-position",
        ".topcard-profile-info-module__headline",
        "h1 + div",
        "h1 ~ div",
      ],
      3
    );
  }

  function extractLocation(card, headline) {
    const t = firstMatching(
      card,
      [
        '[data-anonymize="location"]',
        ".profile-topcard__location-data",
        '[data-anonymize="address"]',
      ],
      2
    );
    if (t && t !== headline) return t.slice(0, 80);
    return "";
  }

  function extractCompany(card, headline) {
    const byAnon = firstMatching(
      card,
      [
        '[data-anonymize="company-name"]',
        'a[data-anonymize="company-name"]',
        ".profile-topcard__summary-position a",
        'a[href*="/sales/company/"]',
      ],
      2
    );
    if (byAnon) return byAnon;

    const at = headline.match(/\sat\s+(.+)$/i);
    if (at?.[1]) return at[1].trim();
    return "";
  }

  function extractAbout() {
    const selectors = [
      '[data-anonymize="person-blurb"]',
      '[data-anonymize="summary"]',
      ".profile-topcard__summary-content",
      "#about-section",
      'section[data-sn-view-name*="about"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const t = visibleText(el);
      if (t.length >= 20) return t.slice(0, 2000);
    }
    return "";
  }

  function extractProfile() {
    const publicUrl = findPublicProfileUrl();
    const salesUrl = canonicalSalesLeadUrl();
    const linkedinUrl = publicUrl || salesUrl;

    const named = findNameHeading();
    let fullName = named?.name || nameFromTitle();
    fullName = fullName
      .replace(/\s+(1st|2nd|3rd|Premium|Verified).*$/i, "")
      .replace(/\s+/g, " ")
      .trim();

    const card = topCardRoot(named?.el || null);
    let headline = extractHeadline(card) || "";
    let location = extractLocation(card, headline);
    if (headline && location && headline === location) headline = "";

    let businessName = extractCompany(card, headline) || "";
    const about = extractAbout();

    let jobTitle = headline || "";
    const atMatch = headline.match(/^(.+?)\s+at\s+/i);
    if (atMatch?.[1]) jobTitle = atMatch[1].trim();

    let photoUrl = "";
    const img =
      card.querySelector?.(
        'img[src*="profile-displayphoto"], img[data-anonymize="headshot"], .presence-entity__image'
      ) || document.querySelector('img[src*="profile-displayphoto"]');
    if (img?.src) photoUrl = img.src;

    const firstName = fullName ? fullName.split(/\s+/)[0] : "";

    return {
      linkedinUrl,
      salesNavUrl: salesUrl,
      fullName,
      firstName,
      jobTitle: jobTitle || null,
      businessName: businessName || null,
      headline: headline || null,
      location: location || null,
      about: about || null,
      photoUrl: photoUrl || null,
      pageUrl: window.location.href,
      scrapedAt: Date.now(),
      source: "sales_nav",
      fieldCount: [
        fullName,
        headline,
        location,
        businessName,
        about,
      ].filter(Boolean).length,
    };
  }

  function publishProfile() {
    const profile = extractProfile();
    chrome.runtime
      .sendMessage({ type: "PROFILE_CONTEXT", profile })
      .catch(() => {});
    return profile;
  }

  function scrapeUntilRich() {
    let attempts = 0;
    const max = 14;
    const timer = setInterval(() => {
      attempts += 1;
      const p = publishProfile();
      const rich = Boolean(
        p.fullName && (p.headline || p.businessName || p.about || p.linkedinUrl)
      );
      if (rich || attempts >= max) clearInterval(timer);
    }, 700);
  }

  function ensureButton() {
    if (document.getElementById(BTN_ID)) return;
    if (!isSalesLeadPath(location.pathname)) return;
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.textContent = "Profit Coach";
    btn.setAttribute("aria-label", "Open Profit Coach");
    Object.assign(btn.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: "2147483646",
      border: "none",
      borderRadius: "999px",
      padding: "11px 16px",
      background: "#0c1b2a",
      color: "#f8fafc",
      font: "600 13px/1.2 ui-sans-serif, system-ui, sans-serif",
      boxShadow: "0 10px 28px rgba(12,27,42,0.35)",
      cursor: "pointer",
    });
    btn.addEventListener("click", () => {
      publishProfile();
      chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" }).catch(() => {});
    });
    document.documentElement.appendChild(btn);
  }

  function findEditableComposer() {
    const selectors = [
      'div[role="textbox"][contenteditable="true"]',
      'textarea[name="message"]',
      'div.ql-editor[contenteditable="true"]',
      'textarea',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return el;
    }
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
      const ed = dialog.querySelector('[contenteditable="true"], textarea');
      if (ed) return ed;
    }
    return null;
  }

  function insertText(text) {
    const el = findEditableComposer();
    if (!el) {
      return {
        ok: false,
        error: "Open Message / InMail on Sales Navigator first, then Insert.",
      };
    }
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return { ok: true };
    }
    try {
      document.execCommand("selectAll", false);
      document.execCommand("insertText", false, text);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
      return { ok: true };
    } catch {
      el.textContent = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return { ok: true };
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "GET_PROFILE") {
      sendResponse({ ok: true, profile: publishProfile() });
      return false;
    }
    if (message?.type === "INSERT_TEXT") {
      sendResponse(insertText(String(message.text || "")));
      return false;
    }
    return false;
  });

  let lastUrl = location.href;
  function onNavigate() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    if (isSalesLeadPath(location.pathname)) {
      ensureButton();
      scrapeUntilRich();
    }
  }

  if (isSalesLeadPath(location.pathname)) {
    ensureButton();
    scrapeUntilRich();
  }
  setInterval(onNavigate, 800);

  const obs = new MutationObserver(() => {
    ensureButton();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
