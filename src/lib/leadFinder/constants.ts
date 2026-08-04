/** Hard cap for Apify fills only (credits). */
export const LEAD_FINDER_MAX_ITEMS = 10;

/** Local owners DB: default leads per results page. */
export const LEAD_FINDER_PAGE_SIZE = 100;

/** Page size choices in the Lead Finder results UI. */
export const LEAD_FINDER_PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const;

/** Server clamp for pageSize (must cover largest UI option). */
export const LEAD_FINDER_MAX_PAGE_SIZE = 250;
