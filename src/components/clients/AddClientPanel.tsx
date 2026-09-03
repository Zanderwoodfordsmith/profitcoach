"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { LinkedInSolidIcon } from "@/components/icons/LinkedInSolidIcon";

type CoachOption = { id: string; label: string };

type Props = {
  onImported: (contactId: string) => void;
  onManualCreated: (contactId: string) => void;
  onClose?: () => void;
  authHeaders: () => Promise<Record<string, string> | null>;
  /** Admin: create under a coach */
  coachOptions?: CoachOption[];
  selectedCoachId?: string;
  onCoachIdChange?: (id: string) => void;
  allowUnassignedCoach?: boolean;
  /** Admin uses a different manual create endpoint path via callback */
  onManualSubmit?: (fields: {
    fullName: string;
    email: string;
    businessName: string;
  }) => Promise<string | null>;
  /**
   * `hero` — empty-state onboarding (LinkedIn front and centre).
   * `panel` — compact add form when a roster already exists.
   */
  variant?: "hero" | "panel";
};

const INPUT =
  "block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400";

export function AddClientPanel({
  onImported,
  onManualCreated,
  onClose,
  authHeaders,
  coachOptions,
  selectedCoachId = "none",
  onCoachIdChange,
  allowUnassignedCoach = true,
  onManualSubmit,
  variant = "panel",
}: Props) {
  const [mode, setMode] = useState<"linkedin" | "manual">("linkedin");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const showCoachSelector = Boolean(coachOptions && onCoachIdChange);
  const isHero = variant === "hero";

  async function handleLinkedIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You must be signed in.");
      const res = await fetch("/api/coach/clients/import-linkedin", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        contactId?: string;
        created?: boolean;
        error?: string;
      };
      if (!res.ok || !body.contactId) {
        throw new Error(body.error ?? "Unable to import from LinkedIn.");
      }
      setSuccess(
        body.created
          ? "Client imported from LinkedIn."
          : "Client updated from LinkedIn."
      );
      setLinkedinUrl("");
      onImported(body.contactId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (onManualSubmit) {
        const id = await onManualSubmit({ fullName, email, businessName });
        if (!id) throw new Error("Unable to create client.");
        setSuccess("Client created.");
        setFullName("");
        setEmail("");
        setBusinessName("");
        onManualCreated(id);
        return;
      }
      const headers = await authHeaders();
      if (!headers) throw new Error("You must be signed in.");
      const res = await fetch("/api/coach/contacts", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email: email || undefined,
          businessName: businessName || undefined,
          type: "client",
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        contactId?: string;
        error?: string;
      };
      if (!res.ok || !body.contactId) {
        throw new Error(body.error ?? "Unable to create client.");
      }
      setSuccess("Client created.");
      setFullName("");
      setEmail("");
      setBusinessName("");
      onManualCreated(body.contactId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create client.");
    } finally {
      setBusy(false);
    }
  }

  const formBody =
    mode === "linkedin" ? (
      <form onSubmit={handleLinkedIn} className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="clientLinkedInUrl"
            className="block text-sm font-medium text-slate-800"
          >
            LinkedIn profile URL
          </label>
          <div className="relative">
            <LinkedInSolidIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              id="clientLinkedInUrl"
              type="url"
              required
              autoFocus={isHero}
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/…"
              className={`${INPUT} pl-9 ${isHero ? "py-3 text-base" : ""}`}
            />
          </div>
          <p className="text-sm text-slate-600">
            We pull name, photo, headline, and company so their workspace starts
            with real context.
          </p>
        </div>
        <button
          type="submit"
          disabled={busy}
          className={`inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 font-semibold text-white hover:bg-sky-600 disabled:opacity-70 ${
            isHero ? "py-2.5 text-base" : "py-2 text-sm"
          }`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {busy ? "Importing…" : "Import from LinkedIn"}
        </button>
      </form>
    ) : (
      <form
        onSubmit={handleManual}
        className={`grid gap-3 ${isHero ? "" : "sm:grid-cols-2"}`}
      >
        {showCoachSelector ? (
          <div className="space-y-1 sm:col-span-2">
            <label
              htmlFor="clientCoach"
              className="block text-sm font-medium text-slate-800"
            >
              Coach{allowUnassignedCoach ? " (optional)" : ""}
            </label>
            <select
              id="clientCoach"
              value={selectedCoachId}
              onChange={(e) => onCoachIdChange?.(e.target.value)}
              className={INPUT}
            >
              {allowUnassignedCoach ? (
                <option value="none">None (unassigned)</option>
              ) : null}
              {(coachOptions ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="space-y-1">
          <label
            htmlFor="clientFullName"
            className="block text-sm font-medium text-slate-800"
          >
            Full name
          </label>
          <input
            id="clientFullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={INPUT}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="clientEmail"
            className="block text-sm font-medium text-slate-800"
          >
            Email (optional)
          </label>
          <input
            id="clientEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
        </div>
        <div className={`space-y-1 ${isHero ? "" : "sm:col-span-2"}`}>
          <label
            htmlFor="clientBusinessName"
            className="block text-sm font-medium text-slate-800"
          >
            Business name (optional)
          </label>
          <input
            id="clientBusinessName"
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className={INPUT}
          />
        </div>
        <div className={isHero ? "" : "sm:col-span-2"}>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-70"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {busy ? "Creating…" : "Create client"}
          </button>
        </div>
      </form>
    );

  if (isHero) {
    return (
      <section className="mx-auto w-full max-w-lg pt-2">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Bring your first client in
        </h2>
        <p className="mt-2 text-base leading-relaxed text-slate-700">
          Most coaches start with one person. Paste their LinkedIn profile and
          we&apos;ll set up their workspace.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.35)] sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("linkedin")}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                mode === "linkedin"
                  ? "bg-sky-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              LinkedIn
            </button>
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                mode === "manual"
                  ? "bg-sky-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Add manually
            </button>
          </div>
          {formBody}
          {error ? (
            <p className="mt-3 text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="mt-3 text-sm text-emerald-800" role="status">
              {success}
            </p>
          ) : null}
        </div>

        <p className="mt-5 text-sm text-slate-600">
          After import you can run BOSS Score, open playbooks, and keep notes in
          one place.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Add client</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Import from LinkedIn or enter details manually.
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="mt-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setMode("linkedin")}
          className={`rounded-md px-3 py-1.5 font-medium transition ${
            mode === "linkedin"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          LinkedIn
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`rounded-md px-3 py-1.5 font-medium transition ${
            mode === "manual"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Manual
        </button>
      </div>

      <div className="mt-4">{formBody}</div>

      {error ? (
        <p className="mt-3 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-3 text-sm text-emerald-800" role="status">
          {success}
        </p>
      ) : null}
    </section>
  );
}
