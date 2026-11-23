# Launches on the coach's Blueprint: review (21 Nov, job 248)

The separate Launch page (20 Nov) is gone. Zander, 21 Nov: work on the coach's own Blueprint, with a status for when it's safe to release.

**Where to look:** Coaches → Launches → To check → "Open Blueprint" on any coach, or
http://localhost:3002/admin/coaches/kanwaldeep-kaurgracemasterlimited?tab=blueprint&doc=market (Ideal Client),
...&doc=lists (Lead lists), and http://localhost:3002/admin/coaches/bruce-alexander?tab=blueprint&doc=linkedin.

## What changed

- **Ava's drafts in place (BCA only).** On a coach's Blueprint page every box and written section shows Ava's open draft, marked "Ava's draft, not released". Typing in one changes the draft, never the live Blueprint. The coach still sees only what was released.
- **One bar per page** under the title: "Ava's draft is on this page, not released", when she drafted it, what she wrote without (amber note), Ask Ava to change it, and Release (everything of hers on the page). On LinkedIn the bar holds her profile, part by part, with Edit, until it's released into the coach's editor.
- **New Blueprint page: Lead lists** (after LinkedIn Profile). Coaches see the lists once imported: base search once, how each list searches, staff size, how many came in, and a "Quality: not scored yet" line for later. BCA also sees Ava's plan before import (untick, plan again, Import).
- **Launches → To check** is the status list: each coach's steps, each opening their Blueprint on that page; "Open Blueprint" opens the first page waiting on you. Lead lists rows open the new page.
- Ava plans lists at 1 to 50 staff by default (see earlier).

## Decisions I made (overturn any of these)

1. Release sends everything of Ava's on that page at once (boxes and written sections together), as you asked for Ideal Client.
2. Before import, coaches see "We're building your lists" on Lead lists, not Ava's plan: the plan is a draft until it's imported.
3. Ava's activity panel on the right (the older strip) is still there; the bar does the same job in the page. Say if you want the strip removed.
4. The Lead lists page shows a page status like the others ("BCA to do"); it isn't tied to anything yet.

## I checked

- Typecheck clean; lint clean on new files.
- As admin: Bruce's and Kanwaldeep's Ideal Client pages show the bar and mark the draft sections (2 and 8); Bruce's LinkedIn shows his draft parts; no browser errors.
- Typed in a draft box on Kanwaldeep's page: the draft changed, the live Blueprint didn't, and her draft was put back exactly afterwards.
- As Zander Demo (coach): Lead lists shows "We're building your lists"; no bar, no draft marks.
- Launches → To check links open the Blueprint pages.
- Not pressed on real coaches: Release, Ask Ava, Import.

## You check

- How it feels to check and release on the Blueprint (Kanwaldeep's Ideal Client is a good first one).
- The bar's wording and look, and the Lead lists page for a coach.

## Found, not mine, left alone

- `src/lib/support/ticketTopics.ts` pulls the server-only Supabase client into the Support dashboard's browser code (client bundle test fails). From the Support dashboard work that went live 20 Nov.
- The Keep Clients tab test fails on `/coach/simulator`.
