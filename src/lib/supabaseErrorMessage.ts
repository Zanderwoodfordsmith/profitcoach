/** PostgREST errors are plain objects (`message`, `details`, `hint`, `code`), not always `instanceof Error`. */
export function supabaseErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const o = error as Record<string, unknown>;
    const lines: string[] = [];
    if (typeof o.message === "string" && o.message.length > 0) {
      lines.push(o.message);
    }
    if (typeof o.details === "string" && o.details.length > 0) {
      lines.push(`Details: ${o.details}`);
    }
    if (typeof o.hint === "string" && o.hint.length > 0) {
      lines.push(`Hint: ${o.hint}`);
    }
    if (typeof o.code === "string" && o.code.length > 0) {
      lines.push(`Code: ${o.code}`);
    }
    if (lines.length > 0) {
      return lines.join("\n");
    }
    try {
      return JSON.stringify(o);
    } catch {
      /* ignore */
    }
  }
  const s = String(error);
  return s === "[object Object]" ? "Unknown error (empty message)." : s;
}

export function communityAccessHint(errorMessage: string): string | null {
  const m = errorMessage.toLowerCase();
  if (m.includes("infinite recursion") && m.includes("profiles")) {
    return "Your Supabase database has not applied the latest Community RLS fix (or it failed). Deploying the Next.js app does not run SQL. In Supabase Dashboard → SQL Editor, run supabase/repair_community_rls.sql or migrations/20260506120000_community_staff_snapshot_break_recursion.sql, then reload Community.";
  }
  if (m.includes("set is not allowed in a non-volatile function")) {
    return "Apply migration supabase/migrations/20260504120000_community_rls_functions_volatile.sql (community helpers must be VOLATILE when using SET LOCAL).";
  }
  if (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("undefined_table")
  ) {
    if (
      m.includes("feed_comment_count") ||
      m.includes("feed_like_count") ||
      (m.includes("last_comment_at") &&
        m.includes("community_posts") &&
        m.includes("column"))
    ) {
      return "Apply feed counter columns on community_posts: run supabase/migrations/20260608120000_community_posts_feed_counters.sql in Supabase Dashboard → SQL Editor (or `supabase db push` from this repo). Deploying the app does not run SQL.";
    }
    if (m.includes("community_posts.media")) {
      return "Add the community post media column: run supabase/migrations/20260607120000_community_posts_media.sql in Supabase Dashboard → SQL Editor (or `supabase db push` from this repo). Deploying the app does not run SQL.";
    }
    if (
      m.includes("community_calendar_events") &&
      (m.includes("recording_link_url") || m.includes("recording_video_url"))
    ) {
      return "Add calendar recording columns: run supabase/migrations/20260613120000_community_calendar_recordings.sql in Supabase Dashboard → SQL Editor (or `supabase db push` from this repo). Deploying the app does not run SQL.";
    }
    if (m.includes("community_calendar_events") && m.includes("relation")) {
      return "Create the community calendar table: run supabase/migrations/20260604120000_community_calendar_events.sql in Supabase Dashboard → SQL Editor (or `supabase db push` from this repo). Deploying the app does not run SQL.";
    }
    return "A database migration may be missing. From the repo root run `supabase db push`, or in Supabase Dashboard → SQL Editor run the migration file that matches the missing object in the error above. For the original community tables, see supabase/migrations/20260502120000_community_feed.sql.";
  }
  if (
    m.includes("row-level security") ||
    m.includes("rls") ||
    m.includes("policy") ||
    m.includes("permission denied")
  ) {
    return "Your profiles.role must be coach or admin. Ask a DB admin to check RLS and your profile row.";
  }
  if (
    m.includes("jwt") ||
    (m.includes("token") && m.includes("expired")) ||
    m.includes("not authorized")
  ) {
    return "Try signing out and signing in again, then refresh this page.";
  }
  return null;
}
