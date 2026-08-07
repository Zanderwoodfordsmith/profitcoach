/**
 * Publish Start Here lessons 1–8; keep Tools & Bonuses as draft.
 *
 * Usage: npx tsx scripts/publish-start-here-lessons.ts
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PUBLISH_LESSON_IDS = [
  "kickstart-welcome-welcome-program-overview",
  "kickstart-welcome-member-wins",
  "kickstart-welcome-pick-your-path",
  "kickstart-welcome-introduce-yourself",
  "kickstart-welcome-community-tour",
  "kickstart-welcome-classroom-tour",
  "kickstart-welcome-calendar-calls",
  "kickstart-welcome-support",
] as const;

const DRAFT_LESSON_IDS = ["kickstart-welcome-tools-bonuses"] as const;

async function setDraft(lessonId: string, isDraft: boolean): Promise<void> {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing } = await supabase
    .from("academy_lesson_content")
    .select("*")
    .eq("course_id", "kickstart")
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const row = {
    course_id: "kickstart",
    lesson_id: lessonId,
    title: existing?.title ?? null,
    video_url: existing?.video_url ?? null,
    audio_url: existing?.audio_url ?? null,
    body_markdown: existing?.body_markdown ?? null,
    guide_markdown: existing?.guide_markdown ?? null,
    transcript_text: existing?.transcript_text ?? null,
    duration: existing?.duration ?? null,
    recommended_actions: existing?.recommended_actions ?? null,
    is_draft: isDraft,
    is_deleted: existing?.is_deleted ?? false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("academy_lesson_content")
    .upsert(row, { onConflict: "course_id,lesson_id" });
  if (error) throw new Error(`${lessonId}: ${error.message}`);
  console.log(`${isDraft ? "draft" : "published"} ${lessonId}`);
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  for (const lessonId of PUBLISH_LESSON_IDS) {
    await setDraft(lessonId, false);
  }
  for (const lessonId of DRAFT_LESSON_IDS) {
    await setDraft(lessonId, true);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("academy_lesson_content")
    .select("lesson_id,is_draft,video_url,duration")
    .eq("course_id", "kickstart")
    .like("lesson_id", "kickstart-welcome-%")
    .order("lesson_id");
  if (error) throw new Error(error.message);
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
