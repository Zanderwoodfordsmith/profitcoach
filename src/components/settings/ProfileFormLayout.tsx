"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type React from "react";
import { ProfileTimezoneSelect } from "@/components/settings/ProfileTimezoneSelect";

const inputClass =
  "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

const textareaClass =
  "w-full resize-y rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15 disabled:cursor-not-allowed disabled:bg-slate-50";

export function ProfileSectionCard({
  title,
  description,
  children,
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {title ? (
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="px-5 py-3">{children}</div>
    </section>
  );
}

export function ProfileFieldRow({
  label,
  htmlFor,
  hint,
  children,
  alignTop = false,
  last = false,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  alignTop?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-1 py-2 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-0 ${
        last ? "" : "border-b border-slate-50"
      }`}
    >
      <label
        htmlFor={htmlFor}
        className={`text-xs font-medium text-slate-500 ${alignTop ? "sm:pt-1.5" : "sm:pt-2"}`}
      >
        {label}
      </label>
      <div className="min-w-0">
        {children}
        {hint ? (
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

export function ProfileMinimalInput({
  id,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      disabled={disabled}
      className={inputClass}
    />
  );
}

export function ProfileMinimalTextarea({
  id,
  value,
  onChange,
  rows = 3,
  placeholder,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={textareaClass}
    />
  );
}

export function ProfileMinimalSelect({
  id,
  value,
  onChange,
  disabled,
  children,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={onChange}
      className={`${inputClass} cursor-pointer disabled:cursor-not-allowed`}
    >
      {children}
    </select>
  );
}

/** @deprecated Use ProfileSectionCard */
export function ProfileDirectoryCard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProfileSectionCard
      title="Public directory"
      description="How you appear on the coach directory listing and profile page."
    >
      {children}
    </ProfileSectionCard>
  );
}

export function ProfileIdentityCard({
  avatar,
  firstName,
  lastName,
  businessName,
  location,
  onFirstNameChange,
  onLastNameChange,
  onBusinessNameChange,
  onLocationChange,
  timezoneIana,
  onTimezoneSaved,
  impersonatingCoachId,
  hasMapPin,
  onChangeMapPin,
  onClearMapPin,
  locationGeocodedManual,
}: {
  avatar: React.ReactNode;
  firstName: string;
  lastName: string;
  businessName: string;
  location: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onBusinessNameChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  timezoneIana: string | null;
  onTimezoneSaved: () => void;
  impersonatingCoachId?: string | null;
  hasMapPin?: boolean;
  onChangeMapPin?: () => void;
  onClearMapPin?: () => void;
  locationGeocodedManual?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  const displayName =
    [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") ||
    "Your name";
  const business = businessName.trim();
  const loc = location.trim();

  return (
    <ProfileSectionCard>
      <div className="flex items-start gap-4">
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            {editing ? (
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <ProfileMinimalInput
                  id="first_name"
                  value={firstName}
                  onChange={(e) => onFirstNameChange(e.target.value)}
                  placeholder="First name"
                  autoComplete="given-name"
                />
                <ProfileMinimalInput
                  id="last_name"
                  value={lastName}
                  onChange={(e) => onLastNameChange(e.target.value)}
                  placeholder="Last name"
                  autoComplete="family-name"
                />
              </div>
            ) : (
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-slate-900">
                  {displayName}
                </h2>
                {business ? (
                  <p className="truncate text-sm text-slate-600">{business}</p>
                ) : null}
                {loc ? (
                  <p className="truncate text-sm text-slate-500">
                    <span aria-hidden>📍 </span>
                    {loc}
                  </p>
                ) : null}
                <ProfileTimezoneSelect
                  timezoneIana={timezoneIana}
                  onTimezoneSaved={onTimezoneSaved}
                  impersonatingCoachId={impersonatingCoachId}
                  editing={false}
                />
                {!business && !loc ? (
                  <p className="text-sm text-slate-400">
                    Tap edit to add your details
                  </p>
                ) : null}
              </div>
            )}
            <button
              type="button"
              onClick={() => setEditing((open) => !open)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Pencil className="h-3 w-3" aria-hidden />
              {editing ? "Done" : "Edit"}
            </button>
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <ProfileMinimalInput
                id="business_name"
                value={businessName}
                onChange={(e) => onBusinessNameChange(e.target.value)}
                placeholder="Business name"
                autoComplete="organization"
              />
              <ProfileMinimalInput
                id="location"
                value={location}
                onChange={(e) => onLocationChange(e.target.value)}
                placeholder="City, region, country"
                autoComplete="address-level2"
              />
              {onChangeMapPin ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={onChangeMapPin}
                    className="font-medium text-sky-700 hover:text-sky-900 hover:underline"
                  >
                    Change map pin
                  </button>
                  {hasMapPin && onClearMapPin ? (
                    <button
                      type="button"
                      onClick={onClearMapPin}
                      className="text-slate-500 hover:text-rose-600 hover:underline"
                    >
                      Remove map pin
                    </button>
                  ) : null}
                </div>
              ) : null}
              {locationGeocodedManual ? (
                <p className="text-[11px] text-slate-500">
                  Pin placed manually — editing the text won&apos;t move it until
                  you remove it or pick a new spot.
                </p>
              ) : null}
              <div>
                <p className="mb-1 text-[11px] font-medium text-slate-400">
                  Timezone
                </p>
                <ProfileTimezoneSelect
                  timezoneIana={timezoneIana}
                  onTimezoneSaved={onTimezoneSaved}
                  impersonatingCoachId={impersonatingCoachId}
                  editing
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </ProfileSectionCard>
  );
}
