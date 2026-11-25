import type { PageTourStep } from "./types";

/**
 * The Blueprint pages share one layout. Overview and About You explain the
 * shared parts (the menu, statuses, the page chat, Ava); the other pages
 * keep to what is their own.
 */
const CHAT = 'aside[aria-label="Chat"]';
const CHAT_BUTTON = '[data-tour="blueprint-chat-button"]';
const STATUS = '[data-tour="blueprint-status"]';

export const BLUEPRINT_TOURS: Record<string, PageTourStep[]> = {
  "blueprint/Overview": [
    {
      selector: 'nav[aria-label="Practice blueprint"]',
      title: "Your plan, page by page",
      body: "Every part of your practice has its own page in this menu. You fill in About You, and BCA builds the rest from it.",
    },
    {
      selector: 'section[aria-labelledby="bp-checklist"]',
      title: "Get set up",
      body: "Your first steps, in order. Work down the list and you're ready to launch.",
    },
    {
      selector: '[data-tour="blueprint-yours"]',
      title: "Your part: About You",
      body: "The one page you fill in: your results, how you sound and how owners reach you. Start here, because every other page is built from it.",
    },
    {
      selector: '[data-tour="blueprint-bca-pages"]',
      title: "The pages BCA builds",
      body: "Your ideal client, LinkedIn profile, lead lists, campaigns, content, offer and pitch. We write them for you, then you check each one.",
    },
    {
      selector: '[aria-label="How your Blueprint works"]',
      title: "What the labels mean",
      body: "Each page shows where it stands: Needs you, BCA to do, In progress, Review or Done. Tap here for what each one means, and a short video.",
    },
    {
      selector: '[aria-label="Show the Blueprint as"]',
      title: "List or board",
      body: "See your pages as a list, or as a board with a column for each label.",
    },
    {
      selector: CHAT,
      title: "Chat with BCA",
      body: "Ask the BCA team anything about your Blueprint here. Each page has its own chat too, so the answer sits next to the work.",
      fallback: CHAT_BUTTON,
      fallbackBody: "Tap Chat to ask the BCA team anything about your Blueprint. Each page has its own chat too, so the answer sits next to the work.",
    },
  ],

  "blueprint/About You": [
    {
      selector: STATUS,
      title: "Where this page stands",
      body: "Needs you means there are answers only you can give. On the pages BCA writes, Review means it's ready for you to read and sign off.",
    },
    {
      selector: 'nav[aria-label="Parts of this page"]',
      title: "Three parts",
      body: "Story and Proof, Your Voice and Practice Setup. Tap one to jump straight to it.",
    },
    {
      selector: "#s-story-results",
      title: "Your results come first",
      body: "Your best results, with numbers. This is the most useful thing you can give us, because every message we write leads with one.",
      fallback: "section.bp-section",
    },
    {
      selector: 'section.bp-section [aria-label^="About "]',
      title: "Why we ask",
      body: "Tap the small i on any box to see what it's for and where your answer gets used.",
    },
    {
      selector: "section.bp-section textarea",
      title: "Write it your way",
      body: "Use your own words, the way you'd say it to an owner. Your answer saves by itself when you click away.",
      fallback: "section.bp-section",
    },
    {
      selector: '[aria-label="Open Ava"]',
      title: "Or talk it through with Ava",
      body: "Rather talk than type? Open Ava and she asks you the questions one at a time, then saves your answers for you.",
    },
    {
      selector: CHAT,
      title: "This page's chat",
      body: "Questions about this page go here. The BCA team sees them and replies right here.",
      fallback: CHAT_BUTTON,
      fallbackBody: "Tap Chat to ask the BCA team about this page. They reply right here.",
    },
    {
      selector: '[data-tour="blueprint-page-arrows"]',
      title: "Next page",
      body: "Use the arrows to move through your Blueprint one page at a time.",
    },
  ],

  "blueprint/Your Ideal Client": [
    {
      selector: STATUS,
      title: "Check it, then sign it off",
      body: "We fill this page in from your Blueprint Call. Read it, change anything that's off, then sign it off.",
    },
    {
      selector: "#s-market-options",
      title: "The markets we looked at",
      body: "Two or three markets, scored, with the one we recommend. Open it when you want to see why.",
    },
    {
      selector: "#s-market-persona",
      title: "One owner to write to",
      body: "The one person every message is written to: who they are, where they spend their time and how they think.",
    },
    {
      selector: "#s-market-world",
      title: "In their words",
      body: "What they say when they're fed up, and the words that put them off. Your messages use their words, so they feel understood.",
    },
    {
      selector: "#s-market-list",
      title: "Who goes on your list",
      body: "The kind of business, its size and the job titles we search for on LinkedIn. Your lead lists are built from this.",
    },
    {
      selector: "#s-market-pains",
      title: "Their pain points",
      body: "Written from what hurts them and what makes them act. Your campaigns, newsletter and call script all use it, so check it sounds like your clients.",
    },
  ],

  "blueprint/LinkedIn Profile": [
    {
      selector: '[aria-label="Which version"]',
      title: "Today and the new version",
      body: "Switch between your profile as owners see it now and the new one we wrote from your Blueprint.",
    },
    {
      selector: "#s-linkedin-rewrite",
      title: "Your new profile",
      body: "Your headline, About section and more, written for your ideal client and laid out as LinkedIn shows it. Click any part to change it.",
    },
    {
      selector: '[data-tour="linkedin-copy"]',
      title: "Copy it across",
      body: "Tap Copy on each part, then paste it into LinkedIn yourself. We never post to your profile.",
      fallback: "#s-linkedin-rewrite",
      fallbackBody: "Once your new profile is written, each part gets a Copy button. Paste it into LinkedIn yourself. We never post to your profile.",
    },
  ],

  "blueprint/Lead lists": [
    {
      selector: '[data-tour="blueprint-lists"]',
      title: "Who your campaigns go to",
      body: "We build lists of owners for you on LinkedIn. Each one shows here with how we found them and how many came in.",
    },
    {
      selector: '[data-tour="blueprint-open-in-app"]',
      title: "See the people",
      body: "Open the Pool to see everyone on your lists, check who fits and add them to a campaign.",
    },
  ],

  "blueprint/Campaigns": [
    {
      selector: "#s-campaigns-messaging",
      title: "Connection campaign",
      body: "A connection request with a short note, then five follow-ups over two weeks. This is how most coaches get their calls. Tap a message to read it.",
    },
    {
      selector: ".bp-handoff",
      title: "Happy with it? Send it to Get Calls",
      body: "This makes a draft campaign with these messages. Nothing sends until owners are added and you start it.",
      fallback: '[data-tour="blueprint-open-in-app"]',
      fallbackBody: "Once you've checked the messages, they go to Get Calls as a draft campaign. Nothing sends until you start it.",
    },
    {
      selector: "#s-campaigns-conversation",
      title: "People you know already",
      body: "Short messages for people you're connected with but have never spoken to. They start a chat and offer the free BOSS Score.",
    },
    {
      selector: "#s-campaigns-reactivation",
      title: "Old contacts",
      body: "Up to three messages for past colleagues and anyone who went quiet, to restart the conversation.",
    },
    {
      selector: '[data-tour="blueprint-open-in-app"]',
      title: "Where they run",
      body: "Your campaigns run in Get Calls. Open Campaigns to see them going out and who replies.",
    },
  ],

  "blueprint/Content": [
    {
      selector: "#s-content-info",
      title: "Your newsletter",
      body: "Its name, who it's for, what it promises, how often it goes out and where it sends readers. Every issue uses these.",
    },
    {
      selector: '#s-content-info a[href*="newsletters"]',
      title: "Write your issues",
      body: "The issues themselves live in Get Calls, under Newsletter. Tap here to go straight there.",
    },
    {
      selector: "#s-content-posts",
      title: "What you post about",
      body: "Your post topics, twelve ideas and two posts ready to go. They keep you in front of owners between campaigns.",
    },
  ],

  "blueprint/Your Offer": [
    {
      selector: "#s-offer-destination",
      title: "Where you take them",
      body: "What owners get more of, and less of, when they work with you. Make this clear and the rest is easier to sell.",
    },
    {
      selector: "#s-offer-method",
      title: "Your method",
      body: "Your own way of doing the work, if you have one: its name and steps. Your posts and campaigns lead with it. Leave it empty and we use the Profit System.",
    },
    {
      selector: "#s-offer-fee",
      title: "Price and terms",
      body: "What you charge and how clients pay. We draft it with you on your Blueprint Call, and you can change the numbers.",
    },
    {
      selector: "#s-offer-lines",
      title: "Your offer in three lengths",
      body: "How to say what you do in a line, a sentence and a paragraph, each marked with where to use it.",
    },
  ],

  "blueprint/Personalised Pitch": [
    {
      selector: "#s-sales-script",
      title: "What to say on the call",
      body: "Your pitch in your words, from the opening to the price, with answers to the doubts owners raise. Learn it once.",
    },
    {
      selector: '#s-sales-script [aria-label="More actions"]',
      title: "Copy it or ask for a change",
      body: "The three dots let you copy the pitch, or ask BCA to change something that doesn't sound like you. Every page BCA writes has them.",
    },
    {
      selector: '[aria-label="Open Ava"]',
      title: "Tailor it before a call",
      body: "Before a sales call, ask Ava to fit the pitch to that owner's biggest problem, so you use their own words back to them.",
    },
  ],
};
