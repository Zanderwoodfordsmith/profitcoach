import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import { syncLinkedInInboxForCoach } from "@/lib/unipile/inboxSync";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function collectPriorityIds(body: {
  priority_conversation_id?: unknown;
  priority_conversation_ids?: unknown;
}): string[] {
  const raw: unknown[] = [
    body.priority_conversation_id,
    ...(Array.isArray(body.priority_conversation_ids)
      ? body.priority_conversation_ids
      : []),
  ];
  const ids = raw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((id) => UUID_RE.test(id));
  return [...new Set(ids)].slice(0, 8);
}

/**
 * Soft LinkedIn inbox pull for the signed-in coach.
 * Respects a 2h cooldown unless `{ force: true }`.
 */
export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    force?: boolean;
    priority_conversation_id?: string;
    priority_conversation_ids?: string[];
  };

  let priorityChatIds: string[] = [];
  const conversationIds = collectPriorityIds(body);
  if (conversationIds.length) {
    const { data } = await supabaseAdmin
      .from("messaging_conversations")
      .select("unipile_chat_id")
      .eq("coach_id", auth.coachId)
      .in("id", conversationIds);
    priorityChatIds = (data ?? [])
      .map((row) => String(row.unipile_chat_id || "").trim())
      .filter(Boolean);
  }

  try {
    const result = await syncLinkedInInboxForCoach(auth.coachId, {
      force: Boolean(body.force),
      priorityChatIds,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed." },
      { status: 500 }
    );
  }
}
