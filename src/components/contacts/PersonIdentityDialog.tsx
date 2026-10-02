"use client";

import { useEffect, useId, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { personIdentityNameDraft } from "@/lib/contacts/personIdentityDraft";
import type { PersonIdentitySaveInput } from "@/lib/contacts/savePersonIdentity";

type Props = {
  open: boolean;
  saving?: boolean;
  fullName: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
  photoUrl?: string | null;
  onClose: () => void;
  onSave: (input: PersonIdentitySaveInput) => Promise<void>;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

const fieldClass =
  "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500";

export function PersonIdentityDialog({
  open,
  saving = false,
  fullName,
  email,
  firstName,
  lastName,
  businessName,
  photoUrl,
  onClose,
  onSave,
}: Props) {
  const photoInputId = useId();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [business, setBusiness] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const draft = personIdentityNameDraft({
      fullName,
      email,
      firstName,
      lastName,
    });
    setFirst(draft.firstName);
    setLast(draft.lastName);
    setBusiness(businessName?.trim() ?? "");
    setPhotoFile(null);
    setRemovePhoto(false);
    setError(null);
  }, [open, fullName, email, firstName, lastName, businessName]);

  useEffect(() => {
    if (!photoFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const shownPhoto = previewUrl || (removePhoto ? null : photoUrl) || null;
  const previewName =
    [first, last].filter(Boolean).join(" ").trim() || fullName || email || "?";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedFirst = first.trim();
    if (!trimmedFirst) {
      setError("Add a first name.");
      return;
    }
    setError(null);
    try {
      await onSave({
        firstName: trimmedFirst,
        lastName: last.trim(),
        businessName: business.trim(),
        photoFile,
        removePhoto: removePhoto && !photoFile,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save.");
    }
  }

  function onPickPhoto(file: File | null) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Photo must be a JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Photo must be 2MB or smaller.");
      return;
    }
    setError(null);
    setRemovePhoto(false);
    setPhotoFile(file);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={saving}
      title="Edit name"
      titleId="person-identity-title"
      subtitle={email?.trim() || undefined}
      maxWidthClassName="max-w-md"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4">
        <div className="flex flex-col items-center">
          <label
            htmlFor={photoInputId}
            className="group relative cursor-pointer rounded-full focus-within:outline-none focus-within:ring-2 focus-within:ring-sky-400"
          >
            {shownPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shownPhoto}
                alt=""
                className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-100"
              />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-600 ring-2 ring-slate-100">
                {initials(previewName)}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/50 text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
              <Camera className="h-5 w-5" aria-hidden />
            </span>
            <input
              id={photoInputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                onPickPhoto(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Click the photo to change it
          </p>
          {shownPhoto ? (
            <button
              type="button"
              className="mt-1 text-xs font-medium text-slate-500 hover:text-rose-700"
              onClick={() => {
                setPhotoFile(null);
                setRemovePhoto(true);
              }}
            >
              Remove photo
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="person-first-name"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              First name
            </label>
            <input
              id="person-first-name"
              type="text"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              autoComplete="given-name"
              autoFocus
              className={fieldClass}
            />
          </div>
          <div>
            <label
              htmlFor="person-last-name"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Last name
            </label>
            <input
              id="person-last-name"
              type="text"
              value={last}
              onChange={(e) => setLast(e.target.value)}
              autoComplete="family-name"
              className={fieldClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="person-business-name"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Business name
            </label>
            <input
              id="person-business-name"
              type="text"
              value={business}
              onChange={(e) => setBusiness(e.target.value)}
              autoComplete="organization"
              placeholder="Business name"
              className={fieldClass}
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
