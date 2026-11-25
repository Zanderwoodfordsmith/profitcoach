# Every page a coach can open

Written from the app's code by `scripts/ava-app-map.ts`; do not edit by hand (run the script again). **Bold** = exactly what is on screen. Some pages need a membership or a connection first; if a coach can't see something, say so and point them to Support.

- For the buttons, boxes and what must be connected on one page, call `page_details` with its path. Do this before naming any button.
- To give a button to a page or tab, call `link_to_page` with `path` set to a path below.

## Pages
- **Classroom** `/coach/academy/classroom`: Academy → Classroom. Browse the training courses, see how far you are through each one, and open a lesson.
- **System** `/coach/academy/classroom/system`: Academy → Classroom → System (the lead-flow map; open Academy in the sidebar, go to Classroom, then choose the system map). See the whole path from finding ideal clients to keeping them as a map, hover or click any step to read about it, and open the matching lesson.
- **Weekly Focus** `/coach/academy/classroom/weekly-focus`: Academy → Classroom → This Week's Focus. Read this week's focus and action, listen to the audio, and look back at past weeks.
- **Weekly Focus** `/coach/academy/classroom/weekly-focus/[weekId]`: Academy → Classroom → open a Weekly Focus week. Read one week's focus, its action, and any audio or lesson text, then jump to the related learning path or go back to earlier weeks.
- **The Resource Library** `/coach/academy/resources`: Academy → Resources. Browse, search and open every guide, sheet, deck and template for winning clients, running sessions and using the Profit System.
- **Resource page** `/coach/academy/resources/[page]`: Academy → Resources → open any resource. Read one resource from the library, and copy, download or open its sheets, slides and files.
- **Resource list** `/coach/academy/resources/list`: Academy → Resources → ← The Resource Library link leads to the Resource Library; this older list page is reached from there. Browse or search the original list of Academy resource links, grouped by area, and open any of them in a new tab. Tabs: **Area switch (buttons at the top; names come from the app and are not shown in the page code)**.
- **Ava** `/coach/ava`: Not in the sidebar lists given; the page opens at /coach/ava (Ava is the assistant inside the app). The coach opens the full Ava page to chat with Ava, the app's AI assistant.
- **My Blueprint** `/coach/blueprint`: My Blueprint (sidebar). See your Blueprint overview: a setup checklist, every Blueprint page with its status, and what is waiting on you. Tabs: **List**, **Board**.
- **One Blueprint page** `/coach/blueprint/[slug]`: My Blueprint → pick a page from the contents list. Read one page of your practice plan on its own, with the same content as the full Blueprint.
- **Blueprint (whole document)** `/coach/blueprint/blueprint`: My Blueprint → Blueprint. Read your whole Practice Blueprint as one long document, see what BCA still needs from you, and jump to any chapter or page.
- **BOSS Score** `/coach/boss-pro`: Keep Clients → BOSS Score. Pick a client or prospect, or add someone new, and score their business together on the BOSS grid to see their results, charts and insights.
- **Calls** `/coach/calls`: Win Clients → Calls. See your booked sales calls in a calendar or list, mark how each call went, add a call for a prospect, and set up your booking calendars. Tabs: **Calendar** `/coach/calls`, **List** `/coach/calls?tab=list`, **Settings** `/coach/calls?tab=settings`.
- **Campaigns** `/coach/campaigns`: Get Calls → Campaigns. See how your outreach campaigns are doing, turn them on or off, and create new ones.
- **One campaign** `/coach/campaigns/[id]`: Get Calls → Campaigns, then click a campaign. Set up, run and watch one LinkedIn campaign: turn it on or off, add people, write the steps and see how it is doing. Tabs: **Overview**, **Prospects**, **Steps**.
- **Pending connection requests** `/coach/campaigns/invites`: Get Calls → Campaigns, then the "← Campaigns" link leads back; open this page from the Campaigns page. See your pending LinkedIn connection requests and withdraw the oldest ones by hand or turn on automatic clean-up.
- **One lead magnet** `/coach/campaigns/magnets/[magnetId]`: Get Calls → Lead Magnets → open a lead magnet (for example the BOSS Score). See who opted in, started and finished a lead magnet, share its link, and edit the follow-up messages sent to them. Tabs: **Overview**, **People**, **Sequences**.
- **Keep Clients** `/coach/clients`: Keep Clients in the sidebar (opens on the Clients tab). See everyone you coach in one list, add new clients, and edit their price, join date and details.
- **Community** `/coach/community`: Academy → Community. Read posts from other coaches, share wins and questions, and write your own posts. Tabs: **Community** `/coach/community`, **Classroom**, **Calendar**, **Resources**.
- **One community post** `/coach/community/[postSlug]`: Academy → Community, then open a post from the feed. A coach reads a single community post from the feed, which is shown by the Community page itself.
- **Calendar** `/coach/community/calendar`: Academy → Calendar. See the community's live calls and events by month, week or list, watch recordings, and add them to your own calendar. Tabs: **Upcoming**, **Previous calls**.
- **Members** `/coach/community/members`: Academy → Members (the Members count in the right-hand Community box also opens it). Browse everyone in the Profit Coach community as a list or on a map, filter by online or admins, sort, and add your own location and map pin.
- **Conversations** `/coach/conversations`: Get Calls → Conversations. Read and reply to your LinkedIn, WhatsApp, email and booked-call messages in one inbox.
- **Income** `/coach/income`: This page has no item in the sidebar or the section tabs. The code gives no link to it, so Ava should not guess a menu route; the page address is /coach/income. Log money you have received and see it totalled by client and by month. Tabs: **Income entries**, **Client × month**.
- **Content** `/coach/linkedin`: Get Calls → Content. Write, schedule and publish LinkedIn posts, and see how your posts are doing. Tabs: **Compose** `/coach/linkedin?tab=compose`, **Queue** `/coach/linkedin?tab=queue`, **Calendar** `/coach/linkedin?tab=calendar`, **Library** `/coach/linkedin?tab=library`, **Insights** `/coach/linkedin?tab=insights`, **Settings** `/coach/linkedin?tab=settings`.
- **Membership** `/coach/membership`: Not in the sidebar. Open it from the membership link or the /coach/membership page. See your membership level and billing status, compare Core, Premium and VIP, and join or switch a level.
- **Newsletter** `/coach/newsletters`: Get Calls → Newsletter. Write, edit and track your newsletter issues, with drafts, scheduled and published issues in a list on the left.
- **Playbooks** `/coach/playbooks`: Keep Clients → Playbooks. Browse the full library of playbooks and open one to see the client-facing overview you can share.
- **Pipeline** `/coach/prospects`: Win Clients → Pipeline. See everyone you are talking to as a pipeline board or a list, add or import prospects, and open one to work with them. Tabs: **Pipeline view**, **List view**.
- **One prospect** `/coach/prospects/[id]`: Win Clients → Pipeline, then click a person (also opens from Get Calls → Conversations, Campaigns or Lead Lists). See one prospect's messages, details, activity, calls and private notes in one place, and message them or book a call. Tabs: **Activity**, **Calls**, **Notes**.
- **Scoreboard** `/coach/scoreboard`: Win Clients → Scoreboard. Plan your numbers from first outreach to new clients against a monthly income target, and drag or type numbers to see what changes.
- **Scripts** `/coach/script`: Win Clients → Scripts. Browse every script for your conversations with owners, from first contact to the close, and open one to use it.
- **One script** `/coach/script/[script]`: Win Clients → Scripts → pick a script. Read one call script part by part, filling in the gaps with your prospect's details; the Profit Roadmap script opens the live call screen.
- **Call Practice** `/coach/script/simulator`: Win Clients → Call Practice. Practise a sales call out loud with an AI business owner, pick the call, where to start and the level, then get a score and a report.
- **Call report** `/coach/script/simulator/[id]`: Win Clients → Call Practice → open one of your finished practice calls. See the score and feedback for one practice sales call, listen back to the recording, and practise again.
- **Search** `/coach/search`: Search box at the top of the app, or open Search directly (/coach/search). Search lessons, videos, community posts and people, or jump back to things you opened recently. Tabs: **Classroom** `/coach/search`, **Community** `/coach/search?tab=community`, **Members** `/coach/search?tab=members`.
- **Settings** `/coach/settings`: Click your profile or account area, then Settings (page at /coach/settings). Not one of the main sidebar items. Coach edits their profile, connects email, calendar and social accounts, sets how Ava alerts them about replies, and manages billing and their ladder. Tabs: **Profile** `/coach/settings?tab=profile`, **Billing** `/coach/settings?tab=billing`, **My Ladder** `/coach/settings?tab=ladder`.
- **Toolkit: Links** `/coach/share`: Get Calls → Toolkit (the Links tab). Copy or send your public links: scorecards, booking pages, reports, social profiles and your own links. Tabs: **Links** `/coach/share`, **Brochure**, **Social media posts**, **LinkedIn, email and calls**, **Print**, **Brand graphics**.
- **Client Simulator** `/coach/simulator`: Keep Clients → Client Simulator. Practise real coaching conversations out loud with an AI client, then get a score out of 50 and a report.
- **Session report** `/coach/simulator/[id]`: Keep Clients → Client Simulator → open a past session from Your sessions (or finish a practice call). See the score and report for one practice session with an AI client, listen back to the call, and decide what to do next.
- **Support** `/coach/support`: Support (in the app menu) → Chats tab. Open Help with the Help tab. Chat with Zander and Pam, or search the Help centre for short answers. Tabs: **Chats** `/coach/support`, **Help** `/coach/support?tab=help`.
- **Toolkit** `/coach/toolkit`: Get Calls → Toolkit. Print or download your 90-day brochure, social posts, banners, print files and brand graphics with your name and QR code. Tabs: **Links**, **Brochure** `/coach/toolkit`, **Social media posts** `/coach/toolkit?view=social`, **LinkedIn, email and calls** `/coach/toolkit?view=linkedin`, **Print** `/coach/toolkit?view=print`, **Brand graphics** `/coach/toolkit?view=brand`.

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
