import { NextResponse } from "next/server";
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
  parsePastedAudienceLines,
  recountLeadListItems,
  removeMatchingLeadListItems,
  type AudienceItemSource,
} from "@/lib/leadLists/audienceLists";
import {
  MAX_PROSPECT_TAGS,
  normalizeProspectTags,
} from "@/lib/prospects/tags";

type Ctx = { params: Promise<{ id: string }> };

function parseItemIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (value): value is string =>
        typeof value === "string" && isLeadListUuid(value)
    )
    .slice(0, MAX_LIST_ITEMS_PER_REQUEST);
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
  };

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
      .select("id, tags")
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
    const itemIds = parseItemIds(body.item_ids);
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
