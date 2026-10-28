import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { DEFAULT_ANTHROPIC_MODEL } from "@/lib/anthropicModel";
import {
  COMMUNITY_COPILOT_MAX_TOKENS,
  composeCommunityCopilotSystem,
  composeCommunityCopilotUserMessage,
  type CommunityCopilotComment,
} from "@/lib/communityCopilot";
import { consumeReplyCopilotRateLimit } from "@/lib/messaging/replyCopilotRateLimit";
import { loadBrandKnowledgeOverrides } from "@/lib/profitCoachAi/brandKnowledge";
import { requireAdmin } from "@/lib/requireAdmin";
import { sanitizeSupportSuggestion } from "@/lib/support/supportCopilot";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AuthZ: admin only. Body allowlist is { hint, sendAsId }. The post and its
 * comments are quoted as untrusted data. Suggest-only: the draft goes into
 * the comment box and the admin posts it themselves.
 */
type Body = { hint?: unknown; sendAsId?: unknown };

type Person = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  role: string | null;
};

const PERSON_SELECT = "id, full_name, first_name, role";

function personName(person: Person | null | undefined): string | null {
  return person?.full_name?.trim() || person?.first_name?.trim() || null;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function textFromMessage(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id: postId } = await context.params;
  if (!postId) {
    return NextResponse.json({ error: "Missing post id." }, { status: 400 });
  }

  if (!consumeReplyCopilotRateLimit(`community:${auth.userId}`)) {
    return NextResponse.json(
      { error: "Too many suggestions. Try again in a minute." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const hint = typeof body.hint === "string" ? body.hint : "";
  const sendAsId =
    typeof body.sendAsId === "string" && body.sendAsId.trim()
      ? body.sendAsId.trim()
      : auth.userId;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Reply suggestions are not configured." },
      { status: 503 }
    );
  }

  const { data: post, error: postErr } = await supabaseAdmin
    .from("community_posts")
    .select(
      `id, title, body, created_at, author:profiles!author_id (${PERSON_SELECT}), category:community_categories (label)`
    )
    .eq("id", postId)
    .maybeSingle();
  if (postErr || !post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const [commentsRes, senderRes, overrides] = await Promise.all([
    supabaseAdmin
      .from("community_post_comments")
      .select(
        `created_at, author_id, body, parent_comment_id, author:profiles!author_id (${PERSON_SELECT})`
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(300),
    supabaseAdmin
      .from("profiles")
      .select(PERSON_SELECT)
      .eq("id", sendAsId)
      .maybeSingle(),
    loadBrandKnowledgeOverrides(),
  ]);

  if (commentsRes.error) {
    console.error("community reply-suggest comments:", commentsRes.error.message);
    return NextResponse.json({ error: "Could not load comments." }, { status: 500 });
  }

  const comments: CommunityCopilotComment[] = (commentsRes.data ?? []).map(
    (row) => {
      const author = one(row.author as Person | Person[] | null);
      return {
        created_at: String(row.created_at ?? ""),
        role: author?.role === "admin" ? "staff" : "member",
        author_name: personName(author),
        body: typeof row.body === "string" ? row.body : "",
        is_reply: Boolean(row.parent_comment_id),
        is_sender: row.author_id === sendAsId,
      };
    }
  );

  const system = composeCommunityCopilotSystem(overrides);
  const user = composeCommunityCopilotUserMessage({
    post: {
      title: String(post.title ?? ""),
      body: String(post.body ?? ""),
      category:
        one(post.category as { label: string } | { label: string }[] | null)
          ?.label ?? null,
      created_at: String(post.created_at ?? ""),
      author_name: personName(one(post.author as Person | Person[] | null)),
    },
    comments,
    senderName: personName(senderRes.data as Person | null),
    staffHint: hint,
  });

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: COMMUNITY_COPILOT_MAX_TOKENS,
      system,
      messages: [{ role: "user", content: user }],
    });
    const suggestion = sanitizeSupportSuggestion(textFromMessage(response));
    if (!suggestion) {
      return NextResponse.json(
        { error: "Could not draft a reply. Try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ suggestion });
  } catch (err) {
    console.error(
      "community reply-suggest anthropic:",
      err instanceof Error ? err.message : "failed"
    );
    return NextResponse.json(
      { error: "Could not draft a reply. Try again." },
      { status: 502 }
    );
  }
}
