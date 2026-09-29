/**
 * Practice Installation knowledge store.
 *
 * Secure design (auth / data / API / ingestion):
 * - AuthN: existing Supabase Bearer session (`requireCoachRequest` / `requireAdmin`).
 * - AuthZ: coach_id is taken from the session (or admin impersonation header),
 *   never from the request body. Admins use `/api/admin/practice*`.
 * - PII: phone, WhatsApp, location, transcripts, proof stories, uploads.
 *   Supabase at-rest encryption. Cascade-delete with the profile.
 * - Mass assignment: PATCH allowlists fields. Status transitions to
 *   admin_reviewed / decision_recorded / ready_to_build are admin-only.
 * - Uploads: MIME + size allowlist, UUID paths, private bucket, signed GET.
 * - LLM: max 80 turns, 8k chars/message; never invent numeric proof.
 * - Logs: do not print transcripts, phone, or raw request bodies.
 */

export const PRACTICE_KNOWLEDGE_SOURCES = [
  "linkedin",
  "form",
  "interview",
  "admin",
  "coach_edit",
] as const;

export type KnowledgeSource = (typeof PRACTICE_KNOWLEDGE_SOURCES)[number];

export type Sourced<T> = {
  value: T;
  source: KnowledgeSource;
  updated_at: string;
};

export const PRACTICE_STATUSES = [
  "capturing",
  "extracted",
  "coach_reviewed",
  "admin_reviewed",
  "decision_recorded",
  "ready_to_build",
  "building",
] as const;

export type PracticeStatus = (typeof PRACTICE_STATUSES)[number];

export const DELIVERY_MODELS = [
  "coaching",
  "consulting",
  "advisory",
  "hybrid",
] as const;
export type DeliveryModel = (typeof DELIVERY_MODELS)[number];

export const DELIVERY_FORMATS = ["one_to_one", "group", "hybrid"] as const;
export type DeliveryFormat = (typeof DELIVERY_FORMATS)[number];

export const NOTIFICATION_CHANNELS = [
  "email",
  "whatsapp",
  "sms",
  "linkedin",
] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const GEOGRAPHY_PREFS = ["local", "national", "international"] as const;
export type GeographyPref = (typeof GEOGRAPHY_PREFS)[number];

export const PROOF_TYPES = ["career", "client"] as const;
export type ProofType = (typeof PROOF_TYPES)[number];

export const ASSET_KINDS = [
  "cv",
  "testimonial",
  "case_study",
  "other",
] as const;
export type IntakeAssetKind = (typeof ASSET_KINDS)[number];

export type CareerResult = {
  id: string;
  company: string;
  role: string;
  metric_from: string;
  metric_to: string;
  timeframe: string;
  mechanism: string;
  proof_type: ProofType;
  precise: boolean;
};

export type ClientResultStory = {
  id: string;
  title: string;
  story: string;
};

export type PracticeKnowledgePayload = {
  identity: {
    phone: Sourced<string> | null;
    whatsapp: Sourced<string> | null;
    website: Sourced<string> | null;
    timezone: Sourced<string> | null;
    location: Sourced<string> | null;
    linkedin_url: Sourced<string> | null;
  };
  working_times: {
    hours_per_week: Sourced<string> | null;
    preferred_hours: Sourced<string> | null;
    prospect_call_hours: Sourced<string> | null;
    notification_channel: Sourced<NotificationChannel> | null;
  };
  practice: {
    delivery_model: Sourced<DeliveryModel> | null;
    delivery_format: Sourced<DeliveryFormat> | null;
    min_fee: Sourced<string> | null;
    capacity: Sourced<string> | null;
    more_of: Sourced<string> | null;
    less_of: Sourced<string> | null;
    worth_building: Sourced<string> | null;
  };
  market: {
    industries_worked: Sourced<string[]> | null;
    roles_held: Sourced<string[]> | null;
    industries_understand: Sourced<string[]> | null;
    industries_credibility: Sourced<string[]> | null;
    industries_access: Sourced<string[]> | null;
    avoid: Sourced<string[]> | null;
    geography_pref: Sourced<GeographyPref> | null;
    buyer_roles: Sourced<string[]> | null;
  };
  proof: {
    career_results: Sourced<CareerResult[]> | null;
    client_results: Sourced<ClientResultStory[]> | null;
    problems_asked: Sourced<string[]> | null;
    proudest: Sourced<string[]> | null;
    uniqueness: Sourced<string> | null;
    superpowers: Sourced<string> | null;
    evidence_notes: Sourced<string> | null;
  };
  review: {
    report_comments: Sourced<string> | null;
    decision_call_booked_at: Sourced<string> | null;
    notes: Sourced<PracticeNote[]> | null;
    approved_pages: Sourced<Record<string, string>> | null;
    approved_sections: Sourced<Record<string, string>> | null;
  };
};

export type PracticeNote = {
  id: string;
  body: string;
  at: string;
  page: string;
};

export type InterviewTurn = {
  role: "assistant" | "user";
  content: string;
  at: string;
};

export type PracticeReportPayload = {
  experience_summary: string;
  proof_inventory: string;
  market_hypotheses: Array<{
    industry: string;
    buyer: string;
    problem: string;
    score_notes: string;
  }>;
  offer_direction: string;
  positioning: string;
  campaign_angle: string;
  missing_info: string[];
  decision_questions: string[];
};

export type DecisionRecordPayload = {
  target_market: string;
  buyer: string;
  problem: string;
  offer: string;
  price: string;
  delivery_model: string;
  geography: string;
  campaign_angle: string;
  prospect_criteria: string;
  launch_date: string;
  customer_responsibilities: string;
  bca_responsibilities: string;
  open_risks: string;
  next_milestone: string;
};

export type PracticeKnowledgeRow = {
  coach_id: string;
  status: PracticeStatus;
  payload: PracticeKnowledgePayload;
  linkedin_seeded_at: string | null;
  form_completed_at: string | null;
  interview_completed_at: string | null;
  coach_reviewed_at: string | null;
  admin_reviewed_at: string | null;
  completeness_score: number;
  missing_fields: string[];
  report_payload: PracticeReportPayload | null;
  report_generated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type IntakeSessionRow = {
  id: string;
  coach_id: string;
  status: "active" | "completed" | "abandoned";
  turns: InterviewTurn[];
  extraction: Partial<PracticeKnowledgePayload>;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
};

export type DecisionRecordRow = {
  id: string;
  coach_id: string;
  payload: DecisionRecordPayload;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IntakeAssetRow = {
  id: string;
  coach_id: string;
  kind: IntakeAssetKind;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export const PRACTICE_INTRO_VIDEO = {
  embedId: process.env.NEXT_PUBLIC_PRACTICE_INTRO_VIDALYTICS_ID ?? "",
  baseUrl: process.env.NEXT_PUBLIC_PRACTICE_INTRO_VIDALYTICS_BASE ?? "",
} as const;
