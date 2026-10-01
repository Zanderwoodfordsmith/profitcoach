# AI Agent: morning review

Built overnight on 1 to 2 October 2026, on the branch `ai-agent` (made from `practice-blueprint`). Nothing is merged or pushed. Your uncommitted changes from before (campaigns, messaging, prospects, blueprint admin files) are untouched and still uncommitted.

## Open these first

1. **As admin:** go to Get Clients, open the AI panel (the sparkle, top right), and click the new **robot icon**. That's the Agent. Try: *"Work on Zander Demo. Show me their lists and campaigns."*
2. **Then a chained job:** *"For Zander Demo, create a draft Connection campaign from their blueprint messages and add their newest Google Maps list to it."* Then *"remove two of those people"* and use the card.
3. **As a coach:** log in as Zander Demo ("View as coach" hides the panel, see decision 2). The sparkle now appears for them, and the panel shows the Agent only. Try *"I want to find new prospects"* and follow it through Google Maps. Cancel the card at the end unless you want to spend about 50 cents.

## What it is

An assistant that does the work in Get Clients, the way the Stryv assistant creates goals and actions. You tell it what you want; it asks only for what it still needs, then does it.

**What it can do tonight**

| Area | It can |
|---|---|
| Finding prospects | Ask how you want to find them. **Sales Navigator**: turn plain English ("owners of UK accountancy firms") into a search using the classroom base search and playbook, show the link to spot-check, import up to 2,500 into a new list. **Google Maps**: country, then US state or town, then what to search for, then how many (with cost and time), then import. Check how an import is going. |
| Lists | Show lists, look inside one, find a person, create, rename, add pasted LinkedIn URLs. |
| Campaigns | Show campaigns, open one, create one from the Campaign library (Connection, Reactivation, Ongoing nurture, Positive replies) or blank, rename, change priority and daily limits ("turn it up"), check the account's sending limits and SSI, turn on or pause. |
| People in campaigns | Add a whole list (or some of it), find people, remove, pause, resume. |
| Messaging | Pull the connector or conversation messages from the coach's blueprint into a campaign, or write a new sequence (invite under 275 characters, waits, follow-ups on remind, optional A/B versions). |
| Blueprint (admin) | Run the blueprint's own AI skills: avatar, pain points, prospect criteria, LinkedIn rewrite and headlines, campaign messaging, call script and the rest. |
| Guide | "How do I…" and "where is…", with a button to the page. |
| Admin | Find a coach by name, switch to them, switch the agent on or off for them. |

**Confirm cards.** Anything that could contact people, spend money or remove people does not run straight away. It shows a card with what will happen, for whom, and a Confirm button. That covers starting an import, turning a campaign on, adding people to a running campaign, removing people, changing volume or messages on a running campaign, rewriting a blueprint section that's already written, and giving a coach access. Drafts and reads run straight away. After you confirm, the agent carries on from the result.

## Your question: should members get it?

**My recommendation: yes, but switched on per coach, after you've used it yourself for a couple of weeks.** I built it so that's one switch.

- **What you sell is the thinking, not the clicking.** The blueprint, the targeting and the messaging are what feel done for them. The agent doesn't give those away: blueprint writing is admin-only, and in coach mode the agent works from *your* blueprint ("your blueprint targets…"), so it keeps crediting the work you did.
- **The clicking is where coaches get stuck and message support.** "Add my list to my campaign", "pause this person", "turn it up". An agent that does those is a better guided tour than a guided tour, and the **guide** capability covers the "show me" side with buttons to the right page.
- **The risks are covered.** Spending money (Google Maps) and contacting people (turning on, adding to a running campaign) always need a click on a card, and coach mode can only touch the coach's own account.
- **Watch before you widen.** Every chat is saved, so you can read what pilot coaches ask for and what it did.

How to switch it on for a coach: ask the agent (*"Give Pam access to the agent"*) and confirm the card. It sets `coaches.ai_agent_enabled`.

## How it's organised (the Context Methodology)

I found the paper in the Ops shared drive ("Interpretable Context Methodology") and the example `workspace-blueprint` in Downloads. The agent follows it rather than using one big prompt:

| Layer | File | Loaded |
|---|---|---|
| 0: who am I | `content/agent/AGENT.md` | Always |
| 1: where do I go | `content/agent/ROUTER.md` | Always |
| 2: the job's contract | `content/agent/capabilities/<name>/CONTEXT.md` | Only when the agent opens that capability |
| 3: reference | `content/agent/references/*.md`, plus the existing Sales Navigator playbook, writing rules and campaign method | With the capability that lists them |
| 4: working material | The coach's live data from tools, and the chat | As it goes |

The paper's point about tools is built in too: each capability's tools are hidden until it opens, using the API's "deferred tools" feature, so the agent only sees a few core tools (open a capability, the account overview, and for admins finding and switching coach) plus what the current job needs. I tested this against the API before building on it.

**To change how it behaves, edit the Markdown.** Each `CONTEXT.md` starts with a short header listing its tools and references; the rest is plain English (what to ask for, the process, what not to do). A test checks that every tool and reference in those headers exists. In development the files are re-read on every message, so edits apply straight away.

## The classroom skills

I read the Get Calls and Win Clients transcripts (40 lessons with transcripts) to see what the agent should know:

- **Already in the agent:** the base search, keyword search and list-building playbook (it was already distilled in the code, so the agent loads that rather than a copy); list size and quality KPIs (600 for an A/B test, 8 out of 10 good matches); the connector sequence and its timings; the CROP campaign types; account volume guidance by SSI.
- **Already in the blueprint, now runnable by the agent:** avatar, pain points, prospect criteria, LinkedIn profile and headlines, campaign messaging, replies and follow-ups, value session and call script, posts and newsletter. These were built from the classroom last night, so the agent runs them instead of writing its own versions.
- **Good next capabilities from the transcripts:** a **1st-degree connections campaign** (the "already connected" lesson; the search works today with degree 1, but there's no dedicated flow); **Open InMail** campaigns; **replying to leads** (the "mistakes to avoid" lesson is a ready-made contract for a reply-drafting capability in Conversations); **booking the value session** (the messages lesson); a **list quality check** (spot-check 10 people against the avatar and report the 8/10 score); and **blacklisting** clean-up after an import.

## Decisions I made (overturn any of these)

1. **It lives in the existing Profit Coach AI panel**, as an Agent view next to Chat, rather than a separate page. Fullscreen works too.
2. **Coaches get an Agent-only panel.** The panel was admin-only before; a coach with access sees the sparkle and gets only the Agent, not the unreleased Chat, Brain and Create views. "View as coach" still hides the panel, as it did before, so to see the coach view log in as the coach.
3. **One coach at a time in admin mode.** The chat shows "Working on …" and every card names the coach.
4. **Blueprint writing is admin-only** for now, because it's the done-for-you part.
5. **No deleting campaigns or lists** through the agent. Removing people from a campaign is allowed, with a card.
6. **Model:** Claude Opus 5.5 at medium effort, with the API's automatic fallback if a request is refused. Set `AGENT_ANTHROPIC_MODEL` to change it. My rough estimate, not measured: a few cents for a simple question, roughly 10 to 50 cents for a long chained job.
7. **The import, list-to-campaign and Google Maps code moved out of their routes** into shared functions, so the buttons and the agent run exactly the same code. The routes return the same responses as before.

## A bug the agent found in the blueprint hand-off

When the agent pulled Zander Demo's blueprint messages into a campaign, it noticed the connection note ended mid-word ("shifting to planne"). The blueprint's **Send to Get Clients** button cuts the note at 300 characters without checking where it cuts, and that blueprint's note is about 345 characters. The agent now refuses to save a cut note and rewrites it to fit instead. **The button itself still cuts.** Worth fixing in the blueprint skill (ask for a note under 275 characters) or in the hand-off. I didn't change blueprint behaviour tonight.

## Data written tonight

| Where | What |
|---|---|
| Migration `20270116120000_ai_agent.sql` | Applied. New tables `ai_agent_chats` and `ai_agent_actions` (server-only, no browser access), and `coaches.ai_agent_enabled`. Additive only. |
| Zander Demo | A **draft** campaign "Agent test · IT providers": 16 people from the Maps IT list, the blueprint connector messages with a shortened note, high priority. Never turned on. Safe to delete. |
| Zander Demo | Agent switched **on**, so you can try the coach view. |
| Your admin account and Zander Demo | Test chats and cards (all imports and turn-ons were cancelled). |

Nothing was imported, nothing was sent from any LinkedIn account, and no Apify money was spent. Pam's account wasn't touched.

## Known gaps and next steps

- **Long jobs that wait.** "Import, then when it finishes add them to the campaign" needs a background job; today the agent tells you to come back and asks again.
- **Account-level weekly invites** can be read but not changed by the agent (it points to Settings).
- **Voice input** isn't in the Agent view yet (the Chat view has it).
- **Pages don't always refresh** after the agent changes something, because Get Clients caches its data in the browser. Reload to see changes.
- **A card stuck on "Running"** is possible if the server dies mid-action. Rare, but there's no clean-up job yet.
- **Security review:** this adds new API routes and a permission model. Your project rules say Rafter runs only when you ask, so I didn't run it. I'd run `rafter run` (or ask me to "run rafter") before merging. My own pass covered: pending actions can't be created or changed from the browser; confirming re-checks permission and conditions; coach mode can only act on the coach's own account; prospect text from LinkedIn can't skip a card.

## Where the code is

- The methodology files: `content/agent/` (AGENT.md, ROUTER.md, `capabilities/*/CONTEXT.md`, `references/`)
- Engine: `src/lib/agent/` (`runTurn.ts` is the loop, `context.ts` loads the files, `tools/*.ts` are the actions, `actions.ts` the cards, `auth.ts` the modes)
- API: `src/app/api/agent/` (chat stream, chats, actions, status)
- UI: `src/components/agent/AgentChat.tsx`, mounted in `src/components/profitCoachAi/CoachAiPanel.tsx`; coach access in `src/app/coach/layout.tsx`
- Shared code the routes now use: `src/lib/googleMaps/startImport.ts`, `src/lib/salesNavigator/startImport.ts`, `src/lib/leadLists/addListToCampaign.ts`
- The plan I wrote before building: `docs/ai-agent-plan.md`

Checks: `tsc` is clean for `src`; 19 agent tests and 18 blueprint tests pass (`npx tsx --test src/lib/agent/*.test.ts src/lib/agent/tools/*.test.ts`). Every flow above was run for real against the API and database, and the panel was checked in the dev server as admin (docked, fullscreen and at phone width) and as a coach (docked).
