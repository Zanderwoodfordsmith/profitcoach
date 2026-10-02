import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * One person can sit on the pool and on several lists. Those are membership
 * rows. A change to the person writes through to every row with this identity.
 */
export async function syncPersonAcrossLists(opts: {
  coachId: string;
  identityKey: string;
  fields: Record<string, unknown>;
}): Promise<void> {
  const identityKey = opts.identityKey.trim();
  if (!identityKey) return;
  const fields = Object.fromEntries(
    Object.entries(opts.fields).filter(([, value]) => value !== undefined)
  );
  if (!Object.keys(fields).length) return;
  const { error } = await supabaseAdmin
    .from("coach_lead_list_items")
    .update(fields)
    .eq("coach_id", opts.coachId)
    .eq("identity_key", identityKey);
  if (error) throw new Error(error.message);
}
