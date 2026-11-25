// Temporary speed pass v2: "content shown" vs "all settled", full loads, tab clicks, key actions. Delete after use.
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "https://www.theprofitcoach.com";
const OUT = process.argv[3] ?? "/tmp/perf2.json";

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

const LOADING_SEL = '.animate-pulse, .animate-spin, [aria-busy="true"]';

async function measure(page: Page, go: () => Promise<unknown>) {
  const inflight = new Set<any>();
  let calls = 0;
  const onReq = (r: any) => { if (["fetch", "xhr"].includes(r.resourceType())) { inflight.add(r); calls++; } };
  const onDone = (r: any) => inflight.delete(r);
  page.on("request", onReq);
  page.on("requestfinished", onDone);
  page.on("requestfailed", onDone);
  const t0 = Date.now();
  await go();
  let shown = -1, settled = -1, quietSince = -1, busySince = Date.now();
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const st = await page.evaluate((sel) => {
      const main = document.querySelector("main") ?? document.body;
      const busy = [...main.querySelectorAll(sel)].filter((e) => (e as HTMLElement).offsetParent !== null).length;
      return { busy, text: (main as HTMLElement).innerText.trim().length };
    }, LOADING_SEL).catch(() => ({ busy: 1, text: 0 }));
    const now = Date.now();
    const visibleOk = st.busy === 0 && st.text > 150;
    if (visibleOk) { if (quietSince < 0) quietSince = now; } else quietSince = -1;
    if (shown < 0 && quietSince > 0 && now - quietSince >= 300) shown = quietSince - t0;
    if (!visibleOk || inflight.size > 0) busySince = now;
    if (shown >= 0 && now - busySince >= 700) { settled = busySince - t0; break; }
    await page.waitForTimeout(40);
  }
  page.off("request", onReq);
  page.off("requestfinished", onDone);
  page.off("requestfailed", onDone);
  return { shown, settled, calls };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: "zander+paymenttest3@businesscoachacademy.com" });
  const { data: s, error } = await anon.auth.verifyOtp({ token_hash: link!.properties!.hashed_token, type: "magiclink" });
  if (error) throw error;
  const ref = new URL(url).hostname.split(".")[0];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, [`sb-${ref}-auth-token`, JSON.stringify(s!.session)]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/coach`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const out: any[] = [];
  const log = (kind: string, name: string, r: any) => { out.push({ kind, name, ...r }); console.log(`${kind.padEnd(10)} ${name.padEnd(26)} shown ${String(r.shown).padStart(5)}ms  settled ${String(r.settled).padStart(5)}ms  calls ${r.calls}`); };

  for (const [name, path] of TABS) {
    for (let i = 0; i < 2; i++) {
      const r = await measure(page, () => page.goto(`${BASE}${path}`, { waitUntil: "commit" }));
      log(`load#${i + 1}`, name, r);
    }
  }

  // Tab clicks in the live tab bar, in order, starting from Lead Lists.
  await page.goto(`${BASE}/coach/campaigns`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const nav = () => page.locator('nav[aria-label$="tools"]').first();
  const labels = (await nav().getByRole("link").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  for (const pass of [1, 2]) {
    for (const label of [...labels.slice(1), labels[0]]) {
      const r = await measure(page, () => nav().getByRole("link", { name: label, exact: true }).first().click());
      log(`click#${pass}`, label, r);
    }
  }

  // Key actions.
  const tryAction = async (name: string, start: string, sel: string) => {
    await page.goto(`${BASE}${start}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    const el = page.locator(sel).filter({ visible: true }).first();
    if (!(await el.count())) { console.log(`action     ${name}: nothing to click (${sel})`); return; }
    console.log(`action     ${name}: clicking "${(await el.innerText().catch(() => "")).slice(0, 40).replace(/\n/g, " ")}"`);
    const r = await measure(page, () => el.click());
    log("action", name, r);
  };
  await tryAction("Open a campaign", "/coach/campaigns", 'main a[href^="/coach/campaigns/"]:not([href*="magnets"]):not([href*="invites"])');
  await tryAction("Open a lead list", "/coach/campaigns?tab=pool", 'main a[href*="list"], main button:has-text("lead"), main [role="row"] >> nth=1');
  await tryAction("Open a conversation", "/coach/conversations", 'main [role="listitem"] >> nth=2, main li button >> nth=2');
  await tryAction("Open a prospect", "/coach/prospects", 'main tbody tr >> nth=0');

  writeFileSync(OUT, JSON.stringify(out, null, 2));
  await browser.close();
}
main().catch((e) => { console.log("ERR", String(e).slice(0, 500)); process.exit(1); });
