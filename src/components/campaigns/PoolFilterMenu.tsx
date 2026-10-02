"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  POOL_CONTACT_FILTER_OPTIONS,
  POOL_DATE_ADDED_FILTER_OPTIONS,
  POOL_HEADCOUNT_FILTER_OPTIONS,
  POOL_LINKEDIN_FILTER_OPTIONS,
  poolSourceLabel,
  type PoolContactFilter,
  type PoolDateAddedFilter,
  type PoolLinkedInFilter,
} from "@/lib/pool/poolPeople";

type CampaignChoice = {
  id: string;
  name: string;
};

type Props = {
  sourceFilter: string;
  sourceOptions: string[];
  onSourceFilter: (value: string) => void;
  campaignFilter: "all" | "in_campaign" | "not_in_campaign";
  campaignIdFilter: string;
  campaigns: CampaignChoice[];
  onCampaignFilter: (value: "all" | "in_campaign" | "not_in_campaign") => void;
  onCampaignIdFilter: (value: string) => void;
  headcountFilter: string[];
  onHeadcountFilter: (value: string[]) => void;
  cityFilter: string;
  onCityFilter: (value: string) => void;
  postcodeFilter: string;
  onPostcodeFilter: (value: string) => void;
  industryFilter: string;
  onIndustryFilter: (value: string) => void;
  contactFilter: PoolContactFilter;
  onContactFilter: (value: PoolContactFilter) => void;
  linkedinFilter: PoolLinkedInFilter;
  onLinkedinFilter: (value: PoolLinkedInFilter) => void;
  dateAddedFilter: PoolDateAddedFilter;
  onDateAddedFilter: (value: PoolDateAddedFilter) => void;
  tagFilter: string;
  tagOptions: string[];
  onTagFilter: (value: string) => void;
  excludeTags: string[];
  onExcludeTags: (value: string[]) => void;
};

const CONTACT_LABELS: Record<PoolContactFilter, string> = {
  all: "Anyone",
  email: "Email",
  phone: "Phone",
  both: "Both",
  none: "Neither",
};

const LINKEDIN_LABELS: Record<PoolLinkedInFilter, string> = {
  all: "Anyone",
  has: "Has a profile",
  none: "No profile",
};

const DATE_LABELS: Record<PoolDateAddedFilter, string> = {
  all: "Any time",
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  older_than_30d: "Older",
};

function ChoiceChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`max-w-full truncate rounded-full border px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
        selected
          ? "border-[#0c5290] bg-[#0c5290] text-white"
          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-slate-900">{title}</legend>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Disclosure({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900">
            {title}
          </span>
          <span className="mt-0.5 block text-sm text-slate-600">{summary}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? <div className="mt-2 flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

export function PoolFilterMenu(props: Props) {
  const [sizeOpen, setSizeOpen] = useState(props.headcountFilter.length > 0);
  const [hideTagsOpen, setHideTagsOpen] = useState(props.excludeTags.length > 0);

  const sizeSummary =
    props.headcountFilter.length === 0
      ? "Any size"
      : POOL_HEADCOUNT_FILTER_OPTIONS.filter((option) =>
          props.headcountFilter.some(
            (value) => value.toLowerCase() === option.key.toLowerCase()
          )
        )
          .map((option) => option.label)
          .join(", ");

  const hideSummary =
    props.excludeTags.length === 0 ? "None" : props.excludeTags.join(", ");

  function toggleSize(key: string) {
    const selected = props.headcountFilter.some(
      (value) => value.toLowerCase() === key.toLowerCase()
    );
    props.onHeadcountFilter(
      selected
        ? props.headcountFilter.filter(
            (value) => value.toLowerCase() !== key.toLowerCase()
          )
        : [...props.headcountFilter, key]
    );
  }

  function toggleHiddenTag(tag: string) {
    const selected = props.excludeTags.some(
      (value) => value.toLowerCase() === tag.toLowerCase()
    );
    props.onExcludeTags(
      selected
        ? props.excludeTags.filter(
            (value) => value.toLowerCase() !== tag.toLowerCase()
          )
        : [...props.excludeTags, tag]
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Filters"
      className="absolute left-0 z-[90] mt-1 flex max-h-[min(40rem,78vh)] w-[min(36rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)]"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <Section title="Source">
          <ChoiceChip
            selected={props.sourceFilter === "all"}
            onClick={() => props.onSourceFilter("all")}
          >
            All
          </ChoiceChip>
          {props.sourceOptions.map((source) => (
            <ChoiceChip
              key={source}
              selected={props.sourceFilter === source}
              onClick={() => props.onSourceFilter(source)}
            >
              {poolSourceLabel(source)}
            </ChoiceChip>
          ))}
        </Section>

        <Section title="Campaign">
          <ChoiceChip
            selected={
              !props.campaignIdFilter && props.campaignFilter === "all"
            }
            onClick={() => props.onCampaignFilter("all")}
          >
            Anyone
          </ChoiceChip>
          <ChoiceChip
            selected={
              !props.campaignIdFilter && props.campaignFilter === "in_campaign"
            }
            onClick={() => props.onCampaignFilter("in_campaign")}
          >
            In a campaign
          </ChoiceChip>
          <ChoiceChip
            selected={
              !props.campaignIdFilter &&
              props.campaignFilter === "not_in_campaign"
            }
            onClick={() => props.onCampaignFilter("not_in_campaign")}
          >
            Not in a campaign
          </ChoiceChip>
          {props.campaigns.map((campaign) => (
            <ChoiceChip
              key={campaign.id}
              selected={props.campaignIdFilter === campaign.id}
              onClick={() =>
                props.onCampaignIdFilter(
                  props.campaignIdFilter === campaign.id ? "" : campaign.id
                )
              }
            >
              {campaign.name}
            </ChoiceChip>
          ))}
        </Section>

        <Disclosure
          title="Company size"
          summary={sizeSummary || "Any size"}
          open={sizeOpen}
          onToggle={() => setSizeOpen((open) => !open)}
        >
          <ChoiceChip
            selected={props.headcountFilter.length === 0}
            onClick={() => props.onHeadcountFilter([])}
          >
            Any size
          </ChoiceChip>
          {POOL_HEADCOUNT_FILTER_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.key}
              selected={props.headcountFilter.some(
                (value) => value.toLowerCase() === option.key.toLowerCase()
              )}
              onClick={() => toggleSize(option.key)}
            >
              {option.label}
            </ChoiceChip>
          ))}
        </Disclosure>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-900">
            City or area
            <input
              value={props.cityFilter}
              onChange={(e) => props.onCityFilter(e.target.value)}
              placeholder="Manchester"
              className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-900">
            Postcode
            <input
              value={props.postcodeFilter}
              onChange={(e) => props.onPostcodeFilter(e.target.value)}
              placeholder="M1 or SW1A"
              className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-900 sm:col-span-2">
            Industry
            <input
              value={props.industryFilter}
              onChange={(e) => props.onIndustryFilter(e.target.value)}
              placeholder="Plumber"
              className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </label>
        </div>

        <Section title="Contact">
          {POOL_CONTACT_FILTER_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.key}
              selected={props.contactFilter === option.key}
              onClick={() => props.onContactFilter(option.key)}
            >
              {CONTACT_LABELS[option.key]}
            </ChoiceChip>
          ))}
        </Section>

        <Section title="LinkedIn">
          {POOL_LINKEDIN_FILTER_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.key}
              selected={props.linkedinFilter === option.key}
              onClick={() => props.onLinkedinFilter(option.key)}
            >
              {LINKEDIN_LABELS[option.key]}
            </ChoiceChip>
          ))}
        </Section>

        <Section title="Date added">
          {POOL_DATE_ADDED_FILTER_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.key}
              selected={props.dateAddedFilter === option.key}
              onClick={() => props.onDateAddedFilter(option.key)}
            >
              {DATE_LABELS[option.key]}
            </ChoiceChip>
          ))}
        </Section>

        <Section title="Tags">
          <ChoiceChip
            selected={props.tagFilter === "all"}
            onClick={() => props.onTagFilter("all")}
          >
            Anyone
          </ChoiceChip>
          <ChoiceChip
            selected={props.tagFilter === "none"}
            onClick={() => props.onTagFilter("none")}
          >
            No tags
          </ChoiceChip>
          {props.tagOptions.map((tag) => (
            <ChoiceChip
              key={tag}
              selected={props.tagFilter.toLowerCase() === tag.toLowerCase()}
              onClick={() => props.onTagFilter(tag)}
            >
              {tag}
            </ChoiceChip>
          ))}
        </Section>

        {props.tagOptions.length > 0 ? (
          <Disclosure
            title="Hide tags"
            summary={hideSummary}
            open={hideTagsOpen}
            onToggle={() => setHideTagsOpen((open) => !open)}
          >
            <ChoiceChip
              selected={props.excludeTags.length === 0}
              onClick={() => props.onExcludeTags([])}
            >
              None
            </ChoiceChip>
            {props.tagOptions.map((tag) => (
              <ChoiceChip
                key={tag}
                selected={props.excludeTags.some(
                  (value) => value.toLowerCase() === tag.toLowerCase()
                )}
                onClick={() => toggleHiddenTag(tag)}
              >
                {tag}
              </ChoiceChip>
            ))}
          </Disclosure>
        ) : null}
      </div>
    </div>
  );
}
