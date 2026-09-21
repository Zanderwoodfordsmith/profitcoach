import { CONNECTOR_LIBRARY_SEED } from "@/lib/campaignLibrary/seeds/connector";
import { NURTURE_LIBRARY_SEED } from "@/lib/campaignLibrary/seeds/nurture";
import { POSITIVE_REPLY_LIBRARY_SEED } from "@/lib/campaignLibrary/seeds/positiveReply";
import { REACTIVATION_LIBRARY_SEED } from "@/lib/campaignLibrary/seeds/reactivation";
import type { CampaignLibrarySeed } from "@/lib/campaignLibrary/seeds/types";

/** Canonical CROP templates: Connection, Reactivation, Ongoing nurture, Positive replies. */
export const LIBRARY_SEEDS: CampaignLibrarySeed[] = [
  CONNECTOR_LIBRARY_SEED,
  REACTIVATION_LIBRARY_SEED,
  NURTURE_LIBRARY_SEED,
  POSITIVE_REPLY_LIBRARY_SEED,
];
