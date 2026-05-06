import { NextResponse } from "next/server";
import { requireAdminBearer } from "@/lib/linkedinAdminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { publishLinkedInTextPost } from "@/lib/linkedinPublishing";

type Body = { content?: string };

export async function POST(request: Request) {
  try {
    const auth = await requireAdminBearer(request);
    if (auth.error || !auth.userId) {
      return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const content = body.content?.trim() ?? "";
    if (!content) {
      return NextResponse.json({ error: "Post content is required." }, { status: 400 });
    }

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("linkedin_member_connections")
      .select("linkedin_sub, access_token")
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "LinkedIn account is not connected for this admin user." },
        { status: 400 }
      );
    }

    const publish = await publishLinkedInTextPost(connection, content);
    if (!publish.ok) {
      return NextResponse.json({ error: publish.error }, { status: 502 });
    }

    return NextResponse.json({ ok: true, postUrn: publish.postUrn });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: `Server exception: ${message}` }, { status: 500 });
  }
}
