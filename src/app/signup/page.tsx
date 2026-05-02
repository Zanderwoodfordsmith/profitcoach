"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AuthSplitShell,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/AuthSplitShell";

export default function CoachSignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/coach-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          businessName,
          email,
          password,
          slug,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? "Unable to sign up.");
      }
      setSuccess(
        "Account created. You can now sign in on the login page."
      );
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to sign up.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitShell
      title="Create your account"
      subtitle="Set up your BOSS Dashboard coach profile in a few steps."
      footer={
        <p className="text-center text-sm text-slate-600">
          Already have an account?{" "}
          <button
            type="button"
            className="font-semibold text-[var(--landing-navy)] underline-offset-4 hover:underline"
            onClick={() => router.push("/login")}
          >
            Log in
          </button>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        <div className="space-y-1.5">
          <label htmlFor="fullName" className={authLabelClassName}>
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Coach"
            className={authInputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="businessName" className={authLabelClassName}>
            Coaching business name
          </label>
          <input
            id="businessName"
            type="text"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Your practice name"
            className={authInputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className={authLabelClassName}>
            Email
          </label>
          <input
            id="email"
            type="email"
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
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Choose a secure password"
            className={authInputClassName}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="slug" className={authLabelClassName}>
            Coach link slug
          </label>
          <input
            id="slug"
            type="text"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. alex-smith"
            className={authInputClassName}
          />
          <p className="text-xs leading-relaxed text-slate-500">
            Your public assessment link uses this slug (letters, numbers, and
            hyphens only).
          </p>
        </div>

        {error ? (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="text-sm text-emerald-600" role="status">
            {success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className={authPrimaryButtonClassName}
        >
          {loading ? "Creating account…" : "Create coach account"}
        </button>
      </form>
    </AuthSplitShell>
  );
}
