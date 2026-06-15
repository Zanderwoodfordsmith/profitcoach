import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { LandingEventType } from "@/lib/landingAnalytics";

export type LandingStatKind = Exclude<LandingEventType, "view">;

export type LandingActor = {
  id: string;
  full_name: string | null;
  business_name: string | null;
  email: string | null;
};

type ContactRow = {
  id: string;
  full_name: string | null;
  business_name: string | null;
  email: string | null;
  created_at: string;
};

type LandingEventActorRow = {
  contact_id: string | null;
  assessment_id: string | null;
  created_at: string;
};

/** How far before an opt-in/start event we still match a newly created contact. */
const ORPHAN_EVENT_MATCH_MS = 20 * 60 * 1000;

function toActor(row: ContactRow): LandingActor {
  return {
    id: row.id,
    full_name: row.full_name,
    business_name: row.business_name,
    email: row.email,
  };
}

function applyDateFilters<T extends { gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(
  query: T,
  from: string | null,
  to: string | null
): T {
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  return query;
}

async function loadContactsByIds(ids: string[]): Promise<Map<string, LandingActor>> {
  if (ids.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("id, full_name, business_name, email")
    .in("id", ids);

  if (error) {
    console.error("landing actors contacts:", error.message);
    return new Map();
  }

  return new Map(
    ((data ?? []) as ContactRow[]).map((row) => [row.id, toActor(row)])
  );
}

async function loadAssessmentContactMap(
  assessmentIds: string[]
): Promise<Map<string, string>> {
  if (assessmentIds.length === 0) return new Map();

  const { data: assessments } = await supabaseAdmin
    .from("assessments")
    .select("id, contact_id")
    .in("id", assessmentIds);

  const map = new Map<string, string>();
  for (const row of assessments ?? []) {
    const assessmentId = row.id as string;
    const contactId = row.contact_id as string | null;
    if (contactId) map.set(assessmentId, contactId);
  }
  return map;
}

async function loadLandingEventsForKind(
  coachSlug: string,
  eventType: LandingStatKind,
  from: string | null,
  to: string | null
): Promise<LandingEventActorRow[]> {
  let query = supabaseAdmin
    .from("landing_events")
    .select("contact_id, assessment_id, created_at")
    .eq("coach_slug", coachSlug)
    .eq("event_type", eventType)
    .order("created_at", { ascending: false });

  query = applyDateFilters(query, from, to);

  const { data: events, error } = await query;
  if (error) {
    console.error("landing actors events:", error.message);
    return [];
  }

  return (events ?? []) as LandingEventActorRow[];
}

function contactIdsFromResolvedEvents(
  rows: LandingEventActorRow[],
  assessmentContactById: Map<string, string>
): { resolved: { id: string; at: string }[]; orphanEvents: LandingEventActorRow[] } {
  const resolved: { id: string; at: string }[] = [];
  const orphanEvents: LandingEventActorRow[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const contactId =
      row.contact_id ??
      (row.assessment_id ? assessmentContactById.get(row.assessment_id) : null);

    if (!contactId) {
      orphanEvents.push(row);
      continue;
    }
    if (seen.has(contactId)) continue;
    seen.add(contactId);
    resolved.push({ id: contactId, at: row.created_at });
  }

  return { resolved, orphanEvents };
}

async function loadContactsForOrphanMatching(
  coachId: string,
  from: string | null,
  to: string | null
): Promise<ContactRow[]> {
  let query = supabaseAdmin
    .from("contacts")
    .select("id, full_name, business_name, email, created_at")
    .eq("coach_id", coachId)
    .not("email", "is", null)
    .order("created_at", { ascending: false });

  query = applyDateFilters(query, from, to);

  const { data: contacts, error } = await query;
  if (error) {
    console.error("landing actors orphan-match contacts:", error.message);
    return [];
  }

  return (contacts ?? []) as ContactRow[];
}

function correlateOrphanEventsToContacts(
  orphanEvents: LandingEventActorRow[],
  contacts: ContactRow[],
  alreadySeen: Set<string>
): { id: string; at: string }[] {
  const matched: { id: string; at: string }[] = [];
  const usedContacts = new Set(alreadySeen);

  for (const event of orphanEvents) {
    const eventAt = Date.parse(event.created_at);
    if (Number.isNaN(eventAt)) continue;

    let best: ContactRow | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;

    for (const contact of contacts) {
      if (usedContacts.has(contact.id)) continue;
      const contactAt = Date.parse(contact.created_at);
      if (Number.isNaN(contactAt)) continue;
      if (contactAt > eventAt) continue;

      const delta = eventAt - contactAt;
      if (delta > ORPHAN_EVENT_MATCH_MS) continue;
      if (delta < bestDelta) {
        bestDelta = delta;
        best = contact;
      }
    }

    if (!best) continue;
    usedContacts.add(best.id);
    matched.push({ id: best.id, at: event.created_at });
  }

  return matched;
}

function mergeOrderedContactIds(
  sources: { id: string; at: string }[][]
): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    for (const row of source) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      ordered.push(row.id);
    }
  }

  return ordered;
}

export async function resolveLandingStatContactIds(
  coachSlug: string,
  coachId: string,
  kind: LandingStatKind,
  from?: string | null,
  to?: string | null
): Promise<string[]> {
  const fromVal = from?.trim() || null;
  const toVal = to?.trim() || null;

  const rows = await loadLandingEventsForKind(coachSlug, kind, fromVal, toVal);
  const assessmentContactById = await loadAssessmentContactMap(
    rows.map((row) => row.assessment_id).filter((id): id is string => Boolean(id))
  );

  const { resolved, orphanEvents } = contactIdsFromResolvedEvents(
    rows,
    assessmentContactById
  );

  const seen = new Set(resolved.map((row) => row.id));
  const funnelContacts =
    kind === "finish"
      ? []
      : await loadContactsForOrphanMatching(coachId, fromVal, toVal);

  const fromOrphans =
    kind === "finish"
      ? []
      : correlateOrphanEventsToContacts(orphanEvents, funnelContacts, seen);

  return mergeOrderedContactIds([resolved, fromOrphans]);
}

export async function loadLandingStatActors(
  coachSlug: string,
  coachId: string,
  kind: LandingStatKind,
  from?: string | null,
  to?: string | null
): Promise<LandingActor[]> {
  const contactIds = await resolveLandingStatContactIds(
    coachSlug,
    coachId,
    kind,
    from,
    to
  );

  if (contactIds.length === 0) return [];

  const byId = await loadContactsByIds(contactIds);
  return contactIds
    .map((id) => byId.get(id))
    .filter((actor): actor is LandingActor => Boolean(actor));
}

export async function countLandingStatActors(
  coachSlug: string,
  coachId: string,
  kind: LandingStatKind,
  from?: string | null,
  to?: string | null
): Promise<number> {
  const ids = await resolveLandingStatContactIds(
    coachSlug,
    coachId,
    kind,
    from,
    to
  );
  return ids.length;
}
