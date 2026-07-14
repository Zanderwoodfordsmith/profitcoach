import type { SupabaseClient } from "@supabase/supabase-js";
import {
  chunkArray,
  SUPABASE_IN_FILTER_CHUNK,
} from "./chunkArray";
import { isMissingColumnError } from "./contactsSchemaSafeSelect";

export type ProspectNextCall = {
  start_time: string;
  status_normalized: string;
  calendar_name: string | null;
  title: string | null;
};

const UPCOMING_STATUSES = new Set(["booked", "confirmed", "other"]);

const STATUS_LABELS: Record<string, string> = {
  booked: "Booked",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  showed: "Showed",
  noshow: "No show",
  invalid: "Invalid",
  other: "Scheduled",
};

function formatShortDate(value: Date): string {
  const currentYear = new Date().getFullYear();
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(value.getFullYear() === currentYear ? {} : { year: "numeric" }),
  }).format(value);
}

export function formatProspectLastAssessed(
  iso: string | null | undefined
): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return formatShortDate(date);
}

export function formatCompactTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const h12 = hours % 12 || 12;
  const ampm = hours >= 12 ? "pm" : "am";
  if (minutes === 0) return `${h12}${ampm}`;
  return `${h12}:${minutes.toString().padStart(2, "0")}${ampm}`;
}

export function getProspectNextCallStatusLabel(
  status: string | null | undefined
): string {
  if (!status) return "Scheduled";
  return (
    STATUS_LABELS[status] ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function getCallStatusLabel(
  status: string | null | undefined
): string {
  return getProspectNextCallStatusLabel(status);
}

export function callStatusClass(status: string | null | undefined): string {
  switch (status) {
    case "confirmed":
    case "showed":
      return "bg-emerald-50 text-emerald-700";
    case "booked":
      return "bg-sky-50 text-sky-700";
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

export function getCallDisplayName(input: {
  title?: string | null;
  calendar_name?: string | null;
}): string {
  const name = input.title?.trim() || input.calendar_name?.trim();
  return name || "Call";
}

export function formatCallWhen(startTime: string | null | undefined): string | null {
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

export function isUpcomingCall(
  startTime: string | null | undefined,
  status: string | null | undefined
): boolean {
  if (!startTime) return false;
  if (status === "cancelled" || status === "invalid") return false;
  const start = new Date(startTime).getTime();
  if (Number.isNaN(start)) return false;
  return start >= Date.now();
}

export function getProspectNextCallName(
  next: ProspectNextCall | null | undefined
): string {
  if (!next) return "";
  const name = next.title?.trim() || next.calendar_name?.trim();
  return name || "Call";
}

export function formatProspectNextCallWhen(
  next: ProspectNextCall | null | undefined
): string | null {
  if (!next?.start_time) return null;

  const date = new Date(next.start_time);
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

/** @deprecated Use formatProspectNextCallWhen + getProspectNextCallName for table cells. */
export function formatProspectNextCall(
  next: ProspectNextCall | null | undefined
): string {
  if (!next?.start_time) return "—";

  const when = formatProspectNextCallWhen(next);
  if (!when) return "—";

  const status = getProspectNextCallStatusLabel(next.status_normalized);
  return `${when} · ${status}`;
}

function normalizePhone(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Phone from GHL appointments when `contacts.phone` was never saved (e.g. assessment
 * completed before contact patch logic, or email-step contact created first).
 */
export async function loadFallbackPhonesByContactId(
  supabase: SupabaseClient,
  contacts: { id: string; email: string | null; coach_id?: string | null }[]
): Promise<Record<string, string>> {
  if (contacts.length === 0) return {};

  const byContact: Record<string, string> = {};
  const contactIds = contacts.map((c) => c.id);

  for (const idChunk of chunkArray(contactIds, SUPABASE_IN_FILTER_CHUNK)) {
    const { data: byIdRows, error: byIdError } = await supabase
      .from("ghl_appointments")
      .select("contact_id, prospect_phone, updated_at")
      .in("contact_id", idChunk)
      .not("prospect_phone", "is", null)
      .order("updated_at", { ascending: false });

    if (byIdError) {
      if (byIdError.code !== "42P01" && !isMissingColumnError(byIdError)) {
        console.warn("loadFallbackPhonesByContactId (by contact_id):", byIdError);
      }
    } else {
      for (const row of byIdRows ?? []) {
        const contactId = (row as { contact_id?: string | null }).contact_id;
        const phone = normalizePhone(
          (row as { prospect_phone?: string | null }).prospect_phone
        );
        if (contactId && phone && !byContact[contactId]) {
          byContact[contactId] = phone;
        }
      }
    }
  }

  const stillMissing = contacts.filter(
    (c) => !byContact[c.id] && c.email?.trim()
  );
  if (stillMissing.length === 0) return byContact;

  const emails = [
    ...new Set(stillMissing.map((c) => c.email!.trim().toLowerCase())),
  ];

  const phoneByCoachEmail: Record<string, string> = {};

  for (const emailChunk of chunkArray(emails, SUPABASE_IN_FILTER_CHUNK)) {
    const { data: byEmailRows, error: byEmailError } = await supabase
      .from("ghl_appointments")
      .select("prospect_email, prospect_phone, coach_id, updated_at")
      .in("prospect_email", emailChunk)
      .not("prospect_phone", "is", null)
      .order("updated_at", { ascending: false });

    if (byEmailError) {
      if (byEmailError.code !== "42P01" && !isMissingColumnError(byEmailError)) {
        console.warn("loadFallbackPhonesByContactId (by email):", byEmailError);
      }
      continue;
    }

    for (const row of byEmailRows ?? []) {
      const email = (row as { prospect_email?: string | null }).prospect_email
        ?.trim()
        .toLowerCase();
      const phone = normalizePhone(
        (row as { prospect_phone?: string | null }).prospect_phone
      );
      const coachId = (row as { coach_id?: string | null }).coach_id ?? "";
      if (!email || !phone) continue;
      const key = `${coachId}:${email}`;
      if (!phoneByCoachEmail[key]) phoneByCoachEmail[key] = phone;
    }
  }

  for (const contact of stillMissing) {
    const key = `${contact.coach_id ?? ""}:${contact.email!.trim().toLowerCase()}`;
    const phone = phoneByCoachEmail[key];
    if (phone) byContact[contact.id] = phone;
  }

  return byContact;
}

/**
 * Most recent past GHL appointment per contact (for showed / no-show status).
 */
export async function loadLatestPastCallsByContactId(
  supabase: SupabaseClient,
  contactIds: string[]
): Promise<Record<string, string>> {
  if (contactIds.length === 0) return {};

  const nowIso = new Date().toISOString();
  const byContact: Record<string, string> = {};

  for (const idChunk of chunkArray(contactIds, SUPABASE_IN_FILTER_CHUNK)) {
    const { data, error } = await supabase
      .from("ghl_appointments")
      .select("contact_id, status_normalized, start_time")
      .in("contact_id", idChunk)
      .not("start_time", "is", null)
      .lt("start_time", nowIso)
      .in("status_normalized", ["showed", "noshow"])
      .order("start_time", { ascending: false });

    if (error) {
      if (error.code === "42P01" || isMissingColumnError(error)) {
        return byContact;
      }
      console.warn("loadLatestPastCallsByContactId:", error);
      return byContact;
    }

    for (const row of data ?? []) {
      const contactId = (row as { contact_id?: string | null }).contact_id;
      const status = (row as { status_normalized?: string }).status_normalized;
      if (!contactId || byContact[contactId] || !status) continue;
      byContact[contactId] = status;
    }
  }

  return byContact;
}

/**
 * Earliest upcoming GHL appointment per contact (non-cancelled, start_time >= now).
 */
export async function loadNextCallsByContactId(
  supabase: SupabaseClient,
  contactIds: string[]
): Promise<Record<string, ProspectNextCall>> {
  if (contactIds.length === 0) return {};

  const nowIso = new Date().toISOString();
  const byContact: Record<string, ProspectNextCall> = {};

  for (const idChunk of chunkArray(contactIds, SUPABASE_IN_FILTER_CHUNK)) {
    const { data, error } = await supabase
      .from("ghl_appointments")
      .select("contact_id, start_time, status_normalized, calendar_name, title")
      .in("contact_id", idChunk)
      .not("start_time", "is", null)
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true });

    if (error) {
      if (error.code === "42P01" || isMissingColumnError(error)) {
        return byContact;
      }
      console.warn("loadNextCallsByContactId:", error);
      return byContact;
    }

    for (const row of data ?? []) {
      const contactId = (row as { contact_id?: string | null }).contact_id;
      const status = (row as { status_normalized?: string }).status_normalized;
      if (!contactId || byContact[contactId]) continue;
      if (!status || !UPCOMING_STATUSES.has(status)) continue;

      byContact[contactId] = {
        start_time: (row as { start_time: string }).start_time,
        status_normalized: status,
        calendar_name:
          (row as { calendar_name?: string | null }).calendar_name ?? null,
        title: (row as { title?: string | null }).title ?? null,
      };
    }
  }

  return byContact;
}
