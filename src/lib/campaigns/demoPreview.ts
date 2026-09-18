import { DEFAULT_CAMPAIGN_SEND_RULES } from "@/lib/unipile/campaignSendWindow";
import type { CampaignOverviewPayload } from "@/lib/unipile/campaignOverview";
import {
  eachYmd,
  labelCampaignWindow,
  planInviteBuckets,
  resolveCampaignWindow,
  type OverviewRange,
} from "@/lib/unipile/campaignPlanBuckets";

export const DEMO_PREVIEW_ID_PREFIX = "demo-preview-";
export const DEMO_PREVIEW_STORAGE_KEY = "pc-campaign-demo-preview";
export const DEMO_PREVIEW_TIMEZONE = "Europe/London";

/** Combined weekday invite capacity used by the chart planner. */
export const DEMO_PREVIEW_DAILY_INVITES = 24;

export type DemoPreviewCampaign = {
  id: string;
  name: string;
  status: string;
  channel?: string;
  channels?: string[];
  source_playbook_id?: string | null;
  daily_invite_limit: number;
  lead_count?: number;
  has_invite_step?: boolean;
  status_counts?: Record<string, number>;
  progress?: {
    sent: number;
    connected: number;
    replied: number;
    interested?: number;
    failed: number;
    queued: number;
    remaining: number;
    in_followup?: number;
    replies?: {
      positive: number;
      negative: number;
      other: number;
    };
  };
  created_at?: string;
  updated_at: string;
};

export type DemoPreviewAccount = {
  id: string;
  unipile_account_id: string;
  status: string;
  display_name: string | null;
};

export type DemoPreviewRemindItem = {
  job_id: string;
  campaign_id: string;
  campaign_name: string;
  lead_id: string;
  scheduled_for: string;
  preview_body: string;
  draft_body: string | null;
  fallback_at: string | null;
  state: "upcoming" | "due" | "overdue";
  step_type?: string;
  call_wait?: boolean;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  linkedin_url: string | null;
};

export type DemoPreviewFeedItem = {
  id: string;
  at: string;
  stepType: string;
  campaignId: string;
  campaignName: string;
  leadId: string;
  contactId: string | null;
  leadStatus: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
};

type Person = {
  first: string;
  last: string;
  company: string;
};

const CONNECTOR_ID = `${DEMO_PREVIEW_ID_PREFIX}connector`;
const OWNERS_ID = `${DEMO_PREVIEW_ID_PREFIX}owners`;
const NURTURE_ID = `${DEMO_PREVIEW_ID_PREFIX}nurture`;

const PEOPLE: Person[] = [
  ["Priya", "Shah", "Northline Accounting"],
  ["Tom", "Whitaker", "Whitaker Joinery"],
  ["Amira", "Hassan", "Hassan & Co"],
  ["James", "Okafor", "Okafor Logistics"],
  ["Helen", "Brooks", "Brooks Advisory"],
  ["Marcus", "Peel", "Peel Roofing"],
  ["Sofia", "Rahman", "Northgate Dental"],
  ["Owen", "Gallagher", "Gallagher Plant"],
  ["Nina", "Cole", "Cole & Daughters"],
  ["Chris", "Yates", "Yates Joinery"],
  ["Lydia", "Chen", "Chen Opticians"],
  ["Darren", "Holt", "Holt Electrical"],
  ["Freya", "Walsh", "Walsh Interiors"],
  ["Nathan", "Singh", "Singh Haulage"],
  ["Clara", "Hughes", "Hughes Veterinary"],
  ["Ben", "Cartwright", "Cartwright Kitchens"],
  ["Aisha", "Patel", "Patel Practice"],
  ["Greg", "Morton", "Morton Scaffolding"],
  ["Elena", "Costa", "Costa Bakery"],
  ["Patrick", "Nolan", "Nolan Surveyors"],
  ["Mei", "Tan", "Tan Physiotherapy"],
  ["Rob", "Fletcher", "Fletcher Motors"],
  ["Sana", "Ali", "Ali Family Law"],
  ["Hugh", "Bennett", "Bennett Timber"],
  ["Imani", "Adeyemi", "Adeyemi Care"],
  ["Luke", "Barrett", "Barrett Plumbing"],
  ["Nadia", "Khan", "Khan Estates"],
  ["Steve", "Rowe", "Rowe Print"],
  ["Olivia", "Grant", "Grant Architecture"],
  ["Hassan", "Malik", "Malik Motors"],
  ["Kate", "Osborne", "Osborne HR"],
  ["Felix", "Ward", "Ward Engineering"],
  ["Yasmin", "Begum", "Begum Pharmacy"],
  ["Ian", "McLeod", "McLeod Farming"],
  ["Rosa", "Diaz", "Diaz Catering"],
  ["Paul", "Hargreaves", "Hargreaves Steel"],
  ["Leila", "Farouk", "Farouk Clinics"],
  ["Sam", "Quinn", "Quinn Landscaping"],
  ["Tara", "Singh", "Singh Accountants"],
  ["Will", "Patterson", "Patterson Vans"],
  ["Chloe", "Reid", "Reid Beauty"],
  ["Andre", "Nwosu", "Nwosu Imports"],
  ["Beth", "Lang", "Lang Legal"],
  ["Omar", "Hussain", "Hussain Foods"],
  ["Jane", "Pickering", "Pickering Optics"],
  ["Theo", "Marsh", "Marsh Heating"],
  ["Fatima", "Noor", "Noor Tutoring"],
  ["Callum", "Drake", "Drake Roofing"],
  ["Hannah", "Pope", "Pope Design"],
  ["Ravi", "Desai", "Desai Warehousing"],
  ["Molly", "Keane", "Keane Florists"],
  ["Josh", "Whelan", "Whelan Security"],
  ["Amina", "Yusuf", "Yusuf Daycare"],
  ["Neil", "Frost", "Frost Windows"],
  ["Sienna", "Park", "Park Wellness"],
  ["Gareth", "Lloyd", "Lloyd Plant Hire"],
  ["Ines", "Costa", "Costa Dental"],
  ["Dean", "Hobbs", "Hobbs Autocare"],
  ["Zara", "Ahmed", "Ahmed Textiles"],
  ["Pete", "Cowan", "Cowan Fencing"],
].map(([first, last, company]) => ({ first, last, company }));

const MESSAGE_BODIES = [
  (first: string) =>
    `Hi ${first}, most owners at your size aren't short of work. They're short of themselves. Want me to tell you which three things usually sit underneath that?`,
  (first: string) =>
    `Hi ${first}, the last owner I did this with found the leak in pricing, not pipeline. Would it help to see what we changed?`,
  (first: string) =>
    `Hi ${first}, most owners running a business your size tell me revenue is growing but profit isn't following it. Worth a chat?`,
  (first: string) =>
    `${first}, circling back with the owner-dependence note. Still useful this week?`,
];

export const DEMO_PREVIEW_ACCOUNT: DemoPreviewAccount = {
  id: `${DEMO_PREVIEW_ID_PREFIX}account`,
  unipile_account_id: "demo-unipile",
  status: "ok",
  display_name: "Zander Demo",
};

export const DEMO_PREVIEW_SSI = {
  available: true as const,
  score: 74,
  industry_top: 16,
  network_top: 21,
  pillars: [
    {
      id: "brand" as const,
      label: "Establish your professional brand",
      score: 21,
      max: 25,
    },
    {
      id: "people" as const,
      label: "Find the right people",
      score: 18.5,
      max: 25,
    },
    {
      id: "engagement" as const,
      label: "Engage with insights",
      score: 14.2,
      max: 25,
    },
    {
      id: "relationships" as const,
      label: "Build relationships",
      score: 20.3,
      max: 25,
    },
  ],
};

/** Orange band on the pending dial — shows the gauge clearly in demo. */
export const DEMO_PREVIEW_INVITE_TOTAL = 612;

export function isDemoPreviewId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith(DEMO_PREVIEW_ID_PREFIX));
}

function hoursAgoIso(hours: number, now: Date): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}

function personAt(index: number): Person {
  return PEOPLE[((index % PEOPLE.length) + PEOPLE.length) % PEOPLE.length]!;
}

function progress(input: {
  sent: number;
  connected: number;
  interested: number;
  failed: number;
  queued: number;
  inFollowup: number;
  replies?: { positive: number; negative: number; other: number };
}) {
  const other = Math.max(
    0,
    Math.round(input.connected * 0.18) - Math.round(input.interested * 0.2)
  );
  const replies = input.replies ?? {
    positive: input.interested,
    negative: Math.round(input.interested * 0.3),
    other,
  };
  return {
    lead_count: input.sent + input.failed + input.queued,
    progress: {
      sent: input.sent,
      connected: input.connected,
      replied: replies.positive + replies.negative + replies.other,
      interested: input.interested,
      failed: input.failed,
      queued: input.queued,
      remaining: input.queued,
      in_followup: input.inFollowup,
      replies,
    },
  };
}

/**
 * A coach ~8 weeks into live outreach: full weekday capacity,
 * a fat hopper, and a paused list ready to turn on.
 */
export function demoPreviewCampaigns(now = new Date()): DemoPreviewCampaign[] {
  const connector = progress({
    sent: 248,
    connected: 86,
    interested: 22,
    failed: 14,
    queued: 312,
    inFollowup: 74,
  });
  const owners = progress({
    sent: 186,
    connected: 61,
    interested: 16,
    failed: 11,
    queued: 274,
    inFollowup: 48,
  });
  const accountants = progress({
    sent: 0,
    connected: 0,
    interested: 0,
    failed: 0,
    queued: 164,
    inFollowup: 0,
  });
  const nurture = progress({
    sent: 94,
    connected: 94,
    interested: 18,
    failed: 5,
    queued: 56,
    inFollowup: 41,
  });

  return [
    {
      id: CONNECTOR_ID,
      name: "Connector",
      status: "running",
      channel: "linkedin",
      channels: ["linkedin"],
      source_playbook_id: "vip-get-interest",
      daily_invite_limit: 20,
      has_invite_step: true,
      created_at: hoursAgoIso(24 * 56, now),
      updated_at: hoursAgoIso(1.2, now),
      ...connector,
    },
    {
      id: NURTURE_ID,
      name: "Nurture",
      status: "running",
      channel: "linkedin",
      channels: ["email", "linkedin"],
      source_playbook_id: "vip-nurture",
      daily_invite_limit: 20,
      has_invite_step: false,
      created_at: hoursAgoIso(24 * 48, now),
      updated_at: hoursAgoIso(3, now),
      ...nurture,
    },
    {
      id: OWNERS_ID,
      name: "Owner-operators · North West",
      status: "running",
      channel: "linkedin",
      channels: ["linkedin"],
      daily_invite_limit: 18,
      has_invite_step: true,
      created_at: hoursAgoIso(24 * 42, now),
      updated_at: hoursAgoIso(0.8, now),
      ...owners,
    },
    {
      id: `${DEMO_PREVIEW_ID_PREFIX}accountants`,
      name: "Accountants · autumn wave",
      status: "paused",
      channel: "linkedin",
      channels: ["linkedin"],
      daily_invite_limit: 15,
      has_invite_step: true,
      created_at: hoursAgoIso(24 * 6, now),
      updated_at: hoursAgoIso(30, now),
      ...accountants,
    },
  ];
}

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function ranged(ymd: string, salt: string, min: number, max: number): number {
  if (max <= min) return min;
  return min + (hash32(`${ymd}:${salt}`) % (max - min + 1));
}

function weekdayAtNoonUtc(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1, 12)).getUTCDay();
}

function sendDayIndex(ymd: string, todayYmd: string): number {
  const [ty, tm, td] = todayYmd.split("-").map(Number);
  const [y, m, d] = ymd.split("-").map(Number);
  const today = Date.UTC(ty || 1970, (tm || 1) - 1, td || 1);
  const day = Date.UTC(y || 1970, (m || 1) - 1, d || 1);
  return Math.round((today - day) / 86_400_000);
}

function actualForDay(
  date: string,
  todayYmd: string
): {
  date: string;
  invite: number;
  message: number;
  engagement: number;
  total: number;
} {
  if (date > todayYmd) {
    return { date, invite: 0, message: 0, engagement: 0, total: 0 };
  }
  const weekday = weekdayAtNoonUtc(date);
  if (weekday < 1 || weekday > 5) {
    return { date, invite: 0, message: 0, engagement: 0, total: 0 };
  }

  const daysAgo = sendDayIndex(date, todayYmd);
  const recent = daysAgo <= 21;
  const partial = date === todayYmd ? 0.62 : 1;
  const invite = Math.round(
    ranged(date, "invite", recent ? 20 : 14, recent ? 24 : 18) * partial
  );
  const message = Math.round(
    ranged(date, "message", recent ? 18 : 11, recent ? 26 : 17) * partial
  );
  const engagement = Math.round(
    ranged(date, "engage", recent ? 10 : 6, recent ? 16 : 11) * partial
  );
  return {
    date,
    invite,
    message,
    engagement,
    total: invite + message + engagement,
  };
}

function invitesSentToday(
  todayYmd: string,
  actual: { date: string; invite: number }[]
): number {
  return actual.find((row) => row.date === todayYmd)?.invite ?? 0;
}

function fuelLeftFromCampaigns(campaigns: DemoPreviewCampaign[]): number {
  return campaigns.reduce((sum, campaign) => {
    if (campaign.status !== "running" || campaign.has_invite_step === false) {
      return sum;
    }
    return sum + (campaign.progress?.queued ?? 0);
  }, 0);
}

export function buildDemoCampaignOverview(
  range: OverviewRange,
  offset: number,
  now = new Date()
): CampaignOverviewPayload {
  const campaigns = demoPreviewCampaigns(now);
  const window = resolveCampaignWindow({
    range,
    offset,
    timezone: DEMO_PREVIEW_TIMEZONE,
    now,
  });
  const actual = eachYmd(window.startYmd, window.endYmd).map((date) =>
    actualForDay(date, window.todayYmd)
  );
  const planned = planInviteBuckets({
    campaigns: [
      {
        status: "running",
        queued: fuelLeftFromCampaigns(campaigns),
        dailyInviteLimit: DEMO_PREVIEW_DAILY_INVITES,
        sendRules: DEFAULT_CAMPAIGN_SEND_RULES,
        timezone: DEMO_PREVIEW_TIMEZONE,
        hasInviteStep: true,
      },
    ],
    window,
    invitesSentToday: invitesSentToday(window.todayYmd, actual),
  });
  const fuelLeft = fuelLeftFromCampaigns(campaigns);

  return {
    window: { ...window, label: labelCampaignWindow(window) },
    actual,
    planned: planned.buckets,
    sent: actual.reduce((sum, row) => sum + row.total, 0),
    peopleReached: actual.reduce((sum, row) => sum + row.invite, 0),
    plannedRemaining: planned.plannedRemaining,
    fuelDays: planned.fuelDays,
    fuelLeft,
  };
}

function remindItem(
  index: number,
  now: Date,
  input: {
    campaignId: string;
    campaignName: string;
    hoursAgo: number;
    state: DemoPreviewRemindItem["state"];
    stepType: string;
    callWait?: boolean;
  }
): DemoPreviewRemindItem {
  const person = personAt(index);
  const bodyFn = MESSAGE_BODIES[index % MESSAGE_BODIES.length]!;
  return {
    job_id: `${DEMO_PREVIEW_ID_PREFIX}remind-${index}`,
    campaign_id: input.campaignId,
    campaign_name: input.campaignName,
    lead_id: `${DEMO_PREVIEW_ID_PREFIX}lead-due-${index}`,
    scheduled_for: hoursAgoIso(input.hoursAgo, now),
    preview_body:
      input.stepType === "call"
        ? `Book a 20-minute review of the scorecard with ${person.first}.`
        : bodyFn(person.first),
    draft_body: null,
    fallback_at:
      input.stepType === "call" ? null : hoursAgoIso(input.hoursAgo - 8, now),
    state: input.state,
    step_type: input.stepType,
    call_wait: input.callWait,
    first_name: person.first,
    last_name: person.last,
    company: person.company,
    linkedin_url: null,
  };
}

export function demoPreviewRemindQueue(now = new Date()): {
  queue: DemoPreviewRemindItem[];
  counts: { due: number; overdue: number; upcoming: number };
} {
  const queue: DemoPreviewRemindItem[] = [
    remindItem(0, now, {
      campaignId: CONNECTOR_ID,
      campaignName: "Connector",
      hoursAgo: 18,
      state: "overdue",
      stepType: "message",
    }),
    remindItem(1, now, {
      campaignId: OWNERS_ID,
      campaignName: "Owner-operators · North West",
      hoursAgo: 9,
      state: "overdue",
      stepType: "message",
    }),
    remindItem(2, now, {
      campaignId: CONNECTOR_ID,
      campaignName: "Connector",
      hoursAgo: 4,
      state: "overdue",
      stepType: "message",
    }),
    remindItem(3, now, {
      campaignId: OWNERS_ID,
      campaignName: "Owner-operators · North West",
      hoursAgo: 1.2,
      state: "due",
      stepType: "message",
    }),
    remindItem(4, now, {
      campaignId: CONNECTOR_ID,
      campaignName: "Connector",
      hoursAgo: 0.5,
      state: "due",
      stepType: "message",
    }),
    remindItem(5, now, {
      campaignId: CONNECTOR_ID,
      campaignName: "Connector",
      hoursAgo: -0.8,
      state: "due",
      stepType: "call",
      callWait: true,
    }),
    remindItem(6, now, {
      campaignId: NURTURE_ID,
      campaignName: "Nurture",
      hoursAgo: -1.5,
      state: "due",
      stepType: "email",
    }),
    remindItem(7, now, {
      campaignId: OWNERS_ID,
      campaignName: "Owner-operators · North West",
      hoursAgo: -2.2,
      state: "due",
      stepType: "message",
    }),
    remindItem(8, now, {
      campaignId: CONNECTOR_ID,
      campaignName: "Connector",
      hoursAgo: -3.5,
      state: "due",
      stepType: "call",
      callWait: true,
    }),
    remindItem(9, now, {
      campaignId: NURTURE_ID,
      campaignName: "Nurture",
      hoursAgo: -6,
      state: "upcoming",
      stepType: "email",
    }),
    remindItem(10, now, {
      campaignId: OWNERS_ID,
      campaignName: "Owner-operators · North West",
      hoursAgo: -20,
      state: "upcoming",
      stepType: "message",
    }),
    remindItem(11, now, {
      campaignId: CONNECTOR_ID,
      campaignName: "Connector",
      hoursAgo: -28,
      state: "upcoming",
      stepType: "message",
    }),
    remindItem(12, now, {
      campaignId: CONNECTOR_ID,
      campaignName: "Connector",
      hoursAgo: -32,
      state: "upcoming",
      stepType: "call",
      callWait: true,
    }),
  ];

  return {
    queue,
    counts: {
      due: queue.filter((item) => item.state === "due").length,
      overdue: queue.filter((item) => item.state === "overdue").length,
      upcoming: queue.filter((item) => item.state === "upcoming").length,
    },
  };
}

function feedItem(
  index: number,
  now: Date,
  input: {
    prefix: string;
    hoursAgo: number;
    stepType: string;
    campaignId: string;
    campaignName: string;
    leadStatus: string;
  }
): DemoPreviewFeedItem {
  const person = personAt(index);
  return {
    id: `${DEMO_PREVIEW_ID_PREFIX}${input.prefix}-${index}`,
    at: hoursAgoIso(input.hoursAgo, now),
    stepType: input.stepType,
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    leadId: `${DEMO_PREVIEW_ID_PREFIX}lead-${input.prefix}-${index}`,
    contactId: null,
    leadStatus: input.leadStatus,
    firstName: person.first,
    lastName: person.last,
    company: person.company,
  };
}

const SENT_STEPS: Array<{
  stepType: string;
  campaignId: string;
  campaignName: string;
  leadStatus: string;
}> = [
  {
    stepType: "invite",
    campaignId: CONNECTOR_ID,
    campaignName: "Connector",
    leadStatus: "invited",
  },
  {
    stepType: "message",
    campaignId: CONNECTOR_ID,
    campaignName: "Connector",
    leadStatus: "connected",
  },
  {
    stepType: "invite",
    campaignId: OWNERS_ID,
    campaignName: "Owner-operators · North West",
    leadStatus: "invited",
  },
  {
    stepType: "message",
    campaignId: OWNERS_ID,
    campaignName: "Owner-operators · North West",
    leadStatus: "connected",
  },
  {
    stepType: "email",
    campaignId: NURTURE_ID,
    campaignName: "Nurture",
    leadStatus: "in_sequence",
  },
];

export function demoPreviewActivityFeed(now = new Date()): {
  sent: DemoPreviewFeedItem[];
  planned: DemoPreviewFeedItem[];
  waiting: DemoPreviewFeedItem[];
  dueCount: number;
} {
  const remind = demoPreviewRemindQueue(now);
  const sent: DemoPreviewFeedItem[] = [];
  for (let i = 0; i < 42; i += 1) {
    const spec = SENT_STEPS[i % SENT_STEPS.length]!;
    sent.push(
      feedItem(i, now, {
        prefix: "sent",
        hoursAgo: 0.4 + i * 0.85,
        ...spec,
      })
    );
  }

  const planned: DemoPreviewFeedItem[] = [];
  for (let i = 0; i < 28; i += 1) {
    const invite = i % 3 !== 1;
    planned.push(
      feedItem(i + 8, now, {
        prefix: "plan",
        hoursAgo: -(4 + i * 1.7),
        stepType: invite ? "invite" : "message",
        campaignId: i % 2 === 0 ? CONNECTOR_ID : OWNERS_ID,
        campaignName:
          i % 2 === 0 ? "Connector" : "Owner-operators · North West",
        leadStatus: invite ? "queued" : "connected",
      })
    );
  }

  const waiting: DemoPreviewFeedItem[] = [];
  for (let i = 0; i < 36; i += 1) {
    waiting.push(
      feedItem(i + 20, now, {
        prefix: "wait",
        hoursAgo: -(30 + i * 3),
        stepType: "invite",
        campaignId: i % 2 === 0 ? CONNECTOR_ID : OWNERS_ID,
        campaignName:
          i % 2 === 0 ? "Connector" : "Owner-operators · North West",
        leadStatus: "queued",
      })
    );
  }

  return {
    sent,
    planned,
    waiting,
    dueCount: remind.counts.due + remind.counts.overdue,
  };
}
