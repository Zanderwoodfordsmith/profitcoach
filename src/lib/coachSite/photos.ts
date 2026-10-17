import type { CoachSitePhoto } from "./types";

/**
 * Better photos for coaches who have them, kept in /public/coach-sites/{slug}.
 * Everyone else gets their profile picture. A "website photo" upload on the
 * Blueprint would replace this list.
 */
const PHOTOS: Record<string, { portrait?: Omit<CoachSitePhoto, "alt">; stage?: Omit<CoachSitePhoto, "alt"> & { alt: string } }> = {
  pam: {
    // Studio headshot on white, cropped above the baked-in logo.
    portrait: { src: "/coach-sites/pam/portrait.jpg", kind: "portrait", width: 760, height: 700 },
    // Pam and Zander on stage with a flipchart of numbers, in the brand duotone.
    stage: {
      src: "/coach-sites/pam/stage.webp",
      kind: "stage",
      width: 900,
      height: 667,
      alt: "Pam on stage with Zander Woodford-Smith, beside a flipchart of a client's numbers",
    },
  },
};

export function sitePhotosFor(
  slug: string,
  name: string
): { portrait: CoachSitePhoto | null; stage: CoachSitePhoto | null } {
  const entry = PHOTOS[slug];
  return {
    portrait: entry?.portrait ? { ...entry.portrait, alt: name } : null,
    stage: entry?.stage ?? null,
  };
}
