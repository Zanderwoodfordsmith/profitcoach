/** Pure UI helpers for call status — safe to import from client components. */

const STATUS_LABELS: Record<string, string> = {
  booked: "Confirmed",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  showed: "Completed",
  completed: "Completed",
  noshow: "No-show",
  other: "Scheduled",
};

export function getCallStatusLabel(
  status: string | null | undefined
): string {
  if (!status) return "Scheduled";
  return (
    STATUS_LABELS[status] ??
    status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function callStatusClass(status: string | null | undefined): string {
  switch (status) {
    case "confirmed":
    case "booked":
      return "bg-sky-50 text-sky-700";
    case "showed":
    case "completed":
      return "bg-emerald-50 text-emerald-700";
    case "cancelled":
      return "bg-rose-50 text-rose-700";
    case "noshow":
      return "bg-amber-50 text-amber-800";
    case "invalid":
      return "bg-slate-100 text-slate-500";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

/** Block colour for week calendar. */
export function callStatusCalendarClass(
  status: string | null | undefined
): string {
  switch (status) {
    case "confirmed":
    case "booked":
      return "border-sky-600 bg-sky-500 text-white";
    case "showed":
    case "completed":
      return "border-emerald-700 bg-emerald-600 text-white";
    case "cancelled":
      return "border-rose-700 bg-rose-500 text-white line-through opacity-80";
    case "noshow":
      return "border-amber-700 bg-amber-500 text-white";
    default:
      return "border-slate-500 bg-slate-400 text-white";
  }
}

export function getCallDisplayName(input: {
  title?: string | null;
  calendar_name?: string | null;
}): string {
  const name = input.title?.trim() || input.calendar_name?.trim();
  return name || "Call";
}

export function formatCompactTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const h12 = hours % 12 || 12;
  const ampm = hours >= 12 ? "pm" : "am";
  if (minutes === 0) return `${h12}${ampm}`;
  return `${h12}:${minutes.toString().padStart(2, "0")}${ampm}`;
}

export function formatCallWhen(
  startTime: string | null | undefined
): string | null {
  if (!startTime) return null;
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return null;

  const datePart = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === new Date().getFullYear()
      ? {}
      : { year: "numeric" }),
  }).format(date);

  return `${datePart} · ${formatCompactTime(date)}`;
}
