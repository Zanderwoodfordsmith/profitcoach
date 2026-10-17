import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAccountIdForChannel } from "@/lib/messaging/startConversation";
import { sendUnipileChatMessage, sendUnipileEmail, startUnipileChat } from "@/lib/unipile/client";
import {
  watchEventLabel,
  type WatchScopeKind,
} from "@/lib/coachWatch/rules";

export type FireWatchInput = {
  coachId: string;
  scopeKind: WatchScopeKind;
  scopeId: string;
  event: string;
  personName?: string | null;
  detail?: string | null;
};

async function coachNotifyTargets(coachId: string): Promise<{
  email: string | null;
  name: string | null;
  phone: string | null;
}> {
  const [{ data: authUser }, { data: profile }] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(coachId),
    supabaseAdmin
      .from("profiles")
      .select("full_name, first_name, last_name, phone")
      .eq("id", coachId)
      .maybeSingle(),
  ]);
  const email = authUser.user?.email?.trim().toLowerCase() || null;
  const name =
    (typeof profile?.full_name === "string" && profile.full_name.trim()) ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    null;
  const phone =
    typeof profile?.phone === "string" && profile.phone.trim()
      ? profile.phone.trim()
      : null;
  return { email: email || null, name, phone };
}

export async function fireCoachWatchRules(input: FireWatchInput): Promise<void> {
  const { data: rules, error } = await supabaseAdmin
    .from("coach_watch_rules")
    .select("id, event, in_app, email, whatsapp")
    .eq("coach_id", input.coachId)
    .eq("scope_kind", input.scopeKind)
    .eq("scope_id", input.scopeId)
    .eq("event", input.event);
  if (error || !rules?.length) return;

  const wantsEmail = rules.some((rule) => rule.email);
  const wantsWhatsApp = rules.some((rule) => rule.whatsapp);
  if (!wantsEmail && !wantsWhatsApp) return;

  const label = watchEventLabel(input.scopeKind, input.event);
  const who = input.personName?.trim() || "Someone";
  const subject = `${who} — ${label}`;
  const body = [subject, input.detail?.trim()].filter(Boolean).join("\n\n");
  await notifyCoach({
    coachId: input.coachId,
    subject,
    body,
    email: wantsEmail,
    whatsapp: wantsWhatsApp,
  });
}

/**
 * Send the coach a note from their own connected accounts (email to themselves,
 * WhatsApp to their own phone). Used by watch rules and Ava reply alerts.
 */
export async function notifyCoach(input: {
  coachId: string;
  subject: string;
  body: string;
  email: boolean;
  whatsapp: boolean;
}): Promise<{ email: boolean; whatsapp: boolean }> {
  const sent = { email: false, whatsapp: false };
  const { subject, body } = input;
  const targets = await coachNotifyTargets(input.coachId);

  if (input.email && targets.email) {
    try {
      const accountId = await resolveAccountIdForChannel(input.coachId, "email");
      if (accountId) {
        const result = await sendUnipileEmail({
          account_id: accountId,
          to: [
            {
              identifier: targets.email,
              display_name: targets.name ?? undefined,
            },
          ],
          subject,
          body,
        });
        if (!result.ok) {
          console.error("coach notify email:", result.error);
        } else {
          sent.email = true;
        }
      }
    } catch (err) {
      console.error("coach notify email:", err);
    }
  }

  if (input.whatsapp && targets.phone) {
    try {
      const accountId = await resolveAccountIdForChannel(input.coachId, "whatsapp");
      if (accountId) {
        const started = await startUnipileChat({
          account_id: accountId,
          attendees_ids: [targets.phone],
          text: body,
        });
        if (started.ok) {
          sent.whatsapp = true;
        } else if (started.data?.chat_id) {
          await sendUnipileChatMessage({
            chat_id: started.data.chat_id,
            account_id: accountId,
            text: body,
          });
          sent.whatsapp = true;
        } else {
          console.error("coach notify whatsapp:", started.error);
        }
      }
    } catch (err) {
      console.error("coach notify whatsapp:", err);
    }
  }
  return sent;
}

export function fireCoachWatchRulesSafe(input: FireWatchInput): void {
  void fireCoachWatchRules(input).catch((err) => {
    console.error("watch rules:", err);
  });
}

export function fireBossScoreWatchSafe(input: {
  coachId: string;
  event: "started" | "completed" | "abandoned";
  personName?: string | null;
}): void {
  fireCoachWatchRulesSafe({
    coachId: input.coachId,
    scopeKind: "magnet",
    scopeId: "boss-score",
    event: input.event,
    personName: input.personName,
  });
}
