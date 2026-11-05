import "server-only";

import { loadGettingLive, type GettingLiveRow, type GettingLiveStep } from "@/lib/gettingLive";
import { openForCoaches } from "@/lib/launch/jobActivity";
import { pageScope } from "@/lib/launch/avaWork";
import type { BlueprintLink } from "@/lib/practiceKnowledge/blueprint";
import { boardCard, boardPages, type BoardCard } from "@/lib/practiceKnowledge/blueprintBoard";
import { commentPage } from "@/lib/practiceKnowledge/pageChat";
import { summariseThreads } from "@/lib/practiceKnowledge/sectionCommentTypes";
import { commentHeadsForCoaches } from "@/lib/practiceKnowledge/sectionComments";
import { mapKnowledgeRow } from "@/lib/practiceKnowledge/store";
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

export async function loadBoardCoaches(): Promise<{ coaches: BoardCoach[]; pages: BlueprintLink[] }> {
  const { data: rows, error } = await supabaseAdmin
    .from("coach_practice_knowledge")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const ids = (rows ?? []).map((r) => String((r as { coach_id: string }).coach_id));

  const [profiles, slugs, heads, open, live, accounts] = await Promise.all([
    ids.length
      ? supabaseAdmin.from("profiles").select("id, full_name, first_name, last_name, avatar_url, access_removed_at, created_at, disco_community_joined_on").in("id", ids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ids.length ? supabaseAdmin.from("coaches").select("id, slug").in("id", ids) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    commentHeadsForCoaches(ids),
    openForCoaches(ids),
    loadGettingLive().catch(() => null),
    ids.length
      ? supabaseAdmin.from("linkedin_outreach_accounts").select("coach_id, provider, status").in("coach_id", ids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const connected = new Set(
    ((accounts.data ?? []) as Record<string, unknown>[])
      .filter((a) => a.provider === "LINKEDIN" && a.status === "OK")
      .map((a) => String(a.coach_id))
  );
  const people = new Map(((profiles.data ?? []) as Record<string, unknown>[]).map((p) => [String(p.id), p]));
  const slugOf = new Map(((slugs.data ?? []) as Record<string, unknown>[]).map((c) => [String(c.id), (c.slug as string | null) ?? null]));
  const liveRows = new Map((live?.rows ?? []).map((r) => [r.coach_id, r]));
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
      launching: liveRows.has(row.coach_id),
      launch: launchSteps(liveRows.get(row.coach_id)),
      cards,
    });
  }

  return { coaches, pages };
}

function launchSteps(row: GettingLiveRow | undefined): BoardCoach["launch"] {
  if (!row) return null;
  const out = {} as Record<LaunchStepKey, LaunchStep>;
  for (const key of LAUNCH_EXTRA_STEPS) {
    const step = row.steps.find((s) => s.key === key);
    out[key] = { done: step?.done ?? false, source: step?.source ?? null, detail: step?.detail ?? null };
  }
  return out;
}
