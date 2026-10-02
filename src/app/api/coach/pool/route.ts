import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { fetchAllSupabasePages } from "@/lib/contactsSchemaSafeSelect";
import {
  copyMatchingPoolItemsOntoList,
  createCoachAudienceList,
  displayListPersonName,
  ensureCoachBlacklist,
  ensureCoachPool,
  isLeadListUuid,
  listItemCapForKind,
  loadBlacklistedEmails,
  loadBlacklistedLinkedInUrls,
  loadOwnedLeadList,
  mapLeadListToSummary,
  parsePastedAudienceLines,
  recountLeadListItems,
  type AudienceItemSource,
} from "@/lib/leadLists/audienceLists";
import { insertPoolRecords } from "@/lib/googleMaps/flushPlacesToPool";
import { normalizePoolEmail, normalizePoolPhone, poolIdentityKey } from "@/lib/pool/identity";
import { mapPoolPeopleInput } from "@/lib/pool/mapPoolPeopleInput";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  poolAddressFromRaw,
  poolIndustryFromSources,
  poolPlaceFields,
  type PoolPerson,
  type PoolStats,
} from "@/lib/pool/poolPeople";
import { normalizeProspectTags } from "@/lib/prospects/tags";

const POOL_ITEM_SELECT =
  "id, full_name, first_name, last_name, job_title, company, linkedin_url, email, phone, website, place_id, source, created_at, tags, raw, contact_id, team_size, industry, location";

const POOL_PREVIEW_MAX = 50;

function campaignIdsFor(
  url: string | null,
  email: string | null,
  byUrl: Map<string, string[]>,
  byEmail: Map<string, string[]>
): string[] {
  const ids = new Set<string>();
  if (url) for (const id of byUrl.get(url) ?? []) ids.add(id);
  if (email) for (const id of byEmail.get(email) ?? []) ids.add(id);
  return [...ids];
}

function mapPoolItem(
  item: Record<string, unknown>,
  campaignsByUrl: Map<string, string[]>,
  campaignsByEmail: Map<string, string[]>,
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
  const whatsappCampaignable = Boolean(
    normalizePoolPhone(typeof item.phone === "string" ? item.phone : null)
  );
  const address = poolAddressFromRaw(item.raw);
  const location =
    typeof item.location === "string" && item.location.trim()
      ? item.location.trim()
      : null;
  const place = poolPlaceFields({ address, location });
  const teamSize =
    typeof item.team_size === "string" && item.team_size.trim()
      ? item.team_size.trim()
      : null;
  const campaignIds = campaignIdsFor(url, email, campaignsByUrl, campaignsByEmail);
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
    address,
    location,
    city: place.city,
    postcode: place.postcode,
    team_size: teamSize,
    industry: poolIndustryFromSources(
      typeof item.industry === "string" ? item.industry : null,
      item.raw
    ),
    place_id: placeId,
    source: String(item.source ?? "manual"),
    created_at: (item.created_at as string | null) ?? null,
    tags: normalizeProspectTags(item.tags),
    campaign_ids: campaignIds,
    in_campaign: campaignIds.length > 0,
    blacklisted:
      (url ? blacklisted.has(url) : false) ||
      (email ? blacklistedEmails.has(email) : false),
    campaignable: linkedinCampaignable || emailCampaignable || whatsappCampaignable,
    linkedinCampaignable,
    emailCampaignable,
    whatsappCampaignable,
    canFindPerson: Boolean(placeId) && !url,
    contact_id:
      typeof item.contact_id === "string" && item.contact_id
        ? item.contact_id
        : null,
  };
}

async function loadPoolCampaignMembership(coachId: string): Promise<{
  byUrl: Map<string, string[]>;
  byEmail: Map<string, string[]>;
}> {
  const page = await fetchAllSupabasePages<{
    campaign_id: string | null;
    linkedin_url: string | null;
    contact_id: string | null;
    metadata: unknown;
  }>(async (from, to) =>
    supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("campaign_id, linkedin_url, contact_id, metadata")
      .eq("coach_id", coachId)
      .order("created_at", { ascending: true })
      .range(from, to)
  );
  if (page.error) {
    throw new Error(page.error.message || "Unable to load campaigns.");
  }

  const byUrl = new Map<string, Set<string>>();
  const byEmail = new Map<string, Set<string>>();
  const contactCampaigns = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, key: string, campaignId: string) => {
    const set = map.get(key) ?? new Set<string>();
    set.add(campaignId);
    map.set(key, set);
  };

  for (const row of page.data) {
    const campaignId =
      typeof row.campaign_id === "string" ? row.campaign_id : "";
    if (!campaignId) continue;
    const url = normalizeLinkedInProfileUrl(String(row.linkedin_url ?? ""));
    if (url) add(byUrl, url, campaignId);
    const meta =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    const fromMeta = normalizePoolEmail(
      typeof meta.email === "string" ? meta.email : null
    );
    if (fromMeta) add(byEmail, fromMeta, campaignId);
    if (typeof row.contact_id === "string" && row.contact_id) {
      add(contactCampaigns, row.contact_id, campaignId);
    }
  }

  const contactIds = [...contactCampaigns.keys()];
  for (let i = 0; i < contactIds.length; i += 200) {
    const chunk = contactIds.slice(i, i + 200);
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select("id, email")
      .eq("coach_id", coachId)
      .in("id", chunk);
    if (error) throw new Error(error.message);
    for (const contact of data ?? []) {
      const email = normalizePoolEmail(
        typeof contact.email === "string" ? contact.email : null
      );
      const campaigns =
        typeof contact.id === "string"
          ? contactCampaigns.get(contact.id)
          : undefined;
      if (!email || !campaigns) continue;
      for (const campaignId of campaigns) add(byEmail, email, campaignId);
    }
  }

  const freeze = (map: Map<string, Set<string>>) => {
    const out = new Map<string, string[]>();
    for (const [key, ids] of map) out.set(key, [...ids]);
    return out;
  };
  return { byUrl: freeze(byUrl), byEmail: freeze(byEmail) };
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
      const noCampaigns = new Map<string, string[]>();
      const people = (previewItems ?? []).map((item) =>
        mapPoolItem(
          item as Record<string, unknown>,
          noCampaigns,
          noCampaigns,
          empty,
          empty
        )
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
      membership,
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
      loadPoolCampaignMembership(auth.userId),
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
        membership.byUrl,
        membership.byEmail,
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
    list_id?: unknown;
    list_name?: unknown;
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
    let targetListId: string | null = null;
    let targetListName: string | null = null;
    const requestedName =
      typeof body.list_name === "string" ? body.list_name.trim() : "";
    const requestedId =
      typeof body.list_id === "string" && isLeadListUuid(body.list_id)
        ? body.list_id
        : null;
    if (requestedName) {
      const created = await createCoachAudienceList({
        coachId: auth.userId,
        name: requestedName,
        source: "manual",
        filters: { from_pool_import: true },
      });
      targetListId = created.id;
      targetListName = created.name;
    } else if (requestedId && requestedId !== pool.id) {
      const owned = await loadOwnedLeadList(auth.userId, requestedId);
      if (!owned || owned.kind === "blacklist") {
        return NextResponse.json({ error: "List not found." }, { status: 404 });
      }
      targetListId = owned.id;
      targetListName = owned.name;
    }

    const result = await insertPoolRecords({
      coachId: auth.userId,
      listId: pool.id,
      records: people,
      cap: listItemCapForKind("pool"),
      touchExisting: true,
    });

    if (targetListId) {
      const keys = people
        .map((person) => poolIdentityKey(person))
        .filter((key): key is string => Boolean(key));
      await copyMatchingPoolItemsOntoList({
        coachId: auth.userId,
        targetListId,
        identityKeys: keys,
      });
    }

    const itemCount = await recountLeadListItems(pool.id);
    return NextResponse.json({
      added: result.added,
      skipped: result.skipped,
      blacklisted: result.blacklisted,
      invalid: result.invalid,
      itemCount,
      listId: pool.id,
      targetListId,
      targetListName,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not import people." },
      { status: 500 }
    );
  }
}
