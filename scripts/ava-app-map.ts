/**
 * Write Ava's page map from the code (job 226). Reads every coach page under
 * src/app/coach (and the components it uses), asks Claude what a coach sees
 * there, and writes:
 *
 *   content/agent/references/app-pages.md    what Ava reads (Guide capability)
 *   content/agent/references/app-pages.json  the same pages as data, for link_to_page,
 *                                            plus a hash per page so unchanged pages are skipped
 *
 *   npx tsx scripts/ava-app-map.ts            # only pages whose code changed
 *   npx tsx scripts/ava-app-map.ts --all      # read every page again
 *   npx tsx scripts/ava-app-map.ts --dry-run  # list the pages, no API calls
 *
 * Unreleased pages (adminPreviewRoutes) and redirect-only pages are left out.
 * A full run costs about $3 (Sonnet 5.5); the end prints the exact cost.
 */
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const ROOT = process.cwd();
const APP_COACH = path.join(ROOT, "src/app/coach");
const OUT_MD = path.join(ROOT, "content/agent/references/app-pages.md");
const OUT_JSON = path.join(ROOT, "content/agent/references/app-pages.json");
const MODEL = "claude-sonnet-5-5";
const MAX_SOURCE_CHARS = 150_000;
/** Tab bars, headers and small parts are dense with labels, so they go in first. */
const SMALL_FILE_CHARS = 8_000;
const CONCURRENCY = 4;

const argv = process.argv.slice(2);
const ALL = argv.includes("--all");
const DRY = argv.includes("--dry-run");

/** Never mapped: catch-alls and the "not available" page. */
const SKIP_ROUTES = new Set(["/coach/[...missing]", "/coach/page-not-available"]);

/**
 * Hidden by code the page itself doesn't show:
 * - /coach/signature*: Compass and Scorecard are admin-only; src/app/coach/layout.tsx sends coaches to Classroom.
 * - /coach/academy/compass: the old Classroom catalog, only reached from old links.
 * - /coach/prospects/open: a loading step that opens a person from the Pool.
 */
const HIDDEN_PREFIXES = ["/coach/signature", "/coach/academy/compass", "/coach/prospects/open"];

type PageEntry = {
  path: string;
  /** Same page in admin mode, when the admin surface has it. */
  adminPath: string | null;
  hash: string;
  coachVisible: boolean;
  title: string;
  where: string;
  summary: string;
  tabs: { label: string; path: string | null }[];
  controls: string[];
  notes: string;
};

type MapFile = { generatedAt: string; model: string; pages: PageEntry[] };

// ---------- finding the pages ----------

function listRoutes(): string[] {
  const routes: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === "page.tsx") {
        const rel = path.relative(path.join(ROOT, "src/app"), path.dirname(full));
        routes.push("/" + rel.split(path.sep).join("/"));
      }
    }
  };
  walk(APP_COACH);
  return routes.sort();
}

function routeFile(route: string): string {
  return path.join(ROOT, "src/app", route, "page.tsx");
}

/** Pages that only send you somewhere else. */
function redirectOnly(src: string): boolean {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return /\bredirect\(/.test(code) && code.split("\n").filter((l) => l.trim()).length < 25 && !/return\s*\(\s*</.test(code);
}

async function unreleased(route: string): Promise<boolean> {
  const { adminPreviewCoachRouteForPath } = await import("@/lib/coachAccess/adminPreviewRoutes");
  const sample = route.replace(/\[[^\]]+\]/g, "00000000-0000-0000-0000-000000000000");
  return adminPreviewCoachRouteForPath(sample) !== null;
}

/** One dynamic segment at most, and only at the end ("open one from the list"). */
function shapeOk(route: string): boolean {
  const dynamic = route.split("/").filter((s) => s.startsWith("["));
  if (dynamic.length === 0) return true;
  return dynamic.length === 1 && route.endsWith("]");
}

// ---------- reading the code behind a page ----------

const EXTS = [".tsx", ".ts", "/index.tsx", "/index.ts"];

function resolveImport(spec: string, fromFile: string): string | null {
  let base: string | null = null;
  if (spec.startsWith("@/components/") || spec.startsWith("@/app/")) base = path.join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  if (!base) return null;
  // Only UI files: what is on screen lives in components and app pages.
  if (!base.includes(`${path.sep}components${path.sep}`) && !base.includes(`${path.sep}app${path.sep}`)) return null;
  for (const ext of ["", ...EXTS]) {
    const f = base + ext;
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

/** The page file plus the components it pulls in, three levels deep, capped. */
function sourceFor(route: string): { files: string[]; text: string } {
  const start = routeFile(route);
  const seen = new Set<string>();
  const order: string[] = [];
  let frontier = [start];
  const layout = path.join(path.dirname(start), "layout.tsx");
  if (fs.existsSync(layout)) frontier.push(layout);
  for (let depth = 0; depth <= 3 && frontier.length; depth++) {
    const next: string[] = [];
    for (const file of frontier) {
      if (seen.has(file)) continue;
      seen.add(file);
      order.push(file);
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
        const hit = resolveImport(m[1], file);
        if (hit && !seen.has(hit) && !/\/(ui|layout|ava|icons?)\//.test(hit)) next.push(hit);
      }
    }
    frontier = next;
  }
  let text = "";
  const used: string[] = [];
  const size = (f: string) => fs.statSync(f).size;
  const ranked = [order[0], ...order.slice(1).filter((f) => size(f) <= SMALL_FILE_CHARS), ...order.slice(1).filter((f) => size(f) > SMALL_FILE_CHARS)];
  for (const file of ranked) {
    const rel = path.relative(ROOT, file);
    const chunk = `\n\n===== ${rel} =====\n${fs.readFileSync(file, "utf8")}`;
    if (text.length + chunk.length > MAX_SOURCE_CHARS) {
      if (used.length === 0) text += chunk.slice(0, MAX_SOURCE_CHARS);
      continue;
    }
    text += chunk;
    used.push(rel);
  }
  return { files: used.length ? used : [path.relative(ROOT, start)], text };
}

/** Sidebar and tab names, so "where" uses the names coaches see. */
function navSummary(): string {
  const src = fs.readFileSync(path.join(ROOT, "src/components/layout/dashboardNavItems.tsx"), "utf8");
  const lines: string[] = [];
  let fn = "";
  for (const line of src.split("\n")) {
    const f = line.match(/^export function (\w+)/);
    if (f) fn = f[1];
    const href = line.match(/href:\s*(.+?),\s*$/);
    if (href) lines.push(`${fn}: href ${href[1]}`);
    const label = line.match(/label:\s*"([^"]+)"/);
    if (label) lines.push(`${fn}:   label "${label[1]}"`);
    const desc = line.match(/description:\s*"([^"]+)"/);
    if (desc) lines.push(`${fn}:   description "${desc[1]}"`);
  }
  return lines.filter((l) => !l.startsWith("admin")).join("\n");
}

// ---------- asking Claude ----------

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    coach_visible: {
      type: "boolean",
      description:
        "False if a coach can never see this page: admin-only, a redirect, a test or old copy of another page.",
    },
    title: {
      type: "string",
      description:
        "The name of THIS page: its tab name or heading, e.g. \"Calls\", not the section it sits in (\"Win Clients\"). For a page about one item, say what it is, e.g. \"One campaign\".",
    },
    where: {
      type: "string",
      description: "How a coach gets there, using the sidebar and tab names, e.g. \"Get Calls → Campaigns\".",
    },
    summary: { type: "string", description: "One plain sentence: what the coach does here." },
    tabs: {
      type: "array",
      description:
        "Tabs inside this page, in screen order. Leave out the shared row of section tabs (e.g. the Get Calls tabs Lead Lists, Campaigns, Conversations… or the Win Clients tabs Calls, Pipeline, Scripts…), which link to other pages. path = the link that opens that tab, if the code shows one (e.g. /coach/campaigns?tab=pool), else null.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { label: { type: "string" }, path: { type: ["string", "null"] } },
        required: ["label", "path"],
      },
    },
    controls: {
      type: "array",
      description:
        "The main buttons, fields, sections and switches a coach sees, with exact on-screen labels in **bold** and a few words on where or what, e.g. \"**Client stories** field in About you\". At most 14.",
      items: { type: "string" },
    },
    notes: {
      type: "string",
      description:
        "At most three short sentences Ava must know to guide someone: what must be connected or switched on first, and parts coaches never see. Empty if nothing.",
    },
  },
  required: ["coach_visible", "title", "where", "summary", "tabs", "controls", "notes"],
} as const;

const SYSTEM = `You write the page map for Ava, the AI assistant inside the Profit Coach app. Coaches ask her "where is…" and "how do I…". She can only describe what is in this map, so it must match the screen exactly.

You get the source code of one coach page (Next.js, React) and the sidebar names. Describe what a COACH sees on that page:
- Use the exact labels from the code (button text, tab names, headings, field labels). Never invent a label.
- Leave out anything shown only to admins (isAdmin, adminOnly, admin mode checks) and anything behind a switched-off flag. Mention in notes if a part is admin-only so Ava never offers it.
- Plain words. Short. No code terms (no "component", "route", "modal" — say "pop-up", "page", "box").
- The page path is given; for "where", start from the sidebar item that leads there.`;

let client: import("@anthropic-ai/sdk").default | null = null;
const tally = { calls: 0, input: 0, output: 0 };

async function describe(route: string, source: string, nav: string): Promise<Omit<PageEntry, "path" | "adminPath" | "hash">> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  client ??= new Anthropic();
  const params = {
    model: MODEL,
    max_tokens: 4000,
    system: [
      { type: "text", text: SYSTEM },
      { type: "text", text: `Sidebar and tab names:\n${nav}`, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: `Page: ${route}\n\nCode:${source}` }],
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
  };
  const message = await client.messages.create(params as unknown as Parameters<typeof client.messages.create>[0]);
  const msg = message as unknown as {
    stop_reason: string;
    usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
    content: { type: string; text?: string }[];
  };
  tally.calls += 1;
  tally.input += msg.usage.input_tokens + (msg.usage.cache_read_input_tokens ?? 0) * 0.1;
  tally.output += msg.usage.output_tokens;
  if (msg.stop_reason === "max_tokens") throw new Error(`${route}: ran out of room`);
  const raw = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const out = JSON.parse(raw) as {
    coach_visible: boolean;
    title: string;
    where: string;
    summary: string;
    tabs: { label: string; path: string | null }[];
    controls: string[];
    notes: string;
  };
  return {
    coachVisible: out.coach_visible,
    title: out.title.trim(),
    where: out.where.trim(),
    summary: out.summary.trim(),
    // A tab link must stay on this page; anything else is a guess.
    tabs: out.tabs.map((t) => ({
      label: t.label.trim(),
      path: t.path && t.path.split("?")[0] === route && !t.path.includes("[") ? t.path : null,
    })),
    controls: out.controls.slice(0, 14).map((c) => c.trim()),
    notes: out.notes.trim(),
  };
}

// ---------- writing the map ----------

/**
 * The Blueprint's pages and boxes come from data, not page code, so they are
 * listed straight from BLUEPRINT_GROUPS (no AI): exact titles, never stale.
 */
async function blueprintOutline(): Promise<string[]> {
  const { BLUEPRINT_GROUPS } = await import("@/lib/practiceKnowledge/blueprint");
  const lines = [
    "",
    "## My Blueprint: every page, section and box",
    "Sidebar → **My Blueprint**. Groups, then pages (with their path), then sections and the boxes in each. Groups marked (coach fills in) are the coach's job; BCA writes the rest.",
  ];
  for (const group of BLUEPRINT_GROUPS) {
    lines.push("", `### ${group.label}${group.yours ? " (coach fills in)" : ""}`);
    for (const page of group.pages) {
      lines.push(`- **${page.title}** (\`${page.href}\`)`);
      for (const section of page.sections) {
        if (section.retired) continue;
        const boxes = (section.fields ?? []).map((f) => f.label).filter(Boolean);
        lines.push(`  - ${section.title}${boxes.length ? `: ${boxes.map((b) => `**${b}**`).join(", ")}` : ""}`);
      }
    }
  }
  return lines;
}

/** The short index Ava reads. Buttons, boxes and notes per page come from page_details. */
function markdown(pages: PageEntry[], blueprint: string[]): string {
  const lines = [
    "# Every page a coach can open",
    "",
    "Written from the app's code by `scripts/ava-app-map.ts`; do not edit by hand (run the script again). **Bold** = exactly what is on screen. Some pages need a membership or a connection first; if a coach can't see something, say so and point them to Support.",
    "",
    "- For the buttons, boxes and what must be connected on one page, call `page_details` with its path. Do this before naming any button.",
    "- To give a button to a page or tab, call `link_to_page` with `path` set to a path below.",
    "",
    "## Pages",
  ];
  for (const p of pages.filter((x) => x.coachVisible)) {
    const tabs = p.tabs.length
      ? ` Tabs: ${p.tabs.map((t) => (t.path ? `**${t.label}** \`${t.path}\`` : `**${t.label}**`)).join(", ")}.`
      : "";
    lines.push(`- **${p.title}** \`${p.path}\`: ${p.where.replace(/\.+$/, "")}. ${p.summary}${tabs}`);
  }
  lines.push(...blueprint);
  return lines.join("\n") + "\n";
}

async function main() {
  const previous: MapFile | null = fs.existsSync(OUT_JSON) ? JSON.parse(fs.readFileSync(OUT_JSON, "utf8")) : null;
  const old = new Map((previous?.pages ?? []).map((p) => [p.path, p]));
  const nav = navSummary();

  const routes: string[] = [];
  for (const route of listRoutes()) {
    if (SKIP_ROUTES.has(route) || !shapeOk(route)) continue;
    if (HIDDEN_PREFIXES.some((p) => route === p || route.startsWith(`${p}/`))) continue;
    if (await unreleased(route)) continue;
    if (redirectOnly(fs.readFileSync(routeFile(route), "utf8"))) continue;
    routes.push(route);
  }

  const jobs = routes.map((route) => {
    const { text } = sourceFor(route);
    const hash = createHash("sha256").update(MODEL + SYSTEM + JSON.stringify(SCHEMA) + nav + text).digest("hex").slice(0, 16);
    const adminRoute = route.replace(/^\/coach/, "/admin");
    const adminPath = fs.existsSync(routeFile(adminRoute)) ? adminRoute : null;
    const cached = old.get(route);
    return { route, text, hash, adminPath, cached: !ALL && cached?.hash === hash ? cached : null };
  });

  const todo = jobs.filter((j) => !j.cached);
  console.log(`${routes.length} coach pages; ${todo.length} to read, ${routes.length - todo.length} unchanged.`);
  if (DRY) {
    for (const j of jobs) console.log(`${j.cached ? "  same" : "  READ"}  ${j.route}  (${Math.round(j.text.length / 1000)}k chars)`);
    return;
  }

  const results = new Map<string, PageEntry>();
  for (const j of jobs) if (j.cached) results.set(j.route, { ...j.cached, adminPath: j.adminPath });
  const failed: string[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < todo.length) {
        const j = todo[i++];
        try {
          const d = await describe(j.route, j.text, nav);
          results.set(j.route, { path: j.route, adminPath: j.adminPath, hash: j.hash, ...d });
          console.log(`  ${d.coachVisible ? "ok  " : "hide"}  ${j.route}  ${d.title}`);
        } catch (e) {
          failed.push(j.route);
          console.error(`  FAIL  ${j.route}: ${(e as Error).message}`);
          // Keep the old entry rather than drop the page.
          const prev = old.get(j.route);
          if (prev) results.set(j.route, { ...prev, hash: "stale" });
        }
      }
    })
  );

  const pages = routes.map((r) => results.get(r)).filter((p): p is PageEntry => !!p);
  const file: MapFile = { generatedAt: new Date().toISOString(), model: MODEL, pages };
  fs.writeFileSync(OUT_JSON, JSON.stringify(file, null, 2) + "\n");
  fs.writeFileSync(OUT_MD, markdown(pages, await blueprintOutline()));

  // Sonnet 5.5: $3 in, $15 out per million.
  const cost = (tally.input * 3 + tally.output * 15) / 1e6;
  const md = fs.readFileSync(OUT_MD, "utf8");
  console.log(
    `\nWrote ${pages.filter((p) => p.coachVisible).length} pages (${pages.length - pages.filter((p) => p.coachVisible).length} hidden) to ${path.relative(ROOT, OUT_MD)}, ${md.length} chars. ${tally.calls} calls, about $${cost.toFixed(2)}.`
  );
  if (failed.length) {
    console.error(`${failed.length} pages failed: ${failed.join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
