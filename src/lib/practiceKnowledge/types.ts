/**
 * Practice Installation knowledge store.
 *
 * Secure design (auth / data / API / ingestion):
 * - AuthN: existing Supabase Bearer session (`requireCoachRequest` / `requireAdmin`).
 * - AuthZ: coach_id is taken from the session (or admin impersonation header),
 *   never from the request body. Admins use `/api/admin/practice*`.
 * - PII: phone, WhatsApp, location, address, transcripts, proof stories, uploads.
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

import type { VoiceTone } from "./voiceTone";

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

export const NEWSLETTER_CADENCES = ["weekly", "fortnightly", "monthly"] as const;
export type NewsletterCadence = (typeof NEWSLETTER_CADENCES)[number];

export const NOTIFICATION_CHANNELS = [
  "email",
  "whatsapp",
  "sms",
  "linkedin",
] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const GEOGRAPHY_PREFS = ["local", "national", "international"] as const;
export type GeographyPref = (typeof GEOGRAPHY_PREFS)[number];

export const LINKEDIN_VISIBILITIES = ["public", "discreet"] as const;
export type LinkedInVisibility = (typeof LINKEDIN_VISIBILITIES)[number];

/** Whether the coach offers a guarantee, and which kind. */
export const GUARANTEE_TYPES = ["none", "trial", "results"] as const;
export type GuaranteeType = (typeof GUARANTEE_TYPES)[number];

/** The BOSS score destination this offer leads with. */
export const OFFER_OUTCOMES = ["money", "time", "team"] as const;
export type OfferOutcome = (typeof OFFER_OUTCOMES)[number];

/** Where a result came from. "client" is from before we asked current or past; "" is not said yet. */
export const PROOF_TYPES = ["career", "own_business", "current_client", "past_client", "client", ""] as const;
export type ProofType = (typeof PROOF_TYPES)[number];

export const ASSET_KINDS = [
  "cv",
  "testimonial",
  "case_study",
  "other",
] as const;
export type IntakeAssetKind = (typeof ASSET_KINDS)[number];

/** One role on Your career: a job, or a business the coach ran. Roles held and industries worked follow the shown ones. */
export type CareerRole = {
  id: string;
  kind: "job" | "own";
  title: string;
  company: string;
  industry: string;
  /** Years, e.g. "2016". An empty end means they are still there. */
  from: string;
  to: string;
  /** What they did there, in a line. Optional. */
  note: string;
  /** Unticked roles stay on the list and are left out of everything we write. */
  show: boolean;
};

/** One result, from the coach's career or for a client. For a client, company is the client's business. */
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
  /** The result in words, for when there is no before and after. */
  summary?: string;
  client_name?: string;
  photo_url?: string;
  website?: string;
  case_study_url?: string;
  /** What the client said about the coach. */
  quote?: string;
};

export type ClientResultStory = {
  id: string;
  title: string;
  story: string;
};

/** One problem for the ideal client. The three cells are the same problem, seen three ways. */
export type ClientStuckRow = {
  id: string;
  problem: string;
  consequence: string;
  awake: string;
};

/** One row of the trust table. A cell can be empty. The columns do not have to tell one story. */
export type ClientTrustRow = {
  id: string;
  authority: string;
  social_proof: string;
  scarcity: string;
};

export type PracticeKnowledgePayload = {
  identity: {
    phone: Sourced<string> | null;
    whatsapp: Sourced<string> | null;
    website: Sourced<string> | null;
    timezone: Sourced<string> | null;
    location: Sourced<string> | null;
    /** Postal address, first line. With the lines below, where BCA can send things. Never sent to the AI writers. */
    address: Sourced<string> | null;
    address_line2: Sourced<string> | null;
    postcode: Sourced<string> | null;
    country: Sourced<string> | null;
    linkedin_url: Sourced<string> | null;
    /** Own domain, or a Profit Coach page at their name. */
    web_address: Sourced<string> | null;
    /** Keep their own address, or have a practice email set up. */
    practice_email: Sourced<string> | null;
    /** Public about coaching on LinkedIn, or discreet (still employed, non-compete). */
    linkedin_visibility: Sourced<LinkedInVisibility> | null;
    /** Their LinkedIn headline and About today, imported so the rewrite has a before. */
    linkedin_headline: Sourced<string> | null;
    linkedin_about: Sourced<string> | null;
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
    /** Monthly, upfront, minimum term: how clients pay. */
    payment_terms: Sourced<string> | null;
    guarantee: Sourced<GuaranteeType> | null;
    guarantee_terms: Sourced<string> | null;
    /** How often sessions run, if different from the BCA format. */
    session_rhythm: Sourced<string> | null;
    /** BOSS score destination this offer leads with: money, time or team. */
    offer_outcome: Sourced<OfferOutcome> | null;
    /** What owners get more of, in the coach's words. */
    more_of: Sourced<string[]> | null;
    /** What owners get less of, in the coach's words. */
    less_of: Sourced<string[]> | null;
    /** What they actually help with, in their language. Not a system picker. */
    help_with: Sourced<string[]> | null;
    /** How long until the first result they can point to. */
    offer_timeframe: Sourced<string> | null;
    worth_building: Sourced<string> | null;
    /** Your Voice: five sliders, 1 to 5. BCA sets them from the conversation, the coach moves them. */
    tone: Sourced<VoiceTone> | null;
    /** Your Voice: a short message in their own words. */
    voice_sounds_like: Sourced<string> | null;
    /** Your Voice: what they never want to sound like. */
    voice_never: Sourced<string> | null;
    /** Your Voice: anything else about how they come across. */
    voice_notes: Sourced<string> | null;
    /** Your Voice: how they want to be perceived and what they want to be known for. */
    voice_known_for: Sourced<string> | null;
    /** Your Voice: fun, serious, boot camp, hugs, or a mix. */
    voice_coaching_style: Sourced<string> | null;
    voice_values: Sourced<string[]> | null;
    voice_qualities: Sourced<string[]> | null;
    voice_like_in_people: Sourced<string[]> | null;
    voice_dislike_in_people: Sourced<string[]> | null;
    voice_pet_peeves: Sourced<string[]> | null;
    voice_favourite_book: Sourced<string> | null;
    voice_favourite_film: Sourced<string> | null;
    voice_hobbies: Sourced<string[]> | null;
    /** A story they are happy for us to use in a newsletter or lesson. */
    voice_stories: Sourced<string> | null;
    /** How often a LinkedIn newsletter goes out. Unset means fortnightly. */
    newsletter_cadence: Sourced<NewsletterCadence> | null;
    /** The name of the newsletter, on the tin. */
    newsletter_name: Sourced<string> | null;
    newsletter_description: Sourced<string> | null;
    newsletter_audience: Sourced<string> | null;
    /** The sentence that closes every issue. */
    newsletter_cta: Sourced<string> | null;
    /** Extra issues the coach added, besides the first. */
    newsletter_added: Sourced<string[]> | null;
  };
  market: {
    /** Your career: roles from LinkedIn or added by hand. */
    career: Sourced<CareerRole[]> | null;
    industries_worked: Sourced<string[]> | null;
    roles_held: Sourced<string[]> | null;
    industries_understand: Sourced<string[]> | null;
    industries_credibility: Sourced<string[]> | null;
    industries_access: Sourced<string[]> | null;
    avoid: Sourced<string[]> | null;
    geography_pref: Sourced<GeographyPref> | null;
    buyer_roles: Sourced<string[]> | null;
  };
  /** The person every message is written to. Filled on Your Ideal Client. */
  client: {
    characteristics: Sourced<string[]> | null;
    habitat: Sourced<string[]> | null;
    psychographics: Sourced<string[]> | null;
    pains_now: Sourced<string[]> | null;
    desires_now: Sourced<string[]> | null;
    pains_later: Sourced<string[]> | null;
    desires_later: Sourced<string[]> | null;
    stuck: Sourced<ClientStuckRow[]> | null;
    hears: Sourced<string[]> | null;
    sees: Sourced<string[]> | null;
    says: Sourced<string[]> | null;
    thinks: Sourced<string[]> | null;
    words_use: Sourced<string[]> | null;
    words_avoid: Sourced<string[]> | null;
    frustrations: Sourced<string[]> | null;
    buying_triggers: Sourced<string[]> | null;
    objections: Sourced<string[]> | null;
    trust: Sourced<ClientTrustRow[]> | null;
    inner_voice: Sourced<string> | null;
    ready_to_act: Sourced<string> | null;
    why_you: Sourced<string> | null;
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
    /** Coach sign-off time per section key. Valid while it is at or after the section's revision. */
    approved_sections: Sourced<Record<string, string>> | null;
    /** BCA sign-off time for sections that go out to prospects. Coaches cannot change this. */
    bca_approved_sections: Sourced<Record<string, string>> | null;
    /** Manual To do / Review / Done choice per section, stored as "status|time". */
    section_status: Sourced<Record<string, string>> | null;
    /** Manual status moves, oldest first. Wording edits are not logged. */
    status_log: Sourced<SectionStatusEvent[]> | null;
  };
};

/** One manual status move, shown in that section's comment thread. */
export type SectionStatusEvent = {
  id: string;
  section: string;
  from: "todo" | "review" | "done";
  to: "todo" | "review" | "done";
  at: string;
  actor_id: string;
  actor_name: string;
  actor_side: "coach" | "bca";
};

export type PracticeNote = {
  id: string;
  body: string;
  at: string;
  page: string;
  /** The section a change request is about ("page:id"). */
  section?: string;
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
  guarantee: string;
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

/**
 * One piece of a Blueprint section BCA writes. The page renders these, and the
 * Markdown export is built from the same blocks, so both always match.
 */
export type BlueprintBlock =
  | { type: "lede"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "quote"; text: string; cite?: string }
  | { type: "stats"; items: { value: string; label: string }[] }
  | { type: "pairs"; items: { label: string; value: string }[] }
  | { type: "table"; columns: string[]; rows: string[][] }
  | { type: "message"; label: string; body: string; note?: string }
  | { type: "callout"; tone: "tip" | "warning" | "note"; title?: string; text: string }
  | { type: "steps"; items: { title: string; detail: string }[] }
  | { type: "timeline"; items: { when: string; title: string; detail?: string }[] };

export type BuiltSection = {
  blocks: BlueprintBlock[];
  generated_at: string;
  model: string;
  /** Set when the coach or an admin changed the text after it was written. */
  edited_at?: string | null;
  /** The version before Ava's last change, so she can put it back. replaced_at is that change's edited_at. */
  previous?: (Omit<BuiltSection, "previous"> & { replaced_at: string }) | null;
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
  /** Sections BCA wrote, keyed "page:section" (for example "market:avatar"). */
  built_sections: Record<string, BuiltSection>;
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
