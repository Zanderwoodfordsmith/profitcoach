import type { ProfileSectionId } from "./types";

/** What each LinkedIn profile part is called on cards and the Launch page. Safe for the browser. */
export const PART_TITLES: Record<ProfileSectionId, string> = {
  headline: "Headline",
  about: "About",
  featured: "Featured",
  experience: "Current role",
  banner: "Banner",
};
