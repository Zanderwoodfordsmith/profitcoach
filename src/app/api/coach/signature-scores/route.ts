import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isSignatureModuleId,
  normalizeScores,
  type SignatureModuleId,
  type SignatureScore,
  type SignatureScoresMap,
} from "@/lib/signatureModelV2";

async function requireCoach(request: Request) {
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

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const impersonateId = request.headers.get("x-impersonate-coach-id")?.trim();

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return { error: "Not authorized." as const, userId: null };
  }

  /** Admin acting as a coach uses the impersonated id; otherwise own user id (e.g. /admin/signature). */
  const effectiveId =
    profile.role === "admin" && impersonateId ? impersonateId : user.id;

  return { error: null, userId: effectiveId as string };
}

function parseScoresPayload(body: unknown): Partial<SignatureScoresMap> | null {
  if (!body || typeof body !== "object") return null;
  const scores = (body as { scores?: unknown }).scores;
  if (!scores || typeof scores !== "object") return null;
  const out: Partial<SignatureScoresMap> = {};
  for (const [k, v] of Object.entries(scores as Record<string, unknown>)) {
    if (!isSignatureModuleId(k)) continue;
    if (v === null || v === undefined) {
      out[k] = null;
    } else if (v === "red" || v === "yellow" || v === "green") {
      out[k] = v;
    }
  }
  return out;
}

export async function GET(request: Request) {
  const authCheck = await requireCoach(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: authCheck.error?.includes("impersonate") ? 400 : 401 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("coach_signature_scores")
    .select("scores, updated_at")
    .eq("user_id", authCheck.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Could not load scores." },
      { status: 500 }
    );
  }

  const normalized = normalizeScores(data?.scores ?? {});
  return NextResponse.json({
    scores: normalized,
    updated_at: data?.updated_at ?? null,
  });
}

export async function PATCH(request: Request) {
  const authCheck = await requireCoach(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: authCheck.error?.includes("impersonate") ? 400 : 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const patch = parseScoresPayload(body);
  if (!patch || Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Provide a scores object with at least one module id." },
      { status: 400 }
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("coach_signature_scores")
    .select("scores")
    .eq("user_id", authCheck.userId)
    .maybeSingle();

  const prev = normalizeScores(existing?.scores ?? {}) as Record<
    SignatureModuleId,
    SignatureScore
  >;
  const merged: Record<string, SignatureScore> = { ...prev };
  for (const [k, v] of Object.entries(patch)) {
    merged[k] = v ?? null;
  }

  const { error: upsertError } = await supabaseAdmin
    .from("coach_signature_scores")
    .upsert(
      {
        user_id: authCheck.userId,
        scores: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    return NextResponse.json(
      { error: "Could not save scores." },
      { status: 500 }
    );
  }

  return NextResponse.json({ scores: merged });
}
