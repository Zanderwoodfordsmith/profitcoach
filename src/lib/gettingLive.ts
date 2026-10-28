import { isProspectCall } from "@/lib/coachHealth";
import { GETTING_LIVE_STEPS, type GettingLiveStepKey } from "@/lib/gettingLiveSteps";
import { gridCells, gridPages } from "@/lib/practiceKnowledge/blueprintGrid";
import { isBuildableSection } from "@/lib/practiceKnowledge/buildSection";
import { mapKnowledgeRow } from "@/lib/practiceKnowledge/store";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Admin → Coaches → Getting live: every coach BCA is getting live, from paying
 * to a first client. The app ticks the steps it can see; BCA ticks the rest by
 * hand (stored in coach_getting_live, with a comment thread and who is on the list).
 */

export type WaitsOn = "coach" | "bca";

export type GettingLiveStep = {
  key: GettingLiveStepKey;
  label: string;
  done: boolean;
  /** "app" when the app can see it, "hand" when ticked by hand. */
  source: "app" | "hand" | null;
  /** What the app knows, shown under the step. */
  detail: string | null;
};

export type GettingLiveRow = {
  coach_id: string;
  slug: string | null;
  name: string;
  joined_at: string | null;
  added_by_hand: boolean;
  steps: GettingLiveStep[];
  /** The first step not done, or null once they have a first client. */
  current: GettingLiveStepKey | null;
  waits_on: WaitsOn | null;
  next_action: string;
  linkedin_connected: boolean;
  open_tickets: number;
  last_active_at: string | null;
  /** The comment thread, oldest first. Notes from before comments show as the first comment. */
  comments: GettingLiveComment[];
};

export type GettingLiveReply = { id: string; by: string | null; by_name: string | null; at: string; body: string };
export type GettingLiveComment = GettingLiveReply & { edited_at?: string | null; replies: GettingLiveReply[] };

export type GettingLiveData = {
  rows: GettingLiveRow[];
  /** Coaches not on the list, for the Add coach picker. */
  others: { id: string; name: string }[];
  /** False until the coach_getting_live migration is applied: ticks are read-only. */
  storage: boolean;
  /** False until the comments migration is applied: comments are read-only. */
  comments_storage: boolean;
};

/** Everyone whose first payment falls in this many days is on the list automatically. */
export const GETTING_LIVE_DAYS = 90;
/** First paid earlier, and BCA is getting him live too. */
const ALWAYS_ON = ["1f10eb8c-542b-4f47-90ce-30ca02a0e740"]; // Peter Buglass

const PAID_STATUSES = new Set(["active", "past_due", "trialing"]);
/** Done-for-you builds a prospect list of at least this many people before the campaign. */
export const LEADS_TARGET = 1000;
/** The Blueprint section holding the Connection campaign, the messages the coach agrees before launch. */
const CONNECTION_KEY = "campaigns:messaging";
const REPLY_STATUSES = ["replied", "interested", "call_offered", "not_interested"];

type Ticks = Partial<Record<GettingLiveStepKey, { at: string; by: string | null }>>;
type StoredRow = {
  coach_id: string;
  added_by_hand: boolean;
  hidden: boolean;
  ticks: Ticks | null;
  notes: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  comments?: GettingLiveComment[] | null;
};

async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

type Page<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Every row of a big result, several pages of 1,000 at a time side by side
 * rather than one after another (counting first is slower than a spare
 * page). The query needs a stable order.
 */
async function allPages<T>(page: (from: number, to: number) => PromiseLike<Page<T>>, perBatch = 4): Promise<T[]> {
  const out: T[] = [];
  for (let start = 0; ; start += perBatch * 1000) {
    const batch = await Promise.all(Array.from({ length: perBatch }, (_, i) => page(start + i * 1000, start + i * 1000 + 999)));
    for (const r of batch) {
      if (r.error) throw new Error(r.error.message);
      out.push(...(r.data ?? []));
    }
    if ((batch[perBatch - 1].data?.length ?? 0) < 1000) return out;
  }
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /coach_getting_live/.test(error.message ?? "");
}

/** The comments column is missing (its error names the table too, so check this first). */
function isMissingComments(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || /comments/.test(error.message ?? "");
}

const STORED_COLUMNS = "coach_id, added_by_hand, hidden, ticks, notes, updated_at, updated_by";

/** The stored rows (null when the table does not exist yet), and whether the comments column exists. */
async function loadStored(coachId?: string): Promise<{ rows: StoredRow[] | null; comments: boolean }> {
  const query = (columns: string) => {
    const q = supabaseAdmin.from("coach_getting_live").select(columns);
    return coachId ? q.eq("coach_id", coachId) : q;
  };
  const first = await query(`${STORED_COLUMNS}, comments`);
  if (!first.error) return { rows: (first.data ?? []) as unknown as StoredRow[], comments: true };
  if (!isMissingComments(first.error)) {
    if (isMissingTable(first.error)) return { rows: null, comments: false };
    throw new Error(first.error.message);
  }
  const { data, error } = await query(STORED_COLUMNS);
  if (isMissingTable(error)) return { rows: null, comments: false };
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as StoredRow[], comments: false };
}

/** The thread to show: stored comments, or the old notes as a first comment until they are moved over. */
function threadFor(row: StoredRow | undefined): GettingLiveComment[] {
  if (row?.comments?.length) return row.comments;
  const notes = row?.notes?.trim();
  if (!notes) return [];
  return [
    { id: `notes-${row!.coach_id}`, by: row!.updated_by ?? null, by_name: null, at: row!.updated_at ?? new Date(0).toISOString(), body: notes, replies: [] },
  ];
}

function day(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** The written sections BCA produces, on pages coaches see. */
function writtenSectionKeys(): string[] {
  const keys: string[] = [];
  for (const page of gridPages()) {
    for (const ref of page.sections) {
      if (ref.section.source === "we_build" && isBuildableSection(ref.key)) keys.push(ref.key);
    }
  }
  return keys;
}

/** Who the step waits on, and the one thing to do next. */
function nextFor(
  step: GettingLiveStepKey,
  ctx: { aboutYou: number; written: number; total: number; linkedinConnected: boolean; linkedinDraftAt: string | null; leads: number; readyCampaign: { name: string; queued: number } | null }
): { waits_on: WaitsOn; next_action: string } {
  const connectFirst = !ctx.linkedinConnected;
  switch (step) {
    case "paid":
      return { waits_on: "coach", next_action: "Check the payment came in, then tick Paid." };
    case "about_you":
      return {
        waits_on: "coach",
        next_action: `Finish About You (${ctx.aboutYou}% done)${connectFirst ? " and connect LinkedIn" : ""}.`,
      };
    case "blueprint_call":
      return { waits_on: "bca", next_action: "Book and run the Blueprint call." };
    case "blueprint_written":
      return { waits_on: "bca", next_action: `Write the Blueprint: ${ctx.written} of ${ctx.total} sections written.` };
    case "signed_off":
      return {
        waits_on: "coach",
        next_action: "Agree their LinkedIn profile and the first messages of the Connection campaign.",
      };
    case "linkedin_updated":
      return {
        waits_on: "bca",
        next_action: ctx.linkedinDraftAt
          ? `Put the LinkedIn draft (${day(ctx.linkedinDraftAt)}) on their profile.`
          : "Write the LinkedIn rewrite.",
      };
    case "leads_found":
      return {
        waits_on: "bca",
        next_action: `Build a prospect list of ${LEADS_TARGET.toLocaleString("en-GB")} people (${ctx.leads.toLocaleString("en-GB")} so far).`,
      };
    case "campaign_set_up":
      if (connectFirst) return { waits_on: "coach", next_action: "Connect LinkedIn so we can write the campaign." };
      return { waits_on: "bca", next_action: "Write the first campaign: people and messages." };
    case "campaign_live":
      if (connectFirst) return { waits_on: "coach", next_action: "Connect LinkedIn so the campaign can send." };
      return {
        waits_on: "bca",
        next_action: ctx.readyCampaign
          ? `Turn on ${ctx.readyCampaign.name} (${ctx.readyCampaign.queued} people ready).`
          : "Turn the campaign on.",
      };
    case "first_reply":
      return { waits_on: "bca", next_action: "Check it is sending, who accepts, and the first message." };
    case "first_call":
      return { waits_on: "coach", next_action: "Reply fast to interested people and offer two times." };
    case "first_client":
      return { waits_on: "coach", next_action: "Follow up each call with the next step to a first client." };
  }
}

/** Everything the steps need for these coaches, side by side. */
function loadDetails(ids: string[]) {
  return Promise.all([
    allPages<{ coach_id: string; paid_at: string }>((f, t) =>
      supabaseAdmin
        .from("coach_payments")
        .select("coach_id, paid_at")
        .eq("status", "succeeded")
        .in("coach_id", ids)
        .not("paid_at", "is", null)
        .order("id")
        .range(f, t)
    ),
    all<{ id: string; slug: string | null; membership_status: string | null; membership_started_at: string | null }>((f, t) =>
      supabaseAdmin.from("coaches").select("id, slug, membership_status, membership_started_at").in("id", ids).range(f, t)
    ),
    // Everything but the long call report, which the steps don't read.
    all<Record<string, unknown>>((f, t) =>
      supabaseAdmin
        .from("coach_practice_knowledge")
        .select(
          "coach_id, status, payload, linkedin_seeded_at, form_completed_at, interview_completed_at, coach_reviewed_at, admin_reviewed_at, completeness_score, missing_fields, built_sections, created_at, updated_at"
        )
        .in("coach_id", ids)
        .range(f, t)
    ),
    all<{ coach_id: string; optimizer_rewritten_at: string | null }>((f, t) =>
      supabaseAdmin.from("coach_linkedin_profiles").select("coach_id, optimizer_rewritten_at").in("coach_id", ids).range(f, t)
    ),
    all<{ coach_id: string; provider: string; status: string }>((f, t) =>
      supabaseAdmin.from("linkedin_outreach_accounts").select("coach_id, provider, status").in("coach_id", ids).range(f, t)
    ),
    all<{ id: string; coach_id: string; name: string; status: string; created_at: string; updated_at: string }>((f, t) =>
      supabaseAdmin.from("linkedin_campaigns").select("id, coach_id, name, status, created_at, updated_at").in("coach_id", ids).range(f, t)
    ),
    allPages<{ campaign_id: string; coach_id: string; status: string; interest_outcome: string | null }>((f, t) =>
      supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("campaign_id, coach_id, status, interest_outcome")
        .in("coach_id", ids)
        .order("id")
        .range(f, t)
    ),
    all<{ coach_id: string; kind: string | null; prospect_name: string | null }>((f, t) =>
      supabaseAdmin.from("bookings").select("coach_id, kind, prospect_name").in("coach_id", ids).neq("status", "cancelled").range(f, t)
    ),
    all<{ coach_id: string; calendar_name: string | null; prospect_name: string | null }>((f, t) =>
      supabaseAdmin.from("ghl_appointments").select("coach_id, calendar_name, prospect_name").in("coach_id", ids).range(f, t)
    ),
    all<{ coach_id: string; client_joined_on: string | null }>((f, t) =>
      supabaseAdmin.from("contacts").select("coach_id, client_joined_on").in("coach_id", ids).eq("type", "client").range(f, t)
    ),
    all<{ created_by: string }>((f, t) =>
      supabaseAdmin.from("community_feedback_reports").select("created_by").in("created_by", ids).neq("status", "resolved").range(f, t)
    ),
    // Only the latest session per coach is shown.
    Promise.all(
      ids.map((id) =>
        supabaseAdmin
          .from("app_usage_sessions")
          .select("user_id, last_activity_at")
          .eq("user_id", id)
          .not("last_activity_at", "is", null)
          .order("last_activity_at", { ascending: false })
          .limit(1)
          .then(({ data, error }) => {
            if (error) throw new Error(error.message);
            return (data ?? []) as { user_id: string; last_activity_at: string | null }[];
          })
      )
    ).then((r) => r.flat()),
    // Unique people across a coach's lead lists: the same person on two lists counts once.
    allPages<{ coach_id: string; linkedin_url: string | null; full_name: string | null; first_name: string | null; last_name: string | null; company: string | null }>((f, t) =>
      supabaseAdmin
        .from("coach_lead_list_items")
        .select("coach_id, linkedin_url, full_name, first_name, last_name, company")
        .in("coach_id", ids)
        .order("id")
        .range(f, t),
      8
    ),
  ]);
}

/**
 * Everyone on the list, or (with coachId) just that coach for their own
 * Getting live tab. A coach who isn't on the list comes back with no row.
 */
export async function loadGettingLive(opts: { coachId?: string } = {}): Promise<GettingLiveData> {
  const one = opts.coachId;
  const since = new Date(Date.now() - GETTING_LIVE_DAYS * 86_400_000).toISOString();
  // One coach: we already know who, so fetch their details alongside the list check.
  const early = one ? loadDetails([one]) : null;
  early?.catch(() => {}); // Not on the list, or the first step fails: don't leave it unhandled.
  const [{ rows: stored, comments: commentsStorage }, coachProfiles, recentPayers, earlierPayers] = await Promise.all([
    loadStored(one),
    one
      ? supabaseAdmin
          .from("profiles")
          .select("id, full_name, created_at, access_removed_at")
          .eq("id", one)
          .then(({ data, error }) => {
            if (error) throw new Error(error.message);
            return (data ?? []) as { id: string; full_name: string | null; created_at: string; access_removed_at: string | null }[];
          })
      : all<{ id: string; full_name: string | null; created_at: string; access_removed_at: string | null }>((f, t) =>
          supabaseAdmin.from("profiles").select("id, full_name, created_at, access_removed_at").eq("role", "coach").range(f, t)
        ),
    // First paid in the window = paid in it, and not before it.
    all<{ coach_id: string }>((f, t) => {
      const q = supabaseAdmin.from("coach_payments").select("coach_id").eq("status", "succeeded").gte("paid_at", since);
      return (one ? q.eq("coach_id", one) : q.not("coach_id", "is", null)).order("id").range(f, t);
    }),
    allPages<{ coach_id: string }>((f, t) => {
      const q = supabaseAdmin.from("coach_payments").select("coach_id").eq("status", "succeeded").lt("paid_at", since);
      return (one ? q.eq("coach_id", one) : q.not("coach_id", "is", null)).order("id").range(f, t);
    }),
  ]);
  const storage = stored !== null;
  const byCoach = new Map((stored ?? []).map((s) => [s.coach_id, s]));
  const people = coachProfiles.filter((p) => !p.access_removed_at);
  const paidBefore = new Set(earlierPayers.map((p) => p.coach_id));
  const firstPaidInWindow = new Set(recentPayers.map((p) => p.coach_id).filter((id) => !paidBefore.has(id)));

  // On the list: first paid in the window, always on, or added by hand. Taken off stays off.
  const onList = people.filter((p) => {
    const s = byCoach.get(p.id);
    if (s?.hidden) return false;
    return firstPaidInWindow.has(p.id) || ALWAYS_ON.includes(p.id) || Boolean(s?.added_by_hand);
  });
  const ids = onList.map((p) => p.id);
  const onIds = new Set(ids);
  const others = one
    ? []
    : people
        .filter((p) => !onIds.has(p.id))
        .map((p) => ({ id: p.id, name: p.full_name?.trim() || "Coach" }))
        .sort((a, b) => a.name.localeCompare(b.name));
  if (!ids.length) return { rows: [], others, storage, comments_storage: commentsStorage };

  const [payments, coaches, knowledge, linkedinProfiles, accounts, campaigns, leads, bookings, ghl, clients, tickets, sessions, listItems] = await (early ?? loadDetails(ids));

  const firstPaid = new Map<string, string>();
  for (const p of payments) if (!firstPaid.has(p.coach_id) || p.paid_at < firstPaid.get(p.coach_id)!) firstPaid.set(p.coach_id, p.paid_at);

  const coachById = new Map(coaches.map((c) => [c.id, c]));
  const rows = new Map(knowledge.map((raw) => [String(raw.coach_id), mapKnowledgeRow(raw)]));
  const draftAt = new Map(linkedinProfiles.map((l) => [l.coach_id, l.optimizer_rewritten_at]));
  const connected = new Set(accounts.filter((a) => a.provider === "LINKEDIN" && a.status === "OK").map((a) => a.coach_id));
  const leadsByCampaign = new Map<string, { total: number; queued: number }>();
  const replied = new Set<string>();
  for (const l of leads) {
    const n = leadsByCampaign.get(l.campaign_id) ?? { total: 0, queued: 0 };
    n.total += 1;
    if (l.status === "queued") n.queued += 1;
    leadsByCampaign.set(l.campaign_id, n);
    if (REPLY_STATUSES.includes(l.status) || l.interest_outcome) replied.add(l.coach_id);
  }
  const called = new Set<string>();
  for (const b of bookings) if (b.kind === "discovery" && !/demo|test/i.test(b.prospect_name ?? "")) called.add(b.coach_id);
  for (const a of ghl) if (isProspectCall(a.calendar_name, a.prospect_name)) called.add(a.coach_id);
  const withClient = new Set(clients.map((c) => c.coach_id));
  const ticketCount = new Map<string, number>();
  for (const t of tickets) ticketCount.set(t.created_by, (ticketCount.get(t.created_by) ?? 0) + 1);
  const lastActive = new Map<string, string>();
  for (const s of sessions) {
    if (s.last_activity_at && s.last_activity_at > (lastActive.get(s.user_id) ?? "")) lastActive.set(s.user_id, s.last_activity_at);
  }
  const writtenKeys = writtenSectionKeys();
  const uniquePeople = new Map<string, Set<string>>();
  for (const item of listItems) {
    const url = item.linkedin_url?.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
    const name = (item.full_name || [item.first_name, item.last_name].filter(Boolean).join(" ")).trim().toLowerCase();
    const key = url || (name ? `${name}|${(item.company ?? "").trim().toLowerCase()}` : "");
    if (!key) continue;
    const set = uniquePeople.get(item.coach_id) ?? new Set<string>();
    set.add(key);
    uniquePeople.set(item.coach_id, set);
  }

  const out: GettingLiveRow[] = onList.map((person) => {
    const coach = coachById.get(person.id);
    const knowledgeRow = rows.get(person.id);
    const ticks = byCoach.get(person.id)?.ticks ?? {};
    const linkedinConnected = connected.has(person.id);

    const aboutYou = knowledgeRow?.completeness_score ?? 0;
    const written = knowledgeRow ? writtenKeys.filter((k) => knowledgeRow.built_sections[k]).length : 0;
    // The coach only agrees what goes out in their name: the Connection campaign's messages (and the LinkedIn profile, ticked by hand).
    const connection = knowledgeRow ? gridCells(knowledgeRow)[CONNECTION_KEY] : undefined;
    const connectionAgreed = connection?.status === "done";

    const mine = campaigns.filter((c) => c.coach_id === person.id && c.status !== "archived");
    const isSetUp = (c: (typeof mine)[number]) =>
      (leadsByCampaign.get(c.id)?.total ?? 0) > 0 || Date.parse(c.updated_at) - Date.parse(c.created_at) > 60_000;
    const setUp = mine.filter(isSetUp);
    const running = mine.filter((c) => c.status === "running");
    const ready = setUp
      .filter((c) => c.status !== "running")
      .map((c) => ({ name: c.name, queued: leadsByCampaign.get(c.id)?.queued ?? 0 }))
      .sort((a, b) => b.queued - a.queued)[0] ?? null;
    const leadCount = uniquePeople.get(person.id)?.size ?? 0;

    const auto: Record<GettingLiveStepKey, { done: boolean; detail: string | null }> = {
      paid: {
        done: PAID_STATUSES.has(coach?.membership_status ?? "") || firstPaid.has(person.id),
        detail: coach?.membership_started_at
          ? `Started ${day(coach.membership_started_at)}`
          : firstPaid.has(person.id)
            ? `First paid ${new Date(firstPaid.get(person.id)!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
            : null,
      },
      about_you: { done: aboutYou >= 100, detail: knowledgeRow ? `${aboutYou}% done` : "Not started" },
      blueprint_call: {
        done: Boolean(knowledgeRow?.interview_completed_at),
        detail: knowledgeRow?.interview_completed_at ? `Held ${day(knowledgeRow.interview_completed_at)}` : null,
      },
      blueprint_written: {
        done: writtenKeys.length > 0 && written >= writtenKeys.length,
        detail: `${written} of ${writtenKeys.length} sections written`,
      },
      signed_off: {
        done: connectionAgreed,
        detail: connectionAgreed ? "Connection campaign agreed" : connection ? "Connection campaign not agreed yet" : null,
      },
      linkedin_updated: {
        done: false,
        detail: draftAt.get(person.id) ? `Draft written ${day(draftAt.get(person.id))}` : "No draft yet",
      },
      leads_found: {
        done: leadCount >= LEADS_TARGET,
        detail: `${leadCount.toLocaleString("en-GB")} of ${LEADS_TARGET.toLocaleString("en-GB")}`,
      },
      campaign_set_up: {
        done: setUp.length > 0,
        detail: setUp.length ? setUp.map((c) => `${c.name} (${leadsByCampaign.get(c.id)?.total ?? 0} people)`).join(", ") : null,
      },
      campaign_live: { done: running.length > 0, detail: running.length ? running.map((c) => c.name).join(", ") : null },
      first_reply: { done: replied.has(person.id), detail: null },
      first_call: { done: called.has(person.id), detail: null },
      first_client: { done: withClient.has(person.id), detail: null },
    };

    const steps: GettingLiveStep[] = GETTING_LIVE_STEPS.map(({ key, label }) => {
      const hand = Boolean(ticks[key]);
      const app = auto[key].done;
      return {
        key,
        label,
        done: app || hand,
        source: app ? "app" : hand ? "hand" : null,
        detail: hand && !app ? `Ticked ${day(ticks[key]?.at)}` : auto[key].detail,
      };
    });
    const current = steps.find((s) => !s.done)?.key ?? null;
    const next = current
      ? nextFor(current, {
          aboutYou,
          written,
          total: writtenKeys.length,
          linkedinConnected,
          linkedinDraftAt: draftAt.get(person.id) ?? null,
          leads: leadCount,
          readyCampaign: ready,
        })
      : { waits_on: null, next_action: "Live, with a first client." };

    return {
      coach_id: person.id,
      slug: coach?.slug ?? null,
      name: person.full_name?.trim() || "Coach",
      joined_at: coach?.membership_started_at ?? person.created_at,
      added_by_hand: Boolean(byCoach.get(person.id)?.added_by_hand),
      steps,
      current,
      waits_on: next.waits_on,
      next_action: next.next_action,
      linkedin_connected: linkedinConnected,
      open_tickets: ticketCount.get(person.id) ?? 0,
      last_active_at: lastActive.get(person.id) ?? null,
      comments: threadFor(byCoach.get(person.id)),
    };
  });

  // Furthest behind first, then the newest joiners.
  const order = (r: GettingLiveRow) => (r.current ? GETTING_LIVE_STEPS.findIndex((s) => s.key === r.current) : GETTING_LIVE_STEPS.length);
  out.sort((a, b) => order(a) - order(b) || (b.joined_at ?? "").localeCompare(a.joined_at ?? ""));
  // Names for comments written before by_name was stored (e.g. the old notes).
  const nameless = new Set<string>();
  for (const r of out) for (const c of r.comments) for (const x of [c, ...c.replies]) if (x.by && !x.by_name) nameless.add(x.by);
  if (nameless.size) {
    const { data: names } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", [...nameless]);
    const nameOf = new Map((names ?? []).map((n) => [n.id as string, (n.full_name as string | null) ?? null]));
    for (const r of out)
      for (const c of r.comments) {
        if (c.by && !c.by_name) c.by_name = nameOf.get(c.by) ?? null;
        for (const x of c.replies) if (x.by && !x.by_name) x.by_name = nameOf.get(x.by) ?? null;
      }
  }

  return { rows: out, others, storage, comments_storage: commentsStorage };
}

export type GettingLiveUpdate = {
  coach_id: string;
  tick?: { step: GettingLiveStepKey; on: boolean };
  /** The whole thread after an add, edit, reply or delete, as the comments panel hands it back. */
  comments?: GettingLiveComment[];
  hidden?: boolean;
  add?: boolean;
};

export type GettingLiveSaveResult = "ok" | "no_table" | "no_comments";

/**
 * The thread to store. Comments and replies already saved keep their author;
 * new ones get the admin posting them, so a name can't be put in someone's mouth.
 */
function mergeComments(next: GettingLiveComment[], before: GettingLiveComment[], adminId: string, adminName: string | null): GettingLiveComment[] {
  const known = new Map<string, GettingLiveReply>();
  for (const c of before) {
    known.set(c.id, c);
    for (const r of c.replies ?? []) known.set(r.id, r);
  }
  const now = new Date().toISOString();
  const author = (id: string) => {
    const old = known.get(id);
    return old ? { by: old.by, by_name: old.by_name, at: old.at } : { by: adminId, by_name: adminName, at: now };
  };
  return next
    .filter((c) => c && typeof c.id === "string" && typeof c.body === "string" && c.body.trim())
    .slice(0, 500)
    .map((c) => ({
      id: c.id,
      ...author(c.id),
      body: c.body.slice(0, 4000),
      edited_at: c.edited_at ?? null,
      replies: (Array.isArray(c.replies) ? c.replies : [])
        .filter((r) => r && typeof r.id === "string" && typeof r.body === "string" && r.body.trim())
        .map((r) => ({ id: r.id, ...author(r.id), body: r.body.slice(0, 4000) })),
    }));
}

/** One change from the page. Says when the table or the comments column does not exist yet. */
export async function saveGettingLive(update: GettingLiveUpdate, adminId: string): Promise<GettingLiveSaveResult> {
  let hasComments = true;
  let { data: existing, error } = await supabaseAdmin
    .from("coach_getting_live")
    .select(`${STORED_COLUMNS}, comments`)
    .eq("coach_id", update.coach_id)
    .maybeSingle();
  if (error && isMissingComments(error)) {
    hasComments = false;
    ({ data: existing, error } = await supabaseAdmin.from("coach_getting_live").select(STORED_COLUMNS).eq("coach_id", update.coach_id).maybeSingle());
  }
  if (isMissingTable(error)) return "no_table";
  if (error) throw new Error(error.message);
  if (update.comments && !hasComments) return "no_comments";

  const row = (existing as StoredRow | null) ?? { coach_id: update.coach_id, added_by_hand: false, hidden: false, ticks: {}, notes: "" };
  const ticks: Ticks = { ...(row.ticks ?? {}) };
  if (update.tick) {
    if (update.tick.on) ticks[update.tick.step] = { at: new Date().toISOString(), by: adminId };
    else delete ticks[update.tick.step];
  }
  let comments: GettingLiveComment[] | undefined;
  if (update.comments) {
    const { data: me } = await supabaseAdmin.from("profiles").select("full_name").eq("id", adminId).maybeSingle();
    comments = mergeComments(update.comments, threadFor(row), adminId, (me?.full_name as string | null) ?? null);
  }
  const { error: saveError } = await supabaseAdmin.from("coach_getting_live").upsert({
    coach_id: update.coach_id,
    added_by_hand: update.add ? true : row.added_by_hand,
    hidden: update.add ? false : (update.hidden ?? row.hidden),
    ticks,
    notes: row.notes ?? "",
    ...(comments ? { comments } : {}),
    updated_at: new Date().toISOString(),
    updated_by: adminId,
  });
  if (saveError) throw new Error(saveError.message);
  return "ok";
}
