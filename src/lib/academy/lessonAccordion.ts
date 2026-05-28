/** Preset accordion panel colours (background + border). */
export const LESSON_ACCORDION_COLORS = [
  { id: "neutral", label: "Neutral", background: "#f8fafc", border: "#e2e8f0" },
  { id: "sky", label: "Sky", background: "#e0f2fe", border: "#7dd3fc" },
  { id: "emerald", label: "Emerald", background: "#d1fae5", border: "#6ee7b7" },
  { id: "amber", label: "Amber", background: "#fef3c7", border: "#fcd34d" },
  { id: "rose", label: "Rose", background: "#ffe4e6", border: "#fda4af" },
  { id: "violet", label: "Violet", background: "#ede9fe", border: "#c4b5fd" },
] as const;

export type LessonAccordionColorId = (typeof LESSON_ACCORDION_COLORS)[number]["id"];

export const LESSON_ACCORDION_CLASS = "lesson-accordion";

export function accordionColorById(id: string) {
  return LESSON_ACCORDION_COLORS.find((c) => c.id === id);
}

/** Read preset id or "custom" when inline background is set without a known preset. */
export function readAccordionColorId(el: HTMLDetailsElement): string | null {
  const preset = el.getAttribute("data-accordion-color")?.trim();
  if (preset) return preset;
  const bg = el.style.backgroundColor?.trim();
  if (bg) return "custom";
  return null;
}

export function readAccordionInlineColors(el: HTMLDetailsElement): {
  background: string;
  border: string;
} | null {
  const bg = el.style.backgroundColor?.trim();
  const border = el.style.borderColor?.trim();
  if (!bg && !border) return null;
  return { background: bg || "#f8fafc", border: border || "#e2e8f0" };
}

export function applyAccordionColor(
  el: HTMLDetailsElement,
  colorId: LessonAccordionColorId | "custom",
  custom?: { background: string; border?: string }
): void {
  const preset = colorId !== "custom" ? accordionColorById(colorId) : null;
  el.classList.add(LESSON_ACCORDION_CLASS);
  el.setAttribute("data-accordion-color", colorId);
  if (preset) {
    el.style.backgroundColor = preset.background;
    el.style.borderColor = preset.border;
  } else if (custom) {
    el.style.backgroundColor = custom.background;
    el.style.borderColor = custom.border ?? custom.background;
  }
}

/** HTML block embedded in lesson markdown (collapsed for readers). */
export function lessonAccordionHtml(
  summary: string,
  bodyHtml: string,
  colorId: LessonAccordionColorId = "sky"
): string {
  const preset = accordionColorById(colorId)!;
  const safeSummary = escapeHtml(summary);
  return (
    `<details class="${LESSON_ACCORDION_CLASS}" data-accordion-color="${colorId}" ` +
    `style="background-color:${preset.background};border-color:${preset.border}">` +
    `<summary>${safeSummary}</summary>${bodyHtml}</details>`
  );
}

export function serializeAccordionElement(el: HTMLDetailsElement): string {
  const clone = el.cloneNode(true) as HTMLDetailsElement;
  clone.removeAttribute("open");
  return clone.outerHTML;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
