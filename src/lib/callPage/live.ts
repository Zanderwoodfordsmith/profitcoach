/**
 * The Constraint Call page (/call/[slug]) is new, so it runs as a local preview until it is
 * released: in production it is off (404, and no links to it) unless NEXT_PUBLIC_CALL_PAGES_LIVE=1.
 */
export function callPagesLive(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_CALL_PAGES_LIVE === "1";
}
