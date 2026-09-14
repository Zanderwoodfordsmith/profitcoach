import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { fetchAllSupabasePages } from "@/lib/contactsSchemaSafeSelect";
import {
  displayListPersonName,
  ensureCoachBlacklist,
  ensureCoachPool,
  listItemCapForKind,
  loadBlacklistedEmails,
  loadBlacklistedLinkedInUrls,
  loadEnrolledEmails,
  loadEnrolledLinkedInUrls,
  mapLeadListToSummary,
  parsePastedAudienceLines,
  recountLeadListItems,
  type AudienceItemSource,
} from "@/lib/leadLists/audienceLists";
import { insertPoolRecords } from "@/lib/googleMaps/flushPlacesToPool";
import { normalizePoolEmail, poolIdentityKey } from "@/lib/pool/identity";
import { mapPoolPeopleInput } from "@/lib/pool/mapPoolPeopleInput";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { poolAddressFromRaw, type PoolPerson, type PoolStats } from "@/lib/pool/poolPeople";
import { normalizeProspectTags } from "@/lib/prospects/tags";

const POOL_ITEM_SELECT =
  "id, full_name, first_name, last_name, job_title, company, linkedin_url, email, phone, website, place_id, source, created_at, tags, raw";

const POOL_PREVIEW_MAX = 50;

function mapPoolItem(
  item: Record<string, unknown>,
  enrolled: Set<string>,
  enrolledEmails: Set<string>,
  blacklisted: Set<string>,
  blacklistedEmails: Set<string>
): PoolPerson {
  const url = normalizeLinkedInProfileUrl(String(item.linkedin_url ?? ""));
  const email = normalizePoolEmail(
    typeof item.email === "string" ? item.email : null
  );
  const placeId =
    typeof item.place_id === "string" && item.place_id.trim()
      ? item.place_id.trim()
      : null;
  const linkedinCampaignable = Boolean(url);
  const emailCampaignable = Boolean(email);
  return {
    id: item.id as string,
    full_name: displayListPersonName(item),
    first_name: (item.first_name as string | null) ?? null,
    last_name: (item.last_name as string | null) ?? null,
    job_title: (item.job_title as string | null) ?? null,
    company: (item.company as string | null) ?? null,
    linkedin_url: url,
    email,
    phone: (item.phone as string | null) ?? null,
    website: (item.website as string | null) ?? null,
    address: poolAddressFromRaw(item.raw),
    place_id: placeId,
    source: String(item.source ?? "manual"),
    created_at: (item.created_at as string | null) ?? null,
    tags: normalizeProspectTags(item.tags),
    in_campaign:
      (url ? enrolled.has(url) : false) ||
      (email ? enrolledEmails.has(email) : false),
    blacklisted:
      (url ? blacklisted.has(url) : false) ||
      (email ? blacklistedEmails.has(email) : false),
    campaignable: linkedinCampaignable || emailCampaignable,
    linkedinCampaignable,
    emailCampaignable,
    canFindPerson: Boolean(placeId) && !url,
  };
}

export async function GET(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const reqUrl = new URL(request.url);
    const requestedListId = reqUrl.searchParams.get("listId")?.trim();
    const limitRaw = reqUrl.searchParams.get("limit");
    const previewLimit = limitRaw
      ? Math.min(
          POOL_PREVIEW_MAX,
          Math.max(1, Math.floor(Number(limitRaw)) || 0)
        )
      : null;

    const pool = await ensureCoachPool(auth.userId);
    let activeList = pool;
    if (requestedListId && requestedListId !== pool.id) {
      const { data: owned } = await supabaseAdmin
        .from("coach_lead_lists")
        .select("id, name, kind, source, item_count, updated_at, created_at, filters")
        .eq("id", requestedListId)
        .eq("coach_id", auth.userId)
        .maybeSingle();
      if (!owned) {
        return NextResponse.json({ error: "List not found." }, { status: 404 });
      }
      if (owned.kind === "blacklist") {
        return NextResponse.json(
          { error: "Blacklist cannot be opened as a pool tab." },
          { status: 400 }
        );
      }
      activeList = mapLeadListToSummary(owned);
    }
    const activeListId = activeList.id as string;

    /** Fast first paint: skip campaign/blacklist sets (filled in on full load). */
    if (previewLimit != null) {
      const { data: previewItems, error: previewError } = await supabaseAdmin
        .from("coach_lead_list_items")
        .select(POOL_ITEM_SELECT)
        .eq("coach_id", auth.userId)
        .eq("list_id", activeListId)
        .order("created_at", { ascending: false })
        .range(0, previewLimit - 1);
      if (previewError) {
        throw new Error(previewError.message || "Unable to load pool.");
      }
      const empty = new Set<string>();
      const people = (previewItems ?? []).map((item) =>
        mapPoolItem(item as Record<string, unknown>, empty, empty, empty, empty)
      );
      return NextResponse.json({
        list: activeList,
        poolListId: pool.id,
        people,
        preview: true,
        hasMore: people.length >= previewLimit,
        stats: null,
      });
    }

    await ensureCoachBlacklist(auth.userId);

    const [
      itemsPage,
      enrolled,
      enrolledEmails,
      blacklisted,
      blacklistedEmails,
    ] = await Promise.all([
      fetchAllSupabasePages(async (from, to) =>
        supabaseAdmin
          .from("coach_lead_list_items")
          .select(POOL_ITEM_SELECT)
          .eq("coach_id", auth.userId)
          .eq("list_id", activeListId)
          .order("created_at", { ascending: false })
          .range(from, to)
      ),
      loadEnrolledLinkedInUrls(auth.userId),
      loadEnrolledEmails(auth.userId),
      loadBlacklistedLinkedInUrls(auth.userId),
      loadBlacklistedEmails(auth.userId),
    ]);
    if (itemsPage.error) {
      throw new Error(itemsPage.error.message || "Unable to load pool.");
    }
    const items = itemsPage.data;

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const people: PoolPerson[] = items.map((item) =>
      mapPoolItem(
        item as Record<string, unknown>,
        enrolled,
        enrolledEmails,
        blacklisted,
        blacklistedEmails
      )
    );

    const stats: PoolStats = {
      total: people.length,
      addedLast30Days: people.filter((row) => {
        if (!row.created_at) return false;
        const t = new Date(row.created_at).getTime();
        return !Number.isNaN(t) && t >= cutoff;
      }).length,
      inCampaign: people.filter((row) => row.in_campaign).length,
      notInCampaign: people.filter((row) => !row.in_campaign).length,
    };

    return NextResponse.json({
      list: activeList,
      poolListId: pool.id,
      people,
      preview: false,
      hasMore: false,
      stats,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to load pool." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    people?: unknown;
    text?: string;
    source?: string;
  };

  const source: AudienceItemSource =
    body.source === "search"
      ? "search"
      : body.source === "sales_nav" || body.source === "sales_nav_csv"
        ? "sales_nav_csv"
        : "manual";
  const fromText =
    typeof body.text === "string"
      ? parsePastedAudienceLines(body.text).map((person) => ({
          source: person.source,
          full_name: displayListPersonName(person),
          first_name: person.first_name,
          last_name: person.last_name,
          job_title: person.title,
          company: person.company,
          linkedin_url: person.linkedin_url,
          email: person.email ?? null,
          phone: person.phone ?? null,
          website: null,
          place_id: null,
        }))
      : [];
  const people = [...fromText, ...mapPoolPeopleInput(body.people, source)];

  if (!people.length || people.every((person) => !poolIdentityKey(person))) {
    return NextResponse.json(
      {
        error:
          "Add a person with an email, phone, LinkedIn URL, or website.",
      },
      { status: 400 }
    );
  }

  try {
    const pool = await ensureCoachPool(auth.userId);
    const result = await insertPoolRecords({
      coachId: auth.userId,
      listId: pool.id,
      records: people,
      cap: listItemCapForKind("pool"),
    });
    const itemCount = await recountLeadListItems(pool.id);
    return NextResponse.json({
      added: result.added,
      skipped: result.skipped,
      blacklisted: result.blacklisted,
      invalid: result.invalid,
      itemCount,
      listId: pool.id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not import people." },
      { status: 500 }
    );
  }
}
