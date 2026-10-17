import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { fetchBcaSalesTranscripts } from "./bcaTranscripts";
import { seedPracticeFromLinkedIn } from "./ingestLinkedIn";
import { ensurePracticeKnowledge } from "./store";

export type OnboardingSourceRow = {
  id: string;
  source: string;
  external_id: string;
  title: string;
  called_at: string | null;
  body: string;
  ingested_at: string;
};

export type OnboardingIngestResult = {
  linkedinScraped: boolean;
  linkedinSeeded: boolean;
  transcripts: number;
  error?: string;
};

export async function listOnboardingTranscripts(
  coachId: string
): Promise<OnboardingSourceRow[]> {
  const { data, error } = await supabaseAdmin
    .from("practice_source_transcripts")
    .select("id, source, external_id, title, called_at, body, ingested_at")
    .eq("coach_id", coachId)
    .order("called_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OnboardingSourceRow[];
}

export function onboardingTranscriptText(rows: OnboardingSourceRow[]): string {
  if (!rows.length) return "";
  return rows
    .map((row) => {
      const when = row.called_at ? ` (${row.called_at.slice(0, 10)})` : "";
      return `### ${row.title || "Onboarding call"}${when}\n\n${row.body.trim()}`;
    })
    .join("\n\n")
    .slice(0, 14_000);
}

async function coachIdentity(coachId: string): Promise<{
  fullName: string;
  email: string | null;
  linkedinUrl: string | null;
}> {
  const [{ data: profile }, { data: userData }] = await Promise.all([
    supabaseAdmin.from("profiles").select("full_name, linkedin_url").eq("id", coachId).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(coachId),
  ]);
  return {
    fullName: (profile?.full_name as string | null)?.trim() || "Coach",
    email: userData.user?.email?.trim().toLowerCase() ?? null,
    linkedinUrl: (profile?.linkedin_url as string | null)?.trim() || null,
  };
}

async function saveTranscripts(
  coachId: string,
  calls: Awaited<ReturnType<typeof fetchBcaSalesTranscripts>>["calls"]
): Promise<number> {
  if (!calls.length) return 0;
  const now = new Date().toISOString();
  const rows = calls.map((call) => ({
    coach_id: coachId,
    source: "bca_sales_call",
    external_id: call.id.slice(0, 80),
    title: (call.title || `${call.callType} call`).slice(0, 200),
    called_at: call.callAt && !Number.isNaN(Date.parse(call.callAt)) ? call.callAt : null,
    body: call.transcript.trim().slice(0, 80_000),
    ingested_at: now,
  }));
  const { error } = await supabaseAdmin.from("practice_source_transcripts").upsert(rows, {
    onConflict: "coach_id,source,external_id",
  });
  if (error) throw new Error(error.message);
  return rows.length;
}

/**
 * Pull BCA sales-call transcripts and, when we have a URL, scrape LinkedIn.
 * Safe to call more than once. Does not invent facts from the transcript.
 */
export async function ingestOnboardingSources(
  coachId: string,
  opts?: { scrapeLinkedIn?: boolean; linkedinUrl?: string | null }
): Promise<OnboardingIngestResult> {
  await ensurePracticeKnowledge(coachId);
  const identity = await coachIdentity(coachId);
  const linkedinUrl = opts?.linkedinUrl?.trim() || identity.linkedinUrl;

  let transcripts = 0;
  let error: string | undefined;
  try {
    const pulled = await fetchBcaSalesTranscripts({
      coachId,
      fullName: identity.fullName,
      email: identity.email,
    });
    if (pulled.error && !pulled.calls.length) error = pulled.error;
    transcripts = await saveTranscripts(coachId, pulled.calls);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not save transcripts.";
  }

  let linkedinScraped = false;
  let linkedinSeeded = false;
  if (opts?.scrapeLinkedIn !== false) {
    const seeded = await seedPracticeFromLinkedIn(coachId, {
      scrape: Boolean(linkedinUrl),
      linkedinUrl,
    });
    linkedinScraped = seeded.scraped;
    linkedinSeeded = Boolean(seeded.knowledge.linkedin_seeded_at);
  }

  return { linkedinScraped, linkedinSeeded, transcripts, error };
}

/** Fire-and-forget after a new coach account exists. */
export function scheduleOnboardingIngest(coachId: string): void {
  void ingestOnboardingSources(coachId).catch((err) => {
    console.error(
      "onboarding ingest:",
      err instanceof Error ? err.message : "failed"
    );
  });
}
