import {
  fetchHubQuery,
  peekHubQuery,
} from "@/lib/getClients/hubQueryCache";

export type CachedProfileRole = {
  role?: string;
  full_name?: string | null;
  coach_business_name?: string | null;
  avatar_url?: string | null;
  coach_slug?: string | null;
  linked_contact_type?: string | null;
};

const STALE_MS = 60_000;

function keyFor(userId: string) {
  return `profile-role:${userId}`;
}

export function peekProfileRole(userId: string): CachedProfileRole | undefined {
  return peekHubQuery<CachedProfileRole>(keyFor(userId));
}

export async function fetchCachedProfileRole(
  userId: string,
  opts?: { force?: boolean }
): Promise<CachedProfileRole> {
  return fetchHubQuery(
    keyFor(userId),
    async () => {
      const roleRes = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const roleBody = (await roleRes.json().catch(() => ({}))) as CachedProfileRole & {
        error?: string;
      };
      if (!roleRes.ok) {
        throw new Error(roleBody.error ?? "Unable to load your profile.");
      }
      return roleBody;
    },
    { force: opts?.force, staleMs: STALE_MS }
  );
}
