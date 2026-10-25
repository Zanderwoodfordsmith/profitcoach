/**
 * Admin → Brand → Design: collects every live version of the common app
 * pieces (buttons, cards, headers, modals, empty states, tables, fields,
 * badges) and every text style in use, straight from the code.
 *
 * Writes src/components/designBoard/inventory.json. Run again after big
 * design changes:
 *   npx tsx scripts/design-inventory.ts
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const OUT = join(ROOT, "src/components/designBoard/inventory.json");

// Marketing pages have their own look; the board is about the app.
const SKIP_DIRS = [
  "src/components/designBoard",
  "src/components/avaDesign",
  "src/app/home-v3",
  "src/app/landing",
  "src/app/pam",
  "src/app/preview",
  "src/app/score",
  "src/app/site",
];

export type Kind =
  | "button"
  | "card"
  | "header"
  | "modal"
  | "empty"
  | "table"
  | "field"
  | "badge";

type Use = { file: string; line: number; page: string | null };

type Found = {
  kind: Kind;
  tag: string;
  className: string;
  sig: string;
  text: string;
  use: Use;
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(ROOT, p);
    if (SKIP_DIRS.some((s) => rel === s || rel.startsWith(s + "/"))) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** src/app/admin/brand/page.tsx → /admin/brand. Components return null. */
function pageFor(rel: string): string | null {
  const m = rel.match(/^src\/app\/(.*)\/(page|layout)\.tsx$/);
  if (!m) return null;
  const path = m[1]
    .split("/")
    .filter((s) => !/^\(.*\)$/.test(s))
    .join("/");
  return "/" + path;
}

/** The static part of a className: a plain string, a template's fixed text, or cn("...")'s string args. */
function staticClass(expr: ts.Expression | undefined): string | null {
  if (!expr) return null;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  if (ts.isTemplateExpression(expr)) {
    const parts = [expr.head.text, ...expr.templateSpans.map((s) => s.literal.text)];
    return parts.join(" ");
  }
  if (ts.isCallExpression(expr)) {
    const strs = expr.arguments
      .filter((a): a is ts.StringLiteral => ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))
      .map((a) => a.text);
    return strs.length ? strs.join(" ") : null;
  }
  return null;
}

function classOf(attrs: ts.JsxAttributes): string | null {
  for (const p of attrs.properties) {
    if (!ts.isJsxAttribute(p) || p.name.getText() !== "className" || !p.initializer) continue;
    if (ts.isStringLiteral(p.initializer)) return p.initializer.text;
    if (ts.isJsxExpression(p.initializer)) return staticClass(p.initializer.expression);
  }
  return null;
}

function attrOf(attrs: ts.JsxAttributes, name: string): string | null {
  for (const p of attrs.properties) {
    if (ts.isJsxAttribute(p) && p.name.getText() === name && p.initializer && ts.isStringLiteral(p.initializer)) return p.initializer.text;
  }
  return null;
}

function tokens(cls: string): string[] {
  return cls.split(/\s+/).filter(Boolean);
}

/**
 * What decides the look. Layout and spacing outside the piece (margins,
 * widths, flex placement, responsive tweaks) is left out so the same
 * button in two places counts once.
 */
const LOOK =
  /^(?:hover:|focus:|focus-visible:|disabled:|active:)?(?:rounded|border|bg-|text-|font-|shadow|ring|px-|py-|p-|h-\d|h-\[|min-h-|leading-|tracking-|uppercase|italic|backdrop|opacity|transition|outline)/;

function signature(cls: string): string {
  return [...new Set(tokens(cls).filter((t) => !t.includes("sm:") && !t.includes("md:") && !t.includes("lg:") && !t.includes("dark:") && LOOK.test(t)))]
    .sort()
    .join(" ");
}

function has(cls: string, re: RegExp) {
  return tokens(cls).some((t) => re.test(t));
}

function textOf(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
  if (ts.isJsxSelfClosingElement(node)) return "";
  let s = "";
  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n)) s += " " + n.text;
    else if (ts.isStringLiteral(n) && ts.isJsxExpression(n.parent)) s += " " + n.text;
    ts.forEachChild(n, visit);
  };
  node.children.forEach(visit);
  return s.replace(/\s+/g, " ").trim().slice(0, 48);
}

function classify(tag: string, cls: string, type: string | null): Kind | null {
  const lower = tag.toLowerCase();
  const floating = has(cls, /^(absolute|fixed|pointer-events-none|sr-only|hidden)$/);
  const rounded = has(cls, /^rounded/);
  const padded = has(cls, /^(px|py|p)-/) || has(cls, /^h-(8|9|10|11|12)$/);
  const filled = has(cls, /^bg-/) || has(cls, /^border/);

  if (lower === "input" && type && /^(checkbox|radio|hidden|file|range|color|submit)$/.test(type)) return null;
  if (lower === "input" || lower === "textarea" || lower === "select") return has(cls, /^sr-only$/) ? null : "field";
  if (lower === "th" || lower === "table") return "table";
  if (lower === "h1") return "header";
  // A full-screen layer with a colour is a pop-up backdrop; without one it's an invisible click-catcher.
  if (has(cls, /^fixed$/) && has(cls, /^inset-0$/)) return has(cls, /^bg-/) ? "modal" : null;
  if (has(cls, /^border-dashed$/) && rounded) return "empty";
  if ((lower === "button" || lower === "link" || lower === "a") && rounded && padded && filled) return "button";
  if (floating) return null;
  if (
    (lower === "span" || lower === "div") &&
    has(cls, /^rounded-(full|md|lg)$/) &&
    has(cls, /^text-(xs|\[1[01]px\]|\[9px\])$/) &&
    has(cls, /^px-/) &&
    has(cls, /^bg-/)
  )
    return "badge";
  if (
    (lower === "div" || lower === "section" || lower === "article" || lower === "li") &&
    has(cls, /^rounded-(xl|2xl|3xl|\[)/) &&
    has(cls, /^border$/) &&
    has(cls, /^bg-(white|slate-50)/) &&
    has(cls, /^p(x|y)?-/)
  )
    return "card";
  return null;
}

/** Text style = size + weight + line height + tracking + case. */
const SIZE = /^text-(xs|sm|base|lg|xl|[2-9]xl|\[\d+(?:\.\d+)?(?:px|rem)\])$/;
const WEIGHT = /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/;
const LEADING = /^leading-/;
const TRACKING = /^tracking-/;

function textStyle(cls: string): string | null {
  const t = tokens(cls).filter((x) => !x.includes(":"));
  const size = t.find((x) => SIZE.test(x));
  if (!size) return null;
  const weight = t.find((x) => WEIGHT.test(x)) ?? "font-normal";
  const leading = t.find((x) => LEADING.test(x));
  const tracking = t.find((x) => TRACKING.test(x));
  const upper = t.includes("uppercase") ? "uppercase" : null;
  return [size, weight, leading, tracking, upper].filter(Boolean).join(" ");
}

const found: Found[] = [];
const styles = new Map<string, { count: number; files: Set<string>; sample: string }>();

for (const file of walk(join(ROOT, "src"))) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (n: ts.Node) => {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const open = ts.isJsxElement(n) ? n.openingElement : n;
      const tag = open.tagName.getText();
      const cls = classOf(open.attributes);
      if (cls) {
        const line = sf.getLineAndCharacterOfPosition(open.getStart()).line + 1;
        const use = { file: rel, line, page: pageFor(rel) };
        const kind = classify(tag, cls, attrOf(open.attributes, "type"));
        if (kind) {
          found.push({ kind, tag, className: cls.replace(/\s+/g, " ").trim(), sig: signature(cls), text: textOf(n), use });
        }
        const st = textStyle(cls);
        if (st) {
          const e = styles.get(st) ?? { count: 0, files: new Set(), sample: "" };
          e.count++;
          e.files.add(rel);
          if (!e.sample) e.sample = textOf(n);
          styles.set(st, e);
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// One version per look signature, grouped into families by what the eye
// sees first (shape, fill, size). Versions in one family are near-copies:
// they should be one component, or share parts of one.
type Version = {
  id: string;
  tag: string;
  className: string;
  text: string;
  count: number;
  uses: Use[];
};

type Family = {
  id: string;
  kind: Kind;
  name: string;
  count: number;
  versions: Version[];
};

const TONES: [RegExp, string][] = [
  [/^(\[#0c5290\]|\[#051e36\]|\[#061a2e\]|\[#0d1f31\]|\[#0f172a\]|slate-(800|900|950)|black|zinc-(800|900))$/i, "navy"],
  [/^(sky|blue|indigo|cyan)-/, "blue"],
  [/^(emerald|green|teal|\[#10b981\])/, "green"],
  [/^(rose|red|pink)-/, "red"],
  [/^(amber|yellow|orange)-/, "amber"],
  [/^(violet|purple|fuchsia)-/, "violet"],
  [/^(slate|gray|zinc|neutral|\[#d5dde5\]|\[#cbd4df\]|\[#e3e9f0\]|\[#e3e8ef\])/i, "grey"],
  [/^white/, "white"],
];

function tone(c: string): string {
  for (const [re, name] of TONES) if (re.test(c)) return name;
  return "other";
}

function shade(c: string): number {
  const m = c.match(/-(\d{2,3})(?:\/\d+)?$/);
  return m ? Number(m[1]) : c.startsWith("[#") || c === "black" ? 800 : c === "white" ? 0 : 500;
}

function base(cls: string) {
  return tokens(cls).filter((t) => !t.includes(":"));
}

function fill(cls: string): string {
  const t = base(cls);
  const bg = t.find((x) => /^bg-/.test(x) && !/^bg-(transparent|clip|cover|center|gradient|none|opacity)/.test(x))?.slice(3);
  const border = t.some((x) => x === "border" || /^border-[248]$/.test(x));
  if (t.some((x) => x.startsWith("bg-gradient"))) return "gradient";
  if (!bg || bg === "transparent") return border ? "outline" : "plain";
  const tn = tone(bg);
  if (tn === "white") return border ? "white, outlined" : "white";
  if (tn === "grey" && shade(bg) < 300) return "grey, soft";
  return shade(bg) < 300 ? `${tn}, soft` : `${tn}, solid`;
}

function shape(cls: string): string {
  const r = base(cls).find((x) => /^rounded/.test(x)) ?? "rounded-none";
  if (r === "rounded-full") return "pill";
  if (/^rounded-(none|sm|md)$/.test(r) || r === "rounded") return "square";
  if (/^rounded-(lg|xl)$/.test(r)) return "rounded";
  return "very rounded";
}

function size(cls: string): string {
  return base(cls).find((x) => SIZE.test(x))?.slice(5) ?? "base";
}

function shadowOf(cls: string): string {
  const s = base(cls).find((x) => /^shadow/.test(x));
  if (!s || s === "shadow-none") return "flat";
  return /^shadow-(sm)?$|^shadow$/.test(s) ? "light shadow" : "deep shadow";
}

function familyName(kind: Kind, tag: string, cls: string): string {
  switch (kind) {
    case "button":
    case "badge":
      return `${shape(cls)} · ${fill(cls)} · text ${size(cls)}`;
    case "card":
    case "empty":
      return `${shape(cls)} · ${fill(cls)} · ${shadowOf(cls)}`;
    case "field":
      return `${tag.toLowerCase()} · ${shape(cls)} · ${fill(cls)} · text ${size(cls)}`;
    case "table":
      return `${tag.toLowerCase()} · text ${size(cls)} · ${base(cls).find((x) => WEIGHT.test(x))?.slice(5) ?? "normal"}${base(cls).includes("uppercase") ? " · capitals" : ""}`;
    case "header":
      return `text ${size(cls)} · ${base(cls).find((x) => WEIGHT.test(x))?.slice(5) ?? "normal"}`;
    case "modal": {
      const bg = base(cls).find((x) => /^bg-/.test(x))?.slice(3) ?? "none";
      return `backdrop ${bg}${base(cls).some((x) => x.startsWith("backdrop-blur")) ? " · blurred" : ""}`;
    }
  }
}

const families = new Map<string, Family>();
for (const f of found) {
  const name = familyName(f.kind, f.tag, f.className);
  const fkey = `${f.kind}|${name}`;
  let fam = families.get(fkey);
  if (!fam) {
    fam = { id: f.kind + "-" + createHash("sha1").update(fkey).digest("hex").slice(0, 8), kind: f.kind, name, count: 0, versions: [] };
    families.set(fkey, fam);
  }
  fam.count++;
  let v = fam.versions.find((x) => signature(x.className) === f.sig);
  if (!v) {
    v = { id: createHash("sha1").update(f.sig).digest("hex").slice(0, 8), tag: f.tag, className: f.className, text: f.text, count: 0, uses: [] };
    fam.versions.push(v);
  }
  v.count++;
  if (v.uses.length < 4) v.uses.push(f.use);
  if (!v.text && f.text) v.text = f.text;
}

const familyList = [...families.values()].sort((a, b) => b.count - a.count);
for (const fam of familyList) {
  fam.versions.sort((a, b) => b.count - a.count);
  (fam as Family & { versionCount: number }).versionCount = fam.versions.length;
  // The board shows the most used; the rest only add to the count.
  fam.versions = fam.versions.slice(0, 8);
}

// Text styles grouped by size and weight; line height, spacing and capitals
// show as the variants inside each.
const SIZE_PX: Record<string, number> = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36, "5xl": 48, "6xl": 60, "7xl": 72, "8xl": 96, "9xl": 128 };
const WEIGHT_ORDER = ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"];
function px(size: string) {
  const m = size.match(/^\[(\d+(?:\.\d+)?)(px|rem)\]$/);
  return m ? Number(m[1]) * (m[2] === "rem" ? 16 : 1) : SIZE_PX[size] ?? 16;
}
const grouped = new Map<string, { px: number; weight: string; count: number; files: Set<string>; sample: string; spellings: Map<string, number>; variants: Map<string, number> }>();
for (const [style, e] of styles) {
  const [sizeTok, weightTok, ...rest] = style.split(" ");
  const size = px(sizeTok.slice(5));
  const key = `${size} ${weightTok}`;
  const g = grouped.get(key) ?? { px: size, weight: weightTok.slice(5), count: 0, files: new Set<string>(), sample: "", spellings: new Map(), variants: new Map() };
  g.spellings.set(sizeTok, (g.spellings.get(sizeTok) ?? 0) + e.count);
  g.count += e.count;
  e.files.forEach((f) => g.files.add(f));
  if (!g.sample && e.sample) g.sample = e.sample;
  const extra = rest.join(" ") || "plain";
  g.variants.set(extra, (g.variants.get(extra) ?? 0) + e.count);
  grouped.set(key, g);
}
const textStyles = [...grouped.values()]
  .map((g) => ({
    id: "text-" + createHash("sha1").update(`${g.px} ${g.weight}`).digest("hex").slice(0, 8),
    px: g.px,
    // How the code writes this size, most used first: "text-sm", "text-[14px]".
    spellings: [...g.spellings.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s),
    weight: g.weight,
    count: g.count,
    files: g.files.size,
    sample: g.sample,
    variants: [...g.variants.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([extra, count]) => ({ extra, count })),
    variantCount: g.variants.size,
  }))
  .sort((a, b) => a.px - b.px || WEIGHT_ORDER.indexOf(a.weight) - WEIGHT_ORDER.indexOf(b.weight));

const KIND_ORDER: Kind[] = ["button", "card", "header", "modal", "empty", "table", "field", "badge"];
const kinds = KIND_ORDER.map((kind) => {
  const list = familyList.filter((f) => f.kind === kind);
  return { kind, uses: list.reduce((n, f) => n + f.count, 0), families: list.length, versions: list.reduce((n, f) => n + f.versions.length, 0) };
});

writeFileSync(
  OUT,
  JSON.stringify(
    {
      scannedAt: new Date().toISOString(),
      files: walk(join(ROOT, "src")).length,
      kinds,
      families: familyList,
      textStyles,
    },
  ) + "\n",
);

console.log(`Wrote ${relative(ROOT, OUT)}`);
for (const k of kinds) console.log(`  ${k.kind}: ${k.families} families, ${k.versions} versions, ${k.uses} uses`);
console.log(`  text styles: ${textStyles.length}`);
