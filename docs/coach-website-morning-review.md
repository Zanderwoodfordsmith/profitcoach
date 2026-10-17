# Coach websites: morning review

Built overnight 16 to 17 Oct 2026 on branch `coach-website` (not pushed, not merged).

## What to open

Run the app on 3002 as usual, then:

- **Pam's site:** http://localhost:3002/site/pam
- **All four heroes side by side:** http://localhost:3002/site/pam/heroes
- **A second coach:** http://localhost:3002/site/zander-demo (fictional demo data)

Any coach with a Blueprint works: `/site/{their slug}`.

Bottom right there is a **Design options** button. It switches each part of the page between its versions, and the choice stays in the link, so you can send a version to someone. For example:
`/site/pam?hero=dossier&proof=band&close=call`

## What it is

One website template for every coach. It fills itself from the coach's Blueprint, so a coach gets a site as soon as their Blueprint is written. Nothing is typed into the site itself.

| Part of the page | Where the words come from |
|---|---|
| Headline | Your offer in three lengths, short line |
| Standfirst | Your offer in three lengths, medium |
| "Sound familiar?" quotes | One-page profile, The problems I fix |
| Who they work with | One-page profile, Who I help |
| Where you are / where you want to be | Offer and positioning, The gap |
| How it works | One-page profile, How I work |
| The offer | Offer and positioning, The offer (no price) |
| Record and testimonial | Short bio stats, client testimonials |
| About | Short bio |

Private fields (phone, WhatsApp, address, fees, notes) can never reach the page. A test checks this.

## The versions to choose from

**Hero (4):**

1. **Territory.** A dot map of the British Isles that lights up outward from the coach's town, with "Based in Hull, Yorkshire". It says "local, and on your patch" before anyone reads a word.
2. **Dossier.** A portrait over a ledger of their record, like the BCA case study brochure hero.
3. **The gap.** "Today" on white, then a wipe across to "With Pam" on navy, using their four before-and-after lines. The visitor can flip between the two.
4. **BOSS Wheel.** Navy band with the example wheel. It leads with the score.

**The score section (2):** BOSS Wheel on navy, or your print-pack "Old way / New way" graphic.
**Proof (2):** quote beside the record, or one big quote on navy with the photo.
**Close (2):** "Get your BOSS Score" first, or "Book a call with Pam" with her photo.

## What's on the page from the Marketing Toolkit

- The **BOSS Wheel** (example scores, labelled "Example").
- The **50 playbooks map**.
- The **Old way / New way** graphic.
- The **A4 BOSS Scorecard** with the coach's own QR code to `/score/{slug}`. It is the opt-in: "Take it home". Visitors give their first name, email and business, then print or save the scorecard and download the playbook map.
- **Small gains multiply:** a pinned scroll where five levers light up one at a time and the total climbs to ×1.61 (the cleared 1.1⁵ maths).
- The **five levels**, Overwhelm to Owner, in the scorecard colours.
- **BOSS assessment links** everywhere: "Get your BOSS Score" goes to `/score/{slug}` (landing page first), with "Go straight to the questions" going to `/assessment/{slug}`. "Book a call" goes to `/book/{slug}`.

## Decisions I made (overturn any of these)

1. **Local only for now.** On the live site `/site/...` shows a 404 until we set `COACH_SITES_LIVE=1`. Once it is on, only Blueprint sections the coach or BCA has signed off appear. Unsigned sections drop out of the page rather than showing drafts.
2. **The local preview never sends a lead.** The opt-in shows the thank-you and the downloads but creates no contact. Live, it uses the existing lead capture, so leads land in the coach's contacts and fire their webhook like a scorecard lead.
3. **No prices on the site.** PRODUCT.md says prices stay off marketing pages, so the offer shows who it is for, what is included and how it runs, but not the price.
4. **Default versions:** Territory hero, Wheel score section, Ledger proof, Score-first close. Territory was the design roll's lead. Tell me your picks and I'll make them the defaults.
5. **Territory needs map coordinates.** It uses the latitude and longitude already saved on the coach's profile. Zander Demo has none, so its page falls back to the Dossier hero automatically. `npm run backfill-coach-geocodes` fills them for everyone.
6. **Better photos for Pam.** Her headshot is cropped above the baked-in logo, and the stage photo uses the brand duotone (`public/coach-sites/pam/`). Every other coach gets their profile picture. A "website photo" upload in the Blueprint would be the proper fix.
7. **Repetition cut.** The Blueprint's "Why you" list and "Results" bullets mostly repeat the bio and stats, so the page only shows them when the bio or stats are missing.
8. **Hyphens tidied.** The writers sometimes put " - " where a dash would go. The site turns it into a comma, but keeps ranges like "£1M - £8M".
9. **Fonts:** Figtree, the BCA brand font, with headlines in two weights (light over bold) like bca-website. The colours are the BCA navy scale and its daylight band gradient.

## Things to check with you

- **Pam's numbers:** her Blueprint says "43 years" running businesses and "ranked world's number one business coach 2015 to 2018". PRODUCT.md lists "45+ years coaching experience". The site prints what the Blueprint says. Which is right?
- **"Certified Profit Coach"** appears in the footer. Is that the title you want on every coach's site?
- **Privacy:** the opt-in collects emails, so it should link a privacy notice. I didn't find a public one in this app. Which URL should it use?
- **Domains:** the Blueprint has a "web address" field (own domain, or a Profit Coach page). Going live on `theprofitcoach.com/{slug}` or a coach's own domain is the next decision.

## Not done

- Not pushed or deployed. The live site is unchanged.
- No full `next build`, because it would share the `.next` folder with your running dev server. Typecheck, lint, the new tests and every page load all pass.
- Rafter wasn't run (this project only runs it when you ask). The new public surface is a read-only page plus the existing lead capture endpoint.
- DESIGN.md not written. It would set rules for the whole app, not just this page. The page's own design notes are in `.impeccable/surfaces/src-app-site-slug.md`.

## Where the code is

- `src/app/site/[slug]/` holds the page and the compare-heroes page.
- `src/components/coachSite/` holds the heroes, sections, map, gap wipe, multiplier, opt-in, options panel and stylesheet.
- `src/lib/coachSite/` holds the Blueprint-to-site mapper (with tests), loader, variants, map data and print-pack graphics.

Your uncommitted Blueprint work is untouched and still in the working tree.
