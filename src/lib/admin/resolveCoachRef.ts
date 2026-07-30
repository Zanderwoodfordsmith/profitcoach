import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCoachUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export type ResolvedCoachRef = {
  id: string;
  slug: string;
};

/** Resolve a coach from an admin URL segment (slug or legacy UUID). */
export async function resolveCoachByRef(
  ref: string
): Promise<ResolvedCoachRef | null> {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  const column = isCoachUuid(trimmed) ? "id" : "slug";
  const { data, error } = await supabaseAdmin
    .from("coaches")
    .select("id, slug")
    .eq(column, trimmed)
    .maybeSingle();

  if (error || !data?.id || !data?.slug) return null;

  return {
    id: data.id as string,
    slug: data.slug as string,
  };
}
