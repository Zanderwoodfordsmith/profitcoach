import { NextResponse } from "next/server";

import type { MemorySource } from "@/lib/agent/memory/store";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const SOURCES: { source: MemorySource; label: string }[] = [
  { source: "ava_chat", label: "Past Ava chats" },
  { source: "sales_call", label: "Sales calls" },
  { source: "zoom_call", label: "Zoom calls" },
  { source: "linkedin_post", label: "LinkedIn posts" },
  { source: "newsletter", label: "Newsletters" },
];

/** Ava's memory (ava_memory), one count per source: things she finds by search, never loaded on their own. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const sources = await Promise.all(
    SOURCES.map(async ({ source, label }) => {
      // One "item" row per thing remembered; long things also have chunks and notes.
      const { count, error } = await supabaseAdmin
        .from("ava_memory")
        .select("id", { count: "exact", head: true })
        .eq("source", source)
        .eq("kind", "item");
      return { source, label, count: error ? null : (count ?? 0) };
    })
  );
  return NextResponse.json({ sources });
}
