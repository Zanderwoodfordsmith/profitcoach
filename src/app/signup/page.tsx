"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    } catch (err: any) {
      setError(err?.message ?? "Unable to sign up.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
        <h1 className="text-center text-xl font-semibold text-slate-900">
          Coach sign up
        </h1>
        <p className="mt-1 text-center text-sm text-slate-600">
          Create your BOSS Dashboard coach account.
        </p>
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4 text-sm"
        >
          <div className="space-y-1">
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-slate-800"
            >
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="businessName"
              className="block text-sm font-medium text-slate-800"
            >
              Coaching business name
            </label>
            <input
              id="businessName"
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-800"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-800"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="slug"
              className="block text-sm font-medium text-slate-800"
            >
              Coach link slug
            </label>
            <input
              id="slug"
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              placeholder="e.g. alex-smith"
            />
            <p className="text-xs text-slate-600">
              This becomes your unique link, e.g. /assessment/alex-smith.
              Use only letters, numbers, and hyphens.
            </p>
          </div>

          {error && (
            <p className="text-sm text-rose-600" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-emerald-600" role="status">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-sky-500 disabled:cursor-wait disabled:opacity-70"
          >
            {loading ? "Creating account…" : "Create coach account"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-600">
          Already have an account?{" "}
          <button
            type="button"
            className="text-sky-700 underline-offset-2 hover:underline"
            onClick={() => router.push("/login")}
          >
            Log in
          </button>
        </p>
      </div>
    </div>
  );
}

