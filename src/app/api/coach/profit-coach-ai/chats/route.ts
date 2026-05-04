import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { requireCoachEffectiveId } from "../_auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireCoachEffectiveId(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("profit_coach_ai_chats")
    .select("id, title, last_output_id, last_role_id, created_at, updated_at")
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("profit-coach-ai chats GET:", error);
    return NextResponse.json({ error: "Could not load chats." }, { status: 500 });
  }

  return NextResponse.json({ chats: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireCoachEffectiveId(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("profit_coach_ai_chats")
    .insert({
      user_id: auth.userId,
      title: "New chat",
      updated_at: now,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("profit-coach-ai chats POST:", error);
    return NextResponse.json({ error: "Could not create chat." }, { status: 500 });
  }

  return NextResponse.json({ id: data.id as string });
}
