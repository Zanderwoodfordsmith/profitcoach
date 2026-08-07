/**
 * LinkedIn profile page: extract visible fields + insert text into composers.
 * Uses structural walk from the name h1 — LinkedIn class names change often.
 */

(function () {
  const BTN_ID = "pc-linkedin-open-panel";

  function cleanText(raw) {
    return String(raw || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * LinkedIn shows network distance as "1st" / "2nd" / "3rd" near the name.
   * Scrapers often glue that onto the title ("2nd Director"). Strip leading/trailing
   * distance badges only — do not remove "2nd" from real phrases mid-sentence.
   */
  function stripNetworkDegree(text) {
    let t = cleanText(text);
    if (!t) return "";
    t = t.replace(/^[·•|]\s*/g, "");
    t = t.replace(/\s*[·•|]\s*(1st|2nd|3rd)\s*(degree)?\s*$/i, "");
    // "2nd Director" → Director. Keep real phrases like "3rd Generation…".
    const glued = t.match(/^(1st|2nd|3rd)\s*(degree)?\s*[·•|]?\s+(.+)$/i);
    if (
      glued?.[3] &&
      /^(director|co-?director|founder|co-?founder|owner|md|ceo|coo|cfo|partner|manager|managing director|proprietor)\b/i.test(
        glued[3]
      )
    ) {
      t = glued[3];
    }
    if (/^(1st|2nd|3rd)$/i.test(t)) return "";
    return t.replace(/\s+/g, " ").trim();
  }

  function extractConnectionDegree(card) {
    const roots = [card, document.querySelector("main"), document.body].filter(
      Boolean
    );
    for (const root of roots) {
      const badge = root.querySelector?.(
        ".distance-badge, .pv-top-card--list-bullet, span.dist-value, [class*='distance-badge']"
      );
      if (badge) {
        const m = cleanText(badge.innerText || badge.textContent).match(
          /\b(1st|2nd|3rd)\b/i
        );
        if (m) return m[1].toLowerCase();
      }
      const raw = visibleText(root).slice(0, 400);
      const m = raw.match(/\b(1st|2nd|3rd)\b/i);
      if (m) return m[1].toLowerCase();
    }
    return null;
  }

  /** Prefer visible aria-hidden span LinkedIn uses for display text. */
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
      // Avoid grabbing tiny badge text
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

  function canonicalProfileUrl() {
    try {
      const u = new URL(window.location.href);
      const parts = u.pathname.split("/").filter(Boolean);
      const inIdx = parts.findIndex((p) => p.toLowerCase() === "in");
      if (inIdx < 0 || !parts[inIdx + 1]) return null;
      const slug = decodeURIComponent(parts[inIdx + 1].replace(/\/+$/, ""));
      if (!slug) return null;
      return `https://www.linkedin.com/in/${slug}`;
    } catch {
      return null;
    }
  }

  function nameFromTitle() {
    const title = cleanText(document.title || "");
    if (!title) return "";
    const cleaned = title
      .replace(/\s*[\|–—-]\s*LinkedIn.*$/i, "")
      .replace(/\s*[\|–—-]\s*(Experience|About|Activity|Home).*$/i, "")
      .trim();
    if (
      cleaned &&
      cleaned.length < 90 &&
      !/linkedin/i.test(cleaned) &&
      !/sign in/i.test(cleaned)
    ) {
      return cleaned;
    }
    return "";
  }

  function findNameHeading() {
    const candidates = [
      ...document.querySelectorAll("main a > h1"),
      ...document.querySelectorAll("main h1"),
      ...document.querySelectorAll("section.artdeco-card h1"),
      ...document.querySelectorAll("h1"),
    ];
    for (const h1 of candidates) {
      let t = visibleText(h1);
      t = t
        .replace(/\s+(1st|2nd|3rd|Premium|Verified).*$/i, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!t || t.length < 2 || t.length > 90) continue;
      if (/^(linkedin|home|messaging|notifications|jobs)$/i.test(t)) continue;
      // Skip nav / logo style headings
      if (h1.closest("nav, header.global-nav, .global-nav")) continue;
      return { el: h1, name: t };
    }
    return null;
  }

  function topCardRoot(nameEl) {
    if (!nameEl) return document.querySelector("main") || document.body;
    return (
      nameEl.closest("section") ||
      nameEl.closest(".artdeco-card") ||
      nameEl.closest("div.ph5") ||
      nameEl.closest("div.pv-top-card") ||
      nameEl.parentElement?.parentElement?.parentElement ||
      document.querySelector("main") ||
      document.body
    );
  }

  function extractHeadlineFromCard(card, nameEl) {
    // Direct class fallbacks first
    const byClass = stripNetworkDegree(
      firstMatching(
        card,
        [
          ".text-body-medium.break-words",
          "div.text-body-medium",
          ".top-card-layout__headline",
          ".pv-text-details__left-panel .text-body-medium",
          "[data-anonymize='headline']",
        ],
        3
      )
    );
    const nameText = stripNetworkDegree(visibleText(nameEl));
    if (byClass && byClass !== nameText) return byClass;

    // Structural: after the name, first substantial short text block
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT);
    let passedName = false;
    const skipRe =
      /^(connect|message|follow|more|pending|1st|2nd|3rd|open to|·)$/i;
    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (nameEl && (el === nameEl || nameEl.contains(el))) {
        passedName = true;
        continue;
      }
      if (nameEl && !passedName) continue;
      if (!(el instanceof HTMLElement)) continue;
      const tag = el.tagName;
      if (!["DIV", "SPAN", "P"].includes(tag)) continue;
      // Prefer leaf-ish nodes
      if (el.querySelector("h1, button, a img")) continue;
      const t = stripNetworkDegree(visibleText(el));
      if (!t || t.length < 4 || t.length > 220) continue;
      if (skipRe.test(t)) continue;
      if (t === nameText) continue;
      // Location lines are usually shorter and often contain commas + region words later
      // Headline usually comes before location in the card
      return t;
    }
    return "";
  }

  function extractLocationFromCard(card, headline) {
    const byClass = firstMatching(
      card,
      [
        "span.text-body-small.inline.t-black--light.break-words",
        ".text-body-small.inline",
        ".pv-text-details__left-panel .text-body-small",
        "[data-anonymize='location']",
        ".top-card__subline-item",
      ],
      2
    );
    if (byClass && byClass !== headline) return byClass.slice(0, 80);

    const smalls = card.querySelectorAll(
      "span.text-body-small, .text-body-small, span.t-black--light"
    );
    for (const el of smalls) {
      const t = visibleText(el);
      if (!t || t.length < 3 || t.length > 80) continue;
      if (t === headline) continue;
      if (/contact info|followers|connections|\d+\+/i.test(t)) continue;
      // Heuristic: locations often have comma or known geo tokens
      if (
        /,/.test(t) ||
        /\b(UK|United Kingdom|England|Scotland|Wales|London|Yorkshire|Manchester|Leeds|USA|United States|Area|Greater)\b/i.test(
          t
        )
      ) {
        return t;
      }
    }
    return byClass && byClass !== headline ? byClass.slice(0, 80) : "";
  }

  function extractCompany(card, headline) {
    const byAria = firstMatching(
      card,
      [
        'button[aria-label*="Current company"]',
        'a[aria-label*="Current company"]',
        "[data-anonymize='company-name']",
        ".pv-text-details__right-panel button",
        ".pv-text-details__right-panel a",
      ],
      2
    );
    if (byAria) return byAria;

    const at = headline.match(/\sat\s+(.+)$/i);
    if (at?.[1]) return at[1].trim();

    // Experience section first company
    const exp =
      document.querySelector("#experience")?.closest("section") ||
      document.querySelector('section[id*="experience"]');
    if (exp) {
      const company = firstMatching(
        exp,
        [
          "a[data-field='experience_company_logo'] span[aria-hidden='true']",
          ".hoverable-link-text span[aria-hidden='true']",
          "span.t-14.t-normal span[aria-hidden='true']",
        ],
        2
      );
      if (company) return company;
    }
    return "";
  }

  function extractAbout() {
    const aboutSection =
      document.querySelector("#about")?.closest("section") ||
      document.querySelector("#about")?.closest("div") ||
      document.querySelector('section[id*="about"]') ||
      document.querySelector('[data-view-name*="profile-card"][data-view-name*="about"]') ||
      document.querySelector('div[id="about"]')?.parentElement;
    if (!aboutSection) {
      // Fallback: find an "About" heading and take the following text block
      const headings = document.querySelectorAll("h2, h3");
      for (const h of headings) {
        if (!/^about$/i.test(cleanText(h.innerText || h.textContent))) continue;
        const section = h.closest("section") || h.parentElement?.parentElement;
        if (!section) continue;
        const t = stripAboutChrome(visibleText(section));
        if (t.length >= 8) return t.slice(0, 2000);
      }
      return "";
    }
    const t = firstMatching(
      aboutSection,
      [
        ".inline-show-more-text span[aria-hidden='true']",
        ".inline-show-more-text",
        ".pv-shared-text-with-see-more span[aria-hidden='true']",
        ".pv-shared-text-with-see-more",
        "div.display-flex span[aria-hidden='true']",
        '[class*="inline-show-more"]',
      ],
      8
    );
    if (t) return t.slice(0, 2000);
    return stripAboutChrome(visibleText(aboutSection)).slice(0, 2000);
  }

  function stripAboutChrome(text) {
    return cleanText(text)
      .replace(/^about\b/i, "")
      .replace(/\bsee more\b/gi, "")
      .replace(/\b…see more\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractCompanyFromJsonLd() {
    try {
      const scripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      for (const s of scripts) {
        const data = JSON.parse(s.textContent || "null");
        const nodes = Array.isArray(data) ? data : [data];
        for (const node of nodes) {
          if (!node || typeof node !== "object") continue;
          if (node["@type"] === "Person") {
            const job =
              node.jobTitle ||
              node.worksFor?.name ||
              (Array.isArray(node.worksFor) ? node.worksFor[0]?.name : null);
            return {
              jobTitle: typeof node.jobTitle === "string" ? node.jobTitle : null,
              businessName:
                typeof node.worksFor?.name === "string"
                  ? node.worksFor.name
                  : typeof job === "string"
                    ? job
                    : null,
              name: typeof node.name === "string" ? node.name : null,
            };
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  function extractProfile() {
    const linkedinUrl = canonicalProfileUrl();
    const named = findNameHeading();
    let fullName = named?.name || nameFromTitle();
    const card = topCardRoot(named?.el || null);
    const ld = extractCompanyFromJsonLd();
    if (!fullName && ld?.name) fullName = ld.name;

    fullName = stripNetworkDegree(
      fullName
        .replace(/\s+(1st|2nd|3rd|Premium|Verified).*$/i, "")
        .replace(/\s+/g, " ")
        .trim()
    );

    const connectionDegree = extractConnectionDegree(card);

    let headline = stripNetworkDegree(
      extractHeadlineFromCard(card, named?.el) || ""
    );
    // Don't treat location-looking first line as headline if we can find better
    let location = stripNetworkDegree(
      extractLocationFromCard(card, headline)
    );
    if (headline && location && headline === location) {
      headline = "";
    }

    let businessName =
      stripNetworkDegree(extractCompany(card, headline) || "") ||
      ld?.businessName ||
      "";
    const about = extractAbout();

    let jobTitle = stripNetworkDegree(headline || ld?.jobTitle || "");
    const atMatch = headline.match(/^(.+?)\s+at\s+/i);
    if (atMatch?.[1]) jobTitle = stripNetworkDegree(atMatch[1]);

    let photoUrl = "";
    const img =
      card.querySelector?.(
        'img.pv-top-card-profile-picture__image, img.profile-photo-edit__preview, img[src*="profile-displayphoto"], button img[src*="profile"]'
      ) ||
      document.querySelector('img[src*="profile-displayphoto"]');
    if (img?.src) photoUrl = img.src;

    const firstName = fullName ? fullName.split(/\s+/)[0] : "";

    return {
      linkedinUrl,
      fullName,
      firstName,
      jobTitle: jobTitle || null,
      businessName: businessName || null,
      headline: headline || null,
      location: location || null,
      about: about || null,
      connectionDegree: connectionDegree || null,
      photoUrl: photoUrl || null,
      pageUrl: window.location.href,
      scrapedAt: Date.now(),
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

  /** Keep re-scraping until we have headline (or give up). */
  function scrapeUntilRich() {
    let attempts = 0;
    const max = 12;
    const timer = setInterval(() => {
      attempts += 1;
      const p = publishProfile();
      const rich = Boolean(p.headline || p.businessName || p.about);
      if (rich || attempts >= max) clearInterval(timer);
    }, 700);
  }

  function ensureButton() {
    if (document.getElementById(BTN_ID)) return;
    if (!/\/in\//i.test(location.pathname)) return;
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
      'div.msg-form__contenteditable[contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      'textarea[name="message"]',
      "textarea.connect-button-send-invite__custom-message",
      'div.ql-editor[contenteditable="true"]',
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
        error: "Open Connect or Messaging on LinkedIn first, then Insert.",
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
      // Nudge scroll so lazy sections paint
      try {
        window.scrollTo({ top: 400, behavior: "instant" });
        window.scrollTo({ top: 0, behavior: "instant" });
      } catch {
        // ignore
      }
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
    if (/\/in\//i.test(location.pathname)) {
      ensureButton();
      scrapeUntilRich();
    }
  }

  ensureButton();
  scrapeUntilRich();
  setInterval(onNavigate, 800);

  const obs = new MutationObserver(() => {
    ensureButton();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
