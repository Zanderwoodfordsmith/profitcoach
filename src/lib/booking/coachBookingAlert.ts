import { loadCoachTimezone } from "@/lib/booking/bookingService";
import { formatInTimeZone } from "@/lib/booking/bookingTime";
import { notifyCoach } from "@/lib/coachWatch/fire";
import { sendPushToUser } from "@/lib/push/webPush";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupportMailboxAccount } from "@/lib/support/mailbox";
import { sendUnipileEmail } from "@/lib/unipile/client";

const APP_BASE = (process.env.APP_BASE_URL || "https://app.theprofitcoach.com").replace(/\/$/, "");

/**
 * Tell the coach a prospect just booked a call: a phone push (if they turned
 * alerts on) and an email. The email goes from the coach's own connected
 * mailbox, like Ava's reply alerts, or from BCA support when none is connected.
 */
export async function sendCoachBookingAlert(input: {
  coachId: string;
  calendarName: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  startsAtIso: string;
  endsAtIso: string;
  whereLabel: string;
  notes: string | null;
}): Promise<{ push: boolean; email: boolean }> {
  const tz = await loadCoachTimezone(input.coachId).catch(() => "Europe/London");
  const start = new Date(input.startsAtIso);
  const day = formatInTimeZone(start, tz, { weekday: "long", day: "numeric", month: "long" });
  const time = (d: Date) => formatInTimeZone(d, tz, { hour: "2-digit", minute: "2-digit" });
  const when = `${day}, ${time(start)} to ${time(new Date(input.endsAtIso))}`;
  const who = input.guestName.trim() || input.guestEmail || "Someone";
  const url = "/coach/calls";

  const subject = `New call booked: ${who}, ${day} at ${time(start)}`;
  const body = [
    `${who} booked a ${input.calendarName} with you.`,
    [
      `When: ${when} (${tz})`,
      `Where: ${input.whereLabel}`,
      input.guestEmail ? `Email: ${input.guestEmail}` : null,
      input.guestPhone ? `Phone: ${input.guestPhone}` : null,
      input.notes?.trim() ? `Their notes: ${input.notes.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    `See your calls: ${APP_BASE}${url}`,
  ].join("\n\n");

  const pushed = await sendPushToUser(input.coachId, {
    title: "New call booked",
    body: `${who} · ${input.calendarName} · ${day} at ${time(start)}`,
    url,
    tag: `booking-${input.startsAtIso}`,
  }).catch(() => 0);

  const own = await notifyCoach({ coachId: input.coachId, subject, body, email: true, whatsapp: false });
  let emailed = own.email;
  if (!emailed) emailed = await sendFromSupportMailbox(input.coachId, subject, body);

  return { push: pushed > 0, email: emailed };
}

async function sendFromSupportMailbox(coachId: string, subject: string, body: string): Promise<boolean> {
  try {
    const [{ data: authUser }, mailbox] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(coachId),
      getSupportMailboxAccount(),
    ]);
    const to = authUser.user?.email?.trim();
    if (!to || !mailbox?.unipile_account_id) return false;
    const res = await sendUnipileEmail({
      account_id: mailbox.unipile_account_id,
      to: [{ identifier: to }],
      subject,
      body,
    });
    if (!res.ok) console.error("coach booking alert email:", res.error);
    return res.ok;
  } catch (err) {
    console.error("coach booking alert email:", err);
    return false;
  }
}
