import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { fetchAllSupabasePagesParallel } from "@/lib/contactsSchemaSafeSelect";
import {
  campaignPersonKey,
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
import { asFitLabel } from "@/lib/pool/fit";
import {
  linkedInSlugFromUrl,
  mergeOutreach,
  NO_OUTREACH,
  outreachFromCampaignLead,
  type OutreachState,
} from "@/lib/pool/outreachStatus";

const POOL_ITEM_SELECT =
  "id, full_name, first_name, last_name, job_title, company, linkedin_url, email, phone, website, place_id, source, created_at, tags, maps_address:raw->google_maps->>address, maps_category:raw->google_maps->>category, contact_id, team_size, industry, location, source_rank, source_ranked_at, open_profile, linkedin_premium, fit, fit_why, fit_by";

const POOL_PREVIEW_MAX = 50;

/**
 * The list only needs two Google Maps fields from an item's import record, so
 * the select picks them out (maps_address, maps_category) instead of sending
 * the whole record. Rebuild the shape the raw helpers read.
 */
function poolItemRaw(item: Record<string, unknown>): unknown {
  if (item.raw !== undefined) return item.raw;
  const address = item.maps_address;
  const category = item.maps_category;
  if (address == null && category == null) return null;
  return { google_maps: { address, category } };
}

type CampaignMembership = {
  byUrl: Map<string, string[]>;
  byEmail: Map<string, string[]>;
  /** Name + company fallback for when the LinkedIn links differ. */
  byPerson: Map<string, string[]>;
  /** Furthest status per person (jobs 300, 301), keyed like the maps above. */
  outreachByUrl: Map<string, OutreachState>;
  outreachByEmail: Map<string, OutreachState>;
  outreachByPerson: Map<string, OutreachState>;
  /** By prospect contact id: campaign leads and booked calls. */
  outreachByContact: Map<string, OutreachState>;
  /** The coach's LinkedIn connections: profile slug → when they connected. */
  connectedBySlug: Map<string, string | null>;
};

const NO_MEMBERSHIP: CampaignMembership = {
  byUrl: new Map(),
  byEmail: new Map(),
  byPerson: new Map(),
  outreachByUrl: new Map(),
  outreachByEmail: new Map(),
  outreachByPerson: new Map(),
  outreachByContact: new Map(),
  connectedBySlug: new Map(),
};

function campaignIdsFor(
  url: string | null,
  email: string | null,
  personKey: string | null,
  membership: CampaignMembership
): string[] {
  const ids = new Set<string>();
  if (url) for (const id of membership.byUrl.get(url) ?? []) ids.add(id);
  if (email) for (const id of membership.byEmail.get(email) ?? []) ids.add(id);
  if (personKey) for (const id of membership.byPerson.get(personKey) ?? []) ids.add(id);
  return [...ids];
}

function outreachFor(
  url: string | null,
  email: string | null,
  personKey: string | null,
  contactId: string | null,
  membership: CampaignMembership
): OutreachState {
  let state = NO_OUTREACH;
  const add = (next: OutreachState | undefined) => {
    if (next) state = mergeOutreach(state, next);
  };
  if (url) add(membership.outreachByUrl.get(url));
  if (email) add(membership.outreachByEmail.get(email));
  if (personKey) add(membership.outreachByPerson.get(personKey));
  if (contactId) add(membership.outreachByContact.get(contactId));
  const slug = linkedInSlugFromUrl(url);
  if (slug && membership.connectedBySlug.has(slug)) {
    add({ status: "connected", at: membership.connectedBySlug.get(slug) ?? null });
  }
  return state;
}

function mapPoolItem(
  item: Record<string, unknown>,
  membership: CampaignMembership,
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
  const raw = poolItemRaw(item);
  const address = poolAddressFromRaw(raw);
  const location =
    typeof item.location === "string" && item.location.trim()
      ? item.location.trim()
      : null;
  const place = poolPlaceFields({ address, location });
  const teamSize =
    typeof item.team_size === "string" && item.team_size.trim()
      ? item.team_size.trim()
      : null;
  const personKey = campaignPersonKey(item);
  const campaignIds = campaignIdsFor(url, email, personKey, membership);
  const outreach = outreachFor(
    url,
    email,
    personKey,
    typeof item.contact_id === "string" && item.contact_id ? item.contact_id : null,
    membership
  );
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
    open_profile: item.open_profile === true ? true : item.open_profile === false ? false : null,
    linkedin_premium:
      item.linkedin_premium === true
        ? true
        : item.linkedin_premium === false
          ? false
          : null,
    industry: poolIndustryFromSources(
      typeof item.industry === "string" ? item.industry : null,
      raw
    ),
    place_id: placeId,
    source: String(item.source ?? "manual"),
    created_at: (item.created_at as string | null) ?? null,
    source_rank:
      typeof item.source_rank === "number" ? item.source_rank : null,
    source_ranked_at: (item.source_ranked_at as string | null) ?? null,
    tags: normalizeProspectTags(item.tags),
    fit: asFitLabel(item.fit),
    fit_why: typeof item.fit_why === "string" && item.fit_why ? item.fit_why : null,
    fit_by: item.fit_by === "person" ? "person" : item.fit_by === "ava" ? "ava" : null,
    campaign_ids: campaignIds,
    in_campaign: campaignIds.length > 0,
    outreach_status: outreach.status,
    outreach_status_at: outreach.at,
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

async function loadPoolCampaignMembership(
  coachId: string
): Promise<CampaignMembership> {
  const [page, network, bookings] = await Promise.all([
    fetchAllSupabasePagesParallel<{
      id: string;
      campaign_id: string | null;
      linkedin_url: string | null;
      linkedin_provider_id: string | null;
      contact_id: string | null;
      meta_email: string | null;
      meta_slug: string | null;
      first_name: string | null;
      last_name: string | null;
      company: string | null;
      status: string | null;
      invited_at: string | null;
      connected_at: string | null;
      replied_at: string | null;
      interest_logged_at: string | null;
    }>(async (from, to) =>
      supabaseAdmin
        .from("linkedin_campaign_leads")
        .select(
          "id, campaign_id, linkedin_url, linkedin_provider_id, contact_id, meta_email:metadata->>email, meta_slug:metadata->>public_identifier, first_name, last_name, company, status, invited_at, connected_at, replied_at, interest_logged_at"
        )
        .eq("coach_id", coachId)
        .order("created_at", { ascending: true })
        .range(from, to)
    ),
    fetchAllSupabasePagesParallel<{
      public_identifier: string | null;
      member_id: string | null;
      connected_at: string | null;
    }>(async (from, to) =>
      supabaseAdmin
        .from("coach_network_connections")
        .select("public_identifier, member_id, connected_at")
        .eq("coach_id", coachId)
        .order("public_identifier", { ascending: true })
        .range(from, to)
    ),
    // Sales calls booked (not BCA's own onboarding or support calls).
    supabaseAdmin
      .from("bookings")
      .select("contact_id, campaign_lead_id, prospect_email, created_at")
      .eq("coach_id", coachId)
      .eq("kind", "discovery")
      .neq("status", "cancelled")
      .limit(5000),
  ]);
  if (page.error) {
    throw new Error(page.error.message || "Unable to load campaigns.");
  }

  // LinkedIn's own list of the coach's connections, with the real date.
  // A failed read only loses the "Connected" detail, never the page.
  const connectedBySlug = new Map<string, string | null>();
  const connectedByMemberId = new Map<string, string | null>();
  if (!network.error) {
    for (const row of network.data) {
      const slug = row.public_identifier?.trim().toLowerCase();
      if (slug) connectedBySlug.set(slug, row.connected_at ?? null);
      const memberId = row.member_id?.trim();
      if (memberId) connectedByMemberId.set(memberId, row.connected_at ?? null);
    }
  }

  // Booked calls: matched by campaign lead, prospect contact or email.
  const bookedByLead = new Map<string, OutreachState>();
  const bookedByContact = new Map<string, OutreachState>();
  const bookedByEmail = new Map<string, OutreachState>();
  for (const booking of bookings.error ? [] : (bookings.data ?? [])) {
    const state: OutreachState = { status: "booked", at: booking.created_at ?? null };
    const put = (map: Map<string, OutreachState>, key: string | null | undefined) => {
      if (!key) return;
      const prev = map.get(key);
      map.set(key, prev ? mergeOutreach(prev, state) : state);
    };
    put(bookedByLead, booking.campaign_lead_id);
    put(bookedByContact, booking.contact_id);
    put(bookedByEmail, normalizePoolEmail(booking.prospect_email ?? null));
  }

  const byUrl = new Map<string, Set<string>>();
  const byEmail = new Map<string, Set<string>>();
  const byPerson = new Map<string, Set<string>>();
  const contactCampaigns = new Map<string, Set<string>>();
  const outreachByUrl = new Map<string, OutreachState>();
  const outreachByEmail = new Map<string, OutreachState>();
  const outreachByPerson = new Map<string, OutreachState>();
  const contactOutreach = new Map<string, OutreachState>();
  const add = (map: Map<string, Set<string>>, key: string, campaignId: string) => {
    const set = map.get(key) ?? new Set<string>();
    set.add(campaignId);
    map.set(key, set);
  };
  const addOutreach = (
    map: Map<string, OutreachState>,
    key: string,
    state: OutreachState
  ) => {
    const prev = map.get(key);
    map.set(key, prev ? mergeOutreach(prev, state) : state);
  };

  for (const row of page.data) {
    const campaignId =
      typeof row.campaign_id === "string" ? row.campaign_id : "";
    if (!campaignId) continue;
    const url = normalizeLinkedInProfileUrl(String(row.linkedin_url ?? ""));
    let outreach = outreachFromCampaignLead(row);
    const providerId = row.linkedin_provider_id?.trim();
    const slug = row.meta_slug?.trim().toLowerCase() || linkedInSlugFromUrl(url);
    const networkHit =
      (slug && connectedBySlug.has(slug)
        ? { at: connectedBySlug.get(slug) ?? null }
        : null) ??
      (providerId && connectedByMemberId.has(providerId)
        ? { at: connectedByMemberId.get(providerId) ?? null }
        : null);
    if (networkHit) {
      outreach = mergeOutreach(outreach, { status: "connected", at: networkHit.at });
    }
    const booked =
      bookedByLead.get(row.id) ??
      (row.contact_id ? bookedByContact.get(row.contact_id) : undefined);
    if (booked) outreach = mergeOutreach(outreach, booked);
    if (url) {
      add(byUrl, url, campaignId);
      addOutreach(outreachByUrl, url, outreach);
    }
    const personKey = campaignPersonKey(row);
    if (personKey) {
      add(byPerson, personKey, campaignId);
      addOutreach(outreachByPerson, personKey, outreach);
    }
    const fromMeta = normalizePoolEmail(
      typeof row.meta_email === "string" ? row.meta_email : null
    );
    if (fromMeta) {
      add(byEmail, fromMeta, campaignId);
      addOutreach(outreachByEmail, fromMeta, outreach);
    }
    if (typeof row.contact_id === "string" && row.contact_id) {
      add(contactCampaigns, row.contact_id, campaignId);
      addOutreach(contactOutreach, row.contact_id, outreach);
    }
  }

  const contactIds = [...contactCampaigns.keys()];
  const chunks: string[][] = [];
  for (let i = 0; i < contactIds.length; i += 200) {
    chunks.push(contactIds.slice(i, i + 200));
  }
  // Six lookups at a time rather than one after another.
  const contactRows: Array<{ id: unknown; email: unknown }> = [];
  for (let i = 0; i < chunks.length; i += 6) {
    const results = await Promise.all(
      chunks.slice(i, i + 6).map((chunk) =>
        supabaseAdmin
          .from("contacts")
          .select("id, email")
          .eq("coach_id", coachId)
          .in("id", chunk)
      )
    );
    for (const { data, error } of results) {
      if (error) throw new Error(error.message);
      contactRows.push(...(data ?? []));
    }
  }
  for (const contact of contactRows) {
    const email = normalizePoolEmail(
      typeof contact.email === "string" ? contact.email : null
    );
    const campaigns =
      typeof contact.id === "string"
        ? contactCampaigns.get(contact.id)
        : undefined;
    if (!email || !campaigns) continue;
    for (const campaignId of campaigns) add(byEmail, email, campaignId);
    const outreach =
      typeof contact.id === "string" ? contactOutreach.get(contact.id) : undefined;
    if (outreach) addOutreach(outreachByEmail, email, outreach);
  }
  for (const [contactId, state] of bookedByContact) {
    addOutreach(contactOutreach, contactId, state);
  }
  for (const [email, state] of bookedByEmail) {
    addOutreach(outreachByEmail, email, state);
  }

  const freeze = (map: Map<string, Set<string>>) => {
    const out = new Map<string, string[]>();
    for (const [key, ids] of map) out.set(key, [...ids]);
    return out;
  };
  return {
    byUrl: freeze(byUrl),
    byEmail: freeze(byEmail),
    byPerson: freeze(byPerson),
    outreachByUrl,
    outreachByEmail,
    outreachByPerson,
    outreachByContact: contactOutreach,
    connectedBySlug,
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
        mapPoolItem(
          item as Record<string, unknown>,
          NO_MEMBERSHIP,
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
      fetchAllSupabasePagesParallel(async (from, to) =>
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
        membership,
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
