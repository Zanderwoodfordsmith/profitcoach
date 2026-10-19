"""Convert a Google Docs API JSON dump (documents.get with tabs) into one markdown file per tab.

Usage: python3 -I gdoc_to_md.py <dump.json> <out_dir>
Writes <out_dir>/<NN>-<slug>.md and prints the tab tree.
"""
import json
import os
import re
import sys

HEADING = {"TITLE": 1, "HEADING_1": 1, "HEADING_2": 2, "HEADING_3": 3, "HEADING_4": 4, "HEADING_5": 5, "HEADING_6": 6}


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


IMAGES = {}  # objectId -> (contentUri, local path); filled per tab
IMG_PREFIX = [""]


def run_text(run):
    io_el = run.get("inlineObjectElement")
    if io_el:
        oid = io_el.get("inlineObjectId")
        if oid in IMAGES:
            uri, local, height = IMAGES[oid]
            ORDER.append(oid)
            if height <= 6:
                return "\n\n---\n\n"
            return f"\n\n![]({local})\n\n"
        return ""
    tr = run.get("textRun")
    if not tr:
        return ""
    raw = tr.get("content", "")
    text = raw.replace("\n", "").replace("\u000b", " ")
    if not text.strip():
        return text
    style = tr.get("textStyle", {})
    lead = text[: len(text) - len(text.lstrip())]
    trail = text[len(text.rstrip()):]
    core = text.strip()
    if style.get("bold"):
        core = f"**{core}**"
    if style.get("italic"):
        core = f"*{core}*"
    link = style.get("link", {}).get("url")
    if link:
        core = f"[{core}]({link})"
    return lead + core + trail


def para_text(p):
    out = "".join(run_text(r) for r in p.get("elements", []))
    # Merge adjacent bold runs: "**a****b**" -> "**ab**"
    out = out.replace("****", "")
    return out.rstrip()


def convert_body(content, lists):
    lines = []
    for el in content:
        if "paragraph" in el:
            p = el["paragraph"]
            text = para_text(p)
            style = p.get("paragraphStyle", {}).get("namedStyleType", "NORMAL_TEXT")
            if not text.strip():
                lines.append("")
                continue
            if style in HEADING:
                plain = re.sub(r"\*\*(.+?)\*\*", r"\1", text).strip()
                lines.append("")
                lines.append("#" * HEADING[style] + " " + plain)
                lines.append("")
            elif "bullet" in p:
                b = p["bullet"]
                level = b.get("nestingLevel", 0)
                lst = lists.get(b.get("listId"), {})
                glyph = (
                    lst.get("listProperties", {}).get("nestingLevels", [{}])[min(level, 8)].get("glyphType", "")
                    if lst
                    else ""
                )
                marker = "1." if glyph in ("DECIMAL", "ALPHA", "UPPER_ALPHA", "ROMAN", "UPPER_ROMAN") else "-"
                lines.append("  " * level + f"{marker} {text.strip()}")
            else:
                lines.append(text)
                lines.append("")
        elif "table" in el:
            rows = el["table"].get("tableRows", [])
            md_rows = []
            for row in rows:
                cells = []
                for cell in row.get("tableCells", []):
                    parts = [para_text(c["paragraph"]).strip() for c in cell.get("content", []) if "paragraph" in c]
                    cells.append("<br>".join(x for x in parts if x).replace("|", "\\|"))
                md_rows.append(cells)
            if md_rows:
                width = max(len(r) for r in md_rows)
                lines.append("")
                for i, r in enumerate(md_rows):
                    r = r + [""] * (width - len(r))
                    lines.append("| " + " | ".join(r) + " |")
                    if i == 0:
                        lines.append("|" + "---|" * width)
                lines.append("")
    # The source types bullets as plain "- " paragraphs; keep consecutive items in one tight list.
    is_item = re.compile(r"^\s*(-|\d+\.)\s")
    tight = []
    for i, line in enumerate(lines):
        if line == "" and tight and is_item.match(tight[-1]):
            nxt = next((l for l in lines[i + 1:] if l != ""), "")
            if is_item.match(nxt):
                continue
        tight.append(line)
    md = "\n".join(tight)
    md = re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"
    return md


ALL_IMAGES = []
ORDER = []


def main():
    src, out_dir = sys.argv[1], sys.argv[2]
    IMG_PREFIX[0] = sys.argv[3] if len(sys.argv) > 3 else "/resources/img"
    os.makedirs(out_dir, exist_ok=True)
    doc = json.load(open(src))["content"]
    counter = [0]

    def walk(tabs, depth, parent):
        for tab in tabs:
            props = tab["tabProperties"]
            dt = tab.get("documentTab", {})
            IMAGES.clear()
            for oid, obj in dt.get("inlineObjects", {}).items():
                emb = obj.get("inlineObjectProperties", {}).get("embeddedObject", {})
                uri = emb.get("imageProperties", {}).get("contentUri")
                height = emb.get("size", {}).get("height", {}).get("magnitude", 100)
                local = f"{IMG_PREFIX[0]}/{slug(props['title'])[:40]}-{oid.replace('.', '-')}.png"
                IMAGES[oid] = (uri, local, height)
                ALL_IMAGES.append({"oid": oid, "uri": uri, "path": local, "height": height})
            md = convert_body(dt.get("body", {}).get("content", []), dt.get("lists", {}))
            counter[0] += 1
            name = f"{counter[0]:02d}-{slug(props['title'])}.md"
            with open(os.path.join(out_dir, name), "w") as f:
                f.write(md)
            print("  " * depth + f"- {props['title']} [{props['tabId']}] -> {name} ({len(md)} chars)")
            walk(tab.get("childTabs", []), depth + 1, props["title"])

    walk(doc["tabs"], 0, None)
    with open(os.path.join(out_dir, "images.json"), "w") as f:
        json.dump({"images": ALL_IMAGES, "order": ORDER}, f, indent=1)
    print(f"{len(ALL_IMAGES)} images listed in images.json")


main()
