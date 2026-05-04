"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACCOUNT_SETTING_TIMEZONES,
  accountTimezoneOptionLabel,
} from "@/lib/accountProfileTimezones";
import { defaultCommunityCalendarTimezone } from "@/lib/communityCalendarTimezones";
import { supabaseClient } from "@/lib/supabaseClient";
import { AccountEmailPasswordFields } from "@/components/settings/AccountEmailPasswordFields";
import { OutlinedSelect } from "@/components/settings/OutlinedFormField";

function outlineButtonClass(disabled?: boolean) {
  return `rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-50 ${
    disabled ? "cursor-not-allowed opacity-50" : ""
  }`;
}

export type AccountSettingsCardProps = {
  impersonatingCoachId?: string | null;
  timezoneIana: string | null;
  onTimezoneSaved: () => void;
  /** When false, email/password blocks are omitted (shown elsewhere, e.g. Profile tab). */
  showEmailPassword?: boolean;
};

export function AccountSettingsCard({
  impersonatingCoachId,
  timezoneIana,
  onTimezoneSaved,
  showEmailPassword = true,
}: AccountSettingsCardProps) {
  const router = useRouter();
  const securityDisabled = Boolean(impersonatingCoachId);

  const [tz, setTz] = useState<string>(
    timezoneIana?.trim() || defaultCommunityCalendarTimezone()
  );
  const [tzBusy, setTzBusy] = useState(false);
  const [tzError, setTzError] = useState<string | null>(null);

  const [logoutBusy, setLogoutBusy] = useState(false);

  useEffect(() => {
    setTz(timezoneIana?.trim() || defaultCommunityCalendarTimezone());
  }, [timezoneIana]);

  const zoneOptions = useMemo(() => {
    const s = new Set<string>([...ACCOUNT_SETTING_TIMEZONES]);
    const cur = tz.trim();
    if (cur) s.add(cur);
    const def = defaultCommunityCalendarTimezone();
    s.add(def);
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

  async function logOutEverywhere() {
    setLogoutBusy(true);
    const { error } = await supabaseClient.auth.signOut({ scope: "global" });
    setLogoutBusy(false);
    if (error) {
      // Fallback: still clear local session
      await supabaseClient.auth.signOut();
    }
    router.replace("/login");
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Account</h2>
      {!showEmailPassword && !securityDisabled ? (
        <p className="mt-2 text-sm text-slate-600">
          Email and password are on the{" "}
          <span className="font-medium text-slate-800">Profile</span> tab.
        </p>
      ) : null}
      {securityDisabled ? (
        <p className="mt-2 text-sm text-amber-800">
          You are viewing another coach&apos;s workspace.{" "}
          {showEmailPassword
            ? "Email, password, and sign-out apply to your own login — stop impersonating to change them."
            : "Email and password are on the Profile tab for your login; sign-out here applies to your own sessions — stop impersonating to change them."}
        </p>
      ) : null}

      <div className="mt-6 space-y-8">
        {showEmailPassword ? (
          <AccountEmailPasswordFields
            impersonatingCoachId={impersonatingCoachId}
          />
        ) : null}

        <div className="max-w-md">
          <OutlinedSelect
            id="account_timezone"
            label="Timezone"
            value={tz}
            disabled={tzBusy}
            onChange={(e) => void handleTimezoneChange(e)}
            wrapperClassName="w-full max-w-md"
          >
            {zoneOptions.map((z) => (
              <option key={z} value={z}>
                {accountTimezoneOptionLabel(z)}
              </option>
            ))}
          </OutlinedSelect>
          {tzBusy ? (
            <p className="mt-1 text-xs text-slate-500">Saving…</p>
          ) : null}
          {tzError ? (
            <p className="mt-1 text-xs text-rose-600">{tzError}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Log out of all devices
            </p>
            <p className="mt-0.5 text-sm text-slate-600">
              Log out of all active sessions on all devices.
            </p>
          </div>
          <button
            type="button"
            disabled={securityDisabled || logoutBusy}
            onClick={() => void logOutEverywhere()}
            className={outlineButtonClass(securityDisabled || logoutBusy)}
          >
            {logoutBusy ? "…" : "Log out everywhere"}
          </button>
        </div>
      </div>

    </div>
  );
}
