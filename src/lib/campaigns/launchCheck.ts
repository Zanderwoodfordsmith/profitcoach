import { dominantSector } from "@/lib/campaigns/sectorTiers";
import { resolveMergeField } from "@/lib/unipile/mergeFields";

/**
 * Pre-launch check for a campaign, built from what the 110k-invite review
 * (Oct 2026) showed hurts results. Blockers stop a campaign turning on because
 * prospects would see something broken. Warnings explain a likely cost.
 */

export type CheckStep = { position: number; step_type: string; body: string | null; variants?: unknown };
export type CheckLead = { title: string | null; location: string | null; company: string | null };

export type CheckIssue = {
  level: "blocker" | "warning";
  code: string;
  message: string;
  step?: number;
};

const INVITE_NOTE_MAX = 300;
const LONG_MESSAGE = 700;

const BANNED: { re: RegExp; code: string; message: string }[] = [
  {
    re: /free (coaching )?discovery call/i,
    code: "sells_coaching",
    message: 'Offers a "Free Coaching Discovery Call". Selling coaching in outreach puts owners off; offer a look at their numbers or a short call about their problem instead.',
  },
  {
    re: /left this week|only \w+ (spots|places|slots) left|slots are filling/i,
    code: "fake_scarcity",
    message: "Uses scarcity (\"a few calls left this week\"). Owners see through it and it breaks our brand rules.",
  },
  {
    re: /jaded by all the other coaches|other coaches and/i,
    code: "other_coaches",
    message: 'Says prospects are "jaded by all the other coaches", which files you with them.',
  },
  {
    re: /just checking (if|whether) you saw my last message|did you see my last message/i,
    code: "just_checking",
    message: '"Just checking you saw my last message" gives them nothing. Make each follow-up give something: a number, an insight, a tool.',
  },
];

function bodiesOf(step: CheckStep): string[] {
  const out = [step.body ?? ""];
  if (Array.isArray(step.variants)) {
    for (const v of step.variants) {
      const body = (v as { body?: unknown })?.body;
      if (typeof body === "string") out.push(body);
    }
  }
  return out.filter((b) => b.trim());
}

export function unknownTokens(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)) {
    const key = m[1] ?? "";
    const field = key ? resolveMergeField(key) : null;
    // Unknown keys, and template placeholders nothing fills in (insertable: false,
    // e.g. {{market_observation}}), would both reach the prospect blank.
    if (!field || field.insertable === false) found.push(`{{${key}}}`);
  }
  for (const m of text.matchAll(/\{\{[^}]*$|\{[a-z_]+\}(?!\})/gi)) found.push(m[0]);
  return [...new Set(found)];
}

const TRADES_RE = /\b(plumb|electric|roofer|roofing|builder|joiner|carpent|plaster|scaffold|heating|hvac|gas engineer|landscap|groundwork|decorat|tiler|glazier|locksmith)/i;
const OWNER_RE = /^\s*(business |company )?owner\s*$/i;
const US_RE = /united states|, (tx|ca|fl|ny|texas|california|florida|new york)\b/i;

export function checkCampaign(input: { steps: CheckStep[]; leads: CheckLead[]; coachCountry?: "UK" | "US" | null }): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const steps = [...input.steps].sort((a, b) => a.position - b.position);
  const invite = steps.find((s) => s.step_type === "invite");
  const inviteBlank = invite ? bodiesOf(invite).length === 0 : false;

  for (const step of steps) {
    if (!["invite", "message", "email", "whatsapp", "inmail"].includes(step.step_type)) continue;
    const label = step.position + 1;
    for (const body of bodiesOf(step)) {
      const unknown = unknownTokens(body);
      if (unknown.length) {
        issues.push({
          level: "blocker",
          code: "unknown_token",
          step: label,
          message: `Step ${label} has ${unknown.join(", ")}, which won't fill in. Prospects would see a blank or the raw text. Write your own words in its place, or pick a field from the list.`,
        });
      }
      if (/(Hey|Hi|Hello)\{\{/i.test(body)) {
        issues.push({ level: "blocker", code: "glued_greeting", step: label, message: `Step ${label} has no space between the greeting and the name ("Hi{{first_name}}").` });
      }
      if (/\ban? \{\{\s*company\s*\}\}\s+(business|company|firm)/i.test(body)) {
        issues.push({
          level: "warning",
          code: "company_as_industry",
          step: label,
          message: `Step ${label} says "a {{company}} business". That reads "a Smith & Co Ltd business". Use their industry in words instead.`,
        });
      }
      for (const b of BANNED) {
        if (b.re.test(body)) issues.push({ level: "warning", code: b.code, step: label, message: `Step ${label}: ${b.message}` });
      }
      if (step.step_type === "invite") {
        if (body.length > INVITE_NOTE_MAX) {
          issues.push({ level: "blocker", code: "note_too_long", step: label, message: `The connection note is ${body.length} characters. LinkedIn allows ${INVITE_NOTE_MAX}.` });
        }
        if (/https?:\/\/|www\.|\.com\//i.test(body)) {
          issues.push({
            level: "warning",
            code: "link_in_note",
            step: label,
            message: "The connection note has a link. In our data, notes with a link were accepted about 40% less often and got a fifth of the interest. Send the link after they reply.",
          });
        }
      } else if (step.step_type === "message" && body.length > LONG_MESSAGE) {
        issues.push({ level: "warning", code: "long_message", step: label, message: `Step ${label} is ${body.length} characters. Messages under about 300 characters get more replies.` });
      }
      if (inviteBlank && step.step_type === "message" && /as i mentioned in my (connection )?(message|note)/i.test(body)) {
        issues.push({
          level: "warning",
          code: "mentions_blank_note",
          step: label,
          message: `Step ${label} says "as I mentioned in my connection message", but the invite has no note.`,
        });
      }
    }
  }

  const leads = input.leads.filter((l) => l.title || l.company || l.location);
  if (leads.length >= 20) {
    const share = (fn: (l: CheckLead) => boolean) => leads.filter(fn).length / leads.length;
    const trades = share((l) => TRADES_RE.test(`${l.title ?? ""} ${l.company ?? ""}`));
    if (trades >= 0.3) {
      issues.push({
        level: "warning",
        code: "trades_audience",
        message: `About ${Math.round(trades * 100)}% of these people look like trades businesses. Trades owners accepted only 2 to 7% of LinkedIn invites in our data. Email, phone or post usually reach them better.`,
      });
    }
    const dom = dominantSector(leads);
    if (dom && dom.tier.score <= 4 && trades < 0.3) {
      issues.push({
        level: "warning",
        code: "low_linkedin_sector",
        message: `About ${Math.round(dom.share * 100)}% of these people are in ${dom.tier.sector.toLowerCase()}, which scores ${dom.tier.score}/10 for LinkedIn in our data. Run email, phone or post alongside this campaign.`,
      });
    }
    const owners = share((l) => OWNER_RE.test(l.title ?? ""));
    if (owners >= 0.4) {
      issues.push({
        level: "warning",
        code: "owner_titles",
        message: `About ${Math.round(owners * 100)}% are titled just "Owner". That group replied least on LinkedIn (0.5% interested vs 2.5% for founders). Make sure they're the businesses you want.`,
      });
    }
    if ((input.coachCountry ?? "UK") === "UK") {
      const us = share((l) => US_RE.test(l.location ?? ""));
      if (us >= 0.3) {
        issues.push({
          level: "warning",
          code: "us_audience",
          message: `About ${Math.round(us * 100)}% are in the US. UK coaches' US campaigns were accepted around 5 to 6% of the time. A US angle or proof helps.`,
        });
      }
    }
  }

  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.code}:${i.step ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Load a campaign's steps and a sample of its people, then check it. Server only. */
export async function checkCampaignById(coachId: string, campaignId: string): Promise<CheckIssue[]> {
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  const [{ data: steps }, { data: leads }] = await Promise.all([
    supabaseAdmin.from("linkedin_campaign_steps").select("position, step_type, body, variants").eq("campaign_id", campaignId),
    supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("title, company, metadata")
      .eq("campaign_id", campaignId)
      .eq("coach_id", coachId)
      .limit(300),
  ]);
  return checkCampaign({
    steps: (steps ?? []).map((s) => ({
      position: Number(s.position),
      step_type: String(s.step_type),
      body: (s.body as string | null) ?? null,
      variants: s.variants,
    })),
    leads: (leads ?? []).map((l) => {
      const meta = (l.metadata ?? {}) as Record<string, unknown>;
      return {
        title: (l.title as string | null) ?? null,
        company: (l.company as string | null) ?? null,
        location: typeof meta.location === "string" ? meta.location : null,
      };
    }),
  });
}
