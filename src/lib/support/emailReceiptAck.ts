import { BCA_SUPPORT_EMAIL } from "@/config/businessContact";
import { isUnipileConfigured, sendUnipileEmail } from "@/lib/unipile/client";

/**
 * Skip noreply / bounce / notification addresses so we don't ack machines
 * (Google Voice alerts, vendor mail, mailer-daemons, etc.).
 */
export function shouldAutoAckSupportEmail(
  email: string | null | undefined
): boolean {
  const e = (email || "").trim().toLowerCase();
  if (!e || !e.includes("@")) return false;
  if (e === BCA_SUPPORT_EMAIL.toLowerCase()) return false;

  const at = e.lastIndexOf("@");
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);

  if (
    /(?:^|[._+-])(no[_-]?reply|donotreply|do[_-]?not[_-]?reply)(?:$|[._+-])/i.test(
      local
    ) ||
    /^(mailer-daemon|postmaster|bounce|bounces|notifications?|automated|daemon|auto)$/i.test(
      local
    )
  ) {
    return false;
  }

  // Common notification / voicemail relay domains
  if (
    domain === "txt.voice.google.com" ||
    domain.endsWith(".bounces.google.com") ||
    domain === "email.googlegroups.com"
  ) {
    return false;
  }

  return true;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Auto-ack a newly created email-inbox ticket (no ticket number). */
export async function sendSupportEmailReceiptAck(input: {
  accountId: string;
  toEmail: string;
  toName: string | null;
  subject: string;
  replyToEmailId: string;
}): Promise<void> {
  if (!isUnipileConfigured()) return;
  if (!shouldAutoAckSupportEmail(input.toEmail)) return;

  const firstName = (() => {
    const raw = (input.toName || "").trim();
    if (!raw || raw.includes("@")) return null;
    return raw.split(/\s+/)[0] || null;
  })();
  const greeting = `Hi${firstName ? ` ${firstName}` : ""},`;
  const html = `<p>${escapeHtml(greeting)}</p>
<p>Thanks — we've received your request. We'll reply as soon as we can.</p>
<p style="color:#64748b;font-size:13px;">— Profit Coach Support</p>`;

  const subjectRaw = input.subject.trim() || "your message";
  const subject = subjectRaw.toLowerCase().startsWith("re:")
    ? subjectRaw.slice(0, 200)
    : `Re: ${subjectRaw}`.slice(0, 200);

  const res = await sendUnipileEmail({
    account_id: input.accountId,
    to: [
      {
        identifier: input.toEmail,
        ...(input.toName ? { display_name: input.toName } : {}),
      },
    ],
    from: {
      identifier: BCA_SUPPORT_EMAIL,
      display_name: "Profit Coach Support",
    },
    subject,
    body: html,
    reply_to: input.replyToEmailId,
    custom_headers: [
      { name: "Auto-Submitted", value: "auto-replied" },
      { name: "X-Auto-Response-Suppress", value: "All" },
      { name: "Precedence", value: "auto_reply" },
    ],
  });

  if (!res.ok) {
    throw new Error(res.error || "Could not send support receipt ack.");
  }
}
