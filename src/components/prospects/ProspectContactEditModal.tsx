"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
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
    <Modal
      open={Boolean(prospect)}
      onClose={onClose}
      busy={saving}
      title="Edit contact"
      titleId="prospect-contact-edit-title"
      subtitle={displayName || undefined}
      maxWidthClassName="max-w-lg"
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="max-h-[calc(90vh-5rem)] overflow-y-auto px-5 py-4"
      >
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
    </Modal>
  );
}
