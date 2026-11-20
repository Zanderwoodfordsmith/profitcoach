/**
 * Paul's own domain, e.g. "www.beyondlean.com". Set NEXT_PUBLIC_BEYONDLEAN_DOMAIN at the switch-over and the site is
 * served at that domain's root (next.config.ts); until then it lives at theprofitcoach.com/beyondlean.
 */
export const BEYONDLEAN_DOMAIN = process.env.NEXT_PUBLIC_BEYONDLEAN_DOMAIN ?? "";
/** Where the site's pages start: "" on Paul's domain, "/beyondlean" on theprofitcoach.com. */
export const SITE_BASE = BEYONDLEAN_DOMAIN ? "" : "/beyondlean";
/** Every "Book a Constraint Call" button goes to the offer page, which has the calendar on it. */
export const BOOK_HREF = `${SITE_BASE}/constraint-call`;
/** Paul's booking calendar, shown on the offer page. */
export const BOOKING = { slug: "paul-swift", calendar: "discovery" };
/** The BOSS Score lives on theprofitcoach.com, so on Paul's domain the link goes there in full. */
export const SCORE_HREF = BEYONDLEAN_DOMAIN ? "https://www.theprofitcoach.com/score/paul-swift" : "/score/paul-swift";
export const PHONE = "07843 577771";
export const EMAIL = "paul@beyondlean.com";

/** Paul's career for the About timeline; each note comes from his story on the About page. */
export const CAREER = [
  { year: "1983", role: "Fitter on the shop floor", place: "Royal Ordnance", note: "Working on torpedoes. How work is done on the floor decides everything else." },
  { year: "1989", role: "Owner of a car sales and MOT business", place: "My own firm", note: "Every decision, every problem and every bill landed on me." },
  { year: "1994", role: "Production Director", place: "Profit up 500%", note: "Grew profit by 500%, freed up cash and cut stock right back." },
  { year: "1999", role: "Lean consultant", place: "Airbus UK", note: "Learned Lean the Toyota way and helped design culture change for 10,000 people." },
  { year: "2005", role: "Improvement lead, UK and Ireland", place: "Airline catering", note: "Helped get a business back on its feet after an industrial dispute." },
  { year: "2006", role: "Founder", place: "Beyondlean Ltd", note: "20 years with banks, insurers, energy firms and government teams." },
];

export const EXAMPLE_AREA_SCORES = [6.2, 5.4, 7.1, 4.9, 6.8, 5.6, 6.3, 6.9, 5.2, 6.5];
export const EXAMPLE_TOTAL = 62;

export const FOR = [
  "You own a UK business with a team, usually 10 to 50 people",
  "Every decision and problem still lands on you",
  "You're busy, but the profit doesn't show it",
  "You'll do your part and want results you can measure",
];

export const NOT_FOR = [
  "You aren't willing to change how you work yourself",
  "You want someone to take the business off your hands",
  "You're looking for a quick fix with no work from the team",
];

/** How the 30 minutes of a Constraint Call go. */
export const CALL_AGENDA = [
  { title: "Where your business is now", text: "Your score and your numbers." },
  { title: "Where you want it to be", text: "The profit, the time and the team you want." },
  { title: "What's holding it back", text: "The one thing that sets the pace for the rest." },
  { title: "What to do next", text: "One to three things, whether we work together or not." },
];
