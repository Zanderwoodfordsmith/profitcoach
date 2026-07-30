/**
 * Profit Coach primary graphic colours.
 * Use these for compass pillars, academy path eyebrows, and shared brand accents.
 */
export const BRAND_GRAPHIC_COLORS = {
  /** Chatham's blue — Connect / Marketing / primary brand */
  chathams: "#0C5290",
  /** Light blue — Enroll / Sales */
  lightBlue: "#42A1EE",
  /** Teal — Deliver / Delivery */
  teal: "#1CA0C2",
} as const;

export type BrandGraphicColorKey = keyof typeof BRAND_GRAPHIC_COLORS;

/** Canonical lowercase hex for CSS / SVG fills. */
export const BRAND_CHATHAMS = BRAND_GRAPHIC_COLORS.chathams.toLowerCase();
export const BRAND_LIGHT_BLUE = BRAND_GRAPHIC_COLORS.lightBlue.toLowerCase();
export const BRAND_TEAL = BRAND_GRAPHIC_COLORS.teal.toLowerCase();
