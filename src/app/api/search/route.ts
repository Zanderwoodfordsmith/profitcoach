import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { communityPostCardPreview } from "@/lib/communityPostMarkdown";
import { decorateClassroomSearchItems, classroomSearchLessonIds } from "@/lib/search/classroomDisplay";
import {
  parseSearchTab,
  normalizeSearchQuery,
  sanitizeSearchHeadline,
  type SearchClassroomItem,
  type SearchCommunityComment,
  type SearchCommunityItem,
  type SearchCounts,
  type SearchMemberItem,
  type SearchTab,
} from "@/lib/search/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type RpcBag = { total?: number | string; items?: unknown };

function asCount(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function parseCounts(raw: unknown): SearchCounts {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    community: asCount(obj.community),
    classroom: asCount(obj.classroom),
    members: asCount(obj.members),
  };
}

function previewPostBody(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const text = communityPostCardPreview(raw);
  if (!text) return null;
  return text.length > 240 ? `${text.slice(0, 237).trimEnd()}…` : text;
}

async function enrichCommunityItems(
  items: SearchCommunityItem[]
): Promise<SearchCommunityItem[]> {
  const authorIds = new Set<string>();
  for (const item of items) {
    for (const c of item.comments ?? []) {
      if (c.author_id) authorIds.add(c.author_id);
    }
  }
  if (authorIds.size === 0) {
    return items.map((item) => ({
      ...item,
      title_headline: sanitizeSearchHeadline(item.title_headline),
      body_headline: sanitizeSearchHeadline(item.body_headline),
      body_preview: previewPostBody(item.body_preview),
      comments: (item.comments ?? []).map((c) => ({
        ...c,
        headline: sanitizeSearchHeadline(c.headline),
      })),
    }));
  }

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, first_name, last_name, avatar_url")
    .in("id", [...authorIds]);

  const byId = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        id: p.id as string,
        full_name: (p.full_name as string | null) ?? null,
        first_name: (p.first_name as string | null) ?? null,
        last_name: (p.last_name as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
      },
    ])
  );

  return items.map((item) => ({
    ...item,
    title_headline: sanitizeSearchHeadline(item.title_headline),
    body_headline: sanitizeSearchHeadline(item.body_headline),
    body_preview: previewPostBody(item.body_preview),
    comments: (item.comments ?? []).map((c: SearchCommunityComment) => ({
      ...c,
      headline: sanitizeSearchHeadline(c.headline),
      author: c.author_id ? byId.get(c.author_id) ?? null : null,
    })),
  }));
}

async function enrichClassroomItems(
  items: SearchClassroomItem[],
  query: string
): Promise<SearchClassroomItem[]> {
  const sanitized = items.map((item) => ({
    ...item,
    title_headline: sanitizeSearchHeadline(item.title_headline),
    body_headline: sanitizeSearchHeadline(item.body_headline),
    transcript_headline: sanitizeSearchHeadline(item.transcript_headline),
    transcript_seconds: null as number | null,
    transcript_clock: null as string | null,
  }));

  const lessonIds = new Set<string>();
  for (const item of sanitized) {
    if (item.kind !== "lesson" || !item.lesson_id) continue;
    lessonIds.add(item.lesson_id);
    for (const id of classroomSearchLessonIds(item.lesson_id)) {
      lessonIds.add(id);
    }
  }

  if (lessonIds.size === 0) {
    return decorateClassroomSearchItems(sanitized, query, new Map());
  }

  const { data } = await supabaseAdmin
    .from("academy_lesson_content")
    .select("lesson_id, title, transcript_text, video_chapters")
    .in("lesson_id", [...lessonIds]);

  const metaByLessonId = new Map(
    (data ?? []).map((row) => [
      row.lesson_id as string,
      {
        lesson_id: row.lesson_id as string,
        title: (row.title as string | null) ?? null,
        transcript_text: (row.transcript_text as string | null) ?? null,
        video_chapters: row.video_chapters,
      },
    ])
  );

  return decorateClassroomSearchItems(sanitized, query, metaByLessonId);
}

function sanitizeMembers(items: SearchMemberItem[]): SearchMemberItem[] {
  return items.map((item) => ({
    ...item,
    bio_headline: sanitizeSearchHeadline(item.bio_headline),
  }));
}

export async function GET(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    const status =
      auth.error === "Missing access token." ||
      auth.error === "Invalid access token."
        ? 401
        : 403;
    return NextResponse.json({ error: auth.error ?? "Not authorized." }, { status });
  }

  const url = new URL(request.url);
  const q = normalizeSearchQuery(url.searchParams.get("q"));
  const tab: SearchTab = parseSearchTab(url.searchParams.get("tab"));
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  if (q.length < 2) {
    return NextResponse.json({
      q,
      tab,
      page,
      pageSize: PAGE_SIZE,
      counts: { community: 0, classroom: 0, members: 0 },
      total: 0,
      items: [],
    });
  }

  const { data: countsRaw, error: countsError } = await supabaseAdmin.rpc(
    "search_academy_counts",
    { p_query: q }
  );
  if (countsError) {
    console.error("[search] counts", countsError);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
  const counts = parseCounts(countsRaw);

  const rpcName =
    tab === "community"
      ? "search_academy_community"
      : tab === "classroom"
        ? "search_academy_classroom"
        : "search_academy_members";

  const { data: tabRaw, error: tabError } = await supabaseAdmin.rpc(rpcName, {
    p_query: q,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });
  if (tabError) {
    console.error("[search]", tab, tabError);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }

  const payload = (tabRaw ?? {}) as RpcBag;
  const total = asCount(payload.total);
  const rawItems = Array.isArray(payload.items) ? payload.items : [];

  let items:
    | SearchCommunityItem[]
    | SearchClassroomItem[]
    | SearchMemberItem[] = [];

  if (tab === "community") {
    items = await enrichCommunityItems(rawItems as SearchCommunityItem[]);
  } else if (tab === "classroom") {
    items = await enrichClassroomItems(rawItems as SearchClassroomItem[], q);
  } else {
    items = sanitizeMembers(rawItems as SearchMemberItem[]);
  }

  return NextResponse.json({
    q,
    tab,
    page,
    pageSize: PAGE_SIZE,
    counts,
    total,
    items,
  });
}
