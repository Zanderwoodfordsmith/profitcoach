/**
 * Find-or-create a prospect contact from a coach pool / import list item.
 * Stored Sales Nav fields on the pool row are used as-is; opening does not
 * wait on a Leadrocks lookup.
 */

import { resolveOrCreateContact } from "@/lib/contacts/resolveOrCreateContact";
import { displayListPersonName } from "@/lib/leadLists/audienceLists";
import {
  prospectWorkspacePath,
} from "@/lib/prospects/loadEnrichedProspect";
import {
  normalizeProspectTags,
} from "@/lib/prospects/tags";
import { splitFullName } from "@/lib/splitFullName";
import { normalizeLinkedInProfileUrl } from "@/lib/unipile/linkedinUrl";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type OpenPoolPersonResult = {
  contactId: string;
  created: boolean;
  href: string;
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

function salesNavEnrichment(raw: Record<string, unknown> | null): {
  headline: string | null;
  about: string | null;
  photoUrl: string | null;
  location: string | null;
  providerId: string | null;
} {
  const sn = asRecord(raw?.sales_nav) ?? raw;
  if (!sn) {
    return {
      headline: asString(raw?.headline),
      about: null,
      photoUrl: asString(raw?.photo_url),
      location: null,
      providerId: null,
    };
  }

  const positions = Array.isArray(sn.current_positions)
    ? sn.current_positions
    : Array.isArray(sn.currentPositions)
      ? sn.currentPositions
      : [];
  const position = asRecord(positions[0]);

  const headline = asString(sn.headline) ?? asString(raw?.headline);
  const about =
    asString(sn.about) ??
    asString(sn.summary) ??
    asString(position?.description) ??
    null;

  return {
    headline,
    about,
    photoUrl:
      asString(sn.profile_picture_url) ??
      asString(sn.profile_picture_url_large) ??
      asString(sn.pictureUrl) ??
      asString(raw?.photo_url),
    location: asString(sn.location),
    providerId:
      asString(sn.id) ??
      asString(sn.member_urn)?.replace(/^urn:li:member:/, "") ??
      null,
  };
}

function workspaceHref(contactId: string, admin?: boolean): string {
  return `${prospectWorkspacePath(contactId, { admin })}?from=pool`;
}

export async function openPoolPersonAsProspect(opts: {
  coachId: string;
  itemId: string;
  admin?: boolean;
}): Promise<OpenPoolPersonResult> {
  const { data: item, error } = await supabaseAdmin
    .from("coach_lead_list_items")
    .select(
      "id, coach_id, full_name, first_name, last_name, job_title, company, linkedin_url, email, phone, raw, source, tags, contact_id"
    )
    .eq("id", opts.itemId)
    .eq("coach_id", opts.coachId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!item) throw new Error("Pool person not found.");

  const existingContactId = asString(item.contact_id);
  if (existingContactId) {
    return {
      contactId: existingContactId,
      created: false,
      href: workspaceHref(existingContactId, opts.admin),
    };
  }

  const linkedinUrl = normalizeLinkedInProfileUrl(
    String(item.linkedin_url ?? "")
  );
  const email =
    typeof item.email === "string" ? item.email.trim() || null : null;
  const phone =
    typeof item.phone === "string" ? item.phone.trim() || null : null;

  if (!linkedinUrl && !email && !phone) {
    throw new Error(
      "This pool person needs a LinkedIn profile, email, or phone before you can open them."
    );
  }

  const fullName =
    displayListPersonName(item) ||
    [item.first_name, item.last_name].filter(Boolean).join(" ").trim() ||
    "Unknown";
  const split = splitFullName(fullName);
  const firstName =
    (typeof item.first_name === "string" && item.first_name.trim()) ||
    split.first_name ||
    null;
  const lastName =
    (typeof item.last_name === "string" && item.last_name.trim()) ||
    split.last_name ||
    null;

  const itemRaw = asRecord(item.raw);
  const fromRaw = salesNavEnrichment(itemRaw);
  const itemProviderId =
    asString(itemRaw?.linkedin_provider_id) ?? fromRaw.providerId;

  const resolved = await resolveOrCreateContact({
    coachId: opts.coachId,
    fullName,
    firstName,
    lastName,
    email,
    phone,
    linkedinUrl,
    linkedinProviderId: itemProviderId,
    jobTitle:
      (typeof item.job_title === "string" && item.job_title.trim()) || null,
    businessName:
      (typeof item.company === "string" && item.company.trim()) || null,
    photoUrl: fromRaw.photoUrl,
    type: "prospect",
    prospectSource:
      typeof item.source === "string" && item.source.trim()
        ? item.source.trim()
        : "sales_nav",
    prospectStatus: "leads",
    extra: {
      headline: fromRaw.headline,
      about: fromRaw.about,
      location: fromRaw.location,
    },
  });

  const persistContact = supabaseAdmin
    .from("coach_lead_list_items")
    .update({ contact_id: resolved.contactId })
    .eq("id", item.id)
    .eq("coach_id", opts.coachId);

  const poolTags = normalizeProspectTags(
    (item as { tags?: unknown }).tags
  );

  if (poolTags.length) {
    const [{ data: contact }] = await Promise.all([
      supabaseAdmin
        .from("contacts")
        .select("prospect_tags")
        .eq("id", resolved.contactId)
        .eq("coach_id", opts.coachId)
        .maybeSingle(),
      persistContact,
    ]);
    const merged = normalizeProspectTags([
      ...normalizeProspectTags(contact?.prospect_tags),
      ...poolTags,
    ]);
    await supabaseAdmin
      .from("contacts")
      .update({ prospect_tags: merged })
      .eq("id", resolved.contactId)
      .eq("coach_id", opts.coachId);
  } else {
    await persistContact;
  }

  return {
    contactId: resolved.contactId,
    created: resolved.created,
    href: workspaceHref(resolved.contactId, opts.admin),
  };
}
