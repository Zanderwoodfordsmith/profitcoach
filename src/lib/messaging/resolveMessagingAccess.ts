import { parseCoachIdHeader } from "@/lib/coachId";
import { effectiveMessagingCoachId } from "@/lib/messaging/messagingCoachScope";
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
  // One auth pass for both roles (this used to run the admin check, then the coach check).
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return { ok: false, error: auth.error || "Not authorized.", status: 401 };
  }

  if (auth.callerIsAdmin) {
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
        userId: auth.callerId,
        isAdmin: true,
        impersonateId,
      }),
      isAdmin: true,
      userId: auth.callerId,
    };
  }

  return {
    ok: true,
    coachId: auth.userId,
    isAdmin: false,
    userId: auth.userId,
  };
}
