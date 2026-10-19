import type { LinkedInExperience, LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import type { CoachAiContext } from "@/lib/profitCoachAi/types";
import { emptyPracticePayload } from "@/lib/practiceKnowledge/sourced";
import type {
  BlueprintBlock,
  BuiltSection,
  KnowledgeSource,
  PracticeKnowledgePayload,
  PracticeKnowledgeRow,
  Sourced,
} from "@/lib/practiceKnowledge/types";

import hvacSections from "./hvac-sections.json";

/**
 * Fictional test coaches for Ava's evals. Every fact here is made up, so the
 * cases can live in the repo. Each coach tests different rules:
 *
 * - hvac: the happy path. Public, career proof with real numbers, direct voice.
 * - discreet: still employed, so LinkedIn must never say "coach". Her result
 *   has no numbers, so Ava must leave a placeholder, not invent one. Warm
 *   voice, names a hobby and a book (allowed in nurture, never invented).
 * - us_msp: works in dollars, client proof with numbers, boot camp voice,
 *   names no hobby (so none may appear).
 *
 * Human-written, not model output. The HVAC upstream sections are the
 * Zander Demo Blueprint's (fictional), copied as they were on 18 Oct 2026.
 */

export type EvalCoach = {
  id: "hvac" | "discreet" | "us_msp";
  label: string;
  coachName: string;
  tests: string[];
  discreet: boolean;
  row: PracticeKnowledgeRow;
  snapshot: LinkedInProfileSnapshot;
  brain: CoachAiContext;
};

const AT = "2026-10-01T00:00:00Z";
const s = <T>(value: T, source: KnowledgeSource = "interview"): Sourced<T> => ({ value, source, updated_at: AT });

function experience(e: Partial<LinkedInExperience> & { title: string; company: string }): LinkedInExperience {
  return {
    industry: null,
    location: null,
    start: null,
    end: null,
    duration: null,
    description: null,
    employmentType: null,
    workplaceType: null,
    experienceGroupId: null,
    skills: [],
    ...e,
  };
}

function snapshot(p: Partial<LinkedInProfileSnapshot> & { fullName: string }): LinkedInProfileSnapshot {
  const [firstName, ...rest] = p.fullName.split(" ");
  return {
    linkedinUrl: null,
    publicIdentifier: null,
    firstName: firstName ?? null,
    lastName: rest.join(" ") || null,
    headline: null,
    about: null,
    photoUrl: "https://example.com/photo.jpg",
    bannerUrl: null,
    location: null,
    connectionsCount: null,
    followerCount: null,
    experiences: [],
    education: [],
    skills: [],
    featured: [],
    ...p,
  };
}

function row(coachId: string, payload: PracticeKnowledgePayload, sections: Record<string, BuiltSection>): PracticeKnowledgeRow {
  return {
    coach_id: coachId,
    status: "decision_recorded",
    payload,
    linkedin_seeded_at: AT,
    form_completed_at: AT,
    interview_completed_at: AT,
    coach_reviewed_at: AT,
    admin_reviewed_at: AT,
    completeness_score: 90,
    missing_fields: [],
    report_payload: null,
    report_generated_at: null,
    built_sections: sections,
    created_at: AT,
    updated_at: AT,
  };
}

const section = (blocks: BlueprintBlock[]): BuiltSection => ({ blocks, generated_at: AT, model: "fixture", edited_at: null });

// ---------------------------------------------------------------- hvac

function hvacPayload(): PracticeKnowledgePayload {
  const p = emptyPracticePayload();
  p.identity.linkedin_visibility = s("public");
  p.identity.location = s("Leeds, England, United Kingdom", "linkedin");
  p.identity.timezone = s("Europe/London");
  p.identity.linkedin_url = s("https://www.linkedin.com/in/zander-webb-8b31a2c4", "linkedin");
  p.working_times.prospect_call_hours = s("Mondays and Thursdays from 13:00");
  p.practice.min_fee = s("£1,950 per month");
  p.practice.capacity = s("8");
  p.practice.delivery_model = s("hybrid");
  p.practice.voice_known_for = s("Straight talking. Someone who has actually run the operation.");
  p.practice.voice_coaching_style = s("Kick up the backside, but on your side");
  p.practice.voice_never = s("Corporate waffle, 'unlock your potential', anything that sounds like a seminar");
  p.market.industries_credibility = s(["HVAC contractors", "M&E firms", "electrical contractors", "facilities management"]);
  p.market.industries_worked = s(["Building services"], "linkedin");
  p.market.roles_held = s(["Project Engineer", "Contracts Manager", "Operations Director"], "linkedin");
  p.market.buyer_roles = s(["MD", "Owner"]);
  p.market.avoid = s(["start-ups", "clients wanting a quick fix without commitment", "businesses under £1m turnover"]);
  p.client.says = s(["We're busy but I don't know where the money's going", "I can't get off the tools long enough to run the business", "Retentions are killing our cash"]);
  p.client.words_avoid = s(["synergy", "mindset", "journey"]);
  p.client.objections = s(["I've had consultants in before and nothing changed", "I can't afford it right now", "No one understands contracting"]);
  p.proof.career_results = s([
    {
      id: "r1",
      role: "Operations Director (HVAC division)",
      company: "Harlow & Pike",
      metric_from: "£4.2m revenue",
      metric_to: "£11.8m revenue",
      timeframe: "5 years",
      mechanism: "Shifted the model from one-off installs to planned maintenance contracts and tightened job pricing, holding margin through growth",
      proof_type: "career",
      precise: true,
    },
  ]);
  p.proof.problems_asked = s([
    "Margin bleed: winning work but profit disappearing and owners not knowing why",
    "Owner dependency: MD stuck in the middle answering every site call",
    "Cash flow: retentions sitting unpaid for months with nobody chasing",
  ]);
  p.proof.superpowers = s(
    "Has run the operation himself. Turns lived experience of retentions, job costing and margin bleed into a weekly numbers rhythm that shows owners problems before they become crises."
  );
  p.proof.uniqueness = s("Hands-on operator, not an accountant or consultant. Sits in on job reviews and pricing from week one.");
  return p;
}

const hvac: EvalCoach = {
  id: "hvac",
  label: "Zander Webb, HVAC and M&E (public, career proof)",
  coachName: "Zander Webb",
  tests: ["happy path", "career proof with numbers", "direct voice", "trades vocabulary"],
  discreet: false,
  row: row("00000000-0000-4000-8000-0000000000a1", hvacPayload(), hvacSections as unknown as Record<string, BuiltSection>),
  snapshot: snapshot({
    fullName: "Zander Webb",
    publicIdentifier: "zander-webb-8b31a2c4",
    headline: "Business Coach | Former Operations Director",
    about:
      "Experienced operations leader with a background in building services. I now work with business owners to help them grow. Passionate about people, process and performance. Get in touch to find out more.",
    location: "Leeds, England, United Kingdom",
    connectionsCount: 640,
    followerCount: 655,
    experiences: [
      experience({ title: "Business Coach", company: "Webb Profit Coaching", start: "Jan 2025", end: "Present", duration: "1 yr 10 mos" }),
      experience({
        title: "Operations Director",
        company: "Harlow & Pike Building Services",
        start: "Mar 2017",
        end: "Dec 2024",
        duration: "7 yrs 10 mos",
        description: "Led the HVAC division from £4.2m to £11.8m revenue over five years. Moved the business to planned maintenance contracts.",
      }),
      experience({ title: "Contracts Manager", company: "Harlow & Pike Building Services", start: "Jun 2012", end: "Feb 2017", duration: "4 yrs 9 mos" }),
      experience({ title: "Project Engineer", company: "Northgate M&E", start: "Sep 2006", end: "May 2012", duration: "5 yrs 9 mos" }),
    ],
  }),
  brain: {
    superpowers: "Has run a building services operation. Weekly numbers rhythm for contractors.",
    ideal_client: "MDs of HVAC and M&E contractors, £2m to £12m turnover, North of England and Midlands.",
    pain_language: "Busy but no profit. Stuck in the middle. Retentions unpaid.",
    client_results: [],
  },
};

// ---------------------------------------------------------------- discreet

function discreetPayload(): PracticeKnowledgePayload {
  const p = emptyPracticePayload();
  p.identity.linkedin_visibility = s("discreet");
  p.identity.location = s("Bristol, England, United Kingdom", "linkedin");
  p.identity.timezone = s("Europe/London");
  p.working_times.prospect_call_hours = s("Tuesday and Thursday evenings, 18:00 to 20:00");
  p.practice.min_fee = s("£1,200 per month");
  p.practice.capacity = s("4");
  p.practice.delivery_model = s("advisory");
  p.practice.voice_known_for = s("Calm, kind and practical. The person who makes the numbers feel less scary.");
  p.practice.voice_coaching_style = s("Hugs more than boot camp. Patient, then firm when it matters.");
  p.practice.voice_hobbies = s(["Dinghy sailing on weekends"]);
  p.practice.voice_favourite_book = s("The Goal by Eliyahu Goldratt, because it made bottlenecks make sense to me");
  p.practice.voice_values = s(["Honesty", "Patience", "Doing the boring things well"]);
  p.market.industries_credibility = s(["independent accountancy practices", "bookkeeping firms"]);
  p.market.industries_worked = s(["Accountancy"], "linkedin");
  p.market.roles_held = s(["Practice Manager", "Finance Director"], "linkedin");
  p.market.buyer_roles = s(["Practice owner", "Managing Partner"]);
  p.market.avoid = s(["the Big Four", "sole practitioners with no staff"]);
  p.client.says = s([
    "We're drowning every January and nothing changes",
    "I'm the bottleneck on every file review",
    "Our fees haven't gone up in three years because I hate the conversation",
  ]);
  p.client.words_avoid = s(["hustle", "crush it"]);
  p.client.objections = s(["We tried a practice consultant once", "Now isn't a good time with tax season coming"]);
  p.proof.career_results = s([
    {
      id: "r1",
      role: "Practice Manager",
      company: "Calder & Rowe Chartered Accountants",
      metric_from: "",
      metric_to: "",
      timeframe: "",
      mechanism: "Rebuilt the month-end close and moved clients onto fixed monthly fees, so the partners stopped working every January weekend",
      proof_type: "career",
      precise: false,
    },
  ]);
  p.proof.problems_asked = s(["Partners stuck reviewing every file", "Pricing that has not moved in years", "January chaos every year"]);
  p.proof.superpowers = s("Turns a chaotic practice into a calm one with simple workflow and pricing changes the team will actually follow.");
  return p;
}

const discreetSections: Record<string, BuiltSection> = {
  "voice:sound": section([
    { type: "lede", text: "Helen sounds like the calm person in a busy office: kind, practical and quietly sure of herself." },
    { type: "heading", text: "Sounds like" },
    {
      type: "bullets",
      items: [
        "Let's take one thing off your plate this month and see how that feels.",
        "January doesn't have to be a war. It's usually three small fixes.",
        "You're not bad at pricing. You just hate the conversation, and that's fixable.",
      ],
    },
    { type: "heading", text: "Does not sound like" },
    { type: "bullets", items: ["Crush your targets!", "Scale to seven figures", "Anything shouty or salesy"] },
  ]),
  "market:avatar": section([
    { type: "lede", text: "Overstretched Olivia: owner of a 15-person accountancy practice in the South West" },
    {
      type: "pairs",
      items: [
        { label: "Business", value: "Independent accountancy practice, 10 to 25 staff" },
        { label: "Role", value: "Founder and managing partner" },
      ],
    },
    { type: "heading", text: "In her words" },
    { type: "quote", text: "Every January I swear it'll be different next year. It never is. And I'm still the one checking every file." },
  ]),
  "market:pains": section([
    { type: "lede", text: "I'm the bottleneck in my own practice, and I don't know how to stop." },
    {
      type: "table",
      columns: ["Pain", "What they say out loud", "What it costs", "What they want instead", "Lever"],
      rows: [
        ["Owner reviews everything", "Nothing goes out without me seeing it", "Evenings and weekends", "A team she trusts to sign off", "Team and leadership"],
        ["Fees stuck", "We haven't put prices up in years", "Margin", "Confident fee conversations", "Average sale value"],
        ["January crunch", "We drown every January", "Health, staff turnover", "An even year", "Operations"],
      ],
    },
  ]),
};

const discreet: EvalCoach = {
  id: "discreet",
  label: "Helen Marsh, accountancy practices (discreet, no numbers)",
  coachName: "Helen Marsh",
  tests: ["discreet: never say coach on LinkedIn", "result without numbers: placeholder, no invention", "warm voice", "hobby and book allowed only where they fit"],
  discreet: true,
  row: row("00000000-0000-4000-8000-0000000000a2", discreetPayload(), discreetSections),
  snapshot: snapshot({
    fullName: "Helen Marsh",
    publicIdentifier: "helenmarsh",
    headline: "Finance Director",
    about: "Finance professional with experience across accountancy and professional services.",
    location: "Bristol, England, United Kingdom",
    connectionsCount: 1180,
    followerCount: 1200,
    bannerUrl: "https://example.com/banner.jpg",
    experiences: [
      experience({ title: "Finance Director", company: "Westbury Logistics Ltd", start: "Apr 2022", end: "Present", duration: "4 yrs 7 mos" }),
      experience({
        title: "Practice Manager",
        company: "Calder & Rowe Chartered Accountants",
        start: "Feb 2013",
        end: "Mar 2022",
        duration: "9 yrs 2 mos",
        description: "Ran operations for a growing practice. Introduced fixed monthly fees and a new month-end process.",
      }),
    ],
  }),
  brain: { superpowers: "Calm workflow and pricing changes for accountancy practices.", client_results: [] },
};

// ---------------------------------------------------------------- us_msp

function usPayload(): PracticeKnowledgePayload {
  const p = emptyPracticePayload();
  p.identity.linkedin_visibility = s("public");
  p.identity.location = s("Austin, Texas, United States", "linkedin");
  p.identity.country = s("United States");
  p.identity.timezone = s("America/Chicago");
  p.working_times.prospect_call_hours = s("Weekdays 9am to 11am Central");
  p.practice.min_fee = s("$2,500 per month");
  p.practice.capacity = s("10");
  p.practice.delivery_model = s("coaching");
  p.practice.voice_known_for = s("No excuses. Numbers on the table every week.");
  p.practice.voice_coaching_style = s("Boot camp. Direct, fast, holds people to what they said they would do.");
  p.practice.voice_never = s("Fluffy, therapy-speak, long-winded");
  p.market.industries_credibility = s(["managed IT service providers (MSPs)", "IT support companies"]);
  p.market.industries_worked = s(["IT services"], "linkedin");
  p.market.roles_held = s(["Service Desk Manager", "VP Operations"], "linkedin");
  p.market.buyer_roles = s(["Owner", "CEO"]);
  p.market.avoid = s(["break-fix shops with no recurring revenue", "MSPs under 8 staff"]);
  p.client.says = s([
    "Our techs are slammed but margins keep shrinking",
    "We're still selling on price against the cheap guys",
    "I can't step away for a week without tickets piling up",
  ]);
  p.client.words_avoid = s(["synergy", "digital transformation"]);
  p.client.objections = s(["We already have a peer group", "Money is tight until Q1"]);
  p.proof.client_results = s([
    {
      id: "c1",
      title: "Dallas MSP, 30 staff",
      story: "Helped a 30-person MSP in Dallas grow from $3.1M to $4.6M in annual recurring revenue in 14 months by repricing their managed services contracts per seat and cutting unprofitable clients.",
    },
  ]);
  p.proof.career_results = s([
    {
      id: "r1",
      role: "VP Operations",
      company: "Lonestar Managed IT",
      metric_from: "62% ticket first-response SLA",
      metric_to: "94% ticket first-response SLA",
      timeframe: "18 months",
      mechanism: "Rebuilt the service desk around tiered queues and weekly scorecards",
      proof_type: "career",
      precise: true,
    },
  ]);
  p.proof.problems_asked = s(["Shrinking margins on managed services", "Owner stuck in the tickets", "Competing on price"]);
  p.proof.superpowers = s("Turns a reactive MSP into a priced, measured one: per-seat pricing and a weekly scorecard every tech can see.");
  return p;
}

const usSections: Record<string, BuiltSection> = {
  "voice:sound": section([
    { type: "lede", text: "Dave sounds like a coach on the sideline: short sentences, clear asks, no fluff." },
    { type: "heading", text: "Sounds like" },
    { type: "bullets", items: ["What's your gross margin per seat? If you don't know, that's job one.", "You said Friday. It's Friday.", "Price for the value, not against the cheap guys."] },
  ]),
  "market:avatar": section([
    { type: "lede", text: "Ticket-Bound Tom: owner of a 25-person MSP in Texas" },
    { type: "pairs", items: [{ label: "Business", value: "Managed IT services, 15 to 40 staff" }, { label: "Role", value: "Founder and CEO" }] },
    { type: "heading", text: "In his words" },
    { type: "quote", text: "We're growing seats every month but somehow I'm making less. And I'm still the escalation point for every angry client." },
  ]),
  "market:pains": section([
    { type: "lede", text: "We're busier than ever and making less money." },
    {
      type: "table",
      columns: ["Pain", "What they say out loud", "What it costs", "What they want instead", "Lever"],
      rows: [
        ["Shrinking margin", "Margins keep shrinking", "Profit", "Priced contracts", "Profit margin"],
        ["Owner in the tickets", "I'm the escalation point", "Time, burnout", "A service desk that runs itself", "Operations"],
        ["Price competition", "We sell on price", "Margin, bad-fit clients", "Win on value", "Average sale value"],
      ],
    },
  ]),
};

const usMsp: EvalCoach = {
  id: "us_msp",
  label: "Dave Kowalski, US managed IT providers (dollars, client proof)",
  coachName: "Dave Kowalski",
  tests: ["currency is dollars", "client proof with numbers", "boot camp voice", "no hobby named, so none appears"],
  discreet: false,
  row: row("00000000-0000-4000-8000-0000000000a3", usPayload(), usSections),
  snapshot: snapshot({
    fullName: "Dave Kowalski",
    publicIdentifier: "dave-kowalski-77213",
    headline: "Coach | Speaker | Helping businesses succeed",
    about: "",
    location: "Austin, Texas, United States",
    connectionsCount: 2210,
    followerCount: 2300,
    experiences: [
      experience({ title: "Owner", company: "Kowalski Coaching LLC", start: "Jun 2023", end: "Present", duration: "3 yrs 5 mos" }),
      experience({
        title: "VP Operations",
        company: "Lonestar Managed IT",
        start: "Jan 2016",
        end: "May 2023",
        duration: "7 yrs 5 mos",
        description: "Ran the service desk and field teams. Took first-response SLA from 62% to 94% in 18 months.",
      }),
    ],
  }),
  brain: {
    superpowers: "Per-seat pricing and weekly scorecards for MSPs.",
    client_results: [{ title: "Dallas MSP", story: "From $3.1M to $4.6M ARR in 14 months by repricing per seat." }],
  },
};

export const EVAL_COACHES: EvalCoach[] = [hvac, discreet, usMsp];

export function evalCoach(id: EvalCoach["id"]): EvalCoach {
  const coach = EVAL_COACHES.find((c) => c.id === id);
  if (!coach) throw new Error(`No eval coach ${id}`);
  return coach;
}
