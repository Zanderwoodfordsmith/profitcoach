"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  AuthSplitShell,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/AuthSplitShell";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hasAuthHash =
        url.hash.length > 1 &&
        (url.hash.includes("access_token") || url.hash.includes("type=recovery"));

      if (code) {
        const { error: exchangeError } =
          await supabaseClient.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeError) {
          setInitError(exchangeError.message);
          return;
        }
        window.history.replaceState({}, "", url.pathname + url.hash);
      } else if (hasAuthHash) {
        // Implicit recovery link: client parses the hash asynchronously.
        await new Promise((r) => setTimeout(r, 150));
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabaseClient.auth.getSession();
      if (cancelled) return;
      if (sessionError) {
        setInitError(sessionError.message);
        return;
      }
      if (!session) {
        setInitError(
          "This reset link is invalid or has expired. Request a new one from the login page."
        );
        return;
      }
      setReady(true);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabaseClient.auth.updateUser({
      password,
    });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await supabaseClient.auth.signOut();
    router.push("/login?reset=success");
  }

  if (initError) {
    return (
      <AuthSplitShell
        title="Could not reset password"
        subtitle={initError}
        footer={
          <p className="text-center text-sm text-slate-600">
            <Link
              href="/login/forgot-password"
              className="font-semibold text-[var(--landing-navy)] underline-offset-4 hover:underline"
            >
              Request a new link
            </Link>
            {" · "}
            <Link
              href="/login"
              className="font-semibold text-[var(--landing-navy)] underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        }
      >
        {null}
      </AuthSplitShell>
    );
  }

  if (!ready) {
    return (
      <AuthSplitShell
        title="Reset your password"
        subtitle="Verifying your reset link…"
      >
        <p className="text-sm text-slate-600">One moment.</p>
      </AuthSplitShell>
    );
  }

  return (
    <AuthSplitShell
      title="Choose a new password"
      subtitle="Enter a new password for your account."
      footer={
        <p className="text-center text-sm text-slate-600">
          <Link
            href="/login"
            className="font-semibold text-[var(--landing-navy)] underline-offset-4 hover:underline"
          >
            Cancel and sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="password" className={authLabelClassName}>
            New password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={`${authInputClassName} pr-20`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((c) => !c)}
              className="absolute inset-y-0 right-3 text-sm font-medium text-slate-600 transition hover:text-slate-900"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirm" className={authLabelClassName}>
            Confirm new password
          </label>
          <input
            id="confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
            className={authInputClassName}
          />
        </div>
        {error ? (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className={authPrimaryButtonClassName}
        >
          {loading ? "Saving…" : "Update password"}
        </button>
      </form>
    </AuthSplitShell>
  );
}
