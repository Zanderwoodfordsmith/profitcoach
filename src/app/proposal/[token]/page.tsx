import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ProposalDocument } from "@/components/proposals/ProposalDocument";
import { ProposalOpenBeacon } from "@/components/proposals/ProposalOpenBeacon";
import { ProposalSign } from "@/components/proposals/ProposalSign";
import { figtree } from "@/fonts";
import { loadProposalByToken, loadProposalCoach } from "@/lib/proposals/store";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** A prospect's proposal, by its private link. Never indexed. */

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const load = cache(async (token: string) => {
  const proposal = await loadProposalByToken(token);
  if (!proposal) return null;
  const [{ data: profile }, coach] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", proposal.coach_id)
      .maybeSingle(),
    loadProposalCoach(proposal.coach_id),
  ]);
  return {
    proposal,
    coach,
    coachName:
      (profile?.full_name as string | null)?.trim() ||
      coach?.site.name ||
      "Your coach",
  };
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const loaded = await load((await params).token);
  return {
    title: loaded
      ? loaded.proposal.kind === "welcome"
        ? `Welcome, ${loaded.proposal.prospect_name}`
        : `Proposal for ${loaded.proposal.prospect_business || loaded.proposal.prospect_name}`
      : "Proposal",
    robots: { index: false, follow: false },
  };
}

export default async function ProposalPage({ params }: PageProps) {
  const loaded = await load((await params).token);
  if (!loaded) notFound();
  const { proposal, coach, coachName } = loaded;
  return (
    <div className={figtree.variable}>
      <ProposalOpenBeacon token={proposal.share_token} />
      <ProposalDocument
        proposal={proposal}
        coach={coach}
        coachName={coachName}
        sign={
          proposal.kind === "welcome" ? null : (
            <ProposalSign
              token={proposal.share_token}
              prospectName={proposal.prospect_name}
              coachFirstName={coachName.split(" ")[0]}
              signed={
                proposal.signed_at
                  ? {
                      name: proposal.signed_name ?? proposal.prospect_name,
                      at: proposal.signed_at,
                    }
                  : null
              }
            />
          )
        }
      />
    </div>
  );
}
