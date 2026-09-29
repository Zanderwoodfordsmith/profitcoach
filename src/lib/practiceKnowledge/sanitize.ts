import { randomUUID } from "crypto";
import type {
  CareerResult,
  ClientResultStory,
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
  ProofType,
  Sourced,
} from "./types";
import {
  ASSET_KINDS,
  DELIVERY_FORMATS,
  DELIVERY_MODELS,
  GEOGRAPHY_PREFS,
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
  const value = map(rec.value);
  if (value == null) return null;
  return {
    value,
    source: asSource(rec.source, fallback),
    updated_at:
      typeof rec.updated_at === "string" && rec.updated_at
        ? rec.updated_at
        : new Date().toISOString(),
  };
}

function asStringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    const one = clip(value, SHORT);
    return one ? [one] : null;
  }
  const list = value
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

function asNotes(value: unknown): PracticeNote[] | null {
  if (!Array.isArray(value)) return null;
  const rows: PracticeNote[] = [];
  for (const item of value.slice(0, 80)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const body = clip(rec.body, TEXT);
    const page = clip(rec.page, 40);
    if (!body || !page) continue;
    rows.push({
      id: clip(rec.id, 64) || randomUUID(),
      body,
      at: clip(rec.at, 40) || new Date().toISOString(),
      page,
    });
  }
  return rows;
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
      linkedin_url: asSourced(
        identity.linkedin_url,
        (v) => clip(v, 400) || null,
        fallback
      ),
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
      more_of: asSourced(practice.more_of, (v) => clip(v, TEXT) || null, fallback),
      less_of: asSourced(practice.less_of, (v) => clip(v, TEXT) || null, fallback),
      worth_building: asSourced(
        practice.worth_building,
        (v) => clip(v, TEXT) || null,
        fallback
      ),
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
