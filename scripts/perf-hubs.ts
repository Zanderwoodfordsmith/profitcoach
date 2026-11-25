/**
 * Speed check for the Get Calls and Win Clients tabs (job 292).
 *
 * Signs in as Zander Demo (magic link, no password), then times every tab:
 *   - fresh load: open the page cold, until its content shows with no spinners
 *   - tab click: click each tab in the tab bar, until its content shows
 * and flags anything over budget (fresh 500ms, click 100ms).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/perf-hubs.ts                 # live site
 *   npx tsx --env-file=.env.local scripts/perf-hubs.ts http://localhost:3011
 *   npm run perf:hubs -- http://localhost:3011
 *
 * Time a production build, not `next dev`. Locally every database trip goes
 * from this Mac to London (~200ms), so local numbers run 2-3x the live ones.
 */
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = (process.argv[2] ?? "https://www.theprofitcoach.com").replace(/\/$/, "");
const DEMO_EMAIL = "zander+paymenttest3@businesscoachacademy.com";
const FRESH_BUDGET_MS = 500;
const CLICK_BUDGET_MS = 100;

const TABS: [string, string][] = [
  ["Lead Lists", "/coach/campaigns?tab=pool"],
  ["Campaigns", "/coach/campaigns"],
  ["Conversations", "/coach/conversations"],
  ["Content", "/coach/linkedin"],
  ["Newsletter", "/coach/newsletters"],
  ["Lead Magnets", "/coach/campaigns?tab=magnets"],
  ["Calls", "/coach/calls"],
  ["Pipeline", "/coach/prospects"],
  ["Scripts", "/coach/script"],
  ["Call Practice", "/coach/script/simulator"],
  ["Scoreboard", "/coach/scoreboard"],
];

/** Time until the main area has content and no spinner, skeleton or "Loading…" text. */
async function timeUntilShown(page: Page, go: () => Promise<unknown>, isTarget: () => boolean) {
  const t0 = Date.now();
  await go();
  let quietSince = -1;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const busy = await page
      .evaluate(() => {
        const main = document.querySelector("main");
        if (!main) return true;
        const spinners = [...main.querySelectorAll('.animate-pulse, .animate-spin, [aria-busy="true"]')].filter(
          (el) => (el as HTMLElement).offsetParent !== null
        ).length;
        const text = main.innerText;
        return spinners > 0 || /Loading( |…|\.\.\.)/i.test(text) || text.trim().length < 150;
      })
      .catch(() => true);
    const now = Date.now();
    if (!busy && isTarget()) {
      if (quietSince < 0) quietSince = now;
      if (now - quietSince >= 250) return quietSince - t0;
    } else quietSince = -1;
    await page.waitForTimeout(30);
  }
  return -1;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: DEMO_EMAIL });
  if (linkError || !link.properties?.hashed_token) throw linkError ?? new Error("No magic link.");
  const { data: s, error } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (error || !s.session) throw error ?? new Error("No session.");
  const ref = new URL(url).hostname.split(".")[0];

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(
    ([k, v]) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* ignore */
      }
    },
    [`sb-${ref}-auth-token`, JSON.stringify(s.session)]
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE}/coach`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const rows: Array<{ tab: string; fresh: number; click: number }> = [];
  for (const [tab, path] of TABS) {
    const fresh = await timeUntilShown(page, () => page.goto(`${BASE}${path}`, { waitUntil: "commit" }), () => true);
    rows.push({ tab, fresh, click: -1 });
  }

  // Clicks: start on each hub, then click every tab in its bar in turn.
  for (const start of ["/coach/campaigns?tab=pool", "/coach/calls"]) {
    await page.goto(`${BASE}${start}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    const nav = () => page.locator('nav[aria-label$="tools"]').first();
    const labels = (await nav().getByRole("link").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    for (const label of [...labels.slice(1), labels[0]]) {
      const row = rows.find((r) => r.tab === label);
      if (!row) continue;
      const before = page.url();
      const click = await timeUntilShown(
        page,
        () => nav().getByRole("link", { name: label, exact: true }).first().click(),
        () => page.url() !== before
      );
      row.click = click;
    }
  }
  await browser.close();

  const fmt = (ms: number, budget: number) =>
    ms < 0 ? "  n/a" : `${String(ms).padStart(5)}ms${ms > budget ? " !" : "  "}`;
  console.log(`\nSpeed check: ${BASE}  (! = over budget: fresh ${FRESH_BUDGET_MS}ms, click ${CLICK_BUDGET_MS}ms)\n`);
  console.log(`${"Tab".padEnd(16)}${"Fresh load".padStart(11)}${"Tab click".padStart(11)}`);
  for (const r of rows) console.log(`${r.tab.padEnd(16)}${fmt(r.fresh, FRESH_BUDGET_MS)}${fmt(r.click, CLICK_BUDGET_MS)}`);
  const over = rows.filter((r) => r.fresh > FRESH_BUDGET_MS || r.click > CLICK_BUDGET_MS).length;
  console.log(over ? `\n${over} tab(s) over budget.` : "\nAll tabs within budget.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
