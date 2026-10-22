"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";

import { WeeklyHoursEditor } from "@/components/booking/WeeklyHoursEditor";
import {
  ACCOUNT_SETTING_TIMEZONES,
  accountTimezoneOptionLabel,
} from "@/lib/accountProfileTimezones";
import {
  DEFAULT_WEEKDAY_AVAILABILITY,
  type AvailabilityRuleRow,
} from "@/lib/booking/computeBookingSlots";
import {
  fieldValue,
  type FieldSpec,
} from "@/lib/practiceKnowledge/blueprint";
import {
  SOCIAL_NETWORK_META,
  type SocialLinks,
  type SocialNetwork,
} from "@/lib/shareLinks/socials";

import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { TONE_DIMENSIONS, TONE_START, asVoiceTone, type VoiceTone } from "@/lib/practiceKnowledge/voiceTone";
import {
  COACH_STYLE_DIMENSIONS,
  COACH_STYLE_MIDDLE,
  coachStyleText,
  parseCoachStyle,
  type CoachStyle,
} from "@/lib/practiceKnowledge/coachStyle";
import { Modal } from "@/components/ui/Modal";

import { usePractice } from "../PracticeProvider";
import { InfoTip } from "./InfoTip";

const INPUT =
  "bp-input w-full rounded-xl border border-[#e3e9f0] bg-[#f4f7fa] px-3.5 py-2.5 text-left text-[0.9844rem] leading-[1.6] text-[var(--bp-ink)] transition-[background-color,border-color,box-shadow] placeholder:text-[#9aa8b8] hover:border-[#d3dce6] hover:bg-[#f0f4f8] focus:border-[#bfdcf2] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,143,212,0.12)] focus:outline-none";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const PRIMARY_SOCIALS = ["linkedin", "instagram", "facebook"] as const;
const MORE_SOCIALS = ["youtube", "tiktok", "x"] as const;

/** Networks a coach can connect, so their messages come into the inbox. The link box still works without it. */
type SocialProvider = "LINKEDIN" | "INSTAGRAM" | "MESSENGER";
const SOCIAL_PROVIDER: Partial<Record<SocialNetwork, SocialProvider>> = {
  linkedin: "LINKEDIN",
  instagram: "INSTAGRAM",
  facebook: "MESSENGER",
};
/** Set while a social connect is away at the provider, so a failed return is reported on the socials, not the email. */
const SOCIAL_CONNECT_KEY = "bp-social-connect";

function socialConnectPending(): boolean {
  try {
    return Boolean(window.sessionStorage.getItem(SOCIAL_CONNECT_KEY));
  } catch {
    return false;
  }
}

const PREFERRED_HOURS: FieldSpec = {
  path: "working_times.preferred_hours",
  label: "Hours",
  kind: "text",
};

const LINKEDIN_FIELD: FieldSpec = {
  path: "identity.linkedin_url",
  label: "LinkedIn",
  kind: "text",
};

type MailAccount = {
  id: string;
  provider: string;
  status: string;
  display_name: string | null;
};

function textAt(payload: NonNullable<ReturnType<typeof usePractice>["payload"]>, path: FieldSpec["path"]) {
  const value = fieldValue(payload, path)?.value;
  return typeof value === "string" ? value.trim() : "";
}

function browserZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    Intl.DateTimeFormat("en-GB", { timeZone: zone }).format(new Date());
    return zone;
  } catch {
    return "";
  }
}

function pickZone(input: {
  stored: string;
  profile: string;
  calendar: string;
  savedRules: boolean;
  browser: string;
}): string {
  if (input.stored) return input.stored;
  if (input.savedRules && input.calendar) return input.calendar;
  return input.profile || input.browser || input.calendar || "Europe/London";
}

/** Mon to Fri, 09:00 to 17:00 */
export function summarizeCallHours(rules: AvailabilityRuleRow[]): string {
  // Each day's slots in time order, e.g. "09:00 to 11:00 and 15:00 to 16:00".
  const timesFor = (day: number) =>
    rules
      .filter((rule) => rule.weekday === day)
      .map((rule) => ({ start: rule.start_time.slice(0, 5), end: rule.end_time.slice(0, 5) }))
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((slot) => `${slot.start} to ${slot.end}`)
      .join(" and ");
  const groups: { days: number[]; times: string }[] = [];
  for (const day of DAY_ORDER) {
    const times = timesFor(day);
    if (!times) continue;
    const prev = groups[groups.length - 1];
    const prevDay = prev?.days[prev.days.length - 1];
    const consecutive =
      prev && prevDay !== undefined && DAY_ORDER.indexOf(day) === DAY_ORDER.indexOf(prevDay) + 1 && prev.times === times;
    if (consecutive && prev) prev.days.push(day);
    else groups.push({ days: [day], times });
  }
  return groups
    .map((group) => {
      const names =
        group.days.length === 1
          ? DAY[group.days[0]]
          : `${DAY[group.days[0]]} to ${DAY[group.days[group.days.length - 1]]}`;
      return `${names}, ${group.times}`;
    })
    .join("; ");
}

function FieldLabel({
  label,
  help,
  mark,
}: {
  label: string;
  help?: string;
  mark?: string;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
      <span className="text-[0.875rem] font-semibold text-[var(--bp-ink)]">{label}</span>
      {help ? <InfoTip label={label}>{help}</InfoTip> : null}
      {mark ? (
        <span className="rounded-full bg-[#fff4e0] px-2 py-px text-[0.6875rem] font-semibold text-[#8a5300]">{mark}</span>
      ) : null}
    </div>
  );
}

const COUNTRY_NAMES = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en-GB"], { type: "region" }) : null;

function flagOf(country: string): string {
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

const DIAL_OPTIONS = getCountries()
  .map((country) => ({ country, code: getCountryCallingCode(country), name: COUNTRY_NAMES?.of(country) ?? country }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** A stored number split into its country and the rest, so the picker and the box can show it. */
function splitPhone(value: string): { country: CountryCode; national: string } {
  const parsed = value ? parsePhoneNumberFromString(value, "GB") : undefined;
  if (parsed?.country) return { country: parsed.country, national: parsed.formatNational() };
  return { country: "GB", national: value.replace(/^\+\d+\s*/, "") };
}

/** The number in one form everywhere: +44 7700 900123. */
function joinPhone(country: CountryCode, national: string): string {
  const trimmed = national.trim();
  if (!trimmed) return "";
  const parsed = parsePhoneNumberFromString(trimmed, country);
  return parsed ? parsed.formatInternational() : `+${getCountryCallingCode(country)} ${trimmed}`;
}

/** Country code picker and number, the same for phone and WhatsApp. Saves when you leave the box. */
function PhoneInput({
  label,
  value,
  placeholder,
  disabled,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
}) {
  const split = splitPhone(value);
  const [country, setCountry] = useState<CountryCode>(split.country);
  const [national, setNational] = useState(split.national);
  const [seen, setSeen] = useState(value);
  // A number saved elsewhere (WhatsApp following the phone) replaces what is on screen.
  if (seen !== value) {
    setSeen(value);
    setCountry(split.country);
    setNational(split.national);
  }

  function commit(nextCountry = country, nextNational = national) {
    const joined = joinPhone(nextCountry, nextNational);
    if (joined !== value) onCommit(joined);
  }

  return (
    <div className="flex min-w-0 gap-2">
      <div className="relative shrink-0">
        <span
          aria-hidden
          className={`${INPUT} pointer-events-none flex items-center gap-1.5 whitespace-nowrap pr-8`}
        >
          <span>{flagOf(country)}</span>+{getCountryCallingCode(country)}
        </span>
        <select
          aria-label={`${label} country code`}
          value={country}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value as CountryCode;
            setCountry(next);
            commit(next);
          }}
          className="absolute inset-0 w-full cursor-pointer opacity-0"
        >
          {DIAL_OPTIONS.map((o) => (
            <option key={o.country} value={o.country}>
              {o.name} (+{o.code})
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bp-faint)]" aria-hidden />
      </div>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        aria-label={label}
        value={national}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setNational(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={`${INPUT} min-w-0 flex-1`}
      />
    </div>
  );
}

/** The business name owners see. Lives on the coach's profile, the same one as Settings, so it is set once. */
export function SetupBusinessName() {
  const { sample, authHeaders } = usePractice();
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sample) return;
    let cancel = false;
    void (async () => {
      const headers = await authHeaders();
      if (!headers || cancel) return;
      const res = await fetch("/api/coach/profile", { headers });
      const body = (await res.json().catch(() => ({}))) as { coach_business_name?: string | null };
      if (cancel) return;
      const current = body.coach_business_name?.trim() ?? "";
      setName(current);
      setLoaded(current);
    })();
    return () => {
      cancel = true;
    };
  }, [sample, authHeaders]);

  async function save() {
    const next = name.trim();
    if (sample || next === loaded) return;
    setError("");
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ coach_business_name: next || null }),
    });
    if (!res.ok) {
      setError("Could not save the name. Try again.");
      return;
    }
    setLoaded(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div>
      <FieldLabel
        label="Business name"
        help="The name owners see on your directory page, your BOSS Score pages and your dashboards. It is the same name as in Settings, so changing it here changes it there."
      />
      <div className="relative">
        <input
          value={name}
          disabled={sample}
          placeholder="e.g. Pike Business Coaching"
          aria-label="Business name"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className={`${INPUT} bp-input`}
        />
        <span
          aria-live="polite"
          className={`pointer-events-none absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 text-xs font-medium text-[#17663a] transition-opacity ${
            saved ? "opacity-100" : "opacity-0"
          }`}
        >
          <Check className="h-3 w-3" aria-hidden /> Saved
        </span>
      </div>
      {error ? <p className="mt-1 text-sm text-[#9b1c1c]">{error}</p> : null}
    </div>
  );
}

function PhoneRow({ field, changed }: { field: FieldSpec; changed?: boolean }) {
  const { payload, saveField, sample } = usePractice();
  const current = payload ? textAt(payload, field.path) : "";
  return (
    <div>
      <FieldLabel label={field.label} help={field.help} mark={changed ? "Changed" : undefined} />
      <PhoneInput label={field.label} value={current} placeholder={field.example} disabled={sample} onCommit={(v) => saveField(field, v)} />
    </div>
  );
}

/** WhatsApp: the same box as the phone, filled in from it until the coach changes it. */
function WhatsAppRow({ field }: { field: FieldSpec }) {
  const { payload, saveField, sample } = usePractice();
  const phone = payload ? textAt(payload, "identity.phone") : "";
  const current = payload ? textAt(payload, field.path) : "";
  const lastPhone = useRef(phone);
  const saveRef = useRef(saveField);

  useEffect(() => {
    saveRef.current = saveField;
  });

  useEffect(() => {
    if (sample || !phone) {
      lastPhone.current = phone;
      return;
    }
    const previous = lastPhone.current;
    lastPhone.current = phone;
    const followsPhone = !current || current === previous;
    if (followsPhone && current !== phone) saveRef.current(field, phone);
  }, [phone, current, sample, field]);

  return (
    <div>
      <FieldLabel label="WhatsApp" help={field.help} />
      <PhoneInput
        label="WhatsApp"
        value={current || phone}
        placeholder="Same as your phone"
        disabled={sample}
        onCommit={(v) => saveField(field, v || phone)}
      />
    </div>
  );
}

function TimezoneRow({ field }: { field: FieldSpec }) {
  const { payload, saveField, sample, authHeaders, viewer } = usePractice();
  const stored = payload ? textAt(payload, field.path) : "";
  const [zone, setZone] = useState(stored);
  const saveRef = useRef(saveField);
  saveRef.current = saveField;
  const storedRef = useRef(stored);
  storedRef.current = stored;
  const started = useRef(false);

  useEffect(() => {
    if (stored) setZone(stored);
  }, [stored]);

  useEffect(() => {
    if (sample || stored || started.current) return;
    let cancel = false;
    void (async () => {
      const headers = await authHeaders();
      if (cancel || storedRef.current) return;
      if (!headers) return;
      started.current = true;
      const [profileRes, calendarRes] = await Promise.all([
        fetch("/api/coach/profile", { headers }),
        fetch("/api/coach/calendars", { headers }),
      ]);
      const profile = (await profileRes.json().catch(() => ({}))) as { timezone?: string | null };
      const calendars = (await calendarRes.json().catch(() => ({}))) as {
        timezone?: string;
        rules?: AvailabilityRuleRow[];
      };
      if (cancel || storedRef.current) return;
      const browser = viewer === "coach" ? browserZone() : "";
      const chosen = pickZone({
        stored: "",
        profile: profile.timezone?.trim() || "",
        calendar: calendars.timezone?.trim() || "",
        savedRules: (calendars.rules ?? []).length > 0,
        browser,
      });
      setZone(chosen);
      saveRef.current(field, chosen);
      if (viewer === "coach" && !profile.timezone?.trim() && browser && chosen === browser) {
        void fetch("/api/coach/profile", {
          method: "PATCH",
          headers,
          body: JSON.stringify({ timezone: chosen }),
        });
      }
    })();
    return () => {
      cancel = true;
    };
  }, [sample, stored, authHeaders, viewer, field]);

  const shown = zone || stored || "Europe/London";
  const options = ACCOUNT_SETTING_TIMEZONES.includes(shown)
    ? ACCOUNT_SETTING_TIMEZONES
    : [shown, ...ACCOUNT_SETTING_TIMEZONES];

  function choose(next: string) {
    setZone(next);
    if (next !== stored) saveField(field, next);
    if (sample || viewer !== "coach") return;
    void authHeaders().then((headers) => {
      if (!headers) return;
      void fetch("/api/coach/profile", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ timezone: next }),
      });
    });
  }

  return (
    <div>
      <FieldLabel label="Time zone" help={field.help} />
      <div className="relative">
        <select
          value={shown}
          disabled={sample}
          onChange={(e) => choose(e.target.value)}
          className={`${INPUT} cursor-pointer appearance-none pr-10`}
          aria-label="Time zone"
        >
          {options.map((item) => (
            <option key={item} value={item}>
              {accountTimezoneOptionLabel(item)}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bp-faint)]" aria-hidden />
      </div>
    </div>
  );
}

function CallHours({ field, changed }: { field: FieldSpec; changed?: boolean }) {
  const { payload, saveField, sample, authHeaders } = usePractice();
  const storedTz = payload ? textAt(payload, "identity.timezone") : "";
  const existing = payload ? textAt(payload, field.path) : "";
  const [rules, setRules] = useState<AvailabilityRuleRow[]>(
    DEFAULT_WEEKDAY_AVAILABILITY.map((rule) => ({ ...rule }))
  );
  const [timezone, setTimezone] = useState(storedTz || "Europe/London");
  const [loading, setLoading] = useState(!sample);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const synced = useRef(false);
  const saveRef = useRef(saveField);
  saveRef.current = saveField;
  const authRef = useRef(authHeaders);
  authRef.current = authHeaders;
  const existingRef = useRef(existing);
  existingRef.current = existing;
  const storedTzRef = useRef(storedTz);
  storedTzRef.current = storedTz;

  useEffect(() => {
    if (storedTz) setTimezone(storedTz);
  }, [storedTz]);

  useEffect(() => {
    if (sample || synced.current) return;
    let cancel = false;
    void (async () => {
      const headers = await authRef.current();
      if (cancel) return;
      if (!headers) {
        setLoading(false);
        return;
      }
      const res = await fetch("/api/coach/calendars", { headers });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        timezone?: string;
        rules?: AvailabilityRuleRow[];
      };
      if (cancel) return;
      if (!res.ok) {
        setError(body.error || "Could not load your call hours.");
        setLoading(false);
        return;
      }
      const serverRules = body.rules ?? [];
      setRules(
        serverRules.length > 0
          ? serverRules
          : DEFAULT_WEEKDAY_AVAILABILITY.map((rule) => ({ ...rule }))
      );
      if (!storedTzRef.current && body.timezone) setTimezone(body.timezone);
      synced.current = true;
      setLoading(false);
      if (serverRules.length > 0 && !existingRef.current) {
        const summary = summarizeCallHours(serverRules);
        if (summary) {
          saveRef.current(field, summary);
          saveRef.current(PREFERRED_HOURS, summary);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [sample, field]);

  async function save() {
    if (sample) return;
    const summary = summarizeCallHours(rules);
    if (!summary) {
      setError("Choose at least one day.");
      return;
    }
    setSaving(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }
    const zone = storedTz || timezone;
    const res = await fetch("/api/coach/calendars", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ timezone: zone, rules }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error || "Could not save your hours.");
      return;
    }
    saveField(field, summary);
    saveField(PREFERRED_HOURS, summary);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  const mark = changed ? "Changed" : undefined;

  return (
    <div>
      <FieldLabel label="Hours" help={field.help} mark={mark} />
      <p className="mb-3 px-0.5 text-sm leading-6 text-[var(--bp-muted)]">
        Tick the days you take calls, then set the times. Saving here updates Calls, so you only do this once.
      </p>
      {loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-[var(--bp-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading your hours…
        </p>
      ) : (
        <WeeklyHoursEditor
          plain
          hideTimezone
          title="Hours"
          timezone={storedTz || timezone}
          onTimezoneChange={setTimezone}
          rules={rules}
          onRulesChange={setRules}
          onSave={() => void save()}
          saving={saving}
          multiple
        />
      )}
      {error ? <p className="mt-2 text-sm text-[#9b1c1c]">{error}</p> : null}
      {saved ? (
        <p aria-live="polite" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#17663a]">
          <Check className="h-3 w-3" aria-hidden /> Saved
        </p>
      ) : null}
    </div>
  );
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function EmailConnect({ field }: { field: FieldSpec }) {
  const { payload, saveField, sample, authHeaders } = usePractice();
  const current = payload ? textAt(payload, field.path) : "";
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [loading, setLoading] = useState(!sample);
  const [busy, setBusy] = useState<"GOOGLE" | "OUTLOOK" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState<"GOOGLE" | "OUTLOOK" | null>(null);
  const saveRef = useRef(saveField);
  saveRef.current = saveField;

  useEffect(() => {
    if (sample) return;
    const flag = new URLSearchParams(window.location.search).get("connected");
    // A LinkedIn, Instagram or Facebook return belongs to the socials below.
    const ours = flag === "GOOGLE" || flag === "OUTLOOK" || (flag === "failed" && !socialConnectPending());
    if (flag === "GOOGLE" || flag === "OUTLOOK") setJustConnected(flag);
    if (flag === "failed" && ours) setError("Connection failed. Try again.");
    if (ours) {
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [sample]);

  useEffect(() => {
    if (sample) return;
    let cancel = false;
    void (async () => {
      const headers = await authHeaders();
      if (!headers) {
        if (!cancel) setLoading(false);
        return;
      }
      const res = await fetch("/api/coach/integrations/accounts", { headers });
      const body = (await res.json().catch(() => ({}))) as { accounts?: MailAccount[]; error?: string };
      if (cancel) return;
      if (!res.ok) setError(body.error || "Could not load connected email.");
      const rows = (body.accounts ?? []).filter((row) => {
        const provider = row.provider.toUpperCase();
        return provider === "GOOGLE" || provider === "OUTLOOK";
      });
      setAccounts(rows);
      setLoading(false);
      const connected = rows.find((row) => row.status.toUpperCase() === "OK" && row.display_name && looksLikeEmail(row.display_name));
      const email = connected?.display_name?.trim();
      if (email && email !== current) saveRef.current(field, email);
    })();
    return () => {
      cancel = true;
    };
  }, [sample, authHeaders, current, field]);

  async function connect(provider: "GOOGLE" | "OUTLOOK") {
    if (sample) return;
    setBusy(provider);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Not signed in.");
      const res = await fetch("/api/coach/integrations/accounts", {
        method: "POST",
        headers,
        body: JSON.stringify({ provider, returnTo: "practice" }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error || "Could not start connect.");
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start connect.");
      setBusy(null);
    }
  }

  function accountFor(provider: "GOOGLE" | "OUTLOOK") {
    return accounts.find((row) => row.provider.toUpperCase() === provider && row.status.toUpperCase() === "OK");
  }

  const rows: { provider: "GOOGLE" | "OUTLOOK"; title: string }[] = [
    { provider: "GOOGLE", title: "Gmail" },
    { provider: "OUTLOOK", title: "Outlook" },
  ];

  return (
    <div>
      <FieldLabel label="Email" help={field.help} />
      {loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-[var(--bp-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Checking Gmail and Outlook…
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => {
            const account = accountFor(row.provider);
            const email = account?.display_name?.trim() || "";
            const connected = Boolean(account) || justConnected === row.provider;
            return (
              <li key={row.provider} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-[#e3e9f0] bg-[#f4f7fa] px-3.5 py-1.5">
                <p className="min-w-0 truncate text-[0.9375rem] text-[var(--bp-ink)]">
                  <span className="font-semibold">{row.title}</span>
                  {email ? <span className="text-[var(--bp-muted)]"> · {email}</span> : null}
                </p>
                {connected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#b6f3cc] px-2.5 py-1 text-xs font-semibold text-[#0e6a36]">
                    <Check className="h-3 w-3" aria-hidden />
                    {justConnected === row.provider ? "Connected now" : "Connected"}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(busy) || sample}
                    onClick={() => void connect(row.provider)}
                    className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--bp-ink)] ring-1 ring-[#e3e8ef] hover:ring-[#1a8fd4] disabled:opacity-50"
                  >
                    {busy === row.provider ? "Connecting…" : `Connect ${row.title}`}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error ? <p className="mt-2 text-sm text-[#9b1c1c]">{error}</p> : null}
    </div>
  );
}

function SocialField({
  network,
  value,
  onChange,
  onCommit,
  action,
}: {
  network: SocialNetwork;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  /** Connect, or Connected, beside the link box. */
  action?: ReactNode;
}) {
  const meta = SOCIAL_NETWORK_META[network];
  const id = `social-${network}`;
  // One line, like the contact details: the network on the left, the handle or link on the right.
  return (
    <div className="bp-inline">
      <div>
        <label htmlFor={id} className="px-0.5 text-[0.875rem] font-semibold text-[var(--bp-ink)]">
          {meta.label}
        </label>
        <div className="flex min-w-0 items-center gap-2">
          <input
            id={id}
            value={value}
            placeholder={meta.placeholder}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className={`${INPUT} min-w-0 flex-1`}
          />
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function SetupSocials() {
  const { payload, saveField, sample, authHeaders } = usePractice();
  const blueprintLinkedin = payload ? textAt(payload, "identity.linkedin_url") : "";
  const [values, setValues] = useState<Record<string, string>>({ linkedin: blueprintLinkedin });
  const [saved, setSaved] = useState<Record<string, string>>({ linkedin: blueprintLinkedin });
  const [extra, setExtra] = useState<SocialNetwork[]>([]);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [justConnected, setJustConnected] = useState<SocialProvider | null>(null);
  const loaded = useRef(false);

  // Back from LinkedIn, Instagram or Facebook: show it as connected, then load what is connected.
  useEffect(() => {
    if (sample) return;
    const flag = new URLSearchParams(window.location.search).get("connected");
    const social = Object.values(SOCIAL_PROVIDER).find((provider) => provider === flag) ?? null;
    if (social || (flag === "failed" && socialConnectPending())) {
      if (social) setJustConnected(social);
      else setError("Connection failed. Try again.");
      try {
        window.sessionStorage.removeItem(SOCIAL_CONNECT_KEY);
      } catch {
        // Storage can be blocked; the flag in the address is enough.
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    let cancel = false;
    void (async () => {
      const headers = await authHeaders();
      if (!headers || cancel) return;
      const res = await fetch("/api/coach/integrations/accounts", { headers });
      const body = (await res.json().catch(() => ({}))) as { accounts?: MailAccount[] };
      if (!cancel && res.ok) setAccounts(body.accounts ?? []);
    })();
    return () => {
      cancel = true;
    };
  }, [sample, authHeaders]);

  async function connect(provider: SocialProvider) {
    if (sample) return;
    setBusy(provider);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Not signed in.");
      const res = await fetch("/api/coach/integrations/accounts", {
        method: "POST",
        headers,
        body: JSON.stringify({ provider, returnTo: "practice" }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error || "Could not start connect.");
      try {
        window.sessionStorage.setItem(SOCIAL_CONNECT_KEY, provider);
      } catch {
        // Without storage a failed return shows on the email instead. Still fine.
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start connect.");
      setBusy(null);
    }
  }

  function connectFor(network: SocialNetwork): ReactNode {
    const provider = SOCIAL_PROVIDER[network];
    if (!provider) return null;
    const connected =
      justConnected === provider ||
      accounts.some((row) => row.provider.toUpperCase() === provider && row.status.toUpperCase() === "OK");
    return connected ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#b6f3cc] px-2.5 py-1 text-xs font-semibold text-[#0e6a36]">
        <Check className="h-3 w-3" aria-hidden />
        Connected
      </span>
    ) : (
      <button
        type="button"
        disabled={Boolean(busy) || sample}
        onClick={() => void connect(provider)}
        aria-label={`Connect ${SOCIAL_NETWORK_META[network].label}`}
        className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--bp-ink)] ring-1 ring-[#e3e8ef] hover:ring-[#1a8fd4] disabled:opacity-50"
      >
        {busy === provider ? "Connecting…" : "Connect"}
      </button>
    );
  }

  useEffect(() => {
    if (sample || loaded.current || !payload) return;
    loaded.current = true;
    let cancel = false;
    void (async () => {
      const headers = await authHeaders();
      if (!headers || cancel) return;
      const res = await fetch("/api/coach/share-hub/socials", { headers });
      const body = (await res.json().catch(() => ({}))) as {
        linkedin_url?: string | null;
        social_links?: SocialLinks;
        error?: string;
      };
      if (cancel) return;
      if (!res.ok) {
        setError(body.error || "Could not load socials.");
        return;
      }
      const next: Record<string, string> = {
        linkedin: blueprintLinkedin || body.linkedin_url?.trim() || "",
      };
      const opened: SocialNetwork[] = [];
      for (const network of MORE_SOCIALS) {
        const value = body.social_links?.[network]?.trim() || "";
        if (value) {
          next[network] = value;
          opened.push(network);
        }
      }
      for (const network of ["instagram", "facebook"] as const) {
        next[network] = body.social_links?.[network]?.trim() || "";
      }
      setValues(next);
      setSaved(next);
      setExtra(opened);
    })();
    return () => {
      cancel = true;
    };
  }, [sample, authHeaders, blueprintLinkedin, payload]);

  async function commit(network: string) {
    if (sample) return;
    if ((values[network] ?? "") === (saved[network] ?? "")) return;
    const headers = await authHeaders();
    if (!headers) return;
    const social_links: Record<string, string> = {};
    for (const key of [...PRIMARY_SOCIALS, ...MORE_SOCIALS]) {
      if (key === "linkedin") continue;
      const value = (key === network ? values[network] : values[key])?.trim();
      if (value) social_links[key] = value;
    }
    const linkedin = (network === "linkedin" ? values.linkedin : values.linkedin)?.trim() || "";
    const res = await fetch("/api/coach/share-hub/socials", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        linkedin_url: linkedin,
        social_links,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; linkedin_url?: string | null };
    if (!res.ok) {
      setError(body.error || "Could not save that profile.");
      return;
    }
    setError(null);
    setSaved({ ...values });
    if (network === "linkedin") saveField(LINKEDIN_FIELD, body.linkedin_url || linkedin);
  }

  const moreLeft = MORE_SOCIALS.filter((network) => !extra.includes(network) && !values[network]);

  return (
    <div className="space-y-3">
      <div className="grid gap-y-3">
        {PRIMARY_SOCIALS.map((network) => (
          <SocialField
            key={network}
            network={network}
            value={values[network] ?? ""}
            onChange={(value) => setValues((prev) => ({ ...prev, [network]: value }))}
            onCommit={() => void commit(network)}
            action={connectFor(network)}
          />
        ))}
        {extra.map((network) => (
          <SocialField
            key={network}
            network={network}
            value={values[network] ?? ""}
            onChange={(value) => setValues((prev) => ({ ...prev, [network]: value }))}
            onCommit={() => void commit(network)}
          />
        ))}
      </div>
      <p className="pl-[calc(9rem+0.75rem)] text-xs text-[var(--bp-muted)] max-[30rem]:pl-0">
        Connect to bring your messages into your inbox, or just paste your link.
      </p>
      {moreLeft.length ? (
        <div className="relative pl-[calc(9rem+0.75rem)] max-[30rem]:pl-0">
          <button
            type="button"
            onClick={() => setPicking((open) => !open)}
            className="text-xs font-semibold text-[var(--bp-blue)] hover:underline"
          >
            Add YouTube, TikTok or X
          </button>
          {picking ? (
            <div className="absolute left-[calc(9rem+0.75rem)] z-10 mt-1 w-40 rounded-xl border border-[#e3e8ef] bg-white p-1 shadow-lg">
              {moreLeft.map((network) => (
                <button
                  key={network}
                  type="button"
                  onClick={() => {
                    setExtra((prev) => [...prev, network]);
                    setPicking(false);
                  }}
                  className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-[var(--bp-ink)] hover:bg-[var(--bp-tint)]"
                >
                  {SOCIAL_NETWORK_META[network].label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-[#9b1c1c]">{error}</p> : null}
    </div>
  );
}

type Scale = { key: string; left: string; right: string; stops: readonly string[] };

/**
 * Sliders from 1 to 5, one row per scale, with the stop's name above the
 * track. The end you lean to darkens once saved. Saves when you let go.
 */
function ScaleSliders({
  scales,
  value,
  set,
  disabled,
  onMove,
  onCommit,
}: {
  scales: readonly Scale[];
  value: Record<string, number>;
  set: boolean;
  disabled: boolean;
  onMove: (key: string, n: number) => void;
  onCommit: (key: string, n: number) => void;
}) {
  return (
    <div className="divide-y divide-[#eef1f5] rounded-2xl border border-[#e3e9f0] bg-white px-4 @xl:px-5">
      {scales.map((d) => {
        const n = value[d.key];
        const id = `scale-${d.key}`;
        return (
          <div key={d.key} className="py-3.5">
            <div className="mb-2 flex items-center justify-between gap-3 text-[0.8125rem]">
              <span className={`font-medium ${n <= 2 && set ? "text-[var(--bp-ink)]" : "text-[var(--bp-muted)]"}`}>{d.left}</span>
              <label htmlFor={id} className="rounded-full bg-[var(--bp-tint-strong)] px-2.5 py-0.5 text-xs font-semibold text-[var(--bp-blue)]">
                {d.stops[n - 1]}
              </label>
              <span className={`font-medium ${n >= 4 && set ? "text-[var(--bp-ink)]" : "text-[var(--bp-muted)]"}`}>{d.right}</span>
            </div>
            <div className="relative">
              <div aria-hidden className="pointer-events-none absolute inset-x-[6px] top-1/2 flex -translate-y-1/2 justify-between">
                {d.stops.map((_, i) => (
                  <span key={i} className={`h-1.5 w-1.5 rounded-full ${i + 1 === n ? "bg-transparent" : "bg-[#c6d1de]"}`} />
                ))}
              </div>
              <input
                id={id}
                type="range"
                min={1}
                max={5}
                step={1}
                value={n}
                disabled={disabled}
                aria-valuetext={d.stops[n - 1]}
                onChange={(e) => onMove(d.key, Number(e.target.value))}
                onPointerUp={(e) => onCommit(d.key, Number(e.currentTarget.value))}
                onKeyUp={(e) => onCommit(d.key, Number(e.currentTarget.value))}
                className="bp-scale relative block w-full cursor-pointer"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SavedNote({ saved }: { saved: boolean }) {
  return (
    <p
      aria-live="polite"
      className={`mt-1.5 inline-flex items-center gap-1 px-0.5 text-xs font-medium text-[#17663a] transition-opacity ${saved ? "opacity-100" : "opacity-0"}`}
    >
      <Check className="h-3 w-3" aria-hidden /> Saved
    </p>
  );
}

/** Your Voice: five 1 to 5 sliders. Saves when you let go. */
function ToneSliders({ field, changed }: { field: FieldSpec; changed?: boolean }) {
  const { payload, saveField, sample } = usePractice();
  const stored = payload ? asVoiceTone(fieldValue(payload, field.path)?.value) : null;
  const [tone, setTone] = useState<VoiceTone>(stored ?? TONE_START);
  const [saved, setSaved] = useState(false);
  const storedKey = JSON.stringify(stored);
  const [seen, setSeen] = useState(storedKey);
  // A new tone from BCA (or another tab) replaces what is on screen.
  if (seen !== storedKey) {
    setSeen(storedKey);
    if (stored) setTone(stored);
  }

  function commit(next: VoiceTone) {
    if (sample || JSON.stringify(next) === storedKey) return;
    saveField(field, next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div>
      {changed ? <FieldLabel label={field.label} mark="Changed" /> : null}
      {stored ? null : (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-[var(--bp-tint)] px-3.5 py-2.5">
          <p className="text-sm text-[var(--bp-body)]">A good place to start for business owners. Move any slider to sound more like you.</p>
          {sample ? null : (
            <button
              type="button"
              onClick={() => commit(tone)}
              className="rounded-full bg-[var(--bp-navy)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--bp-blue)]"
            >
              Keep this
            </button>
          )}
        </div>
      )}
      <ScaleSliders
        scales={TONE_DIMENSIONS}
        value={tone}
        set={Boolean(stored)}
        disabled={sample}
        onMove={(key, n) => setTone((t) => ({ ...t, [key]: n }))}
        onCommit={(key, n) => commit({ ...tone, [key]: n })}
      />
      <SavedNote saved={saved} />
    </div>
  );
}

/** The kind of coach you are: the three scales from the coaching style lesson, saved as plain lines. */
function CoachStyleSliders({ field, changed }: { field: FieldSpec; changed?: boolean }) {
  const { payload, saveField, sample } = usePractice();
  const text = payload ? String(fieldValue(payload, field.path)?.value ?? "").trim() : "";
  const stored = parseCoachStyle(text);
  // An answer written before the scales: shown, so nothing the coach said is lost from view.
  const written = text && !stored ? text : "";
  const [style, setStyle] = useState<CoachStyle>(stored ?? COACH_STYLE_MIDDLE);
  const [saved, setSaved] = useState(false);
  const [explain, setExplain] = useState(false);
  const storedKey = JSON.stringify(stored);
  const [seen, setSeen] = useState(storedKey);
  if (seen !== storedKey) {
    setSeen(storedKey);
    if (stored) setStyle(stored);
  }

  function commit(next: CoachStyle) {
    if (sample || JSON.stringify(next) === storedKey) return;
    saveField(field, coachStyleText(next));
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 px-0.5">
        <span className="text-[0.875rem] font-semibold text-[var(--bp-ink)]">{field.label}</span>
        <button
          type="button"
          onClick={() => setExplain(true)}
          className="text-[0.8125rem] font-semibold text-[var(--bp-blue)] hover:underline"
        >
          How to choose
        </button>
        {changed ? (
          <span className="rounded-full bg-[#fff4e0] px-2 py-px text-[0.6875rem] font-semibold text-[#8a5300]">Changed</span>
        ) : null}
      </div>
      <Modal
        glass
        open={explain}
        onClose={() => setExplain(false)}
        title="The kind of coach you are"
        titleId="coach-style-title"
        subtitle="Three scales. None is better than another, and both ends get owners great results. Pick where you really sit, not where you think you should."
        maxWidthClassName="max-w-2xl"
        overlayClassName="z-[95]"
      >
        <div className="space-y-6 px-10 pb-9 pt-5">
          {COACH_STYLE_DIMENSIONS.map((d) => (
            <section key={d.key}>
              <h3 className="text-base font-semibold text-slate-900">{d.title}</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {d.ends.map((text, i) => (
                  <div key={i} className="rounded-2xl bg-white/60 px-4 py-3">
                    <p className="text-sm font-semibold text-[#0c5290]">{i === 0 ? d.left : d.right}</p>
                    <p className="mt-0.5 text-[0.9375rem] leading-relaxed text-slate-700">{text}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <p className="text-[0.9375rem] leading-relaxed text-slate-700">
            Most coaches sit somewhere in the middle on at least one. Our writers use your answers so messages sound like working
            with you, and you attract owners who suit how you coach.
          </p>
        </div>
      </Modal>
      {stored ? null : (
        <p className="mb-2.5 px-0.5 text-sm text-[var(--bp-muted)]">
          {written ? (
            <>
              You told us: <span className="text-[var(--bp-body)]">&ldquo;{written}&rdquo;</span> Move the sliders to where you sit and we use them instead.
            </>
          ) : (
            "Move each slider to where you really sit. None is better than another."
          )}
        </p>
      )}
      <ScaleSliders
        scales={COACH_STYLE_DIMENSIONS}
        value={style}
        set={Boolean(stored)}
        disabled={sample}
        onMove={(key, n) => setStyle((t) => ({ ...t, [key]: n }))}
        onCommit={(key, n) => commit({ ...style, [key]: n })}
      />
      <SavedNote saved={saved} />
    </div>
  );
}

export function SetupWidget({ field, changed }: { field: FieldSpec; changed?: boolean }) {
  if (field.widget === "phone") return <PhoneRow field={field} changed={changed} />;
  if (field.widget === "whatsapp") return <WhatsAppRow field={field} />;
  if (field.widget === "timezone") return <TimezoneRow field={field} />;
  if (field.widget === "hours") return <CallHours field={field} changed={changed} />;
  if (field.widget === "email") return <EmailConnect field={field} />;
  if (field.widget === "tone") return <ToneSliders field={field} changed={changed} />;
  if (field.widget === "style") return <CoachStyleSliders field={field} changed={changed} />;
  if (field.widget === "switch") return <SwitchRow field={field} changed={changed} />;
  return null;
}

/**
 * A two-option answer as an on/off switch: on is the first option, off the second.
 * Until it is answered the switch sits off, with a link to choose off on purpose.
 */
function SwitchRow({ field, changed }: { field: FieldSpec; changed?: boolean }) {
  const { payload, saveField, sample } = usePractice();
  const [on, off] = field.options ?? [];
  if (!payload || !on || !off) return null;
  const current = textAt(payload, field.path);
  const checked = current === on.value;
  const chosen = checked ? on : current === off.value ? off : null;
  return (
    <div>
      <FieldLabel label={field.label} help={field.help} mark={changed ? "Changed" : undefined} />
      <div className="flex items-center gap-3 px-0.5">
        <button
          type="button"
          role="switch"
          id={`f-${field.path}`}
          aria-checked={checked}
          aria-label={field.label}
          disabled={sample}
          onClick={() => saveField(field, checked ? off.value : on.value)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a8fd4] focus-visible:ring-offset-2 disabled:opacity-50 ${
            checked ? "bg-[#22a35a]" : "bg-[#cbd5e1]"
          }`}
        >
          <span
            aria-hidden
            className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.3)] transition-transform duration-200 ${
              checked ? "translate-x-5" : ""
            }`}
          />
        </button>
        <span className="text-sm text-[var(--bp-muted)]">{chosen ? chosen.label : "Not set yet."}</span>
        {!chosen && !sample ? (
          <button
            type="button"
            onClick={() => saveField(field, off.value)}
            className="text-sm font-medium text-[var(--bp-blue)] hover:underline"
          >
            {off.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
