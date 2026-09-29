export type GuideLink = { label: string; href: string };

export type GuideSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  links?: GuideLink[];
  rows?: { name: string; detail: string; ask: string }[];
};

export type GuideCard = {
  id: string;
  title: string;
  time: string;
  lede: string;
  sections: GuideSection[];
};

export type GuidePage = {
  slug: string;
  note: string;
  cards: GuideCard[];
};

const SHEET: GuideLink = {
  label: "Coaching sheet (Google Sheets)",
  href: "https://docs.google.com/spreadsheets/d/1Bne6YOTj29tM6A74-AtKMPq4qBIOrSL2jD2zKtxso4w/edit?usp=sharing",
};
const SHEET_PDF: GuideLink = {
  label: "Coaching sheet (PDF)",
  href: "https://drive.google.com/file/d/1yVraH5mwjf5BmXW8oteirxb3RZbN8IWP/view?usp=sharing",
};
const MASTERFILE: GuideLink = {
  label: "Profit Coach client masterfile",
  href: "https://businesscoachacademy.com/alignment",
};
const ORBIT_FILE: GuideLink = {
  label: "Client masterfile for the three-year orbit",
  href: "https://docs.google.com/spreadsheets/d/1UN1pfF5N2soXAlItrFjznI0oJOwN9owc9ZvtFxiO9NY/edit?usp=sharing",
};

const FINISH_NOTE =
  "Close with the FINISH framework on Every Session, and send the summary after.";

const CLASSROOM_SETUP =
  "/coach/academy/classroom/coach-clients/coach-clients-client-onboarding-how-to-setup-a-new-client";

export const GUIDE_PAGES: GuidePage[] = [
  {
    slug: "start",
    note: "Do this before the first session. Pam kept forty-seven one-to-one clients with this and nothing fancier. The latest coaching sheet is the point of reference. The folder is only there so you are not holding it in your head.",
    cards: [
      {
        id: "folder",
        title: "Create the client folder",
        time: "Step 1",
        lede: "One Clients folder in Google Drive. A new folder inside it for every client, set up with the templates before you meet.",
        sections: [
          {
            heading: "Do this",
            bullets: [
              "Create a folder called Clients if you do not already have one.",
              "Inside it, add a folder named Business Name - Client Name. For example, Business Coach Academy - Zander Woodford-Smith.",
              "Build an Example Client folder with everything a new client should start with. Copy that folder each time instead of rebuilding it.",
            ],
          },
        ],
      },
      {
        id: "files",
        title: "Put the working files in",
        time: "Step 2",
        lede: "The sheets live in the folder. Keep a paper copy of the Coach Method sheet for your own notes, and a checklist of what you still need to cover.",
        sections: [
          {
            heading: "In the client folder",
            bullets: [
              "Coaching Session Recordings. Put the recordings here, or keep the links in one document.",
              "Coaching Sheets. Name each file Client Name Coaching Sheet - YYYY MM DD, for example John Bishop Coaching Sheet 2025 08 30, so they sort by date. Keep a blank they can copy.",
              "The alignment file.",
              "Other tools as you add them later, such as a cashflow forecaster or a revenue growth accelerator.",
            ],
            links: [SHEET, SHEET_PDF, MASTERFILE],
          },
          {
            heading: "What you keep for yourself",
            paragraphs: [
              "Print the coaching sheet. On it, note what you still want to give this client. The checklist is how you know you have covered what you meant to cover. You do not need a second system for that.",
            ],
          },
        ],
      },
      {
        id: "share",
        title: "Invite the client",
        time: "Step 3",
        lede: "Share the folder before the first session, so the files are already theirs when you sit down.",
        sections: [
          {
            heading: "Do this",
            bullets: [
              "Right-click the client folder and choose Share.",
              "Add their email.",
              "Set the role to Content manager and save. Drive sends the invite.",
            ],
          },
        ],
      },
      {
        id: "sheet",
        title: "Work from the latest sheet",
        time: "Every session",
        lede: "When you have the latest coaching sheet, you know what you are working on. Keep the rest simple.",
        sections: [
          {
            heading: "How to use it",
            bullets: [
              "Open the latest sheet at the start of the session. That is the agenda.",
              "Keep a short list of what you have already covered, so the next session is obvious before you get there.",
              "If something urgent comes up, deal with that. Do not force the planned topic.",
              "Optional: add a tab on the alignment file and list a link to each coaching sheet.",
            ],
            paragraphs: [
              "This only has to work when you have six to fifteen clients. It is easy to remember two. The folder and the latest sheet are what stop it falling apart after that.",
            ],
            links: [{ label: "Classroom lesson: How To Setup A New Client", href: CLASSROOM_SETUP }],
          },
        ],
      },
    ],
  },
  {
    slug: "foundations",
    note: "The numbers are a sequence, not a cage. Finish a piece of work properly even if it spills into the next meeting. The one rule: session 2 should be about the thing they feel is most urgent.",
    cards: [
      {
        id: "session-1",
        title: "Session 1. Profit system and dashboard",
        time: "About 90 minutes",
        lede: "Give them value immediately, place the long engagement, and find where the work has to go next.",
        sections: [
          {
            heading: "Resources",
            links: [MASTERFILE, SHEET, SHEET_PDF],
          },
          {
            heading: "Shape of the session",
            bullets: [
              "Introduction, 5 minutes",
              "Ideal versus current business, 10 minutes",
              "Profit system overview, 5 minutes",
              "Dashboard and Business Growth Matrix, about 45 to 60 minutes",
              "Plan of action, 10 minutes",
            ],
          },
          {
            heading: "1. Introduction",
            paragraphs: [
              "Welcome them, then keep your own introduction to two or three minutes. Tell them the session will cover their goals, questions about them, questions about the business, the Profit-Fun Matrix, and the dashboard. Introduce the coaching sheet.",
            ],
            bullets: [
              "Tell me a bit about yourself: where you grew up, your family, what led you to start the business, and how you have found that.",
              "What do you want to cover today, and what outcome do you want from this first session?",
            ],
          },
          {
            heading: "2. Ideal versus current",
            paragraphs: [
              "Use the Profit-Fun Matrix. Score where they are now, 1 to 5, for profit and for fun. Then put the ideal on level 5. You do not need every level. Level 5 is the one that matters.",
            ],
            bullets: [
              "On a scale of 1 to 5, how profitable is the business right now?",
              "On a scale of 1 to 5, how fun is it right now?",
              "What has been the biggest win in the past quarter?",
              "What challenges are you facing?",
              "How is the team performing?",
              "Do you know the key metrics, and how they compare with the goals?",
              "How much profit does the ideal business generate, and at what margin? If they say as much as possible, ask for a number over the next three years.",
              "What does fun look like? Hours a week, what they focus on, and how the business runs.",
            ],
          },
          {
            heading: "3. Profit system",
            paragraphs: [
              "Five minutes to show how the profit system bridges where they are and the ideal: 5 levels, 3 pillars, 9 steps. Present it in your own style. After each piece, check that it landed.",
            ],
            bullets: [
              "Which level do you feel you are at, and why?",
              "Which areas need the most focus?",
              "Is there anything we should address immediately in the next session? This is the most important question of the meeting.",
            ],
          },
          {
            heading: "4. Dashboard and Business Growth Matrix",
            paragraphs: [
              "Explain the matrix, then work through it in the order that matches the level of the owner. Traffic-light the answers. Dig into the key issue. Prioritise, and get the agreed actions into the diary. Reassure them if you do not finish the whole matrix.",
            ],
            bullets: [
              "What do you think caused this?",
              "Have you faced something like it before, and how was it resolved?",
              "What impact is it having on you, the business, and the team?",
              "What support do you need, and do you already have it?",
              "What is stopping you from resolving it?",
            ],
          },
          {
            heading: "5. Plan of action",
            paragraphs: [
              "A fast, high-level plan so they leave making progress. Tell them a later session will go deeper.",
              FINISH_NOTE,
            ],
            bullets: [
              "What are the top three goals for the next three months?",
              "What specific steps get you there?",
              "Who on the team can help, and what is their role?",
              "What is a realistic timeline for each action?",
              "What can be done before the next session? Note it, and hold them to it.",
            ],
          },
        ],
      },
      {
        id: "session-2",
        title: "Session 2. Leverage and the critical issue",
        time: "About 90 minutes",
        lede: "Make real progress on the issue or opportunity from session 1. They find the solution. You bring the tool.",
        sections: [
          {
            heading: "Shape of the session",
            bullets: [
              "Open, 10 minutes",
              "Deep dive on the key issue or leverage point, 10 minutes",
              "Flexible problem-solving, 45 minutes",
              "Plan of action, 15 minutes",
              "Personal goals homework, and close, 10 minutes",
            ],
          },
          {
            heading: "1. Open",
            paragraphs: [
              "Check the tracking from last time. How is the tracking going? Is the 13-week cash flow up to date?",
            ],
          },
          {
            heading: "2. The key issue",
            paragraphs: [
              "Stay on the primary issue or opportunity. Recap what you already know about it and the impact.",
            ],
            bullets: [
              "What has improved so far, and what still needs fixing?",
              "What is stopping this business from doubling, or from being ten times the size?",
              "How long has it been like that?",
              "What have you already tried?",
            ],
          },
          {
            heading: "3. Flexible problem-solving",
            paragraphs: [
              "Pick the tool that fits. Do not stay in the problem unless you have to. Ask how, not only why.",
            ],
            bullets: [
              "COACH method, when they need a structured plan.",
              "ISSUE framework, when a specific obstacle is in the way.",
              "A profit system tool, such as a financial dashboard or an operations fix.",
              "Four quadrants, when they cannot see why it is not working.",
              "More, better, new, when they are choosing what to do next.",
              "What specific steps overcome this, and who can support you?",
            ],
            links: [
              {
                label: "Using the COACH method (from minute 17)",
                href: "https://academy.businesscoachacademy.com/p/profit-coach-certification/curriculum/overview?u=efaf59d5-853a-4581-b503-f6b76c7942ce",
              },
            ],
          },
          {
            heading: "4. Plan of action",
            paragraphs: [
              "Set a clear goal for this issue, outline the actions, assign who does what, and put the dates in the calendar.",
            ],
          },
          {
            heading: "5. Personal goals, then close",
            paragraphs: [
              "Ask them to think about their personal goals before next time, and what those goals will cost in time, effort, and money. Tell them the next session uses that to line the business up with the life.",
              FINISH_NOTE,
            ],
          },
        ],
      },
      {
        id: "session-3",
        title: "Session 3. The three-year plan",
        time: "About 90 minutes",
        lede: "Build a three-year picture that the business can actually support, starting from the life they want.",
        sections: [
          {
            heading: "Resources",
            links: [ORBIT_FILE],
          },
          {
            heading: "Shape of the session",
            bullets: [
              "Personal goals, 10 minutes",
              "Connect personal and business goals, 5 minutes",
              "Three-year orbit, 45 minutes",
              "Key performance indicators, 15 minutes",
              "Finish the orbit as homework, 5 minutes",
            ],
          },
          {
            heading: "1. Personal goals",
            paragraphs: [
              "Where do they want to be personally in three to five years? Use the one-page growth plan or the lifestyle calculator if they have done them.",
            ],
          },
          {
            heading: "2. Connect the business",
            paragraphs: [
              "What does the business have to produce so that life is possible? Income, hours, and flexibility.",
            ],
          },
          {
            heading: "3. The three-year orbit",
            paragraphs: [
              "Six segments: Profit and cash. Revenue and marketing. Ops and product. Financials and KPIs. Innovation and management. Team and leadership. Use the sheet, or sticky notes.",
              "Spend about 30 minutes on the three-year picture for each segment. Then pick one segment and add the two-year and one-year steps, about 10 minutes. Then 5 minutes on the structures that have to change: team size, operations, leadership.",
            ],
          },
          {
            heading: "4. KPIs",
            paragraphs: [
              "List the measures that would show progress. Do not ask them to track everything. Choose the three or four that start now, and review those at the start of every future session.",
            ],
          },
          {
            heading: "5. Homework",
            paragraphs: [
              "They leave with the three-year goals, at least one segment broken into two-year and one-year steps, a KPI list, and the three or four they will track. They complete the other segments before next time.",
              "Next session turns this into the next 90 days.",
              FINISH_NOTE,
            ],
          },
        ],
      },
      {
        id: "session-4",
        title: "Session 4. The ninety-day plan",
        time: "About 90 minutes",
        lede: "Turn the long plan into three projects they will actually run this quarter, with the team.",
        sections: [
          {
            heading: "Resources",
            links: [MASTERFILE],
            paragraphs: [
              "Use their project tool if they have one: ClickUp, Asana, or Monday. The sheet is a fallback, not the ideal.",
              "The first plan often misses the calendar quarter. Shorten or lengthen it so the next one sits on a quarter. Stay between 60 and 120 days.",
            ],
          },
          {
            heading: "Shape of the session",
            bullets: [
              "Explain the 90-day idea, 5 minutes",
              "Name three key projects, 10 minutes",
              "Success metric for each, 5 minutes",
              "Phases or milestones, 15 minutes",
              "List the actions, 30 minutes",
              "Prioritise, assign, schedule, 10 minutes",
              "Accountability, 5 minutes",
              "Power Plan as homework, 5 minutes",
            ],
          },
          {
            heading: "The projects",
            paragraphs: [
              "Three projects is ideal. Four is manageable. Five is the ceiling. Name them as work, not wishes: a product launch, a marketing rebuild, a training programme.",
              "For each one, define what done looks like in 90 days. Then break it into sub-projects, phases, or milestones. Then list the actions, cut anything that is not essential, set a date, name the owner, and agree how you will know it worked.",
              "You review progress on this plan at the start of every session after this.",
            ],
          },
          {
            heading: "Homework: the Power Plan",
            paragraphs: [
              "The three-year plan is the destination. This session is the quarter. The Power Plan is how their week actually has room to do it. Ask them to draft it before the next session.",
              FINISH_NOTE,
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "every-session",
    note: "Use this on session 1 as well as session 40. The foundations pages say what the first four meetings are about. This page is how any meeting starts, finishes, and gets written down.",
    cards: [
      {
        id: "start",
        title: "How to start",
        time: "15 to 25 minutes",
        lede: "GOAL sets the meeting. RPMS checks the business. Together they keep the hour on their goals, not on whatever walked in the door.",
        sections: [
          {
            heading: "GOAL. The first 5 to 10 minutes",
            rows: [
              {
                name: "Greet and gauge",
                detail: "Welcome them and find out how they actually are.",
                ask: "How are you today? How have you been feeling about progress this week?",
              },
              {
                name: "Outline objectives",
                detail: "They name the outcome of this meeting.",
                ask: "What do you want to leave with today?",
              },
              {
                name: "Agree the agenda",
                detail: "Turn those outcomes into the points you will cover.",
                ask: "Based on that, here are the points for today. Anything missing?",
              },
              {
                name: "Latest learning",
                detail: "What changed since last time, in them or in the business.",
                ask: "What has been the biggest learning since we last met?",
              },
            ],
          },
          {
            heading: "RPMS. The next 10 to 15 minutes",
            paragraphs: [
              "This is the coaching sheet review. Do it in this order.",
            ],
            rows: [
              {
                name: "Review the key issue",
                detail: "Progress on the main issue from last time.",
                ask: "What progress have you made on the issue we left with?",
              },
              {
                name: "Performance",
                detail: "The business now: money, team, and what is hard.",
                ask: "How is the business performing? Any team issues?",
              },
              {
                name: "Metrics",
                detail: "The three or four KPIs you chose, against the goal.",
                ask: "Where are the numbers, and how do they compare with the target?",
              },
              {
                name: "Success and challenges",
                detail: "A win, a stuck point, and where they need you.",
                ask: "What worked, what got in the way, and where do you want more support?",
              },
            ],
          },
        ],
      },
      {
        id: "finish",
        title: "How to finish",
        time: "The last 10 minutes",
        lede: "If you skip this, they forget the insight and you have nothing to follow up. Use it with the coaching sheet.",
        sections: [
          {
            heading: "FINISH",
            bullets: [
              "Feedback and focus. Recap the points, the tool, and the strategy. Check they are clear. Only hand over a resource that serves the thing they are working on now.",
              "Insights. Name the one or two insights, and confirm the actions you both agreed.",
              "Next steps. What they will do before you meet again, and how you will know it happened. Suggest an accountability partner on their team.",
              "Inspire. End on encouragement. A relevant story, book, or example is enough. Do not add a new project.",
              "Schedule. Book the next session before you leave, and say what you will review.",
              "Help. Tell them how to reach you, and what to send if they get stuck.",
            ],
          },
          {
            heading: "Questions",
            bullets: [
              "What is your understanding of the main points today?",
              "What are you taking away?",
              "What will you do next, and how will you know it worked?",
              "When do we review that?",
              "What should we expect of the next meeting?",
            ],
          },
          {
            heading: "After the session",
            bullets: [
              "Email a short summary: takeaways and actions.",
              "A brief check-in about a week later, if the work needs it.",
              "They share the completed coaching sheet: actions, dates, and the learning.",
              "24 hours before the next session, they complete the bottom of the sheet: wins, challenges, and the current state of the business.",
            ],
          },
        ],
      },
      {
        id: "sheet",
        title: "The coaching sheet",
        time: "Every session",
        lede: "If you only had this sheet and decent coaching skills, the client would still make progress. Everything else is extra.",
        sections: [
          {
            heading: "Resources",
            links: [SHEET, SHEET_PDF],
          },
          {
            heading: "How to use it",
            bullets: [
              "A fresh sheet for each session.",
              "Go through the sheet in order. Do not jump to the interesting problem.",
              "Next time, start by checking what they said they would do.",
            ],
            paragraphs: [
              "Pam walks through how she uses the sheet before, during, and after the session in the classroom. The point of the tool is that the client can see the value, and you can see whether the last actions happened.",
            ],
          },
        ],
      },
    ],
  },
];

export function guidePage(slug: string): GuidePage | null {
  return GUIDE_PAGES.find((page) => page.slug === slug) ?? null;
}
