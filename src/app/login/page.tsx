"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  AuthSplitShell,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/AuthSplitShell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
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
      const json = (await res.json()) as { role?: string };
      if (json.role === "admin" || json.role === "coach" || json.role === "client") {
        role = json.role;
      }
    } catch {
      role = "coach";
    }
    if (role === "admin") {
      router.push("/admin");
    } else if (role === "client") {
      router.push("/client");
    } else {
      router.push("/coach/signature");
    }
  }

  return (
    <AuthSplitShell
      title="Welcome back"
      subtitle="Sign in to Profit Coach to continue coaching with clarity."
      footer={
        <p className="text-center text-sm text-slate-600">
          New coach?{" "}
          <Link
            href="/join"
            className="font-semibold text-[var(--landing-navy)] underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      }
    >
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
      </form>
    </AuthSplitShell>
  );
}
