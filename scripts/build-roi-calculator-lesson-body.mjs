#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const html = fs
  .readFileSync(
    path.join(process.cwd(), "content/academy/embeds/funnel-multiplier-roi-calculator.html"),
    "utf8"
  )
  .trim();

const md = `### What is this?

The **Funnel Multiplier** shows prospects the mathematical ROI of coaching — using their revenue numbers, not theory.

Five levers drive annual revenue: leads, conversion to appointments, close rate, average deal value, and transactions per customer. Improve each lever by the same percentage and they **compound**. A 10% lift on all five is \`1.1^5 = 1.61\` — a **61% revenue increase**.

Use this in value sessions and sales conversations when someone asks whether coaching is worth the investment.

### How to use this lesson

1. Ask for rough numbers (or use their BOSS diagnostic if they have taken it).
2. Slide the levers to match their business.
3. Show the annual uplift, then compare to your coaching fee — the maths does the selling.

\`\`\`html-embed
${html}
\`\`\`

### Coaching fee comparison

Even a modest uplift often shows **10:1+ ROI in year one** against a typical Profit Coach fee. Pair this with the [Revenue Growth Accelerator](https://docs.google.com/spreadsheets/d/1UUunc5A2WOtgJsKTlZwQ_r6H6gS_DlBs/edit?usp=sharing&ouid=101316149261577060760&rtpof=true&sd=true) once they are a client — that tool tracks progress and justifies ongoing engagement.
`;

const out = path.join(
  process.cwd(),
  "content/academy/reformatted/coach-clients__coach-clients-certification-welcome-to-the-profit-coach-certification-profit-coacbh-roi-calculator.md"
);
fs.writeFileSync(out, md);
console.log(`Wrote ${out} (${md.length} chars)`);
