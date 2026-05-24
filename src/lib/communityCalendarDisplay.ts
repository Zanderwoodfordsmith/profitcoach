import type { CommunityCalendarOccurrence } from "@/lib/communityCalendarTypes";
import { inferCommunityPostMediaKindFromUrl } from "@/lib/communityPostMedia";

/** Week-grid event block colors. */
export function communityCalendarWeekBlockClass(
  cancelled: boolean,
  alt: boolean
): string {
  if (cancelled) {
    return "border border-dashed border-rose-200 bg-rose-50 text-rose-700 shadow-sm";
  }
  return alt
    ? "border border-sky-500/30 bg-sky-500 text-white shadow-sm"
    : "border border-sky-200 bg-sky-100 text-slate-800 shadow-sm";
}

export function communityCalendarWeekBlockTimeClass(
  cancelled: boolean,
  alt: boolean
): string {
  if (cancelled) return "text-rose-500";
  return alt ? "text-white/90" : "text-slate-600";
}

function maybeHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

/** Normalize stored cover paths to a fetchable public URL. */
export function resolveCommunityCalendarCoverUrl(
  raw: string | null | undefined
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(
    /\/$/,
    ""
  );
  if (!supabaseUrl) return trimmed;

  const path = trimmed.replace(/^\/+/, "");
  if (path.startsWith("storage/v1/")) return `${supabaseUrl}/${path}`;
  return `${supabaseUrl}/storage/v1/object/public/community-posts/${path}`;
}

/** Cover from `cover_image_url`, or the first image URL in the description. */
export function communityCalendarCoverUrl(
  occurrence: Pick<CommunityCalendarOccurrence, "cover_image_url" | "description">
): string | null {
  const direct = resolveCommunityCalendarCoverUrl(occurrence.cover_image_url);
  if (direct) return direct;

  for (const line of occurrence.description?.split(/\r?\n/) ?? []) {
    const url = maybeHttpUrl(line.trim());
    if (url && inferCommunityPostMediaKindFromUrl(url) === "image") return url;
  }

  return null;
}

export function communityCalendarCancellationHoverTitle(
  occurrence: Pick<
    CommunityCalendarOccurrence,
    "isCancelled" | "cancellationReason"
  >
): string | undefined {
  if (!occurrence.isCancelled) return undefined;
  const reason = occurrence.cancellationReason?.trim();
  if (reason) return `Cancelled: ${reason}`;
  return "Cancelled";
}

export function communityCalendarCancelledTextClass(): string {
  return "text-rose-600 line-through";
}

export function communityCalendarCancelledBadgeClass(): string {
  return "inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700";
}
