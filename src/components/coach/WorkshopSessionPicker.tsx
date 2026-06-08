"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const NEW_PERSON_VALUE = "__new__";

export { NEW_PERSON_VALUE };

export type WorkshopSessionSummary = {
  fullName: string;
  jobTitle?: string | null;
  businessName?: string | null;
};

type ContactOption = {
  id: string;
  full_name: string;
  business_name: string | null;
  type: string;
  coach_name?: string | null;
  boss_score_premium?: number | null;
};

type CoachOption = { id: string; label: string };

type WorkshopSessionPickerProps = {
  idPrefix: string;
  contacts: ContactOption[];
  selectedId: string;
  onSelectedIdChange: (value: string) => void;
  sessionSummary: WorkshopSessionSummary | null;
  onChangeSession: () => void;
  newPersonName: string;
  onNewPersonNameChange: (value: string) => void;
  newPersonTitle: string;
  onNewPersonTitleChange: (value: string) => void;
  newPersonBusiness: string;
  onNewPersonBusinessChange: (value: string) => void;
  newPersonCoachId?: string;
  onNewPersonCoachIdChange?: (value: string) => void;
  coachOptions?: CoachOption[];
  isEditingNewPerson: boolean;
  onConfirmNewPerson: () => void;
  onCancelNewPerson: () => void;
  confirmError: string | null;
  confirming: boolean;
  showNewPersonOption: boolean;
  adminUnscoped?: boolean;
  clientsHref: string;
  clientsLabel: string;
  compact?: boolean;
  showScorecardLink?: boolean;
  onViewScorecard?: () => void;
  onPickerOpen?: () => void;
  /** Hides the default “Start session” heading when no contact is selected. */
  hideEmptyStateHeading?: boolean;
  /** Opens the contact dropdown as soon as the picker mounts (e.g. centered Boss Pro gate). */
  autoOpenContactList?: boolean;
};

function formatSessionSubtitle(summary: WorkshopSessionSummary): string {
  return [summary.jobTitle, summary.businessName].filter(Boolean).join(" · ");
}

function contactSearchText(c: ContactOption): string {
  return [c.full_name, c.business_name, c.type, c.coach_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatContactLabel(c: ContactOption): string {
  const base = `${c.full_name}${c.business_name ? ` — ${c.business_name}` : ""}`;
  return c.coach_name ? `${base} · ${c.coach_name}` : base;
}

function isClientContact(c: ContactOption): boolean {
  return c.type === "client";
}

function normalizeBossProScore(score: number | null | undefined): number | null {
  if (typeof score === "number" && Number.isFinite(score)) return score;
  return null;
}

function WorkshopContactScoreIndicator({
  score,
  compact,
}: {
  score: number | null | undefined;
  compact: boolean;
}) {
  const normalized = normalizeBossProScore(score);

  if (normalized == null) {
    return (
      <span
        className={
          compact
            ? "shrink-0 whitespace-nowrap text-right text-[11px] font-medium text-sky-700 group-hover:underline"
            : "shrink-0 whitespace-nowrap text-right text-xs font-medium text-sky-700 group-hover:underline"
        }
      >
        Start
      </span>
    );
  }

  const pct = Math.min(100, Math.max(0, Math.round(normalized)));
  const size = compact ? 28 : 32;
  const strokeWidth = compact ? 3 : 3.5;
  const radius = (size - strokeWidth) / 2 - 0.5;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  const textSize = compact ? "text-[9px]" : "text-[10px]";

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e8ecf1"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#0c5280"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <span className={`relative font-semibold tabular-nums leading-none text-slate-900 ${textSize}`}>
        {pct}
      </span>
    </span>
  );
}

function ContactSectionHeader({
  label,
  compact,
  showTopDivider = false,
}: {
  label: string;
  compact: boolean;
  showTopDivider?: boolean;
}) {
  return (
    <div
      className={
        showTopDivider
          ? compact
            ? "mt-3 -mx-1 border-t border-slate-200/90 px-1 pt-2.5"
            : "mt-4 -mx-1 border-t border-slate-200/90 px-1 pt-3"
          : compact
            ? "pt-1.5"
            : "pt-2"
      }
    >
      <p
        className={
          compact
            ? "px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
            : "px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
        }
      >
        {label}
      </p>
    </div>
  );
}

function ContactOptionButton({
  contact,
  active,
  compact,
  onSelect,
  optionClassName,
}: {
  contact: ContactOption;
  active: boolean;
  compact: boolean;
  onSelect: (id: string) => void;
  optionClassName: (active: boolean) => string;
}) {
  const normalizedScore = normalizeBossProScore(contact.boss_score_premium);
  const scoreLabel =
    normalizedScore == null
      ? "Start session"
      : `Boss Pro score ${Math.round(normalizedScore)}`;

  return (
    <li className="w-full">
      <button
        type="button"
        role="option"
        aria-selected={active}
        aria-label={`${contact.full_name}. ${scoreLabel}`}
        onClick={() => onSelect(contact.id)}
        className={`${optionClassName(active)} group flex w-full items-center gap-3`}
      >
        <span className="min-w-0 flex-1 text-left">
          <span className="block font-medium leading-tight">{contact.full_name}</span>
          {contact.business_name ? (
            <span
              className={
                compact
                  ? "mt-0.5 block line-clamp-1 text-[10px] text-slate-500"
                  : "mt-0.5 block line-clamp-1 text-xs text-slate-500"
              }
            >
              {contact.business_name}
            </span>
          ) : null}
          {contact.coach_name ? (
            <span
              className={
                compact
                  ? "mt-0.5 block line-clamp-1 text-[10px] text-slate-400"
                  : "mt-0.5 block line-clamp-1 text-xs text-slate-400"
              }
            >
              {contact.coach_name}
            </span>
          ) : null}
        </span>
        <span className="ml-auto shrink-0 self-center pl-2">
          <WorkshopContactScoreIndicator
            score={contact.boss_score_premium}
            compact={compact}
          />
        </span>
      </button>
    </li>
  );
}

function ContactOptionList({
  contacts: sectionContacts,
  selectedId,
  compact,
  onSelect,
  optionClassName,
}: {
  contacts: ContactOption[];
  selectedId: string;
  compact: boolean;
  onSelect: (id: string) => void;
  optionClassName: (active: boolean) => string;
}) {
  if (sectionContacts.length === 0) return null;
  return (
    <ul className="w-full space-y-0.5">
      {sectionContacts.map((c) => (
        <ContactOptionButton
          key={c.id}
          contact={c}
          active={c.id === selectedId}
          compact={compact}
          onSelect={onSelect}
          optionClassName={optionClassName}
        />
      ))}
    </ul>
  );
}

function WorkshopContactCombobox({
  id,
  contacts,
  selectedId,
  onSelectedIdChange,
  showNewPersonOption,
  triggerClassName,
  compact,
  onOpen,
  defaultOpen = false,
}: {
  id: string;
  contacts: ContactOption[];
  selectedId: string;
  onSelectedIdChange: (value: string) => void;
  showNewPersonOption: boolean;
  triggerClassName: string;
  compact: boolean;
  onOpen?: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const didAutoOpenRef = useRef(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => contactSearchText(c).includes(q));
  }, [contacts, query]);

  const hasClientsInList = contacts.some(isClientContact);
  const hasProspectsInList = contacts.some((c) => !isClientContact(c));
  const useSectionHeaders = hasClientsInList && hasProspectsInList;

  const filteredClients = useMemo(
    () => filtered.filter(isClientContact),
    [filtered]
  );
  const filteredProspects = useMemo(
    () => filtered.filter((c) => !isClientContact(c)),
    [filtered]
  );

  const selectedContact = contacts.find((c) => c.id === selectedId);

  function handleToggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    onOpen?.();
    setOpen(true);
    setQuery("");
  }

  function handleSelect(value: string) {
    onSelectedIdChange(value);
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    if (!defaultOpen || didAutoOpenRef.current) return;
    didAutoOpenRef.current = true;
    onOpen?.();
    setOpen(true);
  }, [defaultOpen, onOpen]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const searchInputClassName = compact
    ? "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 [color-scheme:light]"
    : "w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 [color-scheme:light]";

  const optionClassName = (active: boolean) =>
    compact
      ? `rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
          active ? "bg-sky-50 text-sky-900" : "text-slate-800 hover:bg-slate-100"
        }`
      : `rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
          active ? "bg-sky-50 text-sky-900" : "text-slate-800 hover:bg-slate-100"
        }`;

  return (
    <div ref={rootRef} className={compact ? "relative min-w-0" : "relative w-full max-w-md"}>
      <button
        type="button"
        id={id}
        onClick={handleToggleOpen}
        className={`${triggerClassName} flex items-center justify-between gap-2 text-left [color-scheme:light]`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span
          className={`min-w-0 truncate ${selectedContact ? "text-slate-900" : "text-slate-500"}`}
        >
          {selectedContact ? formatContactLabel(selectedContact) : "Select someone…"}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          className={`absolute left-0 top-[calc(100%+4px)] z-[110] w-full min-w-[14rem] rounded-lg border border-slate-200 bg-white py-2 shadow-lg ring-1 ring-black/5 [color-scheme:light] ${
            compact ? "max-w-[min(100vw-2.5rem,22rem)]" : ""
          }`}
          role="listbox"
          aria-label="Contacts"
        >
          <div className="px-2 pb-2">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or business…"
              className={searchInputClassName}
              aria-label="Filter contacts"
            />
          </div>
          <div className="max-h-[min(32rem,calc(100vh-10rem))] overflow-y-auto px-1">
            {showNewPersonOption ? (
              <button
                type="button"
                role="option"
                aria-selected={selectedId === NEW_PERSON_VALUE}
                onClick={() => handleSelect(NEW_PERSON_VALUE)}
                className={`${optionClassName(selectedId === NEW_PERSON_VALUE)} font-medium text-sky-700`}
              >
                + Add new person or demo
              </button>
            ) : null}
            {filtered.length === 0 ? (
              <p
                className={
                  compact
                    ? "px-2 py-2 text-xs text-slate-500"
                    : "px-2.5 py-2 text-sm text-slate-500"
                }
              >
                {contacts.length === 0 ? "No contacts yet." : "No matches."}
              </p>
            ) : useSectionHeaders ? (
              <>
                {filteredClients.length > 0 ? (
                  <div>
                    <ContactSectionHeader label="Clients" compact={compact} />
                    <ContactOptionList
                      contacts={filteredClients}
                      selectedId={selectedId}
                      compact={compact}
                      onSelect={handleSelect}
                      optionClassName={optionClassName}
                    />
                  </div>
                ) : null}
                {filteredProspects.length > 0 ? (
                  <div>
                    <ContactSectionHeader
                      label="Prospects"
                      compact={compact}
                      showTopDivider={filteredClients.length > 0}
                    />
                    <ContactOptionList
                      contacts={filteredProspects}
                      selectedId={selectedId}
                      compact={compact}
                      onSelect={handleSelect}
                      optionClassName={optionClassName}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <ContactOptionList
                contacts={filtered}
                selectedId={selectedId}
                compact={compact}
                onSelect={handleSelect}
                optionClassName={optionClassName}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkshopSessionSummaryView({
  summary,
  onChangeSession,
  compact,
  showScorecardLink = false,
  onViewScorecard,
}: {
  summary: WorkshopSessionSummary;
  onChangeSession: () => void;
  compact?: boolean;
  showScorecardLink?: boolean;
  onViewScorecard?: () => void;
}) {
  const subtitle = formatSessionSubtitle(summary);

  return (
    <div className={compact ? "min-w-0" : undefined}>
      <div className="flex items-start justify-between gap-3">
        <p
          className={
            compact
              ? "text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              : "text-xs font-semibold uppercase tracking-wide text-slate-500"
          }
        >
          Review
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {showScorecardLink && onViewScorecard ? (
            <button
              type="button"
              onClick={onViewScorecard}
              className={
                compact
                  ? "text-[11px] font-medium text-sky-700 hover:text-sky-800 hover:underline"
                  : "text-sm font-medium text-sky-700 hover:text-sky-800 hover:underline"
              }
            >
              View BOSS Score
            </button>
          ) : null}
          <button
            type="button"
            onClick={onChangeSession}
            className={
              compact
                ? "shrink-0 text-[11px] font-medium text-sky-700 hover:text-sky-800 hover:underline"
                : "shrink-0 text-sm font-medium text-sky-700 hover:text-sky-800 hover:underline"
            }
          >
            Change
          </button>
        </div>
      </div>
      <p
        className={
          compact
            ? "mt-0.5 truncate text-sm font-semibold text-slate-900"
            : "mt-1 text-base font-semibold text-slate-900"
        }
        title={summary.fullName}
      >
        {summary.fullName}
      </p>
      {subtitle ? (
        <p
          className={
            compact
              ? "truncate text-[11px] text-slate-600"
              : "mt-0.5 text-sm text-slate-600"
          }
          title={subtitle}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function WorkshopSessionPicker({
  idPrefix,
  contacts,
  selectedId,
  onSelectedIdChange,
  sessionSummary,
  onChangeSession,
  newPersonName,
  onNewPersonNameChange,
  newPersonTitle,
  onNewPersonTitleChange,
  newPersonBusiness,
  onNewPersonBusinessChange,
  newPersonCoachId = "",
  onNewPersonCoachIdChange,
  coachOptions = [],
  isEditingNewPerson,
  onConfirmNewPerson,
  onCancelNewPerson,
  confirmError,
  confirming,
  showNewPersonOption,
  adminUnscoped = false,
  clientsHref,
  clientsLabel,
  compact = false,
  showScorecardLink = false,
  onViewScorecard,
  onPickerOpen,
  hideEmptyStateHeading = false,
  autoOpenContactList = false,
}: WorkshopSessionPickerProps) {
  const selectId = `${idPrefix}-contact-select`;
  const nameId = `${idPrefix}-new-name`;
  const titleId = `${idPrefix}-new-title`;
  const businessId = `${idPrefix}-new-business`;
  const coachId = `${idPrefix}-new-coach`;
  const formId = `${idPrefix}-new-person-form`;
  const showCoachSelector =
    adminUnscoped && onNewPersonCoachIdChange !== undefined;
  const canSubmitNewPerson =
    Boolean(newPersonName.trim()) && (!showCoachSelector || Boolean(newPersonCoachId));

  const selectClassName = compact
    ? "mt-1.5 w-full min-w-[14rem] max-w-[min(100vw-2.5rem,22rem)] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
    : "w-full max-w-md rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500";

  const headingClassName = compact
    ? "text-xs font-semibold text-slate-900"
    : "mb-1 block text-base font-semibold text-slate-900";

  const subheadingClassName = compact
    ? "mt-0.5 text-[11px] leading-snug text-slate-600"
    : "mb-3 text-sm text-slate-600";

  const inputClassName = compact
    ? "mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
    : "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500";

  const fieldLabelClassName = compact
    ? "block text-[11px] font-semibold uppercase tracking-wide text-slate-500"
    : "mb-1.5 block text-sm font-medium text-slate-700";

  if (sessionSummary) {
    return (
      <WorkshopSessionSummaryView
        summary={sessionSummary}
        onChangeSession={onChangeSession}
        compact={compact}
        showScorecardLink={showScorecardLink}
        onViewScorecard={onViewScorecard}
      />
    );
  }

  const pendingContactId =
    selectedId && selectedId !== NEW_PERSON_VALUE ? selectedId : "";

  if (pendingContactId) {
    return (
      <div>
        <p className={headingClassName}>Loading session…</p>
        <p className={subheadingClassName}>Opening their Boss Pro grid.</p>
      </div>
    );
  }

  return (
    <div>
      {!hideEmptyStateHeading ? (
        <>
          <p className={headingClassName}>Start session</p>
          <p className={subheadingClassName}>
            {isEditingNewPerson
              ? "Enter their details, then start the session."
              : showNewPersonOption
                ? adminUnscoped
                  ? "Pick a contact to score, or add someone new."
                  : "Pick someone or add a new person to score."
                : "Pick a contact to score."}
          </p>
        </>
      ) : null}

      {!isEditingNewPerson ? (
        <>
          <label htmlFor={selectId} className="sr-only">
            Who are you working with?
          </label>
          <WorkshopContactCombobox
            id={selectId}
            contacts={contacts}
            selectedId={selectedId}
            onSelectedIdChange={onSelectedIdChange}
            showNewPersonOption={showNewPersonOption}
            triggerClassName={selectClassName}
            compact={compact}
            onOpen={onPickerOpen}
            defaultOpen={autoOpenContactList}
          />
        </>
      ) : null}

      {isEditingNewPerson ? (
        <form
          id={formId}
          className={
            compact
              ? "mt-1 grid gap-2 rounded-lg border border-sky-100 bg-sky-50/60 p-2.5"
              : "mt-4 grid gap-3 rounded-xl border border-sky-100 bg-sky-50/60 p-4 sm:grid-cols-2"
          }
          onSubmit={(e) => {
            e.preventDefault();
            onConfirmNewPerson();
          }}
        >
          {showCoachSelector ? (
            <div className={compact ? undefined : "sm:col-span-2"}>
              <label htmlFor={coachId} className={fieldLabelClassName}>
                Coach <span className="text-rose-600">*</span>
              </label>
              <select
                id={coachId}
                required
                value={newPersonCoachId}
                onChange={(e) => onNewPersonCoachIdChange?.(e.target.value)}
                className={inputClassName}
              >
                <option value="">Select a coach</option>
                {coachOptions.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className={compact ? undefined : "sm:col-span-2"}>
            <label htmlFor={nameId} className={fieldLabelClassName}>
              Name <span className="text-rose-600">*</span>
            </label>
            <input
              id={nameId}
              type="text"
              className={inputClassName}
              value={newPersonName}
              onChange={(e) => onNewPersonNameChange(e.target.value)}
              placeholder="e.g. Jane Smith"
              autoComplete="name"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor={titleId} className={fieldLabelClassName}>
              Title (optional)
            </label>
            <input
              id={titleId}
              type="text"
              className={inputClassName}
              value={newPersonTitle}
              onChange={(e) => onNewPersonTitleChange(e.target.value)}
              placeholder="e.g. Managing Director"
              autoComplete="organization-title"
            />
          </div>
          <div>
            <label htmlFor={businessId} className={fieldLabelClassName}>
              Business (optional)
            </label>
            <input
              id={businessId}
              type="text"
              className={inputClassName}
              value={newPersonBusiness}
              onChange={(e) => onNewPersonBusinessChange(e.target.value)}
              placeholder="e.g. Acme Ltd"
              autoComplete="organization"
            />
          </div>
          {confirmError ? (
            <p
              className={
                compact
                  ? "text-xs text-rose-600"
                  : "sm:col-span-2 text-sm text-rose-600"
              }
              role="alert"
            >
              {confirmError}
            </p>
          ) : null}
          <div
            className={
              compact
                ? "flex flex-wrap gap-2"
                : "flex flex-wrap gap-2 sm:col-span-2"
            }
          >
            <button
              type="submit"
              disabled={confirming || !canSubmitNewPerson}
              className={
                compact
                  ? "rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  : "rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              }
            >
              {confirming ? "Starting…" : "Start session"}
            </button>
            <button
              type="button"
              disabled={confirming}
              onClick={onCancelNewPerson}
              className={
                compact
                  ? "rounded-md px-3 py-2 text-xs font-medium text-slate-600 hover:bg-white/80 hover:text-slate-800"
                  : "rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-white/80 hover:text-slate-800"
              }
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {!contacts.length && !isEditingNewPerson && showNewPersonOption ? (
        <p
          className={
            compact
              ? "mt-2 max-w-[22rem] text-[11px] leading-snug text-slate-600"
              : "mt-3 text-sm text-slate-600"
          }
        >
          No contacts yet — choose <strong>+ Add new person or demo</strong> above.
        </p>
      ) : null}

      {!contacts.length && !isEditingNewPerson && !showNewPersonOption ? (
        <p
          className={
            compact
              ? "mt-2 max-w-[22rem] text-[11px] leading-snug text-slate-600"
              : "mt-3 text-sm text-slate-600"
          }
        >
          No contacts yet. Add people from{" "}
          <a className="font-medium text-sky-700 hover:underline" href={clientsHref}>
            {clientsLabel}
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
