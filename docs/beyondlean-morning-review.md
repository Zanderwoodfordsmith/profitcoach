# Beyondlean (Paul Swift) site: morning review (overnight 29 to 30 Oct 2026)

Everything is on **localhost:3002/beyondlean**, on branch **`beyondlean-site`** (not pushed, not on main).
Production returns 404 for every /beyondlean page unless `BEYONDLEAN_SITE_LIVE=1`. Roadmap job 116 is in Review.

## Where to look

| Page | Link |
|---|---|
| Home (new design, the default) | http://localhost:3002/beyondlean |
| How it works | http://localhost:3002/beyondlean/how-it-works |
| Case studies (14) | http://localhost:3002/beyondlean/case-studies |
| A case study | http://localhost:3002/beyondlean/case-studies/airline-caterer-business-class-meals |
| Blog (34 articles) | http://localhost:3002/beyondlean/blog |
| An article | http://localhost:3002/beyondlean/blog/standardisation-gone-wrong |
| About Paul | http://localhost:3002/beyondlean/about |
| Earlier rounds | Removed 30 Oct (New picked). The BCA "How we work together" steps are saved, unused, in `src/components/beyondlean/saved/WorkTogether.tsx` |

## Do these first

1. ~~**Pick the home design.**~~ Done 30 Oct: New kept, the rest deleted.
2. **Tell Paul about his live site.** His old pages publish course download passwords in plain text (madlty, mcdlty, basdlty, static, leand, blackbeltthanks), and his public Diagnostic PDFs show the snack maker's name and owner and some staff names. Worth fixing now, whatever happens with the new site.
3. **Send Paul one list** (draft below) so he can confirm numbers, names and photos in one go.

## What was built overnight

- **A real multi-page site** on one shared shell: glass nav (How it works, Case studies, Blog, About), phone button, column footer, and on phones a bottom bar with "Call Paul" and "Book a free call".
- **Home**, reworked from the Automatable CRO audit (it scored the first version 2 of 26): pain line, outcome headline "More profit. Less firefighting.", the free offer and "If I can't help, I'll tell you" under it, three proof ticks, a stats bar under the sectors strip, three bullets in About, an outcome heading on the three phases, a button under the results, a better FAQ (money answer, "how soon", "what if it doesn't work", tappable phone). The scroll diagram ("the untangle") moved to How it works, as the audit said it repeated the problem cards.
- **How it works**: the three steps in detail with what you get at each, the untangle, "This is for you if / not for you if", a BOSS Score opt-in.
- **Case studies**: 14 write-ups (5 from Paul's decks and PDFs, 9 from his CV and LinkedIn), each with At a glance numbers, the problem, what we did, what changed, what an owner can take from it, a facts panel and a mid-page BOSS Score opt-in. Clients are anonymised. Each says Delivered or Found in the review.
- **Blog**: 34 of Paul's articles carried over from beyondlean.com with a light tidy in his own words, 34 of his own diagrams, grouped by topic, 6 featured. Each article has a BOSS Score opt-in in the middle, an author card and a "book a call" card.
- **About**: his story in plain words, the career timeline, values, qualifications, farm and karate.
- **Redirects ready for the switch-over**: `content/beyondlean/redirects.json` maps 37 old beyondlean.com addresses to the new pages, so links and search rankings carry over.

## Decisions I made (overturn any of these)

1. **Blog: everything useful comes across now, optimising it is Phase 2.** You worried about losing his articles at the switch. The proposal's Phase 1 says "Keep the content and the backstory" and "nothing useful gets lost", so all 34 are in, lightly tidied. Phase 2 (content library) is where they get rewritten for owners, merged or retired, turned into lead-magnet guides and given proper SEO. That keeps Phase 2 a clear, sellable step up.
2. **Left out of the blog:** belts, certification, course and product pages, job ads, visitor CVs, foreign-language copies, and third-party reprints (Senn-Delaney, Flinchbaugh, Haworth and others). Full list with reasons: `content/beyondlean/blog/_index-notes.md`.
3. **Three "case study" articles held back** (`content/beyondlean/blog/_held/`), because the proper case studies cover them with corrected numbers. Their old PDF addresses redirect to the case-study pages.
4. **Featured articles:** Standardisation gone wrong, Lean and Six Sigma don't work, Kanban: is it the answer?, Gemba management, Why Lean transformations fail, What Lean Six Sigma can do for your business.
5. **No dates shown on articles.** The old site's dates are unreliable (several are only "first seen" dates).
6. **14 case studies, CV-based ones marked Delivered**, because his CV reports them as results. All 9 carry a "needs Paul's confirmation" note, shown only on localhost (never live). Where sources disagreed I used the older CV (Club Meals 4 months, aerospace £1.4m). The snack maker uses the corrected net £1.4m, not the deck's £1.48m.
7. **Stock photos** (Unsplash, free licence, credited in `public/beyondlean/stock/CREDITS.md`) on 4 case studies, the phases and home results, until Paul sends real ones. No stock faces in the hero.
8. **The audit's "leave out" calls I didn't take:** I kept the library section and the footer on the home page (the audit's own rule: a homepage keeps them for search), and kept the BOSS Score section (it is the lead magnet).
9. **What I couldn't do honestly yet** (all need Paul): client logos, video testimonials, written reviews, a founder video, a guarantee in his words, a short form (the booking page is the form for now).
10. **Fonts and look:** Figtree throughout, BCA navy and blues, Brevon-style hero, Aura-style close card. The home page uses your BCA two-weight headings on every section.

## What I checked

- Typecheck passes.
- All 53 pages (home, 4 section pages, 14 case studies, 34 articles) at 1440, 1024 and 390 wide, scrolled top to bottom so every lazy image loads: all load, no broken images, no sideways scroll, no page errors. 0 problems out of 159.
- Screenshots read by eye, desktop and phone: home, how it works, about, case studies index and a study, blog index and an article. Copies in Drive: Design library/Coaches/Paul Swift/Website/2026-10-30 round 5 multi-page.
- Bullet and numbered lists show in articles (the app's base styles had stripped them).
- The Automatable audit ran on the home page (report: `~/Coding/beyondlean/tools/cro-blueprint/context/pages/localhost-beyondlean/audit.html`). I applied its fixes but did not re-run it.

## What I couldn't check

- A real phone, and the booking page as a prospect sees it live (`/book/paul-swift`).
- Speed: Lighthouse on a dev server is meaningless. Test the live address in PageSpeed Insights once it's up.
- Whether every CV number is right. That's Paul's list below.

## Draft message to Paul (for you to send, edit freely)

> Hi Paul, the new site is coming together and I'd love you to see it soon. Before I show you, could you check a few things?
>
> 1. **Numbers from your CV**: +500% profit at the car business (and the business name and dates), +160% at the mortgage team, £3m+ at the energy contact centre, the media telesales, bank errors (56 to 11), collections (420 to 314) and government agency results, and the "over $10m in six months" airline catering line on your old site.
> 2. **Names**: can we name any clients or show their logos? Everything is anonymous for now.
> 3. **Photos**: a few real photos would lift the site more than anything: you at work, on a shop floor, the farm and dogs, a karate class.
> 4. **Testimonials**: any client who'd give a short quote or a 30-second video.
> 5. **The five attachments** that didn't reach us on 23 Oct: DMAIC Project Example, Commodities Trading, Demand Process DXC, Dudley Telesales, LBG Contact Centre Forum.
> 6. **Happy to mention** the farm and your karate on the About page?
> 7. **Your old site**: a few old pages still show download passwords for your courses, and the snack manufacturer PDF shows the client's name. Worth taking down.

## Files

- Pages: `src/app/beyondlean/` (home, how-it-works, about, case-studies, blog)
- Components: `src/components/beyondlean/` (v5 home `BeyondleanV5.tsx`, shared shell `v5/parts.tsx`, styles `beyondleanV5.css` and `v5/pages.css`; earlier rounds alongside)
- Content: `content/beyondlean/blog/` and `content/beyondlean/case-studies/` (Markdown; files starting with `_` are notes and never shown), `content/beyondlean/redirects.json`
- Loader and gate: `src/lib/beyondlean/content.ts`, `src/lib/beyondlean/mode.ts`
- Research and sources: `~/Coding/beyondlean/` (old site export, his decks, design references, taste profile, the Automatable course notes)
- Design library screenshots: Drive, Profit Coach/0. Brand/Design library/Coaches/Paul Swift/Website
