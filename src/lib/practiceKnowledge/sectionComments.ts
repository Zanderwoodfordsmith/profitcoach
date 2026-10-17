import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type {
  CommentAuthorSide,
  CommentPerson,
  CommentReaderSide,
  CommentReads,
  SectionComment,
} from "./sectionCommentTypes";

type CommentRow = {
  id: string;
  coach_id: string;
  section_key: string;
  author_id: string | null;
  author_side: CommentAuthorSide;
  assignee_id: string | null;
  body: string;
  created_at: string;
  updated_at: string | null;
};

type ProfileBits = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
};

const COLUMNS = "id, coach_id, section_key, author_id, author_side, assignee_id, body, created_at, updated_at";

function profileName(rec: ProfileBits, fallback: string): string {
  return rec.full_name?.trim() || [rec.first_name, rec.last_name].filter(Boolean).join(" ").trim() || fallback;
}

async function withAuthors(rows: CommentRow[]): Promise<SectionComment[]> {
  const ids = [
    ...new Set(
      rows.flatMap((r) => [r.author_id, r.assignee_id]).filter((id): id is string => Boolean(id))
    ),
  ];
  const { data } = ids.length
    ? await supabaseAdmin.from("profiles").select("id, full_name, first_name, last_name, avatar_url").in("id", ids)
    : { data: [] };
  const people = new Map(
    (data ?? []).map((p) => {
      const rec = p as ProfileBits;
      return [rec.id, { name: profileName(rec, ""), avatar: rec.avatar_url?.trim() || null }] as const;
    })
  );
  return rows.map((row) => {
    const person = row.author_id ? people.get(row.author_id) : undefined;
    const assignee = row.assignee_id ? people.get(row.assignee_id) : undefined;
    const fallback = row.author_side === "ava" ? "Ava" : row.author_side === "bca" ? "BCA" : "Coach";
    return {
      id: row.id,
      section_key: row.section_key,
      author_id: row.author_id,
      author_side: row.author_side,
      author_name: row.author_side === "ava" ? "Ava" : person?.name || fallback,
      author_avatar_url: row.author_side === "ava" ? null : person?.avatar ?? null,
      assignee_id: row.assignee_id,
      assignee_name: assignee?.name || (row.assignee_id ? "Assigned" : null),
      assignee_avatar_url: assignee?.avatar ?? null,
      body: row.body,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
}

/** Every comment on one coach's Blueprint, oldest first. */
export async function listSectionComments(coachId: string): Promise<SectionComment[]> {
  const { data, error } = await supabaseAdmin
    .from("practice_section_comments")
    .select(COLUMNS)
    .eq("coach_id", coachId)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) throw new Error(error.message);
  return withAuthors((data ?? []) as CommentRow[]);
}

export async function listCommentReads(coachId: string, side: CommentReaderSide): Promise<CommentReads> {
  const { data, error } = await supabaseAdmin
    .from("practice_section_comment_reads")
    .select("section_key, read_at")
    .eq("coach_id", coachId)
    .eq("side", side);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((r) => [String(r.section_key), String(r.read_at)]));
}

export async function markSectionRead(coachId: string, side: CommentReaderSide, sectionKey: string): Promise<string> {
  const readAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("practice_section_comment_reads")
    .upsert({ coach_id: coachId, side, section_key: sectionKey, read_at: readAt }, { onConflict: "coach_id,side,section_key" });
  if (error) throw new Error(error.message);
  return readAt;
}

export async function addSectionComment(opts: {
  coachId: string;
  sectionKey: string;
  authorId: string | null;
  side: CommentAuthorSide;
  body: string;
}): Promise<SectionComment> {
  const { data, error } = await supabaseAdmin
    .from("practice_section_comments")
    .insert({
      coach_id: opts.coachId,
      section_key: opts.sectionKey,
      author_id: opts.authorId,
      author_side: opts.side,
      body: opts.body,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save the comment.");
  // Writing in a thread means you have read it.
  if (opts.side !== "ava") await markSectionRead(opts.coachId, opts.side, opts.sectionKey);
  const [comment] = await withAuthors([data as CommentRow]);
  return comment;
}

/** Pam and Zander, in that order. Other admin accounts are not assignees. */
const BCA_ASSIGNEE_EMAILS = ["pam@businesscoachacademy.com", "zander@businesscoachacademy.com"] as const;

let bcaAssigneeIdsPromise: Promise<string[]> | null = null;

async function loadBcaAssigneeIds(): Promise<string[]> {
  const wanted = new Set<string>(BCA_ASSIGNEE_EMAILS);
  const found = new Map<string, string>();
  for (let page = 1; page <= 5 && found.size < wanted.size; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data.users ?? [];
    for (const user of users) {
      const email = user.email?.trim().toLowerCase();
      if (email && wanted.has(email)) found.set(email, user.id);
    }
    if (users.length < 200) break;
  }
  return BCA_ASSIGNEE_EMAILS.flatMap((email) => {
    const id = found.get(email);
    return id ? [id] : [];
  });
}

function bcaAssigneeIds(): Promise<string[]> {
  if (!bcaAssigneeIdsPromise) {
    bcaAssigneeIdsPromise = loadBcaAssigneeIds().catch((err) => {
      bcaAssigneeIdsPromise = null;
      throw err;
    });
  }
  return bcaAssigneeIdsPromise;
}

/** The coach on this blueprint, then Pam and Zander. A person is listed once. */
export async function listCommentPeople(coachId: string): Promise<CommentPerson[]> {
  const [coachRes, staffIds] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name, first_name, last_name, avatar_url").eq("id", coachId).maybeSingle(),
    bcaAssigneeIds(),
  ]);
  if (coachRes.error) throw new Error(coachRes.error.message);

  const people: CommentPerson[] = [];
  const coach = coachRes.data as ProfileBits | null;
  if (coach) {
    people.push({
      id: coach.id,
      name: profileName(coach, "Coach"),
      avatar_url: coach.avatar_url?.trim() || null,
      side: "coach",
    });
  }

  const extraIds = staffIds.filter((id) => id !== coach?.id);
  if (!extraIds.length) return people;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, first_name, last_name, avatar_url")
    .in("id", extraIds);
  if (error) throw new Error(error.message);
  const byId = new Map((data ?? []).map((row) => [(row as ProfileBits).id, row as ProfileBits]));
  for (const id of extraIds) {
    const profile = byId.get(id);
    if (!profile) continue;
    people.push({
      id,
      name: profileName(profile, "BCA"),
      avatar_url: profile.avatar_url?.trim() || null,
      side: "bca",
    });
  }
  return people;
}

export async function findSectionComment(
  coachId: string,
  commentId: string
): Promise<Pick<CommentRow, "id" | "author_id" | "author_side"> | null> {
  const { data, error } = await supabaseAdmin
    .from("practice_section_comments")
    .select("id, author_id, author_side")
    .eq("coach_id", coachId)
    .eq("id", commentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Pick<CommentRow, "id" | "author_id" | "author_side"> | null) ?? null;
}

export async function editSectionComment(coachId: string, commentId: string, body: string): Promise<SectionComment | null> {
  const { data, error } = await supabaseAdmin
    .from("practice_section_comments")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("coach_id", coachId)
    .eq("id", commentId)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [comment] = await withAuthors([data as CommentRow]);
  return comment;
}

export async function assignSectionComment(
  coachId: string,
  commentId: string,
  assigneeId: string | null
): Promise<SectionComment | null> {
  const { data, error } = await supabaseAdmin
    .from("practice_section_comments")
    .update({ assignee_id: assigneeId })
    .eq("coach_id", coachId)
    .eq("id", commentId)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [comment] = await withAuthors([data as CommentRow]);
  return comment;
}

export async function deleteSectionComment(coachId: string, commentId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("practice_section_comments")
    .delete()
    .eq("coach_id", coachId)
    .eq("id", commentId)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/** Light rows for many coaches at once, for the admin overview. No bodies. */
export async function commentHeadsForCoaches(
  coachIds: string[]
): Promise<{ comments: Pick<CommentRow, "coach_id" | "section_key" | "author_side" | "created_at">[]; reads: { coach_id: string; section_key: string; read_at: string }[] }> {
  if (!coachIds.length) return { comments: [], reads: [] };
  const [comments, reads] = await Promise.all([
    supabaseAdmin
      .from("practice_section_comments")
      .select("coach_id, section_key, author_side, created_at")
      .in("coach_id", coachIds)
      .limit(20000),
    supabaseAdmin
      .from("practice_section_comment_reads")
      .select("coach_id, section_key, read_at")
      .in("coach_id", coachIds)
      .eq("side", "bca"),
  ]);
  if (comments.error) throw new Error(comments.error.message);
  if (reads.error) throw new Error(reads.error.message);
  return {
    comments: (comments.data ?? []) as Pick<CommentRow, "coach_id" | "section_key" | "author_side" | "created_at">[],
    reads: (reads.data ?? []).map((r) => ({
      coach_id: String(r.coach_id),
      section_key: String(r.section_key),
      read_at: String(r.read_at),
    })),
  };
}
