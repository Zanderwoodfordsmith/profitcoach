import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Pulled out so both /api/assessments and /api/leads/capture can share. */

type SafeResult<T> = {
  data: T | null;
  error: { code: string | null; message: string; hint?: string | null } | null;
};

function dropMissingColumn(
  payload: Record<string, unknown>,
  error: { code?: string | null; message?: string | null }
): Record<string, unknown> | null {
  // PostgREST schema-cache miss:
  //   "Could not find the 'first_name' column of 'contacts' in the schema cache"
  if (error.code === "PGRST204") {
    const m = /'(\w+)' column of 'contacts'/i.exec(error.message ?? "");
    const offender = m?.[1];
    if (offender && offender in payload) {
      const { [offender]: _drop, ...rest } = payload;
      void _drop;
      return rest;
    }
  }

  // Postgres-level missing column (rare via PostgREST but kept defensively):
  //   `column "phone" of relation "contacts" does not exist`
  if (error.code === "42703") {
    const m = /column "([^"]+)" of relation "contacts"/i.exec(
      error.message ?? ""
    );
    const offender = m?.[1];
    if (offender && offender in payload) {
      const { [offender]: _drop, ...rest } = payload;
      void _drop;
      return rest;
    }
  }
  return null;
}

/**
 * Insert a `contacts` row, iteratively stripping any column that PostgREST or
 * Postgres reports as missing. Supabase deployments occasionally lag behind
 * the application's known schema (e.g. `first_name`/`last_name`/`phone` were
 * added in a later migration that hasn't run yet); rather than 500ing on a
 * hard-coded payload we drop the offending column and retry.
 */
export async function tryInsertContactStripping(
  initialPayload: Record<string, unknown>
): Promise<SafeResult<{ id: string }>> {
  let payload = { ...initialPayload };
  for (let i = 0; i < 6; i += 1) {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .insert(payload)
      .select("id")
      .single();
    if (!error) {
      return { data: (data as { id: string }) ?? null, error: null };
    }
    const stripped = dropMissingColumn(payload, error);
    if (stripped) {
      payload = stripped;
      continue;
    }
    return {
      data: null,
      error: {
        code: error.code ?? null,
        message: error.message,
        hint: error.hint ?? null,
      },
    };
  }
  return {
    data: null,
    error: {
      code: "exhausted",
      message:
        "Exhausted retries stripping unknown contacts columns. Apply pending Supabase migrations.",
    },
  };
}

/** Same idea, but for updates. Mutates a copy of the patch. */
export async function tryUpdateContactStripping(
  contactId: string,
  initialPatch: Record<string, unknown>
): Promise<SafeResult<{ id: string }>> {
  let patch = { ...initialPatch };
  for (let i = 0; i < 6; i += 1) {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .update(patch)
      .eq("id", contactId)
      .select("id")
      .single();
    if (!error) {
      return { data: (data as { id: string }) ?? null, error: null };
    }
    const stripped = dropMissingColumn(patch, error);
    if (stripped) {
      patch = stripped;
      continue;
    }
    return {
      data: null,
      error: {
        code: error.code ?? null,
        message: error.message,
        hint: error.hint ?? null,
      },
    };
  }
  return {
    data: null,
    error: {
      code: "exhausted",
      message:
        "Exhausted retries stripping unknown contacts columns. Apply pending Supabase migrations.",
    },
  };
}
