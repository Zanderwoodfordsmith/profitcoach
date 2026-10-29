# LinkedIn banners

`node scripts/linkedin-banners/render.mjs <outDir> [namePrefix]` renders the drafts at 1584 × 396 (2x). `bank/` holds the versions Zander picked on 29 Oct 2026, the examples the banner skill builds from. The Blueprint's banner chooser (`src/lib/printPack/catalog.js`, `p-li-*`) still uses the older SVG banners.

## What works

- One line any owner nods at, plus a picture that makes the same point. Lines come from the copywriting method (`content/ai-knowledge/copywriting-method.md`, "Short lines any owner nods at").
- Two-weight headline: light grey line, then a bold line with one coloured word.
- Pictures: the BOSS wheel with the weakest wedge lit up as "Your constraint", and three white step cards (the offer's phases: Get clear, Fix what matters, Make it last).
- The constraint is red on light. On dark, red and orange both work.
- Button "Get your BOSS Score" with "Free. Takes 3 minutes." in grey beside it.
- Dark versions stand out more on LinkedIn's light page.

## Rules

- Copy starts at x 500; keep the bottom-left empty (the profile photo covers it).
- No coach photo, name or credentials: the profile shows them right below.
- Readable on a phone: the headline is all most people will read.
- No "firm". No line that only fits one problem (e.g. margin) on a banner every owner sees.
