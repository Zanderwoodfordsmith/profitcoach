import { clampGoogleMapsMaxPlaces } from "@/lib/googleMaps/cost";
import { splitPersonName } from "@/lib/leadLists/audienceLists";
import {
  normalizeGooglePlaceId,
  normalizePoolEmail,
  normalizePoolPhone,
  normalizePoolWebsite,
} from "@/lib/pool/identity";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";

export type MappedGoogleMapsLead = {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
};

export type MappedGoogleMapsPlace = {
  placeId: string | null;
  title: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  category: string | null;
  instagrams: string[];
  facebooks: string[];
  companyLinkedIns: string[];
  lead: MappedGoogleMapsLead | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringList(value: unknown): string[] {
  if (typeof value === "string") {
    const one = value.trim();
    return one ? [one] : [];
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function firstEmail(rec: Record<string, unknown>): string | null {
  const direct = normalizePoolEmail(asString(rec.email));
  if (direct) return direct;
  for (const item of asStringList(rec.emails)) {
    const email = normalizePoolEmail(item);
    if (email) return email;
  }
  const details = asRecord(rec.contactDetails);
  if (details) {
    for (const item of asStringList(details.emails)) {
      const email = normalizePoolEmail(item);
      if (email) return email;
    }
  }
  return null;
}

function mapLead(value: unknown): MappedGoogleMapsLead | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const linkedinUrl =
    normalizeLinkedInProfileUrl(asString(rec.linkedinProfile) ?? "") ??
    normalizeLinkedInProfileUrl(asString(rec.linkedinUrl) ?? "") ??
    normalizeLinkedInProfileUrl(asString(rec.linkedin) ?? "");
  const fullName =
    asString(rec.fullName) ??
    asString(rec.name) ??
    ([asString(rec.firstName), asString(rec.lastName)]
      .filter(Boolean)
      .join(" ")
      .trim() ||
      null);
  const split = splitPersonName(fullName);
  const email =
    normalizePoolEmail(asString(rec.email)) ??
    normalizePoolEmail(asString(rec.workEmail));
  const phone =
    normalizePoolPhone(asString(rec.mobileNumber)) ??
    normalizePoolPhone(asString(rec.phone));
  if (!fullName && !linkedinUrl && !email) return null;
  return {
    fullName,
    firstName: asString(rec.firstName) ?? split.first_name,
    lastName: asString(rec.lastName) ?? split.last_name,
    jobTitle: asString(rec.jobTitle) ?? asString(rec.headline),
    email,
    phone,
    linkedinUrl,
  };
}

function leadsFromPlace(rec: Record<string, unknown>): MappedGoogleMapsLead[] {
  const buckets = [rec.leadsEnrichment, rec.leads, rec.businessLeads, rec.lead];
  const out: MappedGoogleMapsLead[] = [];
  for (const bucket of buckets) {
    if (Array.isArray(bucket)) {
      for (const item of bucket) {
        const lead = mapLead(item);
        if (lead) out.push(lead);
      }
    } else {
      const lead = mapLead(bucket);
      if (lead) out.push(lead);
    }
  }
  return out;
}

function looksLikeStandaloneLead(rec: Record<string, unknown>): boolean {
  if (asString(rec.placeId) || asString(rec.title)) return false;
  return Boolean(
    asString(rec.linkedinProfile) ||
      asString(rec.fullName) ||
      asString(rec.jobTitle)
  );
}

export function mapGoogleMapsDatasetItems(
  items: unknown[]
): MappedGoogleMapsPlace[] {
  const places: MappedGoogleMapsPlace[] = [];
  const byPlaceId = new Map<string, MappedGoogleMapsPlace>();
  const pendingLeads: MappedGoogleMapsLead[] = [];

  for (const item of items) {
    const rec = asRecord(item);
    if (!rec) continue;

    if (looksLikeStandaloneLead(rec)) {
      const lead = mapLead(rec);
      if (lead) pendingLeads.push(lead);
      continue;
    }

    const title = asString(rec.title) ?? asString(rec.name);
    if (!title) continue;
    const placeId = normalizeGooglePlaceId(
      asString(rec.placeId) ?? asString(rec.place_id)
    );
    const website =
      asString(rec.website) ??
      (normalizePoolWebsite(asString(rec.website))
        ? asString(rec.website)
        : null);
    const phone =
      normalizePoolPhone(asString(rec.phoneUnformatted)) ??
      normalizePoolPhone(asString(rec.phone));
    const mapped: MappedGoogleMapsPlace = {
      placeId,
      title,
      website,
      phone,
      email: firstEmail(rec),
      address: asString(rec.address),
      category: asString(rec.categoryName),
      instagrams: asStringList(rec.instagrams),
      facebooks: asStringList(rec.facebooks),
      companyLinkedIns: asStringList(rec.linkedIns),
      lead: leadsFromPlace(rec)[0] ?? null,
    };
    if (placeId && byPlaceId.has(placeId)) {
      const existing = byPlaceId.get(placeId)!;
      if (!existing.lead && mapped.lead) existing.lead = mapped.lead;
      continue;
    }
    places.push(mapped);
    if (placeId) byPlaceId.set(placeId, mapped);
  }

  for (const lead of pendingLeads) {
    const unmatched = places.find((place) => !place.lead);
    if (unmatched) unmatched.lead = lead;
  }

  return places;
}

export function limitGoogleMapsPlaces(
  places: MappedGoogleMapsPlace[],
  maxPlaces: number
): MappedGoogleMapsPlace[] {
  const cap = clampGoogleMapsMaxPlaces(maxPlaces);
  const out: MappedGoogleMapsPlace[] = [];
  const seen = new Set<string>();
  for (const place of places) {
    const key = place.placeId || `title:${place.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(place);
    if (out.length >= cap) break;
  }
  return out;
}
