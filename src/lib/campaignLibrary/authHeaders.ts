import { getValidSupabaseAccessToken } from "@/lib/supabaseAccessToken";

export async function campaignLibraryAuthHeaders(): Promise<Record<
  string,
  string
> | null> {
  const token = await getValidSupabaseAccessToken();
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}
