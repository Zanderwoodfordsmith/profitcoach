import { ACCEPTED, INTERESTED, isProspectCall } from "@/lib/coachHealth";
import type { FunnelCounts } from "@/lib/coachFunnelStages";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Counts each coach's funnel (job 242) from what the app already records,
 * since they joined. Imported history (archived campaigns) is left out.
 * A step the app can't see yet comes back as null with why.
 */

export type FunnelCoach = { id: string; joined_at: string | null; live: boolean };

const DAY = 86_400_000;
/** Lead statuses that mean nobody was actually reached. */
const NOT_CONTACTED = ["queued", "failed", "skipped"];
const ROADMAP_CAL = /roadmap/i;

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

type Call = { coach_id: string; roadmap: boolean; at: number; outcome: "completed" | "noshow" | null };

function hasSessionNotes(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  return Object.values(v as Record<string, unknown>).some((x) => (typeof x === "string" ? x.trim() : x));
}

export async function loadCoachFunnel(coaches: FunnelCoach[]): Promise<Record<string, FunnelCounts>> {
  const ids = coaches.map((c) => c.id);
  if (!ids.length) return {};

  const [archived, leads, ghl, bookings, contacts] = await Promise.all([
    all<{ id: string }>((f, t) => supabaseAdmin.from("linkedin_campaigns").select("id").in("coach_id", ids).eq("status", "archived").order("id").range(f, t)),
    all<{ coach_id: string; campaign_id: string; status: string; interest_outcome: string | null }>((f, t) =>
      supabaseAdmin
        .from("linkedin_campaign_leads")
        .select("coach_id, campaign_id, status, interest_outcome")
        .in("coach_id", ids)
        .not("status", "in", `(${NOT_CONTACTED.join(",")})`)
        .order("id")
        .range(f, t)
    ),
    all<{ coach_id: string; calendar_name: string | null; prospect_name: string | null; start_time: string | null; status_normalized: string; coach_outcome: "completed" | "noshow" | null }>((f, t) =>
      supabaseAdmin
        .from("ghl_appointments")
        .select("coach_id, calendar_name, prospect_name, start_time, status_normalized, coach_outcome")
        .in("coach_id", ids)
        .order("id")
        .range(f, t)
    ),
    all<{ coach_id: string; kind: string | null; status: string; starts_at: string | null; prospect_name: string | null; coach_calendars: { name: string | null } | null }>((f, t) =>
      supabaseAdmin
        .from("bookings")
        .select("coach_id, kind, status, starts_at, prospect_name, coach_calendars ( name )")
        .in("coach_id", ids)
        .neq("status", "cancelled")
        .order("id")
        .range(f, t) as unknown as PromiseLike<{ data: { coach_id: string; kind: string | null; status: string; starts_at: string | null; prospect_name: string | null; coach_calendars: { name: string | null } | null }[] | null; error: { message: string } | null }>
    ),
    all<{ id: string; coach_id: string; type: string | null; prospect_status: string | null; client_joined_on: string | null; created_at: string; client_result: string | null; pillar_session_notes: unknown }>((f, t) =>
      supabaseAdmin
        .from("contacts")
        .select("id, coach_id, type, prospect_status, client_joined_on, created_at, client_result, pillar_session_notes")
        .in("coach_id", ids)
        .or("type.eq.client,prospect_status.eq.won")
        .order("id")
        .range(f, t)
    ),
  ]);

  const joinedAt = new Map(coaches.map((c) => [c.id, c.joined_at ? Date.parse(c.joined_at) : 0]));
  const sinceJoined = (coachId: string, at: number) => Number.isFinite(at) && at >= (joinedAt.get(coachId) || 0);

  // Prospect calls since they joined, from the calendar (GHL) and the app's own bookings.
  const calls: Call[] = [];
  for (const a of ghl) {
    if (a.status_normalized === "cancelled" || !isProspectCall(a.calendar_name, a.prospect_name)) continue;
    const at = a.start_time ? Date.parse(a.start_time) : NaN;
    if (!sinceJoined(a.coach_id, at)) continue;
    calls.push({ coach_id: a.coach_id, roadmap: ROADMAP_CAL.test(a.calendar_name ?? ""), at, outcome: a.coach_outcome ?? (a.status_normalized === "noshow" ? "noshow" : null) });
  }
  for (const b of bookings) {
    const name = b.coach_calendars?.name ?? b.kind ?? "";
    if (b.kind !== "discovery" && !isProspectCall(name, b.prospect_name)) continue;
    const at = b.starts_at ? Date.parse(b.starts_at) : NaN;
    if (!sinceJoined(b.coach_id, at)) continue;
    calls.push({ coach_id: b.coach_id, roadmap: ROADMAP_CAL.test(name), at, outcome: b.status === "completed" || b.status === "noshow" ? b.status : null });
  }

  // Clients won since they joined: on the client list, or Won in the pipeline.
  const won = contacts.filter((c) => sinceJoined(c.coach_id, Date.parse(c.client_joined_on ?? c.created_at)));
  const sessionContacts = new Set<string>();
  const wonIds = won.map((c) => c.id);
  for (let i = 0; i < wonIds.length; i += 300) {
    const { data } = await supabaseAdmin.from("client_coaching_sessions").select("contact_id").in("contact_id", wonIds.slice(i, i + 300));
    for (const s of data ?? []) if (s.contact_id) sessionContacts.add(s.contact_id as string);
  }

  const archivedIds = new Set(archived.map((c) => c.id));
  const now = Date.now();
  const out: Record<string, FunnelCounts> = {};
  for (const coach of coaches) {
    const myLeads = leads.filter((l) => l.coach_id === coach.id && !archivedIds.has(l.campaign_id));
    const myCalls = calls.filter((c) => c.coach_id === coach.id);
    const first = myCalls.filter((c) => !c.roadmap);
    const roadmap = myCalls.filter((c) => c.roadmap);
    const pastFirst = first.filter((c) => c.at < now);
    const pastRoadmap = roadmap.filter((c) => c.at < now);
    const myWon = won.filter((c) => c.coach_id === coach.id);
    const firstShowed = first.filter((c) => c.outcome === "completed").length;

    out[coach.id] = {
      live: { n: coach.live ? 1 : 0 },
      contacted: { n: myLeads.length },
      accepted: myLeads.filter((l) => ACCEPTED.has(l.status)).length,
      interested: { n: myLeads.filter((l) => INTERESTED.has(l.status) || l.interest_outcome === "positive").length },
      booked: { n: myCalls.length },
      first_showed:
        pastFirst.length && !pastFirst.some((c) => c.outcome)
          ? { n: null, why: "calls not marked Showed or No-show yet" }
          : { n: firstShowed },
      roadmap_showed:
        firstShowed && !roadmap.length
          ? { n: null, why: "Roadmap calls are only told apart on a calendar named roadmap" }
          : pastRoadmap.length && !pastRoadmap.some((c) => c.outcome)
            ? { n: null, why: "Roadmap calls not marked Showed or No-show yet" }
            : { n: roadmap.filter((c) => c.outcome === "completed").length },
      won: { n: myWon.length },
      started: { n: myWon.filter((c) => sessionContacts.has(c.id) || hasSessionNotes(c.pillar_session_notes)).length },
      // No client end date yet: still on the client list and added 90+ days ago.
      kept: { n: myWon.filter((c) => c.type === "client" && now - Date.parse(c.client_joined_on ?? c.created_at) >= 90 * DAY).length },
      case_study: { n: myWon.filter((c) => (c.client_result ?? "").trim()).length },
    };
  }
  return out;
}
