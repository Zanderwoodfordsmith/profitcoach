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
  cards: Record<string, BoardCard & { unread: number }>;
};

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

  const [profiles, slugs, heads, open, launchList, accounts] = await Promise.all([
    ids.length
      ? supabaseAdmin.from("profiles").select("id, full_name, first_name, last_name, avatar_url, access_removed_at, created_at, disco_community_joined_on").in("id", ids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.length ? supabaseAdmin.from("coaches").select("id, slug").in("id", ids) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
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

    const cards: BoardCoach["cards"] = {};
    for (const page of pages) {
      cards[page.slug] = { ...boardCard(page, row, open[row.coach_id]?.[pageScope(page.slug)] ?? 0), unread: unread[page.slug] ?? 0 };
    }
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
