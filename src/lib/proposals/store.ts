import { explainerFromBlueprint, type ExplainerCoach } from "@/lib/coachExplainer/fromBlueprint";
import { loadCoachSiteAndRow } from "@/lib/coachSite/load";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanSections, PROPOSAL_COLUMNS, type Proposal } from "./types";

export function toProposal(row: Record<string, unknown>): Proposal {
  return { ...(row as unknown as Proposal), sections: cleanSections(row.sections) };
}

/** The coach's Blueprint lines for proposals (all sections, signed off or not: the coach checks before sending). */
export async function loadProposalCoach(coachId: string): Promise<ExplainerCoach | null> {
  const { data } = await supabaseAdmin.from("coaches").select("slug").eq("id", coachId).maybeSingle();
  const slug = (data?.slug as string | null)?.trim();
  if (!slug) return null;
  const loaded = await loadCoachSiteAndRow(slug, { approvedOnly: false });
  return loaded ? explainerFromBlueprint(loaded.site, loaded.row) : null;
}

export async function loadCoachProposal(coachId: string, id: string): Promise<Proposal | null> {
  const { data } = await supabaseAdmin.from("coach_proposals").select(PROPOSAL_COLUMNS).eq("id", id).eq("coach_id", coachId).maybeSingle();
  return data ? toProposal(data) : null;
}

export async function loadProposalByToken(token: string): Promise<Proposal | null> {
  if (!/^[0-9a-f]{36}$/.test(token)) return null;
  const { data } = await supabaseAdmin
    .from("coach_proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("share_token", token)
    .neq("status", "archived")
    .maybeSingle();
  return data ? toProposal(data) : null;
}
