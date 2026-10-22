import { labelMissingField } from "./completeness";
import { BLUEPRINT_OUTPUTS, type BlueprintOutput } from "./outputs";
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

export type FieldKind = "text" | "longtext" | "list" | "results" | "stories" | "enum" | "rows" | "career" | "chips";

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
  /** Selected in a dropdown when nothing is stored yet. */
  assume?: string;
  /**
   * A control that is not a text box: the same hours as Calls, WhatsApp
   * following the phone number, a detected time zone, a connected inbox, or an
   * on/off switch for a two-option answer (on is the first option).
   */
  widget?: "phone" | "whatsapp" | "timezone" | "hours" | "email" | "tone" | "style" | "switch";
  /** Only shown when another answer is one of these values, e.g. guarantee terms once there is a guarantee. */
  showIf?: { path: FieldSpec["path"]; in: string[] };
  /** Columns for a rows field. Each row stores these keys, plus an id. */
  columns?: { key: string; label: string; placeholder?: string }[];
  /** Sit half-width next to the other paired field. Uses a line list, not a box. */
  pair?: boolean;
  /** Quiet arrow on the label: more of goes up, less of goes down. */
  cue?: "more" | "less";
  /** A list as one box per line, with Add, instead of one box. */
  lines?: boolean;
  /** Chips: how many the coach can pick. */
  max?: number;
  /** Chips saved as lines in a text answer, for answers that were written as text. */
  joined?: boolean;
  /** Kept for the writers and filled from another answer on the page, so not shown. */
  hidden?: boolean;
};

/** Material a writer reads besides the coach's answers. The Decision Record always goes in. */
export type WriterSource = "linkedin" | "transcript" | "preread" | "library";

/**
 * A writer's contract: the coach's answers and the other material it reads.
 * Only these reach its prompt, so the flow map and "what is missing" stay true.
 */
export type SectionUses = {
  fields: FieldSpec["path"][];
  sources?: WriterSource[];
};

export type BlueprintSection = {
  id: string;
  /** Stored key when the section has moved page, so its saved text follows it. */
  key?: string;
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
  /** Written sections: the answers and material the writer reads. With `needs`, its contract. */
  uses?: SectionUses;
  /** Where this runs once it is live, so it is never copied in two places. */
  link?: { href: string; label: string };
  /** inline: each answer on one line, label on the left. For short contact details. */
  layout?: "inline";
  /** A section with its own editor instead of boxes. linkedin: the profile lookalike. */
  custom?: "linkedin";
  /** Extra controls that are not a single stored answer, such as social profiles or the business name on the profile. */
  extras?: ("socials" | "business")[];
  /**
   * page: the working section, open.
   * closed: kept on the page, shut until someone opens it.
   * stored: written for the tools, not shown on the page.
   */
  face?: "page" | "closed" | "stored";
};

/** Chip options where the label is the stored answer. */
function chips(labels: string[]): { value: string; label: string }[] {
  return labels.map((label) => ({ value: label, label }));
}

/** How they want to be known and the kind of coach they are. Word choice in every message. */
export const VOICE_STYLE_PATHS: FieldSpec["path"][] = [
  "practice.voice_known_for",
  "practice.voice_coaching_style",
];

/** Book, film, hobbies and stories. Analogies where there is room: newsletters, posts, nurture. */
export const VOICE_COLOUR_PATHS: FieldSpec["path"][] = [
  "practice.voice_favourite_book",
  "practice.voice_favourite_film",
  "practice.voice_hobbies",
  "practice.voice_stories",
];

export type BlueprintGroup = {
  label: string;
  /** Kept for later, not shown or written yet. */
  hidden?: boolean;
  /** The coach's own pages: on the overview, BCA never has a to do here. */
  yours?: boolean;
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

const CLASSROOM = "/coach/academy/classroom";

/** Pages with their own view instead of sections. */
export const SPECIAL_PAGES = ["command", "decisions", "blueprint"] as const;

const GROUPS: BlueprintGroup[] = [
  {
    label: "Start Here",
    intro: "Where you are, what we agreed, and what happens next.",
    pages: [
      {
        slug: "command",
        title: "Overview",
        href: "/coach/blueprint",
        heading: "Your next best action",
        summary: "Where you are, what BCA is building, and the one thing that needs you.",
        sections: [],
      },
    ],
  },
  {
    label: "About You",
    yours: true,
    intro: "Who you are, what you have done, and how you sound.",
    pages: [
      {
        slug: "story",
        title: "Your Story and Proof",
        href: "/coach/blueprint/story",
        heading: "Turn your experience into commercial credibility",
        summary: "The evidence we use to position you: results, client stories, superpowers, the problems people already ask you to solve, and where all that lands best.",
        sections: [
          {
            id: "experience",
            title: "Your career",
            source: "imported",
            about: "The roles on your LinkedIn, and any business of your own. Untick anything you do not want us to use. Open a role to say what you did there.",
            from: ["LinkedIn: roles, companies, industries and dates"],
            feeds: "Your market options, bio and LinkedIn rewrite",
            fields: [
              { path: "market.career", label: "Your career", kind: "career", help: "The roles you tick tell us which owners will trust you, and which industries to look in." },
              // Filled from the ticked roles, for the writers and pages that read them.
              { path: "market.roles_held", label: "Roles", kind: "list", required: true, hidden: true },
              { path: "market.industries_worked", label: "Industries and companies", kind: "list", required: true, hidden: true },
            ],
          },
          {
            id: "results",
            title: "Commercial achievements",
            source: "from_you",
            about: "Your strongest results with numbers. The single most useful thing you can give us: every message we write leads with one.",
            from: ["Conversation: results from your career and for clients, with the number before, the number after, and how long it took"],
            feeds: "LinkedIn rewrite, campaign messaging, call script, your website",
            fields: [
              { path: "proof.career_results", label: "Results", kind: "results", required: true, example: "Cut debtor days from 74 to 31 in 9 months as Finance Director at Harlow & Pike", help: "From your career, your own business, or for a client. The number before, the number after, and how long it took. \"Grew profit a lot\" does not work. \"Grew profit from £150k to £900k in 3 years\" does. Client results beat career results.", ask: "What is the best result you have got for a business? Was it in a job, in your own business, or for a client? Tell me the number before, the number after, and how long it took. For example, profit went from £150k to £900k in 3 years." },
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
              { path: "proof.proudest", label: "Proudest moments", kind: "list", lines: true, example: "Rebuilt the finance team after a failed ERP rollout\nTook my first business past £1M", help: "These often become your best stories." },
            ],
          },
          {
            id: "problems",
            title: "Problems repeatedly solved",
            source: "from_you",
            about: "The problems owners and colleagues keep bringing you. These become the pain points in your messages.",
            from: ["Conversation: problems people ask you to solve"],
            feeds: "Pain points, campaign messaging, the 90-day brochure",
            fields: [
              { path: "proof.problems_asked", label: "Problems", kind: "list", lines: true, required: true, example: "We are busy but cash is always tight\nI cannot step away without things slipping", help: "In the owner's words if you can.", ask: "What problems do owners and colleagues keep asking you to help with?" },
            ],
          },
          {
            id: "credibility",
            // Moved from Who You Help; the stored key keeps its answers, sign-off and comments.
            key: "market:credibility",
            title: "Where you have credibility",
            source: "from_you",
            about: "Where your results will impress owners, who signs off, and who you will not take. We use this to recommend your market and build your prospect list.",
            from: ["LinkedIn: industries worked", "Conversation: industries you understand and can reach", "Conversation: clients to avoid"],
            feeds: "Market options, prospect list",
            fields: [
              { path: "market.industries_credibility", label: "Where you have credibility", kind: "list", lines: true, required: true, example: "Building services\nM&E contractors\nYorkshire contractors through the local CIOB branch", help: "Industries where owners would be impressed by your results, where you know the language, or where you already have contacts.", ask: "Which industries would be most impressed by your results, and where do you already know people?" },
              { path: "market.buyer_roles", label: "Who signs off", kind: "list", lines: true, example: "Owner-MD\nFinance Director", help: "The person who says yes to hiring you.", ask: "In those businesses, who would decide to hire you? The owner, the managing director, or someone else?" },
              { path: "market.avoid", label: "Who you will not take", kind: "list", lines: true, required: true, example: "Start-ups with no revenue\nAnyone looking for a quick fix", help: "Left off your prospect lists.", ask: "Who will you not work with, whatever they pay?" },
            ],
          },
        ],
      },
      {
        slug: "voice",
        title: "Your Voice",
        href: "/coach/blueprint/voice",
        heading: "Sound like you in everything we write",
        summary: "How you talk, the kind of coach you are, and the colour that makes marketing sound like you, not a template.",
        sections: [
          {
            id: "known",
            title: "How you want to be known",
            source: "from_you",
            about: "How you want owners to see you, and the kind of coach you are. Prospects need to recognise you, so you attract people you will work with for a long time.",
            feeds: "LinkedIn rewrite, campaign messaging, newsletters",
            fields: [
              { path: "practice.voice_known_for", label: "How you want to be known", kind: "chips", joined: true, max: 5, required: true, options: chips(["Straight talking", "Practical", "Been in your shoes", "Good with numbers", "Calm under pressure", "Gets things done", "Honest, even when it stings", "On the owner's side", "Big-picture thinker", "Eye for detail", "Warm and easy to talk to", "Challenges you"]), help: "Pick up to five, or add your own. This is how we set you apart.", ask: "How do you want to be perceived, and what do you want to be known for?" },
              { path: "practice.voice_coaching_style", label: "The kind of coach you are", kind: "text", widget: "style", required: true, help: "The three scales from the Classroom lesson on your coaching style. None is better than another. Pick where you really sit, not where you think you should.", ask: "These might seem a bit odd, but they help us write things that sound like you. Do you lean more mentor, telling owners what worked for you, or more coach, asking questions? More about growth, or about the owner's life? More tough love, or more nurturing?" },
            ],
          },
          {
            id: "tone",
            title: "Your tone",
            source: "from_you",
            about: "Five sliders for how you come across. BCA sets them from how you talk on your call. Move any that feel off.",
            from: ["Conversation transcript"],
            feeds: "Every message BCA writes for you",
            fields: [
              { path: "practice.tone", label: "Tone", kind: "text", widget: "tone", required: true, help: "Each slider becomes a plain instruction for the writers, so small moves matter." },
            ],
          },
          {
            id: "sounds",
            title: "Sounds like you",
            source: "from_you",
            about: "A short message you would actually send. The writers copy its rhythm and words.",
            feeds: "Every message BCA writes for you",
            fields: [
              { path: "practice.voice_sounds_like", label: "Sounds like you", kind: "longtext", required: true, example: "Hi Dave, saw the new depot opening, congrats. Quick one: are you finding the extra site is eating the margin, or is it holding up?", help: "A message, a post, or a few lines you would write to an owner. Paste one you have sent if you like.", ask: "Could you write, or paste, a short message you would send to an owner, in your own words?" },
            ],
          },
          {
            id: "never",
            title: "Never sounds like you",
            source: "from_you",
            about: "Phrases, styles or habits you never want in your name.",
            feeds: "Every message BCA writes for you",
            fields: [
              { path: "practice.voice_never", label: "Never sounds like you", kind: "chips", joined: true, options: chips(["Hype and big promises", "Jargon", "Pushy selling", "Exclamation marks", "Emojis", "\"I hope this finds you well\"", "Guru talk", "Too formal", "Too chatty", "Long messages"]), help: "Tap anything that would make you wince if it went out with your name on it, or add your own.", ask: "Is there anything you never want to sound like?" },
            ],
          },
          {
            id: "stand",
            title: "What you stand for",
            source: "from_you",
            about: "Your values, and the people you click with. We use this so copy takes your side, not a generic coach's.",
            feeds: "Every message BCA writes for you",
            fields: [
              { path: "practice.voice_values", label: "What you stand for", kind: "chips", max: 5, options: chips(["Honesty", "Hard work", "Say it straight", "Look after your people", "Keep your word", "Family first", "Fairness", "Always learning", "Own your mistakes", "Do it properly", "Have fun", "Give back"]), help: "The values that matter to you, in yourself and in the people you work with. Pick up to five.", ask: "What do you stand for? The values and qualities that matter most to you." },
              { path: "practice.voice_like_in_people", label: "What you like in people", kind: "chips", max: 5, options: chips(["Gets stuck in", "Owns a mistake", "Can take a joke", "Keeps their word", "Curious", "Open to advice", "Ambitious", "Kind", "Straight with you", "On time"]), help: "Pick up to five.", ask: "What do you like in a person?" },
              // No longer asked on the page. Earlier answers still reach the voice writer.
              { path: "practice.voice_pet_peeves", label: "What annoys you", kind: "list", hidden: true },
            ],
          },
          {
            id: "colour",
            title: "What you love",
            source: "from_you",
            about: "A favourite book, a film, hobbies, a story. We use them as comparisons in newsletters and lessons, so the writing has your colour, not ours.",
            feeds: "Newsletters, posts, lessons",
            fields: [
              { path: "practice.voice_hobbies", label: "Hobbies and sports", kind: "chips", options: chips(["Golf", "Football", "Rugby", "Cricket", "Running", "Cycling", "Walking", "The gym", "Swimming", "Sailing", "Fishing", "Cooking", "Travel", "Music", "Reading", "Gardening", "Motorsport", "Family time"]), help: "Newsletter comparisons come from these.", ask: "What hobbies and sports are you interested in?" },
              { path: "practice.voice_favourite_book", label: "Favourite book", kind: "text", example: "The Very Hungry Caterpillar", help: "Any book. Childhood, recent, does not matter. We use it for comparisons, not as a reading list.", ask: "What is your favourite book? It can be one from when you were six, or one you have just finished. Any favourite book." },
              { path: "practice.voice_favourite_film", label: "Favourite film", kind: "text", example: "The Shawshank Redemption", help: "Used for comparisons in newsletters.", ask: "What is your favourite film?" },
              { path: "practice.voice_stories", label: "A story you would share", kind: "longtext", example: "The Friday I found we had two weeks of cash left. I still use that when an owner says they are a bit tight.", help: "Optional. Anything interesting that has happened, that we can put in a newsletter or a lesson.", ask: "Is there a story you would like us to use in a newsletter or a lesson?" },
            ],
          },
          {
            id: "notes",
            title: "Anything else",
            source: "from_you",
            about: "Optional. Anything else about how you come across, such as phrases you use or a regional flavour.",
            feeds: "Every message BCA writes for you",
            fields: [
              { path: "practice.voice_notes", label: "Anything else", kind: "longtext", example: "Yorkshire, so plain and direct. I say \"right then\" a lot. Football analogies are fine.", help: "Optional." },
            ],
          },
          {
            id: "sound",
            title: "How you sound",
            source: "we_build",
            // About You holds only the coach's answers. The guide is written for the tools.
            face: "stored",
            about: "Your voice guide, written from your answers on Your Voice. Every message we write follows it.",
            from: ["Your tone", "Sounds like you", "How you want to be known", "What you stand for", "What you love", "Conversation transcript", "LinkedIn About and posts"],
            feeds: "LinkedIn rewrite, campaign messaging, newsletters",
            needs: [],
            uses: {
              fields: [
                "practice.tone",
                "practice.voice_sounds_like",
                "practice.voice_never",
                "practice.voice_notes",
                "practice.voice_known_for",
                "practice.voice_coaching_style",
                "practice.voice_values",
                "practice.voice_like_in_people",
                "practice.voice_pet_peeves",
                "practice.voice_favourite_book",
                "practice.voice_favourite_film",
                "practice.voice_hobbies",
                "practice.voice_stories",
              ],
              sources: ["linkedin", "transcript"],
            },
          },
        ],
      },
      {
        slug: "setup",
        title: "Practice Setup",
        href: "/coach/blueprint/setup",
        heading: "The basics we need to set you up",
        summary: "How clients reach you, when you take calls, and the website and profiles where owners find your practice.",
        sections: [
          {
            id: "contact",
            title: "Business and contact",
            source: "imported",
            layout: "inline",
            extras: ["business"],
            about: "Your business name, and how BCA and your clients reach you. Your phone is pulled from sign-up. WhatsApp uses that same number, and the time zone comes from your account.",
            from: ["Sign-up form: phone", "Your account time zone", "LinkedIn: location"],
            feeds: "Booking page, reminders, BCA team",
            fields: [
              { path: "identity.phone", label: "Phone", kind: "text", widget: "phone", required: true, example: "7700 900123", help: "For booking reminders and for the BCA team. Never shown on your public pages.", ask: "What is the best mobile number for us and for booking reminders?" },
              { path: "identity.practice_email", label: "Email", kind: "text", widget: "email", help: "Connect Gmail or Outlook. Practice emails go out from it, and the address appears here once it is connected." },
              { path: "identity.timezone", label: "Time zone", kind: "text", widget: "timezone", help: "Taken from your account, or from this browser if your account does not have one yet. Booked calls use it." },
              { path: "identity.address", label: "Address", kind: "text", example: "Unit 4, Wellington Court", help: "Where BCA can send things, and for your website or booking page if you want it shown." },
              { path: "identity.address_line2", label: "Address line 2", kind: "text", placeholder: "Optional" },
              { path: "identity.location", label: "Town or city", kind: "text", example: "Leeds", help: "Also used to target owners near you if you want local clients." },
              { path: "identity.postcode", label: "Postcode", kind: "text", example: "LS1 4AP" },
              { path: "identity.country", label: "Country", kind: "text", example: "United Kingdom" },
            ],
          },
          {
            id: "online",
            title: "Website and socials",
            source: "from_you",
            layout: "inline",
            about: "Your website if you have one, and the social profiles owners can find you on.",
            from: ["Your website", "Social profiles"],
            feeds: "Campaign links, your public page",
            extras: ["socials"],
            fields: [
              { path: "identity.website", label: "Website", kind: "text", placeholder: "yoursite.com, or leave blank and we use your Profit Coach page", help: "Your site, if you have one. Leave this blank and campaigns link to your Profit Coach page." },
            ],
          },
          {
            id: "calls",
            title: "When you take calls",
            source: "from_you",
            about: "The hours on your booking page. This is the same calendar as Calls, so you set it once.",
            from: ["Your booking calendar"],
            feeds: "Booking page calendar",
            fields: [
              { path: "working_times.prospect_call_hours", label: "Hours", kind: "text", required: true, widget: "hours", help: "Tick the days and set the times. Saving here updates Calls." },
            ],
          },
        ],
      },
    ],
  },
  {
    label: "Get Calls",
    intro: "Who you help, what hurts, and how we start the conversation.",
    pages: [
      {
        slug: "market",
        title: "Your Ideal Client",
        href: "/coach/blueprint/market",
        heading: "Know exactly who you are built to help",
        summary: "The one person every message is written to: who they are, what they are going through, and how they talk. We fill it in from your Blueprint Call, then you check it.",
        sections: [
          {
            id: "options",
            title: "Market options",
            source: "we_build",
            face: "closed",
            about: "Two or three markets, scored, with BCA's recommendation. You choose one on the Decision Call. Open this when you want the scores.",
            from: ["Story and proof", "Your market"],
            feeds: "Decision Call, your avatar",
            needs: [],
            uses: { fields: ["market.industries_credibility", "market.career", "market.industries_worked", "market.roles_held", "market.buyer_roles", "market.avoid", "proof.career_results", "proof.problems_asked", "proof.superpowers"], sources: ["linkedin", "transcript", "preread"] },
          },
          {
            id: "persona",
            title: "Who they are",
            source: "from_you",
            about: "The person every message is written to: who they are, where they spend their time, and how they think.",
            feeds: "The walkthrough, campaign messaging",
            fields: [
              { path: "client.characteristics", label: "Who they are", kind: "list", required: true, example: "Late 40s, sales director, earning well into six figures\nOn LinkedIn most days, plays golf at the weekend\nAmbitious, and wants financial freedom without losing the family", help: "Age, role, family and money, where they spend their time, and what they value. Strongest first.", ask: "Describe the person you most want to help. Age, role, family, what they earn, and how they spend their time, in a few short lines." },
            ],
          },
          {
            id: "grid",
            title: "What they are going through",
            source: "from_you",
            about: "What they want less of, and what they want more of. Today and later both go in the same box.",
            feeds: "Pain points, campaign messaging, call script",
            fields: [
              { path: "client.pains_now", label: "Less of", kind: "list", required: true, example: "No say over his own week\nThe job has started to feel like a trap\nAnother five years of the same if nothing changes", help: "What they want less of: what hurts today, the daily frustrations, and what happens if they leave it. In their words, strongest first.", ask: "What does this person want less of right now, and what happens if they leave it? A few lines, strongest first." },
              { path: "client.desires_now", label: "More of", kind: "list", example: "A week he can plan himself\nTo be home for dinner\nHis own practice, earning properly", help: "What they want more of: what they want soon, and the life they picture once this is solved.", ask: "What does this person want more of instead, soon and in the life they picture?" },
            ],
          },
          {
            id: "world",
            title: "In their words",
            source: "from_you",
            about: "How this person talks: what they say and think, and the words that would put them off.",
            feeds: "Campaign messaging, LinkedIn, newsletters, call script",
            fields: [
              { path: "client.says", label: "What they say and think", kind: "list", required: true, example: "I just need to get through this quarter\nI would go on my own if I knew where to start\nWhat if I cannot provide for my family?", help: "What they say out loud, what they think in private, and what they keep hearing from others. Their words, not marketing language.", ask: "What does this person say about their business when they are fed up? Use their actual words." },
              { path: "client.words_avoid", label: "Words to avoid", kind: "list", example: "Guru\nHustle\nPassive income", help: "Words that sound like everyone else, or that this person would not trust." },
            ],
          },
          {
            id: "triggers",
            title: "What makes them act",
            source: "from_you",
            about: "The moment they decide to get help, and what they say when they are interested and still hesitate.",
            feeds: "Campaign messaging, call script",
            fields: [
              { path: "client.buying_triggers", label: "The moment they act", kind: "list", required: true, example: "Misses something important at home\nA boss who will not respect a boundary\nSees a friend with the life he wants", help: "The event that finally makes them say enough.", ask: "What event finally makes this person decide to get help?" },
              { path: "client.objections", label: "Objections", kind: "list", example: "I cannot afford to drop the salary\nI have tried to start before and stalled\nWhat if it does not replace my income?", help: "What they say when they are interested and still hesitate." },
            ],
          },
          {
            id: "why",
            title: "Why you",
            source: "from_you",
            about: "Why they would pick you rather than do it alone or hire someone else, and what earns their trust.",
            feeds: "The offer, campaign messaging",
            fields: [
              { path: "client.why_you", label: "Why you", kind: "longtext", required: true, example: "You have done their job, and you have the whole path ready, so they do not have to figure out the business and leave the salary on the same day.", help: "The difference they would care about: your authority, proof from owners like them, and any real limit on how many clients you take. Never invent a limit.", ask: "Why would they pick you, rather than do it alone or hire someone else? What proof would they trust?" },
            ],
          },
          {
            id: "avatar",
            title: "The walkthrough",
            source: "we_build",
            face: "stored",
            about: "A written picture pulled from the boxes on this page. Kept for campaigns. The boxes are the working copy.",
            from: ["Who they are", "What they are going through", "In their words", "Market options"],
            feeds: "Pain points, then campaign messaging",
            needs: ["market:options"],
            uses: { fields: ["client.characteristics", "client.pains_now", "client.desires_now", "client.says", "client.words_avoid", "client.buying_triggers", "client.objections", "client.why_you", "market.buyer_roles", "market.industries_credibility", "proof.career_results"], sources: ["library", "transcript", "preread"] },
          },
          {
            id: "pains",
            title: "Pain points",
            source: "we_build",
            about: "Written from the pains and what makes them act. Campaigns, newsletters and your call script all use it, so check it sounds like your clients.",
            from: ["What they are going through", "What makes them act"],
            feeds: "Campaign messaging, newsletters, call script",
            needs: ["market:avatar"],
            uses: { fields: ["client.pains_now", "client.desires_now", "client.says", "client.buying_triggers", "client.objections"], sources: ["library", "transcript"] },
          },
        ],
      },
      {
        slug: "linkedin",
        title: "LinkedIn Profile",
        href: "/coach/blueprint/linkedin",
        heading: "Look credible before someone replies",
        summary: "Your LinkedIn as owners see it today, and the new version written from your Blueprint, ready to copy across.",
        sections: [
          {
            id: "profile",
            title: "Your profile today",
            source: "imported",
            face: "stored",
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
            id: "rewrite",
            title: "Your profile",
            source: "from_you",
            custom: "linkedin",
            about: "Your LinkedIn as owners see it. Switch between today and the new version, click any part to rewrite it from your Blueprint, then copy it across to LinkedIn.",
            from: ["LinkedIn import", "Your voice", "Your ideal client", "Your offer", "Story and proof"],
            feeds: "The coach's LinkedIn profile",
          },
          {
            id: "bio",
            // Moved from Your Story and Proof so About You holds only the coach's answers; the stored key keeps every bio.
            key: "story:bio",
            title: "Your bio",
            source: "we_build",
            about: "Written from your Story and Proof: a short bio, a one-line introduction, and a version for partners and events.",
            from: ["Story and proof"],
            feeds: "LinkedIn About, introductions, newsletter sign-off, the 90-day brochure in Toolkit",
            needs: [],
            uses: { fields: ["proof.career_results", "proof.superpowers", "proof.uniqueness", "proof.proudest", "proof.problems_asked", "market.career", "market.roles_held", "market.industries_worked", "market.industries_credibility", ...VOICE_STYLE_PATHS], sources: ["linkedin", "transcript"] },
          },
        ],
      },
      {
        slug: "campaigns",
        title: "Campaigns",
        href: "/coach/blueprint/campaigns",
        heading: "Create a repeatable flow of conversations",
        summary: "What to say to your avatar, from the first message to the booked call. Approve it here, then it runs in Get Clients.",
        sections: [
          {
            id: "connection",
            key: "campaigns:messaging",
            title: "Connection campaign",
            source: "we_build",
            about: "For new owners from your list, 2nd and 3rd degree. A connection request with a short note, then five follow-ups over two weeks. The main way coaches get calls.",
            from: ["Pain points", "Commercial achievements", "Your voice"],
            feeds: "Get Clients connection campaign",
            needs: ["market:pains", "voice:sound"],
            uses: { fields: ["proof.career_results", "market.industries_credibility", "client.says", "client.words_avoid", ...VOICE_STYLE_PATHS], sources: ["library", "preread"] },
            link: { href: "/coach/campaigns", label: "Open your campaigns" },
          },
          {
            id: "conversation",
            title: "Messaging campaign",
            source: "we_build",
            about: "For owners you can message without a connection request: connections who fit but you have never spoken to, and open InMail. A short conversation that leads to the BOSS Scorecard. Cold email can come later as an option.",
            from: ["Pain points", "Commercial achievements", "Your voice"],
            feeds: "Get Clients message campaign",
            needs: ["market:pains", "voice:sound"],
            uses: { fields: ["proof.career_results", "market.industries_credibility", "client.says", "client.words_avoid", ...VOICE_STYLE_PATHS], sources: ["library", "preread"] },
            link: { href: "/coach/campaigns", label: "Open your campaigns" },
          },
          {
            id: "reactivation",
            title: "Reactivation campaign",
            source: "we_build",
            about: "For people you already know: past colleagues, old contacts, and anyone who connected or replied before and went quiet. Up to three short messages that restart the conversation.",
            from: ["Experience", "Commercial achievements", "Short bio", "Your voice"],
            feeds: "Get Clients reactivation campaign",
            needs: ["story:bio", "voice:sound"],
            uses: { fields: ["market.roles_held", "market.industries_worked", "proof.career_results", "proof.superpowers", ...VOICE_STYLE_PATHS, "practice.voice_stories", "practice.voice_hobbies"], sources: ["linkedin"] },
            link: { href: "/coach/campaigns", label: "Open your campaigns" },
          },
        ],
      },
      {
        slug: "content",
        title: "Content",
        href: "/coach/blueprint/content",
        heading: "Stay in front of your network between campaigns",
        summary: "What your newsletter is called, who it is for and where it sends people, then your post pillars. The issues themselves live in Get Clients, under Content.",
        sections: [
          {
            id: "info",
            title: "Newsletter",
            source: "from_you",
            layout: "inline",
            about: "The name, who it is for, what it promises, how often it goes out, and the call to action. Every issue uses these.",
            link: { href: "/coach/linkedin?tab=newsletter", label: "Open your newsletter" },
            fields: [
              {
                path: "practice.newsletter_cadence",
                label: "How often",
                kind: "enum",
                assume: "fortnightly",
                options: [
                  { value: "weekly", label: "Weekly" },
                  { value: "fortnightly", label: "Fortnightly" },
                  { value: "monthly", label: "Monthly" },
                ],
              },
              { path: "practice.newsletter_name", label: "Name", kind: "text", placeholder: "Scaffolding Profit Notes" },
              {
                path: "practice.newsletter_description",
                label: "Positioning",
                kind: "longtext",
                placeholder: "A note for owners who want cash in the business, not just turnover.",
                help: "One line on what readers get and why it is worth opening. It becomes the description on LinkedIn.",
              },
              { path: "practice.newsletter_audience", label: "Who it's for", kind: "text", placeholder: "Scaffolding company owners" },
              {
                path: "practice.newsletter_cta",
                label: "Call to action",
                kind: "text",
                placeholder: "If you want a hand with this, book a Discovery call.",
                help: "The wording that goes on the end of every issue.",
              },
            ],
          },
          // Moved from the old Content page; the stored key keeps its posts, sign-off and comments.
          {
            id: "kit",
            key: "content:posts",
            title: "Posts",
            source: "we_build",
            about: "Content pillars, twelve post ideas, and two posts ready to go.",
            from: ["Story and proof", "Pain points", "Your voice"],
            feeds: "LinkedIn posts",
            needs: ["market:pains", "voice:sound"],
            uses: {
              fields: [
                "proof.career_results",
                "proof.superpowers",
                "practice.voice_values",
                ...VOICE_STYLE_PATHS,
                ...VOICE_COLOUR_PATHS,
              ],
              sources: ["transcript"],
            },
          },
          // The issue and its pieces are still written here, and shown in the Newsletter tab (Get Clients, Content).
          {
            id: "newsletter",
            title: "Newsletter",
            source: "we_build",
            face: "stored",
            about: "Five strategies, three things to avoid, a seven-point checklist, and a call to book a Discovery call.",
            from: ["Pain points", "Commercial achievements", "Your voice"],
            feeds: "LinkedIn newsletter",
            needs: ["market:pains", "voice:sound"],
            uses: {
              fields: [
                "proof.career_results",
                "identity.phone",
                "identity.website",
                "client.pains_now",
                "client.says",
                "client.words_avoid",
                "market.industries_credibility",
                "practice.newsletter_cadence",
                "practice.newsletter_name",
                "practice.newsletter_description",
                "practice.newsletter_audience",
                "practice.newsletter_cta",
                "practice.voice_values",
                ...VOICE_STYLE_PATHS,
                ...VOICE_COLOUR_PATHS,
              ],
            },
          },
          {
            id: "cover",
            title: "Cover",
            source: "we_build",
            face: "stored",
            about: "The banner for this issue: the headline, the line under it, and what the picture shows.",
            from: ["Newsletter"],
            feeds: "The newsletter header image",
            needs: ["content:newsletter"],
            uses: { fields: ["market.industries_credibility", ...VOICE_STYLE_PATHS] },
          },
          {
            id: "inbox",
            title: "Inbox",
            source: "we_build",
            face: "stored",
            about: "The note to your top 100. The first line is theirs to personalise from one of that person's posts.",
            from: ["Newsletter", "Your voice"],
            feeds: "LinkedIn inbox",
            needs: ["content:newsletter"],
            uses: { fields: ["identity.phone", "identity.website", "client.words_avoid", ...VOICE_STYLE_PATHS] },
          },
          {
            id: "post",
            title: "Post",
            source: "we_build",
            face: "stored",
            about: "A feed post on the three things to avoid, pointing people at the newsletter.",
            from: ["Newsletter", "Your voice"],
            feeds: "LinkedIn feed",
            needs: ["content:newsletter"],
            uses: { fields: ["client.words_avoid", ...VOICE_STYLE_PATHS] },
          },
          {
            id: "inmail",
            title: "InMail",
            source: "we_build",
            face: "stored",
            about: "An InMail that names the five strategies, links the issue, and offers a call.",
            from: ["Newsletter", "Your voice"],
            feeds: "LinkedIn InMail",
            needs: ["content:newsletter"],
            uses: { fields: ["identity.phone", "identity.website", "client.words_avoid", ...VOICE_STYLE_PATHS] },
          },
          {
            id: "article",
            title: "Article",
            source: "we_build",
            face: "stored",
            about: "A longer piece on the same topic. It points back to the newsletter and the Discovery call.",
            from: ["Newsletter", "Pain points", "Your voice"],
            feeds: "LinkedIn articles",
            needs: ["content:newsletter"],
            uses: {
              fields: ["identity.phone", "identity.website", "proof.career_results", "client.pains_now", ...VOICE_STYLE_PATHS, ...VOICE_COLOUR_PATHS],
            },
          },
          {
            id: "analogy",
            title: "Analogy",
            source: "we_build",
            face: "stored",
            about: "The same 5-3-7 shape, taught through a sport, hobby, book or film they already named.",
            from: ["Your ideal client", "Your voice"],
            feeds: "A later LinkedIn newsletter",
            needs: ["market:pains", "voice:sound"],
            uses: {
              fields: [
                "market.industries_credibility",
                "client.characteristics",
                "client.pains_now",
                "proof.career_results",
                "identity.phone",
                "identity.website",
                "practice.voice_favourite_book",
                "practice.voice_favourite_film",
                "practice.voice_hobbies",
                "practice.voice_stories",
              ],
              sources: ["transcript"],
            },
          },
          {
            id: "kpis",
            title: "KPIs",
            source: "we_build",
            face: "stored",
            about: "What a good week looks like in the hobby, set next to what a good week looks like in the business.",
            from: ["Pain points", "Your voice"],
            feeds: "A later LinkedIn newsletter",
            needs: ["market:pains", "voice:sound"],
            uses: {
              fields: [
                "market.industries_credibility",
                "client.pains_now",
                "client.desires_now",
                "proof.career_results",
                "identity.phone",
                "identity.website",
                "practice.voice_favourite_book",
                "practice.voice_favourite_film",
                "practice.voice_hobbies",
              ],
            },
          },
        ],
      },
    ],
  },
  {
    label: "Win Clients",
    intro: "What you sell, how you describe it, how you price it, and what you say on the call.",
    pages: [
      {
        slug: "offer",
        title: "Your Offer",
        href: "/coach/blueprint/offer",
        heading: "Make the destination clear, then make it easy to buy",
        summary: "What you sell, who it is for and the price. We agree it with you on your Blueprint Call, write it up, and you check it here.",
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
            id: "destination",
            title: "The destination",
            source: "from_you",
            about: "What owners get more of, and less of, when they work with you. In your words.",
            from: ["Conversation: what they get more of and less of"],
            feeds: "The written offer, three lengths, call script",
            fields: [
              { path: "practice.more_of", label: "They get more of", kind: "list", required: true, pair: true, cue: "more", example: "A weekly number the team actually hits\nA Friday they can leave on", help: "Short lines, in your words. Strongest first. Not a system name.", ask: "In your words, what do owners get more of when they work with you? A few short lines, strongest first." },
              { path: "practice.less_of", label: "They get less of", kind: "list", required: true, pair: true, cue: "less", example: "Chasing the team\nBeing the one who holds every job", help: "What goes away. Same idea as Jon Street: more of, less of.", ask: "And what do they get less of? A few short lines, strongest first." },
            ],
          },
          {
            id: "help",
            title: "What you help with",
            source: "from_you",
            about: "The specific work, in your language. Write it. Do not pick from a list of Profit System areas.",
            tip: "James: the weekly number, the 90-day plan, roles so the MD is not chasing. John: cash and margin first, then the team so the hours do not snap back. Will: get through the make-or-break stretch with a plan.",
            from: ["Conversation: what they actually help with, and how long until a first result"],
            feeds: "The written offer, call script",
            fields: [
              { path: "practice.help_with", label: "What you help with", kind: "list", required: true, example: "The weekly number the team actually reviews\nA 90-day plan that sticks\nRoles so the MD is not chasing everyone", help: "Three to six lines, their words. Things that are not on the Profit System list are fine.", ask: "What do you actually help owners with? A few short lines, in your own words." },
              { path: "practice.offer_timeframe", label: "First result they can point to", kind: "text", example: "A number they trust within 90 days", help: "How long until something has changed that they can point at. Leave blank if you would rather not name a clock.", ask: "How soon would a new client see their first win? It is fine to skip this one." },
            ],
          },
          {
            id: "format",
            key: "deliver:format",
            title: "How you deliver",
            source: "from_you",
            about: "How you run client work, in one line. Empty means the BCA format.",
            tip: "The BCA format: weekly sessions for the first four to six weeks for quick wins, then two 90-minute sessions a month. Stack clients on the same days.",
            from: ["Conversation: how you work with clients"],
            feeds: "Your offer, proposal, client onboarding",
            fields: [
              { path: "practice.session_rhythm", label: "How you deliver", kind: "longtext", example: "One-to-one coaching, weekly for the first six weeks, then two 90-minute sessions a month", help: "Leave it empty and we use the BCA format. Change it only if you work differently.", ask: "Do you want to work the BCA way, one-to-one and weekly at first, or differently?" },
            ],
          },
          {
            id: "guarantee",
            title: "Guarantee",
            source: "from_you",
            about: "Whether you take some of the risk of saying yes. You do not need one. If you have one, keep it simple.",
            tip: "Taki's diamond: the guarantee removes risk after the promise is clear. Never guarantee income or results you do not control. A short trial (\"try it for 60 days, stop if it is not right\") is the simplest kind.",
            from: ["Conversation: guarantee or not, and the terms"],
            feeds: "Your offer, call script, proposal",
            fields: [
              { path: "practice.guarantee_terms", label: "Guarantee", kind: "longtext", example: "Try it for 60 days. If it is not right for you, stop and pay nothing more.", help: "In your words. Leave it empty for no guarantee. We write the short versions from it.", ask: "Would you offer a guarantee, such as a trial period they can stop after, or would you rather not?" },
            ],
          },
          {
            id: "fee",
            title: "Price and terms",
            source: "from_you",
            about: "What you charge and how clients pay. We draft it in BCA's standard wording from your Blueprint Call, and you change the numbers.",
            tip: "Taki puts payment after the promise and the guarantee. Most BCA coaches start at £1,450 a month and add £500 every two to four clients. Offer six months upfront as the alternative to monthly.",
            from: ["Blueprint Call: price and payment terms"],
            feeds: "Your offer, proposal and payment, 90-day plan",
            fields: [
              { path: "practice.min_fee", label: "Price and terms", kind: "longtext", required: true, example: "£1,500 a month with a six-month minimum, or six months upfront", help: "We draft this in BCA's standard wording. Change the numbers if they are not right. We never quote below it.", ask: "What do you want to charge a month, and how should clients pay?" },
            ],
          },
          {
            id: "direction",
            title: "The offer",
            source: "we_build",
            face: "closed",
            about: "The one-page offer: who you help, the promise, the strategy, the guarantee, and what working together is. Price stays in the section above.",
            tip: "Same skeleton as Imperium's finalised offer. The words should sound like James Baker, John McCarthy or Will Walsh, not like EasyGrow.",
            from: ["The destination", "What you help with", "Your ideal client", "Story and proof", "Guarantee"],
            feeds: "Decision Call, call script, LinkedIn rewrite, three lengths",
            needs: ["market:pains", "story:bio"],
            uses: {
              fields: [
                "practice.more_of",
                "practice.less_of",
                "practice.help_with",
                "practice.offer_timeframe",
                "practice.guarantee_terms",
                "practice.session_rhythm",
                "proof.superpowers",
                "proof.uniqueness",
                "proof.problems_asked",
                "proof.career_results",
                "client.why_you",
                "client.characteristics",
                "client.pains_now",
                "client.desires_now",
                "market.avoid",
              ],
              sources: ["preread"],
            },
          },
          {
            id: "lines",
            title: "Your offer in three lengths",
            source: "we_build",
            about: "How you describe what you do in a line, a sentence and a paragraph, each marked with where to use it.",
            from: ["The offer", "The destination", "Guarantee", "Your voice"],
            feeds: "LinkedIn headline and About, introductions, messages, the 90-day brochure, proposals",
            needs: ["offer:direction"],
            uses: { fields: ["practice.more_of", "practice.less_of", "practice.help_with", "practice.guarantee_terms", "proof.career_results"] },
          },
        ],
      },
      {
        slug: "sales",
        title: "Your Personalised Pitch",
        href: "/coach/blueprint/sales",
        heading: "Know exactly what to say when a prospect is interested",
        summary: "The Profit System pitch in your words: learn it once, then tailor it to each owner's number-one problem.",
        learn: [
          { label: "What is a value session", href: `${CLASSROOM}/win-clients/win-clients-getting-paid-clients-using-value-sessions-what-is-a-value-session` },
          { label: "How to deliver a value session", href: `${CLASSROOM}/win-clients/win-clients-getting-paid-clients-using-value-sessions-how-to-deliver-a-value-session` },
          { label: "How to sell on a value session", href: `${CLASSROOM}/win-clients/win-clients-getting-paid-clients-using-value-sessions-how-to-sell-on-a-value-session` },
        ],
        sections: [
          {
            id: "script",
            title: "Your personalised pitch",
            source: "we_build",
            about: "What to say on the sales call, from the opening to the price and close, with your clients' objections answered. Ava can tailor it to each prospect before a call.",
            from: ["BCA sales conversation", "Your avatar", "Pain points", "Your offer"],
            feeds: "Your sales calls",
            needs: ["offer:direction", "market:pains"],
            uses: { fields: ["proof.career_results", "client.objections", "practice.min_fee"] },
            link: { href: "/coach/calls", label: "Open your call reviews" },
          },
        ],
      },
    ],
  },
  {
    label: "Later",
    hidden: true,
    intro: "Kept for later, not shown yet.",
    pages: [
      {
        slug: "ninety",
        title: "Your First 90 Days",
        href: "/coach/blueprint/ninety",
        heading: "Know exactly what happens next",
        summary: "The objective, the weekly numbers, and this week.",
        sections: [
          {
            id: "quarter",
            key: "ninety:quarter",
            title: "Your 90-day launch plan",
            source: "we_build",
            about: "Your plan for the first quarter: the goal, the weekly numbers that get you there, and what to do this week.",
            from: ["Your offer", "Price and terms", "When you take calls"],
            feeds: "Your weekly check-ins with BCA",
            needs: ["offer:direction"],
            uses: { fields: ["practice.min_fee", "working_times.prospect_call_hours"] },
          },
        ],
      },
    ],
  },
];

export const BLUEPRINT_GROUPS: BlueprintGroup[] = GROUPS.filter((group) => !group.hidden);

export const BLUEPRINT_PAGES = BLUEPRINT_GROUPS.flatMap((group) => group.pages);

/** The stored key for a section: "page:id", or its own key if it moved page. */
export function sectionKey(page: Pick<BlueprintLink, "slug">, section: Pick<BlueprintSection, "id" | "key">): string {
  return section.key ?? `${page.slug}:${section.id}`;
}

export function blueprintPage(slug: string): BlueprintLink | null {
  return BLUEPRINT_PAGES.find((page) => page.slug === slug) ?? null;
}

export type SectionRef = { group: BlueprintGroup; page: BlueprintLink; section: BlueprintSection; key: string };

/** Every section in document order, with its "page:id" key. */
export const BLUEPRINT_SECTIONS: SectionRef[] = BLUEPRINT_GROUPS.flatMap((group) =>
  group.pages.flatMap((page) =>
    page.sections.map((section) => ({ group, page, section, key: sectionKey(page, section) }))
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
  const value = fieldValue(payload, field.path);
  if (field.kind === "rows") {
    const rows = value?.value;
    if (!Array.isArray(rows)) return false;
    const keys = (field.columns ?? []).map((column) => column.key);
    return rows.some((row) => {
      if (!row || typeof row !== "object") return false;
      const rec = row as Record<string, unknown>;
      return keys.some((key) => String(rec[key] ?? "").trim());
    });
  }
  return isFilledSourced(value);
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

/** Every answer a written section reads, its own and through the sections it needs. */
export function sectionReads(key: string, seen: Set<string> = new Set()): Set<string> {
  const out = new Set<string>();
  if (seen.has(key)) return out;
  seen.add(key);
  const section = sectionByKey(key)?.section;
  for (const path of section?.uses?.fields ?? []) out.add(path);
  for (const need of section?.needs ?? []) for (const path of sectionReads(need, seen)) out.add(path);
  return out;
}

/** Answers every writer is given, whatever its contract says. */
export const ALWAYS_READS: FieldSpec["path"][] = ["identity.linkedin_visibility", "identity.location"];

/** Every answer an output reads, through its contract and everything under it. */
export function outputReads(output: BlueprintOutput): Set<string> {
  const own = output.section ? sectionByKey(output.section)?.section : undefined;
  const out = new Set<string>([...ALWAYS_READS, ...((own?.uses ?? output.uses)?.fields ?? [])]);
  for (const need of own?.needs ?? output.needs ?? []) for (const path of sectionReads(need)) out.add(path);
  return out;
}

let reachCache: Map<string, number> | null = null;

/** How many of the outputs the coach gets read this answer. Higher means ask for it sooner. */
export function answerReach(path: string): number {
  if (!reachCache) {
    reachCache = new Map();
    for (const output of BLUEPRINT_OUTPUTS) {
      for (const read of outputReads(output)) reachCache.set(read, (reachCache.get(read) ?? 0) + 1);
    }
  }
  return reachCache.get(path) ?? 0;
}

/** Page order breaks ties: proof first, then the market, the offer, and the practical setup last. */
const ASK_ORDER = ["story", "market", "offer", "linkedin", "voice", "setup"];

/**
 * Open fields with the question to ask, for the AI conversation agenda. The
 * answers most outputs depend on come first, so a short conversation still
 * captures what matters.
 */
export function openQuestions(row: PracticeKnowledgeRow): { path: string; label: string; ask: string }[] {
  const out: { path: string; label: string; ask: string; reach: number }[] = [];
  const ordered = [...BLUEPRINT_SECTIONS].sort(
    (a, b) =>
      (ASK_ORDER.indexOf(a.page.slug) + 1 || 99) - (ASK_ORDER.indexOf(b.page.slug) + 1 || 99)
  );
  for (const ref of ordered) {
    // Ava asks only for the coach's own pages; BCA researches the rest or agrees it on the Blueprint Call.
    if (!ref.group.yours || ref.section.face === "stored") continue;
    for (const field of ref.section.fields ?? []) {
      if (!field.ask || fieldFilled(row.payload, field)) continue;
      out.push({ path: field.path, label: `${ref.section.title}: ${field.label}`, ask: field.ask, reach: answerReach(field.path) });
    }
  }
  return out.sort((a, b) => b.reach - a.reach).map(({ path, label, ask }) => ({ path, label, ask }));
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
  let action = { label: "Open your Practice Blueprint", href: "/coach/blueprint/blueprint" };
  let building = "Waiting on the brief before we draft a market and a campaign angle.";
  let milestone = "Complete the brief";

  if (proofOpen) {
    lead = "You are capturing the proof behind your practice.";
    detail = "Your next step is your best result for a business: the number before, the number after, and how long it took.";
    action = { label: "Add the result in your blueprint", href: "/coach/blueprint/story#s-story-results" };
    milestone = "One precise result";
  } else if (askedOpen) {
    lead = "You are turning experience into a position.";
    detail = "Your next step is the problems people already ask you to solve.";
    action = { label: "Continue the blueprint", href: "/coach/blueprint/story#s-story-results" };
    milestone = "Problems you already solve";
  } else if (!report) {
    lead = "You have enough for a first recommendation.";
    detail = "BCA is ready to draft the market options and the campaign angle.";
    action = { label: "Read your Practice Blueprint", href: "/coach/blueprint/market#s-market-options" };
    building = "Writing the recommendation from the brief.";
    milestone = "Recommendation drafted";
  } else if (!row.coach_reviewed_at) {
    lead = "You are preparing the Decision Call.";
    detail = "BCA has drafted your market options and a campaign angle. Your next step is to read them and note what feels off.";
    action = { label: "Review the recommendation", href: "/coach/blueprint/market#s-market-options" };
    building = "Market options and a campaign angle are drafted. The Decision Call locks them.";
    milestone = "You review the recommendation";
  } else if (row.status === "ready_to_build" || row.status === "building") {
    lead = "You are preparing to launch your first campaign.";
    detail = "Your Blueprint is the source. BCA builds LinkedIn, the campaign, follow-ups, and nurture from it.";
    action = { label: "See what is being built", href: "/coach/blueprint/campaigns" };
    building = "LinkedIn, the first campaign, follow-ups, and nurture are queued.";
    milestone = "First campaign";
  } else {
    lead = "The brief is in. The Decision Call makes the choices.";
    detail = booked
      ? "Your call is booked. Read the recommendation before you join."
      : "Your next step is to book the Decision Call.";
    action = booked
      ? { label: "Read the recommendation", href: "/coach/blueprint/market#s-market-options" }
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

