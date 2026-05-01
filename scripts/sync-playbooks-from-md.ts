/**
 * Build content/playbooks/{ref}.json from content/playbooks/Source markdown.
 * Run: npx tsx scripts/sync-playbooks-from-md.ts
 *
 * Optional: REFS=2.0,1.0 npx tsx scripts/sync-playbooks-from-md.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { AREAS, LEVELS, getPlaybookMeta } from "../src/lib/bossData";
import { parsePastedPlaybookContent } from "../src/lib/parsePlaybookPaste";
import type {
  ActionDetailSection,
  ActionItem,
  ActionSection,
  PlaybookContent,
  RelatedPlaybookItem,
} from "../src/lib/playbookContentTypes";

const SOURCE_ROOT = path.join(process.cwd(), "content", "playbooks", "Source");
const OUT_DIR = path.join(process.cwd(), "content", "playbooks");

function buildSubtitle(levelId: number, areaId: number): string {
  const level = LEVELS.find((l) => l.id === levelId)?.name ?? "";
  const area = AREAS.find((a) => a.id === areaId)?.name ?? "";
  return `Level ${levelId} · ${level} · ${area}`;
}

function stripFrontmatter(s: string): string {
  if (!s.startsWith("---\n")) return s;
  const end = s.indexOf("\n---\n", 4);
  if (end === -1) return s;
  return s.slice(end + 5).trimStart();
}

/** So parsePastedPlaybookContent section headers match Drive exports like `## **What This Is**`. */
function normalizePlaybookMdForPaste(md: string): string {
  let body = stripFrontmatter(md);
  body = body.replace(/^## \*\*(.+?)\*\*\s*$/gm, "## $1");
  body = body.replace(/^### \*\*(.+?)\*\*\s*$/gm, "### $1");
  return body;
}

function actionMdToDetailSections(markdown: string): ActionDetailSection[] {
  const body = stripFrontmatter(markdown).trim();
  const lines = body.split("\n");
  const sections: ActionDetailSection[] = [];
  let currentTitle = "";
  let currentBody: string[] = [];

  const flush = () => {
    const content = currentBody.join("\n").trim();
    if (currentTitle || content) {
      sections.push({ title: currentTitle, content });
    }
    currentTitle = "";
    currentBody = [];
  };

  let i = 0;
  while (i < lines.length && !/^\s*##\s+/.test(lines[i]!)) {
    i++;
  }

  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      flush();
      currentTitle = h2[1].replace(/\*\*/g, "").trim();
    } else {
      currentBody.push(line);
    }
  }
  flush();
  return sections.filter((s) => s.title || s.content);
}

function parseWikiRelatedFromSection(md: string): RelatedPlaybookItem[] {
  const items: RelatedPlaybookItem[] = [];
  const relatedIdx = md.search(/##\s*\*?\*?Related Playbooks\*?\*?/i);
  if (relatedIdx === -1) return items;
  const tail = md.slice(relatedIdx);
  const re = /\[\[(\d+\.\d+)[^\]]*\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tail)) !== null) {
    items.push({ ref: m[1], description: "" });
  }
  return items;
}

function collectActionDetailMap(playbookDir: string): Map<number, ActionDetailSection[]> {
  const map = new Map<number, ActionDetailSection[]>();
  const entries = fs.readdirSync(playbookDir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile() || !e.name.startsWith("Action ") || !e.name.endsWith(".md")) continue;
    const numMatch = e.name.match(/^Action (\d+) -/i);
    if (!numMatch) continue;
    const num = parseInt(numMatch[1], 10);
    const raw = fs.readFileSync(path.join(playbookDir, e.name), "utf-8");
    map.set(num, actionMdToDetailSections(raw));
  }
  return map;
}

function mergeDetailsFlat(actions: ActionItem[], detailByNum: Map<number, ActionDetailSection[]>): ActionItem[] {
  return actions.map((a) => ({
    ...a,
    detailSections: detailByNum.get(a.number) ?? a.detailSections,
  }));
}

function mergeDetailsSections(
  sections: ActionSection[],
  detailByNum: Map<number, ActionDetailSection[]>
): ActionSection[] {
  return sections.map((sec) => ({
    ...sec,
    actions: sec.actions.map((a) => ({
      ...a,
      detailSections: detailByNum.get(a.number) ?? a.detailSections,
    })),
  }));
}

function defaultWhatItLooksLike(): PlaybookContent["whatItLooksLike"] {
  return {
    broken: { label: "When this is broken", emoji: "🔴", content: "" },
    ok: { label: "When this is OK", emoji: "🟠", content: "" },
    working: { label: "When this is working", emoji: "🟢", content: "" },
  };
}

function stripMdNoise(s: string): string {
  return s
    .replace(/\n*---+\s*$/, "")
    .replace(/\n+###\s*$/, "")
    .trim();
}

function buildOnePlaybookJson(playbookDir: string, ref: string): PlaybookContent | null {
  const meta = getPlaybookMeta(ref);
  if (!meta) return null;

  const folderName = path.basename(playbookDir);
  const mainName = `${folderName}.md`;
  const mainPath = path.join(playbookDir, mainName);
  if (!fs.existsSync(mainPath)) {
    console.warn(`Skip ${ref}: missing ${mainName}`);
    return null;
  }

  const mainRaw = fs.readFileSync(mainPath, "utf-8");
  const parsed = parsePastedPlaybookContent(normalizePlaybookMdForPaste(mainRaw));
  const detailByNum = collectActionDetailMap(playbookDir);

  let whatItLooksLike: PlaybookContent["whatItLooksLike"] =
    parsed.whatItLooksLike ?? defaultWhatItLooksLike();
  for (const key of ["broken", "ok", "working"] as const) {
    whatItLooksLike[key] = {
      ...whatItLooksLike[key],
      content: stripMdNoise(whatItLooksLike[key].content),
    };
  }

  const wikiRelated = parseWikiRelatedFromSection(stripFrontmatter(mainRaw));
  const relatedPlaybooks: RelatedPlaybookItem[] =
    parsed.relatedPlaybooks?.length ? parsed.relatedPlaybooks : wikiRelated;

  const base: Omit<PlaybookContent, "actions" | "actionSections"> = {
    ref: meta.ref,
    level: meta.level,
    area: meta.area,
    name: meta.name,
    subtitle: buildSubtitle(meta.level, meta.area),
    whatThisIs: stripMdNoise(parsed.whatThisIs ?? ""),
    whatItLooksLike,
    thingsToThinkAbout: (parsed.thingsToThinkAbout ?? []).filter(
      (t) => !/^-{2,}$/.test(t.trim())
    ),
    actionsIntro: parsed.actionsIntro,
    quickWins: (parsed.quickWins ?? []).filter((t) => !/^-{2,}$/.test(t.trim())),
    relatedPlaybooks,
  };

  if (parsed.actionSections?.length) {
    return {
      ...base,
      actions: [],
      actionSections: mergeDetailsSections(parsed.actionSections, detailByNum),
    };
  }

  const actions = mergeDetailsFlat(parsed.actions ?? [], detailByNum);
  return {
    ...base,
    actions,
  };
}

function main() {
  const onlyRefs = process.env.REFS?.split(",").map((s) => s.trim()).filter(Boolean);

  let written = 0;
  for (const areaEntry of fs.readdirSync(SOURCE_ROOT, { withFileTypes: true })) {
    if (!areaEntry.isDirectory()) continue;
    const areaPath = path.join(SOURCE_ROOT, areaEntry.name);
    for (const pbEntry of fs.readdirSync(areaPath, { withFileTypes: true })) {
      if (!pbEntry.isDirectory()) continue;
      const m = pbEntry.name.match(/^(\d+\.\d+)\s/);
      if (!m) continue;
      const ref = m[1];
      if (onlyRefs?.length && !onlyRefs.includes(ref)) continue;

      const playbookDir = path.join(areaPath, pbEntry.name);
      const json = buildOnePlaybookJson(playbookDir, ref);
      if (!json) continue;

      const outPath = path.join(OUT_DIR, `${ref}.json`);
      fs.writeFileSync(outPath, `${JSON.stringify(json, null, 2)}\n`, "utf-8");
      written++;
      console.log(`Wrote ${outPath}`);
    }
  }

  console.log(`Done. ${written} playbook JSON file(s).`);
}

main();
