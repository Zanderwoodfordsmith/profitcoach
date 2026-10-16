# BOSS print pack

Brand graphics (BOSS Compass, BOSS Wheel, 50 playbooks, roadmaps, social posts, banners) drawn as SVG
from the app's own data, so questions, areas, playbooks and colours always match the product.

The drawing code lives in `src/lib/printPack/` and is shared by two places:

- **Coach Toolkit** (Get Clients > Toolkit, `src/components/toolkit/ToolkitHub.tsx`): draws each coach's
  set live in the browser with their name, photo and QR to `/score/{slug}`, with PNG, PDF and SVG downloads.
- **This script**: builds the masters for Drive (`Profit Coach / 0. Brand / BOSS Print Pack`).

`src/lib/printPack/catalog.js` is the one list of graphics. Add a graphic there and it appears in both.

## Build the Drive masters

```bash
node --no-warnings --import ./scripts/print-pack/ts-resolve.mjs scripts/print-pack/build.mjs <outDir> [coach.json]
node scripts/print-pack/render.mjs <outDir> --pdf   # adds .png and .pdf next to each .svg
```

The output folders match Drive exactly (1. Scorecard ... 6. <Name>'s set), so the result can be copied straight in.
`coach.json`: `{ "name": "...", "firstName": "...", "business": "...", "slug": "...", "avatarUrl": "https://..." }`

## When the logo or icons change

`node scripts/print-pack/codegen.mjs` rewrites `src/lib/printPack/generated.js` (logo markup and Lucide icon shapes).

Text in the SVGs stays live in Inter Tight / Inter (free Google fonts). Printers usually want 3 to 5 mm bleed.
