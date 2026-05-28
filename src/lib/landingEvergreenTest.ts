import { supabaseAdmin } from "@/lib/supabaseAdmin";

const EVERGREEN_TEST_NAME = "Evergreen analytics";

let cachedEvergreenTestId: string | null = null;

/** test_id for landing_events — running A/B test, or a stable evergreen row. */
export async function resolveLandingEventTestId(): Promise<string | null> {
  const { data: runningTest } = await supabaseAdmin
    .from("landing_tests")
    .select("id")
    .eq("status", "running")
    .limit(1)
    .maybeSingle();
  if (runningTest?.id) return runningTest.id;

  if (cachedEvergreenTestId) return cachedEvergreenTestId;

  const { data: existing } = await supabaseAdmin
    .from("landing_tests")
    .select("id")
    .eq("name", EVERGREEN_TEST_NAME)
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    cachedEvergreenTestId = existing.id;
    return existing.id;
  }

  const { data: created, error } = await supabaseAdmin
    .from("landing_tests")
    .insert({
      name: EVERGREEN_TEST_NAME,
      status: "completed",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !created?.id) {
    console.error("landingEvergreenTest insert failed:", error?.message);
    return null;
  }

  cachedEvergreenTestId = created.id;
  return created.id;
}
