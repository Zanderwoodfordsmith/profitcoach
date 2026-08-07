import type { AcademyVerifyRuleKey } from "@/lib/academy/lessonActions";
import { loadLessonProgressForUser } from "@/lib/academy/lessonProgress";
import { listStartHereLessonIds } from "@/lib/academy/startHereLessons";
import { extractMentionUserIds } from "@/lib/communityMentions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AcademyVerifyContext = {
  coachId: string;
  hasIntroPost: boolean;
  hasReplyWithMention: boolean;
  hasMapLocation: boolean;
  startHereLessonsComplete: boolean;
};

/**
 * Load signals used by tracked academy action rules.
 * Batches queries so syncing a lesson only hits the DB once per coach.
 */
export async function loadAcademyVerifyContext(
  coachId: string
): Promise<AcademyVerifyContext> {
  const [
    hasIntroPost,
    hasReplyWithMention,
    hasMapLocation,
    startHereLessonsComplete,
  ] = await Promise.all([
    coachHasIntroPost(coachId),
    coachHasReplyWithMention(coachId),
    coachHasMapLocation(coachId),
    coachCompletedAllStartHereLessons(coachId),
  ]);
  return {
    coachId,
    hasIntroPost,
    hasReplyWithMention,
    hasMapLocation,
    startHereLessonsComplete,
  };
}

export function evaluateAcademyVerifyRule(
  rule: AcademyVerifyRuleKey,
  context: AcademyVerifyContext
): boolean {
  switch (rule) {
    case "community_intro_posted":
      return context.hasIntroPost;
    case "community_reply_with_mention":
      return context.hasReplyWithMention;
    case "community_map_location_set":
      return context.hasMapLocation;
    case "start_here_lessons_complete":
      return context.startHereLessonsComplete;
    default:
      return false;
  }
}

async function coachCompletedAllStartHereLessons(
  coachId: string
): Promise<boolean> {
  const lessonIds = listStartHereLessonIds();
  if (lessonIds.length === 0) return false;
  const progress = await loadLessonProgressForUser(coachId);
  return lessonIds.every((id) => progress[id] === "completed");
}

/** True when the coach has coordinates on the community members map. */
async function coachHasMapLocation(coachId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("latitude, longitude")
    .eq("id", coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const lat = data?.latitude;
  const lng = data?.longitude;
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng)
  );
}

async function coachHasIntroPost(coachId: string): Promise<boolean> {
  const { data: category, error: catError } = await supabaseAdmin
    .from("community_categories")
    .select("id")
    .eq("slug", "intros")
    .maybeSingle();
  if (catError) throw new Error(catError.message);
  if (!category?.id) return false;

  const { data, error } = await supabaseAdmin
    .from("community_posts")
    .select("id")
    .eq("author_id", coachId)
    .eq("category_id", category.id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

/**
 * True when the coach has commented on someone else's post and @mentioned
 * at least one other member in that comment.
 */
async function coachHasReplyWithMention(coachId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("community_post_comments")
    .select("body, post:community_posts!post_id ( author_id )")
    .eq("author_id", coachId)
    .limit(200);
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const post = row.post as
      | { author_id: string }
      | { author_id: string }[]
      | null;
    const postAuthor = Array.isArray(post)
      ? post[0]?.author_id
      : post?.author_id;
    if (!postAuthor || postAuthor === coachId) continue;

    const mentioned = extractMentionUserIds(
      typeof row.body === "string" ? row.body : ""
    );
    if (mentioned.some((id) => id !== coachId)) return true;
  }
  return false;
}
