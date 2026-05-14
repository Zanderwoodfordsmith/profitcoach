"use client";

import Link from "next/link";
import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  AuthSplitShell,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/AuthSplitShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const origin = window.location.origin;
    const { error: resetError } = await supabaseClient.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${origin}/login/reset-password` }
    );

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthSplitShell
      title="Reset your password"
      subtitle={
        sent
          ? "If an account exists for that email, we sent a link to choose a new password. Check your inbox and spam folder."
          : "Enter the email you use to sign in. We will send you a reset link."
      }
      footer={
        <p className="text-center text-sm text-slate-600">
          <Link
            href="/login"
            className="font-semibold text-[var(--landing-navy)] underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      }
    >
      {sent ? null : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className={authLabelClassName}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthSplitShell>
  );
}
