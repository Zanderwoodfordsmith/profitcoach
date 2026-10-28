import { extendTailwindMerge } from "tailwind-merge";

/**
 * Joins class strings so later ones win: the extra classes a page passes to
 * buttonClass, cardClass, fieldClass or badgeClass override the shared look
 * (a width, an error border) instead of losing to it. Knows our eight text
 * sizes (globals.css) so `text-ui` counts as a size, not a colour.
 */
const merge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["kicker", "caption", "ui", "read", "subhead", "title", "heading", "display"],
    },
  },
});

export function cx(...parts: (string | false | null | undefined)[]) {
  return merge(parts.filter(Boolean).join(" "));
}
