import type { TimeBlockRating } from "./types";

/** Tailwind classes for a block tile, keyed by rating. */
export function ratingTileClasses(rating: TimeBlockRating): string {
  switch (rating) {
    case "good":
      return "bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200/80";
    case "bad":
      return "bg-rose-100 border-rose-300 text-rose-900 hover:bg-rose-200/80";
    case "neutral":
      return "bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200/80";
    default:
      return "bg-sky-100 border-sky-300 text-sky-900 hover:bg-sky-200/80";
  }
}

export function ratingDotClasses(rating: TimeBlockRating): string {
  switch (rating) {
    case "good":
      return "bg-emerald-500";
    case "bad":
      return "bg-rose-500";
    case "neutral":
      return "bg-amber-400";
    default:
      return "bg-sky-400";
  }
}
