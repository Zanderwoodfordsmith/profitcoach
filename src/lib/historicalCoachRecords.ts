import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

import { normalizeCoachName } from "@/lib/clickupCoachNameMatch";
import { splitFullName } from "@/lib/splitFullName";

/** Synthetic emails for coaches imported for payment matching only. */
export const HISTORICAL_COACH_EMAIL_DOMAIN = "import.bca.records";

export function historicalCoachEmailForSlug(slug: string): string {
  return `coach+${slug}@${HISTORICAL_COACH_EMAIL_DOMAIN}`;
}

export function isHistoricalCoachEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized.endsWith(`@${HISTORICAL_COACH_EMAIL_DOMAIN}`);
}

export function slugifyHistoricalCoachName(fullName: string): string {
  let s = fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) s = "coach";
  return `hist-${s}`.slice(0, 56);
}

export async function coachSlugExists(
  supabase: SupabaseClient,
  slug: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("coaches")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function allocateHistoricalCoachSlug(
  supabase: SupabaseClient,
  fullName: string
): Promise<string> {
  const base = slugifyHistoricalCoachName(fullName);
  if (!(await coachSlugExists(supabase, base))) return base;
  for (let i = 2; i < 500; i++) {
    const candidate = `${base}-${i}`.slice(0, 60);
    if (!(await coachSlugExists(supabase, candidate))) return candidate;
  }
  throw new Error(`Could not allocate slug for ${fullName}`);
}

export type CreateHistoricalCoachInput = {
  fullName: string;
  joinDate?: string | null;
  clickupTaskName?: string | null;
};

export type CreateHistoricalCoachResult = {
  userId: string;
  slug: string;
  email: string;
  created: boolean;
};

/**
 * Create auth user + profile + coaches row for a payment-only historical coach.
 * Idempotent when the same normalized name already exists on a coach profile.
 */
export async function createHistoricalCoachRecord(
  supabase: SupabaseClient,
  input: CreateHistoricalCoachInput
): Promise<CreateHistoricalCoachResult> {
  const fullName = input.fullName.trim();
  if (!fullName) {
    throw new Error("fullName is required");
  }

  const { first_name, last_name } = splitFullName(fullName);
  const normalizedTarget = normalizeCoachName(fullName);

  const { data: existingCoaches, error: listError } = await supabase
    .from("coaches")
    .select("id, slug, profiles!inner(full_name)")
    .limit(500);

  if (listError) throw new Error(listError.message);

  for (const row of existingCoaches ?? []) {
    const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const existingName = (prof?.full_name as string | null) ?? "";
    if (normalizeCoachName(existingName) === normalizedTarget) {
      return {
        userId: row.id as string,
        slug: row.slug as string,
        email: historicalCoachEmailForSlug(row.slug as string),
        created: false,
      };
    }
  }

  const slug = await allocateHistoricalCoachSlug(supabase, fullName);
  const email = historicalCoachEmailForSlug(slug);
  const password = randomBytes(24).toString("base64url");

  const { data: authData, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      historical_coach: true,
      display_name: fullName,
      clickup_name: input.clickupTaskName?.trim() || fullName,
    },
  });

  if (createErr || !authData.user) {
    throw new Error(createErr?.message ?? "createUser failed");
  }

  const userId = authData.user.id;

  try {
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      role: "coach",
      full_name: fullName,
      first_name,
      last_name,
      disco_community_joined_on: input.joinDate?.slice(0, 10) ?? null,
    });

    if (profileError) throw new Error(`profiles: ${profileError.message}`);

    const coachPayload = {
      id: userId,
      slug,
      directory_listed: false,
      record_kind: "historical" as const,
    };

    let coachError = (await supabase.from("coaches").insert(coachPayload)).error;

    if (
      coachError &&
      /record_kind/i.test(coachError.message ?? "")
    ) {
      const { record_kind: _removed, ...withoutKind } = coachPayload;
      coachError = (await supabase.from("coaches").insert(withoutKind)).error;
    }

    if (coachError) throw new Error(`coaches: ${coachError.message}`);

    return { userId, slug, email, created: true };
  } catch (err) {
    await supabase.auth.admin.deleteUser(userId);
    throw err;
  }
}
