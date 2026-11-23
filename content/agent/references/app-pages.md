# Every page a coach can open

Written from the app's code by `scripts/ava-app-map.ts`; do not edit by hand (run the script again). **Bold** = exactly what is on screen. Some pages need a membership or a connection first; if a coach can't see something, say so and point them to Support.

- For the buttons, boxes and what must be connected on one page, call `page_details` with its path. Do this before naming any button.
- To give a button to a page or tab, call `link_to_page` with `path` set to a path below.

## Pages
- **Classroom** `/coach/academy/classroom`: Academy → Classroom. Browse the training courses, see how far you are through each one, and open a lesson.
- **System** `/coach/academy/classroom/system`: Academy → Classroom → System (the lead flow map). See the whole path from prospect list to new client as one map, open any step to read how it works, and jump to the matching lesson.
- **Weekly Focus** `/coach/academy/classroom/weekly-focus`: Academy → Classroom → This Week’s Focus (opens the weekly focus page). Read this week’s focus and action, listen to the audio, and look back at past weeks.
- **Weekly Focus** `/coach/academy/classroom/weekly-focus/[weekId]`: Academy → Classroom → open a Weekly Focus week. Read this week's focus (or a past week), see the action to take, listen to the audio, and open the related learning path.
- **The Resource Library** `/coach/academy/resources`: Academy → Resources. Browse, search and open every guide, sheet, deck and template for winning clients, running sessions and using the Profit System.
- **One resource page** `/coach/academy/resources/[page]`: Academy → Resources, then open any resource page. Read one resource page and use its sheets, slides, files, videos and links, then move to the previous or next page.
- **Resources list** `/coach/academy/resources/list`: Academy → Resources, then the "The Resource Library" page, then the original link list at /coach/academy/resources/list. Browse or search the Academy's list of resource links and open any of them in a new tab.
- **Ava** `/coach/ava`: Not shown in the sidebar or section tabs in the names given; open the Ava page at /coach/ava. The coach opens the Ava page, the assistant's own page inside the app.
- **My Blueprint** `/coach/blueprint`: My Blueprint (sidebar). See where each page of your practice plan stands, finish your setup steps, and open any Blueprint page.
- **One Blueprint page** `/coach/blueprint/[slug]`: My Blueprint → pick a page from the Blueprint contents. The coach reads and fills in one page of their practice Blueprint on its own, such as Decisions or Lead lists.
- **Practice Blueprint (whole document)** `/coach/blueprint/blueprint`: My Blueprint → Blueprint. Read your whole Practice Blueprint as one long document, see what BCA still needs from you, and jump to any chapter or page.
- **BOSS Score** `/coach/boss-pro`: Keep Clients → BOSS Score. Pick a client or prospect, score them on the BOSS grid together, and read their insights, charts and priorities.
- **Calls** `/coach/calls`: Get Clients → Calls. See your booked sales calls on a calendar or in a list, add a call for a prospect, mark how each call went, and set up your booking calendars. Tabs: **Calendar** `/coach/calls`, **List** `/coach/calls?tab=list`, **Settings** `/coach/calls?tab=settings`.
- **Campaigns** `/coach/campaigns`: Get Clients → Campaigns. See how your outreach campaigns are doing, turn them on or off, create new ones, and manage the pool of people and your lead magnets. Tabs: **Pool** `/coach/campaigns?tab=pool`, **Campaigns** `/coach/campaigns`, **Lead Magnets** `/coach/campaigns?tab=magnets`.
- **One campaign** `/coach/campaigns/[id]`: Get Clients → Campaigns, then click a campaign. Set up, switch on and track one LinkedIn campaign: its steps, its people and how it is doing. Tabs: **Overview**, **Prospects**, **Steps**.
- **Pending connection requests** `/coach/campaigns/invites`: Get Clients → Campaigns, then the "← Campaigns" link leads back; this page is opened from the Campaigns page (Get Clients section). See your pending LinkedIn connection requests and withdraw the oldest ones, by hand or with Auto-clean.
- **One lead magnet** `/coach/campaigns/magnets/[magnetId]`: Get Clients → Campaigns → Lead Magnets → open a lead magnet (for example the BOSS Score). See who opted in, started and finished a lead magnet, share its link, and edit the follow-up messages sent afterwards. Tabs: **Overview**, **People**, **Sequences**.
- **Keep Clients** `/coach/clients`: Keep Clients in the sidebar (the Clients tab). See everyone you coach, add new clients, and edit price, join date and notes on each row.
- **Community** `/coach/community`: Academy → Community. Read posts, wins and questions from other coaches, write your own post, and filter the feed. Tabs: **Community** `/coach/community`, **Classroom**, **Calendar**, **Resources**.
- **One community post** `/coach/community/[postSlug]`: Academy → Community, then open a post from the feed. Coach opens a single community post from the Academy feed to read it.
- **Calendar** `/coach/community/calendar`: Academy → Calendar. See the community's live calls and events by month, week or list, open one for details, watch recordings and add calls to your own calendar. Tabs: **Upcoming**, **Previous calls**.
- **Members** `/coach/community/members`: Academy → Community → Members. Browse everyone in the Profit Coach community as a list or on a map, see who is online, and add your own location to the map. Tabs: **Members** `/coach/community/members`, **Online** `/coach/community/members?filter=online`, **Admins** `/coach/community/members?filter=admins`, **List** `/coach/community/members`, **Map** `/coach/community/members?view=map`.
- **Conversations** `/coach/conversations`: Get Clients → Conversations. Read and reply to your LinkedIn, WhatsApp, email and booked-call messages in one inbox, and start new conversations.
- **Income** `/coach/income`: Not in the sidebar or the Get Clients tabs. The page is at /coach/income, so a coach needs the direct link. Log money you have received and see it totalled by client and by month. Tabs: **Income entries**, **Client × month**.
- **Content** `/coach/linkedin`: Get Clients → Content. Write, schedule and publish your LinkedIn posts, and see how they perform. Tabs: **Compose** `/coach/linkedin?tab=compose`, **Queue** `/coach/linkedin?tab=queue`, **Calendar** `/coach/linkedin?tab=calendar`, **Newsletter** `/coach/linkedin?tab=newsletter`, **Library** `/coach/linkedin?tab=library`, **Insights** `/coach/linkedin?tab=insights`, **Settings** `/coach/linkedin?tab=settings`.
- **Membership** `/coach/membership`: Open /coach/membership. It has no sidebar item or tab, so reach it from a membership link or message (for example when asked to choose a level). See your membership level, compare Core, Premium and VIP, and join, switch or manage billing.
- **Playbooks** `/coach/playbooks`: Keep Clients → Playbooks. Browse the full library of playbooks grouped by area, and open one to see the client-facing overview to share with clients.
- **Prospects** `/coach/prospects`: Get Clients → Prospects. Add, import, sort and manage the people in your pipeline, and open any prospect to see their details or BOSS Score. Tabs: **Pipeline view**, **List view**.
- **One prospect** `/coach/prospects/[id]`: Get Clients → Prospects, then click a person (also opens from Conversations, Campaigns or the campaign Pool). See one prospect's details, message them, and track their activity, calls and private notes. Tabs: **Activity**, **Calls**, **Notes**.
- **Scoreboard** `/coach/scoreboard`: Get Clients → Scoreboard. Plan your numbers from first outreach to new clients against a monthly income target, and drag or type numbers to see what changes.
- **Scripts** `/coach/script`: Get Clients → Scripts. Browse every script for your conversations with owners, from first contact to the close, and open one to use it or practise in the Call simulator.
- **One script** `/coach/script/[script]`: Get Clients → Scripts → pick a script. Read one call script, part by part, filling in the gaps with the owner's details as you go.
- **Call simulator** `/coach/script/simulator`: Get Clients → Scripts → Call simulator. Practise a sales call out loud with an AI business owner, then get a score and a report.
- **Practice sales call report** `/coach/script/simulator/[id]`: Get Clients → Scripts → Call simulator, then open a finished practice call from the list. Look back at a practice sales call: your score, how it ended, what went well, what to try next time, and the recording.
- **Search** `/coach/search`: Open Search from the search box or shortcut in the app (not in the sidebar list). It opens at /coach/search. Search lessons, videos, community posts and members, or pick up from what you opened recently. Tabs: **Classroom** `/coach/search`, **Community** `/coach/search?tab=community`, **Members** `/coach/search?tab=members`.
- **Settings** `/coach/settings`: Click your profile or account settings (Settings page at /coach/settings). Not in the main sidebar list given, so reach it through your account menu. Edit your profile, connect your accounts, set up Ava's reply alerts, manage billing, and see your ladder. Tabs: **Profile** `/coach/settings?tab=profile`, **Billing** `/coach/settings?tab=billing`, **My Ladder** `/coach/settings?tab=ladder`.
- **Toolkit: Links** `/coach/share`: Get Clients → Toolkit (the Links tab). Copy your share links, or send one to a prospect, and make tagged links that show where people come from. Tabs: **Links** `/coach/share`, **Brochure**, **Social media posts**, **LinkedIn, email and calls**, **Print**, **Brand graphics**.
- **Client simulator** `/coach/simulator`: Keep Clients → Client simulator. Practise real coaching conversations out loud with an AI client, then get a score out of 50 and a report.
- **Simulator session report** `/coach/simulator/[id]`: Keep Clients → Client simulator → open a past session from Your sessions. Read the score and feedback for one practice call, listen back, talk it through with Ava, practise again or share it.
- **Support** `/coach/support`: Support (the Support page, opened from the app menu). Chat with Zander and Pam about the app or your coaching, or look up short answers in the Help centre. Tabs: **Chats** `/coach/support`, **Help** `/coach/support?tab=help`.
- **Toolkit** `/coach/toolkit`: Get Clients → Toolkit. Get your 90-day brochure and ready-made posts, banners and print files with your name, photo and QR code, then download or print them. Tabs: **Links**, **Brochure** `/coach/toolkit`, **Social media posts** `/coach/toolkit?view=social`, **LinkedIn, email and calls** `/coach/toolkit?view=linkedin`, **Print** `/coach/toolkit?view=print`, **Brand graphics** `/coach/toolkit?view=brand`.

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
  - How you deliver: **How you deliver**
  - Guarantee: **Guarantee**
  - Price and terms: **Price and terms**
  - The offer
  - Your offer in three lengths
  - Your bio
- **Personalised Pitch** (`/coach/blueprint/sales`)
  - Your personalised pitch
