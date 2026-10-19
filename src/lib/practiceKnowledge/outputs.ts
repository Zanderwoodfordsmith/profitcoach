import type { SectionUses } from "./blueprint";

/**
 * What the coach gets from the Blueprint: the finished things that leave it
 * (a profile, a campaign, a script, a website). Everything else BCA writes is
 * groundwork these are built on.
 *
 * An output that is a Blueprint section keeps its contract (`needs`, `uses`)
 * on the section. An output written somewhere else declares it here. The
 * admin flow map and each output's "Missing" line are drawn from these.
 */
export type BlueprintOutput = {
  id: string;
  title: string;
  /** The Blueprint section that holds it. Its contract lives on the section. */
  section?: string;
  /** Written sections it is built on, for outputs written outside the Blueprint. */
  needs?: string[];
  /** Answers and material it reads, for outputs written outside the Blueprint. */
  uses?: SectionUses;
  /** Reads every answer, not a chosen few. */
  readsAll?: boolean;
  /** The file that says how it is written. */
  method?: string;
  signOff: string;
  goesTo: string;
};

const SHARED_SUMMARY = ["voice:sound", "market:avatar", "market:pains", "offer:lines", "offer:direction", "story:bio"];

export const BLUEPRINT_OUTPUTS: BlueprintOutput[] = [
  {
    id: "linkedin",
    title: "LinkedIn profile",
    section: "linkedin:rewrite",
    needs: SHARED_SUMMARY,
    uses: {
      fields: ["identity.linkedin_visibility", "identity.linkedin_headline", "identity.linkedin_about", "proof.career_results"],
      sources: ["linkedin"],
    },
    method: "content/practice-skills/linkedin-profile.md",
    signOff: "BCA, then the coach pastes it in",
    goesTo: "LinkedIn",
  },
  { id: "campaigns:messaging", title: "Connection campaign", section: "campaigns:messaging", signOff: "BCA", goesTo: "Get Clients, as a draft campaign" },
  { id: "campaigns:conversation", title: "Messaging campaign", section: "campaigns:conversation", signOff: "BCA", goesTo: "Get Clients, as a draft campaign" },
  { id: "campaigns:reactivation", title: "Reactivation campaign", section: "campaigns:reactivation", signOff: "BCA", goesTo: "Get Clients, as a draft campaign" },
  { id: "campaigns:nurture", title: "Ongoing nurture", section: "campaigns:nurture", signOff: "BCA", goesTo: "Get Clients, as a draft campaign" },
  { id: "conversations:followup", title: "Replies", section: "conversations:followup", signOff: "The coach", goesTo: "Replies in Conversations" },
  { id: "campaigns:interested", title: "Reply interested", section: "campaigns:interested", signOff: "BCA", goesTo: "Get Clients, as a draft campaign" },
  { id: "market:criteria", title: "Prospect list", section: "market:criteria", signOff: "The coach", goesTo: "Sales Navigator list build and prospect search" },
  { id: "sales:value", title: "Value session and launch kit", section: "sales:value", signOff: "The coach", goesTo: "Launch emails, DMs and the calendar page" },
  { id: "content:newsletter", title: "LinkedIn newsletter", section: "content:newsletter", signOff: "The coach", goesTo: "The Newsletter tab in Get Clients, Content, then LinkedIn" },
  { id: "content:cover", title: "Newsletter cover", section: "content:cover", signOff: "The coach", goesTo: "The newsletter header image" },
  { id: "content:inbox", title: "Newsletter inbox note", section: "content:inbox", signOff: "The coach", goesTo: "LinkedIn inbox" },
  { id: "content:post", title: "Newsletter post", section: "content:post", signOff: "The coach", goesTo: "LinkedIn feed" },
  { id: "content:inmail", title: "Newsletter InMail", section: "content:inmail", signOff: "The coach", goesTo: "LinkedIn InMail" },
  { id: "content:article", title: "Newsletter article", section: "content:article", signOff: "The coach", goesTo: "LinkedIn articles" },
  { id: "sales:script", title: "Call script", section: "sales:script", signOff: "The coach", goesTo: "Sales calls" },
  { id: "offer:payment", title: "Proposal and payment", section: "offer:payment", signOff: "The coach", goesTo: "Proposals" },
  {
    id: "brochure",
    title: "90-day programme brochure",
    needs: ["story:bio", "offer:direction", "offer:lines"],
    uses: {
      fields: [
        "proof.problems_asked",
        "proof.client_results",
        "proof.career_results",
        "practice.help_with",
        "practice.offer_timeframe",
        "practice.delivery_format",
        "practice.min_fee",
      ],
    },
    method: "src/components/toolkit/ProgrammeBrochure.tsx",
    signOff: "The coach",
    goesTo: "Toolkit, to send or print",
  },
  {
    id: "website",
    title: "Coach website",
    needs: ["offer:lines", "offer:direction", "story:bio"],
    uses: { fields: ["proof.client_results", "proof.problems_asked"] },
    method: "src/app/site/[slug]",
    signOff: "Signed-off sections only, in production",
    goesTo: "/site/{slug}",
  },
  {
    id: "ai",
    title: "Everyday AI tools",
    needs: SHARED_SUMMARY,
    readsAll: true,
    method: "src/lib/practiceKnowledge/blueprintContext.ts",
    signOff: "None. Reads what is there",
    goesTo: "Profit Coach AI, Chrome extension, newsletter, the agent",
  },
];
