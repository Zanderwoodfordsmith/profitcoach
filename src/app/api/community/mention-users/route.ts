import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { displayNameFromProfile } from "@/lib/communityProfile";
import {
  compareAdminMentionOrder,
  compareMentionSearchResults,
  mentionMatchScore,
  type MentionProfileRow,
} from "@/lib/communityMentionUsers";

const PROFILE_SELECT =
  "id, full_name, first_name, last_name, avatar_url, role" as const;

async function requireStaff(request: Request): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; message: string }
> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { ok: false, status: 401, message: "Missing access token." };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { ok: false, status: 401, message: "Invalid access token." };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? null;
  if (role !== "coach" && role !== "admin") {
    return { ok: false, status: 403, message: "Staff only." };
  }

  return { ok: true, userId: user.id };
}

function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function profileNameSearchFilter(needle: string): string {
  const p = escapeIlikePattern(needle);
  return `first_name.ilike.${p}%,last_name.ilike.${p}%,full_name.ilike.%${p}%`;
}

type ProfileRow = MentionProfileRow & {
  avatar_url: string | null;
};

async function loadSlugByCoachId(coachIds: string[]): Promise<Record<string, string>> {
  if (coachIds.length === 0) return {};
  const { data: coaches } = await supabaseAdmin
    .from("coaches")
    .select("id, slug")
    .in("id", coachIds);
  return Object.fromEntries(
    (coaches ?? []).map((coach) => [coach.id as string, coach.slug as string])
  );
}

async function searchMentionProfiles(
  needle: string
): Promise<{ rows: ProfileRow[]; slugByCoach: Record<string, string> }> {
  const pattern = needle.toLowerCase();

  const [byNameRes, bySlugRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select(PROFILE_SELECT)
      .in("role", ["coach", "admin"])
      .or(profileNameSearchFilter(pattern))
      .limit(80),
    supabaseAdmin
      .from("coaches")
      .select("id, slug")
      .ilike("slug", `${escapeIlikePattern(pattern)}%`)
      .limit(25),
  ]);

  const byId = new Map<string, ProfileRow>();
  for (const row of (byNameRes.data ?? []) as ProfileRow[]) {
    byId.set(row.id, row);
  }

  const slugHits = bySlugRes.data ?? [];
  const slugByCoachFromHits = Object.fromEntries(
    slugHits.map((c) => [c.id as string, c.slug as string])
  );

  const missingCoachIds = slugHits
    .map((c) => c.id as string)
    .filter((id) => !byId.has(id));

  if (missingCoachIds.length > 0) {
    const { data: slugProfiles } = await supabaseAdmin
      .from("profiles")
      .select(PROFILE_SELECT)
      .in("id", missingCoachIds)
      .in("role", ["coach", "admin"]);
    for (const row of (slugProfiles ?? []) as ProfileRow[]) {
      byId.set(row.id, row);
    }
  }

  const rows = [...byId.values()];
  const coachIds = rows
    .filter((row) => row.role === "coach")
    .map((row) => row.id);
  const slugByCoach = {
    ...(await loadSlugByCoachId(coachIds)),
    ...slugByCoachFromHits,
  };

  return { rows, slugByCoach };
}

export async function GET(request: Request) {
  const auth = await requireStaff(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      { status: auth.status }
    );
  }

  const { searchParams } = new URL(request.url);
  const qRaw = searchParams.get("q") ?? "";
  const q = qRaw.trim();
  const prioritizeUserId = searchParams.get("prioritize")?.trim() || null;

  const toMentionUser = (row: ProfileRow) => ({
    id: row.id as string,
    display_name: displayNameFromProfile(row),
    avatar_url: row.avatar_url ?? null,
    role: row.role as string,
  });

  if (q.length === 0) {
    const [priorityRes, adminsRes] = await Promise.all([
      prioritizeUserId
        ? supabaseAdmin
            .from("profiles")
            .select(PROFILE_SELECT)
            .eq("id", prioritizeUserId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabaseAdmin
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("role", "admin")
        .limit(30),
    ]);

    if (adminsRes.error) {
      return NextResponse.json(
        { error: "Could not load users." },
        { status: 500 }
      );
    }

    const users: ReturnType<typeof toMentionUser>[] = [];
    if (priorityRes.data) {
      users.push(toMentionUser(priorityRes.data as ProfileRow));
    }

    const sorted = [...(adminsRes.data ?? [])]
      .filter((row) => row.id !== prioritizeUserId)
      .sort(compareAdminMentionOrder);

    users.push(...sorted.map((row) => toMentionUser(row as ProfileRow)));

    return NextResponse.json(
      { users: users.slice(0, 30) },
      { headers: { "Cache-Control": "private, max-age=60" } }
    );
  }

  const { rows, slugByCoach } = await searchMentionProfiles(q);

  const needle = q.toLowerCase();
  const matched = rows.filter(
    (row) => mentionMatchScore(row, slugByCoach[row.id], needle) > 0
  );

  const data = matched
    .sort((a, b) =>
      compareMentionSearchResults(a, b, slugByCoach, needle, prioritizeUserId)
    )
    .slice(0, 30);

  const users = data.map(toMentionUser);

  return NextResponse.json(
    { users },
    { headers: { "Cache-Control": "private, max-age=30" } }
  );
}
