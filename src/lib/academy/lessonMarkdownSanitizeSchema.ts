import { defaultSchema } from "hast-util-sanitize";

/** Allow inline coloured spans and accordions in coach-facing lesson markdown (admin-authored). */
export const lessonMarkdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "span", "details", "summary"],
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span ?? []), "style"],
    details: ["class", "style", "data-accordion-color"],
    summary: ["class"],
  },
};
