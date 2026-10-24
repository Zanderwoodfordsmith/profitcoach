/*
 * Made-up data for the design options. One story runs through every
 * screen: Zander asks Ava to launch a connection campaign to owners of
 * manufacturing firms in Leeds, and she does the work, step by step.
 * Names and firms are invented.
 */

export const COACH = { first: "Zander", initials: "ZW" };

export const ASK = "Launch a connection campaign to manufacturing owners in Leeds";

export const PLAN_STEPS = [
  {
    label: "Find owners of £1M+ manufacturers in Leeds",
    detail: "Sales Navigator, 48 found",
  },
  {
    label: "Check each one fits your ideal client",
    detail: "41 fit, 7 too small",
  },
  {
    label: "Write the connection note from your Blueprint",
    detail: "Uses your Leeds story",
  },
  { label: "Build the campaign", detail: "Connect, then two follow-ups" },
  { label: "Ready for your yes", detail: "Nothing sends until you say so" },
];

export type Prospect = {
  name: string;
  role: string;
  firm: string;
  town: string;
  staff: string;
  revenue: string;
  fit: number;
  why: string;
  initials: string;
};

export const PROSPECTS: Prospect[] = [
  {
    name: "Sarah Mills",
    role: "Managing Director",
    firm: "Aire Valley Fabrications",
    town: "Leeds",
    staff: "34 staff",
    revenue: "£4.2M",
    fit: 92,
    why: "Posted last week about losing two weekends a month to quotes.",
    initials: "SM",
  },
  {
    name: "David Okafor",
    role: "Owner",
    firm: "Kirkstall Precision Ltd",
    town: "Leeds",
    staff: "22 staff",
    revenue: "£2.8M",
    fit: 88,
    why: "Second-generation owner. Hiring his first ops manager.",
    initials: "DO",
  },
  {
    name: "Helen Price",
    role: "Founder & CEO",
    firm: "Northern Coatings Group",
    town: "Wakefield",
    staff: "51 staff",
    revenue: "£7.5M",
    fit: 81,
    why: "Opened a second site this year. Still signs every PO.",
    initials: "HP",
  },
];

export const CONNECT_NOTE =
  "Hi Sarah, I work with owners of Leeds manufacturers who are stuck doing the quoting themselves. Your post about losing weekends to it rang true. Happy to connect?";

export const CAMPAIGN = {
  name: "Leeds manufacturers",
  type: "Connection campaign",
  people: 41,
  perDay: 15,
  steps: [
    { day: "Day 1", what: "Connection note" },
    { day: "Day 3", what: "Thanks for connecting" },
    { day: "Day 10", what: "Free BOSS Score offer" },
  ],
};

export const AWAY = [
  {
    title: "Sarah Mills replied",
    line: "She asked what it costs. I drafted an answer for you.",
    action: "Read and approve",
    fresh: true,
  },
  {
    title: "38 owners invited overnight",
    line: "Leeds manufacturers: 6 accepted so far.",
    action: "See who",
    fresh: true,
  },
  {
    title: "Call with David at 2pm",
    line: "His BOSS Score is 54. Your prep notes are ready.",
    action: "Open prep",
    fresh: false,
  },
];

export const HISTORY = [
  {
    when: "Today",
    items: ["Leeds manufacturers campaign", "Reply to Sarah Mills"],
  },
  {
    when: "Yesterday",
    items: ["LinkedIn post: the quoting trap", "Practise the pitch with a sceptical owner"],
  },
  {
    when: "This week",
    items: ["Fill in my Blueprint offer", "Who should I target first?", "Prep for David Okafor"],
  },
];
