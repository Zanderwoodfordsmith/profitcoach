"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabaseClient } from "@/lib/supabaseClient";
import { clearWinsQueueSessionDismiss } from "@/lib/adminWinsReplyQueueSession";
import {
  AuthSplitShell,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/AuthSplitShell";
import { resolvePostLoginPath } from "@/lib/auth/loginReturnPath";

const PROSPECT_PORTAL_MESSAGE =
  "This account is linked as a prospect only. The client dashboard is for invited clients. Use your coach’s assessment link to submit or update your BOSS score; your coach will give you portal access when you become a client.";

export default function LoginPage() {
  const router = useRouter();
  const { clearImpersonation, clearContactImpersonation } = useImpersonation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email")?.trim();
    if (emailParam) setEmail(emailParam);
    if (params.get("reason") === "prospect_portal") {
      setError(PROSPECT_PORTAL_MESSAGE);
      setSuccessMessage(null);
    } else if (params.get("reset") === "success") {
      setError(null);
      setSuccessMessage(
        "Your password was updated. Sign in with your new password."
      );
    }
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    const { data, error: signInError } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !data.user) {
      setError(signInError?.message ?? "Unable to sign in.");
      setLoading(false);
      return;
    }

    // Stale sessionStorage impersonation (e.g. another tab or old admin session)
    // would make Community scope the wrong user id and “lose” read/dimmed state.
    clearImpersonation();
    clearContactImpersonation();
    clearWinsQueueSessionDismiss();

    let role = "coach";
    try {
      const res = await fetch("/api/profile-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.user.id }),
      });
      if (!res.ok) {
        throw new Error("Request failed");
      }
      const json = (await res.json()) as {
        role?: string;
        linked_contact_type?: string | null;
      };
      if (json.role === "admin" || json.role === "coach" || json.role === "client") {
        role = json.role;
      }
      if (
        role === "client" &&
        json.linked_contact_type === "prospect"
      ) {
        await supabaseClient.auth.signOut();
        setError(PROSPECT_PORTAL_MESSAGE);
        setLoading(false);
        return;
      }
    } catch {
      role = "coach";
    }
    const nextParam = new URLSearchParams(window.location.search).get("next");
    router.push(
      resolvePostLoginPath(
        role as "admin" | "coach" | "client",
        nextParam
      )
    );
  }

  return (
    <AuthSplitShell
      title="Welcome back"
      subtitle="Sign in to Profit Coach to continue coaching with clarity."
    >
      {/* Chrome on iPhone adds __gcruniqueid to the form and inputs before React loads. */}
      <form onSubmit={handleSubmit} className="space-y-4" suppressHydrationWarning>
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
            suppressHydrationWarning
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className={authLabelClassName}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={`${authInputClassName} pr-20`}
              suppressHydrationWarning
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-3 text-sm font-medium text-slate-600 transition hover:text-slate-900"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        {successMessage ? (
          <p className="text-sm text-emerald-700" role="status">
            {successMessage}
          </p>
        ) : null}
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
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <div className="flex items-center justify-between gap-3 pt-1">
          <Link
            href="/support"
            className="text-sm font-semibold text-[var(--landing-navy)] underline-offset-4 hover:underline"
          >
            Contact support
          </Link>
          <Link
            href="/login/forgot-password"
            className="text-sm font-semibold text-[var(--landing-navy)] underline-offset-4 hover:underline"
          >
            Reset password
          </Link>
        </div>
      </form>
    </AuthSplitShell>
  );
}
