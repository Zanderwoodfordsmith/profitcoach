import { CONNECTOR_LIBRARY_SEED } from "@/lib/campaignLibrary/seeds/connector";
import { NURTURE_LIBRARY_SEED } from "@/lib/campaignLibrary/seeds/nurture";
import { POSITIVE_REPLY_LIBRARY_SEED } from "@/lib/campaignLibrary/seeds/positiveReply";
import { REACTIVATION_LIBRARY_SEED } from "@/lib/campaignLibrary/seeds/reactivation";
import { TRIBE_LIBRARY_SEED } from "@/lib/campaignLibrary/seeds/tribe";
import type { CampaignLibrarySeed } from "@/lib/campaignLibrary/seeds/types";
import { WARM_NETWORK_LIBRARY_SEED } from "@/lib/campaignLibrary/seeds/warmNetwork";

/**
 * Canonical CROP templates: Connection, Reactivation, Ongoing nurture, Positive replies.
 * Tribe connection and Warm network are extra Connection and Reactivation templates.
 */
export const LIBRARY_SEEDS: CampaignLibrarySeed[] = [
  CONNECTOR_LIBRARY_SEED,
  TRIBE_LIBRARY_SEED,
  REACTIVATION_LIBRARY_SEED,
  WARM_NETWORK_LIBRARY_SEED,
  NURTURE_LIBRARY_SEED,
  POSITIVE_REPLY_LIBRARY_SEED,
];
