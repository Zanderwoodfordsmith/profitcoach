# Academy lesson house style

This is the single reference for how a Classroom / Programs lesson body should be
formatted. It is derived from `Old Academy Template Docs.md` (Zac's hand-formatted
examples) and is the target style for:

1. Reformatting existing lessons whose stored markdown is messy (jammed `****bold****`,
   collapsed headings, flattened tables).
2. Importing missing lesson text from the `Old Academy Text Content` docs.

Lesson bodies are stored as markdown in `academy_lesson_content.body_markdown` and
rendered with react-markdown + remark-gfm (see
`src/components/academy/AcademyMarkdown.tsx`). Anything valid GFM renders; the prose
styling lives in `src/components/academy/academyProseClassName.ts`.

---

## Golden rules

- **Do not include the lesson title** as an `#` H1 in the body. The title is stored
  separately (it comes from `legacy-hub.json`). Bodies start at the first section.
- **One blank line** between every block (heading, paragraph, list, table, quote).
- **Bold** is `**text**` with no inner padding and no `****` runs. Never leave a
  dangling `**`.
- **Bold lead-in labels** read `**Label:** description` (colon inside or after the
  bold is fine, be consistent within a list).
- **Headings never run into body text.** `### **What Is This?**` is its own line; the
  paragraph follows after a blank line.
- Use `---` (horizontal rule) only to separate major top-level sections, not between
  every heading.
- Preserve real links as `[text](url)`. Drop orphaned image refs that have no URL
  (e.g. `![][image1]`, `![](…youtube__icon.svg)`); keep images that have a real URL.
- Keep British spelling already present in the copy; don't rewrite the author's voice.
  This is a reformat, not a rewrite of the content.

## Heading levels

- `##` — a major section heading (sparingly).
- `###` — the normal section heading for a guide lesson, wrapped in bold:
  `### **What Is This?**`.
- `####` — sub-sections and the emoji blocks (see below).

Do not promote body emphasis to H1. If the source has faux-headings like
`# You Are Not Limited In Anyway...` mid-lesson, demote them to a `###`/`####` or
bold paragraph as appropriate.

---

## Archetype A — written guide lesson

Used for "how to" / explainer lessons (business structure, pricing, choosing a core
client, etc.). Typical skeleton:

```markdown
### **What Is This?**

One or two sentences describing the lesson.

### **Why Is This Important?**

Doing this will help you:

* **Benefit label:** why it matters.
* **Benefit label:** why it matters.

### **How To Do It**

1. **Step name:**
   * Sub-point.
   * Sub-point.
2. **Step name:**
   * Sub-point.

---

### **Summary**

Closing paragraph that recaps the takeaway.
```

Notes:
- Lead a benefit/why list with a stem sentence ending in a colon, then the bullets.
- Numbered steps use `1.`, `2.` with two-space-indented `*` sub-bullets.
- Comparison content goes in a GFM table (see Tables below), not prose runs.

## Archetype B — video lesson (summary + points)

Used for recorded-session lessons (PRO Energy, PRO Focus, Foreword to Day Zero, etc.).
Optional `### **Resources**` block first, then the four emoji sections in this order:

```markdown
### **Resources**

* [Resource name](https://example.com)
* [Resource name](https://example.com)

#### **📚 Summary:**

Paragraph summarising the video.

#### **🤓 Learning Points:**

1. First point.
2. Second point.

#### **✅ Actions & Application:**

1. First action.
2. Second action.

#### **⏰ Time-Stamps:**

00:00 Introduction
01:20 First topic
03:15 Second topic
```

Notes:
- Keep the exact emoji + label convention: `📚 Summary`, `🤓 Learning Points`
  (a.k.a. "Key Learning Points"), `✅ Actions & Application` (a.k.a. "Actions and
  Behaviors"), `⏰ Time-Stamps`. Use whichever label the source used; don't invent new
  ones.
- Time-stamps are one per line as `MM:SS Description` (or `HH:MM:SS`). Strip the
  `\-` escaping seen in Google Docs exports so they read `01:20 Topic`, not
  `01:20 \- Topic`.

---

## Tables

Use GFM pipe tables with a header separator row. This is the correct fix for content
that arrived as a flattened run of lines (header cells and values on consecutive lines
with no pipes).

```markdown
| Aspect | Sole Trader | Limited Company |
| ----- | ----- | ----- |
| **Definition** | Individual running a business alone. | A separate legal entity. |
| **Liability** | Personally liable for debts. | Personal assets protected. |
```

- Bold the first column / row labels when they are labels.
- A blank line before and after the table.

## Lists

- Bullets use `*`; ordered lists use `1.`. One space after the marker.
- Nested items indent two spaces under the parent.
- Put a blank line before a list and after it.

## Quotes and scripts

Use blockquotes for pull-quotes and sales/coaching scripts:

```markdown
> "Thanks for asking — our top clients invest up to £50,000 a year, but you can start
> for under £1,000/mo. Which day works best for a quick call?"
> — Author
```

## Things to strip / repair (Google Docs + Turndown artefacts)

- `****bold****` and longer runs → `**bold**`.
- Bold spans jammed into text (`Different****This isn't****Most...`) → split onto their
  own lines/paragraphs.
- Escaped punctuation from Google Docs (`\!`, `\-`, `\#`, `\>`) → unescape.
- Headings stuck to bold (`###**Title**`) → `### **Title**`.
- Collapsed blocks with no blank lines → insert blank lines at block boundaries.
- Orphan image references with no resolvable URL → remove.

Most of these are handled automatically by
`src/lib/academy/normalizeLessonMarkdown.ts`; run it as the first pass, then hand-fix
tables and structure to match the archetypes above.
