/**
 * Which coach's inbox this request may touch.
 * Never returns a null coach id — missing impersonation means "self", not "everyone".
 */
export function effectiveMessagingCoachId(input: {
  userId: string;
  isAdmin: boolean;
  impersonateId: string | null;
}): string {
  if (input.isAdmin && input.impersonateId) return input.impersonateId;
  return input.userId;
}
