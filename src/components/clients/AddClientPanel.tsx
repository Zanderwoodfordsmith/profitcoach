"use client";

import { useState } from "react";
import { Linkedin, Loader2 } from "lucide-react";

type CoachOption = { id: string; label: string };

type Props = {
  onImported: (contactId: string) => void;
  onManualCreated: (contactId: string) => void;
  onClose: () => void;
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
};

const INPUT =
  "block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400";

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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Add client</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Import from LinkedIn or enter details manually.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Close
        </button>
      </div>

      <div className="mt-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setMode("linkedin")}
          className={`rounded-md px-3 py-1.5 font-medium transition ${
            mode === "linkedin"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
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
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Manual
        </button>
      </div>

      {mode === "linkedin" ? (
        <form onSubmit={handleLinkedIn} className="mt-4 space-y-3">
          <div className="space-y-1">
            <label
              htmlFor="clientLinkedInUrl"
              className="block text-xs font-medium text-slate-700"
            >
              LinkedIn profile URL
            </label>
            <div className="relative">
              <Linkedin
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-600"
                aria-hidden
              />
              <input
                id="clientLinkedInUrl"
                type="url"
                required
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/…"
                className={`${INPUT} pl-9`}
              />
            </div>
            <p className="text-xs text-slate-500">
              We&apos;ll pull name, headline, company, photo, and location.
            </p>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-70"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Importing…" : "Import client"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleManual} className="mt-4 grid gap-3 sm:grid-cols-2">
          {showCoachSelector ? (
            <div className="space-y-1 sm:col-span-2">
              <label
                htmlFor="clientCoach"
                className="block text-xs font-medium text-slate-700"
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
              className="block text-xs font-medium text-slate-700"
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
              className="block text-xs font-medium text-slate-700"
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
          <div className="space-y-1 sm:col-span-2">
            <label
              htmlFor="clientBusinessName"
              className="block text-xs font-medium text-slate-700"
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
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-70"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Creating…" : "Create client"}
            </button>
          </div>
        </form>
      )}

      {error ? (
        <p className="mt-3 text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-3 text-sm text-emerald-600" role="status">
          {success}
        </p>
      ) : null}
    </section>
  );
}
