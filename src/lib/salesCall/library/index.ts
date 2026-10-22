/**
 * Get Clients → Scripts: every script a coach needs with an owner, in funnel
 * order: getting the booking (reach out, new lead, booking objections), then
 * the two calls, then no-shows, which apply to both. Two calls, always: the BOSS Score Review gives value, the Profit
 * Roadmap call is where the owner decides. Agreed with Zander, 22 Oct 2026.
 */

import { NEW_LEAD_PARTS } from "./newLead";
import { NO_SHOW_PARTS } from "./noShows";
import { OBJECTIONS_PARTS } from "./objections";
import { REACH_OUT_PARTS } from "./reachOut";
import { REVIEW_PARTS } from "./review";
import type { ScriptPart } from "./types";

export type { ScriptPart } from "./types";

export type ScriptId = "reach-out" | "new-lead" | "review" | "roadmap" | "no-shows" | "objections";

export type ScriptCard = {
  id: ScriptId;
  title: string;
  /** Where it sits in the journey, above the title on the card. */
  eyebrow: string;
  /** The card's two lines, like a Classroom course. */
  blurb: string;
  /** Under the page title once it's open. */
  summary: string;
  /** Cover picture, drawn by scripts/covers/script-covers.mjs. */
  cover: string;
  eyebrowColour: string;
  icon: "send" | "phone" | "gauge" | "map" | "calendar" | "message";
  /** Cover colour. */
  colour: string;
  /** Static scripts have parts. The Profit Roadmap call is the live call screen. */
  parts: ScriptPart[] | null;
};

export const SCRIPTS: ScriptCard[] = [
  {
    id: "reach-out",
    title: "Reach out",
    eyebrow: "Outreach",
    blurb: "Cold call, email and LinkedIn scripts that book a BOSS Score Review.",
    summary: "Cold call, email, LinkedIn and messages to owners who don't know you yet. Every one books a BOSS Score Review.",
    cover: "/academy/scripts/reach-out.jpg",
    eyebrowColour: "#0c5290",
    icon: "send",
    colour: "#0c5290",
    parts: REACH_OUT_PARTS,
  },
  {
    id: "new-lead",
    title: "New lead call",
    eyebrow: "Leads",
    blurb: "Reach new leads fast, find out what they want, and book the review.",
    summary: "Someone took your BOSS Score or got in touch. Reach them fast, find out what they want, and book the review.",
    cover: "/academy/scripts/new-lead.jpg",
    eyebrowColour: "#0e7f9c",
    icon: "phone",
    colour: "#1f6fb2",
    parts: NEW_LEAD_PARTS,
  },
  {
    id: "objections",
    title: "Booking objections",
    eyebrow: "Pushback",
    blurb: "What to say when an owner pushes back on booking a call.",
    summary: "How to handle any objection, and what to say to each one before a call.",
    cover: "/academy/scripts/objections.jpg",
    eyebrowColour: "#0f766e",
    icon: "message",
    colour: "#475569",
    parts: OBJECTIONS_PARTS,
  },
  {
    id: "review",
    title: "BOSS Score Review",
    eyebrow: "Call 1",
    blurb: "Thirty minutes of real value, then book the Profit Roadmap call.",
    summary: "Real value first: their score, the one constraint, a £ number and one action. Then book the Profit Roadmap call.",
    cover: "/academy/scripts/review.jpg",
    eyebrowColour: "#0c5290",
    icon: "gauge",
    colour: "#06223d",
    parts: REVIEW_PARTS,
  },
  {
    id: "roadmap",
    title: "Profit Roadmap call",
    eyebrow: "Call 2",
    blurb: "Discovery, the plan, the investment and the close, with live notes.",
    summary: "Build on the review, then show the plan, the investment and the next step. Live notes and a pitch written around them.",
    cover: "/academy/scripts/roadmap.jpg",
    eyebrowColour: "#0e7f9c",
    icon: "map",
    colour: "#06223d",
    parts: null,
  },
  {
    id: "no-shows",
    title: "No-shows and reschedules",
    eyebrow: "Follow-up",
    blurb: "Get a real new time when someone misses or moves a call.",
    summary: "When they miss a call or ask to move it. Get a real new time, without chasing or guilt.",
    cover: "/academy/scripts/no-shows.jpg",
    eyebrowColour: "#0c5290",
    icon: "calendar",
    colour: "#475569",
    parts: NO_SHOW_PARTS,
  },
];

export function scriptById(id: string): ScriptCard | null {
  return SCRIPTS.find((s) => s.id === id) ?? null;
}
