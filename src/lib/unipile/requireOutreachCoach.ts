import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { ensureCoachRowForUser } from "@/lib/booking/bookingService";

/**
 * Coach-scoped outreach APIs.
 * Admins may act as themselves (pilot) via allowAdminSelf when not impersonating.
 */
export async function requireOutreachCoach(request: Request): Promise<
  | { error: string; coachId: null }
  | { error: null; coachId: string }
> {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return { error: auth.error ?? "Not authorized.", coachId: null };
  }
  try {
    await ensureCoachRowForUser(auth.userId);
  } catch {
    return { error: "Coach profile missing.", coachId: null };
  }
  return { error: null, coachId: auth.userId };
}
