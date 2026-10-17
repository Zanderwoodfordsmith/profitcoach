/**
 * Design options for the coach website. Each group is one part of the page with
 * versions to compare; the choice lives in the URL (?hero=dossier&proof=band).
 */

export const SITE_VARIANTS = {
  hero: {
    label: "Hero",
    options: [
      { id: "territory", label: "Territory", note: "Their patch on the map" },
      { id: "dossier", label: "Dossier", note: "Portrait and a ledger of proof" },
      { id: "gap", label: "The gap", note: "Today, then a wipe to what they want" },
      { id: "wheel", label: "BOSS Wheel", note: "Lead with the score" },
    ],
  },
  system: {
    label: "The score",
    options: [
      { id: "wheel", label: "BOSS Wheel", note: "Dark band, example wheel" },
      { id: "oldnew", label: "Old vs new", note: "Whiteboard against the wheel" },
    ],
  },
  proof: {
    label: "Proof",
    options: [
      { id: "ledger", label: "Ledger", note: "Quote beside the record" },
      { id: "band", label: "Band", note: "One big quote on navy" },
    ],
  },
  close: {
    label: "Close",
    options: [
      { id: "score", label: "Score first", note: "Get your BOSS Score" },
      { id: "call", label: "Call first", note: "Book a call, portrait" },
    ],
  },
} as const;

export type VariantGroup = keyof typeof SITE_VARIANTS;

export type SiteVariants = {
  [G in VariantGroup]: (typeof SITE_VARIANTS)[G]["options"][number]["id"];
};

export const VARIANT_GROUPS = Object.keys(SITE_VARIANTS) as VariantGroup[];

export function defaultVariants(): SiteVariants {
  return {
    hero: "territory",
    system: "wheel",
    proof: "ledger",
    close: "score",
  };
}

/** Reads ?hero=…&system=… and falls back to the default for anything unknown. */
export function parseVariants(
  params: Record<string, string | string[] | undefined>
): SiteVariants {
  const out = defaultVariants() as Record<VariantGroup, string>;
  for (const group of VARIANT_GROUPS) {
    const raw = params[group];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value && SITE_VARIANTS[group].options.some((o) => o.id === value)) {
      out[group] = value;
    }
  }
  return out as SiteVariants;
}
