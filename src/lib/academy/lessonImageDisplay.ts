export const LESSON_IMG_ALIGN_VALUES = ["left", "center", "right"] as const;
export type LessonImgAlign = (typeof LESSON_IMG_ALIGN_VALUES)[number];

export function isLessonImgAlign(value: string | null | undefined): value is LessonImgAlign {
  return (
    value === "left" || value === "center" || value === "right"
  );
}

export function readLessonImgAlign(el: HTMLElement): LessonImgAlign {
  const raw = el.getAttribute("data-align");
  return isLessonImgAlign(raw) ? raw : "left";
}

export function applyLessonImgAlign(el: HTMLElement, align: LessonImgAlign): void {
  if (align === "left") {
    el.removeAttribute("data-align");
  } else {
    el.setAttribute("data-align", align);
  }
}
