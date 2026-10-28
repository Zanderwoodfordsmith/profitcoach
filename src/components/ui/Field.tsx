import { cx } from "./cx";

/**
 * The app's form fields (DESIGN.md). One look for inputs, selects and
 * textareas: white, thin border, rounded-xl, navy focus ring. Normal
 * matches the normal button height; small fits tight rows and tables.
 */
export type FieldSize = "normal" | "small";
export type FieldKind = "input" | "select" | "textarea";

const BASE =
  "block w-full rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 transition-colors outline-none focus:border-[#0c5290] focus:ring-2 focus:ring-[#0c5290]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

const SIZES: Record<FieldKind, Record<FieldSize, string>> = {
  input: { normal: "h-10 px-3.5 text-ui", small: "h-8 px-3 text-caption" },
  select: { normal: "h-10 pl-3.5 pr-9 text-ui", small: "h-8 pl-3 pr-8 text-caption" },
  textarea: { normal: "px-3.5 py-2.5 text-ui", small: "px-3 py-2 text-caption" },
};

export function fieldClass(kind: FieldKind = "input", size: FieldSize = "normal", extra = "") {
  return cx(BASE, SIZES[kind][size], extra);
}

/** The small label above a field. */
export const fieldLabelClass = "block text-caption font-medium text-slate-600";
