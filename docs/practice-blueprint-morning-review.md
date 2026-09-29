# Practice Blueprint: morning review

Built overnight on 29 to 30 September 2026, on the branch `practice-blueprint`. Nothing is merged to `main` or pushed.

## Open these first

1. **Admin → Coaches → Blueprint → Coach view** (`/admin/blueprint/coach/blueprint`). Pick **Zander Demo** in "Viewing as". This is the full-strength example: a complete interview and every section written.
2. The same page with **Pam Woodford** selected. This is the honest real-data example: her LinkedIn, her published facts and her testimonial, with the gaps flagged where we still need her numbers.
3. **Map** tab (`/admin/blueprint/map`). The new "Coaches" column shows how many coaches have each section filled. Click a count to see who.

## What it is now

**One document.** The Blueprint is a single premium document: a cover, contents, then five chapters (Foundation, Get calls, Win clients, Serve clients, Grow your practice). The sidebar is its table of contents. Clicking a page opens that chapter on its own, with the same content, zoomed in.

**Every section has one of five types:**

| Type | What it means | Examples |
|---|---|---|
| Imported | Pulled from LinkedIn or sign-up. The coach confirms it. | Experience, current profile, phone |
| From you | The coach tells us in the AI conversation, or types it in | Results, superpowers, fee, call times, web address |
| We build | BCA writes it with an AI skill | Avatar, pain points, campaigns, LinkedIn rewrite, newsletter, call script |
| Standard | The BCA default | Writing rules, recommended format, how a value session runs, the session guides |
| Live | Real numbers from the platform | Live campaigns, conversations, calls, clients |

**The AI conversation** now sits in a right-hand panel (a bottom sheet on phones). It works through an agenda built from the map: proof first, then the market, the offer, LinkedIn, and the practical setup last. It asks only for what is still open and skips anything imported. You can type or speak.

**Downloads.** There's one Markdown file for the whole blueprint ("Paste it into ChatGPT, Claude or any assistant"), one per page, and "Save as PDF" through print. The print styles give a full-page gradient cover and start each chapter on a new page.

**Edit in place.** Every written message (connection requests, emails, the About section, headlines) has an Edit button. Edits save to the section and are marked "edited". Rewriting an edited section asks first, and "Rewrite everything" skips edited sections.

**Send to Get Clients.** On Campaign messaging, one click creates a draft campaign in Get Clients: an invite, then waits and messages, with the messages on "remind" so the coach approves each one. Two variants are available: the classic Connector sequence, and the softer conversation into the BOSS Scorecard (the style of Pam's live Electrical campaign). Nothing sends until prospects are added and the campaign is started.

## The written sections (17 AI skills)

Each "We build" section has an AI skill with its own method file in `content/practice-skills/`. They're plain Markdown, so you can edit them directly. They were written from:

- the classroom: choosing your core client, the gap, offer structure, pricing, the connector templates and 10-point checklist, the Open InMail checklist, reply mistakes, the INSIGHT framework, the LinkedIn checklist and the About section form;
- Pam's **Value Session Mastery Workbook** (the four questions, the magic question, the transition script and the launch kit);
- the **VIP Nurture templates** (the tool-led messages: Profit Maximiser, Cashflow Forecaster, Time Value Tracker and so on);
- Pam's live campaigns;
- a LinkedIn profile audit playbook in your Downloads (five headline formulas, the About section as a mini sales page).

Every skill also loads `content/ai-knowledge/writing-rules.md`. There are no em dashes, and there's a hard rule against inventing numbers, clients or anecdotes. Where a number is missing, the section says so.

Build order follows dependencies: market options, then the avatar, then pain points, then everything that uses them. "Write my blueprint" runs them one by one, at 20 to 60 seconds each.

## Decisions I made (overturn any of these)

1. **The two-type split became five types.** "Imported" is separate from "From you", so filtering the map on "From you" gives you exactly the AI's question list.
2. **New capture fields:** web address (own domain or a Profit Coach page), practice email, LinkedIn public or discreet, and client call times. The phone number now imports from the profile. LinkedIn "discreet" matters: the classroom's About-section form already asks it.
3. **Value session.** "How a value session runs" is Standard, following Pam's workbook. "Your value session" is written per coach, with its own name, questions and full launch kit.
4. **Typography.** The document uses Fraunces (the homepage display face) for the cover, chapter titles, ledes, quotes and proof numbers, with Geist for the body. It uses the brand navy-to-sky gradient and thin gradient rules under titles, as you asked.
5. **Layout.** When the assistant is open on screens under 1600px wide, the contents sidebar folds to a rail so the document keeps its width.
6. **Approvals** are now per section, keyed by section id, so old approvals keyed by title no longer show. Standard sections and live sections can't be approved.
7. **Pam's record.** I added facts from her own published material: phone and email from the workbook, `theprofitcoach.com/pam`, LinkedIn "public", and the John Davy testimonial as a client story. I did not invent anything else. Her superpowers, problems solved and a number-backed client result are still open. That's why her campaign carries a warning that it cannot launch at full strength yet.
8. **Zander Demo is fictional.** A second AI played a made-up coach (ex-Operations Director at "Harlow & Pike Building Services", Leeds) through the real interview API, so you can see the whole flow working. It's demo data only.

## Data written tonight

| Where | What |
|---|---|
| Migration `20270115120000_practice_built_sections.sql` | Applied. Adds `coach_practice_knowledge.built_sections` (jsonb). Additive only. |
| Pam Woodford | Practice record hydrated from LinkedIn, published facts added, all 17 sections written |
| Zander Demo | Simulated interview (fictional), all 17 sections written |
| Zander Demo, Get Clients | Two **draft** campaigns from the Send to Get Clients test ("Blueprint · Connector campaign", "Blueprint · Conversation into the scorecard"). Safe to delete. |

## Quality fixes found by testing tonight

- The interviewer sometimes answered with the wrong JSON key once conversations got long. It now gets a key reminder every turn, the route accepts the alternatives, and it retries once.
- The interviewer asked for the phone number straight after the first result. The agenda now goes proof, then market, then offer and LinkedIn, then setup.
- The AI turned "15 or more hours a week" into "fifteen years in building services". The prompt now labels hours in plain words, and a rule bans deriving tenure from other numbers. The demo was rebuilt after the fix.
- An early campaign invented an anecdote for Pam ("I know what a 6am plant breakdown feels like"). A new rule bans inventing the coach's experiences, and Pam's sections were rebuilt.

## Known gaps and next steps

- **One-to-one call transcripts** are listed as a source for the avatar, pain points and voice, but nothing loads them yet. That's the next big quality jump: upload the Happy Scribe transcripts and feed them into the skills.
- **Coach-edited copies of Standard sections** ("Make it mine") aren't built yet. The data shape leaves room for it.
- **Editing written sections.** Message cards are editable in place. Tables and paragraphs aren't yet (rewrite the section, or edit the captured facts and rewrite).
- **Coaches can still open `/coach/practice`** (your welcome screen links to it). It's the same new document. I took it out of the Get Clients hub, so the sidebar no longer highlights Get Clients on these pages. Say if you want it admin-only until launch.
- **Website** stays a separate project, as discussed.
- **The old `PracticeBrief`** component is still used on the admin coach record page. The coach-facing pages no longer use it.

## Where the code is

- The map, types, states and agenda: `src/lib/practiceKnowledge/blueprint.ts`
- Skills (what each section produces): `src/lib/practiceKnowledge/skills.ts`, method files in `content/practice-skills/`
- Build and hand-off: `buildSection.ts`, `campaignHandoff.ts`, routes `api/coach/practice/build` and `api/coach/practice/send-campaign`
- Blocks and export: `blocks.ts`, `exportMarkdown.ts`, `standard.ts`
- The document UI: `src/components/practice/document/*`, `BlueprintAssistant.tsx`, `CommandCenter.tsx`, `PracticeShell.tsx`
- Admin: `AdminBlueprintMap.tsx` (coverage), `api/admin/practice/coverage`

To write any coach's blueprint from the terminal: `npx tsx scripts/build-practice-blueprint.mts <coachId>` (all sections), or pass section keys such as `market:avatar`.

Checks: `tsc` is clean, and the 18 practice tests pass (`npx tsx --test src/lib/practiceKnowledge/*.test.ts`).
