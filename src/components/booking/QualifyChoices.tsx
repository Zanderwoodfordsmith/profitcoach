"use client";

import type { ReactNode } from "react";
import {
  INVESTMENT_OPTIONS,
  ROLE_OPTIONS,
  TIMING_OPTIONS,
  type RoleIcon,
} from "@/lib/booking/bookCallQualify";
import "./qualify-choices.css";

function RoleGlyph({ name }: { name: RoleIcon }) {
  const c = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    width: 22,
    height: 22,
  };

  const paths: Record<RoleIcon, ReactNode> = {
    consultant: (
      <>
        <rect x="6" y="7" width="12" height="14" rx="1.5" />
        <path d="M9 7V5.5A3 3 0 0 1 15 5.5V7" />
        <path d="M6 12h12" />
      </>
    ),
    owner: (
      <>
        <path d="M3 21h18" />
        <path d="M5 21V10l7-5 7 5v11" />
        <path d="M10 21v-5h4v5" />
      </>
    ),
    coach: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </>
    ),
    director: (
      <>
        <path d="M12 3 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-3Z" />
        <path d="M9 12h6" />
        <path d="M12 9v6" />
      </>
    ),
    other: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5c.6-1.2 2.2-1.8 3.5-1.2 1 .5 1.5 1.6 1.2 2.6-.3.9-1.2 1.4-1.7 2-.4.5-.5 1-.5 1.6" />
        <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  };

  return <svg {...c}>{paths[name]}</svg>;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18" />
      <path
        d="M7.5 12.5 10.5 15.5 16.5 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MaybeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18" />
      <path
        d="M9.2 9.4c.5-1.3 2-2 3.4-1.5 1.1.4 1.7 1.5 1.4 2.6-.3 1.1-1.3 1.6-1.9 2.3-.4.5-.6 1-.6 1.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17.2" r="1.15" fill="currentColor" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18" />
      <path
        d="M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Tone = "yes" | "maybe" | "no";

function ToneMark({ tone }: { tone: Tone }) {
  if (tone === "yes") return <CheckIcon />;
  if (tone === "maybe") return <MaybeIcon />;
  return <CrossIcon />;
}

type RolePickerProps = {
  value: string;
  onChange: (value: string) => void;
  /** denser layout for the VSL apply panel */
  compact?: boolean;
};

export function RolePicker({ value, onChange, compact = false }: RolePickerProps) {
  return (
    <div
      className={`qualify-roles${compact ? " qualify-roles--compact" : ""}`}
      role="radiogroup"
      aria-label="Which best describes you?"
    >
      {ROLE_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`qualify-role${selected ? " is-on" : ""}`}
            onClick={() => onChange(option.value)}
          >
            <span className="qualify-role__icon">
              <RoleGlyph name={option.icon} />
            </span>
            <span className="qualify-role__label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

type ChoiceRowProps = {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string; tone: Tone }[];
  ariaLabel: string;
  compact?: boolean;
};

function ChoiceRow({ value, onChange, options, ariaLabel, compact = false }: ChoiceRowProps) {
  return (
    <div
      className={`qualify-tones${compact ? " qualify-tones--compact" : ""}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`qualify-tone qualify-tone--${option.tone}${selected ? " is-on" : ""}`}
            onClick={() => onChange(option.value)}
          >
            <span className="qualify-tone__mark">
              <ToneMark tone={option.tone} />
            </span>
            <span className="qualify-tone__label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

type TimingPickerProps = {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
};

export function TimingPicker({ value, onChange, compact = false }: TimingPickerProps) {
  return (
    <ChoiceRow
      value={value}
      onChange={onChange}
      options={TIMING_OPTIONS}
      ariaLabel="Are you able to get started in the next 90 days?"
      compact={compact}
    />
  );
}

type InvestmentPickerProps = {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
};

export function InvestmentPicker({ value, onChange, compact = false }: InvestmentPickerProps) {
  return (
    <ChoiceRow
      value={value}
      onChange={onChange}
      options={INVESTMENT_OPTIONS}
      ariaLabel="This requires an investment. Does that work for you?"
      compact={compact}
    />
  );
}
