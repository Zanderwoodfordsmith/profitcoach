"use client";

import { useEffect, useRef, useState } from "react";

function profileInitials(
  firstName: string,
  lastName: string,
  fullName: string | null | undefined
): string {
  const f = firstName.trim();
  const l = lastName.trim();
  if (f && l) return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase();
  if (f.length >= 2) return f.slice(0, 2).toUpperCase();
  if (f.length === 1) return f.toUpperCase();
  const full = fullName?.trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]?.[0];
      const b = parts[1]?.[0];
      if (a && b) return `${a}${b}`.toUpperCase();
    }
    return full.slice(0, 2).toUpperCase();
  }
  return "?";
}

export type ProfileAvatarPickerProps = {
  avatarUrl: string | null;
  firstName: string;
  lastName: string;
  fullName?: string | null;
  uploading: boolean;
  error: string | null;
  disabled?: boolean;
  compact?: boolean;
  /** Softer rounded square — fits field-style layouts. */
  fieldStyle?: boolean;
  onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onRemoveAvatar?: () => void | Promise<void>;
  removing?: boolean;
};

export function ProfileAvatarPicker({
  avatarUrl,
  firstName,
  lastName,
  fullName,
  uploading,
  error,
  disabled,
  compact = false,
  fieldStyle = false,
  onFileSelected,
  onRemoveAvatar,
  removing,
}: ProfileAvatarPickerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocMouseDown(ev: MouseEvent) {
      const el = wrapRef.current;
      if (el && !el.contains(ev.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [menuOpen]);

  const initials = profileInitials(firstName, lastName, fullName ?? null);
  const busy = uploading || removing;

  const avatarSizeClass = compact ? "h-[4.5rem] w-[4.5rem]" : "h-24 w-24";
  const initialsSizeClass = compact ? "text-base" : "text-xl";
  const shapeClass = fieldStyle
    ? "rounded-lg border border-slate-200 shadow-sm hover:border-sky-400"
    : "rounded-full ring-2 ring-slate-200 hover:ring-sky-400";

  return (
    <div ref={wrapRef} className="relative flex shrink-0 flex-col items-start gap-1">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void onFileSelected(e);
          setMenuOpen(false);
        }}
        disabled={disabled || busy}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => setMenuOpen((o) => !o)}
        className={`group relative shrink-0 overflow-hidden bg-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-60 ${avatarSizeClass} ${shapeClass}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Avatar options"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-slate-100 font-semibold text-slate-600 ${initialsSizeClass}`}>
            {initials}
          </div>
        )}
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white">
            …
          </span>
        ) : null}
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+0.25rem)] z-20 min-w-[11rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg sm:left-1/2 sm:-translate-x-1/2"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
            onClick={() => {
              fileRef.current?.click();
            }}
          >
            Upload avatar
          </button>
          {avatarUrl && onRemoveAvatar ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
              onClick={() => {
                setMenuOpen(false);
                void onRemoveAvatar();
              }}
            >
              Remove avatar
            </button>
          ) : null}
        </div>
      ) : null}

      {!compact ? (
        <p className="max-w-[12rem] text-center text-xs text-slate-500 sm:text-left">
          JPEG, PNG or WebP. Max 2MB.
        </p>
      ) : null}
      {uploading ? (
        <p className="text-xs text-slate-600">Uploading…</p>
      ) : null}
      {removing ? (
        <p className="text-xs text-slate-600">Removing…</p>
      ) : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
