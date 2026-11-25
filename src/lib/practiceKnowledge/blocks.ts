import type { BlueprintBlock, BuiltSection, NewsletterPublish } from "./types";

/**
 * Blueprint blocks: the typed pieces a written section is made of.
 * Shared by the page (rendering), the build route (sanitising model output),
 * and the Markdown export, so all three always agree.
 */

const TEXT = 4000;
const SHORT = 400;
const ITEMS = 24;
const ROWS = 30;
// A newsletter edited in place is one block per paragraph, so it needs more than a written section.
const BLOCKS = 80;

function clip(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/—/g, "-")
    .trim()
    .slice(0, max);
}

function list(value: unknown, max = SHORT): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => clip(v, max)).filter(Boolean).slice(0, ITEMS);
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function objects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(rec).slice(0, ITEMS) : [];
}

/** Keeps only well-formed blocks. Unknown types and empty blocks are dropped. */
export function sanitizeBlocks(raw: unknown): BlueprintBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: BlueprintBlock[] = [];
  for (const item of raw.slice(0, BLOCKS)) {
    const b = rec(item);
    switch (b.type) {
      case "lede":
      case "paragraph":
      case "heading": {
        const text = clip(b.text, b.type === "heading" ? SHORT : TEXT);
        if (!text) break;
        if (b.type === "heading" && b.level === 3) out.push({ type: "heading", text, level: 3 });
        else out.push({ type: b.type, text });
        break;
      }
      case "bullets":
      case "numbered": {
        const items = list(b.items, 1200);
        if (items.length) out.push({ type: b.type, items });
        break;
      }
      case "quote": {
        const text = clip(b.text, TEXT);
        const cite = clip(b.cite, SHORT);
        if (text) out.push(cite ? { type: "quote", text, cite } : { type: "quote", text });
        break;
      }
      case "stats": {
        const items = objects(b.items)
          .map((i) => ({ value: clip(i.value, 60), label: clip(i.label, 160) }))
          .filter((i) => i.value && i.label)
          .slice(0, 6);
        if (items.length) out.push({ type: "stats", items });
        break;
      }
      case "pairs": {
        const items = objects(b.items)
          .map((i) => ({ label: clip(i.label, 120), value: clip(i.value, 1600) }))
          .filter((i) => i.label && i.value);
        if (items.length) out.push({ type: "pairs", items });
        break;
      }
      case "table": {
        const columns = list(b.columns, 80).slice(0, 6);
        const rows = (Array.isArray(b.rows) ? b.rows : [])
          .slice(0, ROWS)
          .map((row) => list(row, 900).slice(0, columns.length))
          .filter((row) => row.some(Boolean))
          .map((row) => [...row, ...Array(Math.max(0, columns.length - row.length)).fill("")]);
        if (columns.length && rows.length) out.push({ type: "table", columns, rows });
        break;
      }
      case "message": {
        const label = clip(b.label, 120);
        const body = clip(b.body, TEXT);
        const note = clip(b.note, 600);
        if (body) out.push(note ? { type: "message", label, body, note } : { type: "message", label, body });
        break;
      }
      case "callout": {
        const tone = b.tone === "warning" || b.tone === "note" ? b.tone : "tip";
        const text = clip(b.text, TEXT);
        const title = clip(b.title, 160);
        if (text) out.push(title ? { type: "callout", tone, title, text } : { type: "callout", tone, text });
        break;
      }
      case "steps": {
        const items = objects(b.items)
          .map((i) => ({ title: clip(i.title, 200), detail: clip(i.detail, 1600) }))
          .filter((i) => i.title);
        if (items.length) out.push({ type: "steps", items });
        break;
      }
      case "timeline": {
        const items = objects(b.items)
          .map((i) => {
            const detail = clip(i.detail, 1000);
            const base = { when: clip(i.when, 60), title: clip(i.title, 200) };
            return detail ? { ...base, detail } : base;
          })
          .filter((i) => i.when && i.title);
        if (items.length) out.push({ type: "timeline", items });
        break;
      }
      case "image": {
        const url = clip(b.url, 1000);
        if (!/^https:\/\/\S+$/.test(url)) break;
        const alt = clip(b.alt, SHORT);
        const href = clip(b.href, 1000);
        out.push({
          type: "image",
          url,
          ...(alt ? { alt } : {}),
          ...(b.cover === true ? { cover: true } : {}),
          ...(/^https?:\/\/\S+$/.test(href) ? { href } : {}),
        });
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/** A newsletter issue's status on LinkedIn, or null for a draft. */
export function sanitizePublish(raw: unknown): NewsletterPublish | null {
  const p = rec(raw);
  if (p.status !== "scheduled" && p.status !== "published") return null;
  const at = typeof p.at === "string" && !Number.isNaN(Date.parse(p.at)) ? new Date(p.at).toISOString() : null;
  return { status: p.status, at };
}

export function sanitizeBuiltSections(raw: unknown): Record<string, BuiltSection> {
  const out: Record<string, BuiltSection> = {};
  for (const [key, value] of Object.entries(rec(raw)).slice(0, 80)) {
    const v = rec(value);
    const blocks = sanitizeBlocks(v.blocks);
    if (!/^[a-z-]+:[a-z0-9-]+$/.test(key) || !blocks.length) continue;
    const prev = rec(v.previous);
    const prevBlocks = sanitizeBlocks(prev.blocks);
    out[key] = {
      blocks,
      generated_at: clip(v.generated_at, 40),
      model: clip(v.model, 80),
      edited_at: v.edited_at ? clip(v.edited_at, 40) : null,
      ...(sanitizePublish(v.publish) ? { publish: sanitizePublish(v.publish) } : {}),
      ...(typeof v.position === "number" && Number.isFinite(v.position) ? { position: Math.max(0, Math.round(v.position)) } : {}),
      ...(prevBlocks.length && prev.replaced_at
        ? {
            previous: {
              blocks: prevBlocks,
              generated_at: clip(prev.generated_at, 40),
              model: clip(prev.model, 80),
              edited_at: prev.edited_at ? clip(prev.edited_at, 40) : null,
              replaced_at: clip(prev.replaced_at, 40),
            },
          }
        : {}),
    };
  }
  return out;
}

/**
 * True when a person changed the text after it was last written. Ava's own
 * saves stamp edited_at too, so those don't count (job 233): one is the save
 * that made `previous`, or Ava's first draft of an empty section.
 */
export function editedByHand(section: BuiltSection | null | undefined): boolean {
  if (!section?.edited_at) return false;
  if (section.previous && section.edited_at === section.previous.replaced_at) return false;
  return !(section.model === "ava" && section.edited_at === section.generated_at);
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n+/g, " ");
}

/** Markdown for one list of blocks. Headings start at the given level. */
export function blocksToMarkdown(blocks: BlueprintBlock[], headingLevel = 4): string {
  const h = "#".repeat(Math.min(6, headingLevel));
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "lede":
      case "paragraph":
        parts.push(b.text);
        break;
      case "heading":
        parts.push(`${b.level === 3 ? `${h}#` : h} ${b.text}`);
        break;
      case "bullets":
        parts.push(b.items.map((i) => `- ${i}`).join("\n"));
        break;
      case "numbered":
        parts.push(b.items.map((i, n) => `${n + 1}. ${i}`).join("\n"));
        break;
      case "quote":
        parts.push(`> ${b.text.replace(/\n/g, "\n> ")}${b.cite ? `\n>\n> ${b.cite}` : ""}`);
        break;
      case "stats":
        parts.push(b.items.map((i) => `- **${i.value}** ${i.label}`).join("\n"));
        break;
      case "pairs":
        parts.push(b.items.map((i) => `- **${i.label}:** ${i.value}`).join("\n"));
        break;
      case "table":
        parts.push(
          [
            `| ${b.columns.map(escapeCell).join(" | ")} |`,
            `| ${b.columns.map(() => "---").join(" | ")} |`,
            ...b.rows.map((r) => `| ${r.map(escapeCell).join(" | ")} |`),
          ].join("\n")
        );
        break;
      case "message":
        parts.push(
          `${b.label ? `**${b.label}**\n\n` : ""}\`\`\`text\n${b.body}\n\`\`\`${b.note ? `\n\n_${b.note}_` : ""}`
        );
        break;
      case "callout":
        parts.push(`> **${b.title || (b.tone === "warning" ? "Watch out" : b.tone === "note" ? "Note" : "Tip")}:** ${b.text}`);
        break;
      case "steps":
        parts.push(b.items.map((i, n) => `${n + 1}. **${i.title}.** ${i.detail}`).join("\n"));
        break;
      case "timeline":
        parts.push(b.items.map((i) => `- **${i.when}:** ${i.title}${i.detail ? `. ${i.detail}` : ""}`).join("\n"));
        break;
      case "image":
        parts.push(b.href ? `[![${b.alt ?? ""}](${b.url})](${b.href})` : `![${b.alt ?? ""}](${b.url})`);
        break;
    }
  }
  return parts.join("\n\n");
}

/** Plain lines, for cards that show a short preview of a section. */
export function blocksPreview(blocks: BlueprintBlock[], max = 3): string[] {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.type === "lede" || b.type === "paragraph") lines.push(b.text);
    else if (b.type === "bullets" || b.type === "numbered") lines.push(...b.items);
    if (lines.length >= max) break;
  }
  return lines.slice(0, max);
}

/** The JSON shape every build skill must return. Pasted into the system prompt. */
export const BLOCKS_SCHEMA_PROMPT = `Return ONLY one JSON object: { "blocks": [ ... ] }

Each block is one of:
{ "type": "lede", "text": "one or two sentences that open the section" }
{ "type": "paragraph", "text": "..." }
{ "type": "heading", "text": "short sub-heading" }
{ "type": "bullets", "items": ["..."] }
{ "type": "numbered", "items": ["..."] }
{ "type": "quote", "text": "...", "cite": "who said it (optional)" }
{ "type": "stats", "items": [{ "value": "£1.2M", "label": "what the number is" }] }   (2 to 4 items, numbers only when they are real)
{ "type": "pairs", "items": [{ "label": "...", "value": "..." }] }
{ "type": "table", "columns": ["...", "..."], "rows": [["...", "..."]] }
{ "type": "message", "label": "Connection request", "body": "the exact message to send", "note": "when or why to use it (optional)" }
{ "type": "callout", "tone": "tip" | "warning" | "note", "title": "optional", "text": "..." }
{ "type": "steps", "items": [{ "title": "...", "detail": "..." }] }
{ "type": "timeline", "items": [{ "when": "Week 1", "title": "...", "detail": "optional" }] }

Use "message" for anything the coach will copy and send. Keep {first_name} style tokens exactly as written.`;
