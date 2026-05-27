import type { CommunityCalendarOccurrence } from "@/lib/communityCalendarTypes";
import { inferCommunityPostMediaKindFromUrl } from "@/lib/communityPostMedia";

export const NEW_MEMBER_KICKOFF_EVENT_ID =
  "b0eef000-0000-4000-a000-000000000001";

export function isNewMemberKickoffOccurrence(
  occurrence: Pick<CommunityCalendarOccurrence, "eventId" | "title">
): boolean {
  return (
    occurrence.eventId === NEW_MEMBER_KICKOFF_EVENT_ID ||
    occurrence.title === "New Member Kick-off Call"
  );
}

/** Month/list: green box wrapping time + title. */
export function communityCalendarKickoffHighlightBoxClass(
  cancelled: boolean
): string {
  if (cancelled) {
    return "rounded-md bg-rose-50/90 px-1.5 pb-1 pt-0";
  }
  return "rounded-md bg-emerald-50 px-1.5 pb-1 pt-0";
}

export function communityCalendarKickoffMonthTimeClass(cancelled: boolean): string {
  if (cancelled) return "text-rose-500";
  return "text-emerald-700";
}

export function communityCalendarKickoffMonthTitleClass(
  cancelled: boolean
): string {
  if (cancelled) return communityCalendarCancelledTextClass();
  return "text-emerald-900";
}

/** Week grid block for kick-off calls. */
export function communityCalendarKickoffWeekBlockClass(
  cancelled: boolean
): string {
  if (cancelled) {
    return "bg-rose-50 text-rose-700 shadow-sm";
  }
  return "bg-emerald-100 text-emerald-950 shadow-sm";
}

export function communityCalendarKickoffWeekBlockTimeClass(
  cancelled: boolean
): string {
  if (cancelled) return "text-rose-500";
  return "text-emerald-800";
}

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

export function communityCalendarHasRecording(
  occurrence: Pick<
    CommunityCalendarOccurrence,
    "recording_link_url" | "recording_video_url"
  >
): boolean {
  return (
    Boolean(occurrence.recording_link_url?.trim()) ||
    Boolean(occurrence.recording_video_url?.trim())
  );
}

export function communityCalendarRecordingWatchUrl(
  occurrence: Pick<
    CommunityCalendarOccurrence,
    "recording_link_url" | "recording_video_url"
  >
): string | null {
  const video = occurrence.recording_video_url?.trim();
  if (video && /^https?:\/\//i.test(video)) return video;
  const link = occurrence.recording_link_url?.trim();
  if (link && /^https?:\/\//i.test(link)) return link;
  return null;
}

export function isLiveCommunityCalendarOccurrence(
  occurrence: Pick<
    CommunityCalendarOccurrence,
    "startsAtIso" | "endsAtIso" | "isCancelled"
  >,
  nowMs = Date.now()
): boolean {
  if (occurrence.isCancelled) return false;
  const startMs = Date.parse(occurrence.startsAtIso);
  const endMs = Date.parse(occurrence.endsAtIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;
  return nowMs >= startMs && nowMs < endMs;
}
