import type { ResearchSnippet } from "@/lib/firstCampaign/researchMarketPains";

/**
 * Forum snippets for the pain research eval, written to look like what the
 * Reddit search returns (fictional posts, fictional links). Each set mixes
 * real owner pain with noise the extractor must drop: politics, employees
 * complaining about a boss, consumers, and spam. Running on fixed snippets
 * tests the extraction step on its own, with no live search and no cost
 * beyond the one model call.
 */

export type ResearchCase = {
  id: string;
  market: { industry: string; roleTitles: string[]; geography: string; teamSize?: string };
  snippets: (ResearchSnippet & { noise?: boolean })[];
  /** Thin sets should return a few quotes, not padding. */
  thin?: boolean;
};

const r = (id: string, sub: string, title: string, body: string, noise = false): ResearchSnippet & { noise?: boolean } => ({
  title,
  body,
  url: `https://www.reddit.com/r/${sub}/comments/${id}/`,
  source: `Reddit · r/${sub}`,
  score: 40,
  noise,
});

export const RESEARCH_CASES: ResearchCase[] = [
  {
    id: "accountancy-uk",
    market: { industry: "accountancy practice", roleTitles: ["Owner", "Managing Partner"], geography: "United Kingdom", teamSize: "10 to 40" },
    snippets: [
      r("a1", "UKAccounting", "Every January I swear it'll be different", "Every January I swear next year will be different and every January I'm doing 70 hour weeks again. We've got 14 staff and I'm still the one reviewing every single return before it goes out."),
      r("a2", "UKAccounting", "Haven't raised fees in 3 years", "I know we're undercharging. I haven't put our fees up in three years because I hate the conversation and I'm scared we'll lose the clients who've been with us since the start."),
      r("a3", "Accounting", "Can't hire qualified staff", "We can't find qualified staff at any price. Anyone decent gets poached by the bigger firms after 18 months and I'm back to training juniors again."),
      r("a4", "UKAccounting", "Practice owner burnout", "Running a practice is lonely. My partners leave at 5 and I'm the one answering client emails at 11pm. I started this to have freedom, now I have a job I can't quit."),
      r("a5", "smallbusinessuk", "Clients pay late, we fund them", "The irony of an accountancy practice with a cash flow problem. Half our clients pay us 60 days late and I'm basically their bank."),
      r("a6", "UKAccounting", "Scope creep is killing margin", "Fixed fees sounded great until every client started treating it as unlimited advice. Our margin on the bookkeeping clients is basically zero now."),
      r("a7", "Accounting", "Software migration hell", "We moved everything to the cloud last year and honestly half the team still does it the old way. I feel like I paid for software nobody uses."),
      r("n1", "ukpolitics", "Tax rises again", "This government is a joke. Every budget they hammer small businesses and then wonder why nobody wants to start one. Vote them out.", true),
      r("n2", "Accounting", "My boss is a nightmare", "My manager at my firm makes us work every Saturday in busy season and never says thank you. Thinking of quitting.", true),
      r("n3", "personalfinance", "My accountant overcharged me", "My accountant charged me £600 for a simple self assessment return. Is that normal? Feels like a rip off.", true),
      r("n4", "UKAccounting", "FREE practice growth webinar!!!", "Join our FREE webinar and 10x your practice revenue with our proven AI system. Limited spots, click the link in bio!", true),
    ],
  },
  {
    id: "hvac-uk",
    market: { industry: "HVAC and M&E contracting", roleTitles: ["Managing Director", "Owner"], geography: "United Kingdom", teamSize: "10 to 50" },
    snippets: [
      r("h1", "HVAC", "Busy all year, no money at the end", "We turned over £6m this year, the lads were flat out, and I've got less in the bank than when we did £4m. I genuinely don't know where it's going."),
      r("h2", "ConstructionUK", "Retentions", "We've got nearly £300k in retentions sitting with main contractors, some of it two years old. Nobody chases it because everyone's on the next job."),
      r("h3", "HVAC", "I'm the bottleneck", "Every site call comes to me. Pricing, ordering, the lot. I tried to go on holiday in August and spent half of it on the phone in the hotel car park."),
      r("h4", "electricians", "Pricing jobs", "We price to win the tender and then lose our shirt on variations. By the time the job's finished I can't even tell you if we made money on it."),
      r("h5", "ConstructionUK", "Can't keep good engineers", "Trained up three apprentices and two have gone to the bigger firms for an extra £2 an hour. Can't compete on wages."),
      r("h6", "HVAC", "Main contractor paid late again", "Main contractor is 90 days late on a £120k application and I've got wages to pay on Friday. This industry is broken."),
      r("n5", "HVAC", "Which brand of heat pump should I buy?", "Looking to get a heat pump for my 3 bed semi. Any recommendations on brands? Quotes are all over the place.", true),
      r("n6", "electricians", "My gaffer is useless", "My boss has no idea how to run a job. We spend half the day waiting for materials he forgot to order.", true),
      r("n7", "unitedkingdom", "Strikes", "Another week of rail strikes. The whole country is grinding to a halt and nobody in Westminster cares.", true),
    ],
  },
  {
    id: "laundry-thin",
    market: { industry: "commercial laundry", roleTitles: ["Owner"], geography: "United Kingdom" },
    thin: true,
    snippets: [
      r("l1", "smallbusinessuk", "Commercial laundry, energy bills", "Our gas bill for the laundry has tripled in two years. We do hotel linen and the contracts were priced before the energy spike, so every sheet we wash loses money."),
      r("l2", "smallbusinessuk", "Hotels squeezing us", "The big hotel groups keep pushing our prices down and paying later. I can't walk away because they're 60% of the business."),
      r("n8", "CasualUK", "Lost a sock in the laundrette", "Went to the laundrette and came back with one sock less. Where do they go??", true),
      r("n9", "LifeProTips", "Laundry hack", "LPT: put a dry towel in the dryer with wet clothes and they dry twice as fast.", true),
      r("n10", "smallbusinessuk", "Make £5k a month from home", "I make £5k a month from home with this simple trick. DM me for details.", true),
      r("n11", "ukpolitics", "Energy price cap", "The energy price cap is a scandal and the regulator is captured by the suppliers.", true),
    ],
  },
];
