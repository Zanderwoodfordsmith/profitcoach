"""Convert a Drive download_file_content dump (base64 .docx) into markdown.

Usage: python3 -I docx_to_md.py <dump.json> <out.md>
Presenter scripts are tables with a slide picture in one cell and notes in the other;
those rows become "Slide N" sections. Pictures are dropped (the deck is embedded on the page).
"""
import base64
import io
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def run_text(r):
    parts = []
    for node in r:
        if node.tag == W + "t":
            parts.append(node.text or "")
        elif node.tag in (W + "br", W + "cr"):
            parts.append("\n")
        elif node.tag == W + "tab":
            parts.append(" ")
    text = "".join(parts)
    rpr = r.find(W + "rPr")
    bold = rpr is not None and rpr.find(W + "b") is not None and rpr.find(W + "b").get(W + "val") not in ("0", "false")
    return text, bold


def para(p):
    out = []
    for r in p.iter(W + "r"):
        text, bold = run_text(r)
        if not text:
            continue
        if bold and text.strip():
            lead = text[: len(text) - len(text.lstrip())]
            trail = text[len(text.rstrip()):]
            text = f"{lead}**{text.strip()}**{trail}"
        out.append(text)
    s = "".join(out).replace("****", "")
    ppr = p.find(W + "pPr")
    style = ""
    is_list = False
    if ppr is not None:
        st = ppr.find(W + "pStyle")
        style = st.get(W + "val") if st is not None else ""
        is_list = ppr.find(W + "numPr") is not None
    return s.strip(), style, is_list


def has_picture(el):
    return any(True for _ in el.iter(W + "drawing")) or any(True for _ in el.iter("{urn:schemas-microsoft-com:vml}imagedata"))


def block_lines(el):
    """Lines for a sequence of paragraphs (body or a table cell)."""
    lines = []
    for p in el.findall(W + "p"):
        text, style, is_list = para(p)
        if not text:
            continue
        m = re.match(r"Heading(\d)", style or "")
        if m or style == "Title":
            level = 2 if style == "Title" else min(4, int(m.group(1)) + 1)
            lines += ["", "#" * level + " " + text.replace("**", ""), ""]
        elif is_list or re.match(r"^[•●▪◦-]\s", text):
            lines.append("- " + re.sub(r"^[•●▪◦-]\s*", "", text))
        else:
            lines += [text, ""]
    return lines


def convert(doc_xml):
    root = ET.fromstring(doc_xml)
    body = root.find(W + "body")
    lines = []
    slide = 0
    for el in body:
        if el.tag == W + "p":
            text, style, is_list = para(el)
            if not text:
                continue
            m = re.match(r"Heading(\d)", style or "")
            if m or style == "Title":
                level = 2 if style == "Title" else min(4, int(m.group(1)) + 1)
                lines += ["", "#" * level + " " + text.replace("**", ""), ""]
            elif is_list or re.match(r"^[•●▪◦-]\s", text):
                lines.append("- " + re.sub(r"^[•●▪◦-]\s*", "", text))
            else:
                lines += [text, ""]
        elif el.tag == W + "tbl":
            for row in el.findall(W + "tr"):
                cells = row.findall(W + "tc")
                pictured = any(has_picture(c) for c in cells)
                texts = [block_lines(c) for c in cells]
                texts = [t for t in texts if any(x.strip() for x in t)]
                if not texts:
                    continue
                if pictured:
                    slide += 1
                    lines += ["", f"### Slide {slide}", ""]
                    for t in texts:
                        lines += t
                elif len(texts) == 2 and sum(len(x) for x in texts[0]) < 120:
                    # Label | value rows, e.g. "Handouts Required | Neats Worksheet"
                    label = " ".join(x for x in texts[0] if x.strip()).replace("**", "")
                    value = " ".join(x for x in texts[1] if x.strip())
                    lines += [f"**{label}:** {value}", ""]
                else:
                    for t in texts:
                        lines += t
    md = "\n".join(lines)
    md = re.sub(r"\n{3,}", "\n\n", md)
    # Keep list items together.
    md = re.sub(r"(\n- [^\n]*)\n\n(?=- )", r"\1\n", md)
    md = re.sub(r"(\n- [^\n]*)\n\n(?=- )", r"\1\n", md)
    return md.strip() + "\n", slide


def main():
    src, out = sys.argv[1], sys.argv[2]
    raw = json.load(open(src))
    data = base64.b64decode(raw["content"])
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        md, slides = convert(z.read("word/document.xml"))
    with open(out, "w") as f:
        f.write(md)
    print(f"{raw.get('title')} -> {out} ({len(md)} chars, {slides} slide rows)")


main()
