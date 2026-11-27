"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  POOL_CONTACT_FILTER_OPTIONS,
  POOL_DATE_ADDED_FILTER_OPTIONS,
  POOL_HEADCOUNT_FILTER_OPTIONS,
  POOL_LINKEDIN_FILTER_OPTIONS,
  poolSourceLabel,
} from "@/lib/pool/poolPeople";
import {
  countActivePoolFilters,
  createEmptyPoolFilters,
  POOL_CAMPAIGN_ANY,
  POOL_CAMPAIGN_NONE,
  POOL_NO_TAGS,
  type PoolFilters,
} from "@/lib/pool/poolFilters";
import { FIT_OPTIONS } from "@/lib/pool/fit";
import { POOL_OUTREACH_STATUS_OPTIONS } from "@/lib/pool/outreachStatus";
import { prospectTagTone } from "@/lib/prospects/tagAppearance";
import { fieldClass } from "@/components/ui/Field";

type CampaignChoice = {
  id: string;
  name: string;
};

export type PoolFilterSection =
  | "status"
  | "fit"
  | "tags"
  | "hide_tags"
  | "size"
  | "campaign"
  | "date"
  | "contact"
  | "linkedin"
  | "place"
  | "industry"
  | "source";

type Option = { key: string; label: string; hint?: string; tag?: boolean; divider?: boolean };

type SectionInfo = {
  key: PoolFilterSection;
  label: string;
  /** Short words for what's picked; null when the filter is off. */
  summary: string | null;
  clear: Partial<PoolFilters>;
} & (
  | { kind: "checks"; field: ListField; options: Option[]; search?: string }
  | { kind: "radio"; field: OneField; options: Option[] }
  | { kind: "text" }
);

type ListField =
  | "statusFilter"
  | "fitFilter"
  | "tagFilter"
  | "excludeTags"
  | "headcountFilter"
  | "campaignFilter"
  | "sourceFilter";
type OneField = "contactFilter" | "linkedinFilter" | "dateAddedFilter";

type Shared = {
  filters: PoolFilters;
  onChange: (patch: Partial<PoolFilters>) => void;
  tagOptions: string[];
  sourceOptions: string[];
  campaigns: CampaignChoice[];
  /** Lead Lists only (job 300). */
  showStatus?: boolean;
};

type Props = Shared & {
  /** Which edge of the trigger the panel hangs from. */
  align?: "start" | "end";
  /** Open on one filter's list; leave out to let the menu keep its own. */
  section?: PoolFilterSection | null;
  onSectionChange?: (section: PoolFilterSection | null) => void;
};

const ANY_LABEL: Record<OneField, string> = {
  contactFilter: "Any",
  linkedinFilter: "Any",
  dateAddedFilter: "Any time",
};

function summarise(labels: string[]): string | null {
  if (!labels.length) return null;
  if (labels.length <= 2) return labels.join(", ");
  return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
}

function labelsFor(picked: string[], options: Option[]): string[] {
  return picked.map(
    (key) =>
      options.find((option) => option.key.toLowerCase() === key.toLowerCase())?.label ?? key
  );
}

function sectionsFor(props: Shared): SectionInfo[] {
  const f = props.filters;
  const empty = createEmptyPoolFilters();

  const status: Option[] = POOL_OUTREACH_STATUS_OPTIONS.map((o) => ({
    key: o.key,
    label: o.label,
    hint: o.hint,
  }));
  const fit: Option[] = [
    ...FIT_OPTIONS.map((o) => ({ key: o.key, label: o.label, hint: o.hint })),
    { key: "none", label: "Not checked", hint: "Nobody has checked them yet" },
  ];
  const tagList: Option[] = props.tagOptions.map((tag) => ({ key: tag, label: tag, tag: true }));
  const tags: Option[] = [{ key: POOL_NO_TAGS, label: "No tags" }, ...tagList];
  if (tags[1]) tags[1] = { ...tags[1], divider: true };
  const sizes: Option[] = POOL_HEADCOUNT_FILTER_OPTIONS.map((o) => ({ key: o.key, label: o.label }));
  const campaigns: Option[] = [
    { key: POOL_CAMPAIGN_ANY, label: "In any campaign" },
    { key: POOL_CAMPAIGN_NONE, label: "Not in a campaign" },
    ...props.campaigns.map((c, i) => ({ key: c.id, label: c.name, divider: i === 0 })),
  ];
  const sources: Option[] = props.sourceOptions.map((s) => ({ key: s, label: poolSourceLabel(s) }));
  const radio = (options: { key: string; label: string }[], field: OneField): Option[] =>
    options.map((o) => ({ key: o.key, label: o.key === "all" ? ANY_LABEL[field] : o.label }));
  const contact = radio(POOL_CONTACT_FILTER_OPTIONS, "contactFilter");
  const linkedin = radio(POOL_LINKEDIN_FILTER_OPTIONS, "linkedinFilter");
  const date = radio(POOL_DATE_ADDED_FILTER_OPTIONS, "dateAddedFilter");
  const oneSummary = (value: string, options: Option[]) =>
    value === "all" ? null : (options.find((o) => o.key === value)?.label ?? null);

  const out: SectionInfo[] = [];
  if (props.showStatus) {
    out.push({
      key: "status",
      label: "Status",
      kind: "checks",
      field: "statusFilter",
      options: status,
      summary: summarise(labelsFor(f.statusFilter, status)),
      clear: { statusFilter: empty.statusFilter },
    });
  }
  out.push(
    {
      key: "fit",
      label: "Fit",
      kind: "checks",
      field: "fitFilter",
      options: fit,
      summary: summarise(labelsFor(f.fitFilter, fit).map((label) => label.replace(/ fit$/, ""))),
      clear: { fitFilter: empty.fitFilter },
    },
    {
      key: "tags",
      label: "Tags",
      kind: "checks",
      field: "tagFilter",
      options: tags,
      search: "Find a tag",
      summary: summarise(labelsFor(f.tagFilter, tags)),
      clear: { tagFilter: empty.tagFilter },
    }
  );
  if (tagList.length || f.excludeTags.length) {
    out.push({
      key: "hide_tags",
      label: "Hide tags",
      kind: "checks",
      field: "excludeTags",
      options: tagList,
      search: "Find a tag",
      summary: summarise(f.excludeTags),
      clear: { excludeTags: empty.excludeTags },
    });
  }
  out.push(
    {
      key: "size",
      label: "Company size",
      kind: "checks",
      field: "headcountFilter",
      options: sizes,
      summary: summarise(labelsFor(f.headcountFilter, sizes)),
      clear: { headcountFilter: empty.headcountFilter },
    },
    {
      key: "campaign",
      label: "Campaign",
      kind: "checks",
      field: "campaignFilter",
      options: campaigns,
      search: "Find a campaign",
      summary: summarise(
        f.campaignFilter.map(
          (key) => campaigns.find((o) => o.key === key)?.label ?? "Old campaign"
        )
      ),
      clear: { campaignFilter: empty.campaignFilter },
    },
    {
      key: "date",
      label: "Date added",
      kind: "radio",
      field: "dateAddedFilter",
      options: date,
      summary: oneSummary(f.dateAddedFilter, date),
      clear: { dateAddedFilter: empty.dateAddedFilter },
    },
    {
      key: "contact",
      label: "Email and phone",
      kind: "radio",
      field: "contactFilter",
      options: contact,
      summary: oneSummary(f.contactFilter, contact),
      clear: { contactFilter: empty.contactFilter },
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      kind: "radio",
      field: "linkedinFilter",
      options: linkedin,
      summary: oneSummary(f.linkedinFilter, linkedin),
      clear: { linkedinFilter: empty.linkedinFilter },
    },
    {
      key: "place",
      label: "Place",
      kind: "text",
      summary:
        [f.cityFilter.trim(), f.postcodeFilter.trim()].filter(Boolean).join(" · ") || null,
      clear: { cityFilter: "", postcodeFilter: "" },
    },
    {
      key: "industry",
      label: "Industry",
      kind: "text",
      summary: f.industryFilter.trim() || null,
      clear: { industryFilter: "" },
    },
    {
      key: "source",
      label: "Source",
      kind: "checks",
      field: "sourceFilter",
      options: sources,
      summary: summarise(labelsFor(f.sourceFilter, sources)),
      clear: { sourceFilter: empty.sourceFilter },
    }
  );
  return out;
}

function TagDot({ tag }: { tag: string }) {
  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${prospectTagTone(tag).swatch}`}
      aria-hidden
    />
  );
}

/** Focus the search box with a mouse; on phones it would pop the keyboard up. */
function hasMouse(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(pointer: fine)").matches);
}

const ROW =
  "flex min-h-9 cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50";
const TICK = "h-4 w-4 shrink-0 cursor-pointer accent-sky-600";

function SectionBody({
  section,
  props,
}: {
  section: SectionInfo;
  props: Shared;
}) {
  const [find, setFind] = useState("");
  const f = props.filters;

  if (section.kind === "text") {
    const fields =
      section.key === "place"
        ? ([
            ["cityFilter", "City or area", "Manchester"],
            ["postcodeFilter", "Postcode", "M1 or SW1A"],
          ] as const)
        : ([["industryFilter", "Industry", "Plumber"]] as const);
    return (
      <div className="space-y-2.5 p-3">
        {fields.map(([field, label, placeholder], index) => (
          <label key={field} className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
            <input
              autoFocus={index === 0}
              value={f[field]}
              onChange={(e) => props.onChange({ [field]: e.target.value } as Partial<PoolFilters>)}
              placeholder={placeholder}
              className={fieldClass("input", "small")}
            />
          </label>
        ))}
      </div>
    );
  }

  if (section.kind === "radio") {
    const value = f[section.field];
    return (
      <div role="radiogroup" aria-label={section.label} className="py-1">
        {section.options.map((option) => (
          <label key={option.key} className={ROW}>
            <input
              type="radio"
              name={`pool-filter-${section.key}`}
              checked={value === option.key}
              onChange={() => props.onChange({ [section.field]: option.key } as Partial<PoolFilters>)}
              className={TICK}
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }

  const picked = f[section.field] as string[];
  const isPicked = (key: string) => picked.some((value) => value.toLowerCase() === key.toLowerCase());
  const toggle = (key: string) =>
    props.onChange({
      [section.field]: isPicked(key)
        ? picked.filter((value) => value.toLowerCase() !== key.toLowerCase())
        : [...picked, key],
    } as Partial<PoolFilters>);
  const needle = find.trim().toLowerCase();
  const searchable = Boolean(section.search) && section.options.length > 8;
  const shown = needle
    ? section.options.filter((option) => option.label.toLowerCase().includes(needle))
    : section.options;

  return (
    <>
      {searchable ? (
        <div className="px-2 pt-2">
          <input
            type="search"
            autoFocus={hasMouse()}
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder={`${section.search}…`}
            aria-label={section.search}
            className={fieldClass("input", "small")}
          />
        </div>
      ) : null}
      <div role="group" aria-label={section.label} className="max-h-[min(26rem,60vh)] overflow-y-auto py-1">
        {shown.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-500">
            {section.options.length === 0 ? "Nothing here yet." : "No match."}
          </p>
        ) : null}
        {shown.map((option) => (
          <div key={option.key}>
            {option.divider && !needle ? <div className="mx-3 my-1 border-t border-slate-100" /> : null}
            <label className={ROW} title={option.hint ?? (option.label.length > 28 ? option.label : undefined)}>
              <input
                type="checkbox"
                checked={isPicked(option.key)}
                onChange={() => toggle(option.key)}
                className={TICK}
              />
              {option.tag ? <TagDot tag={option.key} /> : null}
              <span className="min-w-0 truncate">{option.label}</span>
            </label>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Filter menu: a short list of filters; pick one to see its tick list.
 * Ticks inside a list mean "any of these"; filters combine with AND.
 */
export function PoolFilterMenu(props: Props) {
  const [ownSection, setOwnSection] = useState<PoolFilterSection | null>(null);
  const controlled = props.onSectionChange !== undefined;
  const openKey = controlled ? (props.section ?? null) : ownSection;
  const setOpenKey = (key: PoolFilterSection | null) =>
    controlled ? props.onSectionChange?.(key) : setOwnSection(key);

  const sections = sectionsFor(props);
  const open = sections.find((section) => section.key === openKey) ?? null;
  const activeCount = countActivePoolFilters(props.filters);

  return (
    <div
      role="dialog"
      aria-label="Filters"
      className={`absolute z-[90] mt-1 flex w-[min(19rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] ${
        props.align === "end" ? "right-0" : "left-0"
      }`}
    >
      {open ? (
        <>
          <div className="flex min-h-10 items-center gap-1 border-b border-slate-100 px-1.5">
            <button
              type="button"
              onClick={() => setOpenKey(null)}
              aria-label="Back to all filters"
              className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-sm font-semibold text-slate-800 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <ChevronLeft className="h-4 w-4 text-slate-500" aria-hidden />
              {open.label}
            </button>
            {open.summary ? (
              <button
                type="button"
                onClick={() => props.onChange(open.clear)}
                className="ml-auto min-h-8 rounded-md px-2 text-xs font-semibold text-slate-600 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                Clear
              </button>
            ) : null}
          </div>
          <SectionBody key={open.key} section={open} props={props} />
        </>
      ) : (
        <>
          <div className="flex min-h-10 items-center justify-between gap-2 border-b border-slate-100 px-3">
            <span className="text-xs font-semibold text-slate-700">Filters</span>
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={() => props.onChange(createEmptyPoolFilters())}
                className="min-h-8 rounded-md px-2 text-xs font-semibold text-rose-700 outline-none hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Clear all
              </button>
            ) : null}
          </div>
          <ul className="max-h-[min(30rem,70vh)] overflow-y-auto py-1">
            {sections.map((section) => (
              <li key={section.key}>
                <button
                  type="button"
                  onClick={() => setOpenKey(section.key)}
                  className="flex min-h-9 w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-800 outline-none hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
                >
                  <span className="shrink-0">{section.label}</span>
                  {section.summary ? (
                    <span className="ml-auto min-w-0 truncate text-xs font-semibold text-sky-700">
                      {section.summary}
                    </span>
                  ) : (
                    <span className="ml-auto" />
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** One small chip per filter that's on; click to change it, × to clear it. */
export function PoolFilterChips(props: Shared & { onOpen: (section: PoolFilterSection) => void }) {
  const on = sectionsFor(props).filter((section) => section.summary);
  if (!on.length) return null;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {on.map((section) => (
        <span
          key={section.key}
          className="inline-flex h-8 max-w-[17rem] items-center rounded-full border border-sky-200 bg-sky-50 text-xs text-sky-950"
        >
          <button
            type="button"
            onClick={() => props.onOpen(section.key)}
            title={`${section.label}: ${section.summary}`}
            className="min-w-0 truncate rounded-l-full py-1 pl-3 pr-1 text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span className="font-semibold">{section.label}:</span> {section.summary}
          </button>
          <button
            type="button"
            onClick={() => props.onChange(section.clear)}
            aria-label={`Clear ${section.label}`}
            className="mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sky-800 outline-none hover:bg-sky-100 focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          </button>
        </span>
      ))}
      {on.length > 1 ? (
        <button
          type="button"
          onClick={() => props.onChange(createEmptyPoolFilters())}
          className="min-h-8 rounded-md px-2 text-xs font-semibold text-slate-600 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}
