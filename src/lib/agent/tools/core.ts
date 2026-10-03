import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getOkLinkedInAccount } from "@/lib/unipile/outreachAccounts";

import { loadAgentCoach } from "../coaches";
import type { AgentToolDef } from "../types";
import { AgentToolError, coachOf, isUuid, str } from "./util";

/**
 * Always-loaded tools: opening capabilities, the account overview, and (admin
 * mode) choosing which coach to act on. open_capability is executed by the
 * runner, which also reveals the capability's deferred tools.
 */

export const OPEN_CAPABILITY_TOOL = "open_capability";

export const coreTools: AgentToolDef[] = [
  {
    name: OPEN_CAPABILITY_TOOL,
    label: "Opening",
    core: true,
    description:
      "Open a capability from the router. Returns its contract (what to ask for, how to work, what not to do) and makes its tools available. Open every capability a job needs before using its tools.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Capability id from the router, e.g. google-maps-import" },
      },
      required: ["id"],
    },
    // Handled by the runner.
    run: async () => null,
  },
  {
    name: "get_account_overview",
    label: "Looking at the account",
    core: true,
    needsCoach: true,
    description:
      "A quick picture of the active coach's account: LinkedIn connection, campaigns (on or off, people), the newest lists, imports in progress, and whether their Practice Blueprint has targeting and campaign messaging.",
    input_schema: { type: "object", properties: {} },
    run: async (_input, ctx) => {
      const coach = coachOf(ctx);
      const [linkedIn, campaigns, lists, salesNavRuns, mapsRuns, searchRuns, practice] = await Promise.all([
        getOkLinkedInAccount(coach.id).catch(() => null),
        supabaseAdmin
          .from("linkedin_campaigns")
          .select("id, name, status, channel, updated_at")
          .eq("coach_id", coach.id)
          .neq("status", "archived")
          .order("updated_at", { ascending: false })
          .limit(30),
        supabaseAdmin
          .from("coach_lead_lists")
          .select("id, name, kind, item_count, source, created_at")
          .eq("coach_id", coach.id)
          .eq("kind", "audience")
          .order("created_at", { ascending: false })
          .limit(10),
        supabaseAdmin
          .from("sales_nav_import_runs")
          .select("id, status, progress_count, created_at")
          .eq("coach_id", coach.id)
          .in("status", ["pending", "running"])
          .limit(3),
        supabaseAdmin
          .from("google_maps_import_runs")
          .select("id, status, progress_count, created_at")
          .eq("coach_id", coach.id)
          .in("status", ["pending", "running"])
          .limit(3),
        supabaseAdmin
          .from("google_search_import_runs")
          .select("id, status, progress_count, created_at")
          .eq("coach_id", coach.id)
          .in("status", ["pending", "running"])
          .limit(3),
        supabaseAdmin
          .from("coach_practice_knowledge")
          .select("built_sections")
          .eq("coach_id", coach.id)
          .maybeSingle(),
      ]);

      const campaignRows = campaigns.data ?? [];
      const ids = campaignRows.map((row) => row.id as string);
      const counts = new Map<string, number>();
      await Promise.all(
        ids.map(async (id) => {
          const { count } = await supabaseAdmin
            .from("linkedin_campaign_leads")
            .select("id", { count: "exact", head: true })
            .eq("campaign_id", id);
          counts.set(id, count ?? 0);
        })
      );

      const built = (practice.data?.built_sections ?? {}) as Record<string, unknown>;
      return {
        coach: coach.name,
        linkedin: linkedIn
          ? { connected: true, name: linkedIn.display_name ?? null }
          : { connected: false },
        campaigns: campaignRows.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          channel: row.channel ?? "linkedin",
          people: counts.get(row.id as string) ?? 0,
        })),
        newest_lists: (lists.data ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          people: row.item_count,
          source: row.source,
          created: String(row.created_at).slice(0, 10),
        })),
        imports_running: [
          ...(salesNavRuns.data ?? []).map((row) => ({ kind: "sales_nav", id: row.id, progress: row.progress_count })),
          ...(mapsRuns.data ?? []).map((row) => ({ kind: "google_maps", id: row.id, progress: row.progress_count })),
          ...(searchRuns.data ?? []).map((row) => ({ kind: "google_search", id: row.id, progress: row.progress_count })),
        ],
        blueprint: {
          targeting: Boolean(built["market:criteria"] || built["market:avatar"]),
          campaign_messaging: Boolean(built["campaigns:messaging"]),
        },
      };
    },
  },
  {
    name: "find_coach",
    label: "Finding the coach",
    core: true,
    modes: ["admin"],
    description:
      "Admin only. Search coaches by name or business name. Returns up to 8 matches with ids. Then use switch_coach.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Part of the coach's name or business" } },
      required: ["query"],
    },
    run: async (input) => {
      const query = str(input, "query").replace(/[%,()]/g, " ").trim();
      if (query.length < 2) throw new AgentToolError("Give at least two letters of the name.");
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, coach_business_name, role")
        .in("role", ["coach", "admin"])
        .or(`full_name.ilike.%${query}%,coach_business_name.ilike.%${query}%`)
        .order("full_name", { ascending: true })
        .limit(8);
      if (error) throw new Error(error.message);
      const ids = (data ?? []).map((row) => row.id as string);
      const { data: coachRows } = ids.length
        ? await supabaseAdmin
            .from("coaches")
            .select("id, membership_status, ai_agent_enabled")
            .in("id", ids)
        : { data: [] as Array<{ id: string; membership_status: string | null; ai_agent_enabled: boolean }> };
      const byId = new Map((coachRows ?? []).map((row) => [row.id as string, row]));
      return {
        matches: (data ?? [])
          .filter((row) => byId.has(row.id as string))
          .map((row) => ({
            id: row.id,
            name: row.full_name,
            business: row.coach_business_name,
            membership: byId.get(row.id as string)?.membership_status ?? null,
            agent_enabled: byId.get(row.id as string)?.ai_agent_enabled ?? false,
          })),
      };
    },
  },
  {
    name: "switch_coach",
    label: "Switching coach",
    core: true,
    modes: ["admin"],
    description:
      "Admin only. Make this coach the active coach for the rest of the chat. Everything after this acts on their account.",
    input_schema: {
      type: "object",
      properties: { coach_id: { type: "string", description: "Coach id from find_coach" } },
      required: ["coach_id"],
    },
    run: async (input, ctx) => {
      const coachId = str(input, "coach_id");
      if (!isUuid(coachId)) throw new AgentToolError("Use a coach id from find_coach.");
      const coach = await loadAgentCoach(coachId);
      if (!coach) throw new AgentToolError("No coach with that id.");
      ctx.setCoach(coach);
      return { ok: true, active_coach: coach.name };
    },
  },
];
