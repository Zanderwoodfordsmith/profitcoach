"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  DESIRED_OUTCOME_OTHER_VALUE,
  type QualifyingData,
  type QualifyingFieldDef,
  type QualifyingFieldId,
  type QualifyingOption,
} from "@/lib/bossScorecardQuestions";

type QualifyingStackFormProps = {
  fields: QualifyingFieldDef[];
  data: QualifyingData;
  onChange: (data: QualifyingData) => void;
  error?: string | null;
};

function OptionCards({
  options,
  value,
  onSelect,
  multi = false,
}: {
  options: QualifyingOption[];
  value: string | string[];
  onSelect: (value: string) => void;
  multi?: boolean;
}) {
  const selected = (optValue: string) =>
    multi
      ? Array.isArray(value) && value.includes(optValue)
      : value === optValue;

  return (
    <div className="grid gap-2.5">
      {options.map((opt) => {
        const isSelected = selected(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={`w-full rounded-xl border px-4 py-3.5 text-left text-base transition ${
              isSelected
                ? "border-[#438BCA] bg-sky-50 text-slate-800 shadow-sm ring-1 ring-[#438BCA]/30"
                : "border-slate-200 bg-slate-50/90 text-slate-700 hover:border-sky-300 hover:bg-white"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const OPTION_ROW_PX = 52;
const OPTION_GAP_PX = 10;
const PANEL_PADDING_PX = 20;
const FOOTER_RESERVE_PX = 130;
const TOP_RESERVE_PX = 24;
const PANEL_GAP_PX = 8;
const MULTI_SELECT_HINT_PX = 44;

function optionsPanelHeight(optionCount: number, multi = false): number {
  if (optionCount <= 0) return PANEL_PADDING_PX;
  return (
    (multi ? MULTI_SELECT_HINT_PX : 0) +
    optionCount * OPTION_ROW_PX +
    Math.max(0, optionCount - 1) * OPTION_GAP_PX +
    PANEL_PADDING_PX
  );
}

function QualifyingDropdown({
  options,
  value,
  onChange,
  multi = false,
  placeholder,
  displayOverride,
}: {
  options: QualifyingOption[];
  value: string | string[];
  onChange: (next: string | string[]) => void;
  multi?: boolean;
  placeholder: string;
  /** When set (e.g. custom "other" text), shown in the closed trigger instead of the option label. */
  displayOverride?: string;
}) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [panelMaxHeight, setPanelMaxHeight] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const contentHeight = optionsPanelHeight(options.length, multi);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setPanelMaxHeight(null);
      return;
    }

    function measure() {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const spaceBelow =
        window.innerHeight - rect.bottom - FOOTER_RESERVE_PX - PANEL_GAP_PX;
      const spaceAbove = rect.top - TOP_RESERVE_PX - PANEL_GAP_PX;

      const openUp =
        spaceBelow < contentHeight &&
        (spaceAbove >= contentHeight || spaceAbove > spaceBelow);

      const available = Math.max(0, openUp ? spaceAbove : spaceBelow);
      const maxH = Math.min(contentHeight, available);

      setOpenUpward(openUp);
      setPanelMaxHeight(maxH);
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, options.length, contentHeight]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, openUpward]);

  const selectedLabels = options
    .filter((o) =>
      multi
        ? Array.isArray(value) && value.includes(o.value)
        : value === o.value
    )
    .map((o) => o.label);

  function handleSelect(optValue: string) {
    if (multi) {
      const current = Array.isArray(value) ? value : [];
      onChange(
        current.includes(optValue)
          ? current.filter((v) => v !== optValue)
          : [...current, optValue]
      );
      return;
    }
    onChange(optValue);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left text-base transition focus:border-[#438BCA] focus:outline-none focus:ring-1 focus:ring-[#438BCA] ${
          open
            ? "border-[#438BCA] bg-white text-slate-800 ring-1 ring-[#438BCA]/30"
            : "border-slate-200 bg-slate-50/90 text-slate-700 hover:border-sky-300 hover:bg-white"
        }`}
      >
        <span
          className={
            selectedLabels.length ? "font-medium text-slate-800" : "text-slate-500"
          }
        >
          {displayOverride ??
            (selectedLabels.length
              ? selectedLabels.join(", ")
              : placeholder)}
        </span>
        <svg
          className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open ? (
        <div
          ref={panelRef}
          style={panelMaxHeight != null ? { maxHeight: panelMaxHeight } : undefined}
          className={`absolute z-50 w-full rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg ring-1 ring-slate-100 ${
            openUpward ? "bottom-full mb-2" : "top-full mt-2"
          } ${
            contentHeight > (panelMaxHeight ?? contentHeight)
              ? "overflow-y-auto overscroll-contain"
              : "overflow-visible"
          }`}
        >
          {multi ? (
            <p className="mb-2.5 rounded-lg bg-sky-50 px-3 py-2 text-center text-xs font-medium text-sky-900 ring-1 ring-sky-100">
              You can choose more than one option
            </p>
          ) : null}
          <OptionCards
            options={options}
            value={value}
            onSelect={handleSelect}
            multi={multi}
          />
        </div>
      ) : null}
    </div>
  );
}

function DesiredOutcomeOtherInput({
  field,
  data,
  onDetailChange,
}: {
  field: QualifyingFieldDef;
  data: QualifyingData;
  onDetailChange: (text: string) => void;
}) {
  const config = field.other;
  if (!config) return null;

  const detail =
    typeof data[config.detailKey] === "string"
      ? (data[config.detailKey] as string)
      : "";

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-sky-100 bg-sky-50/40 p-4">
      <textarea
        value={detail}
        onChange={(e) => onDetailChange(e.target.value)}
        rows={2}
        placeholder={config.placeholder}
        className="block w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-[#2D2F46] outline-none placeholder:text-slate-400 focus:border-[#438BCA] focus:ring-1 focus:ring-[#438BCA]"
      />
      <div>
        <p className="text-xs font-medium text-slate-500">Examples — tap to use:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {config.examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onDetailChange(example)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                detail === example
                  ? "border-[#438BCA] bg-white font-medium text-sky-900 ring-1 ring-[#438BCA]/30"
                  : "border-slate-200 bg-white/80 text-slate-700 hover:border-sky-300 hover:bg-white"
              }`}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function QualifyingStackForm({
  fields,
  data,
  onChange,
  error,
}: QualifyingStackFormProps) {
  function setField(id: QualifyingFieldId, value: string | string[]) {
    const next: QualifyingData = { ...data, [id]: value };
    if (id === "desired_outcome" && value !== DESIRED_OUTCOME_OTHER_VALUE) {
      delete next.desired_outcome_other;
    }
    onChange(next);
  }

  function setOtherDetail(field: QualifyingFieldDef, text: string) {
    if (!field.other) return;
    onChange({ ...data, [field.other.detailKey]: text });
  }

  return (
    <div className="space-y-6">
      {fields.map((field) => {
        const selectedValue = field.multi
          ? Array.isArray(data[field.id])
            ? (data[field.id] as string[])
            : data[field.id]
              ? [data[field.id] as string]
              : []
          : typeof data[field.id] === "string"
            ? (data[field.id] as string)
            : "";

        const otherDetail =
          field.other &&
          typeof data[field.other.detailKey] === "string"
            ? (data[field.other.detailKey] as string).trim()
            : "";

        const dropdownDisplayOverride =
          !field.multi &&
          selectedValue === DESIRED_OUTCOME_OTHER_VALUE &&
          otherDetail
            ? otherDetail
            : undefined;

        return (
          <div key={field.id} className="space-y-1.5">
            <label className="block text-base font-semibold text-slate-800 md:text-lg">
              {field.label}
              {field.required ? <span className="text-red-500">*</span> : null}
            </label>

            <QualifyingDropdown
              options={field.options}
              multi={field.multi}
              placeholder={
                field.multi ? "Select all that apply" : "Choose an option"
              }
              value={selectedValue}
              displayOverride={dropdownDisplayOverride}
              onChange={(next) => setField(field.id, next)}
            />

            {!field.multi &&
            field.other &&
            selectedValue === DESIRED_OUTCOME_OTHER_VALUE ? (
              <DesiredOutcomeOtherInput
                field={field}
                data={data}
                onDetailChange={(text) => setOtherDetail(field, text)}
              />
            ) : null}
          </div>
        );
      })}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
