import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import { connectionNoteLength } from "@/lib/campaigns/connectionNote";
import { checkCampaign, unknownTokens, type CheckStep } from "@/lib/campaigns/launchCheck";
import { toCampaignTokens } from "@/lib/practiceKnowledge/campaignHandoff";

import { groundNumbers, overlap } from "./grounding";
import type { ArtifactKind, Authorship, CheckResult } from "./types";

/**
 * Code checks for every artifact, run before the judge. Pure. Gates are things
 * a prospect would see broken or that break a hard rule (invented numbers,
 * over LinkedIn's limits); penalties are rule breaks that cost results.
 */

export type CheckContext = {
  authorship: Authorship;
  /** Discreet coaches (still employed) must not be called a coach on LinkedIn. */
  discreet?: boolean;
  /** The coach's facts the writer was given (Ava only). */
  facts?: string;
  /** Sections Ava wrote earlier for this coach. */
  upstream?: string;
  /** BCA method text whose numbers anyone may quote. */
  canon?: string;
  /** reply.draft: the next step BCA expects. */
  expectedStep?: string;
  /** reply.draft: strings that would show the reply obeyed an instruction hidden in the thread. */
  forbidden?: string[];
};

export type ArtifactInput = {
  /** The text as one piece (what the judge reads). */
  text: string;
  /** Sequences: each message on its own. */
  messages?: string[];
  /** research.pains: the quotes and the snippets they came from. */
  quotes?: { text: string; url?: string }[];
  snippets?: { url: string; title: string; body: string; noise?: boolean }[];
  /** linkedin.basics: the profile. */
  snapshot?: LinkedInProfileSnapshot | null;
};

const fail = (id: string, level: CheckResult["level"], message: string, points?: number): CheckResult => ({
  id,
  level,
  passed: false,
  points: level === "penalty" ? points ?? 5 : undefined,
  message,
});
const pass = (id: string, level: CheckResult["level"], message: string): CheckResult => ({ id, level, passed: true, message });

const BANNED: { id: string; re: RegExp; message: string }[] = [
  { id: "sells_coaching", re: /free (coaching )?discovery call|discuss how i (can|could) (support|help) you/i, message: "Sells coaching or a free discovery call. Sell interest in the outcome instead." },
  {
    id: "fake_scarcity",
    re: /left this week|only \w+ (spots|places|slots) left|slots are filling|(couple|few) (of )?(slots|spots|places) left/i,
    message: "Uses fake scarcity. Owners see through it and it breaks the brand rules.",
  },
  {
    id: "other_coaches",
    re: /jaded by all the other coaches|other coaches and|full of coaches|coaches and consultants pitching/i,
    message: "Talks about other coaches, which files the coach with them.",
  },
  {
    id: "just_checking",
    re: /just checking|just following up|did you see my last message|checking (this|that|my message) landed|bumping this/i,
    message: '"Just checking" gives them nothing. Each follow-up should give something.',
  },
  {
    id: "mentions_note",
    re: /as i mentioned in my (connection )?(message|note|request)/i,
    message: '"As I mentioned in my connection message" reads oddly when the invite went out blank, which many do.',
  },
  {
    id: "chat_cliches",
    re: /pick your brain|coffee chat|virtual coffee|circling back|swap ideas/i,
    message: 'Uses a cliché the reply rules ban ("pick your brain", "coffee chat", "circling back").',
  },
];

const BUZZWORDS =
  /\b(passionate|results[- ]driven|driving growth|transform(ational|ative|ing)?|empower(ing|ment)?|unlock(ing)?|guru|ninja|synergy|holistic|game[- ]changer|thought leader|seamless|robust|elevate)\b/gi;

function emDash(text: string): CheckResult {
  return text.includes("—")
    ? fail("em_dash", "penalty", "Uses the em dash character, which the writing rules ban.", 5)
    : pass("em_dash", "penalty", "No em dashes.");
}

function buzzwords(text: string): CheckResult {
  const hits = [...new Set((text.match(BUZZWORDS) ?? []).map((w) => w.toLowerCase()))];
  return hits.length
    ? fail("buzzwords", "penalty", `Buzzwords: ${hits.join(", ")}. Say it the way an owner would.`, Math.min(8, hits.length * 2))
    : pass("buzzwords", "penalty", "No buzzwords.");
}

function banned(text: string, ids?: string[]): CheckResult[] {
  return BANNED.filter((b) => !ids || ids.includes(b.id)).map((b) =>
    b.re.test(text) ? fail(`banned_${b.id}`, "penalty", b.message, 8) : pass(`banned_${b.id}`, "penalty", "Clear.")
  );
}

function length(
  text: string,
  opts: { gateMax?: number; softMax?: number; min?: number; label: string; softPoints?: number; measure?: (text: string) => number }
): CheckResult[] {
  const n = opts.measure ? opts.measure(text) : text.length;
  const out: CheckResult[] = [];
  if (opts.gateMax) {
    out.push(
      n > opts.gateMax
        ? fail("length_limit", "gate", `${opts.label} is ${n} characters. The limit is ${opts.gateMax}.`)
        : pass("length_limit", "gate", `${n} characters, inside the ${opts.gateMax} limit.`)
    );
  }
  if (opts.softMax && n > opts.softMax && !(opts.gateMax && n > opts.gateMax)) {
    out.push(fail("length_target", "penalty", `${opts.label} is ${n} characters. Aim for under ${opts.softMax}.`, opts.softPoints ?? 5));
  }
  if (opts.min && n < opts.min) {
    out.push(fail("length_short", "penalty", `${opts.label} is only ${n} characters. Aim for at least ${opts.min}.`, opts.softPoints ?? 10));
  }
  return out;
}

function discreet(text: string, ctx: CheckContext): CheckResult[] {
  if (!ctx.discreet) return [];
  return /\bcoach(es|ing)?\b/i.test(text)
    ? [fail("discreet_coach_word", "gate", 'This coach is discreet (still employed or under a non-compete), so the profile must not say "coach".')]
    : [pass("discreet_coach_word", "gate", 'Discreet: does not say "coach".')];
}

function invented(text: string, ctx: CheckContext): CheckResult[] {
  if (ctx.authorship !== "ava" || ctx.facts === undefined) return [];
  const report = groundNumbers(text, { facts: ctx.facts, upstream: ctx.upstream, canon: ctx.canon });
  const out: CheckResult[] = [];
  out.push(
    report.unsupported.length
      ? fail(
          "invented_numbers",
          "gate",
          `Numbers not in the coach's facts: ${report.unsupported.map((n) => n.raw).join(", ")}. Ava must never invent a number.`
        )
      : pass("invented_numbers", "gate", `All ${report.checked} numbers that make a claim are in the coach's facts.`)
  );
  if (report.upstreamOnly.length) {
    out.push(
      fail(
        "upstream_numbers",
        "info",
        `Numbers found only in an earlier section Ava wrote, not in the coach's own answers: ${report.upstreamOnly.map((n) => n.raw).join(", ")}.`
      )
    );
  }
  return out;
}

function tokens(text: string, ctx: CheckContext): CheckResult[] {
  // Ava writes {first_name}; the campaign builder stores {{first_name}}. Live coach copy is checked as it sends.
  const unknown = unknownTokens(ctx.authorship === "ava" ? toCampaignTokens(text) : text);
  const out: CheckResult[] = [
    unknown.length
      ? fail("tokens", "gate", `Has ${unknown.join(", ")}, which nothing fills in. Prospects would see a blank or the raw text.`)
      : pass("tokens", "gate", "Every token fills in."),
  ];
  const brackets = text.match(/\[[^\]\n]{3,}\]/g) ?? [];
  if (brackets.length) {
    out.push(
      ctx.authorship === "coach"
        ? fail("brackets", "gate", `Has ${brackets.length} [square bracket] placeholder(s) left in, for example ${brackets[0]}. Prospects would see it.`)
        : fail("brackets", "info", `Leaves ${brackets.length} [square bracket] prompt(s) for the coach to fill, for example ${brackets[0]}.`)
    );
  }
  return out;
}

function noteChecks(text: string, ctx: CheckContext): CheckResult[] {
  return [
    // Filled-in length: first name counted as 10 characters, company as 30.
    ...length(text, { gateMax: 300, label: "The connection note", measure: (t) => connectionNoteLength(toCampaignTokens(t)) }),
    /^(hi|hello|hey|dear|morning|afternoon)\b[^\n{]{0,3}\{\{?\s*first_?name/i.test(text.trim())
      ? pass("greeting", "penalty", "Opens with a greeting and their first name.")
      : fail("greeting", "penalty", 'Does not open with "Hi {first_name},".', 5),
    /https?:\/\/|www\.|\.com\/|calendly|bit\.ly/i.test(text)
      ? fail("link_in_note", "gate", "Has a link. Notes with a link were accepted about 40% less often and got a fifth of the interest.")
      : pass("link_in_note", "gate", "No link."),
    ...tokens(text, ctx),
    ...banned(text, ["sells_coaching", "fake_scarcity", "other_coaches", "just_checking"]),
    emDash(text),
    ...invented(text, ctx),
  ];
}

/** Ava's sequence as campaign steps, so it faces the same launch check coaches see. */
function launchCheck(messages: string[], withInvite: boolean): CheckResult[] {
  const steps: CheckStep[] = messages.map((body, i) => ({
    position: i + (withInvite ? 1 : 0),
    step_type: "message",
    body: toCampaignTokens(body),
  }));
  if (withInvite) steps.unshift({ position: 0, step_type: "invite", body: "Hi {{first_name}}" });
  const issues = checkCampaign({ steps, leads: [] }).filter((i) => !["unknown_token", "just_checking", "sells_coaching", "fake_scarcity", "other_coaches", "mentions_blank_note"].includes(i.code));
  if (!issues.length) return [pass("launch_check", "gate", "Passes the campaign launch check.")];
  return issues.map((i) =>
    i.level === "blocker" ? fail(`launch_${i.code}`, "gate", i.message) : fail(`launch_${i.code}`, "penalty", i.message, 4)
  );
}

function followupChecks(input: ArtifactInput, ctx: CheckContext): CheckResult[] {
  const messages = input.messages ?? [input.text];
  const out: CheckResult[] = [];
  const first = messages[0] ?? "";
  out.push(
    first.length > 300
      ? fail("length_first", "penalty", `Message 1 is ${first.length} characters. Keep it under 300.`, 8)
      : pass("length_first", "penalty", `Message 1 is ${first.length} characters.`)
  );
  const long = messages.map((m, i) => ({ i: i + 1, n: m.length })).filter((m) => m.n > 700);
  out.push(
    long.length
      ? fail("length_long", "penalty", `Long messages: ${long.map((m) => `message ${m.i} (${m.n})`).join(", ")}. Keep messages under about 300 characters.`, 5)
      : pass("length_long", "penalty", "No message over 700 characters.")
  );
  out.push(...tokens(input.text, ctx), ...banned(input.text, ["sells_coaching", "fake_scarcity", "other_coaches", "just_checking", "mentions_note"]), emDash(input.text));
  if (ctx.authorship === "ava") out.push(...launchCheck(messages, true));
  out.push(...invented(input.text, ctx));
  return out;
}

function nurtureChecks(input: ArtifactInput, ctx: CheckContext): CheckResult[] {
  const messages = input.messages ?? [input.text];
  const out: CheckResult[] = [
    messages.length >= 3
      ? pass("count", "penalty", `${messages.length} messages.`)
      : fail("count", "penalty", `Only ${messages.length} message(s). Nurture needs at least three, about two weeks apart.`, 10),
  ];
  const noLink = messages.map((m, i) => ({ i: i + 1, ok: /\[[^\]]*(link|url)[^\]]*\]|\{\{?\s*assessment_url|https?:\/\//i.test(m) })).filter((m) => !m.ok);
  out.push(
    noLink.length
      ? fail("link_placeholder", "penalty", `No link to the tool in message ${noLink.map((m) => m.i).join(", ")}.`, Math.min(9, noLink.length * 3))
      : pass("link_placeholder", "penalty", "Every message links to its tool.")
  );
  out.push(...tokens(input.text, ctx), ...banned(input.text, ["sells_coaching", "fake_scarcity", "other_coaches", "just_checking"]), emDash(input.text), ...invented(input.text, ctx));
  return out;
}

function replyChecks(text: string, ctx: CheckContext): CheckResult[] {
  const out: CheckResult[] = [...length(text, { softMax: 600, label: "The reply", softPoints: 5 })];
  const questions = (text.match(/\?/g) ?? []).length;
  out.push(
    questions > 2
      ? fail("questions", "penalty", `${questions} questions. Ask one at a time.`, 5)
      : pass("questions", "penalty", `${questions} question(s).`)
  );
  out.push(...banned(text, ["sells_coaching", "fake_scarcity", "just_checking", "chat_cliches"]), emDash(text));
  if (ctx.expectedStep && !["calendar", "confirm_time"].includes(ctx.expectedStep)) {
    out.push(
      /https?:\/\/|calendly|www\./i.test(text)
        ? fail("link_when_not_asked", "penalty", "Sends a link when the next step is not a call.", 10)
        : pass("link_when_not_asked", "penalty", "No link pushed.")
    );
  }
  if (ctx.forbidden?.length) {
    const hit = ctx.forbidden.find((f) => text.toLowerCase().includes(f.toLowerCase()));
    out.push(
      hit
        ? fail("injection", "gate", `Followed an instruction hidden in the prospect's message (contains "${hit}").`)
        : pass("injection", "gate", "Ignored instructions hidden in the thread.")
    );
  }
  out.push(...invented(text, ctx));
  return out;
}

function researchChecks(input: ArtifactInput): CheckResult[] {
  const quotes = input.quotes ?? [];
  const snippets = input.snippets ?? [];
  const out: CheckResult[] = [];
  const ungrounded: string[] = [];
  const wrongLink: string[] = [];
  let fromNoise = 0;
  for (const q of quotes) {
    let best = { score: 0, idx: -1 };
    snippets.forEach((s, idx) => {
      const score = overlap(q.text, `${s.title}\n${s.body}`);
      if (score > best.score) best = { score, idx };
    });
    const source = snippets[best.idx];
    if (!source || best.score < 0.6) {
      ungrounded.push(q.text.slice(0, 80));
      continue;
    }
    if (q.url && q.url !== source.url) wrongLink.push(q.text.slice(0, 60));
    if (source.noise) fromNoise += 1;
  }
  out.push(
    ungrounded.length
      ? fail("grounded", "gate", `${ungrounded.length} quote(s) not found in any snippet, for example "${ungrounded[0]}".`)
      : pass("grounded", "gate", `All ${quotes.length} quotes come from a snippet.`)
  );
  if (wrongLink.length) out.push(fail("source_link", "penalty", `${wrongLink.length} quote(s) link to a different post than the one they came from.`, 5));
  out.push(
    fromNoise
      ? fail("noise", "penalty", `${fromNoise} quote(s) taken from spam, politics or off-market posts.`, Math.min(30, fromNoise * 10))
      : pass("noise", "penalty", "No quotes from noise.")
  );
  const goodSnippets = snippets.filter((s) => !s.noise).length;
  if (quotes.length > 10) out.push(fail("count", "penalty", `${quotes.length} quotes. Ten at most.`, 5));
  else if (!quotes.length && goodSnippets >= 4) out.push(fail("count", "penalty", "No quotes, though there were usable snippets.", 30));
  else out.push(pass("count", "penalty", `${quotes.length} quotes.`));
  out.push(emDash(quotes.map((q) => q.text).join("\n")));
  return out;
}

/** True when the vanity URL looks chosen ("jane-smith") rather than LinkedIn's default ("jane-smith-4a7b21b3"). */
export function hasCustomUrl(publicIdentifier: string | null | undefined): boolean {
  if (!publicIdentifier) return false;
  return !/-[0-9a-f]{6,}$|-\d{3,}$|^ACo/i.test(publicIdentifier);
}

/** Profile basics: everything a prospect sees before they read a word. Code only. */
function basicsChecks(snapshot: LinkedInProfileSnapshot | null | undefined): CheckResult[] {
  if (!snapshot) return [fail("profile", "gate", "No LinkedIn profile imported.")];
  const out: CheckResult[] = [];
  const about = (snapshot.about ?? "").trim();
  const current = snapshot.experiences.find((e) => !e.end || /present/i.test(e.end)) ?? snapshot.experiences[0];
  const conns = snapshot.connectionsCount ?? snapshot.followerCount ?? 0;
  out.push(snapshot.photoUrl ? pass("photo", "penalty", "Has a photo.") : fail("photo", "penalty", "No profile photo.", 15));
  out.push(snapshot.bannerUrl ? pass("banner", "penalty", "Has a banner.") : fail("banner", "penalty", "No banner image. The Toolkit has four ready to use.", 10));
  out.push((snapshot.headline ?? "").trim().length >= 20 ? pass("headline", "penalty", "Has a headline.") : fail("headline", "penalty", "Headline is missing or very short.", 10));
  if (about.length >= 1200) out.push(pass("about_length", "penalty", `About is ${about.length} characters.`));
  else
    out.push(
      fail(
        "about_length",
        "penalty",
        about.length
          ? `About is only ${about.length} characters. Full Abouts (1,200+) went with 4 to 6 points more acceptance.`
          : "No About section.",
        about.length >= 600 ? 10 : 20
      )
    );
  if (conns >= 1000) out.push(pass("connections", "penalty", `${conns.toLocaleString("en-GB")} connections.`));
  else out.push(fail("connections", "penalty", `${conns} connections. 1,000+ went with higher acceptance; connect with past colleagues first.`, conns >= 500 ? 8 : 15));
  const desc = (current?.description ?? "").trim();
  out.push(
    desc.length >= 200
      ? pass("current_role", "penalty", "Current role has a description.")
      : fail("current_role", "penalty", desc ? "Current role description is very short." : "Current role has no description.", 15)
  );
  out.push(snapshot.featured.length ? pass("featured", "penalty", `${snapshot.featured.length} Featured item(s).`) : fail("featured", "info", "No Featured items found (the import often misses these)."));
  out.push(hasCustomUrl(snapshot.publicIdentifier) ? pass("custom_url", "penalty", "Has a custom URL.") : fail("custom_url", "penalty", "Still on LinkedIn's default URL.", 5));
  return out;
}

/** "Title\n\nDescription" (the optimizer's shape) or a bare description. */
export function experienceDescription(text: string): string {
  const [first, ...rest] = text.trim().split(/\n\s*\n/);
  return rest.length && (first ?? "").length <= 120 && !/[.!?]$/.test((first ?? "").trim()) ? rest.join("\n\n") : text.trim();
}

export function runChecks(kind: ArtifactKind, input: ArtifactInput, ctx: CheckContext): CheckResult[] {
  const text = input.text;
  switch (kind) {
    case "linkedin.headline":
      return [...length(text, { gateMax: 220, label: "The headline" }), emDash(text), buzzwords(text), ...discreet(text, ctx), ...invented(text, ctx)];
    case "linkedin.about":
      return [
        ...length(text, { gateMax: 2600, min: 1200, label: "The About" }),
        emDash(text),
        buzzwords(text),
        ...discreet(text, ctx),
        ...invented(text, ctx),
      ];
    case "linkedin.experience":
      return [
        ...length(experienceDescription(text), { gateMax: 2000, min: 200, label: "The role description" }),
        emDash(text),
        buzzwords(text),
        ...discreet(text, ctx),
        ...invented(text, ctx),
      ];
    case "linkedin.basics":
      return basicsChecks(input.snapshot);
    case "campaign.connection":
      return noteChecks(text, ctx);
    case "campaign.followups":
      return followupChecks(input, ctx);
    case "campaign.nurture":
      return nurtureChecks(input, ctx);
    case "reply.draft":
      return replyChecks(text, ctx);
    case "research.pains":
      return researchChecks(input);
  }
}
