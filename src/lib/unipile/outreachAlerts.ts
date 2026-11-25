import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DEFAULT_SUPPORT_ASSIGNEE_ID } from "@/lib/support/assignees";

/**
 * Tell BCA about a Sales Robot problem in the Support inbox.
 *
 * One open ticket per problem: while a ticket with the same title is not
 * resolved, nothing new is opened (the cron runs every 5 minutes). Resolve the
 * ticket once it's sorted and the next occurrence opens a fresh one.
 * Never throws: an alert must not stop sends.
 */
export async function raiseOutreachAlert(input: {
  title: string;
  details: string;
}): Promise<void> {
  try {
    const title = input.title.slice(0, 200);
    const { data: open } = await supabaseAdmin
      .from("community_feedback_reports")
      .select("id")
      .eq("title", title)
      .neq("status", "resolved")
      .limit(1);
    if (open?.length) return;
    const { error } = await supabaseAdmin.from("community_feedback_reports").insert({
      created_by: null,
      type: "bug",
      title,
      details: input.details.slice(0, 8000),
      submitter_name: "Sales Robot",
      page_path: "/coach/campaigns",
      source: "admin_created",
      assigned_to: DEFAULT_SUPPORT_ASSIGNEE_ID,
      status: "open",
    });
    if (error) console.error("outreach alert insert:", error.message);
  } catch (err) {
    console.error("outreach alert:", err);
  }
}

export async function coachNames(
  coachIds: string[]
): Promise<Map<string, string>> {
  const ids = [...new Set(coachIds)].filter(Boolean);
  if (!ids.length) return new Map();
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  return new Map(
    (data ?? []).map((p) => [
      p.id as string,
      ((p.full_name as string | null) || "").trim() || "A coach",
    ])
  );
}
