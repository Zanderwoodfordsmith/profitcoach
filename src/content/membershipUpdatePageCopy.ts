import { BCA_BUSINESS_CONTACT } from "@/config/businessContact";

/**
 * Updated membership (Profit Coach OS) copy.
 * Front End now includes lifetime curriculum, community and calls —
 * OS tiers are brand, directory, tools and closer support.
 */
export const membershipUpdatePageCopy = {
  hero: {
    eyebrow: "Profit Coach OS",
    headlineLead: "Run your practice on the",
    headlineBold: "Profit Coach operating system.",
    subheadline:
      "You already have lifetime access to the curriculum, community and live calls. Membership is how you licence the brand, get listed in the directory, and unlock the tools and support that grow your coaching practise.",
    cta: "Choose Your OS Level",
  },
  tiers: {
    core: {
      name: "Core",
      price: "£195/month",
      tagline: "Brand, directory and conference",
      bestFor: "Best if you want to practise as a Profit Coach under the brand.",
      includesTitle: "Your Profit Coach licence includes:",
      includes: [
        "Profit Coach brand licence, done‑for‑you marketing assets and a Profit Coach email address",
        "Directory listing",
        "OS support tickets",
        "Conference access",
      ],
      note: "Curriculum, community and weekly calls stay with your Front End — for life.",
      chooseIf:
        "Practise under the Profit Coach brand with directory presence and conference access.",
    },
    premium: {
      name: "Premium",
      price: "£495/month",
      tagline: "Tools and tech that win clients",
      bestFor:
        "Best if you want the full delivery stack: BOSS, funnels, CRM and Connect AI.",
      includesTitle: "Everything in Core, plus:",
      includes: [
        "BOSS Score, Pro and funnels",
        "Connect AI",
        "CRM (website, pipeline, calendars, funnels)",
        "1:1 tech set‑up sessions",
      ],
      note: 'This is the "serious builder" tier for coaches who want the stack live.',
      chooseIf:
        "Run the full Profit Coach tool stack and get hands‑on tech set‑up help.",
    },
    vip: {
      name: "VIP",
      price: "£1,995/month",
      tagline: "Private coaching and direct access",
      bestFor:
        "Best if you want senior coaching and a direct line when it matters.",
      includesTitle: "Everything in Premium, plus:",
      includes: [
        "Two 90‑minute 1:1 coaching calls per month",
        "Direct WhatsApp access for support",
      ],
      note: "Seats are capped so we can actually deliver on this.",
      chooseIf:
        "Want us in your corner with private calls and WhatsApp support.",
    },
  },
  comparison: {
    title: "Clean comparison",
    headers: ["", "Core", "Premium", "VIP"],
    rows: [
      ["Brand & Marketing", "✓", "✓", "✓"],
      ["Directory Listing", "✓", "✓", "✓"],
      ["OS Support Tickets", "✓", "✓", "✓"],
      ["Conference Access", "✓", "✓", "✓"],
      ["BOSS Score, Pro & funnels", "✗", "✓", "✓"],
      ["Connect AI", "✗", "✓", "✓"],
      ["CRM", "✗", "✓", "✓"],
      ["1:1 tech set‑up", "✗", "✓", "✓"],
      ["1:1 coaching", "✗", "✗", "✓"],
      ["WhatsApp access", "✗", "✗", "✓"],
    ],
  },
  noMembership: {
    title: "What if I don't pick a tier?",
    intro: "If you don't take an OS membership:",
    loseTitle: "You don't get:",
    lose: [
      "Licence to use the Profit Coach brand",
      "Directory listing",
      "Done‑for‑you marketing assets and Profit Coach email",
      "OS support tickets",
      "Conference access as a member (beyond any Front End voucher)",
      "Live BOSS tools, funnels, Connect AI and CRM (Premium/VIP)",
    ],
    keepTitle: "You still keep:",
    keep: [
      "Lifetime curriculum and certification training",
      "Community access",
      "Weekly live calls",
    ],
    quote:
      "Front End keeps your education and community for life. OS membership adds the brand licence, directory listing and operating tools.",
  },
  howToChoose: {
    title: "How to choose",
    items: [
      {
        tier: "Core",
        text: "Choose Core if you want to practise as a Profit Coach under the brand, with directory presence and conference access.",
      },
      {
        tier: "Premium",
        text: "Choose Premium if you want the full tool stack — BOSS, funnels, CRM and Connect AI — plus tech set‑up help.",
      },
      {
        tier: "VIP",
        text: "Choose VIP if you want private 1:1 coaching and direct WhatsApp support on top of Premium.",
      },
    ],
    fallback:
      "If you're unsure, assume Premium, run it for 90 days, then adjust up or down.",
  },
  featureBlocks: [
    {
      eyebrow: "Brand & Marketing",
      headline: "Practise as a Profit Coach, not a generic consultant",
      description:
        "Licence to use the Profit Coach brand, plus done‑for‑you marketing assets – banners, email signature, visual templates – and a professional Profit Coach email address, so your public face matches the system you deliver.",
      cta: "plan",
    },
    {
      eyebrow: "Directory Listing",
      headline: "Show up where clients look for a Profit Coach",
      description:
        "An entry in the Profit Coach directory you can send prospects to, so you're findable as part of the network – not just another solo brand shouting into the void.",
      cta: "plan",
    },
    {
      eyebrow: "OS Support Tickets",
      headline: "A proper support channel once you're on OS",
      description:
        "Raise support tickets for brand, tech, and account help. On the front end alone, support stays inside the community; tickets open when you start paying monthly.",
      cta: "plan",
    },
    {
      eyebrow: "Conference Access",
      headline: "Be in the room with the movement",
      description:
        "Conference access as a Core (and above) member – so you can reset direction, see what's working for top coaches, and steal proven ideas. Front end includes one free conference voucher; membership keeps you coming back.",
      cta: "plan",
    },
    {
      eyebrow: "BOSS Score, Pro & funnels",
      headline: "Diagnostics, dashboards and funnels that win work",
      description:
        "Score and Pro so owners see where the money is and why your fee is justified — plus ready BOSS funnels so prospects move from interest to a booked conversation without you inventing the path from scratch.",
      cta: "premium",
    },
    {
      eyebrow: "Connect AI",
      headline: "AI support wired into how you work",
      description:
        "Connect AI as part of Premium — help drafting, following up and moving opportunities without building your own AI stack.",
      cta: "premium",
    },
    {
      eyebrow: "CRM",
      headline: "Website, pipeline, calendars and funnels in one place",
      description:
        "A CRM covering website, pipeline, calendars and funnels — so you always know who's in your world and where each opportunity sits.",
      cta: "premium",
    },
    {
      eyebrow: "1:1 tech set‑up",
      headline: "Hands‑on sessions to get your stack live",
      description:
        "1:1 tech set‑up sessions so your CRM, funnels and tools are actually configured for your practice — not left as a DIY project.",
      cta: "premium",
    },
    {
      eyebrow: "1:1 coaching",
      headline: "Private time to work on your practice, not just in it",
      description:
        "Two 90‑minute private calls a month with a senior coach — sanity‑check pricing, offers, renewals and strategy with someone who's done it before.",
      cta: "vip",
    },
    {
      eyebrow: "WhatsApp access",
      headline: "A direct line when something can't wait",
      description:
        "Direct WhatsApp access for support when a deal blows up, a client wobbles or an opportunity appears — so you can get a quick read and respond with confidence.",
      cta: "vip",
    },
  ],
  featureBlockSections: [
    {
      title: "Core and above",
      blockEyebrows: [
        "Brand & Marketing",
        "Directory Listing",
        "OS Support Tickets",
        "Conference Access",
      ],
    },
    {
      title: "Premium and VIP only",
      blockEyebrows: [
        "BOSS Score, Pro & funnels",
        "Connect AI",
        "CRM",
        "1:1 tech set‑up",
      ],
    },
    {
      title: "VIP only",
      blockEyebrows: ["1:1 coaching", "WhatsApp access"],
    },
  ],
  banners: {
    programmeActive: {
      title: "Your Front End access is lifetime. OS is optional — and powerful.",
      body: "Curriculum, community and weekly calls stay with you. Choose an OS level when you want the brand licence, a directory listing, tools and closer support.",
    },
    needsChoice: {
      title: "You don't have an active OS membership yet.",
      body: "Choose a level below to licence the brand, join the directory and unlock the tools that grow your coaching practise.",
    },
    complimentary: {
      title: "Your membership is complimentary. No payment needed.",
    },
    legacyRecurring: {
      title: "You're on {tier}. Billed under an existing arrangement",
      body: "Nothing to do. To move to self‑serve billing, choose a level below.",
    },
  },
  plansSection: {
    eyebrow: "Profit Coach OS levels",
    headlineLead: "Choose the level that matches",
    headlineBold: "how you want to operate.",
  },
  featuresSection: {
    eyebrow: "What each one gives you",
    headlineLead: "Every feature, and",
    headlineBold: "why it matters.",
  },
  faq: [
    {
      q: "What's the point of membership? Didn't I already buy the system?",
      a: "Your Front End purchase gives you lifetime access to the Profit Coach curriculum (including StryvX), certification, community and weekly live calls — plus one free conference voucher.\n\nOS membership is separate. It's how you licence the Profit Coach brand (including marketing assets and a Profit Coach email), get listed in the directory, get ticket support, attend conferences as a member, and (on Premium/VIP) run BOSS, funnels, Connect AI and CRM with tech set‑up help.",
    },
    {
      q: "Do I still get calls and community if I don't take an OS tier?",
      a: "Yes. Curriculum, community and weekly calls are part of Front End for life. Support on Front End alone is through questions in the community — OS support tickets open when you start a monthly OS plan.",
    },
    {
      q: "What happens if I don't pick a tier?",
      a: "You keep lifetime education, community and calls. Without an OS tier you don't get the brand licence, directory listing, marketing assets, Profit Coach email, ticket support or conference access as a member — and you don't get Premium tools (BOSS, funnels, Connect AI, CRM) or VIP coaching.",
    },
    {
      q: "Can I switch tiers later?",
      a: "Yes. You can upgrade or downgrade from this page at any time. Billing is prorated automatically through Stripe, and your access updates as soon as the change goes through.",
    },
    {
      q: "Is there an annual option?",
      a: "Yes. You can pay annually at 10× the monthly rate (for example Core at £1,950/year instead of £195/month) — effectively two months free. Choose annual at checkout.",
    },
    {
      q: "How do I manage my billing, invoices and payment method?",
      a: "Everything is handled securely through Stripe. Use the \"Manage billing\" button at the top of this page to view invoices, update your card, or change your plan.",
    },
    {
      q: "How do I cancel?",
      a: "You can cancel any time through \"Manage billing\". You keep full OS access until the end of your current billing period. Your Front End lifetime access is unaffected.",
    },
    {
      q: "I'm not sure which level is right for me.",
      a: `If you're unsure, assume Premium, run it for 90 days, then adjust up or down. Or get in touch and we'll help you decide. ${BCA_BUSINESS_CONTACT.phoneLine}.`,
    },
  ],
  helpContact: {
    label: "Need help?",
    ...BCA_BUSINESS_CONTACT,
    phone: BCA_BUSINESS_CONTACT.phoneDisplay,
    phoneHref: BCA_BUSINESS_CONTACT.phoneTelHref,
  },
  footerCta: {
    headline: "Choose the OS level that matches how you want to operate.",
    help: "Need help deciding?",
    ...BCA_BUSINESS_CONTACT,
    phone: BCA_BUSINESS_CONTACT.phoneDisplay,
    phoneHref: BCA_BUSINESS_CONTACT.phoneTelHref,
  },
  finalCta: {
    eyebrow: "The next step",
    headlineLead: "Ready to run on the",
    headlineBold: "Profit Coach OS",
    body: "Pick Core, Premium or VIP — keep your Front End for life, and switch on the brand licence, directory listing and tools that grow your coaching practise.",
    button: "Choose your level",
  },
} as const;
