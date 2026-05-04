import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { requireCoachEffectiveId } from "../../_auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const auth = await requireCoachEffectiveId(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { chatId } = await params;

  const { data: chat, error: chatErr } = await supabaseAdmin
    .from("profit_coach_ai_chats")
    .select("id, title, last_output_id, last_role_id, created_at, updated_at")
    .eq("id", chatId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (chatErr || !chat) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }

  const { data: messages, error: msgErr } = await supabaseAdmin
    .from("profit_coach_ai_messages")
    .select("id, role, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (msgErr) {
    console.error("profit-coach-ai messages GET:", msgErr);
    return NextResponse.json({ error: "Could not load messages." }, { status: 500 });
  }

  return NextResponse.json({
    chat,
    messages: messages ?? [],
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const auth = await requireCoachEffectiveId(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { chatId } = await params;
  let body: { title?: string };
  try {
    body = (await request.json()) as { title?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.title !== "string") {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("profit_coach_ai_chats")
    .update({ title: body.title.trim() || "New chat", updated_at: new Date().toISOString() })
    .eq("id", chatId)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: "Could not update chat." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const auth = await requireCoachEffectiveId(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { chatId } = await params;

  const { error } = await supabaseAdmin
    .from("profit_coach_ai_chats")
    .delete()
    .eq("id", chatId)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: "Could not delete chat." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
