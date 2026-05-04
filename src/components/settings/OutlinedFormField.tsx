"use client";

import type React from "react";

const controlClass =
  "block w-full rounded-md border border-slate-300 bg-white px-3 pb-2.5 pt-3.5 text-sm text-slate-900 shadow-sm outline-none transition-[color,box-shadow] focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

const labelClass =
  "absolute left-3 top-0 z-[1] -translate-y-1/2 bg-white px-1 text-[11px] font-medium leading-tight text-slate-500";

export type OutlinedTextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  /** Width of the field; default caps width (not full viewport). */
  wrapperClassName?: string;
};

export function OutlinedTextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  disabled,
  wrapperClassName = "w-full max-w-md",
}: OutlinedTextFieldProps) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        className={controlClass}
      />
    </div>
  );
}

export type OutlinedTextAreaProps = {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  wrapperClassName?: string;
};

export function OutlinedTextArea({
  id,
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
  disabled,
  wrapperClassName = "w-full max-w-md",
}: OutlinedTextAreaProps) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`${controlClass} resize-y min-h-[4.5rem]`}
      />
    </div>
  );
}

export type OutlinedSelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
  wrapperClassName?: string;
};

export function OutlinedSelect({
  id,
  label,
  value,
  onChange,
  disabled,
  children,
  wrapperClassName = "w-full max-w-md",
}: OutlinedSelectProps) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={onChange}
        className={`${controlClass} cursor-pointer disabled:cursor-not-allowed`}
      >
        {children}
      </select>
    </div>
  );
}
