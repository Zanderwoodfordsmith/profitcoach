import { ensureCoachRowForUser } from "@/lib/booking/bookingService";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

export async function requireShareCoach(request: Request): Promise<
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
