"use client";

type CoachOption = { id: string; label: string };

type Props = {
  fullName: string;
  email: string;
  businessName: string;
  sendInvite: boolean;
  onFullNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onBusinessNameChange: (v: string) => void;
  onSendInviteChange: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  creating: boolean;
  createError: string | null;
  createSuccess: string | null;
  /** Admin: list of coaches + selected + onChange. Coach: omit and set fixedCoachId to hide selector. */
  coachOptions?: CoachOption[];
  selectedCoachId?: string;
  onCoachIdChange?: (id: string) => void;
  fixedCoachId?: string | null;
  title?: string;
  description?: string;
  inviteCheckboxLabel?: string;
};

export function AddProspectForm({
  fullName,
  email,
  businessName,
  sendInvite,
  onFullNameChange,
  onEmailChange,
  onBusinessNameChange,
  onSendInviteChange,
  onSubmit,
  onClose,
  creating,
  createError,
  createSuccess,
  coachOptions = [],
  selectedCoachId = "",
  onCoachIdChange,
  fixedCoachId,
  title = "Add prospect",
  description = "Create a prospect and optionally copy their assessment link so you can email it to them.",
  inviteCheckboxLabel = "Copy the assessment link for this coach to my clipboard after creating the prospect",
}: Props) {
  const showCoachSelector =
    fixedCoachId === undefined &&
    coachOptions.length >= 0 &&
    onCoachIdChange !== undefined;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {title}
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            {description}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Close
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-4 grid gap-3 md:grid-cols-2"
      >
        {showCoachSelector && (
          <div className="space-y-1">
            <label
              htmlFor="prospectCoach"
              className="block text-xs font-medium text-slate-700"
            >
              Coach
            </label>
            <select
              id="prospectCoach"
              required
              value={selectedCoachId}
              onChange={(e) =>
                onCoachIdChange?.(
                  (e.target.value || "") as string
                )
              }
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            >
              <option value="">Select a coach</option>
              {coachOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <label
            htmlFor="prospectFullName"
            className="block text-xs font-medium text-slate-700"
          >
            Prospect name
          </label>
          <input
            id="prospectFullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="prospectEmail"
            className="block text-xs font-medium text-slate-700"
          >
            Email (optional)
          </label>
          <input
            id="prospectEmail"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="prospectBusinessName"
            className="block text-xs font-medium text-slate-700"
          >
            Business name (optional)
          </label>
          <input
            id="prospectBusinessName"
            type="text"
            value={businessName}
            onChange={(e) => onBusinessNameChange(e.target.value)}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              checked={sendInvite}
              onChange={(e) => onSendInviteChange(e.target.checked)}
            />
            <span>{inviteCheckboxLabel}</span>
          </label>
        </div>
        <div className="mt-2 flex flex-col gap-2 md:col-span-2 md:flex-row md:items-center md:justify-between">
          <div className="space-x-2">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:cursor-wait disabled:opacity-70"
            >
              {creating ? "Creating prospect…" : "Create prospect"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
          <div className="text-xs">
            {createError && (
              <p className="text-rose-600" role="alert">
                {createError}
              </p>
            )}
            {createSuccess && (
              <p className="text-emerald-600" role="status">
                {createSuccess}
              </p>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
