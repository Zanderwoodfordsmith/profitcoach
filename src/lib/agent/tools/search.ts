import { blocksToMarkdown } from "@/lib/practiceKnowledge/blocks";
import { BLUEPRINT_SECTIONS } from "@/lib/practiceKnowledge/blueprint";
import { formatFieldValue } from "@/lib/practiceKnowledge/exportMarkdown";
import type { PracticeKnowledgePayload, BuiltSection } from "@/lib/practiceKnowledge/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { matchLabel, searchCoaches, searchPeople, type PersonMatch } from "../search/people";
import { matchScore, queryGroups } from "../search/terms";
import type { AgentToolContext, AgentToolDef } from "../types";
import { AgentToolError, isUuid, str, strList } from "./util";

/**
 * One search across everything Ava can see, and reading what it found in
 * memory. Live things (coaches, people, lists, campaigns, the Blueprint) are
 * searched where they live; history (past Ava chats, call transcripts,
 * LinkedIn posts and newsletters) comes from ava_memory.
 */

const PLACES = ["coaches", "people", "lists", "campaigns", "blueprint", "memory"] as const;
type Place = (typeof PLACES)[number];

const MEMORY_SOURCES = ["ava_chat", "sales_call", "zoom_call", "linkedin_post", "newsletter"] as const;

const PERSON_KIND: Record<PersonMatch["kind"], { label: string; idKey: string }> = {
  list_person: { label: "on a list", idKey: "item_id" },
  campaign_person: { label: "in a campaign", idKey: "lead_id" },
  contact: { label: "contact", idKey: "contact_id" },
  conversation: { label: "conversation", idKey: "conversation_id" },
};

const MEMORY_LABEL: Record<string, string> = {
  ava_chat: "Ava chat",
  sales_call: "BCA sales call",
  zoom_call: "Zoom call",
  linkedin_post: "LinkedIn post",
  newsletter: "Newsletter",
  conversation: "Conversation",
};

/** Best first. When some match every word, half matches are noise and are dropped. */
function strongest<T extends { score: number }>(rows: T[], max = 6): T[] {
  const best = Math.max(0, ...rows.map((row) => row.score));
  return (best >= 0.99 ? rows.filter((row) => row.score >= 0.75) : rows).slice(0, max);
}

function snippetAround(text: string, groups: string[], max = 260): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const lower = flat.toLowerCase();
  let at = -1;
  for (const alt of groups.flatMap((g) => g.split("|"))) {
    const i = lower.indexOf(alt);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  const start = Math.max(0, at - 80);
  const cut = flat.slice(start, start + max);
  return `${start > 0 ? "…" : ""}${cut}${start + max < flat.length ? "…" : ""}`;
}

async function searchLists(coachId: string, groups: string[]) {
  const { data, error } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("id, name, kind, item_count")
    .eq("coach_id", coachId)
    .limit(500);
  if (error) throw new Error(error.message);
  const hits = (data ?? [])
    .map((row) => ({ row, score: matchScore(String(row.name ?? ""), groups, { fuzzy: true }) }))
    .filter((hit) => hit.score >= 0.5)
    .sort((a, b) => b.score - a.score);
  return strongest(hits, 6).map(({ row, score }) => ({ id: row.id, name: row.name, kind: row.kind, people: row.item_count ?? 0, match: matchLabel(score) }));
}

async function searchCampaigns(coachId: string, groups: string[]) {
  const { data, error } = await supabaseAdmin
    .from("linkedin_campaigns")
    .select("id, name, status, channel")
    .eq("coach_id", coachId)
    .limit(500);
  if (error) throw new Error(error.message);
  const hits = (data ?? [])
    .map((row) => ({ row, score: matchScore(String(row.name ?? ""), groups, { fuzzy: true }) }))
    .filter((hit) => hit.score >= 0.5)
    .sort((a, b) => b.score - a.score);
  return strongest(hits, 6).map(({ row, score }) => ({ id: row.id, name: row.name, status: row.status, channel: row.channel, match: matchLabel(score) }));
}

/** Blueprint paragraphs that contain the words (exact word starts only: Blueprint text is long). */
async function searchBlueprint(coachId: string, groups: string[]) {
  const { data, error } = await supabaseAdmin
    .from("coach_practice_knowledge")
    .select("payload, built_sections")
    .eq("coach_id", coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return [];
  const payload = (data.payload ?? {}) as PracticeKnowledgePayload;
  const built = (data.built_sections ?? {}) as Record<string, BuiltSection>;
  const hits: Array<{ section: string; where: string; snippet: string; score: number }> = [];
  for (const ref of BLUEPRINT_SECTIONS) {
    const text =
      ref.section.source === "we_build"
        ? built[ref.key]
          ? blocksToMarkdown(built[ref.key].blocks, 4)
          : ""
        : (ref.section.fields ?? []).flatMap((field) => formatFieldValue(payload, field)).join("\n");
    if (!text) continue;
    let best: { score: number; para: string } | null = null;
    for (const para of text.split(/\n{2,}|\n(?=[-*#])/)) {
      const score = matchScore(para, groups);
      if (score > (best?.score ?? 0)) best = { score, para };
    }
    // A whole section can match words spread over its paragraphs.
    const whole = matchScore(text, groups);
    if (best && (best.score >= 0.5 || whole >= 0.99)) {
      hits.push({
        section: ref.key,
        where: `${ref.page.title} · ${ref.section.title}`,
        snippet: snippetAround(best.para, groups),
        score: Math.max(best.score, whole * 0.9),
      });
    }
  }
  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score, ...hit }) => ({ ...hit, match: matchLabel(score) }));
}

async function searchMemory(ctx: AgentToolContext, coachId: string, groups: string[], after: string | null, source: string | null) {
  const { data, error } = await supabaseAdmin.rpc("ava_memory_search", {
    p_coach_id: coachId,
    p_groups: groups,
    p_include_admin: ctx.mode === "admin",
    p_after: after,
    p_source: source,
    p_limit: 8,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    source: row.source,
    source_id: row.source_id,
    what: MEMORY_LABEL[String(row.source)] ?? row.source,
    date: String(row.ts ?? "").slice(0, 10),
    title: row.title,
    notes: row.summary_snippet ?? null,
    text: row.raw_snippet ?? null,
    link: row.url ?? null,
  }));
}

function dateOrNull(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** read_memory for a prospect conversation: its latest messages, live. */
async function readConversation(coachId: string, conversationId: string) {
  if (!isUuid(conversationId)) throw new AgentToolError("Use a conversation id from search_everything.");
  const { data: convo, error } = await supabaseAdmin
    .from("messaging_conversations")
    .select("id, prospect_name, prospect_business_name, last_message_at")
    .eq("id", conversationId)
    .eq("coach_id", coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!convo) throw new AgentToolError("No conversation with that id for this coach.");
  const { data: messages, error: msgError } = await supabaseAdmin
    .from("messaging_messages")
    .select("direction, channel, body_text, created_at")
    .eq("conversation_id", conversationId)
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (msgError) throw new Error(msgError.message);
  const who = convo.prospect_name || "Prospect";
  return {
    what: "Conversation",
    title: `${who}${convo.prospect_business_name ? ` (${convo.prospect_business_name})` : ""}`,
    date: String(convo.last_message_at ?? "").slice(0, 10),
    text: [...(messages ?? [])]
      .reverse()
      .map((m) => {
        const body = String(m.body_text ?? "").replace(/\s+/g, " ").trim().slice(0, 800);
        return `${String(m.created_at).slice(0, 10)} ${m.direction === "inbound" ? who : "Coach"} (${m.channel}): ${body}`;
      })
      .join("\n"),
  };
}

export const searchTools: AgentToolDef[] = [
  {
    name: "search_everything",
    label: "Searching",
    core: true,
    description:
      "Search everything you can see in one go, best matches first: coaches (admin only), the active coach's people (on lists, in campaigns, contacts, conversations), lists, campaigns, Blueprint text, and memory (past Ava chats, call transcripts, LinkedIn posts and newsletters, each dated). Each word counts on its own, short names match (Pam finds Pamela) and names match despite small spelling slips. Use it whenever someone mentions a person, business, list, campaign or something from the past, and before ever saying you cannot find something. If nothing comes back, try once more with different words (a surname alone, the business name). Memory results are pointers: open one with read_memory before stating what it says, and say when and where it came from.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Distinctive words: names, businesses, topics, numbers" },
        look_in: {
          type: "array",
          items: { type: "string", enum: [...PLACES] },
          description: "Default: everywhere",
        },
        after: { type: "string", description: "Memory only: YYYY-MM-DD, things on or after this date" },
        memory_source: { type: "string", enum: [...MEMORY_SOURCES], description: "Memory only: one kind of history" },
      },
      required: ["query"],
    },
    run: async (input, ctx) => {
      const query = str(input, "query");
      const groups = queryGroups(query);
      if (!groups.length) throw new AgentToolError("Give at least one word to search for.");
      const asked = strList(input, "look_in").filter((p): p is Place => (PLACES as readonly string[]).includes(p));
      const places = new Set<Place>(asked.length ? asked : PLACES);
      if (ctx.mode !== "admin") places.delete("coaches");
      const coach = ctx.coach;
      const memorySource = str(input, "memory_source");

      const [coaches, people, lists, campaigns, blueprint, memory] = await Promise.all([
        places.has("coaches") ? searchCoaches(query, 6) : null,
        coach && places.has("people") ? searchPeople(coach.id, query, { limit: 12 }) : null,
        coach && places.has("lists") ? searchLists(coach.id, groups) : null,
        coach && places.has("campaigns") ? searchCampaigns(coach.id, groups) : null,
        coach && places.has("blueprint") ? searchBlueprint(coach.id, groups) : null,
        coach && places.has("memory")
          ? searchMemory(
              ctx,
              coach.id,
              groups,
              dateOrNull(str(input, "after")),
              (MEMORY_SOURCES as readonly string[]).includes(memorySource) ? memorySource : null
            )
          : null,
      ]);

      const result: Record<string, unknown> = { searched_for: groups.map((g) => g.split("|")[0]) };
      if (coach) result.active_coach = coach.name;
      if (coaches?.length) {
        result.coaches = strongest(coaches).map((row) => ({
          id: row.id,
          name: row.full_name,
          business: row.business,
          membership: row.membership_status,
          match: matchLabel(row.score),
        }));
      }
      if (people?.length) {
        result.people = strongest(people, 8).map((row) => ({
          [PERSON_KIND[row.kind].idKey]: row.id,
          name: row.name,
          company: row.company,
          title: row.title,
          where: PERSON_KIND[row.kind].label,
          ...(row.place ? { list_or_campaign: row.place, list_or_campaign_id: row.place_id } : {}),
          ...(row.status ? { [row.kind === "conversation" ? "last_message" : "status"]: row.status } : {}),
          match: matchLabel(row.score),
        }));
      }
      if (lists?.length) result.lists = lists;
      if (campaigns?.length) result.campaigns = campaigns;
      if (blueprint?.length) result.blueprint = blueprint;
      if (memory?.length) result.memory = memory;
      if (!coach && ctx.mode === "admin") {
        result.note = "No active coach, so only coaches were searched. switch_coach to search a coach's people, lists, campaigns, Blueprint and history.";
      }
      const found = [coaches, people, lists, campaigns, blueprint, memory].some((list) => list && list.length);
      if (!found) result.tip = "Nothing matched. Try once more with different words: a surname alone, the business name, or a shorter phrase.";
      return result;
    },
  },
  {
    name: "read_memory",
    label: "Reading from memory",
    core: true,
    needsCoach: true,
    description:
      "Open one thing search_everything found in memory: the full text with its date and link, and for long ones the notes made from it. Also opens a prospect conversation (source conversation, source_id the conversation_id) with its latest messages.",
    input_schema: {
      type: "object",
      properties: {
        source: { type: "string", enum: [...MEMORY_SOURCES, "conversation"] },
        source_id: { type: "string" },
      },
      required: ["source", "source_id"],
    },
    run: async (input, ctx) => {
      const coach = ctx.coach;
      if (!coach) throw new AgentToolError("No active coach. Use find_coach and switch_coach first.");
      const source = str(input, "source");
      const sourceId = str(input, "source_id");
      if (source === "conversation") return readConversation(coach.id, sourceId);
      if (!(MEMORY_SOURCES as readonly string[]).includes(source)) throw new AgentToolError("Unknown source.");
      let query = supabaseAdmin
        .from("ava_memory")
        .select("kind, ts, title, content, url, metadata")
        .eq("coach_id", coach.id)
        .eq("source", source)
        .eq("source_id", sourceId);
      if (ctx.mode !== "admin") query = query.eq("audience", "coach");
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) throw new AgentToolError("Nothing in memory with that id for this coach.");
      const item = data.find((row) => row.kind === "item") ?? data[0];
      const raw = data
        .filter((row) => row.kind === "raw")
        .sort((a, b) => Number((a.metadata as { chunk?: number })?.chunk ?? 0) - Number((b.metadata as { chunk?: number })?.chunk ?? 0))
        .map((row) => row.content as string)
        .join("\n");
      const text = raw || String(item.content ?? "");
      const max = 16_000;
      return {
        what: MEMORY_LABEL[source] ?? source,
        title: item.title,
        date: String(item.ts ?? "").slice(0, 10),
        link: item.url ?? null,
        notes: data
          .filter((row) => row.kind === "segment" || row.kind === "atom")
          .map((row) => (row.kind === "segment" ? `${row.title}: ${row.content}` : row.content)),
        text: text.length > max ? `${text.slice(0, max)}\n[Truncated: ${text.length.toLocaleString("en-GB")} characters in all.]` : text,
      };
    },
  },
];
