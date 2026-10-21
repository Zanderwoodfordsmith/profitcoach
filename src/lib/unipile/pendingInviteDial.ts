/**
 * Pending-invite tachometer bands (higher = worse).
 * LinkedIn’s practical wall is ~800; red starts at 750.
 */

export const PENDING_DIAL_MAX = 1000;
export const PENDING_KEEP_UNDER = 600;
/** At or over this, new connection requests pause until the pile drops. */
export const PENDING_PAUSE_AT = 750;
/** Between keep-under and pause: no more invites a day than auto-clean can withdraw. */
export const PENDING_SLOW_DAILY_INVITES = 25;

export type PendingInviteBrake = "none" | "slow" | "pause";

/** Send brake for an (estimated) pending count. */
export function pendingInviteBrake(count: number | null | undefined): PendingInviteBrake {
  if (count == null || !Number.isFinite(count)) return "none";
  if (count >= PENDING_PAUSE_AT) return "pause";
  if (count >= PENDING_KEEP_UNDER) return "slow";
  return "none";
}

export type PendingInviteZone = "green" | "yellow" | "orange" | "red";

export type PendingInviteBand = {
  zone: PendingInviteZone;
  from: number;
  to: number;
  color: string;
  label: string;
};

/** Arc bands left→right (0 → PENDING_DIAL_MAX). */
export const PENDING_INVITE_BANDS: readonly PendingInviteBand[] = [
  { zone: "green", from: 0, to: 250, color: "#15803d", label: "Healthy" },
  { zone: "yellow", from: 250, to: 500, color: "#ca8a04", label: "Watch" },
  { zone: "orange", from: 500, to: 750, color: "#ea580c", label: "Pressure" },
  { zone: "red", from: 750, to: 1000, color: "#dc2626", label: "Near limit" },
] as const;

export function pendingInviteZone(count: number): PendingInviteZone {
  const n = Math.max(0, Number(count) || 0);
  if (n < 250) return "green";
  if (n < 500) return "yellow";
  if (n < 750) return "orange";
  return "red";
}

export function pendingInviteZoneColor(count: number): string {
  const zone = pendingInviteZone(count);
  return (
    PENDING_INVITE_BANDS.find((band) => band.zone === zone)?.color ?? "#15803d"
  );
}

export function pendingInviteZoneLabel(count: number): string {
  const zone = pendingInviteZone(count);
  return (
    PENDING_INVITE_BANDS.find((band) => band.zone === zone)?.label ?? "Healthy"
  );
}
