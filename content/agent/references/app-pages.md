# Every page a coach can open

Written from the app's code by `scripts/ava-app-map.ts`; do not edit by hand (run the script again). **Bold** = exactly what is on screen. Some pages need a membership or a connection first; if a coach can't see something, say so and point them to Support.

- For the buttons, boxes and what must be connected on one page, call `page_details` with its path. Do this before naming any button.
- To give a button to a page or tab, call `link_to_page` with `path` set to a path below.

## Pages
- **Classroom** `/coach/academy/classroom`: Academy → Classroom. Browse the training courses, see how far you are through each one, and open a lesson.
- **System** `/coach/academy/classroom/system`: Academy → Classroom → System (open the Classroom page, then the System map). See the whole lead-to-client map in one picture, open the lesson behind each step, and try out the numbers you need for your own client target.
- **Weekly Focus** `/coach/academy/classroom/weekly-focus`: Academy → Classroom → Weekly Focus (the page opens from the Classroom). Read this week's focus and action, listen to the audio, and look back at earlier weeks.
- **Weekly Focus** `/coach/academy/classroom/weekly-focus/[weekId]`: Academy → Classroom → open a Weekly Focus week. Read one week's focus, its action, and any audio or lesson text, then jump to the related learning path or a past week.
- **Resource Library** `/coach/academy/resources`: Academy → Resources. Browse, search and open every guide, sheet, deck and template for winning clients, running sessions and using the Profit System.
- **One resource page** `/coach/academy/resources/[page]`: Academy → Resources → open any resource page. Read one resource page, then copy its sheets or slides, download its files, watch its videos, or print it as a PDF.
- **Resources list** `/coach/academy/resources/list`: Academy → Resources → ← The Resource Library link leads to the Resource Library; this list is the older link list page. Browse and search the Academy's resource links, grouped by area, and open any of them in a new tab. Tabs: **Area switch**.
- **Ava** `/coach/ava`: Not in the sidebar tabs listed; open the Ava page at /coach/ava (the Ava assistant page in the Profit Coach app). The coach opens the full Ava page to chat with Ava, the assistant.
- **My Blueprint** `/coach/blueprint`: My Blueprint in the sidebar. See your Blueprint overview: the setup checklist, every Blueprint page with its status and chat count, and open a page to work on it.
- **One Blueprint page** `/coach/blueprint/[slug]`: My Blueprint → pick a page from the contents list (or a link to a single page). Read one page of your practice plan on its own, with the same content as in the full Blueprint.
- **Full Blueprint** `/coach/blueprint/blueprint`: My Blueprint → Blueprint. Read your whole Practice Blueprint as one document, see what BCA still needs from you, and jump to any chapter or page.
- **BOSS Score** `/coach/boss-pro`: Keep Clients → BOSS Score. Pick a client or prospect (or add a new person) and score their business together on the BOSS grid, then read the charts and insights.
- **Calls** `/coach/calls`: Win Clients → Calls. See every booked sales call on a calendar or list, mark how each call went, add a call for a prospect, and set up your booking pages. Tabs: **Calendar view** `/coach/calls`, **List view** `/coach/calls?tab=list`, **Booking pages** `/coach/calls?tab=settings`.
- **Campaigns** `/coach/campaigns`: Get Calls → Campaigns. See all your LinkedIn, email and WhatsApp campaigns, turn them on or off, start new ones, and check what needs doing today.
- **One campaign** `/coach/campaigns/[id]`: Get Calls → Campaigns, then click a campaign. Run one outreach campaign: turn it on or off, add people, write the steps and see how it is doing. Tabs: **Overview**, **Prospects**, **Steps**.
- **Pending connection requests** `/coach/campaigns/invites`: Get Calls → Campaigns, then the ← Campaigns link's page opens the invites page (reached from the Campaigns tab; there is no tab of its own in the Get Calls row). Withdraw old pending LinkedIn connection requests by hand or turn on auto-clean so new invites keep going out.
- **One lead magnet** `/coach/campaigns/magnets/[magnetId]`: Get Calls → Lead Magnets → open a lead magnet (e.g. the BOSS Score). See who opted in, started and finished a lead magnet, share its link, and edit the follow-up emails sent after people take it. Tabs: **Overview**, **People**, **Sequences**.
- **Keep Clients** `/coach/clients`: Keep Clients in the sidebar (opens on the Clients tab). See everyone you coach with their price, join date and BOSS Score, add new clients, and edit their details.
- **Community** `/coach/community`: Academy → Community. Read and write posts, wins and questions with other coaches, filter the feed, and see the next live call. Tabs: **Community** `/coach/community`, **Classroom**, **Calendar**, **Resources**.
- **One community post** `/coach/community/[postSlug]`: Academy → Community, then open a post from the feed. Read one community post opened from the Academy community feed.
- **Calendar** `/coach/community/calendar`: Academy → Calendar. See upcoming and past community events and calls in a month, week or list view, open one for details, and watch recordings. Tabs: **Upcoming**, **Previous calls**.
- **Members** `/coach/community/members`: Academy → Community → Members. Browse everyone in the Profit Coach community as a list or on a map, see who is online, and add your own location to the map. Tabs: **Members** `/coach/community/members`, **Online** `/coach/community/members?filter=online`, **Admins** `/coach/community/members?filter=admins`, **List** `/coach/community/members`, **Map** `/coach/community/members?view=map`.
- **Conversations** `/coach/conversations`: Get Calls → Conversations. Read and reply to your LinkedIn, WhatsApp and email messages in one inbox.
- **Income** `/coach/income`: This page is not in the sidebar or the section tabs, and the code shows no link to it. A coach opens it by going to the /coach/income address directly. Log the money you receive and see your totals by client and month. Tabs: **Income entries**, **Client × month**.
- **Content** `/coach/linkedin`: Get Calls → Content. Write, schedule and publish your LinkedIn posts, and see how they land. Tabs: **Compose** `/coach/linkedin?tab=compose`, **Queue** `/coach/linkedin?tab=queue`, **Calendar** `/coach/linkedin?tab=calendar`, **Library** `/coach/linkedin?tab=library`, **Insights** `/coach/linkedin?tab=insights`, **Settings** `/coach/linkedin?tab=settings`.
- **Membership** `/coach/membership`: There is no sidebar item for it. Coaches open it from the membership link or button they are sent (the page is /coach/membership). See your membership level and billing status, compare Core, Premium and VIP, and join or switch a level.
- **Newsletter** `/coach/newsletters`: Get Calls → Newsletter. Write, edit and organise your newsletter issues, and read the ones already published on LinkedIn.
- **Playbooks** `/coach/playbooks`: Keep Clients → Playbooks. Browse ready-made guides to share with your clients, each with your link added for you.
- **Pipeline** `/coach/prospects`: Win Clients → Pipeline. See everyone you are talking to and where they are up to, add or import prospects, and open one to follow up. Tabs: **Pipeline view**, **List view**.
- **One prospect** `/coach/prospects/[id]`: Win Clients → Pipeline, then click a person (also opens from Get Calls → Campaigns, Prospects or Conversations). See one prospect's conversation, details, activity, calls and notes in one place, and message them or book a call. Tabs: **Activity**, **Calls**, **Notes**.
- **Scoreboard** `/coach/scoreboard`: Win Clients → Scoreboard. Set an income target and see how many messages, calls and clients it takes, then try what-if numbers by typing or dragging.
- **Scripts** `/coach/script`: Win Clients → Scripts. Browse every script for your talks with owners, in call order, and open one to use it.
- **One script** `/coach/script/[script]`: Win Clients → Scripts → pick a script. Read one sales-call script part by part, fill in the gaps with the prospect's details, and copy ready-made messages.
- **Call Practice** `/coach/script/simulator`: Win Clients → Call Practice. Practise a sales call out loud with an AI business owner, then get a score and a report.
- **Call practice report** `/coach/script/simulator/[id]`: Win Clients → Call Practice, then open a past practice call from the list (or finish a practice call and it opens here). See the score and feedback for one practice sales call, play it back, and practise again.
- **Search** `/coach/search`: Search box at the top of the coach app (Esc takes you back to the page you came from), or open the Search page directly. Search the Academy for lessons, videos, resources, community posts and members, and reopen things you looked at recently. Tabs: **Classroom** `/coach/search`, **Community** `/coach/search?tab=community`, **Members** `/coach/search?tab=members`.
- **Settings** `/coach/settings`: Click your profile or account area, then Settings (the page at /coach/settings). Update your profile, connect your accounts, manage billing and see your ladder. Tabs: **Profile** `/coach/settings?tab=profile`, **Billing** `/coach/settings?tab=billing`, **My Ladder** `/coach/settings?tab=ladder`.
- **Links** `/coach/share`: Get Calls → Toolkit → Links. Copy or send your BOSS Score, booking and profile links, tag them to see where people come from, and edit your public pages. Tabs: **Links** `/coach/share`, **Brochure**, **Social media posts**, **LinkedIn, email and calls**, **Print**, **Brand graphics**.
- **Client Simulator** `/coach/simulator`: Keep Clients → Client Simulator. Practise a hard client conversation out loud with an AI client, then get a score out of 50 and a report.
- **Session report** `/coach/simulator/[id]`: Keep Clients → Client Simulator → open a past session from "Your sessions" (or finish a practice call). See the score and report for one Client Simulator practice call, listen back, and choose what to do next.
- **Support** `/coach/support`: Support (opens from the app's support link; the page is /coach/support). Chat with Zander and Pam, and read the Help answers, to get help with the app or your coaching. Tabs: **Chats** `/coach/support`, **Help** `/coach/support?tab=help`.
- **Toolkit** `/coach/toolkit`: Get Calls → Toolkit. Get your 90-day brochure, social posts, banners and print files with your name, photo and QR code, ready to download or print. Tabs: **Links**, **Brochure** `/coach/toolkit`, **Social media posts** `/coach/toolkit?view=social`, **LinkedIn, email and calls** `/coach/toolkit?view=linkedin`, **Print** `/coach/toolkit?view=print`, **Brand graphics** `/coach/toolkit?view=brand`.

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
- **Prospect lists** (`/coach/blueprint/lists`)
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
