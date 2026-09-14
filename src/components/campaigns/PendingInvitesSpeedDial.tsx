"use client";

import {
  PENDING_DIAL_MAX,
  PENDING_KEEP_UNDER,
  pendingInviteZone,
  pendingInviteZoneColor,
  pendingInviteZoneLabel,
} from "@/lib/unipile/pendingInviteDial";
import { BOSS_PRO_RING_TRACK } from "@/lib/bossProDialGradients";

/**
 * SSI-style progress arc: gray track, fill up to count in the zone colour.
 */
export function PendingInvitesSpeedDial({
  count,
  keepUnder = PENDING_KEEP_UNDER,
  loading = false,
  compact = false,
}: {
  count: number | null;
  keepUnder?: number;
  loading?: boolean;
  compact?: boolean;
}) {
  const cx = 120;
  const cy = 126;
  const r = 92;
  const stroke = compact ? 14 : 16;
  const length = Math.PI * r;
  const track = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  const value = count == null ? 0 : Math.max(0, count);
  const pct = Math.min(1, Math.max(0, value / PENDING_DIAL_MAX));
  const filled = `${pct * length} ${length}`;

  const zone = count == null ? null : pendingInviteZone(value);
  const zoneColor = count == null ? "#94a3b8" : pendingInviteZoneColor(value);
  const zoneLabel = count == null ? "—" : pendingInviteZoneLabel(value);
  const label = loading || count == null ? "—" : String(Math.round(value));

  return (
    <div
      className={`relative ${compact ? "w-[9.25rem]" : "mx-auto w-[13.5rem]"}`}
      role="img"
      aria-label={
        count == null
          ? "Pending invites unavailable"
          : `Pending invites ${Math.round(value)} of ${PENDING_DIAL_MAX}, ${zoneLabel}`
      }
    >
      <svg viewBox="0 0 240 148" className="h-auto w-full" aria-hidden>
        <path
          d={track}
          fill="none"
          stroke={BOSS_PRO_RING_TRACK}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {pct > 0 ? (
          <path
            d={track}
            fill="none"
            stroke={zoneColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={filled}
          />
        ) : null}
      </svg>
      <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
        <p
          className={`font-semibold leading-none tabular-nums tracking-tight ${
            compact ? "text-[1.7rem]" : "text-[2.35rem]"
          }`}
          style={{ color: zone ? zoneColor : "#0f172a" }}
        >
          {label}
        </p>
        <p className="mt-1 text-[11px] font-medium text-slate-500">
          Keep under {keepUnder}
        </p>
      </div>
    </div>
  );
}
