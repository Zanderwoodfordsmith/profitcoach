import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AdminProfileRow = {
  id: string;
  role: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type AdminUserView = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  last_sign_in_at: string | null;
  created_at: string | null;
};

function pickAuthAvatarUrl(user: {
  user_metadata?: Record<string, unknown> | null;
}): string | null {
  const md = user.user_metadata ?? {};
  const candidates = [
    md.avatar_url,
    md.picture,
    md.photo_url,
    md.image,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export async function GET(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: authCheck.error }, { status });
  }

  try {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, full_name, avatar_url")
      .eq("role", "admin")
      .order("full_name", { ascending: true, nullsFirst: false });

    if (profilesError) {
      return NextResponse.json(
        { error: "Unable to load admin users." },
        { status: 500 }
      );
    }

    const authUsersRes = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 500,
    });
    if (authUsersRes.error) {
      return NextResponse.json(
        { error: "Unable to load admin users." },
        { status: 500 }
      );
    }

    const usersById = new Map(
      (authUsersRes.data.users ?? []).map((u) => [
        u.id,
        {
          email: u.email ?? null,
          avatar_url: pickAuthAvatarUrl(u),
          last_sign_in_at: u.last_sign_in_at ?? null,
          created_at: u.created_at ?? null,
        },
      ])
    );

    const adminUsers: AdminUserView[] = ((profiles ?? []) as AdminProfileRow[]).map(
      (profile) => {
        const authUser = usersById.get(profile.id);
        return {
          id: profile.id,
          email: authUser?.email ?? null,
          full_name:
            profile.full_name ??
            ((authUsersRes.data.users ?? []).find((u) => u.id === profile.id)
              ?.user_metadata?.full_name as string | undefined) ??
            null,
          avatar_url: profile.avatar_url ?? authUser?.avatar_url ?? null,
          role: profile.role ?? null,
          last_sign_in_at: authUser?.last_sign_in_at ?? null,
          created_at: authUser?.created_at ?? null,
        };
      }
    );

    return NextResponse.json({ adminUsers });
  } catch (error) {
    console.error("admin/users GET error:", error);
    return NextResponse.json(
      { error: "Unable to load admin users." },
      { status: 500 }
    );
  }
}
