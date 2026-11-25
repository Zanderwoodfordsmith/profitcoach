import { after, NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  copyLeadListItems,
  createCoachAudienceList,
  insertPeopleOnList,
  isLeadListUuid,
  loadOwnedLeadList,
  mapAudiencePeopleInput,
  MAX_LIST_ITEMS_PER_REQUEST,
  MAX_LIST_ITEMS_TOTAL,
  parsePastedAudienceLines,
  recountLeadListItems,
  removeMatchingLeadListItems,
  type AudienceItemSource,
} from "@/lib/leadLists/audienceLists";
import { syncPersonAcrossLists } from "@/lib/leadLists/syncPersonAcrossLists";
import { asFitLabel } from "@/lib/pool/fit";
import { CHECK_FIT_MAX, checkPeopleFit, rerateListFit, setPeopleFit } from "@/lib/pool/fitCheck";
import { asFitBefore, asFitCall, makeFitCall, setFitReason, undoFitCall } from "@/lib/pool/fitCalls";
import {
  MAX_PROSPECT_TAGS,
  normalizeProspectTags,
} from "@/lib/prospects/tags";

type Ctx = { params: Promise<{ id: string }> };

/** Ava's check can label up to 200 people in one go. */
export const maxDuration = 300;
// Check fit's re-sort (job 285) runs after the reply and can take a few minutes for a big list.

function parseItemIds(
  raw: unknown,
  cap = MAX_LIST_ITEMS_PER_REQUEST
): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (value): value is string =>
        typeof value === "string" && isLeadListUuid(value)
    )
    .slice(0, cap);
}

function mergeItemTags(
  current: string[],
  add: string[],
  remove: string[]
): string[] {
  const removeKeys = new Set(remove.map((tag) => tag.toLowerCase()));
  const next = current.filter((tag) => !removeKeys.has(tag.toLowerCase()));
  const seen = new Set(next.map((tag) => tag.toLowerCase()));
  for (const tag of add) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(tag);
    if (next.length >= MAX_PROSPECT_TAGS) break;
  }
  return normalizeProspectTags(next);
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!isLeadListUuid(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const list = await loadOwnedLeadList(auth.userId, id);
  if (!list) {
    return NextResponse.json({ error: "List not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    people?: unknown;
    text?: string;
    source?: string;
    item_ids?: unknown;
    add?: unknown;
    remove?: unknown;
    target_list_id?: unknown;
    name?: unknown;
    fit?: unknown;
    item_id?: unknown;
    call?: unknown;
    reason?: unknown;
    before?: unknown;
  };

  // Check fit (job 285): one call at a time, its reason, Undo, then Ava re-sorts the rest.
  if (body.action === "fit_call" || body.action === "fit_reason" || body.action === "fit_undo") {
    const itemId = typeof body.item_id === "string" && isLeadListUuid(body.item_id) ? body.item_id : null;
    const call = asFitCall(body.call);
    if (!itemId || (body.action !== "fit_reason" && !call)) {
      return NextResponse.json({ error: "Pick a person and a call." }, { status: 400 });
    }
    try {
      if (body.action === "fit_call") {
        const result = await makeFitCall(auth.userId, itemId, call!, body.reason);
        return NextResponse.json({ ok: true, ...result });
      }
      if (body.action === "fit_reason") {
        await setFitReason(auth.userId, itemId, body.reason);
        return NextResponse.json({ ok: true });
      }
      const before = asFitBefore(body.before);
      if (!before) return NextResponse.json({ error: "Nothing to undo." }, { status: 400 });
      await undoFitCall(auth.userId, itemId, call!, before);
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not save that." },
        { status: 500 }
      );
    }
  }

  if (body.action === "fit_rerate") {
    const coachId = auth.userId;
    after(async () => {
      await rerateListFit(coachId, id).catch((err) => console.error("[fit_rerate]", err));
    });
    return NextResponse.json({ ok: true, started: true });
  }

  // Fit (job 278): the coach or BCA sets Good, OK or Bad (or clears it), or asks Ava to check.
  if (body.action === "set_fit") {
    const itemIds = parseItemIds(body.item_ids, MAX_LIST_ITEMS_TOTAL);
    if (!itemIds.length) {
      return NextResponse.json({ error: "Select people first." }, { status: 400 });
    }
    const fit = body.fit === null ? null : asFitLabel(body.fit);
    if (fit === null && body.fit !== null) {
      return NextResponse.json({ error: "Choose Good, OK or Bad." }, { status: 400 });
    }
    try {
      const updated = await setPeopleFit(auth.userId, itemIds, fit);
      return NextResponse.json({ ok: true, updated });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not change their fit." },
        { status: 500 }
      );
    }
  }

  if (body.action === "check_fit") {
    const itemIds = parseItemIds(body.item_ids, CHECK_FIT_MAX);
    if (!itemIds.length) {
      return NextResponse.json({ error: "Select people for Ava to check." }, { status: 400 });
    }
    try {
      const result = await checkPeopleFit(auth.userId, itemIds);
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Ava couldn't check them." },
        { status: 500 }
      );
    }
  }

  if (body.action === "update_tags") {
    const itemIds = parseItemIds(body.item_ids);
    const add = normalizeProspectTags(body.add);
    const remove = normalizeProspectTags(body.remove);
    if (!itemIds.length) {
      return NextResponse.json(
        { error: "Select people to tag." },
        { status: 400 }
      );
    }
    if (!add.length && !remove.length) {
      return NextResponse.json(
        { error: "Choose at least one tag to add or remove." },
        { status: 400 }
      );
    }

    const { data: rows, error: loadError } = await supabaseAdmin
      .from("coach_lead_list_items")
      .select("id, tags, identity_key")
      .eq("coach_id", auth.userId)
      .eq("list_id", id)
      .in("id", itemIds);
    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }

    const updates = (rows ?? []).map((row) => ({
      id: row.id as string,
      tags: mergeItemTags(normalizeProspectTags(row.tags), add, remove),
    }));

    for (const update of updates) {
      const source = (rows ?? []).find((row) => row.id === update.id);
      const identityKey =
        typeof source?.identity_key === "string" ? source.identity_key : "";
      if (identityKey) {
        try {
          await syncPersonAcrossLists({
            coachId: auth.userId,
            identityKey,
            fields: { tags: update.tags },
          });
        } catch (err) {
          return NextResponse.json(
            { error: err instanceof Error ? err.message : "Could not update tags." },
            { status: 500 }
          );
        }
        continue;
      }
      const { error } = await supabaseAdmin
        .from("coach_lead_list_items")
        .update({ tags: update.tags })
        .eq("id", update.id)
        .eq("coach_id", auth.userId)
        .eq("list_id", id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      updated: updates.length,
      items: updates,
    });
  }

  if (body.action === "copy_to_list") {
    const itemIds = parseItemIds(body.item_ids, MAX_LIST_ITEMS_TOTAL);
    if (!itemIds.length) {
      return NextResponse.json(
        { error: "Select people to add." },
        { status: 400 }
      );
    }

    let targetListId =
      typeof body.target_list_id === "string" && isLeadListUuid(body.target_list_id)
        ? body.target_list_id
        : null;
    let createdList = null as Awaited<
      ReturnType<typeof createCoachAudienceList>
    > | null;

    if (!targetListId) {
      const name =
        typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return NextResponse.json(
          { error: "Pick a list or give the new list a name." },
          { status: 400 }
        );
      }
      try {
        createdList = await createCoachAudienceList({
          coachId: auth.userId,
          name,
          source: list.source,
          filters: { from_pool_import: true },
        });
        targetListId = createdList.id;
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof Error ? err.message : "Could not create list.",
          },
          { status: 400 }
        );
      }
    }

    try {
      const result = await copyLeadListItems({
        coachId: auth.userId,
        sourceListId: id,
        targetListId,
        itemIds,
      });
      return NextResponse.json({
        ...result,
        leadList: createdList,
        targetListId,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not add people to that list.";
      const status =
        message === "List not found." || message === "Source list not found."
          ? 404
          : message.includes("Pick a different") ||
              message.includes("Blacklist") ||
              message.includes("named list")
            ? 400
            : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  if (body.action === "remove_from_list") {
    const itemIds = parseItemIds(body.item_ids);
    const targetListId =
      typeof body.target_list_id === "string" && isLeadListUuid(body.target_list_id)
        ? body.target_list_id
        : null;
    if (!itemIds.length) {
      return NextResponse.json(
        { error: "Select people to remove." },
        { status: 400 }
      );
    }
    if (!targetListId) {
      return NextResponse.json(
        { error: "Pick a list to remove from." },
        { status: 400 }
      );
    }

    try {
      const result = await removeMatchingLeadListItems({
        coachId: auth.userId,
        sourceListId: id,
        targetListId,
        itemIds,
      });
      return NextResponse.json({ ...result, targetListId });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not remove people from that list.";
      const status =
        message === "List not found." || message === "Source list not found."
          ? 404
          : message.includes("Pick a different") ||
              message.includes("Blacklist") ||
              message.includes("named list")
            ? 400
            : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  if (body.action === "move_to_blacklist") {
    if (list.kind === "blacklist") {
      return NextResponse.json(
        { error: "Those people are already on the blacklist." },
        { status: 400 }
      );
    }
    const itemIds = parseItemIds(body.item_ids);
    if (!itemIds.length) {
      return NextResponse.json(
        { error: "Select people to blacklist." },
        { status: 400 }
      );
    }

    const { data: rows } = await supabaseAdmin
      .from("coach_lead_list_items")
      .select(
        "id, full_name, first_name, last_name, job_title, company, linkedin_url"
      )
      .eq("coach_id", auth.userId)
      .eq("list_id", id)
      .in("id", itemIds);

    const people = mapAudiencePeopleInput(
      (rows ?? []).map((row) => ({
        linkedin_url: row.linkedin_url,
        first_name: row.first_name,
        last_name: row.last_name,
        full_name: row.full_name,
        company: row.company,
        title: row.job_title,
      })),
      "manual"
    );

    const { data: blacklist } = await supabaseAdmin
      .from("coach_lead_lists")
      .select("id")
      .eq("coach_id", auth.userId)
      .eq("kind", "blacklist")
      .maybeSingle();
    if (!blacklist?.id) {
      return NextResponse.json(
        { error: "Blacklist is missing." },
        { status: 500 }
      );
    }

    try {
      const result = await insertPeopleOnList({
        coachId: auth.userId,
        listId: blacklist.id,
        kind: "blacklist",
        people,
      });

      await supabaseAdmin
        .from("coach_lead_list_items")
        .delete()
        .eq("coach_id", auth.userId)
        .eq("list_id", id)
        .in("id", itemIds);

      const itemCount = await recountLeadListItems(id);
      await recountLeadListItems(blacklist.id);

      return NextResponse.json({
        ...result,
        itemCount,
        moved: itemIds.length,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Could not blacklist those people.",
        },
        { status: 500 }
      );
    }
  }

  const source: AudienceItemSource =
    body.source === "search" ? "search" : "manual";
  const fromText =
    typeof body.text === "string" ? parsePastedAudienceLines(body.text) : [];
  const people = [
    ...fromText,
    ...mapAudiencePeopleInput(body.people, source),
  ].slice(0, MAX_LIST_ITEMS_PER_REQUEST);

  if (!people.length) {
    return NextResponse.json(
      { error: "Add at least one LinkedIn profile URL." },
      { status: 400 }
    );
  }

  try {
    const result = await insertPeopleOnList({
      coachId: auth.userId,
      listId: id,
      kind: list.kind,
      people,
    });
    const itemCount = await recountLeadListItems(id);
    return NextResponse.json({ ...result, itemCount });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not add people." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!isLeadListUuid(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const list = await loadOwnedLeadList(auth.userId, id);
  if (!list) {
    return NextResponse.json({ error: "List not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    item_ids?: unknown;
  };
  const itemIds = parseItemIds(body.item_ids);
  if (!itemIds.length) {
    return NextResponse.json(
      { error: "Select people to delete." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("coach_lead_list_items")
    .delete()
    .eq("coach_id", auth.userId)
    .eq("list_id", id)
    .in("id", itemIds);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const itemCount = await recountLeadListItems(id);
  return NextResponse.json({ ok: true, removed: itemIds.length, itemCount });
}
