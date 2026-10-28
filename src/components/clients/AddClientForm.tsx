"use client";

import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";
type CoachOption = { id: string; label: string };

type Props = {
  fullName: string;
  email: string;
  businessName: string;
  onFullNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onBusinessNameChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  creating: boolean;
  createError: string | null;
  createSuccess: string | null;
  createdContactId?: string | null;
  onViewAsClient?: (contactId: string) => void;
  /** Admin: optional coach selector. Coach: omit. */
  coachOptions?: CoachOption[];
  selectedCoachId?: string;
  onCoachIdChange?: (id: string) => void;
  allowUnassignedCoach?: boolean;
};

export function AddClientForm({
  fullName,
  email,
  businessName,
  onFullNameChange,
  onEmailChange,
  onBusinessNameChange,
  onSubmit,
  onClose,
  creating,
  createError,
  createSuccess,
  createdContactId,
  onViewAsClient,
  coachOptions,
  selectedCoachId = "none",
  onCoachIdChange,
  allowUnassignedCoach = true,
}: Props) {
  const showCoachSelector = Boolean(coachOptions && onCoachIdChange);

  return (
    <section className={cardClass("plain", "p-4")}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Add client</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Close
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
        {showCoachSelector ? (
          <div className="space-y-1">
            <label
              htmlFor="clientCoach"
              className="block text-xs font-medium text-slate-700"
            >
              Coach{allowUnassignedCoach ? " (optional)" : ""}
            </label>
            <select
              id="clientCoach"
              value={selectedCoachId}
              onChange={(e) => onCoachIdChange?.(e.target.value)}
              className={fieldClass("select", "small")}
            >
              {allowUnassignedCoach ? (
                <option value="none">None (unassigned)</option>
              ) : null}
              {(coachOptions ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1">
          <label
            htmlFor="clientFullName"
            className="block text-xs font-medium text-slate-700"
          >
            Full name
          </label>
          <input
            id="clientFullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            className={fieldClass("input", "small")}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="clientEmail"
            className="block text-xs font-medium text-slate-700"
          >
            Email (optional)
          </label>
          <input
            id="clientEmail"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className={fieldClass("input", "small")}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="clientBusinessName"
            className="block text-xs font-medium text-slate-700"
          >
            Business name (optional)
          </label>
          <input
            id="clientBusinessName"
            type="text"
            value={businessName}
            onChange={(e) => onBusinessNameChange(e.target.value)}
            className={fieldClass("input", "small")}
          />
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <button
            type="submit"
            disabled={creating}
            className={buttonClass("main", "normal", "w-fit")}
          >
            {creating ? "Creating…" : "Create client"}
          </button>
          {createError ? (
            <p className="text-sm text-rose-600" role="alert">
              {createError}
            </p>
          ) : null}
          {createSuccess ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-emerald-600" role="status">
                {createSuccess}
              </p>
              {createdContactId && onViewAsClient ? (
                <button
                  type="button"
                  onClick={() => onViewAsClient(createdContactId)}
                  className="text-sm font-medium text-sky-700 underline hover:text-sky-800"
                >
                  View as client →
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </form>
    </section>
  );
}
