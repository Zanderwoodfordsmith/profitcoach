/** Postgrest errors are plain objects with `message`, not always `instanceof Error`. */
export function supabaseErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

export function communityAccessHint(errorMessage: string): string | null {
  const m = errorMessage.toLowerCase();
  if (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("undefined_table")
  ) {
    return "Run the community migration on your Supabase project (SQL file: supabase/migrations/20260502120000_community_feed.sql, or supabase db push).";
  }
  if (
    m.includes("row-level security") ||
    m.includes("rls") ||
    m.includes("policy") ||
    m.includes("permission denied")
  ) {
    return "Your profiles.role must be coach or admin. Ask a DB admin to check RLS and your profile row.";
  }
  return null;
}
