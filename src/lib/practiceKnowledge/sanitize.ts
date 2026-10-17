import { randomUUID } from "crypto";

import { asVoiceTone } from "./voiceTone";
import type {
  CareerResult,
  ClientResultStory,
  ClientStuckRow,
  ClientTrustRow,
  DecisionRecordPayload,
  DeliveryFormat,
  DeliveryModel,
  GeographyPref,
  IntakeAssetKind,
  KnowledgeSource,
  NotificationChannel,
  PracticeKnowledgePayload,
  PracticeNote,
  PracticeStatus,
  SectionStatusEvent,
  ProofType,
  Sourced,
} from "./types";
import {
  ASSET_KINDS,
  DELIVERY_FORMATS,
  DELIVERY_MODELS,
  GEOGRAPHY_PREFS,
  GUARANTEE_TYPES,
  LINKEDIN_VISIBILITIES,
  OFFER_OUTCOMES,
  NEWSLETTER_CADENCES,
  NOTIFICATION_CHANNELS,
  PRACTICE_KNOWLEDGE_SOURCES,
  PRACTICE_STATUSES,
  PROOF_TYPES,
} from "./types";

const TEXT = 2000;
const SHORT = 240;
const LIST = 20;
const RESULTS = 12;

function clip(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function asSource(value: unknown, fallback: KnowledgeSource): KnowledgeSource {
  return (PRACTICE_KNOWLEDGE_SOURCES as readonly string[]).includes(
    String(value)
  )
    ? (value as KnowledgeSource)
    : fallback;
}

function asSourced<T>(
  raw: unknown,
  map: (value: unknown) => T | null,
  fallback: KnowledgeSource
): Sourced<T> | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as { value?: unknown; source?: unknown; updated_at?: unknown };
  const source = asSource(rec.source, fallback);
  // A coach or admin who empties a text box means it: keep the empty answer so the old one is cleared.
  const cleared = rec.value === "" && (source === "coach_edit" || source === "admin");
  const value = cleared ? ("" as T) : map(rec.value);
  if (value == null) return null;
  return {
    value,
    source,
    updated_at:
      typeof rec.updated_at === "string" && rec.updated_at
        ? rec.updated_at
        : new Date().toISOString(),
  };
}

function asStringList(value: unknown): string[] | null {
  const raw = Array.isArray(value) ? value : String(value ?? "").split(/\n+/);
  const list = raw
    .map((v) => clip(v, SHORT))
    .filter(Boolean)
    .slice(0, LIST);
  return list.length ? list : null;
}

function asProofType(value: unknown): ProofType {
  return (PROOF_TYPES as readonly string[]).includes(String(value))
    ? (value as ProofType)
    : "career";
}

function asCareerResults(value: unknown): CareerResult[] | null {
  if (!Array.isArray(value)) return null;
  const rows: CareerResult[] = [];
  for (const item of value.slice(0, RESULTS)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    rows.push({
      id: clip(r.id, 64) || randomUUID(),
      company: clip(r.company, SHORT),
      role: clip(r.role, SHORT),
      metric_from: clip(r.metric_from, SHORT),
      metric_to: clip(r.metric_to, SHORT),
      timeframe: clip(r.timeframe, SHORT),
      mechanism: clip(r.mechanism, TEXT),
      proof_type: asProofType(r.proof_type),
      precise: Boolean(r.precise),
    });
  }
  return rows.length ? rows : null;
}

function asStuckRows(value: unknown): ClientStuckRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows: ClientStuckRow[] = [];
  for (const item of value.slice(0, 12)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const problem = clip(r.problem, SHORT);
    const consequence = clip(r.consequence, SHORT);
    const awake = clip(r.awake, SHORT);
    if (!problem && !consequence && !awake) continue;
    rows.push({
      id: clip(r.id, 64) || randomUUID(),
      problem,
      consequence,
      awake,
    });
  }
  return rows;
}

function asTrustRows(value: unknown): ClientTrustRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows: ClientTrustRow[] = [];
  for (const item of value.slice(0, 12)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const authority = clip(r.authority, SHORT);
    const social_proof = clip(r.social_proof, SHORT);
    const scarcity = clip(r.scarcity, SHORT);
    if (!authority && !social_proof && !scarcity) continue;
    rows.push({
      id: clip(r.id, 64) || randomUUID(),
      authority,
      social_proof,
      scarcity,
    });
  }
  return rows;
}

function asNotes(value: unknown): PracticeNote[] | null {
  if (!Array.isArray(value)) return null;
  const rows: PracticeNote[] = [];
  for (const item of value.slice(0, 80)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const body = clip(rec.body, TEXT);
    const page = clip(rec.page, 40);
    if (!body || !page) continue;
    const section = clip(rec.section, 80);
    rows.push({
      id: clip(rec.id, 64) || randomUUID(),
      body,
      at: clip(rec.at, 40) || new Date().toISOString(),
      page,
      ...(section ? { section } : {}),
    });
  }
  return rows;
}

const STATUS_IDS = new Set(["todo", "review", "done"]);

function asStatusLog(value: unknown): SectionStatusEvent[] | null {
  if (!Array.isArray(value)) return null;
  const out: SectionStatusEvent[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const event = row as Partial<SectionStatusEvent>;
    if (
      typeof event.id !== "string" ||
      typeof event.section !== "string" ||
      typeof event.at !== "string" ||
      typeof event.actor_id !== "string" ||
      typeof event.actor_name !== "string" ||
      (event.actor_side !== "coach" && event.actor_side !== "bca") ||
      !STATUS_IDS.has(event.from ?? "") ||
      !STATUS_IDS.has(event.to ?? "") ||
      event.from === event.to
    ) {
      continue;
    }
    out.push({
      id: clip(event.id, 80),
      section: clip(event.section, 80),
      from: event.from as SectionStatusEvent["from"],
      to: event.to as SectionStatusEvent["to"],
      at: clip(event.at, 40),
      actor_id: clip(event.actor_id, 80),
      actor_name: clip(event.actor_name, 80),
      actor_side: event.actor_side,
    });
  }
  return out.length ? out.slice(-200) : null;
}

function asStampMap(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, stamp] of Object.entries(value).slice(0, 80)) {
    const name = clip(key, 80);
    const at = clip(stamp, 40);
    if (!name || !at) continue;
    out[name] = at;
  }
  return out;
}

function asClientResults(value: unknown): ClientResultStory[] | null {
  if (!Array.isArray(value)) return null;
  const rows: ClientResultStory[] = [];
  for (const item of value.slice(0, RESULTS)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const title = clip(r.title, SHORT);
    const story = clip(r.story, TEXT);
    if (!title && !story) continue;
    rows.push({
      id: clip(r.id, 64) || randomUUID(),
      title,
      story,
    });
  }
  return rows.length ? rows : null;
}

function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}

export function sanitizePayloadPatch(
  raw: unknown,
  fallback: KnowledgeSource
): Partial<PracticeKnowledgePayload> {
  if (!raw || typeof raw !== "object") return {};
  const rec = raw as Record<string, unknown>;
  const identity = rec.identity as Record<string, unknown> | undefined;
  const working = rec.working_times as Record<string, unknown> | undefined;
  const practice = rec.practice as Record<string, unknown> | undefined;
  const market = rec.market as Record<string, unknown> | undefined;
  const client = rec.client as Record<string, unknown> | undefined;
  const proof = rec.proof as Record<string, unknown> | undefined;
  const review = rec.review as Record<string, unknown> | undefined;

  const patch: Partial<PracticeKnowledgePayload> = {};

  if (identity) {
    patch.identity = {
      phone: asSourced(identity.phone, (v) => clip(v, 40) || null, fallback),
      whatsapp: asSourced(identity.whatsapp, (v) => clip(v, 40) || null, fallback),
      website: asSourced(identity.website, (v) => clip(v, 400) || null, fallback),
      timezone: asSourced(identity.timezone, (v) => clip(v, 80) || null, fallback),
      location: asSourced(identity.location, (v) => clip(v, SHORT) || null, fallback),
      address: asSourced(identity.address, (v) => clip(v, SHORT) || null, fallback),
      address_line2: asSourced(identity.address_line2, (v) => clip(v, SHORT) || null, fallback),
      postcode: asSourced(identity.postcode, (v) => clip(v, 20) || null, fallback),
      country: asSourced(identity.country, (v) => clip(v, 80) || null, fallback),
      linkedin_url: asSourced(
        identity.linkedin_url,
        (v) => clip(v, 400) || null,
        fallback
      ),
      web_address: asSourced(identity.web_address, (v) => clip(v, SHORT) || null, fallback),
      practice_email: asSourced(identity.practice_email, (v) => clip(v, SHORT) || null, fallback),
      linkedin_visibility: asSourced(
        identity.linkedin_visibility,
        (v) => pickEnum(v, LINKEDIN_VISIBILITIES),
        fallback
      ),
      linkedin_headline: asSourced(identity.linkedin_headline, (v) => clip(v, 400) || null, fallback),
      linkedin_about: asSourced(identity.linkedin_about, (v) => clip(v, 3000) || null, fallback),
    };
  }
  if (working) {
    patch.working_times = {
      hours_per_week: asSourced(
        working.hours_per_week,
        (v) => clip(v, 40) || null,
        fallback
      ),
      preferred_hours: asSourced(
        working.preferred_hours,
        (v) => clip(v, SHORT) || null,
        fallback
      ),
      prospect_call_hours: asSourced(
        working.prospect_call_hours,
        (v) => clip(v, SHORT) || null,
        fallback
      ),
      notification_channel: asSourced(
        working.notification_channel,
        (v) => pickEnum(v, NOTIFICATION_CHANNELS),
        fallback
      ),
    };
  }
  if (practice) {
    patch.practice = {
      delivery_model: asSourced(
        practice.delivery_model,
        (v) => pickEnum(v, DELIVERY_MODELS),
        fallback
      ),
      delivery_format: asSourced(
        practice.delivery_format,
        (v) => pickEnum(v, DELIVERY_FORMATS),
        fallback
      ),
      min_fee: asSourced(practice.min_fee, (v) => clip(v, 80) || null, fallback),
      capacity: asSourced(practice.capacity, (v) => clip(v, 80) || null, fallback),
      payment_terms: asSourced(practice.payment_terms, (v) => clip(v, SHORT) || null, fallback),
      guarantee: asSourced(practice.guarantee, (v) => pickEnum(v, GUARANTEE_TYPES), fallback),
      guarantee_terms: asSourced(practice.guarantee_terms, (v) => clip(v, TEXT) || null, fallback),
      session_rhythm: asSourced(practice.session_rhythm, (v) => clip(v, SHORT) || null, fallback),
      offer_outcome: asSourced(practice.offer_outcome, (v) => pickEnum(v, OFFER_OUTCOMES), fallback),
      more_of: asSourced(practice.more_of, asStringList, fallback),
      less_of: asSourced(practice.less_of, asStringList, fallback),
      help_with: asSourced(practice.help_with, asStringList, fallback),
      offer_timeframe: asSourced(practice.offer_timeframe, (v) => clip(v, SHORT) || null, fallback),
      worth_building: asSourced(
        practice.worth_building,
        (v) => clip(v, TEXT) || null,
        fallback
      ),
      tone: asSourced(practice.tone, asVoiceTone, fallback),
      voice_sounds_like: asSourced(practice.voice_sounds_like, (v) => clip(v, TEXT) || null, fallback),
      voice_never: asSourced(practice.voice_never, (v) => clip(v, TEXT) || null, fallback),
      voice_notes: asSourced(practice.voice_notes, (v) => clip(v, TEXT) || null, fallback),
      voice_known_for: asSourced(practice.voice_known_for, (v) => clip(v, TEXT) || null, fallback),
      voice_coaching_style: asSourced(practice.voice_coaching_style, (v) => clip(v, TEXT) || null, fallback),
      voice_values: asSourced(practice.voice_values, asStringList, fallback),
      voice_qualities: asSourced(practice.voice_qualities, asStringList, fallback),
      voice_like_in_people: asSourced(practice.voice_like_in_people, asStringList, fallback),
      voice_dislike_in_people: asSourced(practice.voice_dislike_in_people, asStringList, fallback),
      voice_pet_peeves: asSourced(practice.voice_pet_peeves, asStringList, fallback),
      voice_favourite_book: asSourced(practice.voice_favourite_book, (v) => clip(v, SHORT) || null, fallback),
      voice_favourite_film: asSourced(practice.voice_favourite_film, (v) => clip(v, SHORT) || null, fallback),
      voice_hobbies: asSourced(practice.voice_hobbies, asStringList, fallback),
      voice_stories: asSourced(practice.voice_stories, (v) => clip(v, TEXT) || null, fallback),
      newsletter_cadence: asSourced(
        practice.newsletter_cadence,
        (v) => pickEnum(v, NEWSLETTER_CADENCES),
        fallback
      ),
      newsletter_name: asSourced(practice.newsletter_name, (v) => clip(v, SHORT) || null, fallback),
      newsletter_description: asSourced(practice.newsletter_description, (v) => clip(v, TEXT) || null, fallback),
      newsletter_audience: asSourced(practice.newsletter_audience, (v) => clip(v, SHORT) || null, fallback),
      newsletter_cta: asSourced(practice.newsletter_cta, (v) => clip(v, TEXT) || null, fallback),
      newsletter_added: asSourced(practice.newsletter_added, (v) => {
        const list = asStringList(v);
        if (!list) return null;
        // Keep an empty list. Null would not clear a list the coach just removed.
        return list.filter((id) => /^[a-z0-9]{6,12}$/.test(id));
      }, fallback),
    };
  }
  if (market) {
    patch.market = {
      industries_worked: asSourced(market.industries_worked, asStringList, fallback),
      roles_held: asSourced(market.roles_held, asStringList, fallback),
      industries_understand: asSourced(
        market.industries_understand,
        asStringList,
        fallback
      ),
      industries_credibility: asSourced(
        market.industries_credibility,
        asStringList,
        fallback
      ),
      industries_access: asSourced(
        market.industries_access,
        asStringList,
        fallback
      ),
      avoid: asSourced(market.avoid, asStringList, fallback),
      geography_pref: asSourced(
        market.geography_pref,
        (v) => pickEnum(v, GEOGRAPHY_PREFS),
        fallback
      ),
      buyer_roles: asSourced(market.buyer_roles, asStringList, fallback),
    };
  }
  if (client) {
    const list = (key: string) => asSourced(client[key], asStringList, fallback);
    patch.client = {
      characteristics: list("characteristics"),
      habitat: list("habitat"),
      psychographics: list("psychographics"),
      pains_now: list("pains_now"),
      desires_now: list("desires_now"),
      pains_later: list("pains_later"),
      desires_later: list("desires_later"),
      stuck: asSourced(client.stuck, asStuckRows, fallback),
      hears: list("hears"),
      sees: list("sees"),
      says: list("says"),
      thinks: list("thinks"),
      words_use: list("words_use"),
      words_avoid: list("words_avoid"),
      frustrations: list("frustrations"),
      buying_triggers: list("buying_triggers"),
      objections: list("objections"),
      trust: asSourced(client.trust, asTrustRows, fallback),
      inner_voice: asSourced(client.inner_voice, (v) => clip(v, TEXT) || null, fallback),
      ready_to_act: asSourced(client.ready_to_act, (v) => clip(v, TEXT) || null, fallback),
      why_you: asSourced(client.why_you, (v) => clip(v, TEXT) || null, fallback),
    };
  }
  if (proof) {
    patch.proof = {
      career_results: asSourced(proof.career_results, asCareerResults, fallback),
      client_results: asSourced(proof.client_results, asClientResults, fallback),
      problems_asked: asSourced(proof.problems_asked, asStringList, fallback),
      proudest: asSourced(proof.proudest, asStringList, fallback),
      uniqueness: asSourced(
        proof.uniqueness,
        (v) => clip(v, TEXT) || null,
        fallback
      ),
      superpowers: asSourced(
        proof.superpowers,
        (v) => clip(v, TEXT) || null,
        fallback
      ),
      evidence_notes: asSourced(
        proof.evidence_notes,
        (v) => clip(v, TEXT) || null,
        fallback
      ),
    };
  }
  if (review) {
    patch.review = {
      report_comments: asSourced(
        review.report_comments,
        (v) => clip(v, TEXT) || null,
        fallback
      ),
      decision_call_booked_at: asSourced(
        review.decision_call_booked_at,
        (v) => clip(v, 40) || null,
        fallback
      ),
      notes: asSourced(review.notes, asNotes, fallback),
      approved_pages: asSourced(review.approved_pages, asStampMap, fallback),
      approved_sections: asSourced(review.approved_sections, asStampMap, fallback),
      bca_approved_sections: asSourced(review.bca_approved_sections, asStampMap, fallback),
      section_status: asSourced(review.section_status, asStampMap, fallback),
      status_log: asSourced(review.status_log, asStatusLog, fallback),
    };
  }

  return patch;
}

export function sanitizeStatus(value: unknown): PracticeStatus | null {
  return (PRACTICE_STATUSES as readonly string[]).includes(String(value))
    ? (value as PracticeStatus)
    : null;
}

export function sanitizeAssetKind(value: unknown): IntakeAssetKind {
  return (ASSET_KINDS as readonly string[]).includes(String(value))
    ? (value as IntakeAssetKind)
    : "other";
}

export function sanitizeDecisionRecord(raw: unknown): DecisionRecordPayload {
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const field = (key: string) => clip(rec[key], TEXT);
  return {
    target_market: field("target_market"),
    buyer: field("buyer"),
    problem: field("problem"),
    offer: field("offer"),
    price: field("price"),
    guarantee: field("guarantee"),
    delivery_model: field("delivery_model"),
    geography: field("geography"),
    campaign_angle: field("campaign_angle"),
    prospect_criteria: field("prospect_criteria"),
    launch_date: field("launch_date"),
    customer_responsibilities: field("customer_responsibilities"),
    bca_responsibilities: field("bca_responsibilities"),
    open_risks: field("open_risks"),
    next_milestone: field("next_milestone"),
  };
}

export const COACH_WRITABLE_STATUSES: PracticeStatus[] = [
  "capturing",
  "extracted",
  "coach_reviewed",
];

export const ADMIN_ONLY_STATUSES: PracticeStatus[] = [
  "admin_reviewed",
  "decision_recorded",
  "ready_to_build",
  "building",
];
