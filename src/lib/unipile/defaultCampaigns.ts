import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DEFAULT_CAMPAIGN_NAMES } from "@/lib/leadMagnets/catalog";
import { DEFAULT_ACCOUNT_PLAYBOOKS } from "@/lib/unipile/playbooks";

/**
 * Insert missing starter campaigns for a coach. Idempotent on source_playbook_id.
 * Archived rows still count. Hard-deleted playbooks are remembered on the coach
 * row so we never resurrect Connector (etc.) after the coach removed them.
 */
export async function ensureDefaultCampaigns(coachId: string): Promise<void> {
  const [{ data: existing, error }, { data: coachRow, error: coachError }] =
    await Promise.all([
      supabaseAdmin
        .from("linkedin_campaigns")
        .select("id, name, status, source_playbook_id")
        .eq("coach_id", coachId)
        .not("source_playbook_id", "is", null),
      supabaseAdmin
        .from("coaches")
        .select("dismissed_campaign_playbooks")
        .eq("id", coachId)
        .maybeSingle(),
    ]);

  if (error) {
    console.error("ensureDefaultCampaigns list:", error);
    return;
  }
  if (coachError) {
    console.error("ensureDefaultCampaigns coach:", coachError);
  }

  const dismissed = new Set(
    Array.isArray(coachRow?.dismissed_campaign_playbooks)
      ? (coachRow.dismissed_campaign_playbooks as unknown[])
          .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
          .map((id) => id.trim())
      : []
  );

  const have = new Set(
    (existing ?? [])
      .map((row) => row.source_playbook_id as string | null)
      .filter((id): id is string => Boolean(id))
  );

  for (const row of existing ?? []) {
    const playbookId = row.source_playbook_id as string | null;
    if (!playbookId) continue;
    const names = DEFAULT_CAMPAIGN_NAMES[playbookId];
    if (!names || names.length < 2) continue;
    const current = String(row.name ?? "");
    const canonical = names[0];
    const previous = names.slice(1);
    if (previous.includes(current) && current !== canonical) {
      const { error: renameError } = await supabaseAdmin
        .from("linkedin_campaigns")
        .update({ name: canonical })
        .eq("id", row.id)
        .eq("coach_id", coachId);
      if (renameError) {
        console.error("ensureDefaultCampaigns rename:", playbookId, renameError);
      }
    }
  }

  for (const playbook of DEFAULT_ACCOUNT_PLAYBOOKS) {
    if (have.has(playbook.id) || dismissed.has(playbook.id)) continue;

    const { data, error: insertError } = await supabaseAdmin
      .from("linkedin_campaigns")
      .insert({
        coach_id: coachId,
        name: playbook.name,
        status: "draft",
        channel: playbook.channel,
        source_playbook_id: playbook.id,
        daily_invite_limit: playbook.dailyInviteLimit ?? 20,
        stop_on_reply: true,
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") continue;
      console.error("ensureDefaultCampaigns insert:", playbook.id, insertError);
      continue;
    }
    if (!data?.id) continue;

    try {
      const { replaceCampaignSteps } = await import("@/lib/unipile/campaigns");
      await replaceCampaignSteps(
        data.id,
        playbook.steps.map((s, i) => ({ ...s, position: i }))
      );
    } catch (err) {
      console.error("ensureDefaultCampaigns steps:", playbook.id, err);
    }
  }

  const nurture = (existing ?? []).find(
    (row) => row.source_playbook_id === "vip-nurture"
  );
  if (nurture?.id && nurture.status === "draft") {
    try {
      const [{ count }, { data: stepRows }] = await Promise.all([
        supabaseAdmin
          .from("linkedin_campaign_leads")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", nurture.id),
        supabaseAdmin
          .from("linkedin_campaign_steps")
          .select("step_type")
          .eq("campaign_id", nurture.id),
      ]);
      const hasEmail = (stepRows ?? []).some((s) => s.step_type === "email");
      if ((count ?? 0) === 0 && !hasEmail) {
        const playbook = DEFAULT_ACCOUNT_PLAYBOOKS.find(
          (p) => p.id === "vip-nurture"
        );
        if (playbook) {
          const { replaceCampaignSteps } = await import(
            "@/lib/unipile/campaigns"
          );
          await replaceCampaignSteps(
            nurture.id,
            playbook.steps.map((s, i) => ({ ...s, position: i }))
          );
        }
      }
    } catch (err) {
      console.error("ensureDefaultCampaigns nurture merge:", err);
    }
  }
}
