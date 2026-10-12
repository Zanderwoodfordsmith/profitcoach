import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Puts a campaign first when the coach has already chosen a list order. */
export async function placeCampaignAtTopOfList(
  coachId: string,
  campaignId: string
) {
  const { data, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("list_order")
    .eq("coach_id", coachId)
    .neq("status", "archived")
    .not("list_order", "is", null)
    .order("list_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || typeof data.list_order !== "number") return;

  const { error: updateError } = await supabaseAdmin
    .from("linkedin_campaigns")
    .update({ list_order: data.list_order - 1 })
    .eq("id", campaignId)
    .eq("coach_id", coachId);
  if (updateError) throw new Error(updateError.message);
}

/** Saves the visible campaign list order. Ids must belong to this coach. */
export async function reorderCoachCampaigns(coachId: string, ids: string[]) {
  const { data, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id")
    .eq("coach_id", coachId)
    .neq("status", "archived")
    .in("id", ids);
  if (error) throw new Error(error.message);
  const owned = new Set((data ?? []).map((row) => row.id as string));
  if (owned.size !== ids.length) throw new Error("Campaign not found.");

  const results = await Promise.all(
    ids.map((id, index) =>
      supabaseAdmin
        .from("linkedin_campaigns")
        .update({ list_order: index })
        .eq("id", id)
        .eq("coach_id", coachId)
        .neq("status", "archived")
    )
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
}
