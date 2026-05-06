import { NextResponse } from "next/server";
import { requireAdminBearer } from "@/lib/linkedinAdminAuth";
import { publishLinkedInTextPost } from "@/lib/linkedinPublishing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type DueItem = {
  id: string;
  content: string;
  attempts: number;
};

export async function POST(request: Request) {
  const auth = await requireAdminBearer(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const { data: connection, error: connectionError } = await supabaseAdmin
    .from("linkedin_member_connections")
    .select("linkedin_sub, access_token")
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (connectionError || !connection) {
    return NextResponse.json({ error: "LinkedIn connection missing." }, { status: 400 });
  }

  const { data: due, error: dueError } = await supabaseAdmin
    .from("linkedin_scheduled_posts")
    .select("id, content, attempts")
    .eq("user_id", auth.userId)
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(10);

  if (dueError) {
    return NextResponse.json({ error: "Could not load due posts." }, { status: 500 });
  }

  const items = (due ?? []) as DueItem[];
  const out: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const item of items) {
    const result = await publishLinkedInTextPost(connection, item.content);
    if (result.ok) {
      await supabaseAdmin
        .from("linkedin_scheduled_posts")
        .update({
          status: "published",
          attempts: item.attempts + 1,
          published_at: new Date().toISOString(),
          linkedin_post_urn: result.postUrn,
          last_error: null,
        })
        .eq("id", item.id);
      out.push({ id: item.id, ok: true });
    } else {
      await supabaseAdmin
        .from("linkedin_scheduled_posts")
        .update({
          status: item.attempts + 1 >= 3 ? "failed" : "scheduled",
          attempts: item.attempts + 1,
          last_error: result.error,
        })
        .eq("id", item.id);
      out.push({ id: item.id, ok: false, error: result.error });
    }
  }

  return NextResponse.json({ processed: out.length, results: out });
}
