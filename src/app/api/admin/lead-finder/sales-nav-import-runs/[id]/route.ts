import { NextResponse } from "next/server";
import { requireLeadFinderAccess } from "@/lib/requireLeadFinderAccess";
import {
  loadImportJob,
  syncSalesNavImportJob,
} from "@/lib/salesNavigator/importJob";
import { salesNavImportJobPayload } from "@/lib/salesNavigator/importJobPayload";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

async function requireOwnedRun(userId: string, id: string) {
  const job = await loadImportJob(id);
  if (!job) return { error: "Import not found.", status: 404 as const };
  if (job.coach_id !== userId) {
    return { error: "Import not found.", status: 404 as const };
  }
  return { data: job };
}

/**
 * Load one import run. If still running, syncs Apify status / finalizes first.
 * Client polls this for background-import progress.
 */
export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireLeadFinderAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing run id." }, { status: 400 });
  }

  const owned = await requireOwnedRun(auth.userId, id);
  if ("error" in owned && owned.error) {
    return NextResponse.json(
      { error: owned.error },
      { status: owned.status ?? 500 }
    );
  }

  let job = owned.data!;
  if (job.status === "pending" || job.status === "running") {
    try {
      job = await syncSalesNavImportJob(job.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not sync import job.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  return NextResponse.json(salesNavImportJobPayload(job));
}

/** Rename an import run. */
export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireLeadFinderAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing run id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = typeof body.name === "string" ? body.name.trim() || null : null;

  const owned = await requireOwnedRun(auth.userId, id);
  if ("error" in owned && owned.error) {
    return NextResponse.json(
      { error: owned.error },
      { status: owned.status ?? 500 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("sales_nav_import_runs")
    .update({ name })
    .eq("id", id.trim())
    .eq("coach_id", auth.userId)
    .select("id, name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : null,
  });
}

/**
 * Remove an import from History. Does not delete leads from the shared cache.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await requireLeadFinderAccess(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing run id." }, { status: 400 });
  }

  const owned = await requireOwnedRun(auth.userId, id);
  if ("error" in owned && owned.error) {
    return NextResponse.json(
      { error: owned.error },
      { status: owned.status ?? 500 }
    );
  }

  if (owned.data!.status === "running" || owned.data!.status === "pending") {
    return NextResponse.json(
      { error: "Wait for the import to finish before removing it." },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin
    .from("sales_nav_import_runs")
    .delete()
    .eq("id", id.trim())
    .eq("coach_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: id.trim() });
}
