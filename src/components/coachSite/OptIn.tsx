"use client";

import { recallTraffic } from "@/lib/trafficSource";

import { ArrowRight, Download, Printer } from "lucide-react";
import { useState, type FormEvent } from "react";
import { downloadPng, printPdf } from "@/lib/printPack/browserExport";

type Sheet = { svg: string; title: string; filename: string };

type Props = {
  slug: string;
  firstName: string;
  scorecard: Sheet;
  playbooks: Sheet;
  /** Preview pages never send a real lead. */
  preview: boolean;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function OptIn({ slug, firstName, scorecard, playbooks, preview }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim()) {
      setError("Add your first name so we know who to send it to.");
      return;
    }
    if (!EMAIL.test(cleanEmail)) {
      setError("That email address does not look right. Check it and try again.");
      return;
    }
    setError(null);
    setState("sending");
    if (preview) {
      // Design preview: show the thank-you state without creating a contact.
      setState("done");
      return;
    }
    try {
      const res = await fetch("/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          traffic: recallTraffic(),
          coachSlug: slug,
          contact: {
            first_name: name.trim().slice(0, 80),
            email: cleanEmail.slice(0, 200),
            business_name: business.trim().slice(0, 120) || undefined,
          },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("done");
    } catch {
      setState("idle");
      setError("We could not send that just now. Try again in a minute.");
    }
  }

  async function run(id: string, job: () => Promise<void>) {
    setBusy(id);
    try {
      await job();
    } catch {
      setError("The download did not start. Try again, or use the other format.");
    } finally {
      setBusy(null);
    }
  }

  if (state === "done") {
    return (
      <div className="cs-done" role="status">
        <strong>Here you go, {name.trim().split(/\s+/)[0]}.</strong>
        <p className="cs-small">
          Print the scorecard, circle one answer per line, and bring it to a call with {firstName}. The QR
          code on the sheet takes you to the online version with instant results.
        </p>
        <div className="cs-actions">
          <button
            type="button"
            className="cs-btn"
            disabled={busy !== null}
            onClick={() => run("pdf", () => printPdf(scorecard.svg, scorecard.title))}
          >
            <Printer aria-hidden="true" />
            {busy === "pdf" ? "Opening…" : "Print or save the scorecard"}
          </button>
          <button
            type="button"
            className="cs-link"
            disabled={busy !== null}
            onClick={() => run("map", () => downloadPng(playbooks.svg, 2400, `${playbooks.filename}.png`))}
          >
            <Download aria-hidden="true" />
            {busy === "map" ? "Preparing…" : "Download the 50 playbooks map"}
          </button>
        </div>
        {error ? <p className="cs-form__error">{error}</p> : null}
      </div>
    );
  }

  return (
    <form className="cs-form" onSubmit={submit} noValidate>
      <div className="cs-form__row">
        <div className="cs-field">
          <label htmlFor="cs-optin-name">First name</label>
          <input
            id="cs-optin-name"
            name="first_name"
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={error !== null && !name.trim()}
            maxLength={80}
          />
        </div>
        <div className="cs-field">
          <label htmlFor="cs-optin-business">Business</label>
          <input
            id="cs-optin-business"
            name="business"
            autoComplete="organization"
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            maxLength={120}
          />
        </div>
      </div>
      <div className="cs-field">
        <label htmlFor="cs-optin-email">Email</label>
        <input
          id="cs-optin-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error !== null && !EMAIL.test(email.trim())}
          maxLength={200}
        />
      </div>
      {error ? (
        <p className="cs-form__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="cs-actions">
        <button type="submit" className="cs-btn" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Get the scorecard"}
          <ArrowRight aria-hidden="true" />
        </button>
        <span className="cs-fine">Your details go to {firstName} only.</span>
      </div>
    </form>
  );
}
