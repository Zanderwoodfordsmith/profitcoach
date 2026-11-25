import type { PageTourStep } from "./types";

export const KEEP_CLIENTS_TOURS: Record<string, PageTourStep[]> = {
  "keep-clients/Clients": [
    {
      selector: '[data-tour="clients-summary"]',
      title: "Your practice at a glance",
      body: "How many clients you have, what they pay you a month in total, and how long they stay on average.",
    },
    {
      selector: '[data-tour="clients-table"]',
      title: "Everyone you coach",
      body: "One row for each client, with their business, when they joined, how long they've been with you and what they pay.",
      fallback: '[data-tour="clients-add-form"]',
      fallbackBody: "When you add clients, they show here in one list, with their business, when they joined and what they pay.",
    },
    {
      selector: '[data-tour="clients-row"]',
      title: "Open a client to edit",
      body: "Tap a row to fill in their details: price, problem notes, sector, how they found you and the result you got them.",
      fallback: '[data-tour="clients-add-form"]',
      fallbackBody: "Once a client is in your list, tap their row to fill in their price, notes, sector and the result you got them.",
    },
    {
      selector: '[data-tour="clients-boss"]',
      title: "Their BOSS Score",
      body: "Tap the score to open their BOSS Score page. If it says Run, they haven't taken it yet, so tap to start one.",
      fallback: '[data-tour="clients-add-form"]',
      fallbackBody: "Each client gets a BOSS Score. When they're in your list, tap their score to open it, or Run to start one.",
    },
    {
      selector: '[data-tour="clients-best"]',
      title: "Who your best clients are",
      body: "Fill in sector, turnover, team size and how they found you. This shows which kind of owner does best with you, so you can find more like them.",
    },
    {
      selector: '[data-tour="clients-add"]',
      title: "Add a client",
      body: "Paste their LinkedIn link and their name and business fill in for you. Then add when they joined and what you charge.",
      fallback: '[data-tour="clients-add-form"]',
      fallbackBody: "Paste their LinkedIn link and their name and business fill in for you. Then add when they joined and what you charge.",
    },
    {
      selector: '[data-tour="clients-add-many"]',
      title: "Add lots at once",
      body: "Got a list of clients already? Add many in one go instead of one at a time.",
    },
  ],
  "keep-clients/BOSS Score": [
    {
      selector: '[data-tour="boss-picker"]',
      title: "Pick who you're scoring",
      body: "Choose a client or prospect from your list, or add a new person. Then start the session and score their business together.",
      fallback: '[aria-label$="session actions"]',
      fallbackBody: "This is who you're scoring now. Open this menu to switch person, see their scorecard, or copy a link to their own dashboard.",
    },
    {
      selector: '[data-tour="boss-dials"]',
      title: "Their score at a glance",
      body: "The big number is their BOSS Score out of 100. The dials beside it show how each part of the business is doing.",
    },
    {
      selector: '[data-tour="boss-grid"]',
      title: "Score each area together",
      body: "Every box is one playbook. Tap a box and agree its colour with the owner: red needs work, amber is building, green is on track.",
    },
    {
      selector: '[data-tour="boss-owner-levels"]',
      title: "How far up the levels they are",
      body: "This shows how much of each owner level is done. It tells you which level to work on next.",
    },
    {
      selector: '[data-tour="boss-wheel"]',
      title: "The BOSS wheel",
      body: "The same scores as a picture. Owners get it fast, so it's a good one to share on screen.",
    },
    {
      selector: '[data-tour="boss-insights"]',
      title: "What the scores mean",
      body: "Insights written from their answers: where the business is strong and what to fix first. Tap refresh after you change scores.",
      fallback: '[data-tour="boss-grid"]',
      fallbackBody: "Once you pick someone, insights written from their answers show below the wheel: where they're strong and what to fix first.",
    },
  ],
  "keep-clients/Playbooks": [
    {
      selector: '[data-tour="playbooks-library"]',
      title: "Ready-made guides for clients",
      body: "Each playbook shows an owner how to fix one part of their business, step by step. You don't have to write it yourself.",
    },
    {
      selector: '[data-tour="playbooks-area"]',
      title: "Sorted by business area",
      body: "Playbooks sit under the same areas as the BOSS Score. A red box on a client's score points to the playbook that fixes it.",
    },
    {
      selector: '[data-tour="playbook-card"]',
      title: "Open one and share it",
      body: "The level on each card shows which owners it suits, from Overwhelm up to Owner. Open it to read, then send the link. Your name shows on it, so they come back to you.",
    },
    {
      selector: '[aria-label="View mode"]',
      title: "Grid or list",
      body: "Switch to the list to read a short summary of each playbook before you open it.",
    },
  ],
  "keep-clients/Profit Levers": [
    {
      selector: '[aria-label$="a year, against their targets"]',
      title: "Their profit, now and next",
      body: "This is what the owner's business makes in a year from the numbers below. The bar shows how close they are to each target.",
    },
    {
      selector: '[aria-label="Their profit targets a year"]',
      title: "Set three profit targets",
      body: "Type the yearly profit the owner wants to reach. Untick one to hide it from the bar.",
    },
    {
      selector: '[aria-label="Costs"]',
      title: "Before or after costs",
      body: "Off shows profit before running costs. On adds what leads and overheads cost, so you see what they really keep.",
    },
    {
      selector: '[aria-label="What the dots show"]',
      title: "Their numbers, then what if",
      body: "Start on Their numbers and fill in where the business is today. Then switch to What if to try changes, or All at target to see the full picture.",
    },
    {
      selector: '[data-tour="levers-step"]',
      title: "One row for each lever",
      body: "Leads, how many become customers, how much they spend, how often they buy, and the margin. Small changes in each add up to a lot more profit.",
    },
    {
      selector: '[data-tour="levers-slider"]',
      title: "Drag to show the owner",
      body: "Drag a dot and the profit at the top moves with it. It's the fastest way to show an owner what one small change is worth.",
    },
    {
      selector: '[aria-label="Order"]',
      title: "Find the biggest gap",
      body: "Biggest gap puts the lever with the most profit in it at the top, so you both know where to start.",
    },
  ],
  "keep-clients/Client Simulator": [
    {
      selector: '[aria-label="Clients"]',
      title: "Pick a client to coach",
      body: "AI owners who act like real clients, each with their own business and moods. Tap a face or use the arrows to choose one.",
    },
    {
      selector: '[data-tour="clientsim-brief"]',
      title: "Know your client",
      body: "Who they are, how their business is doing and what's on their mind. Read it before you start, like you would before a real session.",
    },
    {
      selector: '[data-tour="clientsim-situation"]',
      title: "Choose the session",
      body: "Practise your first four sessions in order, or the hard moments: a client who didn't do the work, wants to stop, or questions your fee.",
    },
    {
      selector: '[aria-label="Level"]',
      title: "Set how hard it is",
      body: "Easy clients go along with you. Hard ones push back. Start easy and step up when you're ready.",
    },
    {
      selector: '[data-tour="clientsim-start"]',
      title: "Start the session",
      body: "Press Start and coach out loud. It uses your microphone and your monthly practice minutes, then scores how you did.",
    },
    {
      selector: '[data-tour="clientsim-create"]',
      title: "Practise on your own client",
      body: "Make a client based on someone real, so you can rehearse a tricky session before you have it.",
    },
    {
      selector: '[data-tour="clientsim-history"]',
      title: "Your sessions",
      body: "Every session you finish shows here with a score and a report. Open one to see what went well and what to try next time.",
    },
    {
      selector: '[data-tour="clientsim-weak-spot"]',
      title: "Your weak spot",
      body: "After a few sessions, this shows the skill you score lowest on. Tap Practise it and your next session focuses there.",
      fallback: '[data-tour="clientsim-history"]',
      fallbackBody: "After a few sessions, your weak spot shows beside this list: the skill you score lowest on, with a quick way to practise it.",
    },
    {
      selector: '[data-tour="clientsim-cert"]',
      title: "Get certified",
      body: "When you're ready, coach three sessions with no tips. A BCA coach checks every one, and a good average score gets you certified.",
    },
  ],
};
