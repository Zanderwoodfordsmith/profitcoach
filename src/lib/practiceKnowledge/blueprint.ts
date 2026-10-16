import { labelMissingField } from "./completeness";
import { isFilledSourced } from "./sourced";
import type { PracticeKnowledgePayload, PracticeKnowledgeRow, Sourced } from "./types";

/**
 * The Practice Blueprint map: grouped by business area. Groups hold pages,
 * pages hold sections. The sidebar lists it, the admin map lists it, the AI
 * conversation asks for its open "From you" fields, and the Markdown export
 * walks it in order.
 *
 * The rule for what belongs here: what is true about this coach, what they
 * decided, and what BCA built from it. Anything the same for every coach
 * lives in the Classroom and is linked from the page (`learn`). Anything that
 * changes daily lives in the software and is linked from the section (`link`).
 */
export const SECTION_SOURCES = {
  imported: {
    label: "Imported",
    hint: "Pulled from LinkedIn or sign-up. The coach only checks it.",
  },
  from_you: {
    label: "From you",
    hint: "The coach tells us, in the conversation or by typing it in.",
  },
  we_build: {
    label: "Written by BCA",
    hint: "BCA writes it from the blueprint. The coach can edit it.",
  },
} as const;

export type SectionSource = keyof typeof SECTION_SOURCES;

type Group = Exclude<keyof PracticeKnowledgePayload, "review">;

export type FieldKind = "text" | "longtext" | "list" | "results" | "stories" | "enum";

/** One captured fact inside a section, stored at payload[group][key]. */
export type FieldSpec = {
  path: `${Group}.${string}`;
  label: string;
  kind: FieldKind;
  /** The section counts as open until every required field is filled. */
  required?: boolean;
  /** How the AI conversation asks for it. */
  ask?: string;
  /** Shown in the empty box so the coach can see what a good answer looks like. */
  example?: string;
  /** Shown in the empty box instead of the example, for things we import rather than ask. */
  placeholder?: string;
  /** Behind the info icon: why we ask, and where it is used. */
  help?: string;
  options?: { value: string; label: string }[];
};

export type BlueprintSection = {
  id: string;
  title: string;
  source: SectionSource;
  /** Behind the info icon, in plain words: what this is for. */
  about?: string;
  /** BCA's recommended default, shown above the boxes. */
  tip?: string;
  /** What the section is built from. Shown on the admin map and behind the info icon. */
  from?: string[];
  /** Where the section is used once it is ready. Shown on the admin map and behind the info icon. */
  feeds?: string;
  /** Imported and From you sections: the facts they hold. */
  fields?: FieldSpec[];
  /** Written sections: other sections ("page:id") that should exist first. */
  needs?: string[];
  /** Where this runs once it is live, so it is never copied in two places. */
  link?: { href: string; label: string };
};

export type BlueprintGroup = {
  label: string;
  /** Short line under the chapter title in the document. */
  intro: string;
  pages: BlueprintLink[];
};

export type ClassroomLink = { label: string; href: string };

export type BlueprintLink = {
  slug: string;
  title: string;
  href: string;
  heading: string;
  summary: string;
  sections: BlueprintSection[];
  /** The how-to for this page, in the Classroom. Linked, not copied. */
  learn?: ClassroomLink[];
};

const HOURS_OPTIONS = [
  { value: "under_2_hours", label: "Under 2 hours a week" },
  { value: "2_5_hours_week", label: "2 to 5 hours a week" },
  { value: "5_10_hours_week", label: "5 to 10 hours a week" },
  { value: "10_15_hours_week", label: "10 to 15 hours a week" },
  { value: "15_plus_hours_week", label: "15 or more hours a week" },
];

const CLASSROOM = "/coach/academy/classroom";

/** Pages with their own view instead of sections. */
export const SPECIAL_PAGES = ["command", "decisions", "blueprint"] as const;

export const BLUEPRINT_GROUPS: BlueprintGroup[] = [
  {
    label: "Start here",
    intro: "Where you are, what we agreed, and what happens next.",
    pages: [
      {
        slug: "command",
        title: "Command Center",
        href: "/coach/practice",
        heading: "Your next best action",
        summary: "Where you are, what BCA is building, and the one thing that needs you.",
        sections: [],
      },
      {
        slug: "decisions",
        title: "Your Decisions",
        href: "/coach/practice/decisions",
        heading: "The decisions everything is built from",
        summary: "One market, one offer, one price and one campaign. BCA proposes them, and we agree them together on your Decision Call.",
        sections: [],
      },
      {
        slug: "ninety",
        title: "Your First 90 Days",
        href: "/coach/practice/ninety",
        heading: "Know exactly what happens next",
        summary: "The objective, the weekly numbers, and this week.",
        sections: [
          {
            id: "quarter",
            title: "Your 90-day launch plan",
            source: "we_build",
            about: "Your plan for the first quarter: the goal, the weekly numbers that get you there, and what to do this week.",
            from: ["Your offer", "Price and terms", "When you take calls"],
            feeds: "Your weekly check-ins with BCA",
            needs: ["offer:direction"],
          },
        ],
      },
      {
        slug: "blueprint",
        title: "The Whole Blueprint",
        href: "/coach/practice/blueprint",
        heading: "The Practice Blueprint",
        summary: "Everything in one document. Read it, print it, or download it for your own AI.",
        sections: [],
      },
    ],
  },
  {
    label: "Foundation",
    intro: "Who you are, what you have done, and how you sound.",
    pages: [
      {
        slug: "setup",
        title: "Practice Setup",
        href: "/coach/practice/setup",
        heading: "The basics we need to set you up",
        summary: "How clients reach you, when you take calls, and where your practice lives online.",
        sections: [
          {
            id: "contact",
            title: "Phone and contact details",
            source: "imported",
            about: "How BCA and your clients reach you. Pulled from your sign-up and LinkedIn, so you only check it.",
            from: ["Sign-up form: phone", "LinkedIn: location", "Conversation, if missing"],
            feeds: "Booking page, reminders, BCA team",
            fields: [
              { path: "identity.phone", label: "Phone", kind: "text", required: true, example: "07700 900123", help: "For booking reminders and for the BCA team. Never shown on your public pages.", ask: "What is the best mobile number for us and for booking reminders?" },
              { path: "identity.whatsapp", label: "WhatsApp", kind: "text", example: "Same as my mobile", help: "So we can send quick updates while your campaign is going live." },
              { path: "identity.location", label: "Location", kind: "text", example: "Leeds, UK", help: "Used for your booking page and to target owners near you if you want local clients." },
              { path: "identity.timezone", label: "Time zone", kind: "text", example: "UK time", help: "So booked calls land at the right time." },
            ],
          },
          {
            id: "calls",
            title: "When you take calls",
            source: "from_you",
            about: "The times your booking page offers, so calls never land when you are busy.",
            from: ["Conversation: client call times, prospect call times, hours a week"],
            feeds: "Booking page calendar",
            fields: [
              { path: "working_times.preferred_hours", label: "Client sessions", kind: "text", required: true, example: "Tuesdays and Thursdays, 9am to 3pm", help: "Most coaches stack clients on the same days so the rest of the week stays free.", ask: "Which days and times do you want to run client sessions?" },
              { path: "working_times.prospect_call_hours", label: "Prospect calls", kind: "text", required: true, example: "Weekdays 12pm to 2pm, and Wednesday evenings", help: "The slots new prospects can book. More slots means more calls booked.", ask: "When can you take calls with new prospects?" },
              { path: "working_times.hours_per_week", label: "Time on the practice", kind: "enum", options: HOURS_OPTIONS, help: "Sets the pace of your campaigns and your 90-day plan.", ask: "How many hours a week can you give the practice right now?" },
            ],
          },
          {
            id: "domain",
            title: "Web address",
            source: "from_you",
            about: "Where your practice lives online: your own domain, or a page at your name on Profit Coach.",
            from: ["Conversation: your own domain, or a Profit Coach page at your name"],
            feeds: "Coach page, booking link, campaign links",
            fields: [
              { path: "identity.web_address", label: "Web address", kind: "text", required: true, example: "pamwoodford.com, or a Profit Coach page", help: "Every campaign and message links here.", ask: "Do you want your own domain for your practice site, or a Profit Coach page at your name? If your own, what is the domain?" },
              { path: "identity.website", label: "Current site", kind: "text", example: "harlowadvisory.co.uk", help: "If you have a site already, we build your advisory page into it." },
            ],
          },
          {
            id: "email",
            title: "Practice email",
            source: "from_you",
            about: "The address your campaigns and client emails come from.",
            from: ["Conversation: keep your own address, or have one set up"],
            feeds: "Campaign sending, client emails",
            fields: [
              { path: "identity.practice_email", label: "Practice email", kind: "text", required: true, example: "pam@pamwoodford.com, or set one up for me", help: "Keep your own, or we set one up for the practice.", ask: "Do you want to use your own email address for the practice, or have us set one up?" },
            ],
          },
        ],
      },
      {
        slug: "story",
        title: "Your Story and Proof",
        href: "/coach/practice/story",
        heading: "Turn your experience into commercial credibility",
        summary: "The evidence we use to position you, and the documents that carry it.",
        sections: [
          {
            id: "experience",
            title: "Experience",
            source: "imported",
            about: "The roles and companies on your LinkedIn. You only check them.",
            from: ["LinkedIn: roles held", "LinkedIn: industries and companies"],
            feeds: "Your market options, bio and LinkedIn rewrite",
            fields: [
              { path: "market.roles_held", label: "Roles", kind: "list", required: true, example: "Managing Director\nFinance Director", help: "One per line." },
              { path: "market.industries_worked", label: "Industries and companies", kind: "list", required: true, example: "Building services\nHarlow & Pike", help: "One per line." },
            ],
          },
          {
            id: "results",
            title: "Commercial achievements",
            source: "from_you",
            about: "Your strongest results with numbers. The single most useful thing you can give us: every message we write leads with one.",
            from: ["Conversation: career results with a from, a to, and a timeframe"],
            feeds: "LinkedIn rewrite, campaign messaging, call script",
            fields: [
              { path: "proof.career_results", label: "Results", kind: "results", required: true, example: "Cut debtor days from 74 to 31 in 9 months as Finance Director at Harlow & Pike", help: "A from, a to and a timeframe. \"Grew profit a lot\" does not work. \"Grew profit from £150k to £900k in 3 years\" does.", ask: "What is your strongest commercial result? I need a from, a to, and a timeframe." },
              { path: "proof.client_results", label: "Client stories", kind: "stories", example: "Took a 20-person builder from 4% to 11% net margin in a year", help: "Results you got for someone else. Client proof beats career proof." },
            ],
          },
          {
            id: "superpowers",
            title: "Superpowers",
            source: "from_you",
            about: "What people come to you for. It shapes your offer and how we describe you.",
            from: ["Conversation: superpowers", "Conversation: what makes you different"],
            feeds: "Your offer, LinkedIn rewrite",
            fields: [
              { path: "proof.superpowers", label: "Superpowers", kind: "longtext", required: true, example: "Finding the cash a business already has but cannot see", help: "The thing people ask you for that others cannot do as well.", ask: "What do people come to you for that others cannot do as well?" },
              { path: "proof.uniqueness", label: "What makes you different", kind: "longtext", example: "I have sat in the owner's chair, so I coach from the P&L, not a workbook", help: "Why an owner would pick you over another adviser.", ask: "What makes the way you work different from other advisers?" },
              { path: "proof.proudest", label: "Proudest moments", kind: "list", example: "Rebuilt the finance team after a failed ERP rollout", help: "One per line. These often become your best stories." },
            ],
          },
          {
            id: "problems",
            title: "Problems repeatedly solved",
            source: "from_you",
            about: "The problems owners and colleagues keep bringing you. These become the pain points in your messages.",
            from: ["Conversation: problems people ask you to solve"],
            feeds: "Pain points, campaign messaging",
            fields: [
              { path: "proof.problems_asked", label: "Problems", kind: "list", required: true, example: "We are busy but cash is always tight\nI cannot step away without things slipping", help: "One per line, in the owner's words if you can.", ask: "What problems do owners and colleagues keep asking you to help with?" },
            ],
          },
          {
            id: "bio",
            title: "Proof summary and short bio",
            source: "we_build",
            about: "Your proof in one place, plus a short bio in three versions: first person, one line, and for partners.",
            from: ["Story and proof sections above"],
            feeds: "LinkedIn About, introductions, newsletter sign-off",
            needs: [],
          },
          {
            id: "onepager",
            title: "Your one-page profile",
            source: "we_build",
            about: "A single page you can send to accountants, banks and partners who can refer owners to you.",
            from: ["Proof summary", "Your avatar", "Your offer"],
            feeds: "Partners, recruiters, accountants, banks, events",
            needs: ["story:bio", "market:avatar"],
          },
        ],
      },
      {
        slug: "voice",
        title: "Your Voice",
        href: "/coach/practice/voice",
        heading: "Sound like you in everything we write",
        summary: "How you talk, so the LinkedIn rewrite, campaigns, and newsletters read like you wrote them.",
        sections: [
          {
            id: "sound",
            title: "How you sound",
            source: "we_build",
            about: "Your voice guide. Every message BCA writes for you follows it.",
            from: ["Conversation transcript", "LinkedIn About and posts"],
            feeds: "LinkedIn rewrite, campaign messaging, newsletters",
            needs: [],
          },
        ],
      },
    ],
  },
  {
    label: "Get calls",
    intro: "Who you help, what hurts, and how we start the conversation.",
    pages: [
      {
        slug: "market",
        title: "Who You Help",
        href: "/coach/practice/market",
        heading: "Know exactly who you are built to help",
        summary: "The market is the group. The avatar is the person. The pain is why they call.",
        sections: [
          {
            id: "credibility",
            title: "Where you already have credibility",
            source: "from_you",
            about: "The industries where your results will impress owners. We use these to recommend your market.",
            from: ["LinkedIn: industries worked", "Conversation: industries you understand and can access"],
            feeds: "Market options",
            fields: [
              { path: "market.industries_credibility", label: "Credibility in", kind: "list", required: true, example: "Building services\nM&E contractors", help: "Where would owners be most impressed by your results? One per line.", ask: "Which industries would be most impressed by your results?" },
              { path: "market.industries_understand", label: "Understand from the inside", kind: "list", example: "Construction\nFacilities management", help: "Industries where you know the language and the numbers." },
              { path: "market.industries_access", label: "Can reach easily", kind: "list", example: "Yorkshire contractors through the local CIOB branch", help: "Where you already have contacts, groups or a reputation." },
              { path: "market.buyer_roles", label: "Who signs off", kind: "list", example: "Owner-MD\nFinance Director", help: "The person who says yes to hiring you.", ask: "In those businesses, who signs off on hiring someone like you?" },
            ],
          },
          {
            id: "avoid",
            title: "Who you will not take",
            source: "from_you",
            about: "Owners you would rather not work with. They are left off your prospect lists.",
            from: ["Conversation: clients to avoid"],
            feeds: "Prospect criteria",
            fields: [
              { path: "market.avoid", label: "Will not take", kind: "list", required: true, example: "Start-ups with no revenue\nAnyone looking for a quick fix", help: "One per line.", ask: "Who will you not work with, whatever they pay?" },
            ],
          },
          {
            id: "options",
            title: "Market options",
            source: "we_build",
            about: "Two or three markets, scored, with BCA's recommendation. You choose one on the Decision Call.",
            from: ["Story and proof", "Where you already have credibility"],
            feeds: "Decision Call, your avatar",
            needs: [],
          },
          {
            id: "avatar",
            title: "Your avatar",
            source: "we_build",
            about: "The one owner every message is written to: their day, what they want, and what they fear.",
            from: ["Market options", "Industry library", "One-to-one call transcripts"],
            feeds: "Everything below, then campaign messaging",
            needs: ["market:options"],
          },
          {
            id: "pains",
            title: "Pain points",
            source: "we_build",
            about: "Why your avatar picks up the phone, in their words. Your campaigns and call script are built on these.",
            from: ["Your avatar", "Industry library", "One-to-one call transcripts"],
            feeds: "Campaign messaging, newsletters, call script",
            needs: ["market:avatar"],
          },
          {
            id: "criteria",
            title: "Prospect criteria",
            source: "we_build",
            about: "Exactly who goes on your prospect list, ready for the team to build.",
            from: ["Your avatar", "Who you will not take"],
            feeds: "Get Clients prospect pool",
            needs: ["market:avatar"],
            link: { href: "/coach/prospects", label: "Open your prospects" },
          },
        ],
      },
      {
        slug: "linkedin",
        title: "LinkedIn Profile",
        href: "/coach/practice/linkedin",
        heading: "Look credible before someone replies",
        summary: "Your profile today, and the rewrite that carries your proof. Copy the new version across when you are happy with it.",
        sections: [
          {
            id: "profile",
            title: "Your profile today",
            source: "imported",
            about: "What owners see now. Imported from LinkedIn so the rewrite has a before.",
            from: ["LinkedIn import"],
            feeds: "Profile rewrite",
            fields: [
              { path: "identity.linkedin_url", label: "LinkedIn", kind: "text", required: true, example: "linkedin.com/in/pamwoodford" },
              { path: "identity.linkedin_headline", label: "Headline", kind: "text", placeholder: "Not imported yet. Click to paste your headline.", help: "The line under your name. Owners read it before anything else." },
              { path: "identity.linkedin_about", label: "About", kind: "longtext", placeholder: "Not imported yet. Click to paste your About section.", help: "Your About section as it reads today." },
            ],
          },
          {
            id: "visibility",
            title: "Public or discreet",
            source: "from_you",
            about: "Whether your profile can say you coach yet. If you are still employed or have a non-compete, we write a discreet version.",
            from: ["Conversation: can you say you are a business coach yet?"],
            feeds: "Profile rewrite",
            fields: [
              {
                path: "identity.linkedin_visibility",
                label: "On LinkedIn",
                kind: "enum",
                required: true,
                help: "Discreet keeps the coaching off your profile until you are ready.",
                ask: "Can your LinkedIn say you are a business coach, or do you need to stay discreet for now (still employed, or a non-compete)?",
                options: [
                  { value: "public", label: "Public: I can say I coach" },
                  { value: "discreet", label: "Discreet for now" },
                ],
              },
            ],
          },
          {
            id: "rewrite",
            title: "Your new profile",
            source: "we_build",
            about: "Headline options, a new About section, skills, banner and a checklist. Copy each part into LinkedIn.",
            from: ["Story and proof", "Avatar and pain points", "Your offer", "Your voice"],
            feeds: "The coach's LinkedIn profile",
            needs: ["story:bio", "market:pains", "voice:sound"],
          },
        ],
      },
      {
        slug: "campaigns",
        title: "Campaigns",
        href: "/coach/practice/campaigns",
        heading: "Create a repeatable flow of conversations",
        summary: "What to say to your avatar. Draft and approve it here, then it runs in Get Clients.",
        sections: [
          {
            id: "messaging",
            title: "Campaign messaging",
            source: "we_build",
            about: "Your outreach messages. Comment and approve them here. Once sent to Get Clients, that is where the campaign runs and changes.",
            from: ["Pain points", "Commercial achievements", "Your voice"],
            feeds: "Get Clients campaign builder",
            needs: ["market:pains", "voice:sound"],
            link: { href: "/coach/campaigns", label: "Open your campaigns" },
          },
        ],
      },
      {
        slug: "conversations",
        title: "Replies and Follow-Up",
        href: "/coach/practice/conversations",
        heading: "Turn interest into booked calls",
        summary: "What to send back when people reply, and how to stay in touch with the ones who say not yet.",
        sections: [
          {
            id: "followup",
            title: "Replies and nurture",
            source: "we_build",
            about: "Ready answers to the replies you will get, and a nurture rhythm for people who are not ready yet.",
            from: ["Campaign messaging", "Pain points", "Your voice"],
            feeds: "Get Clients sequences, reply co-pilot",
            needs: ["campaigns:messaging"],
            link: { href: "/coach/conversations", label: "Open your conversations" },
          },
        ],
      },
    ],
  },
  {
    label: "Win clients",
    intro: "What you sell, how you price it, and what you say on the call.",
    pages: [
      {
        slug: "offer",
        title: "Your Offer",
        href: "/coach/practice/offer",
        heading: "Make your value easy to understand and easy to buy",
        summary: "Your price, your terms, and how you describe what you do, in a line, a sentence and a paragraph.",
        sections: [
          {
            id: "fee",
            title: "Price and terms",
            source: "from_you",
            about: "What you charge and how clients pay. BCA proposes the final price, and you agree it on the Decision Call.",
            tip: "Most BCA coaches start at £1,450 a month and add £500 every two to four clients. Offer six months upfront as the alternative to monthly.",
            from: ["Conversation: minimum fee, payment terms, how many clients you want"],
            feeds: "Your offer, proposal and payment, 90-day plan",
            fields: [
              { path: "practice.min_fee", label: "Minimum monthly fee", kind: "text", required: true, example: "£1,500 a month", help: "The least that makes a client worth it for you. We never price you below it.", ask: "What is the least you would take per client per month?" },
              { path: "practice.payment_terms", label: "How clients pay", kind: "text", example: "Monthly with a six-month minimum, or six months upfront", help: "Monthly, upfront, and any minimum term.", ask: "How would you like clients to pay: monthly, upfront, or both, and is there a minimum term?" },
              { path: "practice.capacity", label: "Clients you want", kind: "text", example: "Six at once", help: "How many clients you can serve well at the same time.", ask: "How many clients do you want at once?" },
              {
                path: "practice.delivery_model",
                label: "How you like to work",
                kind: "enum",
                help: "Coaching helps owners do it themselves. Consulting does it for them. Advisory sits in between.",
                options: [
                  { value: "coaching", label: "Coaching" },
                  { value: "consulting", label: "Consulting" },
                  { value: "advisory", label: "Advisory" },
                  { value: "hybrid", label: "A mix" },
                ],
              },
            ],
          },
          {
            id: "guarantee",
            title: "Guarantee",
            source: "from_you",
            about: "Whether you take some of the risk of saying yes. You do not need one. If you have one, keep it simple.",
            tip: "Never guarantee income or results you do not control. A short trial period (\"try it for 60 days, stop if it is not right\") is the simplest kind.",
            from: ["Conversation: guarantee or not, and the terms"],
            feeds: "Your offer, call script, proposal",
            fields: [
              {
                path: "practice.guarantee",
                label: "Guarantee",
                kind: "enum",
                help: "Trial: they can stop after a first period. Results: a promise tied to doing the work.",
                ask: "Would you offer a guarantee, such as a trial period they can stop after, or would you rather not?",
                options: [
                  { value: "none", label: "No guarantee" },
                  { value: "trial", label: "Trial period: stop if it is not right" },
                  { value: "results", label: "Results-based, if they do the work" },
                ],
              },
              { path: "practice.guarantee_terms", label: "The terms", kind: "longtext", example: "Try it for 60 days. If it is not right for you, stop and pay nothing more.", help: "In your words. We write the short and medium versions from it." },
            ],
          },
          {
            id: "lines",
            title: "Your offer in three lengths",
            source: "we_build",
            about: "How you describe what you do in a line, a sentence and a paragraph, each marked with where to use it.",
            from: ["Offer and positioning", "Price and terms", "Guarantee", "Your voice"],
            feeds: "LinkedIn headline and About, introductions, messages, proposals",
            needs: ["offer:direction"],
          },
          {
            id: "direction",
            title: "Offer and positioning",
            source: "we_build",
            about: "The gap you close for owners, why they buy, and what is in the offer.",
            from: ["Story and proof", "Avatar and pain points", "Price and terms"],
            feeds: "Decision Call, call script, LinkedIn rewrite",
            needs: ["market:pains", "story:bio"],
          },
          {
            id: "payment",
            title: "Proposal and payment",
            source: "we_build",
            about: "Your price options, what to say if they ask early, how to close, and a one-page proposal outline.",
            from: ["Offer and positioning", "Price and terms", "Guarantee"],
            feeds: "Proposal and payment link",
            needs: ["offer:direction"],
          },
        ],
      },
      {
        slug: "sales",
        title: "Your Sales Conversation",
        href: "/coach/practice/sales",
        heading: "Know exactly what to say when a prospect is interested",
        summary: "A value session that earns the call, and a script built around your avatar's pain.",
        learn: [
          { label: "What is a value session", href: `${CLASSROOM}/win-clients/win-clients-getting-paid-clients-using-value-sessions-what-is-a-value-session` },
          { label: "How to deliver a value session", href: `${CLASSROOM}/win-clients/win-clients-getting-paid-clients-using-value-sessions-how-to-deliver-a-value-session` },
          { label: "How to sell on a value session", href: `${CLASSROOM}/win-clients/win-clients-getting-paid-clients-using-value-sessions-how-to-sell-on-a-value-session` },
        ],
        sections: [
          {
            id: "value",
            title: "Your value session",
            source: "we_build",
            about: "A free, pitch-free session built on your superpower. It earns the sales conversation.",
            from: ["Superpowers", "Pain points", "Your voice"],
            feeds: "Booking messages, newsletter sign-off, LinkedIn",
            needs: ["market:pains", "voice:sound"],
          },
          {
            id: "script",
            title: "Your call script",
            source: "we_build",
            about: "What to say on the sales call, from the opening to the close, with your avatar's objections answered.",
            from: ["BCA sales conversation", "Your avatar", "Pain points", "Your offer"],
            feeds: "Your sales calls",
            needs: ["offer:direction", "market:pains"],
            link: { href: "/coach/calls", label: "Open your call reviews" },
          },
        ],
      },
    ],
  },
  {
    label: "Serve clients",
    intro: "How you deliver. The step-by-step lives in the Classroom.",
    pages: [
      {
        slug: "deliver",
        title: "How You Deliver",
        href: "/coach/practice/deliver",
        heading: "How your clients are served",
        summary: "Your format and rhythm. How to onboard a client and run every session is in the Classroom, the same for every coach.",
        learn: [
          { label: "Set up a new client", href: `${CLASSROOM}/coach-clients/coach-clients-client-onboarding-how-to-setup-a-new-client` },
          { label: "Session 1: Profit system and dashboard", href: `${CLASSROOM}/coach-clients/coach-clients-client-onboarding-session-1-profit-systems-dashboard` },
          { label: "Session 2: Leverage and the critical issue", href: `${CLASSROOM}/coach-clients/coach-clients-client-onboarding-session-2-leverage-critical-issues` },
          { label: "Session 3: The three-year plan", href: `${CLASSROOM}/coach-clients/coach-clients-client-onboarding-session-3-align-3-year-plan` },
          { label: "Session 4: The ninety-day plan", href: `${CLASSROOM}/coach-clients/coach-clients-client-onboarding-session-4-ninety-day-plan` },
          { label: "How to start a session", href: `${CLASSROOM}/coach-clients/coach-clients-coachiing-session-structure-how-to-start-a-coaching-session` },
          { label: "How to end a session", href: `${CLASSROOM}/coach-clients/coach-clients-coachiing-session-structure-how-eo-end-a-coaching-session` },
        ],
        sections: [
          {
            id: "format",
            title: "Format and rhythm",
            source: "from_you",
            about: "How you run client work. Leave the rhythm empty to use the BCA format.",
            tip: "The BCA format: weekly sessions for the first four to six weeks for quick wins, then two 90-minute sessions a month. Stack clients on the same days.",
            from: ["Conversation: one-to-one or group, session rhythm"],
            feeds: "Your offer, proposal, client onboarding",
            fields: [
              {
                path: "practice.delivery_format",
                label: "One-to-one or group",
                kind: "enum",
                help: "Most coaches start one-to-one.",
                options: [
                  { value: "one_to_one", label: "One-to-one" },
                  { value: "group", label: "Group" },
                  { value: "hybrid", label: "Both" },
                ],
              },
              { path: "practice.session_rhythm", label: "Session rhythm", kind: "text", example: "Weekly for six weeks, then every other Tuesday", help: "Only if you work differently from the BCA format above." },
            ],
          },
        ],
      },
    ],
  },
  {
    label: "Grow your practice",
    intro: "Visible trust that keeps owners coming to you.",
    pages: [
      {
        slug: "content",
        title: "Content and Newsletters",
        href: "/coach/practice/content",
        heading: "Turn your experience into visible trust",
        summary: "Posts, newsletters, and proof drawn from the blueprint, not a blank page.",
        sections: [
          {
            id: "posts",
            title: "Posts and proof",
            source: "we_build",
            about: "Content pillars, twelve post ideas, and two posts ready to go.",
            from: ["Story and proof", "Pain points", "Your voice"],
            feeds: "LinkedIn posts",
            needs: ["market:pains", "voice:sound"],
          },
          {
            id: "newsletter",
            title: "Newsletter",
            source: "we_build",
            about: "Your newsletter's name and promise, the first issue, and the next six subject lines.",
            from: ["Pain points", "Commercial achievements", "Your voice", "Your value session"],
            feeds: "Newsletter tool",
            needs: ["market:pains", "voice:sound"],
          },
        ],
      },
    ],
  },
];

export const BLUEPRINT_PAGES = BLUEPRINT_GROUPS.flatMap((group) => group.pages);

export function blueprintPage(slug: string): BlueprintLink | null {
  return BLUEPRINT_PAGES.find((page) => page.slug === slug) ?? null;
}

export type SectionRef = { group: BlueprintGroup; page: BlueprintLink; section: BlueprintSection; key: string };

/** Every section in document order, with its "page:id" key. */
export const BLUEPRINT_SECTIONS: SectionRef[] = BLUEPRINT_GROUPS.flatMap((group) =>
  group.pages.flatMap((page) =>
    page.sections.map((section) => ({ group, page, section, key: `${page.slug}:${section.id}` }))
  )
);

export function sectionByKey(key: string): SectionRef | null {
  return BLUEPRINT_SECTIONS.find((ref) => ref.key === key) ?? null;
}

/** We build sections in an order where every section comes after what it needs. */
export function buildOrder(): string[] {
  const keys = BLUEPRINT_SECTIONS.filter((r) => r.section.source === "we_build").map((r) => r.key);
  const done = new Set<string>();
  const out: string[] = [];
  const visit = (key: string, depth = 0) => {
    if (done.has(key) || depth > 20) return;
    for (const need of sectionByKey(key)?.section.needs ?? []) visit(need, depth + 1);
    done.add(key);
    out.push(key);
  };
  keys.forEach((k) => visit(k));
  return out;
}

export function fieldValue(
  payload: PracticeKnowledgePayload,
  path: FieldSpec["path"]
): Sourced<unknown> | null {
  const [group, key] = path.split(".") as [Group, string];
  const bucket = payload[group] as Record<string, Sourced<unknown> | null> | undefined;
  return bucket?.[key] ?? null;
}

export function fieldFilled(payload: PracticeKnowledgePayload, field: FieldSpec): boolean {
  return isFilledSourced(fieldValue(payload, field.path));
}

export type SectionState = "ready" | "open" | "building";

/** Where a section stands for one coach. Drives the chips, the "still needed" list, and the admin map. */
export function sectionState(ref: SectionRef, row: PracticeKnowledgeRow): SectionState {
  const { section, key } = ref;
  if (section.source === "we_build") return row.built_sections[key] ? "ready" : "building";
  const required = (section.fields ?? []).filter((f) => f.required);
  // A section with nothing required is never blocking, so it counts as ready.
  return required.every((f) => fieldFilled(row.payload, f)) ? "ready" : "open";
}

/** Imported and From you sections that still need something from the coach. */
export function stillNeeded(row: PracticeKnowledgeRow): SectionRef[] {
  return BLUEPRINT_SECTIONS.filter(
    (ref) =>
      (ref.section.source === "from_you" || ref.section.source === "imported") &&
      sectionState(ref, row) === "open"
  );
}

/** Conversation order: proof first, then the market, the offer, and the practical setup last. */
const ASK_ORDER = ["story", "market", "offer", "linkedin", "voice", "setup"];

/** Open fields with the question to ask, for the AI conversation agenda. */
export function openQuestions(row: PracticeKnowledgeRow): { path: string; label: string; ask: string }[] {
  const out: { path: string; label: string; ask: string }[] = [];
  const ordered = [...BLUEPRINT_SECTIONS].sort(
    (a, b) =>
      (ASK_ORDER.indexOf(a.page.slug) + 1 || 99) - (ASK_ORDER.indexOf(b.page.slug) + 1 || 99)
  );
  for (const ref of ordered) {
    for (const field of ref.section.fields ?? []) {
      if (!field.ask || fieldFilled(row.payload, field)) continue;
      out.push({ path: field.path, label: `${ref.section.title}: ${field.label}`, ask: field.ask });
    }
  }
  return out;
}

export type CommandCenterModel = {
  lead: string;
  detail: string;
  completion: string;
  milestone: string;
  action: { label: string; href: string };
  building: string;
  call: string;
  recommendation: string;
  blocker: string;
  progress: string[];
};

export function commandCenter(row: PracticeKnowledgeRow): CommandCenterModel {
  const missing = row.missing_fields ?? [];
  const report = row.report_payload;
  const booked = row.payload.review.decision_call_booked_at?.value;
  const proofOpen = missing.includes("proof.career_results");
  const askedOpen =
    missing.includes("proof.problems_asked") ||
    missing.includes("proof.superpowers") ||
    missing.includes("proof.uniqueness");

  let lead = "You are building the brief for your practice.";
  let detail = "LinkedIn is the start. The conversation fills what a profile cannot.";
  let action = { label: "Open your Practice Blueprint", href: "/coach/practice/blueprint" };
  let building = "Waiting on the brief before we draft a market and a campaign angle.";
  let milestone = "Complete the brief";

  if (proofOpen) {
    lead = "You are capturing the proof behind your practice.";
    detail = "Your next step is one commercial result with a from, a to, and a timeframe.";
    action = { label: "Add the result in your blueprint", href: "/coach/practice/story#s-story-results" };
    milestone = "One precise result";
  } else if (askedOpen) {
    lead = "You are turning experience into a position.";
    detail = "Your next step is the problems people already ask you to solve.";
    action = { label: "Continue the blueprint", href: "/coach/practice/story#s-story-results" };
    milestone = "Problems you already solve";
  } else if (!report) {
    lead = "You have enough for a first recommendation.";
    detail = "BCA is ready to draft the market options and the campaign angle.";
    action = { label: "Read your Practice Blueprint", href: "/coach/practice/market#s-market-options" };
    building = "Writing the recommendation from the brief.";
    milestone = "Recommendation drafted";
  } else if (!row.coach_reviewed_at) {
    lead = "You are preparing the Decision Call.";
    detail = "BCA has drafted your market options and a campaign angle. Your next step is to read them and note what feels off.";
    action = { label: "Review the recommendation", href: "/coach/practice/decisions" };
    building = "Market options and a campaign angle are drafted. The Decision Call locks them.";
    milestone = "You review the recommendation";
  } else if (row.status === "ready_to_build" || row.status === "building") {
    lead = "You are preparing to launch your first campaign.";
    detail = "The Decision Record is the source. BCA builds LinkedIn, the campaign, follow-ups, and nurture from it.";
    action = { label: "See what is being built", href: "/coach/practice/campaigns" };
    building = "LinkedIn, the first campaign, follow-ups, and nurture are queued.";
    milestone = "First campaign";
  } else {
    lead = "The brief is in. The Decision Call makes the choices.";
    detail = booked
      ? "Your call is booked. Read the recommendation before you join."
      : "Your next step is to book the Decision Call.";
    action = booked
      ? { label: "Read the recommendation", href: "/coach/practice/decisions" }
      : { label: "Book the Decision Call", href: "/welcome" };
    building = "Holding the recommendation until the call locks one market, one offer, and one angle.";
    milestone = "Decision Call";
  }

  const progress: string[] = [];
  if (row.linkedin_seeded_at) progress.push("LinkedIn imported");
  if (row.interview_completed_at) progress.push("Conversation captured");
  if (row.report_generated_at) progress.push("Recommendation drafted");
  if (row.coach_reviewed_at) progress.push("You reviewed the brief");
  if (!progress.length) progress.push("Blueprint opened");

  return {
    lead,
    detail,
    completion: `The blueprint is ${row.completeness_score}% captured.`,
    milestone,
    action,
    building,
    call: booked ? `Booked ${new Date(booked).toLocaleString()}` : "Not booked yet",
    recommendation: report?.experience_summary
      ? report.experience_summary.slice(0, 280)
      : "Not written yet.",
    blocker: missing[0] ? labelMissingField(missing[0]) : "Nothing is blocking the next step.",
    progress,
  };
}

