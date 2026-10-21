# Profit Coach app

## What this is

The Business Coach Academy (BCA) platform for Profit Coaches. One Next.js 16
app (App Router, Turbopack, Tailwind v4) on Supabase (Postgres, auth,
storage, migrations in `supabase/migrations`), Stripe billing, Vercel hosting.
**Pushing `main` deploys to production.**

- **Coaches** use the member app: Blueprint, Get / Win / Serve clients,
  Classroom, Vault, community. **Ava** is the in-app AI assistant.
- **Admins** (Zander and BCA staff) work under `/admin`.
- **Marketing pages** sell the BOSS Score funnel to UK owner-led businesses
  doing £1M+. Product and brand context: `PRODUCT.md`.
- Local dev runs on **localhost:3002**. Secrets are in `.env.local`: grep the
  one key you need, never `source` the file. Test as **Zander Demo** only.

## How to work here

- **Zander reviewing on 3002:** just edit the files. No commit, push or
  screenshots unless he says. One or two lines on what changed.
- **Overnight builds** ("I'm off to bed"): don't ask, decide. Work on a
  branch, commit only your own files, additive migrations, no spend, no
  LinkedIn sends. Write `docs/<feature>-morning-review.md` with "Decisions I
  made (overturn any of these)".
- **Design changes:** add the new version beside the old one. Never replace
  or delete a version he has seen.
- **Keep navigation flat:** group by the thing itself, few layers, one
  sensible default instead of parallel variants.
- **Copy:** follow `content/ai-knowledge/writing-rules.md` (binding for all
  copy). Everyday words a 12-year-old understands. Never name or credit Jack.
- **Never delete profiles or auth users as cleanup.** Community tables cascade
  from profiles. Keep the name, remove the login (admin "Remove access").
- **After styling changes,** confirm the new classes landed in the served CSS.
  Turbopack can serve stale CSS: stop the server, delete `.next/dev`, restart.
- **Security scans (Rafter) only when he asks.** Steps: `docs/security-scan.md`.

## Roadmap workflow (every session)

The Academy roadmap (/admin/roadmap, table `roadmap_jobs`) is the one queue.

- Starting work on a job: move it to In progress. Finishing: move it to
  Review with "Where to look:" (a localhost:3002 link) and "What to check:"
  at the top of its notes. Never move a job to Done or Live yourself.
- If his check finds something to change, the job goes back to In progress
  with the change added to its checklist, then returns to Review. No
  second review column.
- Two shortcuts, both Zander's. Never run either unless he asks:
  - `stage` = `npm run typecheck && git add -A && git commit -m "…" && git push origin main:staging`.
    Backs up to GitHub and builds https://staging.theprofitcoach.com (same
    database as live; no crons; Stripe secret keys deliberately absent).
  - `live` = `git push origin main`: production gets what's already staged.
  - `ship` = `stage` then `live` in one go (staging stays in step).
  - His text-replacement triggers are `;stage`, `;live`, `;ship`; in chat,
    "stage it", "go live" or "ship it" mean the same.
- Work stays on local main; never commit to `staging` directly or it stops
  fast-forwarding from main.
- Columns: Review = check on 3002. Done = checked and staged.
  Live = gone live. Zander drags Review → Done.
- Only a brand-new page or tab is built admin-only until it's ready. Changes
  to pages coaches already see are not gated; they go live with `live`.
- Zander releases by name, never by job number: "release Scripts" = remove
  that page's admin gate and move its jobs to Live.
- A new idea mid-session goes to Ideas → Evaluate as a new job; don't start
  building it unless Zander says so.

## Map: where the truth lives

This file is a map, not a knowledge base. Read the source of truth at these
paths when needed; do not copy their content here or anywhere in `.claude/`.

**Brand and product truth**

- `PRODUCT.md` (repo root): durable product and brand context for design work.
  Impeccable reads it before every design command. Zander edits this directly.
- `content/ai-knowledge/PROFIT_COACH_AI_ROUTER.md`: **short map only**, loaded
  first in every coach AI prompt. Edit in app: **Admin → Brand → Core brain →
  Knowledge**. Do not bloat it with canon.
- `content/ai-knowledge/`: brand brain canon (`methodology.md`, `icp.md`,
  `business-profile.md`, `brand-voice.md`, `offer-stack.md`, `writing-rules.md`
  always loaded; `avatar-profile.md`, `copywriter-knowledge.md` for copy skills).
- `content/agent/`: Ava's context (`AGENT.md`, `ROUTER.md`, one
  `capabilities/*/CONTEXT.md` per capability, loaded when opened).
- `src/lib/profitCoachAi/registry.ts` (skill ids, programme order) and
  `studioHub.ts` (Create hub cards). Admin UI: **Brand → Core brain**.

**Key marketing surfaces**

- `/` is the Scrollcraft site v4 (`public/site-v4`, rewrite in `next.config.ts`).
  `src/app/home-v3/` is kept for comparison.
- `src/app/pam/`: Pam's live coach page (theprofitcoach.com/pam).
- `src/app/score` + `src/app/landing/`: BOSS Score opt-in funnel.
- `src/components/profitSystem/`: brand graphics (roadmap, levels, hexagons).
- `src/components/BossCharts/BossWheel.tsx`: app wheel.

**Design tooling**

- `.claude/skills/impeccable/` and `.cursor/skills/impeccable/`: installed by
  `npx impeccable update`; never hand-edit.
- `.cursor/hooks.json`: pre-edit design-slop detector hook (offline).

## Keeping this file useful

Corrected on the same thing twice? Add one line here, or to the canon file it
belongs in, rather than only to memory. Keep this file under ~120 lines.
