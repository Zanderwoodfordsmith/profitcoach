"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ACCOUNT_SETTING_TIMEZONES,
  accountTimezoneOptionLabel,
} from "@/lib/accountProfileTimezones";
import { defaultCommunityCalendarTimezone } from "@/lib/communityCalendarTimezones";
import { supabaseClient } from "@/lib/supabaseClient";
import { ProfileMinimalSelect } from "@/components/settings/ProfileFormLayout";

export type ProfileTimezoneSelectProps = {
  timezoneIana: string | null;
  onTimezoneSaved: () => void;
  impersonatingCoachId?: string | null;
  /** When false, show a single subtle text line instead of the select. */
  editing?: boolean;
};

export function ProfileTimezoneSelect({
  timezoneIana,
  onTimezoneSaved,
  impersonatingCoachId,
  editing = true,
}: ProfileTimezoneSelectProps) {
  const [tz, setTz] = useState<string>(
    timezoneIana?.trim() || defaultCommunityCalendarTimezone()
  );
  const [tzBusy, setTzBusy] = useState(false);
  const [tzError, setTzError] = useState<string | null>(null);

  useEffect(() => {
    setTz(timezoneIana?.trim() || defaultCommunityCalendarTimezone());
  }, [timezoneIana]);

  const zoneOptions = useMemo(() => {
    const s = new Set<string>([...ACCOUNT_SETTING_TIMEZONES]);
    const cur = tz.trim();
    if (cur) s.add(cur);
    s.add(defaultCommunityCalendarTimezone());
    return [...s].sort((a, b) =>
      accountTimezoneOptionLabel(a).localeCompare(accountTimezoneOptionLabel(b))
    );
  }, [tz]);

  const patchTimezone = useCallback(
    async (next: string) => {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session?.access_token) return;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      };
      if (impersonatingCoachId) {
        headers["x-impersonate-coach-id"] = impersonatingCoachId;
      }
      const res = await fetch("/api/coach/profile", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ timezone: next }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not save timezone.");
    },
    [impersonatingCoachId]
  );

  async function handleTimezoneChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setTz(next);
    setTzError(null);
    setTzBusy(true);
    try {
      await patchTimezone(next);
      onTimezoneSaved();
    } catch (err) {
      setTzError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setTzBusy(false);
    }
  }

  const label = accountTimezoneOptionLabel(tz);

  if (!editing) {
    return (
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    );
  }

  return (
    <div className="max-w-xs">
      <ProfileMinimalSelect
        id="profile_timezone"
        value={tz}
        disabled={tzBusy}
        onChange={(e) => void handleTimezoneChange(e)}
      >
        {zoneOptions.map((z) => (
          <option key={z} value={z}>
            {accountTimezoneOptionLabel(z)}
          </option>
        ))}
      </ProfileMinimalSelect>
      {tzBusy ? (
        <p className="mt-0.5 text-[11px] text-slate-500">Saving…</p>
      ) : null}
      {tzError ? (
        <p className="mt-0.5 text-[11px] text-rose-600">{tzError}</p>
      ) : null}
    </div>
  );
}
