// Drive the Agent view in the AI panel on the dev server and screenshot each step.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ref = URL_.match(/https:\/\/([^.]+)\./)[1];
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const USER = process.env.AS_USER || "01df174c-646c-4a29-8e76-9d0132735434";
const { data: u } = await admin.auth.admin.getUserById(USER);
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const { data: ses, error: ve } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
if (ve) throw ve;

const [base, outDir, path, ...steps] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const viewport = process.env.MOBILE ? { width: 390, height: 844 } : { width: 1440, height: 1000 };
const ctx = await browser.newContext({ viewport });
await ctx.addInitScript(([key, value]) => { localStorage.setItem(key, value); }, [`sb-${ref}-auth-token`, JSON.stringify(ses.session)]);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 200)); });
await page.goto(base + path, { waitUntil: "networkidle", timeout: 180000 }).catch((e) => console.log("goto", e.message));
await page.waitForTimeout(2000);
let n = 0;
const shot = async (label) => { const f = `${outDir}/${String(++n).padStart(2, "0")}-${label}.png`; await page.screenshot({ path: f }); console.log("shot", f); };
const idle = async () => {
  // Wait until the send button stops spinning (turn finished).
  const spin = 'aside[aria-label="Profit Coach AI panel"] button[aria-label="Send"] svg.animate-spin';
  for (let i = 0; i < 10 && !(await page.locator(spin).count()); i++) await page.waitForTimeout(500);
  for (let i = 0; i < 240; i++) {
    const busy = await page.locator('aside[aria-label="Profit Coach AI panel"] button[aria-label="Send"] svg.animate-spin').count();
    if (!busy) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(800);
};
for (const step of steps) {
  if (step === "shot") { await shot("page"); console.log("url", page.url()); }
  else if (step === "open") { await page.getByRole("button", { name: "Open AI panel" }).first().click(); await page.waitForTimeout(1500); await shot("panel"); }
  else if (step === "agent") { await page.locator('aside[aria-label="Profit Coach AI panel"] button[title="Agent"]').click(); await page.waitForTimeout(1500); await shot("agent"); }
  else if (step === "full") { await page.getByRole("button", { name: "Expand to full screen" }).click(); await page.waitForTimeout(1200); await page.getByRole("button", { name: "Agent" }).first().click().catch(() => {}); await page.waitForTimeout(800); await shot("fullscreen"); }
  else if (step === "confirm" || step === "cancel") {
    await page.locator('aside[aria-label="Profit Coach AI panel"]').getByRole("button", { name: step === "confirm" ? "Confirm" : "Cancel" }).last().click();
    await idle(); await shot(step);
  } else {
    const box = page.locator('aside[aria-label="Profit Coach AI panel"] textarea').last();
    await box.fill(step); await box.press("Enter");
    await idle(); await shot("reply");
  }
}
await browser.close();
