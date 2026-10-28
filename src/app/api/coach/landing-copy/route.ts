import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/verifyAccessToken";
import {
  LANDING_COPY_OVERRIDE_KEYS,
  sanitizeLandingCopyOverrides,
} from "@/lib/landingCopy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * The coach's own BOSS Score landing page wording, for editing on /score/[slug]?edit=1.
 * The coach edits their own page; admins may edit any coach's page.
 */
async function editorFor(request: Request, slug: string) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const user = await verifyAccessToken(token);
  if (!user) return { error: "Sign in to edit this page.", status: 401 } as const;

  const { data: coach } = await supabaseAdmin
    .from("coaches")
    .select("id")
    .eq("slug", slug.trim())
    .maybeSingle();
  if (!coach) return { error: "Page not found.", status: 404 } as const;
  const coachId = coach.id as string;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = profile?.role === "admin";
  if (coachId !== user.id && !isAdmin) {
    return { error: "You can only edit your own page.", status: 403 } as const;
  }
  return { coachId, actingAsAdmin: coachId !== user.id } as const;
}

async function loadOverrides(coachId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name, landing_copy_overrides")
    .eq("id", coachId)
    .maybeSingle();
  return {
    name: (data?.full_name as string | null)?.trim() || null,
    overrides: sanitizeLandingCopyOverrides(data?.landing_copy_overrides),
  };
}

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const auth = await editorFor(request, slug);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { name, overrides } = await loadOverrides(auth.coachId);
  return NextResponse.json({ overrides, name, actingAsAdmin: auth.actingAsAdmin });
}

/** Body: { slug, overrides: { key: text } }. Empty text or null puts the BCA wording back. */
export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    slug?: string;
    overrides?: Record<string, unknown>;
  } | null;
  if (!body?.slug || !body.overrides || typeof body.overrides !== "object") {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }
  const auth = await editorFor(request, body.slug);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { overrides: current } = await loadOverrides(auth.coachId);
  const incoming = sanitizeLandingCopyOverrides(body.overrides);
  const next: Record<string, string> = { ...current };
  for (const key of LANDING_COPY_OVERRIDE_KEYS) {
    if (!(key in body.overrides)) continue;
    const value = incoming[key];
    if (value) next[key] = value;
    else delete next[key];
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ landing_copy_overrides: next })
    .eq("id", auth.coachId);
  if (error) {
    console.error("landing copy save:", error.message);
    return NextResponse.json({ error: "Could not save. Try again." }, { status: 500 });
  }
  return NextResponse.json({ overrides: next });
}
