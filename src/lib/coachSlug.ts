import type { SupabaseClient } from "@supabase/supabase-js";

import { splitFullName } from "@/lib/splitFullName";

/** Lowercase slug token: letters/numbers only, empty if nothing usable. */
export function slugifyNamePart(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

/**
 * Default public coach slug from a display name: `firstname-lastname`.
 * Falls back to a single name part, then `coach`.
 */
export function coachSlugFromFullName(fullName: string): string {
  const { first_name, last_name } = splitFullName(fullName);
  const first = slugifyNamePart(first_name);
  const last = slugifyNamePart(last_name);
  if (first && last) return `${first}-${last}`.slice(0, 60);
  if (first) return first;
  if (last) return last;
  const whole = slugifyNamePart(fullName);
  return whole || "coach";
}

export async function coachSlugTaken(
  supabase: SupabaseClient,
  slug: string,
  excludeUserId?: string
): Promise<boolean> {
  let query = supabase.from("coaches").select("id").eq("slug", slug);
  if (excludeUserId) {
    query = query.neq("id", excludeUserId);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/**
 * Allocate `firstname-lastname`, then `firstname-lastname-2`, etc.
 */
export async function allocateCoachSlug(
  supabase: SupabaseClient,
  fullName: string,
  options?: { preferred?: string | null; excludeUserId?: string }
): Promise<string> {
  const preferred = options?.preferred?.toLowerCase().trim() ?? "";
  const base =
    preferred && /^[a-z0-9-]+$/.test(preferred)
      ? preferred.replace(/^-+|-+$/g, "").replace(/-+/g, "-") ||
        coachSlugFromFullName(fullName)
      : coachSlugFromFullName(fullName);

  if (!(await coachSlugTaken(supabase, base, options?.excludeUserId))) {
    return base;
  }

  for (let i = 2; i < 500; i++) {
    const candidate = `${base}-${i}`.slice(0, 60);
    if (!(await coachSlugTaken(supabase, candidate, options?.excludeUserId))) {
      return candidate;
    }
  }

  throw new Error(`Could not allocate a free slug for ${fullName}`);
}
