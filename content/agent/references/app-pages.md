# Every page a coach can open

Written from the app's code by `scripts/ava-app-map.ts`; do not edit by hand (run the script again). **Bold** = exactly what is on screen. Some pages need a membership or a connection first; if a coach can't see something, say so and point them to Support.

- For the buttons, boxes and what must be connected on one page, call `page_details` with its path. Do this before naming any button.
- To give a button to a page or tab, call `link_to_page` with `path` set to a path below.

## Pages
- **Classroom** `/coach/academy/classroom`: Academy → Classroom. Browse the training courses, see how far you have got in each, and open a lesson.
- **System** `/coach/academy/classroom/system`: Academy → Classroom → System (the lead-flow map; open Academy in the sidebar, go to Classroom, then choose the system map). See the whole path from finding ideal clients to keeping them as a map, hover or click any step to read about it, and open the matching lesson.
- **Weekly Focus** `/coach/academy/classroom/weekly-focus`: Academy → Classroom → This Week's Focus. Read this week's focus and action, listen to the audio, and look back at past weeks.
- **Weekly Focus** `/coach/academy/classroom/weekly-focus/[weekId]`: Academy → Classroom → open a Weekly Focus week. Read one week's focus, its action, and any audio or lesson text, then jump to the related learning path or go back to earlier weeks.
- **The Resource Library** `/coach/academy/resources`: Academy → Resources. Browse, search and open every guide, sheet, deck and template for winning clients, running sessions and using the Profit System.
- **Resource page** `/coach/academy/resources/[page]`: Academy → Resources → open any resource. Read one resource from the library, and copy, download or open its sheets, slides and files.
- **Resource list** `/coach/academy/resources/list`: Academy → Resources → ← The Resource Library link leads to the Resource Library; this older list page is reached from there. Browse or search the original list of Academy resource links, grouped by area, and open any of them in a new tab. Tabs: **Area switch (buttons at the top; names come from the app and are not shown in the page code)**.
- **Ava** `/coach/ava`: Not in the sidebar lists given; the page opens at /coach/ava (Ava is the assistant inside the app). The coach opens the full Ava page to chat with Ava, the app's AI assistant.
- **My Blueprint** `/coach/blueprint`: My Blueprint in the sidebar. See where each page of your practice plan stands, and open any page to work on it.
- **One Blueprint page** `/coach/blueprint/[slug]`: My Blueprint → pick a page from the contents or the links on the Blueprint. Read one page of your practice Blueprint on its own and answer or edit the parts that are yours to fill in.
- **Blueprint (whole document)** `/coach/blueprint/blueprint`: My Blueprint → Blueprint. Read your whole practice blueprint as one document, see what is still needed from you, and jump to any chapter or page.
- **BOSS Score** `/coach/boss-pro`: Keep Clients → BOSS Score. Pick a client or prospect, score them across the BOSS playbooks, and see their charts, insights and priorities.
- **Calls** `/coach/calls`: Win Clients → Calls. See every booked sales call in a calendar or list, mark how each call went, add a call for a prospect, and manage your booking pages. Tabs: **Calendar view** `/coach/calls`, **List view** `/coach/calls?tab=list`, **Booking pages** `/coach/calls?tab=settings`.
- **Campaigns** `/coach/campaigns`: Get Calls → Campaigns. See how your outreach campaigns are doing, switch them on or off, and create or open a campaign.
- **One campaign** `/coach/campaigns/[id]`: Get Calls → Campaigns, then click a campaign. Run one LinkedIn (or email/WhatsApp) campaign: turn it on or off, add people, write the steps and watch results. Tabs: **Overview**, **Prospects**, **Steps**.
- **Pending connection requests** `/coach/campaigns/invites`: Get Calls → Campaigns, then open the pending invites page (the "← Campaigns" link on this page leads back to Campaigns). Withdraw old pending LinkedIn connection requests by hand or let them clear automatically, so new invites keep going out.
- **One lead magnet** `/coach/campaigns/magnets/[magnetId]`: Get Calls → Lead Magnets → open a lead magnet (for example BOSS Score). See who opted in, started and finished one lead magnet, share its link, and edit the follow-up emails that go out after. Tabs: **Overview**, **People**, **Sequences**.
- **Keep Clients** `/coach/clients`: Keep Clients in the sidebar (the Clients tab). See everyone you coach with their price and join date, add or edit clients, and open a client's BOSS Score or coaching workspace.
- **Community** `/coach/community`: Academy → Community. Read and write posts, wins and questions with other coaches, and filter the feed by category. Tabs: **Community** `/coach/community`, **Classroom**, **Calendar**, **Resources**.
- **One community post** `/coach/community/[postSlug]`: Academy → Community, then open a post from the feed. A coach reads a single community post from the feed, which is shown by the Community page itself.
- **Calendar** `/coach/community/calendar`: Academy → Calendar. See upcoming and past community calls, open an event for details, watch recordings, and add the calls to your own calendar app. Tabs: **Upcoming**, **Previous calls**.
- **Members** `/coach/community/members`: Academy → Community → Members. Browse everyone in the Profit Coach community as a list or on a map, see who is online, and add your own location to the map. Tabs: **Members** `/coach/community/members`, **Online** `/coach/community/members?filter=online`, **Admins** `/coach/community/members?filter=admins`, **List** `/coach/community/members`, **Map** `/coach/community/members?view=map`.
- **Conversations** `/coach/conversations`: Get Calls → Conversations (Get Calls is in the sidebar). Read and reply to your LinkedIn, WhatsApp and email messages in one inbox.
- **Income** `/coach/income`: This page has no item in the sidebar or the section tabs. The code gives no link to it, so Ava should not guess a menu route; the page address is /coach/income. Log money you have received and see it totalled by client and by month. Tabs: **Income entries**, **Client × month**.
- **Content** `/coach/linkedin`: Get Calls → Content. Write, schedule and publish your LinkedIn posts, and see how your posts and newsletter issues are doing. Tabs: **Compose** `/coach/linkedin?tab=compose`, **Queue** `/coach/linkedin?tab=queue`, **Calendar** `/coach/linkedin?tab=calendar`, **Library** `/coach/linkedin?tab=library`, **Insights** `/coach/linkedin?tab=insights`, **Settings** `/coach/linkedin?tab=settings`.
- **Membership** `/coach/membership`: Not in the sidebar. Open it from the membership link or the /coach/membership page. See your membership level and billing status, compare Core, Premium and VIP, and join or switch a level.
- **Newsletter** `/coach/newsletters`: Get Calls → Newsletter. Write, edit and track your newsletter issues: drafts, scheduled and already published on LinkedIn.
- **Playbooks** `/coach/playbooks`: Keep Clients → Playbooks. Browse ready-made guides to share with clients, each with your link added, and open one to see it.
- **Pipeline** `/coach/prospects`: Win Clients → Pipeline. See everyone you are talking to, move them through stages, add or import prospects, and open one to work on them.
- **One prospect** `/coach/prospects/[id]`: Win Clients → Pipeline, then click a person (also opens from Get Calls → Conversations, Campaigns or Lead Lists). See one prospect's messages, details, activity, calls and private notes in one place, and message them or book a call. Tabs: **Activity**, **Calls**, **Notes**.
- **Scoreboard** `/coach/scoreboard`: Win Clients → Scoreboard. Pick monthly income targets, type your own numbers, and see how many leads, calls and clients it takes to reach them.
- **Scripts** `/coach/script`: Win Clients → Scripts. Browse every script for your talks with owners, from first message to the close, and open one to use it.
- **One script** `/coach/script/[script]`: Win Clients → Scripts → pick a script. Read one call script part by part, filling in the gaps with your prospect's details; the Profit Roadmap script opens the live call screen.
- **Call Practice** `/coach/script/simulator`: Win Clients → Call Practice. Practise a sales call out loud with an AI business owner, then get a score and a report.
- **Call practice report** `/coach/script/simulator/[id]`: Win Clients → Call Practice, then open a past practice call. See the score, how a practice sales call ended, what went well and what to try next time, and listen back to the call.
- **Search** `/coach/search`: Search box in the top bar or sidebar, which opens the Search page. Search lessons, videos, resources, community posts and members from one box. Tabs: **Classroom** `/coach/search`, **Community** `/coach/search?tab=community`, **Members** `/coach/search?tab=members`.
- **Settings** `/coach/settings`: Click your profile or account area, then Settings (page at /coach/settings). Not one of the main sidebar items. Coach edits their profile, connects email, calendar and social accounts, sets how Ava alerts them about replies, and manages billing and their ladder. Tabs: **Profile** `/coach/settings?tab=profile`, **Billing** `/coach/settings?tab=billing`, **My Ladder** `/coach/settings?tab=ladder`.
- **Toolkit: Links** `/coach/share`: Get Calls → Toolkit (then the Links tab). Copy or send your public links, such as BOSS Score pages, booking pages, reports and social profiles, so an owner can start with you in one click. Tabs: **Links** `/coach/share`, **Brochure**, **Social media posts**, **LinkedIn, email and calls**, **Print**, **Brand graphics**.
- **Client Simulator** `/coach/simulator`: Keep Clients → Client Simulator. Practise a hard client talk out loud with an AI client, then get a score out of 50 and a report.
- **Session report** `/coach/simulator/[id]`: Keep Clients → Client Simulator → open a past session from Your sessions (or finish a practice call). Read the score and feedback for one practice call with an AI client, listen back, and choose what to do next.
- **Support** `/coach/support`: Support (in the app menu) → Chats tab. Open Help with the Help tab. Chat with Zander and Pam, or search the Help centre for short answers. Tabs: **Chats** `/coach/support`, **Help** `/coach/support?tab=help`.
- **Toolkit** `/coach/toolkit`: Get Calls → Toolkit. Download your 90-day brochure, social posts, LinkedIn and email graphics, print files and brand graphics, all with your name and QR code already added. Tabs: **Links**, **Brochure** `/coach/toolkit`, **Social media posts** `/coach/toolkit?view=social`, **LinkedIn, email and calls** `/coach/toolkit?view=linkedin`, **Print** `/coach/toolkit?view=print`, **Brand graphics** `/coach/toolkit?view=brand`.

## My Blueprint: every page, section and box
Sidebar → **My Blueprint**. Groups, then pages (with their path), then sections and the boxes in each. Groups marked (coach fills in) are the coach's job; BCA writes the rest.

### Start Here (coach fills in)
- **Overview** (`/coach/blueprint`)
- **About You** (`/coach/blueprint/about`)
  - Your career: **Your career**, **Roles**, **Industries and companies**
  - Commercial achievements: **Results**
  - What owners come to you for: **What owners come to you for**
  - What makes you different: **What makes you different**
  - Problems repeatedly solved: **Problems**
  - Where you have credibility: **Where you have credibility**
  - Who you will not take: **Who you will not take**
  - How you want to be known: **How you want to be known**
  - The kind of coach you are: **The kind of coach you are**
  - Phrases you use, and anything else: **Phrases you use, and anything else**
  - Hobbies and sports: **Hobbies and sports**
  - A story you would share: **A story you would share**
  - Favourite book and film: **Favourite book**, **Favourite film**
  - How you sound
  - Your monthly income goal: **Your monthly income goal**
  - Can you market yourself openly?: **Can you market yourself openly?**
  - Business and contact: **Phone**, **Email**, **Time zone**, **Address**, **Address line 2**, **Town or city**, **Postcode**, **Country**, **Birthday**
  - Website and socials: **Website**
  - When you take calls: **Hours**
  - Anything else we should know: **Anything else we should know**

### Get Calls
- **Your Ideal Client** (`/coach/blueprint/market`)
  - Market options
  - Who they are: **Who they are**
  - What they are going through: **Less of**, **More of**
  - In their words: **What they say and think**, **Words to avoid**
  - What makes them act: **The moment they act**, **Objections**
  - Why you: **Why you**
  - Who goes on your list: **What their business does**, **How big**, **Where**, **Job titles**, **Leave out**
  - The walkthrough
  - Pain points
- **LinkedIn Profile** (`/coach/blueprint/linkedin`)
  - Your profile today: **LinkedIn**, **Headline**, **About**
  - Your profile
- **Lead lists** (`/coach/blueprint/lists`)
- **Campaigns** (`/coach/blueprint/campaigns`)
  - Connection campaign
  - Existing connections
  - Reactivation campaign
- **Content** (`/coach/blueprint/content`)
  - Newsletter: **How often**, **Name**, **Positioning**, **Who it's for**, **Call to action**
  - Posts
  - Newsletter
  - Cover
  - Inbox
  - Post
  - InMail
  - Article
  - Analogy
  - KPIs

### Win Clients
- **Your Offer** (`/coach/blueprint/offer`)
  - The destination: **They get more of**, **They get less of**
  - What you help with: **What you help with**, **First result they can point to**
  - Your method: **Name**, **The steps, in order**, **Where it came from**
  - How you deliver: **How you deliver**
  - Guarantee: **Guarantee**
  - Price and terms: **Price and terms**
  - The offer
  - Your offer in three lengths
  - Your bio
- **Personalised Pitch** (`/coach/blueprint/sales`)
  - Your personalised pitch
