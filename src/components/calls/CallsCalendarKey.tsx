"use client";

import { blockedSlotCalendarClass, callStatusCalendarClass } from "@/lib/callStatusUi";

const KEY_ITEMS: { label: string; swatchClass: string }[] = [
  { label: "Confirmed", swatchClass: callStatusCalendarClass("confirmed") },
  { label: "Completed", swatchClass: callStatusCalendarClass("completed") },
  { label: "No-show", swatchClass: callStatusCalendarClass("noshow") },
  { label: "Cancelled", swatchClass: callStatusCalendarClass("cancelled") },
  { label: "Imported", swatchClass: blockedSlotCalendarClass },
];

export function CallsCalendarKey({
  className = "",
}: {
  className?: string;
}) {
  return (
    <ul
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}
      aria-label="Calendar key"
    >
      {KEY_ITEMS.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600"
        >
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-sm border ${item.swatchClass}`}
            aria-hidden
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
