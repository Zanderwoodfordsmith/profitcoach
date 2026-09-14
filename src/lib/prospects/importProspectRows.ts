import { normalizeLinkedInProfileUrl } from "@/lib/linkedin/normalizeProfileUrl";
import { resolveOrCreateContact } from "@/lib/contacts/resolveOrCreateContact";
import { toLiteProspectRows } from "@/lib/loadProspectTableRows";
import {
  MAX_PROSPECT_IMPORT_FIELD,
  MAX_PROSPECT_IMPORT_ROWS,
} from "@/lib/prospects/importLimits";
import type { ProspectRow } from "@/lib/prospectRow";
import { splitFullName } from "@/lib/splitFullName";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export { MAX_PROSPECT_IMPORT_ROWS } from "@/lib/prospects/importLimits";

export type ProspectImportRowInput = {
  fullName?: unknown;
  email?: unknown;
  phone?: string | unknown;
  businessName?: unknown;
  jobTitle?: unknown;
  linkedinUrl?: unknown;
};

export type ProspectImportFailure = {
  index: number;
  name: string;
  error: string;
};

function asTrimmed(value: unknown, max = MAX_PROSPECT_IMPORT_FIELD): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function sanitizeProspectImportRow(
  raw: unknown
): { ok: true; row: { fullName: string; email: string | null; phone: string | null; businessName: string | null; jobTitle: string | null; linkedinUrl: string | null } } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Invalid row." };
  }
  const input = raw as ProspectImportRowInput;
  const fullName = asTrimmed(input.fullName);
  if (!fullName) {
    return { ok: false, error: "Name is required." };
  }
  const linkedinRaw = asTrimmed(input.linkedinUrl, 500);
  let linkedinUrl: string | null = null;
  if (linkedinRaw) {
    linkedinUrl = normalizeLinkedInProfileUrl(linkedinRaw);
    if (!linkedinUrl) {
      return { ok: false, error: "Invalid LinkedIn profile URL." };
    }
  }
  return {
    ok: true,
    row: {
      fullName,
      email: asTrimmed(input.email),
      phone: asTrimmed(input.phone, 40),
      businessName: asTrimmed(input.businessName),
      jobTitle: asTrimmed(input.jobTitle),
      linkedinUrl,
    },
  };
}

export async function importProspectRowsForCoach(input: {
  coachId: string;
  rows: unknown[];
}): Promise<{
  created: number;
  updated: number;
  failed: ProspectImportFailure[];
  prospects: ProspectRow[];
}> {
  if (!Array.isArray(input.rows)) {
    throw new Error("Import rows must be an array.");
  }
  if (input.rows.length === 0) {
    throw new Error("No prospects to import.");
  }
  if (input.rows.length > MAX_PROSPECT_IMPORT_ROWS) {
    throw new Error(`You can import at most ${MAX_PROSPECT_IMPORT_ROWS} prospects at a time.`);
  }

  const failed: ProspectImportFailure[] = [];
  const contactIds: string[] = [];
  let created = 0;
  let updated = 0;

  for (let i = 0; i < input.rows.length; i++) {
    const parsed = sanitizeProspectImportRow(input.rows[i]);
    if (!parsed.ok) {
      failed.push({ index: i, name: "", error: parsed.error });
      continue;
    }
    try {
      const { first_name, last_name } = splitFullName(parsed.row.fullName);
      const resolved = await resolveOrCreateContact({
        coachId: input.coachId,
        fullName: parsed.row.fullName,
        firstName: first_name,
        lastName: last_name,
        email: parsed.row.email,
        phone: parsed.row.phone,
        businessName: parsed.row.businessName,
        jobTitle: parsed.row.jobTitle,
        linkedinUrl: parsed.row.linkedinUrl,
        type: "prospect",
        prospectSource: "manual",
      });
      contactIds.push(resolved.contactId);
      if (resolved.created) created += 1;
      else updated += 1;
    } catch (err) {
      failed.push({
        index: i,
        name: parsed.row.fullName,
        error: err instanceof Error ? err.message : "Unable to import this prospect.",
      });
    }
  }

  let prospects: ProspectRow[] = [];
  if (contactIds.length > 0) {
    const uniqueIds = Array.from(new Set(contactIds));
    const { data } = await supabaseAdmin
      .from("contacts")
      .select(
        "id, coach_id, full_name, email, business_name, job_title, linkedin_url, phone, type, prospect_status, created_at, prospect_source"
      )
      .in("id", uniqueIds);
    prospects = toLiteProspectRows(
      (data ?? []).map((c) => ({
        id: c.id as string,
        coach_id: (c.coach_id as string | null) ?? null,
        full_name: c.full_name as string,
        email: (c.email as string | null) ?? null,
        business_name: (c.business_name as string | null) ?? null,
        job_title: (c.job_title as string | null) ?? null,
        linkedin_url: (c.linkedin_url as string | null) ?? null,
        phone: (c.phone as string | null) ?? null,
        type: (c.type as string) ?? "prospect",
        prospect_status: (c.prospect_status as string | null) ?? null,
        created_at: (c.created_at as string | null) ?? null,
        prospect_source: (c.prospect_source as string | null) ?? null,
      }))
    );
  }

  return { created, updated, failed, prospects };
}

export async function resolveImportCoachId(coachIdRaw: string): Promise<{
  coachId: string;
  coachSlug: string | null;
}> {
  const { data: coachRow, error } = await supabaseAdmin
    .from("coaches")
    .select("id, slug")
    .eq("id", coachIdRaw)
    .maybeSingle();
  if (error || !coachRow) {
    throw new Error("Coach not found.");
  }
  return {
    coachId: coachRow.id as string,
    coachSlug: (coachRow.slug as string | null) ?? null,
  };
}
