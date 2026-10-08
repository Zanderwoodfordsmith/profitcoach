import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { DEFAULT_ANTHROPIC_MODEL } from "@/lib/anthropicModel";
import { consumeReplyCopilotRateLimit } from "@/lib/messaging/replyCopilotRateLimit";
import { loadBrandKnowledgeOverrides } from "@/lib/profitCoachAi/brandKnowledge";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  buildSupportCallBookingUrl,
  loadTicketSupportCallContact,
  resolveSupportCallHostSlug,
} from "@/lib/support/supportCallPrefill";
import { SUPPORT_CALL_PUBLIC_ORIGIN } from "@/lib/support/supportCallHosts";
import {
  SUPPORT_COPILOT_MAX_TOKENS,
  composeSupportCopilotSystem,
  composeSupportCopilotUserMessage,
  dedupeSupportThread,
  sanitizeSupportSuggestion,
  type SupportCopilotMessage,
} from "@/lib/support/supportCopilot";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AuthZ: admin only. Body allowlist is { hint, sendAsId }. Ticket, thread,
 * notes and history are quoted as untrusted data. Suggest-only: the draft
 * goes into the composer and staff send it themselves.
 */
type Body = { hint?: unknown; sendAsId?: unknown };

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

function textFromMessage(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id: ticketId } = await context.params;
  if (!ticketId) {
    return NextResponse.json({ error: "Missing ticket id." }, { status: 400 });
  }

  if (!consumeReplyCopilotRateLimit(`support:${auth.userId}`)) {
    return NextResponse.json(
      { error: "Too many suggestions. Try again in a minute." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const hint = typeof body.hint === "string" ? body.hint : "";
  const sendAsId =
    typeof body.sendAsId === "string" && body.sendAsId.trim()
      ? body.sendAsId.trim()
      : auth.userId;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Reply suggestions are not configured." },
      { status: 503 }
    );
  }

  const { data: ticket, error: ticketErr } = await supabaseAdmin
    .from("community_feedback_reports")
    .select(
      "id, ticket_number, type, status, source, title, details, page_path, created_at, created_by, assigned_to, contact_email, submitter_name"
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketErr || !ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
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
    console.error("support reply-suggest replies:", repliesRes.error.message);
    return NextResponse.json({ error: "Could not load replies." }, { status: 500 });
  }
  if (notesRes.error) {
    // Notes are optional context; keep drafting without them.
    console.warn("support reply-suggest notes:", notesRes.error.message);
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

  const system = composeSupportCopilotSystem(overrides);
  const user = composeSupportCopilotUserMessage({
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
  });

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: SUPPORT_COPILOT_MAX_TOKENS,
      system,
      messages: [{ role: "user", content: user }],
    });
    const suggestion = sanitizeSupportSuggestion(textFromMessage(response));
    if (!suggestion) {
      return NextResponse.json(
        { error: "Could not draft a reply. Try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ suggestion });
  } catch (err) {
    console.error(
      "support reply-suggest anthropic:",
      err instanceof Error ? err.message : "failed"
    );
    return NextResponse.json(
      { error: "Could not draft a reply. Try again." },
      { status: 502 }
    );
  }
}
