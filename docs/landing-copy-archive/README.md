# Landing copy archive

`landing-copy-v1.json` is a point-in-time export of the default strings in [`src/lib/landingCopy.ts`](../../src/lib/landingCopy.ts) (`getDefaultLandingContent`). When product changes the defaults in code, add a new `landing-copy-v2.json` (or bump version in one file) so historical copy stays easy to find.

## Share URLs and A/B

- **Canonical funnel entry:** `/score` or `/score/{coachSlug}` (path segment is the database `coaches.slug`).
- **Force a variant (skip random cookie):** add `?variant=a` or `?variant=b`. Variant `a` uses the fast static assessment path; `b` uses the React landing flow.
- **Direct React landing (tests):** `/landing/a?coach=SLUG` or `/landing/b?coach=SLUG`.
- **Root `/landing`:** redirects to `/score` with the same query string so there is a single entry surface.

Coaches can set a **default variant** (when neither URL nor cookie is set) in Settings under the share page section (`landing_variant_preference`).
