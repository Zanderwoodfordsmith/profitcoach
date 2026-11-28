import "server-only";

import { launchViewStep, loadLaunchList, type GettingLiveStep, type LaunchListCoach } from "@/lib/gettingLive";
import { openForCoaches } from "@/lib/launch/jobActivity";
import { pageScope } from "@/lib/launch/avaWork";
import type { BlueprintLink } from "@/lib/practiceKnowledge/blueprint";
import { boardCard, boardPages, type BoardCard } from "@/lib/practiceKnowledge/blueprintBoard";
import { commentPage } from "@/lib/practiceKnowledge/pageChat";
import { summariseThreads } from "@/lib/practiceKnowledge/sectionCommentTypes";
import { commentHeadsForCoaches } from "@/lib/practiceKnowledge/sectionComments";
import { mapKnowledgeRow } from "@/lib/practiceKnowledge/store";
import type { PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";
import { resolveCoachJoinedAt } from "@/lib/primaryCoach";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type BoardCoach = {
  coach_id: string;
  name: string;
  avatar_url: string | null;
  slug: string | null;
  /** When they joined, as on their admin page. */
  joined_at: string | null;
  /** Their LinkedIn is connected (an outreach account that's OK), as on Getting live. */
  linkedin_connected: boolean;
  /** Has Sales Navigator on their LinkedIn: asked live for launching, connected coaches; null when not asked (21 Nov). */
  sales_navigator?: boolean | null;
  /** Their LinkedIn SSI (0-100), as last loaded when they opened it in the app, and when that was; null if never loaded (23 Nov). */
  ssi: number | null;
  ssi_checked_at: string | null;
  /** On the Getting live list: launching now. */
  launching: boolean;
  /** The launch steps that aren't Blueprint pages, from Getting live; null when not launching. */
  launch: Record<LaunchStepKey, LaunchStep> | null;
  /** Each page's card, by page slug. */
  cards: Record<string, BoardCard & { unread: number; check_on?: string }>;
  /** BCA's next step for this coach, and where they come in Zander's working order (Launch view, 28 Nov). */
  launch_note: string | null;
  launch_order: number | null;
  /** What's live of the agreed outputs (the Outputs columns on the Launch view, 28 Nov). */
  outputs: CoachOutputFacts;
};

export type CampaignKind = "connect" | "vip" | "referral" | "interested" | "nurture";
export type CampaignFact = { name: string; status: string };
export type CoachOutputFacts = {
  /** Their LinkedIn campaigns by kind (running, paused or draft), matched by playbook and name. */
  campaigns: Record<CampaignKind, CampaignFact[]>;
  /** Newsletter issues published in the last 120 days. */
  newsletters_published: number;
  posts_30d: number;
  booking_pages: number;
  /** People tagged VIP and Referral in Prospects, and whether referrals are off for now (28 Nov). */
  tagged: { vip: number; referral: number };
  referral_off: boolean;
  /** When their LinkedIn connections were brought into Prospects (once, at launch). */
  connections_imported_at: string | null;
  /** Prospects: everyone imported, their lists, and Ava's list plan (the Lists hover card). */
  lists: {
    pool: number;
    lists: { name: string; count: number; source: string }[];
    plan: { status: "open" | "saved"; planned: { label: string; size: number | null; imported: number | null }[] } | null;
    connections: number | null;
  };
};

/**
 * Which of the four campaigns (or nurture) a LinkedIn campaign is. Campaigns
 * don't store their template, so this goes by playbook key and name: Connector
 * playbooks and anything unnamed count as Connect.
 */
export function campaignKind(c: { name: string | null; source_playbook_id: string | null }): CampaignKind {
  const name = (c.name ?? "").toLowerCase();
  const pb = c.source_playbook_id ?? "";
  if (pb === "reply-interested" || pb.startsWith("scorecard") || /reply interested|positive repl|interested|scorecard/.test(name)) return "interested";
  if (pb === "vip-nurture" || /nurture|reactivat/.test(name)) return "nurture";
  if (/referr|existing connection|warm network|introduc/.test(name)) return "referral";
  if (/\bvip\b/.test(name)) return "vip";
  return "connect";
}

/**
 * Every coach with a Blueprint, each page in the column for whose move it is,
 * with Ava's open work and unread chat messages for BCA. Admin → Coaches →
 * Launches draws it; the daily progress snapshot saves it.
 */
/** The launch steps Launches shows beside the pages: the Blueprint call, the prospect list and the campaign going on. */
export const LAUNCH_EXTRA_STEPS = ["blueprint_call", "leads_found", "campaign_live"] as const;
export type LaunchStepKey = (typeof LAUNCH_EXTRA_STEPS)[number];
export type LaunchStep = Pick<GettingLiveStep, "done" | "source" | "detail">;

/** Who's launching, already started by the caller (the Launch view asks about Sales Navigator from it), or started here. */
type LaunchListLoad = Promise<Map<string, LaunchListCoach> | null>;

export async function loadBoardCoaches(
  opts: { launchList?: LaunchListLoad } = {}
): Promise<{ coaches: BoardCoach[]; pages: BlueprintLink[] }> {
  // Who's launching doesn't need the Blueprint rows: start it first. Only the
  // three launch steps, not all of Getting live (23 Nov).
  const launchLoad = opts.launchList ?? loadLaunchList().catch(() => null);
  const { data: rows, error } = await supabaseAdmin
    .from("coach_practice_knowledge")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const ids = (rows ?? []).map((r) => String((r as { coach_id: string }).coach_id));

  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [campaignRows, issueRows, postRows, calendarRows, listRows, planRows, connectionCounts, taggedRows] = await Promise.all([
    ids.length
      ? supabaseAdmin.from("linkedin_campaigns").select("coach_id, name, status, source_playbook_id").in("coach_id", ids).in("status", ["running", "paused", "draft"])
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.length
      ? supabaseAdmin
          .from("linkedin_newsletter_issues")
          .select("user_id")
          .in("user_id", ids)
          .gte("published_at", new Date(Date.now() - 120 * 86_400_000).toISOString())
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.length
      ? supabaseAdmin.from("linkedin_post_history").select("user_id").in("user_id", ids).gte("posted_at", since30)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.length
      ? supabaseAdmin.from("coach_calendars").select("coach_id").in("coach_id", ids).eq("is_enabled", true)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.length
      ? supabaseAdmin.from("coach_lead_lists").select("id, coach_id, name, kind, source, item_count").in("coach_id", ids).in("kind", ["pool", "audience"])
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.length
      ? supabaseAdmin
          .from("launch_job_activity")
          .select("coach_id, status, payload, created_at")
          .in("coach_id", ids)
          .eq("job_key", "lead-list")
          .eq("kind", "searches")
          .in("status", ["open", "saved"])
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    Promise.all(
      ids.map(async (id) => {
        const { count } = await supabaseAdmin.from("coach_linkedin_connections").select("coach_id", { count: "exact", head: true }).eq("coach_id", id);
        return [id, count ?? null] as const;
      })
    ),
    // Tagged people per coach: only rows with tags, then VIP and Referral counted by identity (a person can be on several lists).
    Promise.all(
      ids.map(async (id) => {
        const keys = { vip: new Set<string>(), referral: new Set<string>() };
        for (let from = 0; from < 20_000; from += 1000) {
          const { data } = await supabaseAdmin
            .from("coach_lead_list_items")
            .select("identity_key, tags")
            .eq("coach_id", id)
            .not("tags", "eq", "{}")
            .range(from, from + 999);
          for (const r of (data ?? []) as { identity_key: string | null; tags: string[] | null }[]) {
            const tags = (r.tags ?? []).map((t) => String(t).toLowerCase());
            const key = r.identity_key ?? "";
            if (tags.includes("vip")) keys.vip.add(key);
            if (tags.includes("referral")) keys.referral.add(key);
          }
          if (!data || data.length < 1000) break;
        }
        return [id, { vip: keys.vip.size, referral: keys.referral.size }] as const;
      })
    ),
  ]);
  const taggedOf = new Map(taggedRows);
  const connectionsOf = new Map(connectionCounts);
  const listsOf = new Map<string, CoachOutputFacts["lists"]>();
  const countOfList = new Map<string, number>();
  for (const r of (listRows.data ?? []) as Record<string, unknown>[]) {
    const id = String(r.coach_id);
    const entry = listsOf.get(id) ?? { pool: 0, lists: [], plan: null, connections: null };
    const count = Number(r.item_count) || 0;
    countOfList.set(String(r.id), count);
    if (r.kind === "pool") entry.pool += count;
    else entry.lists.push({ name: String(r.name ?? "List"), count, source: String(r.source ?? "") });
    listsOf.set(id, entry);
  }
  // The newest open plan wins (it's what BCA checks next), else the newest released one.
  const planOf = new Map<string, Record<string, unknown>>();
  for (const r of (planRows.data ?? []) as Record<string, unknown>[]) {
    const id = String(r.coach_id);
    const cur = planOf.get(id);
    if (!cur || (cur.status !== "open" && r.status === "open")) planOf.set(id, r);
  }
  const listFacts = (coachId: string): CoachOutputFacts["lists"] => {
    const entry = listsOf.get(coachId) ?? { pool: 0, lists: [], plan: null, connections: null };
    const row = planOf.get(coachId);
    const payload = (row?.payload ?? {}) as {
      searches?: { label?: string; on?: boolean; size?: number | null; roughSize?: number | null }[];
      imported?: { label?: string; list?: string }[];
    };
    const importedBy = new Map((payload.imported ?? []).map((i) => [String(i.label ?? ""), i.list ? countOfList.get(String(i.list)) ?? 0 : null]));
    return {
      pool: entry.pool,
      lists: [...entry.lists].sort((a, b) => b.count - a.count),
      plan: row
        ? {
            status: row.status === "open" ? "open" : "saved",
            planned: (payload.searches ?? [])
              .filter((sr) => sr.on !== false)
              .map((sr) => ({
                label: String(sr.label ?? "List"),
                size: sr.size ?? sr.roughSize ?? null,
                imported: importedBy.has(String(sr.label ?? "")) ? (importedBy.get(String(sr.label ?? "")) ?? null) : null,
              })),
          }
        : null,
      // Their imported connections live as a list (source "connections", or named 1st-degree); the sync table is a fallback.
      connections: (() => {
        const fromLists = Math.max(
          0,
          ...entry.lists.filter((l) => l.source === "connections" || /1st.degree|all connections/i.test(l.name)).map((l) => l.count)
        );
        const synced = connectionsOf.get(coachId) ?? 0;
        const best = Math.max(fromLists, synced);
        return best > 0 ? best : null;
      })(),
    };
  };
  const countBy = (rows: Record<string, unknown>[] | null, key: string) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(String(r[key]), (m.get(String(r[key])) ?? 0) + 1);
    return m;
  };
  const issuesOf = countBy((issueRows.data ?? []) as Record<string, unknown>[], "user_id");
  const postsOf = countBy((postRows.data ?? []) as Record<string, unknown>[], "user_id");
  const calendarsOf = countBy((calendarRows.data ?? []) as Record<string, unknown>[], "coach_id");
  const campaignsOf = new Map<string, CoachOutputFacts["campaigns"]>();
  for (const r of (campaignRows.data ?? []) as Record<string, unknown>[]) {
    const id = String(r.coach_id);
    const entry = campaignsOf.get(id) ?? { connect: [], vip: [], referral: [], interested: [], nurture: [] };
    entry[campaignKind({ name: (r.name as string | null) ?? null, source_playbook_id: (r.source_playbook_id as string | null) ?? null })].push({
      name: String(r.name ?? "Campaign"),
      status: String(r.status),
    });
    campaignsOf.set(id, entry);
  }

  const [profiles, slugs, heads, open, launchList, accounts] = await Promise.all([
    ids.length
      ? supabaseAdmin.from("profiles").select("id, full_name, first_name, last_name, avatar_url, access_removed_at, created_at, disco_community_joined_on").in("id", ids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.length
      ? supabaseAdmin.from("coaches").select("id, slug, launch_note, launch_order, referral_off, connections_imported_at").in("id", ids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    commentHeadsForCoaches(ids),
    openForCoaches(ids),
    launchLoad,
    ids.length
      ? supabaseAdmin.from("linkedin_outreach_accounts").select("coach_id, provider, status, ssi_score, ssi_fetched_at").in("coach_id", ids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const okAccounts = ((accounts.data ?? []) as Record<string, unknown>[]).filter((a) => a.provider === "LINKEDIN" && a.status === "OK");
  const connected = new Set(okAccounts.map((a) => String(a.coach_id)));
  const ssiOf = new Map<string, { score: number; at: string | null }>();
  for (const a of okAccounts) {
    const score = a.ssi_score == null ? NaN : Number(a.ssi_score);
    if (Number.isFinite(score)) ssiOf.set(String(a.coach_id), { score, at: (a.ssi_fetched_at as string | null) ?? null });
  }
  const people = new Map(((profiles.data ?? []) as Record<string, unknown>[]).map((p) => [String(p.id), p]));
  const slugOf = new Map(((slugs.data ?? []) as Record<string, unknown>[]).map((c) => [String(c.id), (c.slug as string | null) ?? null]));
  const noteOf = new Map(
    ((slugs.data ?? []) as Record<string, unknown>[]).map((c) => [
      String(c.id),
      {
        note: (c.launch_note as string | null) ?? null,
        order: c.launch_order == null ? null : Number(c.launch_order),
        referralOff: Boolean(c.referral_off),
        connectionsImportedAt: (c.connections_imported_at as string | null) ?? null,
      },
    ])
  );
  const pages = boardPages();

  const coaches: BoardCoach[] = [];
  for (const raw of rows ?? []) {
    const row = mapKnowledgeRow(raw as Record<string, unknown>);
    const person = people.get(row.coach_id) as
      | {
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          access_removed_at?: string | null;
          created_at?: string | null;
          disco_community_joined_on?: string | null;
        }
      | undefined;
    // People who have left keep their profile, but are not worked on.
    if (!person || person.access_removed_at) continue;

    const reads = Object.fromEntries(heads.reads.filter((r) => r.coach_id === row.coach_id).map((r) => [r.section_key, r.read_at]));
    const threads = summariseThreads(
      heads.comments.filter((c) => c.coach_id === row.coach_id),
      "bca",
      reads
    );
    const unread: Record<string, number> = {};
    for (const [key, thread] of Object.entries(threads)) {
      const slug = commentPage(key);
      if (slug && thread.unread) unread[slug] = (unread[slug] ?? 0) + thread.unread;
    }

    // Ava's items on About You are the Voice guide: BCA's work, filed there but hidden. They count on
    // Ideal client, so About You shows only the coach's part; check_on opens About You, where the draft is (28 Nov).
    const opened = open[row.coach_id] ?? {};
    const aboutOpen = opened[pageScope("about")] ?? 0;
    const openOn = (slug: string) =>
      slug === "about" ? 0 : (opened[pageScope(slug)] ?? 0) + (slug === "market" ? aboutOpen : 0);
    const cards: BoardCoach["cards"] = {};
    for (const page of pages) {
      cards[page.slug] = { ...boardCard(page, row, openOn(page.slug)), unread: unread[page.slug] ?? 0 };
    }
    if (cards.market && aboutOpen && !opened[pageScope("market")]) cards.market.check_on = "about";
    coaches.push({
      coach_id: row.coach_id,
      name: person.full_name?.trim() || [person.first_name, person.last_name].filter(Boolean).join(" ").trim() || "Coach",
      avatar_url: person.avatar_url?.trim() || null,
      slug: slugOf.get(row.coach_id) ?? null,
      joined_at: resolveCoachJoinedAt(slugOf.get(row.coach_id) ?? null, {
        discoCommunityJoinedOn: person.disco_community_joined_on ?? null,
        profileCreatedAt: person.created_at ?? null,
      }),
      linkedin_connected: connected.has(row.coach_id),
      ssi: ssiOf.get(row.coach_id)?.score ?? null,
      ssi_checked_at: ssiOf.get(row.coach_id)?.at ?? null,
      launching: Boolean(launchList?.has(row.coach_id)),
      launch: launchSteps(launchList?.get(row.coach_id), row),
      cards,
      launch_note: noteOf.get(row.coach_id)?.note ?? null,
      launch_order: noteOf.get(row.coach_id)?.order ?? null,
      outputs: {
        campaigns: campaignsOf.get(row.coach_id) ?? { connect: [], vip: [], referral: [], interested: [], nurture: [] },
        newsletters_published: issuesOf.get(row.coach_id) ?? 0,
        posts_30d: postsOf.get(row.coach_id) ?? 0,
        booking_pages: calendarsOf.get(row.coach_id) ?? 0,
        lists: listFacts(row.coach_id),
        tagged: taggedOf.get(row.coach_id) ?? { vip: 0, referral: 0 },
        referral_off: noteOf.get(row.coach_id)?.referralOff ?? false,
        connections_imported_at: noteOf.get(row.coach_id)?.connectionsImportedAt ?? null,
      },
    });
  }

  return { coaches, pages };
}

function launchSteps(coach: LaunchListCoach | undefined, row: PracticeKnowledgeRow): BoardCoach["launch"] {
  if (!coach) return null;
  const out = {} as Record<LaunchStepKey, LaunchStep>;
  for (const key of LAUNCH_EXTRA_STEPS) out[key] = launchViewStep(key, coach, row);
  return out;
}
