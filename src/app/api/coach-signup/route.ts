import { NextResponse } from "next/server";
import { looksLikeBotSignup } from "@/lib/coachSignupGuard";
import { createCoachProfileAndRow } from "@/lib/createCoachAccountRecords";
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

  if (looksLikeBotSignup({ fullName, businessName, email, slug })) {
    return NextResponse.json(
      { error: "Unable to create account. Please check your details." },
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

    const coachError = await createCoachProfileAndRow({
      userId,
      fullName,
      firstName: first_name,
      lastName: last_name,
      businessName: businessName || null,
      slug,
    });

    if (coachError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
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

