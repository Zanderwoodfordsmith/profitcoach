"use client";

import { useState } from "react";
import { ChevronDown, UserRoundCheck, UserRoundX } from "lucide-react";
import {
  POOL_CONTACT_FILTER_OPTIONS,
  POOL_DATE_ADDED_FILTER_OPTIONS,
  POOL_HEADCOUNT_FILTER_OPTIONS,
  poolSourceLabel,
  type PoolContactFilter,
  type PoolDateAddedFilter,
  type PoolLinkedInFilter,
} from "@/lib/pool/poolPeople";
import { prospectTagTone } from "@/lib/prospects/tagAppearance";

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
  /** Which edge of the trigger the panel hangs from. */
  align?: "start" | "end";
};

const CONTACT_LABELS: Record<
  PoolContactFilter,
  { label: string; title?: string }
> = {
  all: { label: "All" },
  email: { label: "Email", title: "Has an email" },
  phone: { label: "Phone", title: "Has a phone" },
  both: { label: "Both", title: "Has email and phone" },
  none: { label: "Neither", title: "No email or phone" },
};

const DATE_LABELS: Record<PoolDateAddedFilter, string> = {
  all: "All",
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  older_than_30d: "Older than 30 days",
};

function Group({
  label,
  children,
  columns,
}: {
  label: string;
  children: React.ReactNode;
  /** Equal columns. "sizes" is 2 columns, 4 when the panel is wide. */
  columns?: 3 | 5 | "sizes";
}) {
  const layout =
    columns === "sizes"
      ? "grid grid-cols-2 @min-[32rem]:grid-cols-4"
      : columns === 5
        ? "flex flex-wrap @min-[24rem]:grid @min-[24rem]:grid-cols-5"
        : columns === 3
          ? "flex flex-wrap @min-[24rem]:grid @min-[24rem]:grid-cols-3"
          : "flex flex-wrap";

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-semibold text-slate-700">
        {label}
      </legend>
      <div className={`gap-0.5 rounded-lg bg-slate-100 p-0.5 ${layout}`}>
        {children}
      </div>
    </fieldset>
  );
}

function Choice({
  selected,
  onClick,
  children,
  title,
  fill = false,
  selectedClassName = "bg-[#0c5290] text-white shadow-sm hover:bg-[#0a457a]",
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  /** Stretch across the grid cell. */
  fill?: boolean | "always";
  selectedClassName?: string;
  className?: string;
}) {
  const fillClass =
    fill === "always" ? "w-full" : fill ? "@min-[24rem]:w-full" : "";
  return (
    <button
      type="button"
      title={title}
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex min-h-8 min-w-[2.75rem] items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset ${fillClass} ${
        selected
          ? selectedClassName
          : "bg-white text-slate-800 hover:bg-slate-50"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
      />
    </label>
  );
}

function TagDot({ tag, selected }: { tag: string; selected: boolean }) {
  const tone = prospectTagTone(tag);
  return (
    <span
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.swatch} ${
        selected ? "ring-1 ring-white/80" : "opacity-60"
      }`}
      aria-hidden
    />
  );
}

export function PoolFilterMenu(props: Props) {
  const [hideTagsOpen, setHideTagsOpen] = useState(props.excludeTags.length > 0);

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

  const hiddenSummary =
    props.excludeTags.length === 0 ? null : props.excludeTags.join(", ");

  return (
    <div
      role="dialog"
      aria-label="Filters"
      className={`@container absolute z-[90] mt-1 flex max-h-[min(40rem,78vh)] w-[min(36rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] ${
        props.align === "end" ? "right-0" : "left-0"
      }`}
    >
      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-3.5">
        <Group label="Company size" columns="sizes">
          <Choice
            fill="always"
            selected={props.headcountFilter.length === 0}
            onClick={() => props.onHeadcountFilter([])}
          >
            All
          </Choice>
          {POOL_HEADCOUNT_FILTER_OPTIONS.map((option) => (
            <Choice
              key={option.key}
              fill="always"
              selected={props.headcountFilter.some(
                (value) => value.toLowerCase() === option.key.toLowerCase()
              )}
              onClick={() => toggleSize(option.key)}
            >
              {option.label}
            </Choice>
          ))}
        </Group>

        <Group label="Contact" columns={5}>
          {POOL_CONTACT_FILTER_OPTIONS.map((option) => {
            const copy = CONTACT_LABELS[option.key];
            return (
              <Choice
                key={option.key}
                fill
                selected={props.contactFilter === option.key}
                title={copy.title}
                onClick={() => props.onContactFilter(option.key)}
              >
                {copy.label}
              </Choice>
            );
          })}
        </Group>

        <Group label="LinkedIn" columns={3}>
          <Choice
            fill
            selected={props.linkedinFilter === "all"}
            onClick={() => props.onLinkedinFilter("all")}
          >
            All
          </Choice>
          <Choice
            fill
            selected={props.linkedinFilter === "has"}
            title="Has a LinkedIn profile"
            onClick={() => props.onLinkedinFilter("has")}
          >
            <UserRoundCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Profile
          </Choice>
          <Choice
            fill
            selected={props.linkedinFilter === "none"}
            title="No LinkedIn profile"
            onClick={() => props.onLinkedinFilter("none")}
          >
            <UserRoundX className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            No profile
          </Choice>
        </Group>

        <Group label="Tags">
          <Choice
            selected={props.tagFilter === "all"}
            onClick={() => props.onTagFilter("all")}
          >
            All
          </Choice>
          <Choice
            selected={props.tagFilter === "none"}
            onClick={() => props.onTagFilter("none")}
          >
            No tags
          </Choice>
          {props.tagOptions.map((tag) => {
            const selected =
              props.tagFilter.toLowerCase() === tag.toLowerCase();
            return (
              <Choice
                key={tag}
                selected={selected}
                title={tag}
                onClick={() => props.onTagFilter(tag)}
                className="max-w-[14rem]"
              >
                <TagDot tag={tag} selected={selected} />
                <span className="min-w-0 truncate">{tag}</span>
              </Choice>
            );
          })}
        </Group>

        <Group label="Campaign" columns={props.campaigns.length === 0 ? 3 : undefined}>
          <Choice
            fill={props.campaigns.length === 0}
            selected={!props.campaignIdFilter && props.campaignFilter === "all"}
            onClick={() => props.onCampaignFilter("all")}
          >
            All
          </Choice>
          <Choice
            fill={props.campaigns.length === 0}
            selected={
              !props.campaignIdFilter && props.campaignFilter === "in_campaign"
            }
            onClick={() => props.onCampaignFilter("in_campaign")}
          >
            In a campaign
          </Choice>
          <Choice
            fill={props.campaigns.length === 0}
            selected={
              !props.campaignIdFilter &&
              props.campaignFilter === "not_in_campaign"
            }
            onClick={() => props.onCampaignFilter("not_in_campaign")}
          >
            Not in a campaign
          </Choice>
          {props.campaigns.map((campaign) => (
            <Choice
              key={campaign.id}
              selected={props.campaignIdFilter === campaign.id}
              title={campaign.name}
              onClick={() =>
                props.onCampaignIdFilter(
                  props.campaignIdFilter === campaign.id ? "" : campaign.id
                )
              }
              className="max-w-[16rem]"
            >
              <span className="min-w-0 truncate">{campaign.name}</span>
            </Choice>
          ))}
        </Group>

        <Group label="Date added">
          {POOL_DATE_ADDED_FILTER_OPTIONS.map((option) => (
            <Choice
              key={option.key}
              selected={props.dateAddedFilter === option.key}
              onClick={() => props.onDateAddedFilter(option.key)}
            >
              {DATE_LABELS[option.key]}
            </Choice>
          ))}
        </Group>

        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="City or area"
            value={props.cityFilter}
            onChange={props.onCityFilter}
            placeholder="Manchester"
          />
          <TextField
            label="Postcode"
            value={props.postcodeFilter}
            onChange={props.onPostcodeFilter}
            placeholder="M1 or SW1A"
          />
          <TextField
            label="Industry"
            value={props.industryFilter}
            onChange={props.onIndustryFilter}
            placeholder="Plumber"
            className="col-span-2"
          />
        </div>

        <Group label="Source">
          <Choice
            selected={props.sourceFilter === "all"}
            onClick={() => props.onSourceFilter("all")}
          >
            All
          </Choice>
          {props.sourceOptions.map((source) => (
            <Choice
              key={source}
              selected={props.sourceFilter === source}
              onClick={() => props.onSourceFilter(source)}
            >
              {poolSourceLabel(source)}
            </Choice>
          ))}
        </Group>

        {props.tagOptions.length > 0 ? (
          <div>
            <button
              type="button"
              aria-expanded={hideTagsOpen}
              onClick={() => setHideTagsOpen((open) => !open)}
              className="flex w-full items-center gap-1.5 rounded-md py-0.5 text-left text-xs font-semibold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${
                  hideTagsOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              />
              Hide tags
              {hiddenSummary ? (
                <span className="truncate font-medium text-slate-500">
                  {hiddenSummary}
                </span>
              ) : null}
            </button>
            {hideTagsOpen ? (
              <div className="mt-1.5 flex flex-wrap gap-0.5 rounded-lg bg-slate-100 p-0.5">
                <Choice
                  selected={props.excludeTags.length === 0}
                  onClick={() => props.onExcludeTags([])}
                >
                  None
                </Choice>
                {props.tagOptions.map((tag) => {
                  const selected = props.excludeTags.some(
                    (value) => value.toLowerCase() === tag.toLowerCase()
                  );
                  return (
                    <Choice
                      key={tag}
                      selected={selected}
                      title={tag}
                      selectedClassName="bg-rose-800 text-white"
                      onClick={() => toggleHiddenTag(tag)}
                      className="max-w-[14rem]"
                    >
                      <TagDot tag={tag} selected={selected} />
                      <span className="min-w-0 truncate">{tag}</span>
                    </Choice>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
