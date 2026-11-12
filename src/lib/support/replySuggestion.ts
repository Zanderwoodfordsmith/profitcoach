import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_ANTHROPIC_MODEL } from "@/lib/anthropicModel";
import { addUsage, emptyTally, logAiUsage } from "@/lib/ai/usageLog";
import { loadBrandKnowledgeOverrides } from "@/lib/profitCoachAi/brandKnowledge";
import { DEFAULT_SUPPORT_ASSIGNEE_ID } from "@/lib/support/assignees";
import {
  changedShare,
  settleConfidence,
  suggestionTargetAt,
  type SuggestionConfidence,
} from "@/lib/support/replySuggestionRules";
import {
  buildSupportCallBookingUrl,
  loadTicketSupportCallContact,
  resolveSupportCallHostSlug,
} from "@/lib/support/supportCallPrefill";
import { SUPPORT_CALL_PUBLIC_ORIGIN } from "@/lib/support/supportCallHosts";
import {
  composeSupportCopilotSystem,
  composeSupportCopilotUserMessage,
  dedupeSupportThread,
  sanitizeSupportSuggestion,
  type SupportCopilotMessage,
} from "@/lib/support/supportCopilot";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Person = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  role: string | null;
};

const PERSON_SELECT = "id, full_name, first_name, role";

function personName(person: Person | null | undefined): string | null {
  return person?.full_name?.trim() || person?.first_name?.trim() || null;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** The system and user messages for writing a reply on this ticket. */
export async function buildSupportReplyPrompt(input: {
  ticketId: string;
  hint: string;
  sendAsId: string;
}): Promise<
  | { ok: true; system: string; user: string }
  | { ok: false; status: number; error: string }
> {
  const { ticketId, hint, sendAsId } = input;
  const { data: ticket, error: ticketErr } = await supabaseAdmin
    .from("community_feedback_reports")
    .select(
      "id, ticket_number, type, status, source, title, details, page_path, created_at, created_by, assigned_to, contact_email, submitter_name"
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketErr || !ticket) {
    return { ok: false, status: 404, error: "Ticket not found." };
  }

  const memberId = (ticket.created_by as string | null) ?? null;
  const contactEmail =
    (ticket.contact_email as string | null)?.trim().toLowerCase() || null;

  const historyQuery = supabaseAdmin
    .from("community_feedback_reports")
    .select("ticket_number, title, status, created_at")
    .neq("id", ticketId)
    .order("created_at", { ascending: false })
    .limit(5);

  const [repliesRes, notesRes, historyRes, memberRes, senderRes, overrides] =
    await Promise.all([
      supabaseAdmin
        .from("community_feedback_replies")
        .select(`created_at, created_by, body, author:profiles!created_by (${PERSON_SELECT})`)
        .eq("report_id", ticketId)
        .order("created_at", { ascending: true })
        .limit(300),
      supabaseAdmin
        .from("support_ticket_internal_notes")
        .select(`created_at, body, author:profiles!created_by (${PERSON_SELECT})`)
        .eq("report_id", ticketId)
        .order("created_at", { ascending: true })
        .limit(20),
      memberId
        ? historyQuery.eq("created_by", memberId)
        : contactEmail
          ? historyQuery.eq("contact_email", contactEmail)
          : Promise.resolve({ data: [], error: null }),
      memberId
        ? supabaseAdmin
            .from("profiles")
            .select(PERSON_SELECT)
            .eq("id", memberId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabaseAdmin
        .from("profiles")
        .select(PERSON_SELECT)
        .eq("id", sendAsId)
        .maybeSingle(),
      loadBrandKnowledgeOverrides(),
    ]);

  if (repliesRes.error) {
    console.error("support reply prompt replies:", repliesRes.error.message);
    return { ok: false, status: 500, error: "Could not load replies." };
  }
  if (notesRes.error) {
    // Notes are optional context; keep drafting without them.
    console.warn("support reply prompt notes:", notesRes.error.message);
  }

  const thread: SupportCopilotMessage[] = (repliesRes.data ?? []).map((row) => {
    const author = one(row.author as Person | Person[] | null);
    const isStaff =
      author?.role === "admin" && (row.created_by as string) !== memberId;
    return {
      created_at: String(row.created_at ?? ""),
      role: isStaff ? "staff" : "member",
      author_name: personName(author),
      body: typeof row.body === "string" ? row.body : "",
    };
  });

  const notes = (notesRes.data ?? []).map((row) => ({
    created_at: String(row.created_at ?? ""),
    author_name: personName(one(row.author as Person | Person[] | null)),
    body: typeof row.body === "string" ? row.body : "",
  }));

  const history = ((historyRes.data ?? []) as {
    ticket_number: number;
    title: string | null;
    status: string;
    created_at: string;
  }[]).map((t) => ({
    ticket_number: t.ticket_number,
    title: t.title,
    status: t.status,
    created_at: t.created_at,
  }));

  const memberName =
    personName(memberRes.data as Person | null) ||
    (ticket.submitter_name as string | null)?.trim() ||
    null;

  const [hostSlug, contact] = await Promise.all([
    resolveSupportCallHostSlug(ticket.assigned_to as string | null),
    loadTicketSupportCallContact({
      created_by: memberId,
      contact_email: contactEmail,
      submitter_name: (ticket.submitter_name as string | null) ?? null,
    }),
  ]);
  const supportCallUrl = buildSupportCallBookingUrl({
    baseUrl: SUPPORT_CALL_PUBLIC_ORIGIN,
    hostSlug,
    contact,
  });

  return {
    ok: true,
    system: composeSupportCopilotSystem(overrides),
    user: composeSupportCopilotUserMessage({
      ticket: {
        ticket_number: Number(ticket.ticket_number),
        type: String(ticket.type ?? ""),
        status: String(ticket.status ?? ""),
        source: String(ticket.source ?? ""),
        title: (ticket.title as string | null) ?? null,
        details: String(ticket.details ?? ""),
        page_path: (ticket.page_path as string | null) ?? null,
        created_at: String(ticket.created_at ?? ""),
        member_name: memberName,
      },
      thread: dedupeSupportThread(thread),
      notes,
      history,
      senderName: personName(senderRes.data as Person | null),
      supportCallUrl,
      staffHint: hint,
    }),
  };
}

const CONFIDENCE_RULES = `Suggested draft

Nobody asked for this draft yet: staff will see it ready when they open the chat, so STAFF_HINT will be empty. Put the message in "reply", following the Output rules above, then judge it honestly.

"confidence":
- "high": the thread, NOTES or playbook fully answer it, nothing needs filling in, and staff could send it as written.
- "medium": probably right, but it rests on something staff should check first.
- "low": it has a [placeholder], needs a fact or decision only staff have, the cause is unknown, or it involves money, refunds, invoices or changes to someone's account.

"reason": one plain sentence under 20 words. Say what staff should check, or for "high" what the answer rests on. Never use the em dash character.`;

const SUGGESTION_FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      reply: { type: "string" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      reason: { type: "string" },
    },
    required: ["reply", "confidence", "reason"],
    additionalProperties: false,
  },
} as const;

export type DraftedReply = {
  body: string;
  confidence: SuggestionConfidence;
  reason: string;
};

/** Writes one draft and rates it. Saves nothing, sends nothing. */
export async function draftSupportReplyWithConfidence(input: {
  ticketId: string;
  sendAsId: string;
}): Promise<DraftedReply> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("Reply suggestions are not configured.");

  const prompt = await buildSupportReplyPrompt({ ...input, hint: "" });
  if (!prompt.ok) throw new Error(prompt.error);

  const response = await new Anthropic({ apiKey }).messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 2000,
    system: `${prompt.system}\n\n${CONFIDENCE_RULES}`,
    messages: [{ role: "user", content: prompt.user }],
    output_config: { format: SUGGESTION_FORMAT },
  });

  const tally = emptyTally();
  addUsage(tally, DEFAULT_ANTHROPIC_MODEL, response.usage);
  const { data: ticket } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("created_by")
    .eq("id", input.ticketId)
    .maybeSingle();
  await logAiUsage({
    surface: "ava",
    mode: "admin",
    coachId: (ticket?.created_by as string | null) ?? null,
    chatId: null,
    skills: ["support-reply-suggestion"],
    model: DEFAULT_ANTHROPIC_MODEL,
    tally,
  });

  if (response.stop_reason !== "end_turn") {
    throw new Error(`Draft stopped early: ${response.stop_reason}`);
  }
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  const parsed = JSON.parse(text) as {
    reply: string;
    confidence: SuggestionConfidence;
    reason: string;
  };
  const body = sanitizeSupportSuggestion(parsed.reply);
  if (!body) throw new Error("The draft came back empty.");
  return {
    body,
    confidence: settleConfidence(parsed.confidence, body),
    reason: parsed.reason.trim(),
  };
}

export type SupportReplySuggestion = {
  id: string;
  body: string;
  confidence: SuggestionConfidence;
  reason: string;
};

const SUGGESTION_SELECT = "id, status, body, confidence, confidence_reason, updated_at";

type SuggestionRow = {
  id: string;
  status: "drafting" | "ready" | "failed" | "dismissed" | "sent";
  body: string | null;
  confidence: SuggestionConfidence | null;
  confidence_reason: string | null;
  updated_at: string;
};

/** A draft stuck this long (a crash, a timeout) can be tried again. */
const RETRY_AFTER_MS = 5 * 60 * 1000;

/** The message this ticket's draft should answer, or null if it needs none. */
async function targetFor(ticketId: string): Promise<{
  basedOnAt: string;
  sendAsId: string;
} | null> {
  const { data: ticket, error } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("status, source, created_at, created_by, assigned_to")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!ticket) return null;

  const [replies, owner] = await Promise.all([
    supabaseAdmin
      .from("community_feedback_replies")
      .select("created_at, created_by, author:profiles!created_by (role)")
      .eq("report_id", ticketId)
      .order("created_at", { ascending: true })
      .limit(300),
    ticket.created_by
      ? supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", ticket.created_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (replies.error) throw new Error(replies.error.message);
  // BCA's own notes to itself (Zander's feature requests) don't need answering.
  if (owner.data?.role === "admin") return null;

  const basedOnAt = suggestionTargetAt({
    ticket: {
      status: ticket.status as string,
      source: ticket.source as string | null,
      created_at: ticket.created_at as string,
      created_by: ticket.created_by as string | null,
    },
    replies: (replies.data ?? []).map((row) => ({
      created_at: row.created_at as string,
      created_by: row.created_by as string | null,
      author_role:
        one(row.author as { role: string | null } | { role: string | null }[] | null)
          ?.role ?? null,
    })),
  });
  if (!basedOnAt) return null;
  return {
    basedOnAt,
    sendAsId: (ticket.assigned_to as string | null) ?? DEFAULT_SUPPORT_ASSIGNEE_ID,
  };
}

function toSuggestion(row: SuggestionRow): SupportReplySuggestion | null {
  if (row.status !== "ready" || !row.body || !row.confidence) return null;
  return {
    id: row.id,
    body: row.body,
    confidence: row.confidence,
    reason: row.confidence_reason ?? "",
  };
}

/**
 * The ready draft for this ticket, writing it first if it's due. Two callers at
 * once (the cron and BCA opening the chat) only write one. `pending` means the
 * other one is still writing it.
 */
export async function ensureSupportReplySuggestion(
  ticketId: string
): Promise<{ suggestion: SupportReplySuggestion | null; pending: boolean }> {
  const target = await targetFor(ticketId);
  if (!target) return { suggestion: null, pending: false };

  const { data: found, error } = await supabaseAdmin
    .from("support_reply_suggestions")
    .select(SUGGESTION_SELECT)
    .eq("report_id", ticketId)
    .eq("based_on_at", target.basedOnAt)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const existing = found as SuggestionRow | null;

  let claimedId: string | null = null;
  if (!existing) {
    const { data, error: insertError } = await supabaseAdmin
      .from("support_reply_suggestions")
      .upsert(
        { report_id: ticketId, based_on_at: target.basedOnAt },
        { onConflict: "report_id,based_on_at", ignoreDuplicates: true }
      )
      .select("id");
    if (insertError) throw new Error(insertError.message);
    claimedId = (data?.[0]?.id as string | undefined) ?? null;
    if (!claimedId) return { suggestion: null, pending: true };
  } else if (existing.status === "ready") {
    return { suggestion: toSuggestion(existing), pending: false };
  } else if (existing.status === "dismissed" || existing.status === "sent") {
    return { suggestion: null, pending: false };
  } else {
    const age = Date.now() - new Date(existing.updated_at).getTime();
    if (age < RETRY_AFTER_MS) {
      return { suggestion: null, pending: existing.status === "drafting" };
    }
    const { data } = await supabaseAdmin
      .from("support_reply_suggestions")
      .update({ status: "drafting", updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("updated_at", existing.updated_at)
      .select("id");
    claimedId = (data?.[0]?.id as string | undefined) ?? null;
    if (!claimedId) return { suggestion: null, pending: true };
  }

  try {
    const draft = await draftSupportReplyWithConfidence({
      ticketId,
      sendAsId: target.sendAsId,
    });
    const { data: saved, error: saveError } = await supabaseAdmin
      .from("support_reply_suggestions")
      .update({
        status: "ready",
        body: draft.body,
        confidence: draft.confidence,
        confidence_reason: draft.reason,
        model: DEFAULT_ANTHROPIC_MODEL,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimedId)
      .select(SUGGESTION_SELECT)
      .single();
    if (saveError) throw new Error(saveError.message);
    return { suggestion: toSuggestion(saved as SuggestionRow), pending: false };
  } catch (err) {
    console.error(
      "support reply suggestion:",
      ticketId,
      err instanceof Error ? err.message : "failed"
    );
    await supabaseAdmin
      .from("support_reply_suggestions")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", claimedId);
    return { suggestion: null, pending: false };
  }
}

/** BCA cleared the draft, so don't offer it again. */
export async function dismissSupportReplySuggestion(
  ticketId: string,
  suggestionId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("support_reply_suggestions")
    .update({ status: "dismissed", updated_at: new Date().toISOString() })
    .eq("id", suggestionId)
    .eq("report_id", ticketId);
  if (error) throw new Error(error.message);
}

/**
 * Saves what BCA really sent beside the draft. Reads the reply itself, so the
 * record can't drift from what went out.
 */
export async function recordSupportReplySent(input: {
  ticketId: string;
  suggestionId: string;
  replyId: string;
}): Promise<void> {
  const [{ data: reply }, { data: draft }] = await Promise.all([
    supabaseAdmin
      .from("community_feedback_replies")
      .select("body")
      .eq("id", input.replyId)
      .eq("report_id", input.ticketId)
      .maybeSingle(),
    supabaseAdmin
      .from("support_reply_suggestions")
      .select("body")
      .eq("id", input.suggestionId)
      .eq("report_id", input.ticketId)
      .maybeSingle(),
  ]);
  if (!reply || !draft) return;
  const sent = (reply.body as string | null) ?? "";
  const { error } = await supabaseAdmin
    .from("support_reply_suggestions")
    .update({
      status: "sent",
      sent_reply_id: input.replyId,
      sent_body: sent,
      changed_share: changedShare((draft.body as string | null) ?? "", sent),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.suggestionId);
  if (error) throw new Error(error.message);
}

/** Only chats touched this recently get a draft, so old ones never run up a bill. */
const BACKGROUND_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Each draft takes a while; this keeps one run inside the time limit. */
const BACKGROUND_BATCH = 4;

/** For the cron: draft for chats waiting on BCA, a few at a time. */
export async function draftDueSupportReplies(): Promise<{
  checked: number;
  drafted: number;
}> {
  const since = new Date(Date.now() - BACKGROUND_WINDOW_MS).toISOString();
  const { data: tickets, error } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("id")
    .neq("status", "resolved")
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);

  const ids = (tickets ?? []).map((t) => t.id as string);
  const { data: alreadyDone, error: doneError } = await supabaseAdmin
    .from("support_reply_suggestions")
    .select("report_id, based_on_at")
    .in("report_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if (doneError) throw new Error(doneError.message);
  const done = new Set(
    (alreadyDone ?? []).map(
      (row) => `${row.report_id}|${new Date(row.based_on_at as string).getTime()}`
    )
  );

  const due: string[] = [];
  for (const id of ids) {
    if (due.length >= BACKGROUND_BATCH) break;
    const target = await targetFor(id);
    if (target && !done.has(`${id}|${new Date(target.basedOnAt).getTime()}`)) {
      due.push(id);
    }
  }
  const results = await Promise.all(due.map(ensureSupportReplySuggestion));
  return {
    checked: ids.length,
    drafted: results.filter((result) => result.suggestion).length,
  };
}
