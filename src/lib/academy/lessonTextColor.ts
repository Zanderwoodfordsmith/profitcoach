/** Preset text colours for the lesson editor (matches common brand / semantic use). */
export const LESSON_TEXT_COLORS = [
  { label: "Default", value: "#475569" },
  { label: "Sky", value: "#0284c7" },
  { label: "Emerald", value: "#059669" },
  { label: "Amber", value: "#d97706" },
  { label: "Rose", value: "#e11d48" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Slate", value: "#334155" },
] as const;

/** Read inline text colour from a SPAN or legacy FONT element. */
export function readElementTextColor(el: HTMLElement): string | null {
  if (el.nodeName === "FONT") {
    const c = el.getAttribute("color")?.trim();
    if (c) return c;
  }
  const style = el.getAttribute("style") ?? "";
  const match = style.match(/(?:^|;\s*)color:\s*([^;]+)/i);
  return match?.[1]?.trim() ?? null;
}

/** Serialize coloured inline text as HTML embedded in lesson markdown. */
export function coloredTextHtml(content: string, color: string): string {
  const safe = color.trim().replace(/"/g, "");
  return `<span style="color:${safe}">${content}</span>`;
}
