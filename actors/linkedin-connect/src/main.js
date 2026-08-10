/**
 * Profit Coach — LinkedIn connection requests (private Apify Actor).
 *
 * Real LinkedIn UI (from inspector, Aug 2026):
 * - Connect is often an <a aria-label="Invite {Name} to connect">, NOT a <button>
 * - Sometimes only under More → <a role="menuitem" aria-label="Invite …">
 * - Invite modal: "Add a note" / "Send without a note" (not plain "Send")
 *
 * Only reports status=sent after Pending is verified on reload.
 */

import { Actor, log } from "apify";
import { chromium } from "playwright";
import {
  jitterDelayMs,
  parseLinkedInCookies,
  sleep,
} from "./cookies.js";

const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const {
  cookies: cookiesRaw,
  userAgent = "",
  profiles = [],
  delaySeconds = 8,
  dryRun = false,
} = input;

if (!Array.isArray(profiles) || profiles.length === 0) {
  throw new Error("Provide at least one profile in profiles[].");
}

const cookieList = parseLinkedInCookies(cookiesRaw);
const ua = String(userAgent || "").trim() || DEFAULT_UA;

const browser = await chromium.launch({
  headless: true,
  args: [
    "--disable-gpu",
    "--no-sandbox",
    "--disable-blink-features=AutomationControlled",
  ],
});

const context = await browser.newContext({
  userAgent: ua,
  viewport: { width: 1440, height: 900 },
  locale: "en-GB",
});

await context.addCookies(cookieList);
const page = await context.newPage();

await page.goto("https://www.linkedin.com/feed/", {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});
await sleep(2500);
await dismissOverlays(page);

const feedUrl = page.url();
if (/login|checkpoint|authwall|uas\/login/i.test(feedUrl)) {
  await browser.close();
  throw new Error(
    `LinkedIn session invalid (redirected to ${feedUrl}). Re-export cookies / reconnect extension.`,
  );
}

log.info(
  `Session looks ok. Processing ${profiles.length} profile(s). dryRun=${dryRun}`,
);

for (let i = 0; i < profiles.length; i += 1) {
  const item = profiles[i] ?? {};
  const url = String(item.url || "").trim();
  const message = String(item.message || "").trim();
  const row = {
    url,
    status: "error",
    detail: "",
    hasNote: Boolean(message),
    ctasBefore: [],
    ctasAfter: [],
  };

  if (!url || !/linkedin\.com\/in\//i.test(url)) {
    row.detail = "Invalid profile URL (expected linkedin.com/in/…).";
    await Actor.pushData(row);
    continue;
  }

  try {
    const result = await sendConnect(page, url, message, dryRun, i);
    Object.assign(row, result);
  } catch (err) {
    row.status = "error";
    row.detail = err instanceof Error ? err.message : String(err);
    log.warning(`Failed ${url}: ${row.detail}`);
    await saveDebug(page, `exception-${i}`).catch(() => {});
  }

  await Actor.pushData(row);

  if (i < profiles.length - 1) {
    const wait = jitterDelayMs(delaySeconds);
    log.info(`Waiting ${Math.round(wait / 1000)}s before next profile…`);
    await sleep(wait);
  }
}

await browser.close();
await Actor.exit();

/**
 * @param {import('playwright').Page} page
 * @param {string} profileUrl
 * @param {string} message
 * @param {boolean} isDryRun
 * @param {number} index
 */
async function sendConnect(page, profileUrl, message, isDryRun, index) {
  const targetSlug = profileSlug(profileUrl);

  await page.goto(profileUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await sleep(4000);
  await dismissOverlays(page);

  if (/login|checkpoint|authwall/i.test(page.url())) {
    return {
      status: "checkpoint",
      detail: `Redirected to ${page.url()}`,
      hasNote: Boolean(message),
    };
  }
  if (!isOnProfile(page.url(), targetSlug)) {
    await saveDebug(page, `wrong-page-${index}`);
    return {
      status: "error",
      detail: `Expected profile /in/${targetSlug} but landed on ${page.url()}`,
      hasNote: Boolean(message),
    };
  }

  const ctasBefore = await listPrimaryCtas(page);
  log.info(`On ${page.url()} | CTAs: ${ctasBefore.join(" | ") || "(none)"}`);

  const relationship = await detectRelationship(page);
  if (relationship === "pending") {
    return {
      status: "skipped",
      detail: "Already pending",
      hasNote: Boolean(message),
      ctasBefore,
    };
  }
  if (relationship === "connected") {
    return {
      status: "skipped",
      detail: "Already 1st-degree",
      hasNote: Boolean(message),
      ctasBefore,
    };
  }

  // 1) Top-card Connect link/button (Paul case)
  let via = "profile-connect";
  let clicked = await clickTopCardConnect(page);

  // 2) More → Connect (Alistair / Follow-primary case)
  if (!clicked) {
    via = "more-menu";
    clicked = await clickConnectFromMore(page);
  }

  if (!clicked) {
    await saveDebug(page, `no-connect-${index}`);
    return {
      status: "error",
      detail: `Could not find Connect. Visible: ${ctasBefore.join(", ") || "none"}`,
      hasNote: Boolean(message),
      ctasBefore,
    };
  }

  log.info(`Opened invite via ${via}`);
  // If Connect <a> navigated us to login, stop clearly
  if (/\/login/i.test(page.url())) {
    await saveDebug(page, `login-after-connect-${index}`);
    return {
      status: "checkpoint",
      detail: `Session lost after Connect click → ${page.url()}`,
      hasNote: Boolean(message),
      ctasBefore,
    };
  }

  const modalReady = await waitForInviteModal(page);
  if (!modalReady) {
    await saveDebug(page, `no-modal-${index}`);
    return {
      status: "error",
      detail: `Connect clicked (via ${via}) but invite modal did not appear`,
      hasNote: Boolean(message),
      ctasBefore,
    };
  }
  log.info("Invite modal is open");

  const limitText = await page
    .locator(
      "text=/weekly invitation|invitation limit|too many|can't connect|cannot connect|You've reached/i",
    )
    .first()
    .textContent()
    .catch(() => null);
  if (limitText) {
    await saveDebug(page, `limit-${index}`);
    return {
      status: "blocked",
      detail: `LinkedIn limit/warning: ${limitText.trim().slice(0, 200)}`,
      hasNote: Boolean(message),
      ctasBefore,
    };
  }

  if (isDryRun) {
    await clickCancelIfAny(page);
    return {
      status: "dry_run",
      detail: `Dry run: invite modal opened via ${via}`,
      hasNote: Boolean(message),
      ctasBefore,
    };
  }

  // For now: always Send without a note (unless message provided)
  if (message) {
    const addNote = page.locator(
      'button[aria-label="Add a note"], div[role="dialog"] button[aria-label="Add a note"]',
    );
    if ((await addNote.count()) > 0) {
      await safeClick(page, addNote.first());
      await sleep(800);
      const noteBox = page.locator('div[role="dialog"] textarea, textarea');
      if ((await noteBox.count()) > 0) {
        await noteBox.first().fill(message.slice(0, 300));
        await sleep(400);
      }
      // After typing, primary is usually still "Send" / send invitation
      const sendAfterNote = page.locator(
        'button[aria-label="Send without a note"], button[aria-label="Send"], button[aria-label="Send invitation"], div[role="dialog"] button.artdeco-button--primary',
      );
      if ((await sendAfterNote.count()) === 0) {
        await saveDebug(page, `no-send-after-note-${index}`);
        return {
          status: "error",
          detail: "Typed note but could not find Send",
          hasNote: true,
          ctasBefore,
        };
      }
      await safeClick(page, sendAfterNote.first());
    } else {
      const sent = await clickSendWithoutNote(page);
      if (!sent) {
        await saveDebug(page, `no-send-${index}`);
        return {
          status: "error",
          detail: 'Modal open but "Send without a note" not found',
          hasNote: Boolean(message),
          ctasBefore,
        };
      }
    }
  } else {
    const sent = await clickSendWithoutNote(page);
    if (!sent) {
      await saveDebug(page, `no-send-${index}`);
      return {
        status: "error",
        detail: 'Modal open but "Send without a note" not found',
        hasNote: false,
        ctasBefore,
      };
    }
  }

  await sleep(2500);

  // Verify Pending
  await page.goto(profileUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await sleep(3500);
  await dismissOverlays(page);

  const ctasAfter = await listPrimaryCtas(page);
  log.info(`CTAs after: ${ctasAfter.join(" | ") || "(none)"}`);
  const after = await detectRelationship(page);

  if (after === "pending") {
    return {
      status: "sent",
      detail: `Verified Pending (via ${via})`,
      hasNote: Boolean(message),
      ctasBefore,
      ctasAfter,
    };
  }

  await saveDebug(page, `verify-fail-${index}`);
  return {
    status: "error",
    detail: `Invite not verified (via ${via}). Before=[${ctasBefore.join(", ")}] After=[${ctasAfter.join(", ")}] relationship=${after}`,
    hasNote: Boolean(message),
    ctasBefore,
    ctasAfter,
  };
}

/** Click top-card Connect — often an <a>, not a button. */
async function clickTopCardConnect(page) {
  const main = page.locator("main").first();
  const candidates = [
    // Real LinkedIn: <a aria-label="Invite {Name} to connect">
    main.getByRole("link", { name: /Invite .+ to connect/i }),
    main.locator('a[aria-label*="to connect" i]'),
    main.locator('a[href*="custom-invite"], a[href*="connect-invite"]'),
    main.getByRole("button", { name: /Invite .+ to connect/i }),
    main.getByRole("button", { name: /^Connect$/i }),
  ];

  for (const loc of candidates) {
    const n = await loc.count();
    for (let i = 0; i < Math.min(n, 8); i += 1) {
      const el = loc.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const box = await el.boundingBox().catch(() => null);
      if (!box || box.y > 560) continue; // top card only — not "People similar"
      const label =
        (await el.getAttribute("aria-label").catch(() => "")) ||
        (await el.innerText().catch(() => "")) ||
        "";
      if (/follow/i.test(label) && !/connect/i.test(label)) continue;
      log.info(`Top-card connect control: ${label.trim() || "(no label)"}`);
      // LinkedIn Connect is an <a href="/preload/custom-invite/...">.
      // Playwright's click() can hard-navigate and dump us on /login.
      // Fire a DOM click event instead so their JS can open the modal.
      await el.evaluate((node) => {
        node.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
            buttons: 1,
          }),
        );
      });
      return true;
    }
  }

  // DOM fallback — same MouseEvent trick
  const label = await page.evaluate(() => {
    const nodes = [
      ...document.querySelectorAll(
        'main a[aria-label*="to connect" i], main a[href*="custom-invite"], main a[href*="connect-invite"], main button[aria-label*="to connect" i]',
      ),
    ];
    const scored = [];
    for (const el of nodes) {
      if (!(el instanceof HTMLElement)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top > 560 || rect.top < 40 || rect.width < 20) continue;
      const aria = (el.getAttribute("aria-label") || "").trim();
      if (
        !/connect/i.test(aria) &&
        !/connect-invite|custom-invite/i.test(el.getAttribute("href") || "")
      ) {
        continue;
      }
      scored.push({ el, top: rect.top, left: rect.left, aria });
    }
    scored.sort((a, b) => a.top - b.top || a.left - b.left);
    if (!scored[0]) return null;
    scored[0].el.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
        buttons: 1,
      }),
    );
    return scored[0].aria || "Connect";
  });
  if (label) {
    log.info(`Top-card connect via DOM MouseEvent: ${label}`);
    return true;
  }
  return false;
}

/** More (button) → Connect menuitem link */
async function clickConnectFromMore(page) {
  await dismissOverlays(page);
  const moreButtons = page.locator("main").getByRole("button", { name: /^More$/i });
  const n = await moreButtons.count();
  /** @type {{ el: import('playwright').Locator, y: number }[]} */
  const tops = [];
  for (let i = 0; i < Math.min(n, 8); i += 1) {
    const el = moreButtons.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const box = await el.boundingBox().catch(() => null);
    if (!box || box.y > 560) continue;
    tops.push({ el, y: box.y });
  }
  tops.sort((a, b) => a.y - b.y);

  for (const { el } of tops.slice(0, 2)) {
    await safeClick(page, el);
    await sleep(900);

    const menuConnect = [
      page.getByRole("menuitem", { name: /Invite .+ to connect/i }),
      page.getByRole("menuitem", { name: /^Connect$/i }),
      page.locator(
        'a[role="menuitem"][aria-label*="to connect" i], [role="menu"] a[aria-label*="to connect" i]',
      ),
      page.locator('[role="menu"] a[href*="connect-invite"]'),
    ];

    for (const loc of menuConnect) {
      if ((await loc.count()) === 0) continue;
      const item = loc.first();
      if (!(await item.isVisible().catch(() => false))) continue;
      const label = (await item.getAttribute("aria-label").catch(() => "")) || "Connect";
      log.info(`More → Connect: ${label}`);
      await safeClick(page, item);
      return true;
    }

    await page.keyboard.press("Escape").catch(() => {});
    await sleep(300);
  }
  return false;
}

async function waitForInviteModal(page) {
  // Do NOT dismiss overlays here — that can close the invite dialog.
  const candidates = [
    page.locator('div[role="dialog"].send-invite'),
    page.locator('div[role="dialog"][aria-labelledby="send-invite-modal"]'),
    page.locator('div.artdeco-modal.send-invite'),
    page.getByText("Add a note to your invitation?", { exact: false }),
    page.locator('button[aria-label="Send without a note"]'),
  ];
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    for (const loc of candidates) {
      if ((await loc.count()) > 0 && (await loc.first().isVisible().catch(() => false))) {
        return true;
      }
    }
    await sleep(250);
  }
  return false;
}

async function clickSendWithoutNote(page) {
  // Prefer exact aria-label from inspector — ember IDs change every load
  const selectors = [
    'button[aria-label="Send without a note"]',
    'div[role="dialog"] button[aria-label="Send without a note"]',
    'div.send-invite button.artdeco-button--primary',
  ];
  for (const sel of selectors) {
    const loc = page.locator(sel);
    const n = await loc.count();
    for (let i = 0; i < Math.min(n, 3); i += 1) {
      const el = loc.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      log.info('Clicking button[aria-label="Send without a note"]');
      // Don't call dismissOverlays — it presses Escape and kills the modal
      try {
        await el.click({ timeout: 8000 });
      } catch {
        await el.click({ force: true, timeout: 8000 });
      }
      return true;
    }
  }
  // Role fallback
  const byRole = page.getByRole("button", { name: /^Send without a note$/i });
  if ((await byRole.count()) > 0 && (await byRole.first().isVisible().catch(() => false))) {
    log.info('Clicking Send without a note via role');
    try {
      await byRole.first().click({ timeout: 8000 });
    } catch {
      await byRole.first().click({ force: true, timeout: 8000 });
    }
    return true;
  }
  log.warning('No "Send without a note" button found');
  return false;
}

function profileSlug(url) {
  const m = String(url).match(/linkedin\.com\/in\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]).replace(/\/$/, "").toLowerCase() : "";
}

function isOnProfile(currentUrl, slug) {
  if (!slug) return /linkedin\.com\/in\//i.test(currentUrl);
  try {
    const u = new URL(currentUrl);
    const host = u.hostname.replace(/^www\./, "");
    if (!host.endsWith("linkedin.com")) return false;
    const path = u.pathname.toLowerCase();
    return path.includes(`/in/${slug}`);
  } catch {
    return false;
  }
}

/** @param {import('playwright').Page} page */
async function dismissOverlays(page) {
  // Only clear messaging chrome — do NOT press Escape (closes invite modal)
  // and do NOT click generic Cancel/Close/Dismiss while inviting.
  await page
    .evaluate(() => {
      for (const sel of [
        ".msg-overlay-container",
        ".msg-overlay-list-bubble",
        "#msg-overlay",
      ]) {
        document.querySelectorAll(sel).forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.setProperty("pointer-events", "none", "important");
          }
        });
      }
    })
    .catch(() => {});
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} locator
 */
async function safeClick(page, locator) {
  await dismissOverlays(page);
  try {
    await locator.scrollIntoViewIfNeeded({ timeout: 4000 });
  } catch {
    /* ignore */
  }
  try {
    await locator.click({ timeout: 8000 });
  } catch {
    log.info("Normal click failed — force:true");
    await locator.click({ force: true, timeout: 8000 });
  }
}

async function clickCancelIfAny(page) {
  const dismiss = page.getByRole("button", { name: /Cancel|Dismiss|Close/i });
  if ((await dismiss.count()) > 0) {
    await dismiss.first().click({ force: true }).catch(() => {});
  }
}

async function listPrimaryCtas(page) {
  return page.evaluate(() => {
    const out = [];
    const nodes = document.querySelectorAll(
      'main a, main button, main [role="button"], main [role="menuitem"]',
    );
    for (const el of nodes) {
      if (!(el instanceof HTMLElement)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 16 || rect.height < 10 || rect.top > 640 || rect.top < 0)
        continue;
      const t = (el.getAttribute("aria-label") || el.innerText || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!t || t.length > 90) continue;
      if (
        /connect|pending|message|follow|more|withdraw|invite|save in sales/i.test(
          t,
        )
      ) {
        out.push(t);
      }
    }
    return [...new Set(out)].slice(0, 25);
  });
}

async function detectRelationship(page) {
  const main = page.locator("main").first();

  // Pending first — never treat Message as connected if Pending exists
  const pending = main.locator(
    'button[aria-label="Pending"], button[aria-label*="Pending" i], button:has-text("Pending"), a[aria-label*="Pending" i]',
  );
  for (let i = 0; i < Math.min(await pending.count(), 6); i += 1) {
    const el = pending.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const box = await el.boundingBox().catch(() => null);
    if (box && box.y < 560) return "pending";
  }

  const invite = main.locator(
    'a[aria-label*="to connect" i], a[href*="custom-invite"], a[href*="connect-invite"], button[aria-label*="to connect" i]',
  );
  for (let i = 0; i < Math.min(await invite.count(), 6); i += 1) {
    const el = invite.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const box = await el.boundingBox().catch(() => null);
    if (box && box.y < 560) return "can_connect";
  }

  // More still available with Connect inside → can connect
  const more = main.getByRole("button", { name: /^More$/i });
  if ((await more.count()) > 0) {
    const box = await more.first().boundingBox().catch(() => null);
    if (box && box.y < 560) {
      // If Follow is primary, Connect may only be under More — treat as can_connect
      // unless Message is clearly the main action with no Follow/Connect
      const follow = main.getByRole("button", { name: /^Follow$/i });
      if (
        (await follow.count()) > 0 &&
        (await follow.first().isVisible().catch(() => false))
      ) {
        return "can_connect";
      }
    }
  }

  const messageBtn = main.getByRole("button", { name: /^Message$/i });
  if (
    (await messageBtn.count()) > 0 &&
    (await messageBtn.first().isVisible().catch(() => false))
  ) {
    const box = await messageBtn.first().boundingBox().catch(() => null);
    if (box && box.y < 560) return "connected";
  }
  return "unknown";
}

async function saveDebug(page, key) {
  try {
    const png = await page.screenshot({ fullPage: false });
    await Actor.setValue(`debug-${key}.png`, png, { contentType: "image/png" });
    const html = await page.content();
    await Actor.setValue(`debug-${key}.html`, html, {
      contentType: "text/html; charset=utf-8",
    });
    log.info(`Saved debug-${key}.png / .html`);
  } catch (err) {
    log.warning(`Could not save debug: ${err}`);
  }
}
