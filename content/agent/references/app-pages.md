# Every page a coach can open

Written from the app's code by `scripts/ava-app-map.ts`; do not edit by hand (run the script again). **Bold** = exactly what is on screen. Some pages need a membership or a connection first; if a coach can't see something, say so and point them to Support.

- For the buttons, boxes and what must be connected on one page, call `page_details` with its path. Do this before naming any button.
- To give a button to a page or tab, call `link_to_page` with `path` set to a path below.

## Pages
- **Classroom** `/coach/academy/classroom`: Academy → Classroom. Browse the training courses, open one to start learning, and see how far you have got in each.
- **System** `/coach/academy/classroom/system`: Academy → Classroom → System (or open the Classroom and choose the lead flow map). See the whole path from finding ideal clients to keeping them as one map, and open the lesson behind each step.
- **Weekly Focus** `/coach/academy/classroom/weekly-focus`: Academy → Classroom → This Week's Focus (open from the Classroom page; the Classroom link at the top of this page takes you back). Read this week's focus and action, listen to the audio or read the lesson, and look back at earlier weeks.
- **Weekly focus** `/coach/academy/classroom/weekly-focus/[weekId]`: Academy → Classroom → open a weekly focus (this week's or a past week). Read one week's focus, do its action, listen to the audio, and jump into the related learning path.
- **The Resource Library** `/coach/academy/resources`: Academy → Resources. Browse, search and open every guide, sheet, deck and template for winning clients, running sessions and using the Profit System.
- **One resource page** `/coach/academy/resources/[page]`: Academy → Resources → pick a page. Read one resource page (a guide, sheet, slide deck, file, video or reading list) and copy, download or open what it links to.
- **Resources (link list)** `/coach/academy/resources/list`: Academy → Resources → ← The Resource Library link leads back; this list is the original link version of the Resources page. Browse or search the Academy's resource links and open any of them in a new tab. Tabs: **Coach delivery**, **Profit system**.
- **Ava** `/coach/ava`: Not shown in the sidebar or section tabs given; open the Ava page at /coach/ava. This is the full-page home of Ava, the AI assistant, where a coach can ask for help finding things in the app.
- **My Blueprint** `/coach/blueprint`: My Blueprint in the sidebar (coach tools). See your setup checklist and every Blueprint page with its status, then open a page to answer questions, review work and chat with BCA.
- **One Blueprint page** `/coach/blueprint/[slug]`: My Blueprint → pick a page from the Blueprint contents (or a link in the Blueprint menu). Read and fill in one page of your practice plan, answering your boxes and checking what BCA has written for you.
- **Practice Blueprint (whole document)** `/coach/blueprint/blueprint`: My Blueprint (under Coach tools), then the whole-document view at /coach/blueprint/blueprint. Read your whole Practice Blueprint as one long document, fill in your answers, and check what BCA has written.
- **BOSS Score** `/coach/boss-pro`: Keep Clients → BOSS Score. Pick a client or prospect (or add a new person), score them on the BOSS grid together, and see their charts, insights and priorities.
- **Calls** `/coach/calls`: Get Clients → Calls. See your booked sales calls in a calendar or list, add a call for a prospect, and set up your booking calendars. Tabs: **Calendar** `/coach/calls`, **List** `/coach/calls?tab=list`, **Settings** `/coach/calls?tab=settings`.
- **Campaigns** `/coach/campaigns`: Get Clients → Campaigns. See how your outreach campaigns are doing, turn them on or off, and create new ones. Tabs: **Pool** `/coach/campaigns?tab=pool`, **Campaigns** `/coach/campaigns`, **Lead Magnets** `/coach/campaigns?tab=magnets`.
- **One campaign** `/coach/campaigns/[id]`: Get Clients → Campaigns, then click a campaign. Set up, switch on and track one LinkedIn campaign: add people, write the steps and watch the results. Tabs: **Overview**, **Prospects**, **Steps**.
- **Pending connection requests** `/coach/campaigns/invites`: Get Clients → Campaigns, then the "← Campaigns" link leads back; this page is opened from the Campaigns area. See your pending LinkedIn connection requests and withdraw the oldest ones, by hand or with Auto-clean.
- **One lead magnet** `/coach/campaigns/magnets/[magnetId]`: Get Clients → Campaigns → Lead Magnets → open a lead magnet (for example Boss Score). See who opted in, started and finished one lead magnet, share its link, and edit the follow-up messages sent to those people. Tabs: **Overview**, **People**, **Sequences**.
- **Keep Clients** `/coach/clients`: Keep Clients in the sidebar (opens the Clients tab). See everyone you coach in one list, add new clients, and edit their price, join date and details.
- **Community** `/coach/community`: Academy → Community. Read the feed of posts, wins and questions from other coaches, write your own post, and open a post to comment or like it. Tabs: **Community** `/coach/community`, **Classroom**, **Calendar**, **Resources**.
- **One community post** `/coach/community/[postSlug]`: Academy → Community, then click a post in the feed. The coach reads one community post and its discussion in the Community feed.
- **Calendar** `/coach/community/calendar`: Academy → Calendar. See the community's live calls and events in a month, week or list view, open an event for details or its recording, and add the calls to your own calendar. Tabs: **Upcoming**, **Previous calls**.
- **Members** `/coach/community/members`: Academy → Community → Members. Browse the other coaches and Profit Coach team in the community, see who is online, and switch to a map to add your own location.
- **Conversations** `/coach/conversations`: Get Clients → Conversations. Read and reply to your LinkedIn, WhatsApp, email and booked-call messages in one inbox.
- **Income** `/coach/income`: Not in the sidebar or tab rows given; the page is at /coach/income, so there is no confirmed menu path. Only guide coaches to it by that address. Log money you have received and see it totalled by client and month. Tabs: **Income entries**, **Client × month**.
- **Content** `/coach/linkedin`: Get Clients → Content. Write, schedule and publish LinkedIn posts, and see how your posts and newsletter issues are doing. Tabs: **Compose** `/coach/linkedin?tab=compose`, **Queue** `/coach/linkedin?tab=queue`, **Calendar** `/coach/linkedin?tab=calendar`, **Newsletter** `/coach/linkedin?tab=newsletter`, **Library** `/coach/linkedin?tab=library`, **Insights** `/coach/linkedin?tab=insights`, **Settings** `/coach/linkedin?tab=settings`.
- **Membership** `/coach/membership`: Open the Membership page (/coach/membership). The sidebar names provided do not list a direct Membership link, so coaches may reach it from a link or button elsewhere in the app. See your Profit Coach membership level, compare Core, Premium and VIP, and join, switch or manage billing.
- **Playbooks** `/coach/playbooks`: Keep Clients → Playbooks. Browse the full library of playbooks and open one to see the client-facing overview you can share with your coach link added. Tabs: **Clients**, **BOSS Score**, **Playbooks** `/coach/playbooks`, **Profit levers**, **Client simulator**.
- **Prospects** `/coach/prospects`: Get Clients → Prospects. See, add, import and manage your prospects as a pipeline board or a list, and share your assessment link.
- **One prospect** `/coach/prospects/[id]`: Get Clients → Prospects, then click a prospect's name (also opens from Conversations, Campaigns or the Pool). See one prospect's details, messages, activity, calls and notes, and reply to them. Tabs: **Activity**, **Calls**, **Notes**.
- **Scoreboard** `/coach/scoreboard`: Get Clients → Scoreboard. Plan your monthly numbers, from outreach to new clients, against an income target and drag any number to see what changes.
- **Scripts** `/coach/script`: Get Clients → Scripts. Browse every script for your conversations with owners, from first contact to the close, and open one to use it.
- **One script** `/coach/script/[script]`: Get Clients → Scripts → pick a script. Read one sales-call script, part by part, and fill in the blanks with your prospect's details; the Profit Roadmap script opens a live call screen with notes.
- **Call simulator** `/coach/script/simulator`: Get Clients → Scripts → Call simulator. Practise a sales call out loud with an AI business owner, then get a score and a report.
- **Call simulator report** `/coach/script/simulator/[id]`: Get Clients → Scripts → Call simulator → open a finished practice call. Read the score and feedback for one practice sales call, listen back to it, and choose to practise again.
- **Search** `/coach/search`: Open Search from the search box or icon at the top of the app (it is not in the Get Clients tabs); it opens at /coach/search. Search lessons, videos, community posts and members, or reopen things you looked at recently. Tabs: **Classroom**, **Community** `/coach/search?tab=community`, **Members** `/coach/search?tab=members`.
- **Settings** `/coach/settings`: Click your profile or account menu → Settings (opens /coach/settings). Update your profile, connect your email, calendar and social accounts, set how Ava alerts you, and manage billing and your ladder. Tabs: **Profile** `/coach/settings?tab=profile`, **Billing** `/coach/settings?tab=billing`, **My Ladder** `/coach/settings?tab=ladder`.
- **Toolkit: Links** `/coach/share`: Get Clients → Toolkit → Links. Copy or send your scorecard, booking, report, profile and custom links, and make tagged links that show where people came from. Tabs: **Links** `/coach/share`, **Brochure**, **Social media posts**, **LinkedIn, email and calls**, **Print**, **Brand graphics**.
- **Client simulator** `/coach/simulator`: Keep Clients → Client simulator. Practise a real client conversation out loud with an AI client, then get a score out of 50 and a report.
- **Session report** `/coach/simulator/[id]`: Keep Clients → Client simulator → open one of your sessions under Your sessions. Read the score and feedback for one practice call with an AI client, then talk it through with Ava, practise again, share it or replay a missed moment.
- **Support** `/coach/support`: Support (in the app menu). Chat with Zander and Pam at BCA: start a new chat, read replies, and mark chats done.
- **Toolkit** `/coach/toolkit`: Get Clients → Toolkit. Download your 90-day programme brochure, social posts, banners, print files and brand graphics with your name, photo and QR code. Tabs: **Links**, **Brochure** `/coach/toolkit`, **Social media posts** `/coach/toolkit?view=social`, **LinkedIn, email and calls** `/coach/toolkit?view=linkedin`, **Print** `/coach/toolkit?view=print`, **Brand graphics** `/coach/toolkit?view=brand`.

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
