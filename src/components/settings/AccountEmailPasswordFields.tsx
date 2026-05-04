"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { OutlinedTextField } from "@/components/settings/OutlinedFormField";

function outlineButtonClass(disabled?: boolean) {
  return `rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-50 ${
    disabled ? "cursor-not-allowed opacity-50" : ""
  }`;
}

export type AccountEmailPasswordFieldsProps = {
  impersonatingCoachId?: string | null;
  className?: string;
};

export function AccountEmailPasswordFields({
  impersonatingCoachId,
  className = "",
}: AccountEmailPasswordFieldsProps) {
  const securityDisabled = Boolean(impersonatingCoachId);

  const [email, setEmail] = useState<string | null>(null);

  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [pwdOpen, setPwdOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (impersonatingCoachId) {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        if (!session?.access_token) {
          if (!cancelled) setEmail(null);
          return;
        }
        const res = await fetch("/api/coach/profile", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "x-impersonate-coach-id": impersonatingCoachId,
          },
        });
        const body = (await res.json().catch(() => ({}))) as {
          account_email?: string | null;
        };
        if (!cancelled) setEmail(body.account_email ?? null);
        return;
      }
      const { data } = await supabaseClient.auth.getUser();
      if (!cancelled) setEmail(data.user?.email ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [impersonatingCoachId]);

  async function submitEmailChange() {
    setEmailError(null);
    const trimmed = newEmail.trim();
    if (!trimmed) {
      setEmailError("Enter an email address.");
      return;
    }
    setEmailBusy(true);
    const { error } = await supabaseClient.auth.updateUser({ email: trimmed });
    setEmailBusy(false);
    if (error) {
      setEmailError(error.message);
      return;
    }
    setEmailOpen(false);
    setNewEmail("");
    setEmail(trimmed);
  }

  async function submitPasswordChange() {
    setPwdError(null);
    if (newPassword.length < 8) {
      setPwdError("Use at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("Passwords do not match.");
      return;
    }
    setPwdBusy(true);
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword,
    });
    setPwdBusy(false);
    if (error) {
      setPwdError(error.message);
      return;
    }
    setPwdOpen(false);
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className={`max-w-md space-y-6 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-xs">
          <p className="text-sm font-semibold text-slate-900">Email</p>
          <p className="mt-0.5 break-all text-sm text-slate-600">{email ?? "—"}</p>
        </div>
        <button
          type="button"
          disabled={securityDisabled}
          onClick={() => {
            setEmailError(null);
            setNewEmail(email ?? "");
            setEmailOpen(true);
          }}
          className={outlineButtonClass(securityDisabled)}
        >
          Change email
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Password</p>
          <p className="mt-0.5 text-sm text-slate-600">Change your password</p>
        </div>
        <button
          type="button"
          disabled={securityDisabled}
          onClick={() => {
            setPwdError(null);
            setPwdOpen(true);
          }}
          className={outlineButtonClass(securityDisabled)}
        >
          Change password
        </button>
      </div>

      {emailOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Change email
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              You may need to confirm the new address from your inbox (depends on
              your project&apos;s auth settings).
            </p>
            <div className="mt-4">
              <OutlinedTextField
                id="account_modal_new_email"
                label="Email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoComplete="email"
                wrapperClassName="w-full"
              />
            </div>
            {emailError ? (
              <p className="mt-2 text-sm text-rose-600">{emailError}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEmailOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={emailBusy}
                onClick={() => void submitEmailChange()}
                className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {emailBusy ? "Saving…" : "Update email"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pwdOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Change password
            </h3>
            <div className="mt-4 space-y-4">
              <OutlinedTextField
                id="account_modal_new_password"
                label="New password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                wrapperClassName="w-full"
              />
              <OutlinedTextField
                id="account_modal_confirm_password"
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                wrapperClassName="w-full"
              />
            </div>
            {pwdError ? (
              <p className="mt-2 text-sm text-rose-600">{pwdError}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPwdOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pwdBusy}
                onClick={() => void submitPasswordChange()}
                className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {pwdBusy ? "Saving…" : "Update password"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
