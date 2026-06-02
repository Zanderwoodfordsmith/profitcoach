import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CredentialsBody = {
  email?: string | null;
  password?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    const status = authCheck.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: authCheck.error }, { status });
  }

  const { id: coachId } = await context.params;
  if (!coachId?.trim()) {
    return NextResponse.json({ error: "Missing coach id." }, { status: 400 });
  }

  let body: CredentialsBody;
  try {
    body = (await request.json()) as CredentialsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: { email?: string; password?: string; email_confirm?: boolean } =
    {};

  if (body.email !== undefined && body.email !== null && body.email !== "") {
    if (typeof body.email !== "string") {
      return NextResponse.json(
        { error: "email must be a string." },
        { status: 400 }
      );
    }
    const trimmed = body.email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }
    updates.email = trimmed;
    // Admin-set email should be considered confirmed so the coach can log in.
    updates.email_confirm = true;
  }

  if (
    body.password !== undefined &&
    body.password !== null &&
    body.password !== ""
  ) {
    if (typeof body.password !== "string") {
      return NextResponse.json(
        { error: "password must be a string." },
        { status: 400 }
      );
    }
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    updates.password = body.password;
  }

  if (updates.email === undefined && updates.password === undefined) {
    return NextResponse.json(
      { error: "Provide an email and/or password to update." },
      { status: 400 }
    );
  }

  try {
    // Only coach accounts can be edited through this endpoint.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", coachId)
      .maybeSingle();

    if (profileError) {
      console.error(
        "admin/coaches/[id]/credentials profile check error:",
        profileError
      );
      return NextResponse.json(
        { error: "Unable to verify coach profile." },
        { status: 500 }
      );
    }
    if (!profile) {
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }
    if (profile.role !== "coach") {
      return NextResponse.json(
        { error: "Only coach accounts can be updated here." },
        { status: 400 }
      );
    }

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(coachId, updates);

    if (updateError) {
      console.error(
        "admin/coaches/[id]/credentials update error:",
        updateError
      );
      const message = updateError.message?.toLowerCase().includes("already")
        ? "That email address is already in use."
        : "Unable to update coach credentials.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      email: updates.email ?? undefined,
    });
  } catch (err) {
    console.error("admin/coaches/[id]/credentials catch:", err);
    return NextResponse.json(
      { error: "Unable to update coach credentials." },
      { status: 500 }
    );
  }
}
