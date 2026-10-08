// Local visual check: sign in as an admin via a one-time magic link token and
// screenshot pages from the dev server. Output goes to the scratchpad.
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

const ADMIN_ID = process.env.AS_USER || "01df174c-646c-4a29-8e76-9d0132735434";
const { data: u } = await admin.auth.admin.getUserById(ADMIN_ID);
const { data: link, error: le } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
if (le) throw le;
const { data: ses, error: ve } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
if (ve) throw ve;

const [base, outDir, ...targets] = process.argv.slice(2);
const coach = process.env.PREVIEW_COACH || "";
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
for (const [name, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
  if (process.env.ONLY && process.env.ONLY !== name) continue;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.addInitScript(([key, value, coachId]) => {
    localStorage.setItem(key, value);
    if (coachId) sessionStorage.setItem("blueprint-preview-coach", coachId);
    localStorage.setItem("practice-assistant-open", "1");
  }, [`sb-${ref}-auth-token`, JSON.stringify(ses.session), coach]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", name, e.message));
  let last = "";
  for (const t of targets) {
    const [path, anchor] = t.split("#");
    if (path !== last) {
      await page.goto(base + path, { waitUntil: "networkidle", timeout: 180000 }).catch((e) => console.log("goto", e.message));
      await page.waitForTimeout(2500);
      last = path;
    }
    if (anchor) {
      await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: "start" }), anchor);
      await page.waitForTimeout(600);
    }
    const file = `${outDir}/${name}${t.replace(/[^a-z0-9]+/gi, "_")}.png`;
    await page.screenshot({ path: file, fullPage: process.env.FULL === "1" });
    console.log("shot", file);
  }
  await ctx.close();
}
await browser.close();
