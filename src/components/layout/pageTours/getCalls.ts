import type { PageTourStep } from "./types";

/** A chat is open when its reply bar or reply box shows. */
const CHAT_OPEN = '[data-tour="inbox-reply-open"], [data-tour="inbox-composer"]';
/** Open a chat that's already read, so the tour never marks anything read. */
const OPEN_A_READ_CHAT = { click: '[data-tour-row="read"]', unless: CHAT_OPEN };
const OPEN_REPLY_BOX = { click: '[data-tour="inbox-reply-open"]', unless: '[data-tour="inbox-composer"]' };

export const GET_CALLS_TOURS: Record<string, PageTourStep[]> = {
  "get-calls/Conversations": [
    {
      selector: '[data-tour="inbox-tabs"]',
      title: "Start with Unread",
      body: "Unread shows the owners waiting on you. Start your day here. All, Recent and Starred are there when you need them.",
    },
    {
      selector: '[data-tour="inbox-list"]',
      title: "Every conversation in one list",
      body: "Chats from LinkedIn, WhatsApp and email, newest first. The small badge on each photo shows where it came from, and a blue dot means unread.",
    },
    {
      selector: '[aria-label="Start a conversation"]',
      title: "Start a new chat",
      body: "Message anyone in your lead lists, pipeline or clients, on whichever channel suits them.",
    },
    {
      selector: '[aria-label="Filter conversations"]',
      title: "Find anyone fast",
      body: "Search by name with the magnifying glass. Filter to people who need a reply, have booked a call, or carry a tag.",
    },
    {
      selector: '[data-tour="inbox-sync"]',
      title: "New messages come in by themselves",
      body: "The app checks for new messages for you. Tap Sync if you want to check right now.",
    },
    {
      selector: '[data-tour="inbox-thread"]',
      title: "Read and reply here",
      body: "Here's a chat opened up. You see the whole thread, newest at the bottom, with your reply box underneath.",
      fallbackBody: "Open a chat from the list to see the whole thread here, with your reply box underneath.",
      prepare: OPEN_A_READ_CHAT,
    },
    {
      selector: '[data-tour="inbox-composer"]',
      title: "Your reply box",
      body: "Write your reply here. The button on the left of the bar picks LinkedIn, WhatsApp or email, so you answer where they wrote to you.",
      fallback: '[data-tour="inbox-thread"]',
      fallbackBody: "Open a chat and your reply box sits at the bottom. Pick LinkedIn, WhatsApp or email, so you answer where they wrote to you.",
      prepare: OPEN_REPLY_BOX,
    },
    {
      selector: '[aria-label="Suggest a reply"]',
      title: "Let Ava write the reply",
      body: "Tap Ava's button and she drafts a reply in your voice, using the whole chat. Check it, change it, send it.",
      prepare: OPEN_REPLY_BOX,
      fallback: '[data-tour="inbox-thread"]',
      fallbackBody: "Open a chat and Ava's button sits in the reply box. Tap it and she drafts a reply in your voice, using the whole chat. Check it, change it, send it.",
    },
    {
      selector: '[aria-label="Snippets"]',
      title: "Use your snippets",
      body: "Snippets are ready-made messages, like your BOSS Score link or a note to book a call. Pick one and their name and company fill in for you.",
      prepare: OPEN_REPLY_BOX,
      fallback: '[data-tour="inbox-thread"]',
      fallbackBody: "Open a chat and your snippets sit under the reply box. They're ready-made messages, like your BOSS Score link or a note to book a call. Their name and company fill in for you.",
    },
    {
      selector: '[data-tour="inbox-details"]',
      title: "Know who you're talking to",
      body: "Their company, where they are in your pipeline, any calls booked and the campaigns they're in. All here, so you never reply blind.",
    },
  ],
  "get-calls/Lead Lists": [
    {
      selector: '[aria-label="Saved prospect views"]',
      title: "Your lead lists",
      body: "Each tab is one list of owners. The first tab holds everyone. Tap + List to start a new one, say for one town or trade.",
    },
    {
      selector: '[data-tour="pool-add-people"]',
      title: "Add people",
      body: "Bring in owners from a Sales Navigator search, Google Maps or a file. They land in a list, ready for a campaign.",
    },
    {
      selector: '[data-tour="pool-table"]',
      title: "Everyone on one page",
      body: "One row per person, with their company, how to reach them and where they came from. Rest on a name to see what their company does.",
    },
    {
      selector: '[data-tour="pool-fit"]',
      title: "Who fits best",
      body: "Ava rates how well each owner fits the people you help. Tap a rating to change it if you know better.",
      fallback: '[data-tour="pool-table"]',
      fallbackBody: "Turn on the Fit column under Columns. Ava rates how well each owner fits the people you help.",
    },
    {
      selector: '[data-tour="pool-check-fit"]',
      title: "Check fit, one at a time",
      body: "Go through a list one business at a time. Swipe or use the arrow keys to say yes or no. Ava sorts the rest the way you did.",
      fallback: '[aria-label="Saved prospect views"]',
      fallbackBody: "Open one of your lists and a Check fit button shows up. Go through it one business at a time, and Ava sorts the rest the way you did.",
    },
    {
      selector: '[data-tour="pool-toolbar"] > div > div:first-child',
      title: "Find the right people",
      body: "Search by name. Filter by town, size, trade or fit. Sort and group the list, pick your columns, or download it.",
      fallback: '[data-tour="pool-toolbar"]',
    },
    {
      selector: '[aria-label$=" to campaign"]',
      title: "Put people in a campaign",
      body: "Tap here to add someone to a campaign. Tick a few rows first to add them all at once.",
      fallback: '[data-tour="pool-table"]',
      fallbackBody: "When you have people in a list, each row has a button to add them to a campaign. Tick a few rows to add them all at once.",
    },
  ],
  "get-calls/Campaigns": [
    {
      selector: '[data-tour="campaigns-activity"]',
      title: "What went out",
      body: "Invites, messages and likes your campaigns sent, plus what's planned next. The boxes below show how many accept and reply.",
    },
    {
      selector: '[data-tour="campaigns-list"]',
      title: "Your campaigns",
      body: "Each row is one campaign. Tap it to change the steps or add people. The circles show how many accepted your invite and how many replied.",
    },
    {
      selector: '[aria-label="Turn campaign on"], [aria-label="Turn campaign off"]',
      title: "On or off",
      body: "This switch starts or pauses a campaign. While it's on, the app sends each step for you at a steady pace.",
      fallback: '[data-tour="campaigns-list"]',
      fallbackBody: "Each campaign has an on and off switch. While it's on, the app sends each step for you at a steady pace.",
    },
    {
      selector: '[data-tour="campaigns-new"]',
      title: "Start a new campaign",
      body: "Start from a ready-made campaign or a blank one. Then add your steps and the people from your lead lists.",
    },
    {
      selector: '[aria-label="Sending settings"]',
      title: "How much it sends",
      body: "Set how many invites and messages go out each week, and the hours they go out. This keeps your LinkedIn account safe.",
      fallback: '[data-tour="campaigns-list"]',
      fallbackBody: "Once LinkedIn is connected, a button here sets how many invites and messages go out each week, and when.",
    },
    {
      selector: '[data-tour="campaigns-todo"]',
      title: "Your to do list",
      body: "Things the campaigns hand back to you, like a call to make or a message to send yourself. Planned shows what's coming, Done shows what went.",
    },
    {
      selector: '[data-tour="campaigns-ssi"]',
      title: "Your LinkedIn score",
      body: "LinkedIn scores how well you use it, out of 100. A higher score means more people see you and accept your invites.",
    },
    {
      selector: '[data-tour="campaigns-invites"]',
      title: "Invites still waiting",
      body: "LinkedIn stops you sending if too many invites sit unanswered. Auto-clean takes back the oldest ones so you stay under the limit.",
    },
  ],
  "get-calls/Content": [
    {
      selector: '[data-tour="content-tabs"]',
      title: "Everything for your posts",
      body: "Write a post, see what's lined up, plan your month and check how posts did. Each tab is one job.",
    },
    {
      selector: '[data-tour="content-composer"]',
      title: "Write your post",
      body: "Type your post here. It looks just like it will on LinkedIn, with your photo and name at the top.",
    },
    {
      selector: '[data-tour="content-media"]',
      title: "Add a picture or file",
      body: "Add a picture, a video, a document or a link. Posts with a picture get seen by more people.",
    },
    {
      selector: '[data-tour="content-send"]',
      title: "Post now or later",
      body: "Post sends it to LinkedIn now. Schedule picks a day and time. Save draft keeps it for later.",
    },
    {
      selector: '[data-tour="content-tab-queue"]',
      title: "Posts lined up",
      body: "Queue shows every post waiting to go out. Change one or move it to another day.",
    },
    {
      selector: '[data-tour="content-tab-calendar"]',
      title: "See your month",
      body: "Calendar shows your posts by day, so you can spot gaps and keep posting each week.",
    },
    {
      selector: '[data-tour="content-tab-library"]',
      title: "Drafts and old posts",
      body: "Library keeps your drafts and the posts you've already shared. Pick one to use again.",
    },
    {
      selector: '[data-tour="content-tab-insights"]',
      title: "What worked",
      body: "Insights shows the comments and reactions on posts you shared from here, so you write more of what owners like.",
    },
  ],
  "get-calls/Newsletter": [
    {
      selector: '[aria-label="Newsletter issues"]',
      title: "All your issues",
      body: "Drafts, scheduled and published issues, in one list. Drag a draft to change the order they go out.",
    },
    {
      selector: '[aria-label="Newsletter issues"] a[href$="/blueprint/content"]',
      title: "Name and call to action",
      body: "Set your newsletter's name and what you ask readers to do at the end, like take your BOSS Score.",
    },
    {
      selector: '[data-tour="newsletter-issue"]',
      title: "Read and edit the issue",
      body: "The issue you picked opens here as one page. Type straight into it. It saves as you go.",
      fallbackBody: "Pick an issue from the list and it opens here as one page to read and edit.",
    },
    {
      selector: '[data-tour="newsletter-cover"]',
      title: "Cover photo",
      body: "Add a cover photo across the top. Pick a template or upload your own.",
      fallback: '[data-tour="newsletter-issue"]',
      fallbackBody: "Open a draft and you can add a cover photo across the top. Pick a template or upload your own.",
    },
    {
      selector: '[role="toolbar"][aria-label="Formatting"]',
      title: "Make it easy to read",
      body: "Add headings, bold, lists, quotes and pictures. Short parts with headings are easier to read on a phone.",
      fallback: '[data-tour="newsletter-issue"]',
      fallbackBody: "Open a draft and a bar at the top lets you add headings, bold, lists, quotes and pictures.",
    },
    {
      selector: '[data-tour="newsletter-copy"]',
      title: "Copy it to LinkedIn",
      body: "Copy the whole issue, pictures and all. Then paste it into a new LinkedIn newsletter.",
      fallback: '[data-tour="newsletter-issue"]',
      fallbackBody: "Open a draft and a Copy button copies the whole issue, pictures and all, ready to paste into LinkedIn.",
    },
    {
      selector: '[aria-label^="Status:"]',
      title: "Draft, scheduled or out",
      body: "Once you've set it up on LinkedIn, mark it Scheduled with the day it goes out, or Published. The list keeps track for you.",
      fallback: '[data-tour="newsletter-issue"]',
      fallbackBody: "Open a draft to mark it Scheduled or Published once it's on LinkedIn. The list keeps track for you.",
    },
    {
      selector: '[data-tour="newsletter-post"]',
      title: "A post to share it",
      body: "A short post for your feed that tells people about the issue, so more of them open it.",
      fallback: '[data-tour="newsletter-issue"]',
      fallbackBody: "Drafts from BCA come with a short post for your feed, so more people open the issue.",
    },
  ],
  "get-calls/Lead Magnets": [
    {
      selector: '[data-tour="magnets-list"]',
      title: "Your lead magnets",
      body: "Free scorecards owners fill in. They get their score, and you get a warm lead who has told you where their business hurts.",
    },
    {
      selector: '[data-tour="magnets-list"] > li:first-child',
      title: "Open one to set it up",
      body: "Tap a lead magnet to see it and the emails that follow up. One goes to people who start and stop, one to people who finish.",
    },
    {
      selector: '[data-tour="magnets-copy"]',
      title: "Copy your link",
      body: "Your own link, with your name on it. Put it in posts, messages and your LinkedIn profile.",
      fallback: '[data-tour="magnets-url"]',
      fallbackBody: "Set your public web address first. Then each lead magnet gets its own link to copy, with your name on it.",
    },
    {
      selector: '[data-tour="magnets-open"]',
      title: "See what owners see",
      body: "Open the page just as an owner would. Try it yourself before you send it out.",
    },
    {
      selector: '[data-tour="magnets-url"]',
      title: "Your web address",
      body: "This short name goes on the end of every link, like your BOSS Score and booking page. Keep it simple, like your name.",
    },
    {
      selector: '[data-tour="magnets-settings"]',
      title: "Who sends the emails",
      body: "Choose who emails people after they take a scorecard: this app, your own email, or the system you already use.",
    },
  ],
  "get-calls/Toolkit": [
    {
      selector: 'nav[aria-label="Toolkit"]',
      title: "Your ready-made kit",
      body: "Links, your brochure, social posts, print files and brand graphics. All made for you, with your name on them.",
    },
    {
      selector: '[aria-label="Public URL slug"]',
      title: "Your web address",
      body: "This short name goes on the end of every link below. Keep it simple, like your name.",
    },
    {
      selector: 'section[aria-labelledby="your-pages-title"]',
      title: "Your pages",
      body: "The pages owners land on, like your booking page and BOSS Score page. Tap Edit page to change the words, or copy the link to send.",
    },
    {
      selector: '[data-tour="links-scorecards"]',
      title: "Scorecard links",
      body: "Links to the BOSS Score and BOSS Score Pro. Owners take the score and you see their answers.",
    },
    {
      selector: '[aria-label^="Share "]',
      title: "Copy or share",
      body: "Copy gives you a link anyone can use. Share makes a link for one person, with their details filled in so they skip a step.",
      fallback: '[data-tour="links-scorecards"]',
      fallbackBody: "Set your web address first. Then each link gets a copy button, and a share button that makes a link for one person.",
    },
    {
      selector: '[data-tour="links-book-a-call"]',
      title: "Booking links",
      body: "A link for each of your calendars, so owners can pick a time to talk.",
    },
    {
      selector: '[data-tour="links-your-links"]',
      title: "Add your own links",
      body: "Keep any other link here too, like a video or a case study, so it's always one tap away.",
    },
    {
      selector: 'nav[aria-label="Toolkit"] a[href$="/toolkit"]',
      title: "Your brochure",
      body: "A short brochure of your 90-day plan, made from your Blueprint. Print it or save it as a PDF to send before or after a call.",
    },
  ],
};
