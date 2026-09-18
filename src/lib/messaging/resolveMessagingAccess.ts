import { parseCoachIdHeader } from "@/lib/coachId";
import { effectiveMessagingCoachId } from "@/lib/messaging/messagingCoachScope";
import { requireAdmin } from "@/lib/requireAdmin";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type MessagingAccessDenied = {
  ok: false;
  error: string;
  status: number;
};

export type MessagingAccessOk = {
  ok: true;
  coachId: string;
  isAdmin: boolean;
  userId: string;
};

export type MessagingAccess = MessagingAccessDenied | MessagingAccessOk;

async function impersonatedCoachExists(coachId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("id", coachId)
    .maybeSingle();
  return Boolean(data?.id);
}

/**
 * AuthZ for messaging APIs. Coaches are locked to themselves.
 * Admins may view one coach via x-impersonate-coach-id; otherwise their own row.
 * Org-wide listing is not allowed — that mixed every LinkedIn inbox together.
 */
export async function resolveMessagingAccess(
  request: Request
): Promise<MessagingAccess> {
  const admin = await requireAdmin(request);
  if (admin.error === null && admin.userId) {
    const impersonateId = parseCoachIdHeader(
      request.headers.get("x-impersonate-coach-id")
    );
    if (impersonateId) {
      if (!(await impersonatedCoachExists(impersonateId))) {
        return { ok: false, error: "Coach not found.", status: 404 };
      }
    }
    return {
      ok: true,
      coachId: effectiveMessagingCoachId({
        userId: admin.userId,
        isAdmin: true,
        impersonateId,
      }),
      isAdmin: true,
      userId: admin.userId,
    };
  }

  const coach = await requireCoachRequest(request);
  if (coach.error || !coach.userId) {
    return {
      ok: false,
      error: coach.error || admin.error || "Not authorized.",
      status: 401,
    };
  }

  return {
    ok: true,
    coachId: coach.userId,
    isAdmin: false,
    userId: coach.userId,
  };
}
