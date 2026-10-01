import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createCoachAudienceList,
  insertPeopleOnList,
  isLeadListUuid,
  loadOwnedLeadList,
  mapAudiencePeopleInput,
  MAX_LIST_ITEMS_PER_REQUEST,
  recountLeadListItems,
} from "@/lib/leadLists/audienceLists";

import type { AgentToolDef } from "../types";
import { AgentToolError, coachOf, num, personName, str } from "./util";

/** The coach's lists: overview, people on a list, new lists, pasted people. */

function cleanSearch(value: string): string {
  return value.replace(/[%,()*]/g, " ").trim();
}

export const listTools: AgentToolDef[] = [
  {
    name: "list_lists",
    label: "Looking at lists",
    needsCoach: true,
    description:
      "The active coach's lists, newest first: name, number of people, source (sales_nav, google_maps, manual…) and kind (audience, pool, blacklist).",
    input_schema: {
      type: "object",
      properties: {
        include_pool_and_blacklist: { type: "boolean", description: "Default false" },
      },
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      let query = supabaseAdmin
        .from("coach_lead_lists")
        .select("id, name, kind, source, item_count, created_at")
        .eq("coach_id", coach.id)
        .order("created_at", { ascending: false })
        .limit(60);
      if (input.include_pool_and_blacklist !== true) query = query.eq("kind", "audience");
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return {
        lists: (data ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          kind: row.kind,
          source: row.source,
          people: row.item_count ?? 0,
          created: String(row.created_at).slice(0, 10),
        })),
      };
    },
  },
  {
    name: "get_list_people",
    label: "Looking inside the list",
    needsCoach: true,
    description:
      "People on one list, with item ids (for adding some of them to a campaign). Search by name, company or title. Also returns totals and how many have a LinkedIn profile.",
    input_schema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        search: { type: "string", description: "Name, company or job title" },
        limit: { type: "number", description: "Default 20, max 100" },
      },
      required: ["list_id"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const listId = str(input, "list_id");
      if (!isLeadListUuid(listId)) throw new AgentToolError("Use a list id from list_lists.");
      const list = await loadOwnedLeadList(coach.id, listId);
      if (!list) throw new AgentToolError("List not found for this coach.");
      const limit = Math.min(100, Math.max(1, num(input, "limit") ?? 20));
      const search = cleanSearch(str(input, "search"));

      let query = supabaseAdmin
        .from("coach_lead_list_items")
        .select("id, full_name, first_name, last_name, job_title, company, linkedin_url, email, location")
        .eq("coach_id", coach.id)
        .eq("list_id", listId)
        .order("created_at", { ascending: true })
        .limit(limit);
      if (search) {
        query = query.or(
          `full_name.ilike.%${search}%,company.ilike.%${search}%,job_title.ilike.%${search}%`
        );
      }
      const [{ data, error }, total, withLinkedIn] = await Promise.all([
        query,
        supabaseAdmin
          .from("coach_lead_list_items")
          .select("id", { count: "exact", head: true })
          .eq("list_id", listId)
          .eq("coach_id", coach.id),
        supabaseAdmin
          .from("coach_lead_list_items")
          .select("id", { count: "exact", head: true })
          .eq("list_id", listId)
          .eq("coach_id", coach.id)
          .not("linkedin_url", "is", null),
      ]);
      if (error) throw new Error(error.message);
      return {
        list: { id: list.id, name: list.name, kind: list.kind },
        total: total.count ?? 0,
        with_linkedin: withLinkedIn.count ?? 0,
        showing: (data ?? []).map((row) => ({
          item_id: row.id,
          name: personName(row),
          title: row.job_title,
          company: row.company,
          location: row.location,
          linkedin: Boolean(row.linkedin_url),
          email: Boolean(row.email),
        })),
      };
    },
  },
  {
    name: "create_list",
    label: "Creating the list",
    needsCoach: true,
    description: "Create a new, empty named list for the active coach.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const name = str(input, "name");
      if (!name) throw new AgentToolError("Give the list a name.");
      const list = await createCoachAudienceList({ coachId: coach.id, name, source: "manual" });
      return { list_id: list.id, name: list.name };
    },
  },
  {
    name: "rename_list",
    label: "Renaming the list",
    needsCoach: true,
    description: "Rename one of the active coach's named lists.",
    input_schema: {
      type: "object",
      properties: { list_id: { type: "string" }, name: { type: "string" } },
      required: ["list_id", "name"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const listId = str(input, "list_id");
      const name = str(input, "name").slice(0, 120);
      if (!isLeadListUuid(listId) || !name) throw new AgentToolError("Pass a list id and a new name.");
      const list = await loadOwnedLeadList(coach.id, listId);
      if (!list) throw new AgentToolError("List not found for this coach.");
      if (list.kind !== "audience") throw new AgentToolError("The Pool and Blacklist keep their names.");
      const { error } = await supabaseAdmin
        .from("coach_lead_lists")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", listId)
        .eq("coach_id", coach.id);
      if (error) throw new Error(error.message);
      return { list_id: listId, old_name: list.name, name };
    },
  },
  {
    name: "add_people_to_list",
    label: "Adding people to the list",
    needsCoach: true,
    description:
      "Add people to a list by LinkedIn profile URL (max 250 at a time). Names, company and title are optional. People without a valid LinkedIn profile URL are skipped.",
    input_schema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        people: {
          type: "array",
          items: {
            type: "object",
            properties: {
              linkedin_url: { type: "string" },
              full_name: { type: "string" },
              company: { type: "string" },
              title: { type: "string" },
            },
            required: ["linkedin_url"],
          },
        },
      },
      required: ["list_id", "people"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const listId = str(input, "list_id");
      if (!isLeadListUuid(listId)) throw new AgentToolError("Use a list id from list_lists.");
      const list = await loadOwnedLeadList(coach.id, listId);
      if (!list) throw new AgentToolError("List not found for this coach.");
      if (list.kind !== "audience") {
        throw new AgentToolError("Add people to a named list, not the Pool or Blacklist.");
      }
      const people = mapAudiencePeopleInput(input.people, "manual", MAX_LIST_ITEMS_PER_REQUEST);
      if (!people.length) throw new AgentToolError("None of those had a valid LinkedIn profile URL.");
      const result = await insertPeopleOnList({ coachId: coach.id, listId, kind: list.kind, people });
      const itemCount = await recountLeadListItems(listId);
      return { ...result, list_size: itemCount };
    },
  },
];
