"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  AuthSplitShell,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/AuthSplitShell";
import { MEMBERSHIP_THANK_YOU_CONTINUE_PATH } from "@/config/membershipOffers";
import { supabaseClient } from "@/lib/supabaseClient";

type ThankYouState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; firstName: string; createdAccount: boolean };

function ThankYouInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id")?.trim() ?? "";

  const [state, setState] = useState<ThankYouState>(
    sessionId
      ? { status: "loading" }
      : { status: "ready", firstName: "", createdAccount: false }
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/membership/welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          fullName?: string;
          createdAccount?: boolean;
          tokenHash?: string | null;
        };
        if (!res.ok) {
          throw new Error(body.error ?? "Unable to confirm your membership.");
        }
        if (!body.tokenHash) {
          throw new Error(
            "Login token missing. Please sign in from the login page."
          );
        }

        const { error: otpError } = await supabaseClient.auth.verifyOtp({
          token_hash: body.tokenHash,
          type: "email",
        });
        if (otpError) throw new Error(otpError.message);

        if (cancelled) return;
        setState({
          status: "ready",
          firstName: body.fullName?.trim().split(/\s+/)[0] ?? "",
          createdAccount: Boolean(body.createdAccount),
        });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to confirm your membership.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function handleContinue() {
    if (state.status !== "ready") return;
    setPasswordError(null);

    if (state.createdAccount) {
      if (password.length < 8) {
        setPasswordError("Set a password with at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setPasswordError("Passwords do not match.");
        return;
      }
      setBusy(true);
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) {
        setPasswordError(error.message);
        setBusy(false);
        return;
      }
    }

    setBusy(true);
    router.push(MEMBERSHIP_THANK_YOU_CONTINUE_PATH);
  }

  if (state.status === "loading") {
    return (
      <AuthSplitShell
        title="Confirming your payment…"
        subtitle="One moment while we switch your membership on."
      >
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--landing-navy)]" />
        </div>
      </AuthSplitShell>
    );
  }

  if (state.status === "error") {
    const login = `/login?next=${encodeURIComponent(MEMBERSHIP_THANK_YOU_CONTINUE_PATH)}`;
    return (
      <AuthSplitShell
        title="Payment received"
        subtitle="We couldn’t sign you in automatically. Log in to get back to the classroom."
      >
        <p className="text-sm text-rose-600" role="alert">
          {state.message}
        </p>
        <button
          type="button"
          className={authPrimaryButtonClassName}
          onClick={() => router.push(login)}
        >
          Go to login
        </button>
      </AuthSplitShell>
    );
  }

  return (
    <AuthSplitShell
      title={state.firstName ? `Thank you, ${state.firstName}` : "Thank you"}
      subtitle={
        state.createdAccount
          ? "Your membership is active. Set a password so you can log in any time."
          : "Your membership is active and everything is switched back on."
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleContinue();
        }}
      >
        {state.createdAccount ? (
          <>
            <label className="block">
              <span className={authLabelClassName}>Password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`mt-1.5 ${authInputClassName}`}
              />
            </label>
            <label className="block">
              <span className={authLabelClassName}>Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`mt-1.5 ${authInputClassName}`}
              />
            </label>
            {passwordError ? (
              <p className="text-sm text-rose-600" role="alert">
                {passwordError}
              </p>
            ) : null}
          </>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className={authPrimaryButtonClassName}
        >
          {busy ? "Opening…" : "Back to the classroom"}
        </button>
      </form>
    </AuthSplitShell>
  );
}

export default function MembershipThankYouPage() {
  return (
    <Suspense fallback={null}>
      <ThankYouInner />
    </Suspense>
  );
}
