import {
  birdAddressEmails,
  birdGetInboundBody,
  parseSupportTicketIdFromAddress,
  type BirdInboundMessageMeta,
} from "@/lib/bird/client";
import { DEFAULT_SUPPORT_ASSIGNEE_ID } from "@/lib/support/assignees";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  findPhoneNumbersInText,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

/** Pull the member-written part before quoted history / client footers. */
export function stripEmailQuotedReply(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return text;

  const cutPatterns = [
    /\nOn .+wrote:\s*\n/i,
    /\n-{2,}\s*Original Message\s*-{2,}/i,
    /\nFrom:\s.+\nSent:\s/i,
    /\n_{2,}\n/,
    /\nGet Outlook for /i,
  ];
  for (const pattern of cutPatterns) {
    const idx = text.search(pattern);
    if (idx > 0) {
      text = text.slice(0, idx);
      break;
    }
  }

  text = stripEmailClientFooters(text);

  // Drop trailing quoted lines starting with ">"
  const lines = text.split("\n");
  while (lines.length && /^>/.test(lines[lines.length - 1]!.trim())) {
    lines.pop();
  }
  while (lines.length && !lines[lines.length - 1]!.trim()) {
    lines.pop();
  }
  return lines.join("\n").trim();
}

/**
 * Remove known email-client / mail-app marketing footers.
 * Leaves human name / phone sign-offs alone.
 */
export function stripEmailClientFooters(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n");
  if (!text.trim()) return text.trim();

  // Cut from the first matching footer line through the end of the message.
  const footerFromHere = [
    /(?:^|\n)[ \t]*Sent via Superhuman\b[\s\S]*$/i,
    /(?:^|\n)[ \t]*Sent with Superhuman\b[\s\S]*$/i,
    /(?:^|\n)[ \t]*Sent from my (?:iPhone|iPad|Android|Mobile)\b[\s\S]*$/i,
    /(?:^|\n)[ \t]*Sent from Mail for Windows\b[\s\S]*$/i,
    /(?:^|\n)[ \t]*Sent from Yahoo Mail\b[\s\S]*$/i,
    /(?:^|\n)[ \t]*Get Outlook for (?:iOS|Android)\b[\s\S]*$/i,
    /(?:^|\n)[ \t]*Get the new Outlook for (?:Windows|Mac)\b[\s\S]*$/i,
    /(?:^|\n)[ \t]*https?:\/\/(?:www\.)?superhuman\.com\/refer\/\S[\s\S]*$/i,
  ];

  for (const pattern of footerFromHere) {
    const match = text.match(pattern);
    if (match?.index != null && match.index >= 0) {
      text = text.slice(0, match.index);
      break;
    }
  }

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function parsePhoneCandidate(raw: string): string | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const attempts = [
    parsePhoneNumberFromString(cleaned, "GB"),
    parsePhoneNumberFromString(cleaned),
    parsePhoneNumberFromString(cleaned.replace(/[^\d+]/g, ""), "GB"),
  ];
  for (const parsed of attempts) {
    if (parsed && (parsed.isValid() || parsed.isPossible())) {
      return parsed.format("E.164");
    }
  }
  return null;
}

/**
 * Best-effort phone from an email body / signature.
 * Prefers Tel:/Phone:/Mobile: labels; falls back to numbers in the text.
 * Default region GB. Returns E.164 or null.
 */
export function extractPhoneFromEmailBody(body: string): string | null {
  const text = body.replace(/\r\n/g, "\n");
  if (!text.trim()) return null;

  const labeled =
    /(?:^|\n)\s*(?:tel(?:ephone)?|phone|mobile|cell|m)\.?\s*[:\-]?\s*([+\d][\d\s().\-]{6,}\d)/gi;
  let match: RegExpExecArray | null;
  while ((match = labeled.exec(text))) {
    const parsed = parsePhoneCandidate(match[1] || "");
    if (parsed) return parsed;
  }

  const found = findPhoneNumbersInText(text, "GB");
  for (const hit of found) {
    if (hit.number.isValid() || hit.number.isPossible()) {
      return hit.number.format("E.164");
    }
  }
  return null;
}

/**
 * If this profile has no phone, copy one from the email body (signature).
 * Never overwrites an existing number.
 */
export async function maybeFillProfilePhoneFromEmailBody(
  profileId: string | null | undefined,
  body: string
): Promise<string | null> {
  if (!profileId) return null;
  const phone = extractPhoneFromEmailBody(body);
  if (!phone) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("phone")
    .eq("id", profileId)
    .maybeSingle();
  if (profile?.phone?.trim()) return null;

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ phone })
    .eq("id", profileId)
    .or("phone.is.null,phone.eq.");
  if (error) {
    console.warn("support phone fill:", error.message);
    return null;
  }
  return phone;
}

export function parseSupportTicketNumberFromSubject(
  subject: string | null | undefined
): number | null {
  if (!subject) return null;
  const m = subject.match(/\bSUP-(\d{1,8})\b/i);
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function findCoachProfileIdByEmail(
  email: string | null
): Promise<string | null> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) return null;
  const user = (data.users ?? []).find(
    (u) => (u.email ?? "").trim().toLowerCase() === normalized
  );
  if (!user?.id) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .in("role", ["coach", "admin"])
    .maybeSingle();
  return (profile?.id as string | null) ?? null;
}

/**
 * If this Bird inbound is a reply to a support notify (sup+{ticket}@…),
 * append it to the ticket thread.
 */
export async function tryIngestSupportReplyFromBird(input: {
  inboundId: string;
  meta: BirdInboundMessageMeta;
}): Promise<{
  handled: boolean;
  ticketId?: string;
  skipped?: boolean;
  error?: string;
}> {
  const recipients = [
    ...birdAddressEmails(input.meta.to),
    ...birdAddressEmails(input.meta.cc),
  ];

  let ticketId: string | null = null;
  for (const addr of recipients) {
    ticketId = parseSupportTicketIdFromAddress(addr);
    if (ticketId) break;
  }

  if (!ticketId) {
    const ticketNumber = parseSupportTicketNumberFromSubject(input.meta.subject);
    if (ticketNumber) {
      const { data } = await supabaseAdmin
        .from("community_feedback_reports")
        .select("id")
        .eq("ticket_number", ticketNumber)
        .maybeSingle();
      ticketId = (data?.id as string | null) ?? null;
    }
  }

  if (!ticketId) return { handled: false };

  const { data: existing } = await supabaseAdmin
    .from("community_feedback_replies")
    .select("id")
    .eq("bird_message_id", input.inboundId)
    .maybeSingle();
  if (existing?.id) {
    return { handled: true, skipped: true, ticketId };
  }

  const { data: ticket } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("id, status, created_by")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket?.id) {
    return { handled: true, error: `Support ticket ${ticketId} not found.` };
  }

  const body = await birdGetInboundBody(input.inboundId);
  const raw =
    (body.text || "").trim() ||
    (body.html
      ? body.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : "") ||
    "";
  const cleaned = stripEmailQuotedReply(raw).slice(0, 8000);
  if (!cleaned) {
    return { handled: true, skipped: true, ticketId };
  }

  const fromEmails = birdAddressEmails(input.meta.from);
  const fromEmail = fromEmails[0] || null;
  const authorId =
    (await findCoachProfileIdByEmail(fromEmail)) ||
    (ticket.created_by as string | null) ||
    DEFAULT_SUPPORT_ASSIGNEE_ID;

  const emailDateRaw = input.meta.received_at || input.meta.created_at;
  const emailDate = (() => {
    if (!emailDateRaw?.trim()) return null;
    const d = new Date(emailDateRaw.trim());
    if (Number.isNaN(d.getTime())) return null;
    if (d.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;
    return d.toISOString();
  })();

  const { error: insertError } = await supabaseAdmin
    .from("community_feedback_replies")
    .insert({
      report_id: ticket.id,
      created_by: authorId,
      body: cleaned,
      bird_message_id: input.inboundId,
      ...(emailDate ? { created_at: emailDate } : {}),
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return { handled: true, skipped: true, ticketId };
    }
    return { handled: true, ticketId, error: insertError.message };
  }

  const profileForPhone =
    (await findCoachProfileIdByEmail(fromEmail)) ||
    (ticket.created_by as string | null);
  void maybeFillProfilePhoneFromEmailBody(profileForPhone, cleaned).catch(
    () => null
  );

  if (ticket.status === "resolved" || ticket.status === "waiting_reply") {
    await supabaseAdmin
      .from("community_feedback_reports")
      .update({ status: "open" })
      .eq("id", ticket.id);
  }

  return { handled: true, ticketId };
}
