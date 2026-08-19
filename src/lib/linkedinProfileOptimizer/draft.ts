import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import {
  FIELD_LIMITS,
  PROFILE_SECTIONS,
  type ExperienceDraft,
  type ProfileOptimizerDraft,
  type ProfileSectionId,
} from "./types";

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function asTrimmedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = clip(value, max).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function normalizeExperiences(raw: unknown): ExperienceDraft[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ExperienceDraft[] = [];
  const seen = new Set<number>();
  for (const item of raw.slice(0, FIELD_LIMITS.maxExperienceDrafts)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const index = rec.index;
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0) {
      continue;
    }
    if (seen.has(index)) continue;
    seen.add(index);
    const title = asTrimmedString(rec.title, FIELD_LIMITS.experienceTitle);
    const description = asTrimmedString(
      rec.description,
      FIELD_LIMITS.experienceDescription
    );
    if (!title && !description) continue;
    const row: ExperienceDraft = { index };
    if (title) row.title = title;
    if (description) row.description = description;
    out.push(row);
  }
  return out.length > 0 ? out : undefined;
}

function normalizeCopiedAt(
  raw: unknown
): ProfileOptimizerDraft["copiedAt"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  const copiedAt: NonNullable<ProfileOptimizerDraft["copiedAt"]> = {};
  for (const key of PROFILE_SECTIONS) {
    const iso = asIso(rec[key]);
    if (iso) copiedAt[key] = iso;
  }
  return Object.keys(copiedAt).length > 0 ? copiedAt : undefined;
}

/** Drop unknown keys, clip lengths, ignore client-supplied rewrite clock. */
export function normalizeOptimizerDraft(raw: unknown): ProfileOptimizerDraft {
  if (!raw || typeof raw !== "object") return {};
  const rec = raw as Record<string, unknown>;
  const draft: ProfileOptimizerDraft = {};

  const headline = asTrimmedString(rec.headline, FIELD_LIMITS.headline);
  if (headline) draft.headline = headline;
  else if (rec.headline === null || rec.headline === "") draft.headline = null;

  const about = asTrimmedString(rec.about, FIELD_LIMITS.about);
  if (about) draft.about = about;
  else if (rec.about === null || rec.about === "") draft.about = null;

  const bannerCopy = asTrimmedString(rec.bannerCopy, FIELD_LIMITS.bannerCopy);
  if (bannerCopy) draft.bannerCopy = bannerCopy;
  else if (rec.bannerCopy === null || rec.bannerCopy === "") {
    draft.bannerCopy = null;
  }

  const featuredNotes = asTrimmedString(
    rec.featuredNotes,
    FIELD_LIMITS.featuredNotes
  );
  if (featuredNotes) draft.featuredNotes = featuredNotes;
  else if (rec.featuredNotes === null || rec.featuredNotes === "") {
    draft.featuredNotes = null;
  }

  const experiences = normalizeExperiences(rec.experiences);
  if (experiences) draft.experiences = experiences;

  const copiedAt = normalizeCopiedAt(rec.copiedAt);
  if (copiedAt) draft.copiedAt = copiedAt;

  const updatedAt = asIso(rec.updatedAt);
  if (updatedAt) draft.updatedAt = updatedAt;

  return draft;
}

export function emptyDraft(value: unknown): boolean {
  const d = normalizeOptimizerDraft(value);
  return (
    !d.headline &&
    !d.about &&
    !d.bannerCopy &&
    !d.featuredNotes &&
    !(d.experiences && d.experiences.length > 0)
  );
}

export function experienceDraftAt(
  draft: ProfileOptimizerDraft,
  index: number
): ExperienceDraft | undefined {
  return draft.experiences?.find((row) => row.index === index);
}

export function upsertExperienceDraft(
  draft: ProfileOptimizerDraft,
  patch: ExperienceDraft
): ProfileOptimizerDraft {
  const rest = (draft.experiences ?? []).filter((row) => row.index !== patch.index);
  const title = patch.title?.trim() || undefined;
  const description = patch.description?.trim() || undefined;
  const next = title || description ? [...rest, { ...patch, title, description }] : rest;
  return { ...draft, experiences: next.length > 0 ? next : undefined };
}

export type SectionStatus = "needs-work" | "current" | "draft";

function differs(draftValue: string | null | undefined, live: string | null): boolean {
  const d = (draftValue ?? "").trim();
  if (!d) return false;
  return d !== (live ?? "").trim();
}

export function sectionStatus(
  section: ProfileSectionId,
  snapshot: LinkedInProfileSnapshot,
  draft: ProfileOptimizerDraft
): SectionStatus {
  if (section === "headline") {
    if (differs(draft.headline, snapshot.headline)) return "draft";
    if (!snapshot.headline?.trim()) return "needs-work";
    return "current";
  }
  if (section === "about") {
    if (differs(draft.about, snapshot.about)) return "draft";
    if (!snapshot.about?.trim()) return "needs-work";
    return "current";
  }
  if (section === "banner") {
    if (differs(draft.bannerCopy, null)) return "draft";
    if (!snapshot.bannerUrl) return "needs-work";
    return "current";
  }
  if (section === "featured") {
    if (differs(draft.featuredNotes, null)) return "draft";
    if ((snapshot.featured ?? []).length === 0) return "needs-work";
    return "current";
  }
  const current = snapshot.experiences[0];
  const expDraft = experienceDraftAt(draft, 0);
  const titleDiff = differs(expDraft?.title, current?.title ?? null);
  const descDiff = differs(expDraft?.description, current?.description ?? null);
  if (titleDiff || descDiff) return "draft";
  if (!current?.description?.trim() && !current?.title?.trim()) return "needs-work";
  return "current";
}

export function applyDraftToSnapshot(
  snapshot: LinkedInProfileSnapshot,
  draft: ProfileOptimizerDraft
): LinkedInProfileSnapshot {
  const headline = draft.headline?.trim() || snapshot.headline;
  const about = draft.about?.trim() || snapshot.about;
  const experiences = snapshot.experiences.map((exp, index) => {
    const row = experienceDraftAt(draft, index);
    if (!row) return exp;
    return {
      ...exp,
      title: row.title?.trim() || exp.title,
      description: row.description?.trim() || exp.description,
    };
  });
  return { ...snapshot, headline, about, experiences };
}

export function parseExperienceVariant(text: string): {
  title?: string;
  description: string;
} {
  const trimmed = text.trim();
  const parts = trimmed.split(/\n\n+/);
  const first = parts[0]?.trim() ?? "";
  if (parts.length >= 2 && first.length > 0 && first.length <= FIELD_LIMITS.experienceTitle) {
    return {
      title: first,
      description: parts.slice(1).join("\n\n").trim(),
    };
  }
  return { description: trimmed };
}

export function textForSection(
  section: ProfileSectionId,
  snapshot: LinkedInProfileSnapshot,
  draft: ProfileOptimizerDraft
): string {
  if (section === "headline") {
    return (draft.headline?.trim() || snapshot.headline || "").trim();
  }
  if (section === "about") {
    return (draft.about?.trim() || snapshot.about || "").trim();
  }
  if (section === "banner") {
    return (draft.bannerCopy ?? "").trim();
  }
  if (section === "featured") {
    const notes = (draft.featuredNotes ?? "").trim();
    if (notes) return notes;
    const items = snapshot.featured ?? [];
    if (items.length === 0) return "";
    return items
      .map((item) =>
        [item.title, item.subtitle, item.url].filter(Boolean).join(" — ")
      )
      .join("\n");
  }
  const current = snapshot.experiences[0];
  const row = experienceDraftAt(draft, 0);
  const title = row?.title?.trim() || current?.title || "";
  const description = row?.description?.trim() || current?.description || "";
  return [title, description].filter(Boolean).join("\n\n");
}
