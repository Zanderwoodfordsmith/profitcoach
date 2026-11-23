import { after, NextResponse } from "next/server";

import { parseCoachIdHeader } from "@/lib/coachId";
import {
  askCoach,
  chaseState,
  dismiss,
  draftScores,
  fillFromReplies,
  jobSkills,
  listActivity,
  openForCoaches,
  runAva,
  saveAnswers,
  sendMessage,
  talkToAva,
  type AnswerFill,
} from "@/lib/launch/jobActivity";
import { advanceCoach, draftPageAnswers, draftProspectSearches, editOpenAnswer, editOpenDraft, editProspectSearch, importSearches, releaseDraft, sizeProspectSearches } from "@/lib/launch/avaAuto";
import { sanitizeBlocks } from "@/lib/practiceKnowledge/blocks";
import { isScope, scopePage } from "@/lib/launch/avaWork";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
// A job's sections are drafted in a run of a minute or two.
export const maxDuration = 300;

/** First names and photos of the BCA staff who wrote in the activity. */
async function authorsOf(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return {};
  const { data } = await supabaseAdmin.from("profiles").select("id, first_name, full_name, avatar_url").in("id", unique);
  return Object.fromEntries(
    (data ?? []).map((p) => [
      p.id,
      { name: p.first_name?.trim() || p.full_name?.trim().split(/\s+/)[0] || "BCA", avatar_url: p.avatar_url ?? null },
    ])
  );
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Ava's Activity, BCA only (job 172), for a Blueprint page ("page:market") or
 * a launch job. With ?coachId&job: its
 * feed, Ava's chasing and how often her drafts for this job are saved as she
 * wrote them. With only ?coachId: what's waiting for BCA on each job.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return fail(auth.error, auth.error === "Server error." ? 500 : 401);
  const url = new URL(request.url);
  const coachId = parseCoachIdHeader(url.searchParams.get("coachId") ?? "");
  if (!coachId) return fail("Unknown coach.");
  const job = url.searchParams.get("job");
  try {
    if (!job) {
      const open = await openForCoaches([coachId]);
      return NextResponse.json({ open: open[coachId] ?? {} });
    }
    if (!isScope(job)) return fail("Unknown job.");
    const [items, scores, chase] = await Promise.all([listActivity(coachId, job), draftScores(), chaseState(coachId, job)]);
    return NextResponse.json({
      items,
      score: scores[job] ?? { saved: 0, asWritten: 0 },
      chase: { chases: chase.chases, sentToday: chase.sentToday, replies: chase.replies.length },
      skills: jobSkills(job),
      authors: await authorsOf(items.map((i) => i.created_by)),
    });
  } catch (err) {
    console.error("job activity:", err instanceof Error ? err.message : "failed");
    return fail("Could not load the activity.", 500);
  }
}

type Body = {
  action?:
    | "run"
    | "talk"
    | "ask"
    | "fill"
    | "save"
    | "send"
    | "save_answers"
    | "dismiss"
    | "draft_answers"
    | "draft_searches"
    | "import"
    | "advance"
    | "edit"
    | "edit_answer"
    | "edit_search"
    | "size_searches";
  coachId?: string;
  job?: string;
  id?: string;
  text?: string;
  answers?: AnswerFill[];
  picks?: { id: string; on: boolean }[];
  /** edit: one section's blocks, or one LinkedIn part's words. edit_answer: one box (path + text). */
  path?: string;
  key?: string;
  blocks?: unknown;
  part?: string;
  /** edit_search: the searches shown as one row, and the list's new parts. */
  searchIds?: string[];
  label?: string;
  companyIncludes?: string[];
  industries?: string[];
  keywords?: string;
  teamSizes?: string[];
};

/** A release or a change unblocks what comes next (the launch chain): Ava starts on it straight away, in the background. */
function advanceLater(coachId: string | null, userId: string | null) {
  if (!coachId) return;
  after(() =>
    advanceCoach(coachId, userId).catch((err) => {
      console.error("advance after release:", err instanceof Error ? err.message : "failed");
    })
  );
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return fail(auth.error, auth.error === "Server error." ? 500 : 401);
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.action) return fail("Missing action.");
  const coachId = parseCoachIdHeader(body.coachId ?? "");
  const job = body.job && isScope(body.job) ? body.job : null;
  const userId = auth.userId;
  try {
    switch (body.action) {
      case "run":
        if (!coachId || !job) return fail("Unknown coach or job.");
        await runAva(coachId, job, userId);
        advanceLater(coachId, userId);
        break;
      case "talk":
        if (!coachId || !job) return fail("Unknown coach or job.");
        await talkToAva(coachId, job, userId, body.text ?? "");
        advanceLater(coachId, userId);
        break;
      case "ask":
        if (!coachId || !job) return fail("Unknown coach or job.");
        await askCoach(coachId, job, userId);
        break;
      case "fill":
        if (!coachId || !job) return fail("Unknown coach or job.");
        await fillFromReplies(coachId, job, userId);
        break;
      case "save":
        if (!body.id) return fail("Missing draft.");
        await releaseDraft(body.id, userId);
        advanceLater(coachId, userId);
        break;
      case "send":
        if (!body.id) return fail("Missing message.");
        await sendMessage(body.id, userId, body.text ?? "");
        break;
      case "save_answers":
        if (!body.id) return fail("Missing answers.");
        await saveAnswers(body.id, userId, body.answers);
        advanceLater(coachId, userId);
        break;
      case "draft_answers": {
        const slug = job ? scopePage(job) : null;
        if (!coachId || !slug) return fail("Unknown coach or page.");
        await draftPageAnswers(coachId, slug, userId);
        advanceLater(coachId, userId);
        break;
      }
      case "draft_searches":
        if (!coachId) return fail("Unknown coach.");
        await draftProspectSearches(coachId, userId, body.text);
        advanceLater(coachId, userId);
        break;
      case "import":
        if (!body.id) return fail("Missing searches.");
        await importSearches(body.id, userId, body.picks);
        break;
      case "edit_search": {
        if (!body.id || !body.searchIds?.length) return fail("Missing list.");
        const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
        await editProspectSearch(body.id, userId, {
          searchIds: strings(body.searchIds),
          label: body.label ?? "",
          companyIncludes: strings(body.companyIncludes),
          industries: strings(body.industries),
          keywords: body.keywords ?? "",
          teamSizes: strings(body.teamSizes),
        });
        break;
      }
      case "size_searches": {
        if (!body.id) return fail("Missing searches.");
        const sized = await sizeProspectSearches(body.id, userId);
        return NextResponse.json({ ok: true, ...sized });
      }
      case "advance": {
        if (!coachId) return fail("Unknown coach.");
        const started = await advanceCoach(coachId, userId);
        return NextResponse.json({ ok: true, started });
      }
      case "edit":
        // BCA's own small changes on the Launch page (job 248); Release still decides when it goes.
        if (!body.id) return fail("Missing draft.");
        await editOpenDraft(body.id, {
          key: body.key,
          blocks: body.blocks === undefined ? undefined : sanitizeBlocks(body.blocks),
          part: body.part,
          text: body.text,
        });
        break;
      case "edit_answer":
        if (!body.id || !body.path) return fail("Missing answer.");
        await editOpenAnswer(body.id, body.path, body.text ?? "");
        break;
      case "dismiss":
        if (!body.id) return fail("Missing item.");
        await dismiss(body.id, userId);
        break;
      default:
        return fail("Unknown action.");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    console.error(`job activity ${body.action}:`, message);
    return fail(message, 500);
  }
}
