"use client";

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
};

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
};

function formatSessionSubtitle(summary: WorkshopSessionSummary): string {
  return [summary.jobTitle, summary.businessName].filter(Boolean).join(" · ");
}

function WorkshopSessionSummaryView({
  summary,
  onChangeSession,
  compact,
}: {
  summary: WorkshopSessionSummary;
  onChangeSession: () => void;
  compact?: boolean;
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
          Session
        </p>
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
}: WorkshopSessionPickerProps) {
  const selectId = `${idPrefix}-contact-select`;
  const nameId = `${idPrefix}-new-name`;
  const titleId = `${idPrefix}-new-title`;
  const businessId = `${idPrefix}-new-business`;
  const formId = `${idPrefix}-new-person-form`;

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
      />
    );
  }

  return (
    <div>
      <p className={headingClassName}>Start session</p>
      <p className={subheadingClassName}>
        {isEditingNewPerson
          ? "Enter their details, then start the session."
          : showNewPersonOption
            ? "Pick someone or add a new person to score."
            : "Pick a contact to score."}
      </p>

      {!isEditingNewPerson ? (
        <>
          <label htmlFor={selectId} className="sr-only">
            Who are you working with?
          </label>
          <select
            id={selectId}
            className={selectClassName}
            value={selectedId}
            onChange={(e) => onSelectedIdChange(e.target.value)}
          >
            {showNewPersonOption ? (
              <option value={NEW_PERSON_VALUE}>+ Add new person</option>
            ) : null}
            <option value="">Select someone…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
                {c.business_name ? ` — ${c.business_name}` : ""} ({c.type}
                {c.coach_name ? ` · ${c.coach_name}` : ""})
              </option>
            ))}
          </select>
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
              disabled={confirming || !newPersonName.trim()}
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

      {adminUnscoped && !showNewPersonOption ? (
        <p
          className={
            compact
              ? "mt-2 max-w-[22rem] text-[11px] leading-snug text-slate-600"
              : "mt-3 text-sm text-slate-600"
          }
        >
          To score someone new, impersonate a coach or add them from{" "}
          <a className="font-medium text-sky-700 hover:underline" href="/admin/prospects">
            Prospects
          </a>
          .
        </p>
      ) : null}

      {!contacts.length && !isEditingNewPerson && showNewPersonOption ? (
        <p
          className={
            compact
              ? "mt-2 max-w-[22rem] text-[11px] leading-snug text-slate-600"
              : "mt-3 text-sm text-slate-600"
          }
        >
          No contacts yet — choose <strong>+ Add new person</strong> above.
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
