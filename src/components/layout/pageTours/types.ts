/**
 * "Explore this tab" steps, by area and tab. Each step points at one part of
 * the page, found by `selector`. When that part isn't on screen (say, no
 * conversation is open), the step points at `fallback` and says
 * `fallbackBody` instead; with no fallback, the step is skipped.
 *
 * One file per area in this folder, merged below. Keys are "area/Tab", where
 * area is the guide key in sectionGuides.ts and Tab is the tab's label, e.g.
 * "get-calls/Conversations" or "blueprint/About You".
 * When you change one of these pages, check its steps still find their parts.
 */
export type PageTourStep = {
  selector: string;
  title: string;
  body: string;
  fallback?: string;
  fallbackBody?: string;
  /**
   * Open what the step needs first: click the first `click` match, unless
   * something matching `unless` is already on screen. Only ever clicks
   * things that change nothing for real (a chat already read, the reply box).
   */
  prepare?: { click: string; unless: string };
};
