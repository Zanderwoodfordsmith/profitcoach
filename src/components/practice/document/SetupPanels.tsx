"use client";

import { useEffect, useRef, useState } from "react";
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

import { usePractice } from "../PracticeProvider";
import { InfoTip } from "./InfoTip";

const INPUT =
  "bp-input w-full rounded-xl border border-[#e6eaf0] bg-[#f4f6f9] px-3.5 py-2.5 text-left text-[0.9844rem] leading-[1.6] text-[var(--bp-ink)] transition-[background-color,border-color,box-shadow] placeholder:text-[#9aa8b8] hover:border-[#dbe1e9] hover:bg-[#eff2f6] focus:border-[#bfdcf2] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,143,212,0.12)] focus:outline-none";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const PRIMARY_SOCIALS = ["linkedin", "instagram", "facebook"] as const;
const MORE_SOCIALS = ["youtube", "tiktok", "x"] as const;

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

function zoneCity(iana: string): string {
  const city = iana.split("/").pop()?.replaceAll("_", " ") || iana;
  try {
    const off = new Intl.DateTimeFormat("en-GB", {
      timeZone: iana,
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    return off ? `${city}, ${off}` : city;
  } catch {
    return city;
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
  const byDay = new Map(rules.map((rule) => [rule.weekday, rule]));
  const groups: { days: number[]; start: string; end: string }[] = [];
  for (const day of DAY_ORDER) {
    const rule = byDay.get(day);
    if (!rule) continue;
    const start = rule.start_time.slice(0, 5);
    const end = rule.end_time.slice(0, 5);
    const prev = groups[groups.length - 1];
    const prevDay = prev?.days[prev.days.length - 1];
    const consecutive =
      prev &&
      prevDay !== undefined &&
      DAY_ORDER.indexOf(day) === DAY_ORDER.indexOf(prevDay) + 1 &&
      prev.start === start &&
      prev.end === end;
    if (consecutive && prev) prev.days.push(day);
    else groups.push({ days: [day], start, end });
  }
  return groups
    .map((group) => {
      const names =
        group.days.length === 1
          ? DAY[group.days[0]]
          : `${DAY[group.days[0]]} to ${DAY[group.days[group.days.length - 1]]}`;
      return `${names}, ${group.start} to ${group.end}`;
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
        <span
          className={`rounded-full px-2 py-px text-[0.6875rem] font-semibold ${
            mark === "Needed"
              ? "bg-[#fde8e6] text-[#9b2c2c]"
              : "bg-[#fff4e0] text-[#8a5300]"
          }`}
        >
          {mark}
        </span>
      ) : null}
    </div>
  );
}

function WhatsAppRow({ field }: { field: FieldSpec }) {
  const { payload, saveField, sample } = usePractice();
  const phone = payload ? textAt(payload, "identity.phone") : "";
  const current = payload ? textAt(payload, field.path) : "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const lastPhone = useRef(phone);
  const saveRef = useRef(saveField);
  saveRef.current = saveField;

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

  const custom = Boolean(current && phone && current !== phone);

  function commit(next: string) {
    const value = next.trim();
    setEditing(false);
    if (!value || value === phone) {
      if (phone && current !== phone) saveField(field, phone);
      return;
    }
    if (value !== current) saveField(field, value);
  }

  return (
    <div>
      <FieldLabel label="WhatsApp" help={field.help} />
      {editing ? (
        <input
          autoFocus
          value={draft}
          placeholder={phone || "WhatsApp number"}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(current || phone);
              setEditing(false);
            }
          }}
          className={INPUT}
          aria-label="WhatsApp number"
        />
      ) : (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 text-[0.9375rem] leading-6 text-[var(--bp-body)]">
          <span>
            {custom ? current : phone ? `Same as your phone, ${phone}` : "Add a phone number above, or set a WhatsApp number."}
          </span>
          <button
            type="button"
            onClick={() => {
              if (custom && phone) {
                saveField(field, phone);
                return;
              }
              setDraft(custom ? current : "");
              setEditing(true);
            }}
            className="text-xs font-semibold text-[var(--bp-blue)] hover:underline"
          >
            {custom ? "Use your phone number" : phone ? "Use a different number" : "Set a number"}
          </button>
        </p>
      )}
    </div>
  );
}

function TimezoneRow({ field }: { field: FieldSpec }) {
  const { payload, saveField, sample, authHeaders, viewer } = usePractice();
  const stored = payload ? textAt(payload, field.path) : "";
  const [changing, setChanging] = useState(false);
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
    setChanging(false);
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
      {changing ? (
        <div className="relative">
          <select
            autoFocus
            value={shown}
            onChange={(e) => choose(e.target.value)}
            onBlur={() => setChanging(false)}
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
      ) : (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 text-[0.9375rem] leading-6 text-[var(--bp-body)]">
          <span>{zoneCity(shown)}</span>
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="text-xs font-semibold text-[var(--bp-blue)] hover:underline"
          >
            Change
          </button>
        </p>
      )}
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

  const mark = changed ? "Changed" : !existing ? "Needed" : undefined;

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
    if (flag === "GOOGLE" || flag === "OUTLOOK") setJustConnected(flag);
    if (flag === "failed") setError("Connection failed. Try again.");
    if (flag) {
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
        <ul className="divide-y divide-[#eceff3] border-y border-[#eceff3]">
          {rows.map((row) => {
            const account = accountFor(row.provider);
            const email = account?.display_name?.trim() || "";
            const connected = Boolean(account) || justConnected === row.provider;
            return (
              <li key={row.provider} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-[0.9375rem] font-semibold text-[var(--bp-ink)]">{row.title}</p>
                  {email ? <p className="truncate text-sm text-[var(--bp-muted)]">{email}</p> : null}
                </div>
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
}: {
  network: SocialNetwork;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  const meta = SOCIAL_NETWORK_META[network];
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block px-0.5 text-[0.875rem] font-semibold text-[var(--bp-ink)]">{meta.label}</span>
      <input
        value={value}
        placeholder={meta.placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={INPUT}
      />
    </label>
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
  const loaded = useRef(false);

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
    <div>
      <FieldLabel label="Socials" help="Where owners can find you. A handle is enough, or paste the full link." />
      <div className="grid gap-x-4 gap-y-5 @xl:grid-cols-2">
        {PRIMARY_SOCIALS.map((network) => (
          <SocialField
            key={network}
            network={network}
            value={values[network] ?? ""}
            onChange={(value) => setValues((prev) => ({ ...prev, [network]: value }))}
            onCommit={() => void commit(network)}
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
      {moreLeft.length ? (
        <div className="relative mt-3">
          <button
            type="button"
            onClick={() => setPicking((open) => !open)}
            className="text-xs font-semibold text-[var(--bp-blue)] hover:underline"
          >
            Add YouTube, TikTok or X
          </button>
          {picking ? (
            <div className="absolute left-0 z-10 mt-1 w-40 rounded-xl border border-[#e3e8ef] bg-white p-1 shadow-lg">
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

export function SetupWidget({ field, changed }: { field: FieldSpec; changed?: boolean }) {
  if (field.widget === "whatsapp") return <WhatsAppRow field={field} />;
  if (field.widget === "timezone") return <TimezoneRow field={field} />;
  if (field.widget === "hours") return <CallHours field={field} changed={changed} />;
  if (field.widget === "email") return <EmailConnect field={field} />;
  return null;
}
