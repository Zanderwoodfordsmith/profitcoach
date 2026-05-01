import type { FunnelStageId } from "@/lib/funnelKpis";

export type ConstraintAction = {
  title: string;
  summary: string;
  details?: string;
  tooltip?: string;
  videoUrl?: string;
};

export type StageConstraints = {
  stageId: FunnelStageId;
  stageLabel: string;
  actions: ConstraintAction[];
  howToGetNumbers?: {
    summary: string;
    tooltip?: string;
    videoUrl?: string;
  };
};

export const FUNNEL_CONSTRAINTS: Record<FunnelStageId, StageConstraints> = {
  sentToConnected: {
    stageId: "sentToConnected",
    stageLabel: "Connection rate (Connection requests → Connected)",
    howToGetNumbers: {
      summary:
        "Use LinkedIn/Sales Nav activity + your outreach tracker to total connection requests and connections accepted for the same time window.",
      tooltip:
        "Keep the time window consistent (e.g., last 7 days). If you change scripts mid-week, expect noisy data.",
    },
    actions: [
      {
        title: "Make avatar + outcome obvious",
        summary:
          "Rewrite headline to clearly state who you help and the outcome (e.g., £1–20M owner-led SMEs, escape key-man risk, double profit).",
      },
      {
        title: "Upgrade banner + profile credibility",
        summary:
          "Use a professional banner that signals board-level SME support; add featured items (profit system explainer, micro case snippets, Profit Audit explainer).",
      },
      {
        title: "Rewrite About for owner relevance",
        summary:
          "Skimmable About: avatar, pains (firefighting/key-man risk), outcomes (profit/cash/freedom), how you work + proof, invite to Profit Audit.",
      },
      {
        title: "Tighten targeting filters",
        summary:
          "Owner/MD/CEO in region; 10–50 staff; avoid students/coaches; prefer profiles with recent activity when possible.",
      },
      {
        title: "A/B test connection notes",
        summary:
          "Test no note vs short friendly note. Keep the winner until data says otherwise.",
      },
      {
        title: "Increase volume for clean data",
        summary:
          "Set a fixed daily request target (20–40/day, 5 days/week) and hold for 4+ weeks before judging.",
      },
    ],
  },

  connectedToReplied: {
    stageId: "connectedToReplied",
    stageLabel: "Reply Rate (Connected → Replied)",
    howToGetNumbers: {
      summary:
        "Track how many new connections received your first DM and how many replied within the same window.",
      tooltip:
        "Measure replies to message 1 separately from later follow-ups, otherwise you won’t know what’s broken.",
    },
    actions: [
      {
        title: "Use a 3-line opener",
        summary:
          "Short: personal reference, relevance, soft question. No pitch or links in message one.",
      },
      {
        title: "Add one earned detail",
        summary:
          "Reference something specific (post/website/team/sector) so it can’t be copy-pasted to the next person.",
      },
      {
        title: "Stop changing scripts too fast",
        summary:
          "Lock one script for 50–100 connection requests; review weekly, not daily.",
      },
      {
        title: "Fix follow-up discipline",
        summary:
          "Move non-responders into a nurture sequence (LinkedIn/email) with useful content and periodic value-session prompts.",
      },
    ],
  },

  repliedToInterested: {
    stageId: "repliedToInterested",
    stageLabel: "Interest Rate (Replied → Interested)",
    howToGetNumbers: {
      summary:
        "Count reply threads that progress to explicit interest (e.g., ‘Yes’, ‘Tell me more’, ‘What is it?’) vs total replies.",
      tooltip:
        "Define ‘interested’ precisely for your team so the metric doesn’t drift.",
    },
    actions: [
      {
        title: "Respond same-day to engaged replies",
        summary:
          "Treat replies like leads. Clear DMs at least daily (ideally morning/lunch/end-of-day).",
      },
      {
        title: "Sell a diagnostic, not coaching",
        summary:
          "Position the Profit Audit/Value session as the product: find hidden profit + owner-dependency risks + outline a 90-day plan.",
      },
      {
        title: "Lower the thinking tax",
        summary:
          "Use easy short-answer questions (yes/no, 1–10 scale, quick choices) early in the conversation.",
      },
      {
        title: "Make pain visceral",
        summary:
          "Use emotionally resonant questions (e.g., could they take a 1-week holiday without the laptop?).",
      },
      {
        title: "Make the audit feel concrete",
        summary:
          "Promise deliverables: 3-year map + 90-day action outline even if they never work together.",
      },
    ],
  },

  interestedToBooked: {
    stageId: "interestedToBooked",
    stageLabel: "Interested → Booked Calls",
    howToGetNumbers: {
      summary:
        "Track people who expressed interest vs those who actually booked a calendar slot.",
    },
    actions: [
      {
        title: "Use BAMFAM scheduling",
        summary:
          "Offer two concrete times (Tue 3pm or Wed 10am), get a yes, then send the invite immediately.",
      },
      {
        title: "Follow up same-day on interest",
        summary:
          "Every ‘interested’ reply gets time options the same day—don’t close the laptop with warm prospects unbooked.",
      },
      {
        title: "Turn ‘later’ into a dated follow-up",
        summary:
          "Convert ‘later’ into a specific week/date and add a reminder; send value in between.",
      },
    ],
  },

  bookedToShowed: {
    stageId: "bookedToShowed",
    stageLabel: "Booked Calls → Showed",
    howToGetNumbers: {
      summary:
        "Show rate: the percentage of booked calls that actually happen (prospect attends).",
      tooltip:
        "Measure show rate separately from close rate; the fixes are different.",
    },
    actions: [
      {
        title: "Reduce lead time",
        summary:
          "Default to same/next/soonest days to reduce no-shows and loss of momentum.",
      },
      {
        title: "Run a reminder stack",
        summary:
          "Automated reminders (24h + 3h) plus manual DM/SMS night before, morning of, and 60 minutes before.",
      },
      {
        title: "Add a ‘show bonus’",
        summary:
          "Make attendance feel valuable: map their current level + next level + a 90-day focus plan on the call.",
      },
    ],
  },

  showedToClosed: {
    stageId: "showedToClosed",
    stageLabel: "Showed → Closed",
    howToGetNumbers: {
      summary:
        "Close rate: the percentage of attended calls that convert to a paid client.",
      tooltip:
        "Exclude no-shows here (they belong in show rate). Use the same time window for both metrics.",
    },
    actions: [
      {
        title: "Handle objections with a default close",
        summary:
          "Pre-script common objections; turn uncertainty into a booked follow-up in 48 hours (yes/no decision).",
      },
      {
        title: "Change terms, not price",
        summary:
          "If cash-tight: offer structured on-ramp (lower first 3 months / lower frequency) rather than discounting.",
      },
    ],
  },
};

