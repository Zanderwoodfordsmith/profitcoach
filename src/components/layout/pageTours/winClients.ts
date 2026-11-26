import type { PageTourStep } from "./types";

export const WIN_CLIENTS_TOURS: Record<string, PageTourStep[]> = {
  "win-clients/Calls": [
    {
      selector: '[data-tour="calls-calendar"]',
      title: "Every sales call in one calendar",
      body: "When an owner books a call with you, it lands here by itself. You see your whole week at a glance, so nothing catches you out.",
    },
    {
      selector: '[aria-label="Calendar range"]',
      title: "Day, week or month",
      body: "Switch how much you see at once. The arrows beside it move back and forward, and Today brings you home.",
    },
    {
      selector: '[aria-label="Calendar key"]',
      title: "Colours tell you how it went",
      body: "Each call takes the colour of its status: confirmed, completed, no-show or cancelled. Grey blocks come from your own calendar.",
    },
    {
      selector: '[data-tour="calls-event"]',
      title: "Open a call",
      body: "Tap a call to see who it's with, the join link, and the recording when there is one. Mark it completed or no-show after, so your numbers stay true.",
      fallback: '[data-tour="calls-calendar"]',
      fallbackBody: "When a call is booked, it shows here. Tap it to see who it's with, the join link and the recording. Mark it completed or no-show after, so your numbers stay true.",
    },
    {
      selector: '[data-tour="calls-filter"]',
      title: "Pick which calendars show",
      body: "Choose which booking calendars you see, and whether to show calls, busy times from your own calendar, or both.",
    },
    {
      selector: '[aria-label="Calls view"]',
      title: "Calendar or list",
      body: "Prefer a list? Switch here to see every call in rows you can search, filter and sort.",
    },
    {
      selector: '[data-tour="calls-add"]',
      title: "Add a call yourself",
      body: "Booked someone on the phone or in a chat? Pick them from your list and add the call here, so it sits with the rest.",
    },
    {
      selector: '[data-tour="calls-settings"]',
      title: "Set up your booking pages",
      body: "Booking pages holds the pages owners use to pick a time. Open one to change its words. Connect your Google or Outlook calendar here too, so they can only book when you're free.",
    },
  ],
  "win-clients/Pipeline": [
    {
      selector: '[data-tour="pipeline-board"]',
      title: "Everyone you're talking to",
      body: "Your pipeline shows every owner you're in touch with and where they're up to. Look here to see who to follow up next.",
    },
    {
      selector: '[data-tour="pipeline-column"]',
      title: "One column for each stage",
      body: "Owners move left to right, from first contact to replied, interested, booked, follow-up and closed. Drag a card to move it on.",
    },
    {
      selector: '[data-tour="pipeline-card"]',
      title: "One card for each owner",
      body: "Tap a card to open their page, with their BOSS Score, calls, notes and next step. The menu on the card has quick actions.",
      fallback: '[data-tour="pipeline-board"]',
      fallbackBody: "Each owner shows as a card in their stage. Tap one to open their page, with their BOSS Score, calls, notes and next step.",
    },
    {
      selector: '[data-tour="pipeline-filter"]',
      title: "Find the right people",
      body: "Search by name, then filter by stage, tag, whether they've taken their BOSS Score, or who has a call coming up.",
    },
    {
      selector: '[aria-label="Prospects view"]',
      title: "Board or list",
      body: "Switch to the list to see everyone in rows. There you can pick the columns and save views you use often.",
    },
    {
      selector: '[data-tour="pipeline-import"]',
      title: "Bring in a list",
      body: "Got owners in a spreadsheet? Import the file and they land in your pipeline, so you can work them from here.",
    },
    {
      selector: '[data-tour="pipeline-add"]',
      title: "Add an owner",
      body: "Met someone new? Add their name, email and business. You can copy your BOSS Score link to send them straight after.",
    },
  ],
  "win-clients/Scripts": [
    {
      selector: '[data-tour="scripts-list"]',
      title: "Every script, in call order",
      body: "One card for each talk you have with an owner, from the first message to the close. Use words that already work instead of making them up.",
    },
    {
      selector: '[data-tour="script-reach-out"]',
      title: "Reach out",
      body: "Cold call, email and LinkedIn scripts for owners who don't know you yet. Each one aims to book a BOSS Score Review.",
    },
    {
      selector: '[data-tour="script-new-lead"]',
      title: "New lead call",
      body: "Someone took your BOSS Score or got in touch. Call them fast, find out what they want, and book the review.",
    },
    {
      selector: '[data-tour="script-objections"]',
      title: "When they push back",
      body: "What to say when an owner says they're too busy, or asks you to send something first. Open it before a call so the words are ready.",
    },
    {
      selector: '[data-tour="script-review"]',
      title: "Call 1: the BOSS Score Review",
      body: "Thirty minutes of real help. Go through their score, find the one thing holding them back, and book the next call.",
    },
    {
      selector: '[data-tour="script-roadmap"]',
      title: "Call 2: the Profit Roadmap call",
      body: "The call where they decide. It walks you through the plan, the price and the close, with a place to take notes as you talk.",
    },
    {
      selector: '[data-tour="script-no-shows"]',
      title: "No-shows and reschedules",
      body: "When someone misses a call or asks to move it. Get a real new time without chasing.",
    },
    {
      selector: '[data-tour="scripts-call-sim"]',
      title: "Practise out loud",
      body: "Try these calls with AI owners before you do them for real. You get a score and notes on every line.",
    },
  ],
  "win-clients/Call Practice": [
    {
      selector: '[aria-label="Clients"]',
      title: "Pick an owner",
      body: "Six AI owners, each with their own business and way of talking. Tap a face or use the arrows to choose who you call.",
    },
    {
      selector: '[data-tour="callsim-brief"]',
      title: "Know the call before you start",
      body: "Who they are, why you're talking, and any notes from earlier calls. Read it first, like you would before a real call.",
    },
    {
      selector: '[data-tour="callsim-call"]',
      title: "Choose what to practise",
      body: "Pick the call: a cold call, a new lead, the review, the close, or a no-show. Each one follows the matching script.",
    },
    {
      selector: '[aria-label="Start at"]',
      title: "Start part way in",
      body: "Want to work on one bit? Jump straight to it, like the money moment or the close, instead of running the whole call.",
      fallback: '[data-tour="callsim-call"]',
      fallbackBody: "Some calls let you start part way in, so you can work on one bit, like the close, without running the whole call.",
    },
    {
      selector: '[aria-label="Level"]',
      title: "Set how hard it is",
      body: "Easy owners are friendly. Hard ones push back more. Start easy and step up as your scores grow.",
    },
    {
      selector: '[data-tour="callsim-start"]',
      title: "Start the call",
      body: "Press Start and talk out loud, as if it's real. It uses your microphone and your monthly practice minutes.",
    },
    {
      selector: '[data-tour="callsim-surprise"]',
      title: "Surprise me",
      body: "Can't choose? This picks an owner, a call and a level for you, based on how your recent calls went.",
    },
    {
      selector: '[data-tour="callsim-history"]',
      title: "Your practice calls",
      body: "Every call you finish shows here with a score, how it ended and a report with notes on your lines. Watch your scores climb.",
    },
  ],
  "win-clients/Scoreboard": [
    {
      selector: '[aria-label="Income a month, against your targets"]',
      title: "What your numbers earn",
      body: "This is the income a month your numbers lead to, and how many clients that is. The bar shows how close you are to each target.",
    },
    {
      selector: '[aria-label="Income targets a month to compare"]',
      title: "Pick your targets",
      body: "Tick the monthly incomes you want to measure against. They show as lines on the bar above and in the table below.",
    },
    {
      selector: '[aria-label="Starting numbers"]',
      title: "Good or Great",
      body: "Good is a solid target for each step. Great is what the new scripts aim for. Switch to see what Great would earn you.",
    },
    {
      selector: '[data-tour="scoreboard-step"]',
      title: "Each step to a client",
      body: "Every row is one step, from first message to signed client. Tap the step name to see why it matters.",
    },
    {
      selector: '[data-tour="scoreboard-now"]',
      title: "Type your real numbers",
      body: "Put in what you actually get today. The status beside it turns red, yellow or green, so you see where you stand.",
    },
    {
      selector: '[data-tour="scoreboard-slider"]',
      title: "Try a what if",
      body: "Drag the dot to see what changes if you get better at this one step. The income at the top moves as you drag.",
    },
    {
      selector: '[aria-label="Order"]',
      title: "Find your biggest gap",
      body: "Biggest gap puts the step that costs you the most at the top. Fix that one first.",
    },
    {
      selector: '[data-tour="scoreboard-add-source"]',
      title: "Add where else leads come from",
      body: "Get leads from referrals, an accountant or events? Add each one, so your numbers show every way owners find you.",
    },
  ],
};
