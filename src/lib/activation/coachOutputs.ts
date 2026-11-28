/**
 * What every coach gets live (Customer Activation Ramp, agreed 28 Nov), with
 * where each piece comes from: the library template, the skill Ava writes it
 * with, and the page it lives on. Shown at Admin → Coaches → Journey → Outputs.
 *
 * Status is what the app does today. "Open" is what's still to decide.
 * Skill files are in the repo (no in-app editor yet), so they show as paths.
 */

import type { BuildStatus } from "./coachJourney";

export type OutputLink = { label: string; href: string };

export type CoachOutput = {
  id: string;
  name: string;
  what: string;
  custom: "Custom" | "Custom per person" | "Mostly standard" | "Standard";
  coachChecks: boolean;
  status: BuildStatus;
  /** Does Ava's launch chain draft it today? */
  inLaunchChain: boolean;
  templates: OutputLink[];
  skills: string[];
  pages: OutputLink[];
  open?: string;
};

export type OutputGroup = { id: string; name: string; outputs: CoachOutput[] };

const LIB = (id: string, label: string): OutputLink => ({ label, href: `/admin/campaign-library/${id}` });
const TO_CHECK: OutputLink = { label: "Launches → To check", href: "/admin?view=launch" };

export const COACH_OUTPUT_GROUPS: OutputGroup[] = [
  {
    id: "foundation",
    name: "Who they help and how they sound",
    outputs: [
      {
        id: "ideal-client",
        name: "Ideal client, market and pain points",
        what: "Who goes on their lists, the market options with scores, the walkthrough and the pains in the owner's words.",
        custom: "Custom",
        coachChecks: true,
        status: "live",
        inLaunchChain: true,
        templates: [],
        skills: ["content/practice-skills/avatar.md", "content/practice-skills/pain-points.md", "content/practice-skills/prospect-criteria.md"],
        pages: [TO_CHECK],
      },
      {
        id: "voice",
        name: "Voice guide",
        what: "How they sound, so every message and post reads like them.",
        custom: "Custom",
        coachChecks: true,
        status: "live",
        inLaunchChain: true,
        templates: [],
        skills: ["content/practice-skills/voice.md"],
        pages: [TO_CHECK],
      },
      {
        id: "proof",
        name: "Proof stories",
        what: "Career wins told as short stories, where they have them. Never invented.",
        custom: "Custom",
        coachChecks: true,
        status: "partly",
        inLaunchChain: false,
        templates: [],
        skills: ["content/practice-skills/story.md"],
        pages: [],
        open: "Not in the launch chain yet.",
      },
    ],
  },
  {
    id: "profile-lists",
    name: "LinkedIn profile",
    outputs: [
      {
        id: "profile",
        name: "LinkedIn profile",
        what: "Headline, About, banner line and featured links. Goes live first; the coach copies it across.",
        custom: "Custom",
        coachChecks: true,
        status: "live",
        inLaunchChain: true,
        templates: [],
        skills: ["content/practice-skills/linkedin-profile.md", "content/practice-skills/linkedin-profile/"],
        pages: [TO_CHECK],
      },
    ],
  },
  {
    id: "prospects",
    name: "Prospects: the lists every coach has",
    outputs: [
      {
        id: "list-all",
        name: "All",
        what: "Everyone imported, from any source. Nobody is messaged just for being here.",
        custom: "Standard",
        coachChecks: false,
        status: "live",
        inLaunchChain: false,
        templates: [],
        skills: [],
        pages: [],
      },
      {
        id: "lists",
        name: "Ideal client lists (Sales Navigator)",
        what: "2 to 6 lists, one per trade or market, each 300+ and together 1,000 to 2,500 or more. UK, 1 to 50 staff, owners and MDs. Ava checks 10 people a list and drops weak ones. Never the coach's own company. Some coaches add extra lists for their ideal avatar. Feeds Connect.",
        custom: "Custom",
        coachChecks: true,
        status: "live",
        inLaunchChain: true,
        templates: [],
        skills: ["src/lib/salesNavigator/prospectSearch/playbook.ts", "content/practice-skills/prospect-criteria.md"],
        pages: [TO_CHECK],
        open: "Needs Sales Navigator. Plans drafted on 20 Nov came before the size rules: redo them (job 318).",
      },
      {
        id: "connections",
        name: "Connections (smart)",
        what: "Everyone they're connected to on LinkedIn, imported once at launch. New connections show up by themselves (the same check that catches accepted invites LinkedIn missed). Where the coach tags VIP and Referral.",
        custom: "Standard",
        coachChecks: false,
        status: "live",
        inLaunchChain: false,
        templates: [],
        skills: [],
        pages: [],
        open: "Built 28 Nov: set up once, the first time Ava's launch chain runs after LinkedIn is connected (no Sales Navigator needed).",
      },
      {
        id: "owners-fit",
        name: "Connected owners (smart)",
        what: "Fills itself from Connections: owners, founders, MDs and CEOs at any size of company, fit Good or OK. Other directors at big firms are better as Referral. Nobody is messaged from it: it's the first place the coach looks to tag VIPs.",
        custom: "Standard",
        coachChecks: true,
        status: "live",
        inLaunchChain: false,
        templates: [],
        skills: [],
        pages: [],
        open: "Built 28 Nov: a ready-made smart list every coach gets at launch, with a new Job title rule.",
      },
      {
        id: "vip-list",
        name: "VIP (smart, by tag)",
        what: "Anyone the coach tags VIP: mostly from Connected owners, plus dream targets they invite by hand and quiet Connect accepts Ava suggests each week. Nothing is tagged for them. Feeds VIP.",
        custom: "Custom",
        coachChecks: true,
        status: "live",
        inLaunchChain: false,
        templates: [],
        skills: [],
        pages: [],
        open: "Built 28 Nov: made at launch, with a gauge (aim for 50 to start, 100+ is great). Coaches tag; nothing is tagged for them.",
      },
      {
        id: "people-i-know",
        name: "Referral (smart, by tag)",
        what: "Anyone the coach tags Referral: ex-colleagues, suppliers, advisers, and introducers such as accountants, solicitors and IFAs. The coach goes through Connections in their check session and tags who could refer; nothing is tagged for them. Feeds Referral.",
        custom: "Custom",
        coachChecks: true,
        status: "live",
        inLaunchChain: false,
        templates: [],
        skills: [],
        pages: [],
        open: "Built 28 Nov: made at launch, with a gauge (aim for 10, 20+ is great) and a Not using my network for now choice.",
      },
      {
        id: "blacklist",
        name: "Blacklist",
        what: "Competitors, clients and friends who must never be messaged.",
        custom: "Custom",
        coachChecks: true,
        status: "live",
        inLaunchChain: false,
        templates: [],
        skills: [],
        pages: [],
      },
    ],
  },
  {
    id: "campaigns",
    name: "The four campaigns",
    outputs: [
      {
        id: "connect",
        name: "Connect (cold)",
        what: "For people the coach isn't connected to yet: connection note and follow-ups to owners from the lists. The main way coaches get calls.",
        custom: "Custom",
        coachChecks: true,
        status: "live",
        inLaunchChain: true,
        templates: [LIB("b40effcb-cac6-44ec-a406-ba91b210b5dc", "Connection"), LIB("2eeae05c-1679-4209-b0a8-591dfb5239aa", "Tribe connection")],
        skills: ["content/practice-skills/connection-campaign.md", "content/practice-skills/connection-campaign/"],
        pages: [TO_CHECK],
      },
      {
        id: "vip",
        name: "VIP",
        what: "Personal messages to everyone the coach tags VIP: Ava drafts each one, the coach adds a voice note. VIP never sends invites. A dream target gets a hand-sent invite and VIP waits until they accept. When Connect finishes with a quiet accept, Ava suggests the best ones to tag VIP each week.",
        custom: "Custom per person",
        coachChecks: true,
        status: "partly",
        inLaunchChain: false,
        templates: [],
        skills: ["content/practice-skills/nurture.md (VIP nurture)"],
        pages: [],
        open: "Agreed 28 Nov. Not built: the VIP template, per-person drafts, the weekly suggestions, and waiting until someone accepts.",
      },
      {
        id: "referral",
        name: "Referral",
        what: "Everyone on the Referral list (tagged by the coach): a personal note, then \"who do you know?\". Introducers get their own wording. Optional.",
        custom: "Mostly standard",
        coachChecks: true,
        status: "partly",
        inLaunchChain: true,
        templates: [LIB("7e1ece70-ac96-4c04-b2ad-a7c29d29d3d9", "Warm network (starting point)")],
        skills: [],
        pages: [TO_CHECK],
        open: "Agreed 28 Nov. The chain drafts it as \"Existing connections\" for all connected owners; it should go only to the Referral list. The introducer wording isn't written.",
      },
      {
        id: "interested",
        name: "Interested",
        what: "Starts when someone says yes, finishes the BOSS Score or misses a call, from their stage in Pipeline: reply within the hour with two times, call the same day, reminders, 7-day follow-up.",
        custom: "Standard",
        coachChecks: true,
        status: "partly",
        inLaunchChain: false,
        templates: [LIB("f112ec52-8215-461f-9be4-4614fbf59b4d", "Positive replies")],
        skills: ["content/practice-skills/replies.md", "content/ai-knowledge/reply-copilot/"],
        pages: [],
        open: "Reply alerts and Ava's drafts work. Starting the follow-up by itself isn't built.",
      },
      {
        id: "recontact",
        name: "Monthly re-contact",
        what: "Once a month, from Pipeline: people who did the BOSS Score but didn't book, no-shows and quiet chats.",
        custom: "Mostly standard",
        coachChecks: false,
        status: "partly",
        inLaunchChain: false,
        templates: [LIB("77616adc-35bf-439c-94f6-2377fe02d270", "Reactivation"), LIB("a2f3cc44-fa65-4d09-a7f5-ccd64fe22e41", "Ongoing nurture")],
        skills: ["content/practice-skills/nurture.md"],
        pages: [],
        open: "Templates exist; the monthly list doesn't.",
      },
    ],
  },
  {
    id: "content",
    name: "Content",
    outputs: [
      {
        id: "newsletters",
        name: "6 newsletters",
        what: "One every two weeks for 12 weeks, all drafted up front, with covers.",
        custom: "Custom",
        coachChecks: true,
        status: "partly",
        inLaunchChain: false,
        templates: [],
        skills: ["content/practice-skills/linkedin-newsletter.md"],
        pages: [],
        open: "Coaches can draft them in the Newsletter tab; Ava doesn't draft all six at launch yet.",
      },
      {
        id: "posts",
        name: "Posts for 12 weeks",
        what: "3 to 5 a week, all drafted up front, adjusted later if needed.",
        custom: "Custom",
        coachChecks: true,
        status: "partly",
        inLaunchChain: false,
        templates: [],
        skills: ["content/practice-skills/content.md"],
        pages: [],
        open: "Not in the launch chain yet.",
      },
    ],
  },
  {
    id: "pages",
    name: "Pages and alerts",
    outputs: [
      {
        id: "booking",
        name: "Booking page and Constraint Call page",
        what: "Where owners book, with the coach's details and calendar.",
        custom: "Standard",
        coachChecks: true,
        status: "live",
        inLaunchChain: false,
        templates: [],
        skills: [],
        pages: [{ label: "Calls → Booking pages", href: "/admin/calls" }],
      },
      {
        id: "boss-link",
        name: "BOSS Score link",
        what: "Their own BOSS Score link, for the profile, banner, posts and replies.",
        custom: "Standard",
        coachChecks: false,
        status: "live",
        inLaunchChain: false,
        templates: [],
        skills: [],
        pages: [],
      },
      {
        id: "alerts",
        name: "Reply alerts",
        what: "Their phone hears the moment someone replies, with Ava's draft ready.",
        custom: "Standard",
        coachChecks: false,
        status: "live",
        inLaunchChain: false,
        templates: [],
        skills: [],
        pages: [],
      },
    ],
  },
];
