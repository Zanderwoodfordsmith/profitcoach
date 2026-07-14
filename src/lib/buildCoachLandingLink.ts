/** Absolute or relative coach assessment landing link. */
export function buildCoachLandingLink(
  coachSlug: string | null | undefined,
  origin?: string | null
): string | null {
  const slug = coachSlug?.trim();
  if (!slug) return null;
  const path = `/landing/a?coach=${encodeURIComponent(slug)}`;
  const base = origin?.trim();
  return base ? `${base}${path}` : path;
}

/** Copy landing link when invite is requested; returns the success message. */
export async function copyCoachLandingLinkOnInvite(options: {
  sendInvite: boolean;
  coachSlug: string | null | undefined;
}): Promise<string> {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const assessmentLink = buildCoachLandingLink(options.coachSlug, origin);

  if (options.sendInvite && assessmentLink && navigator?.clipboard) {
    try {
      await navigator.clipboard.writeText(assessmentLink);
      return "Prospect created. Landing link copied to clipboard – paste it into your email.";
    } catch {
      return "Prospect created. Copy and share the landing link below.";
    }
  }
  return "Prospect created.";
}
