"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  formatProspectLabel,
  formatProspectPersonName,
  normalizeProspectLabel,
  normalizeProspectPersonName,
} from "@/lib/prospectDisplayFormat";
import type { ProspectRow } from "@/lib/prospectRow";
import type { ProspectFieldPatch } from "@/lib/prospects/updateProspectFields";
import { splitFullName } from "@/lib/splitFullName";

type Props = {
  prospect: ProspectRow | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (patch: ProspectFieldPatch) => void | Promise<void>;
};

export function ProspectContactEditModal({
  prospect,
  saving = false,
  onClose,
  onSave,
}: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prospect) return;
    const { first_name, last_name } = splitFullName(prospect.full_name);
    setFirstName(first_name ?? "");
    setLastName(last_name ?? "");
    setEmail(prospect.email ?? "");
    setPhone(prospect.phone ?? "");
    setJobTitle(prospect.job_title ?? "");
    setBusinessName(prospect.business_name ?? "");
    setError(null);
  }, [prospect]);

  useEffect(() => {
    if (!prospect) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [prospect, saving, onClose]);

  if (!prospect) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }

    const patch: ProspectFieldPatch = {
      first_name: normalizeProspectPersonName(firstName),
      last_name: normalizeProspectPersonName(lastName),
      email: trimmedEmail,
      phone: phone.trim() || null,
      job_title: normalizeProspectLabel(jobTitle),
      business_name: normalizeProspectLabel(businessName),
    };

    try {
      await onSave(patch);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save contact details."
      );
    }
  }

  const displayName = formatProspectPersonName(
    [firstName, lastName].filter(Boolean).join(" ")
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prospect-contact-edit-title"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2
              id="prospect-contact-edit-title"
              className="text-lg font-semibold text-slate-900"
            >
              Edit contact
            </h2>
            {displayName ? (
              <p className="mt-0.5 text-sm text-slate-500">{displayName}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="prospect-first-name"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                First name
              </label>
              <input
                id="prospect-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label
                htmlFor="prospect-last-name"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Last name
              </label>
              <input
                id="prospect-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="prospect-email"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="prospect-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="prospect-phone"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Phone
              </label>
              <input
                id="prospect-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="Phone number"
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label
                htmlFor="prospect-job-title"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Title
              </label>
              <input
                id="prospect-job-title"
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Title"
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label
                htmlFor="prospect-business"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Business
              </label>
              <input
                id="prospect-business"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Business"
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {error ? (
            <p className="mt-4 text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
