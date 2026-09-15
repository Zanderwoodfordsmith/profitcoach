import { getStoredImpersonatingCoachId } from "@/lib/coachAuthHeaders";

export function hubScopeKey(impersonatingCoachId?: string | null): string {
  const id = (impersonatingCoachId ?? getStoredImpersonatingCoachId())?.trim();
  return id && id.length > 0 ? id : "self";
}

export function hubQueryKey(
  resource: string,
  impersonatingCoachId?: string | null
): string {
  return `gc:${hubScopeKey(impersonatingCoachId)}:${resource}`;
}
