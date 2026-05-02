import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
    console.error("admin/coaches/[id] requireAdmin error:", err);
    return { error: "Server error." as const, userId: null };
  }
}

const LEVELS = new Set(["certified", "professional", "elite"]);

type PatchBody = {
  directory_listed?: boolean;
  directory_level?: string | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json(
      { error: authCheck.error },
      { status }
    );
  }

  const { id: coachId } = await context.params;
  if (!coachId?.trim()) {
    return NextResponse.json({ error: "Missing coach id." }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.directory_listed !== undefined) {
    updates.directory_listed = !!body.directory_listed;
  }
  if (body.directory_level !== undefined) {
    if (body.directory_level === null || body.directory_level === "") {
      updates.directory_level = null;
    } else if (typeof body.directory_level === "string" && LEVELS.has(body.directory_level)) {
      updates.directory_level = body.directory_level;
    } else {
      return NextResponse.json(
        { error: "directory_level must be certified, professional, elite, or null." },
        { status: 400 }
      );
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from("coaches")
      .update(updates)
      .eq("id", coachId);

    if (error?.code === "42703") {
      return NextResponse.json(
        {
          error:
            "Directory columns are missing. Deploy the latest database migration.",
        },
        { status: 500 }
      );
    }
    if (error) {
      console.error("admin/coaches/[id] update error:", error);
      return NextResponse.json(
        { error: "Unable to update coach." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin/coaches/[id] catch:", err);
    return NextResponse.json(
      { error: "Unable to update coach." },
      { status: 500 }
    );
  }
}
