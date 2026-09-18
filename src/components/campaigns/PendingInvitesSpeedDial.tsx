"use client";

import { useId } from "react";
import {
  PENDING_DIAL_MAX,
  PENDING_KEEP_UNDER,
  pendingInviteZone,
  pendingInviteZoneColor,
  pendingInviteZoneLabel,
} from "@/lib/unipile/pendingInviteDial";
import { BOSS_PRO_RING_TRACK } from "@/lib/bossProDialGradients";

/**
 * Green → red tachometer: the full scale stays painted, a bead marks the count.
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
  const rawId = useId();
  const gradientId = `pending-arc-${rawId.replace(/:/g, "")}`;
  const cx = 120;
  const cy = 126;
  const r = 92;
  const stroke = 16;
  const track = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  const value = count == null ? 0 : Math.max(0, count);
  const pct =
    count == null ? null : Math.min(1, Math.max(0, value / PENDING_DIAL_MAX));
  const theta = pct == null ? null : Math.PI * (1 - pct);
  const marker =
    theta == null
      ? null
      : {
          x: cx + r * Math.cos(theta),
          y: cy - r * Math.sin(theta),
        };
  const beadR = stroke / 2 + 0.5;

  const zone = count == null ? null : pendingInviteZone(value);
  const zoneColor = count == null ? "#94a3b8" : pendingInviteZoneColor(value);
  const zoneLabel = count == null ? "—" : pendingInviteZoneLabel(value);
  const label = loading || count == null ? "—" : String(Math.round(value));

  return (
    <div
      className={`relative ${compact ? "w-[10.25rem]" : "mx-auto w-[13.5rem]"}`}
      role="img"
      aria-label={
        count == null
          ? "Pending invites unavailable"
          : `Pending invites ${Math.round(value)} of ${PENDING_DIAL_MAX}, ${zoneLabel}`
      }
    >
      <svg viewBox="0 0 240 148" className="h-auto w-full" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="25%" stopColor="#ca8a04" />
            <stop offset="50%" stopColor="#ea580c" />
            <stop offset="75%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>
        <path
          d={track}
          fill="none"
          stroke={
            pct == null ? BOSS_PRO_RING_TRACK : `url(#${gradientId})`
          }
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {marker ? (
          <circle
            cx={marker.x}
            cy={marker.y}
            r={beadR}
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth={1.75}
          />
        ) : null}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col items-center">
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
