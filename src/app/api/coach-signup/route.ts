import { NextResponse } from "next/server";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  fullName: string;
  businessName: string;
  email: string;
  password: string;
  slug: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Body;

  const fullName = body.fullName?.trim();
  const businessName = body.businessName?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const slug = body.slug?.toLowerCase().trim();

  if (!fullName || !email || !password || !slug) {
    return NextResponse.json(
      { error: "Please fill in all required fields." },
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
    // Create user account
    const { data: userData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError || !userData.user) {
      throw new Error(
        createError?.message ?? "Unable to create user account."
      );
    }

    const userId = userData.user.id;
    const { first_name, last_name } = splitFullName(fullName);

    // Create profile with coach role
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

    // Create coach row with slug
    const coachError = await supabaseInitCoach(
      userId,
      slug
    );

    if (coachError) {
      throw new Error(coachError);
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error." },
      { status: 400 }
    );
  }
}

async function supabaseInitCoach(userId: string, slug: string) {
  const { error } = await supabaseAdmin
    .from("coaches")
    .insert({ id: userId, slug });
  if (error) {
    if (error.code === "23505") {
      return "That slug is already in use. Please choose another.";
    }
    return "Unable to create coach record.";
  }
  return null;
}

