"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  hoursFromMinutes,
  minutesFromHours,
  newReminderStep,
  type BookingReminderStep,
} from "@/lib/booking/reminderSequence";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { fieldClass } from "@/components/ui/Field";

type Props = {
  sequence: BookingReminderStep[];
  onChange: (next: BookingReminderStep[]) => void;
  onSave?: () => void;
  saving?: boolean;
  calendarName?: string;
};

function updateStep(
  sequence: BookingReminderStep[],
  id: string,
  patch: Partial<BookingReminderStep>
): BookingReminderStep[] {
  return sequence.map((step) => (step.id === id ? { ...step, ...patch } : step));
}

export function BookingReminderSequenceCard({
  sequence,
  onChange,
  onSave,
  saving = false,
  calendarName,
}: Props) {
  return (
    <section className={cardClass("plain", "space-y-4 px-4 py-4")}>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Reminder sequence
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {calendarName
            ? `Sent for ${calendarName} bookings from your connected inbox (and SMS when a number is on the booking).`
            : "Sent from your connected inbox (and SMS when a number is on the booking)."}{" "}
          Tokens:{" "}
          <code className="text-caption">
            {"{{first_name}} {{coach_name}} {{calendar_title}} {{when}} {{where}}"}
          </code>
        </p>
      </div>

      <ul className="divide-y divide-slate-100">
        {sequence.map((step) => {
          const hours = hoursFromMinutes(step.minutes_before);
          return (
            <li key={step.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600"
                    checked={step.enabled}
                    onChange={(e) =>
                      onChange(
                        updateStep(sequence, step.id, {
                          enabled: e.target.checked,
                        })
                      )
                    }
                  />
                  {step.kind === "confirmation"
                    ? "Confirmation"
                    : `${hours} hour${hours === 1 ? "" : "s"} before`}
                </label>
                {step.kind === "reminder" ? (
                  <button
                    type="button"
                    className={buttonClass("quiet", "small")}
                    onClick={() =>
                      onChange(sequence.filter((s) => s.id !== step.id))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Remove
                  </button>
                ) : null}
              </div>

              {step.kind === "reminder" ? (
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">
                    Hours before the call
                  </span>
                  <input
                    type="number"
                    min={0.1}
                    max={336}
                    step={0.5}
                    className={fieldClass("input", "normal", "mt-1 max-w-[10rem]")}
                    value={hours}
                    onChange={(e) =>
                      onChange(
                        updateStep(sequence, step.id, {
                          minutes_before: minutesFromHours(
                            Number(e.target.value)
                          ),
                        })
                      )
                    }
                  />
                </label>
              ) : null}

              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600"
                    checked={step.email}
                    onChange={(e) =>
                      onChange(
                        updateStep(sequence, step.id, {
                          email: e.target.checked,
                        })
                      )
                    }
                  />
                  Email
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600"
                    checked={step.sms}
                    onChange={(e) =>
                      onChange(
                        updateStep(sequence, step.id, {
                          sms: e.target.checked,
                        })
                      )
                    }
                  />
                  SMS
                </label>
              </div>

              <label className="block text-sm">
                <span className="font-medium text-slate-700">Subject</span>
                <input
                  className={fieldClass("input", "normal", "mt-1")}
                  value={step.subject}
                  onChange={(e) =>
                    onChange(
                      updateStep(sequence, step.id, { subject: e.target.value })
                    )
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Body</span>
                <textarea
                  rows={6}
                  className={fieldClass("textarea", "normal", "mt-1")}
                  value={step.body}
                  onChange={(e) =>
                    onChange(
                      updateStep(sequence, step.id, { body: e.target.value })
                    )
                  }
                />
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={buttonClass("second")}
          onClick={() => onChange([...sequence, newReminderStep()])}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add reminder
        </button>
        {onSave ? (
          <button
            type="button"
            disabled={saving}
            className={buttonClass("main")}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save sequence"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
