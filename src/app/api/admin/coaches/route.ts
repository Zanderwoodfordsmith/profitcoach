import { NextResponse } from "next/server";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  fullName: string;
  businessName?: string;
  email: string;
  slug: string;
  /**
   * If true, send a Supabase invite email so the coach sets
   * their own password. If false, password must be provided.
   */
  invite: boolean;
  password?: string;
};

async function requireAdmin(request: Request): Promise<
  | { error: "Missing access token." | "Invalid access token." | "Not authorized." | "Server error."; userId: null }
  | { error: null; userId: string }
> {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return { error: "Missing access token." as const, userId: null };
    }

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return { error: "Invalid access token." as const, userId: null };
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin") {
      return { error: "Not authorized." as const, userId: null };
    }

    return { error: null, userId: user.id as string };
  } catch (err) {
    console.error("admin/coaches requireAdmin error:", err);
    return { error: "Server error." as const, userId: null };
  }
}

export async function GET(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json(
      { error: authCheck.error },
      { status }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("coaches")
      .select(
        "id, slug, directory_listed, directory_level, profiles!inner(full_name, coach_business_name)"
      )
      .order("slug", { ascending: true });

    if (error?.code === "42703") {
      const fallback = await supabaseAdmin
        .from("coaches")
        .select("id, slug, profiles!inner(full_name, coach_business_name)")
        .order("slug", { ascending: true });
      if (fallback.error) {
        return NextResponse.json(
          { error: "Unable to load coaches." },
          { status: 500 }
        );
      }
      const coaches =
        fallback.data?.map((row: any) => ({
          id: row.id as string,
          slug: row.slug as string,
          full_name: row.profiles?.full_name ?? null,
          coach_business_name: row.profiles?.coach_business_name ?? null,
          directory_listed: false,
          directory_level: null as string | null,
        })) ?? [];
      return NextResponse.json({ coaches });
    }

    if (error) {
      return NextResponse.json(
        { error: "Unable to load coaches." },
        { status: 500 }
      );
    }

    const coaches =
      data?.map((row: any) => ({
        id: row.id as string,
        slug: row.slug as string,
        full_name: row.profiles?.full_name ?? null,
        coach_business_name: row.profiles?.coach_business_name ?? null,
        directory_listed: !!row.directory_listed,
        directory_level: (row.directory_level as string | null) ?? null,
      })) ?? [];

    return NextResponse.json({ coaches });
  } catch (err) {
    console.error("admin/coaches GET error:", err);
    return NextResponse.json(
      { error: "Unable to load coaches." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json(
      { error: authCheck.error },
      { status }
    );
  }

  const body = (await request.json()) as Body;

  const fullName = body.fullName?.trim();
  const businessName = body.businessName?.trim() || null;
  const email = body.email?.trim().toLowerCase();
  const slug = body.slug?.toLowerCase().trim();
  const invite = !!body.invite;
  const password = body.password;

  if (!fullName || !email || !slug) {
    return NextResponse.json(
      { error: "Please fill in name, email, and slug." },
      { status: 400 }
    );
  }

  if (!invite && !password) {
    return NextResponse.json(
      {
        error:
          "Password is required when not sending an invite email.",
      },
      { status: 400 }
    );
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      {
        error:
          "Slug can only contain lowercase letters, numbers, and hyphens.",
      },
      { status: 400 }
    );
  }

  try {
    let userId: string | null = null;

    if (invite) {
      const {
        data,
        error: inviteError,
      } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

      if (inviteError || !data?.user) {
        throw new Error(
          inviteError?.message ?? "Unable to send invite email."
        );
      }
      userId = data.user.id;
    } else {
      const {
        data,
        error: createError,
      } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: password!,
        email_confirm: true,
      });

      if (createError || !data.user) {
        throw new Error(
          createError?.message ?? "Unable to create user account."
        );
      }
      userId = data.user.id;
    }

    // Safety check
    if (!userId) {
      throw new Error("User id missing after creating coach account.");
    }

    const { first_name, last_name } = splitFullName(fullName);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        role: "coach",
        full_name: fullName,
        first_name,
        last_name,
        coach_business_name: businessName,
      });

    if (profileError) {
      throw new Error("Unable to create coach profile.");
    }

    const { error: coachError } = await supabaseAdmin
      .from("coaches")
      .insert({ id: userId, slug });

    if (coachError) {
      if ((coachError as any).code === "23505") {
        throw new Error(
          "That slug is already in use. Please choose another."
        );
      }
      throw new Error("Unable to create coach record.");
    }

    return NextResponse.json(
      { ok: true, coachUserId: userId, slug },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error." },
      { status: 400 }
    );
  }
}

