import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TimeTrackerAdmin } from "@/lib/timeTracker/types";

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export async function GET(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: authCheck.error }, { status });
  }

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("role", "admin")
    .order("full_name", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("time-tracker admins GET:", error);
    return NextResponse.json({ error: "Unable to load admins." }, { status: 500 });
  }

  let emailsById = new Map<string, string | null>();
  try {
    const authUsers = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 500,
    });
    if (!authUsers.error) {
      emailsById = new Map(
        (authUsers.data.users ?? []).map((u) => [u.id, u.email ?? null])
      );
    }
  } catch (err) {
    console.error("time-tracker admins listUsers:", err);
  }

  const admins: TimeTrackerAdmin[] = ((profiles ?? []) as ProfileRow[]).map(
    (p) => ({
      id: p.id,
      fullName: p.full_name,
      email: emailsById.get(p.id) ?? null,
      avatarUrl: p.avatar_url,
    })
  );

  return NextResponse.json({ admins, currentUserId: authCheck.userId });
}
