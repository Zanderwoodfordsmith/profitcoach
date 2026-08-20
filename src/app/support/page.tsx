"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AuthSplitShell,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/AuthSplitShell";

export default function PublicSupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/support/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
          website,
        }),
      });
      const body = (await res.json()) as {
        error?: string;
        ticket_number?: number | null;
      };
      if (!res.ok) {
        setError(body.error ?? "Could not send your message.");
        return;
      }
      setTicketNumber(body.ticket_number ?? null);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setError("Could not send your message. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplitShell
      title="Contact support"
      subtitle="Having trouble signing in or need help with your account? Send us a message and we'll get back to you by email."
      footer={
        <p className="text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[var(--landing-navy)] underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      }
    >
      {ticketNumber ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900">
          <p className="font-semibold">Message sent</p>
          <p className="mt-1 text-sm">
            Thanks — we&apos;ve received your request
            {ticketNumber
              ? ` (reference SUP-${String(ticketNumber).padStart(4, "0")})`
              : ""}
            . We&apos;ll reply to your email as soon as we can.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block text-sm font-semibold text-emerald-800 underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="support-name" className={authLabelClassName}>
              Name
            </label>
            <input
              id="support-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={authInputClassName}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="support-email" className={authLabelClassName}>
              Email
            </label>
            <input
              id="support-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClassName}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="support-subject" className={authLabelClassName}>
              Subject
            </label>
            <input
              id="support-subject"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={authInputClassName}
              placeholder="What do you need help with?"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="support-message" className={authLabelClassName}>
              Message
            </label>
            <textarea
              id="support-message"
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={`${authInputClassName} resize-y`}
              placeholder="Tell us what happened and how we can help."
            />
          </div>
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
          />
          {error ? (
            <p className="text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className={authPrimaryButtonClassName}
          >
            {busy ? "Sending…" : "Send message"}
          </button>
        </form>
      )}
    </AuthSplitShell>
  );
}
