/**
 * Bold, italic, struck-through and linked words inside a block's text, kept as
 * light Markdown: **bold**, _italic_, ~~struck~~, [words](https://link). The
 * newsletter editor writes them; the Blueprint shows them.
 */
export type InlineSpan = { text: string; bold?: boolean; italic?: boolean; strike?: boolean; href?: string };

type Marks = Omit<InlineSpan, "text">;

const LINK = /^\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/;
const WORD = /[A-Za-z0-9]/;

function parse(text: string, marks: Marks, out: InlineSpan[]) {
  let buf = "";
  const flush = () => {
    if (buf) out.push({ text: buf, ...marks });
    buf = "";
  };
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    if (rest.startsWith("**")) {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        parse(text.slice(i + 2, end), { ...marks, bold: true }, out);
        i = end + 2;
        continue;
      }
    }
    if (rest.startsWith("~~")) {
      const end = text.indexOf("~~", i + 2);
      if (end > i + 2) {
        flush();
        parse(text.slice(i + 2, end), { ...marks, strike: true }, out);
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "_" && !WORD.test(text[i - 1] ?? "")) {
      let end = text.indexOf("_", i + 1);
      while (end > -1 && WORD.test(text[end + 1] ?? "")) end = text.indexOf("_", end + 1);
      if (end > i + 1) {
        flush();
        parse(text.slice(i + 1, end), { ...marks, italic: true }, out);
        i = end + 1;
        continue;
      }
    }
    if (text[i] === "[") {
      const m = LINK.exec(rest);
      if (m) {
        flush();
        parse(m[1]!, { ...marks, href: m[2]! }, out);
        i += m[0].length;
        continue;
      }
    }
    buf += text[i];
    i += 1;
  }
  flush();
}

export function parseInline(text: string): InlineSpan[] {
  const out: InlineSpan[] = [];
  parse(text, {}, out);
  return out;
}

type Open = { kind: "href"; href: string } | { kind: "bold" | "italic" | "strike" };

function marksOf(span: Marks): Open[] {
  const list: Open[] = [];
  if (span.href) list.push({ kind: "href", href: span.href });
  if (span.bold) list.push({ kind: "bold" });
  if (span.italic) list.push({ kind: "italic" });
  if (span.strike) list.push({ kind: "strike" });
  return list;
}

function same(a: Open, b: Open) {
  return a.kind === b.kind && (a.kind !== "href" || (b.kind === "href" && a.href === b.href));
}

function delim(mark: Open, opening: boolean): string {
  if (mark.kind === "bold") return "**";
  if (mark.kind === "italic") return "_";
  if (mark.kind === "strike") return "~~";
  return opening ? "[" : `](${mark.kind === "href" ? mark.href : ""})`;
}

/** Spans back to text. Marks shared by neighbouring spans stay open across them. */
export function serializeInline(spans: InlineSpan[]): string {
  let out = "";
  let open: Open[] = [];
  for (const span of spans) {
    const next = marksOf(span);
    let keep = 0;
    while (keep < open.length && keep < next.length && same(open[keep]!, next[keep]!)) keep += 1;
    for (let i = open.length - 1; i >= keep; i--) out += delim(open[i]!, false);
    for (let i = keep; i < next.length; i++) out += delim(next[i]!, true);
    open = next;
    out += span.text;
  }
  for (let i = open.length - 1; i >= 0; i--) out += delim(open[i]!, false);
  return out;
}
