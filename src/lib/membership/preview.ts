/**
 * When true, membership is visible to admins via direct URL only:
 * no sidebar link, no payment banner, no checkout.
 * Set NEXT_PUBLIC_MEMBERSHIP_PREVIEW_MODE=true on Vercel until launch.
 */
export function membershipPreviewMode(): boolean {
  return process.env.NEXT_PUBLIC_MEMBERSHIP_PREVIEW_MODE === "true";
}
