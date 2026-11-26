import type { PageTourStep } from "./types";

/**
 * Kept short on purpose (Zander, 26 Nov): the coach mainly needs to fill in
 * About You and follow the checklist. BCA builds the other pages.
 */

export const BLUEPRINT_TOURS: Record<string, PageTourStep[]> = {
  "blueprint/Overview": [
    {
      selector: 'section[aria-labelledby="bp-checklist"]',
      title: "Your checklist",
      body: "Your first steps, in order. Work down the list and you're ready to launch.",
    },
    {
      selector: '[data-tour="blueprint-yours"]',
      title: "Your part: About You",
      body: "The one page you fill in. Start here, because every other page is built from it.",
    },
    {
      selector: '[data-tour="blueprint-bca-pages"]',
      title: "The pages BCA builds",
      body: "Your ideal client, LinkedIn profile, lead lists, campaigns, content, offer and pitch. We write them for you, then you check each one.",
    },
  ],

  "blueprint/About You": [
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
  ],
};
