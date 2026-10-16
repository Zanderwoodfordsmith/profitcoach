// Lucide icons as plain SVG. Shapes are baked into generated.js from the same lucide-react
// package the app uses, so print graphics carry the exact icons from src/components/profitSystem.
import { n2 } from "./brand.js";
import { ICON_NODES } from "./generated.js";

/** Draw a 24-unit Lucide icon at x,y scaled to `size`. */
export function icon(name, x, y, size, color, strokeWidth = 2) {
  const nodes = ICON_NODES[name];
  if (!nodes) throw new Error(`Icon not in generated.js: ${name} (add it to scripts/print-pack/codegen.mjs)`);
  const inner = nodes
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
  return `<g transform="translate(${n2(x)} ${n2(y)}) scale(${n2(size / 24)})" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
}

/** Area id -> icon, matching AREA_ICONS + FOUNDATION in src/components/profitSystem/profitSystemData.ts. */
export const AREA_ICON = {
  0: "activity",
  1: "compass",
  2: "target",
  3: "calendar-check-2",
  4: "banknote",
  5: "megaphone",
  6: "cog",
  7: "bar-chart-3",
  8: "network",
  9: "users",
};
