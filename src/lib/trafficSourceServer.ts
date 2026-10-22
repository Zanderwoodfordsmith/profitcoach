import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TrafficSource } from "./trafficSource";

/** The contact keeps the first tagged visit we saw for them. */
export async function recordContactTraffic(contactId: string | null, traffic: TrafficSource | null): Promise<void> {
  if (!contactId || !traffic) return;
  const { error } = await supabaseAdmin
    .from("contacts")
    .update({ traffic_source: traffic.source, traffic_medium: traffic.medium, traffic_campaign: traffic.campaign })
    .eq("id", contactId)
    .is("traffic_source", null);
  if (error) console.error("recordContactTraffic:", error.message);
}
