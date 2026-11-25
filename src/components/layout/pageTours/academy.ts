import type { PageTourStep } from "./types";

/** Show the calendar as a list; the list only changes what's on screen. */
const SHOW_LIST = { click: '[aria-label="List view"]', unless: '[data-tour="calendar-list"]' };
/** Inside the list, open Previous calls (a read-only tab). */
const SHOW_PREVIOUS = {
  click: '[data-tour="calendar-previous-tab"]',
  unless: '[data-tour="calendar-previous-tab"][aria-selected="true"]',
};
/** Open the first group of resources, so the tour can point at what's inside. */
const OPEN_A_GROUP = {
  click: '[data-tour="resources-sections"] section button[aria-expanded="false"]',
  unless: '[data-tour="resources-open-section"]',
};

export const ACADEMY_TOURS: Record<string, PageTourStep[]> = {
  "academy/Community": [
    {
      selector: '[data-tour="community-compose"]',
      title: "Share a win or ask for help",
      body: "Tap here to write a post. Other coaches see it in their feed and can reply, so you never get stuck on your own.",
    },
    {
      selector: '[data-tour="community-next-call"]',
      title: "The next live call",
      body: "The next call with the team shows here. Tap it to see the details on the Calendar.",
      fallback: '[data-tour="community-week-calls"]',
      fallbackBody: "When a live call is coming up, it shows at the top of the feed. This week's calls are listed on the right.",
    },
    {
      selector: '[aria-label="Post categories"]',
      title: "Pick a topic",
      body: "Wins, questions, announcements and more. Tap one to see only those posts, or All to see everything.",
    },
    {
      selector: '[aria-label^="Feed filter"]',
      title: "Catch up fast",
      body: "Show only the posts you haven't read yet, or the ones you saved as favourites.",
    },
    {
      selector: '[data-tour="community-feed"] > li',
      title: "Read a post",
      body: "Newest posts sit at the top. Open one to read it in full, see the comments and add your own.",
      fallback: '[data-tour="community-compose"]',
      fallbackBody: "Posts from other coaches show here, newest first. There's nothing here yet, so why not write the first one?",
    },
    {
      selector: '[data-tour="community-about"]',
      title: "Who's here",
      body: "How many coaches are in the community and who's online now. Tap a face to see who they are and what they do.",
    },
    {
      selector: '[data-tour="community-week-calls"]',
      title: "This week's calls",
      body: "Every live call this week, in your own time zone. Come with a question and leave with an answer.",
    },
  ],

  "academy/Classroom": [
    {
      selector: '[data-tour="classroom-course-start-here"]',
      title: "Start here",
      body: "Your first course. It shows you how the Academy works and how to get the most from it. Begin with this one.",
    },
    {
      selector: '[data-tour="classroom-course-coach-action-plan"]',
      title: "Plan your next 90 days",
      body: "Set your money target, plan a week that works, and build a 90-day plan you can stick to.",
    },
    {
      selector: '[data-tour="classroom-course-get-calls"]',
      title: "The method, step by step",
      body: "Get Calls, Win Clients and Keep Clients follow the same order as your app. Learn a step here, then do it in the matching tab.",
    },
    {
      selector: '[data-tour="classroom-progress"]',
      title: "See how far you've got",
      body: "Each course fills up as you finish lessons. Tap a course and it opens at the first lesson.",
    },
    {
      selector: ".classroom-system-banner",
      title: "The Portfolio System",
      body: "One map of the whole process, from finding clients to keeping them. Tap any step and its lesson opens.",
    },
    {
      selector: "#vault",
      title: "The Vault",
      body: "Extra courses for when you want more: books, talks and how-tos. Dip in whenever you have time to learn.",
    },
  ],

  "academy/Calendar": [
    {
      selector: '[data-tour="calendar-grid"]',
      title: "Every live call",
      body: "Calls with the team and other coaches, laid out by day. Tap a call to see what it's about and how to join.",
    },
    {
      selector: '[aria-label$="Change time zone."]',
      title: "Times in your time zone",
      body: "Every time shows where you are. Tap to change it if you're travelling.",
    },
    {
      selector: '[data-tour="calendar-subscribe"]',
      title: "Add calls to your own calendar",
      body: "Subscribe once and every call shows up in Google, Outlook or Apple calendar. New calls appear by themselves.",
    },
    {
      selector: '[aria-label="Calendar or list"]',
      title: "Or see a simple list",
      body: "Switch to the list when you just want the next calls in order. Tap the calendar button to go back.",
      prepare: SHOW_LIST,
    },
    {
      selector: '[data-tour="calendar-previous-tab"]',
      title: "Watch calls you missed",
      body: "Previous calls keeps the recordings. Missed one? Watch it here whenever suits you.",
      fallback: '[aria-label="Calendar or list"]',
      fallbackBody: "Tap the list button, then Previous calls, to watch recordings of calls you missed.",
      prepare: SHOW_PREVIOUS,
    },
  ],

  "academy/Resources": [
    {
      selector: '[data-tour="resources-header"]',
      title: "Every resource in one place",
      body: "Guides, sheets, decks and templates for winning clients and running sessions. Use them as they are, so you never start from a blank page.",
    },
    {
      selector: 'nav[aria-label="Resources"]',
      title: "The library menu",
      body: "Every group and resource, always on the left. Jump to any one from here.",
    },
    {
      selector: '[data-tour="resources-search"]',
      title: "Search inside everything",
      body: "Type a word and it searches the text of every resource, as well as the titles.",
    },
    {
      selector: '[aria-label="Show only"]',
      title: "Show one kind",
      body: "Only want sheets, or only slides? Tap one to narrow the list.",
    },
    {
      selector: '[data-tour="resources-sections"]',
      title: "Grouped by what you're doing",
      body: "Each group covers one part of your work. Tap a group to open it.",
    },
    {
      selector: '[data-tour="resources-open-section"]',
      title: "Open a resource",
      body: "Tap any resource to read it here. You can also make your own copy to change and use with your clients.",
      fallback: '[data-tour="resources-sections"]',
      fallbackBody: "Open a group, then tap any resource to read it here. You can also make your own copy to use with your clients.",
      prepare: OPEN_A_GROUP,
    },
  ],
};
