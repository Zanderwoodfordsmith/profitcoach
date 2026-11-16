import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";

/** Auth headers for Admin → Ava calls, never as a coach BCA is viewing as. */
export async function adminHeaders(): Promise<Record<string, string> | null> {
  const headers = await getCoachAuthHeaders(null);
  if (!headers) return null;
  delete headers["x-impersonate-coach-id"];
  return headers;
}
